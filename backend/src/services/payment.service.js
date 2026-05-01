const crypto = require("crypto");
const { query, withTransaction } = require("../config/postgres");
const User = require("../models/User.model");
const { ensureBillingUser } = require("./billing.service");
const logger = require("../utils/logger");
const env = require("../config/env");

// ── Plan Prices ───────────────────────────────────────────────────────────────
const PLAN_PRICES = {
  pro: { amount: 499, currency: "INR", name: "MeterFlow Pro" },
  enterprise: { amount: 2999, currency: "INR", name: "MeterFlow Enterprise" },
};

// ── Generate Order ID ─────────────────────────────────────────────────────────
const generateOrderId = () =>
  `mf_order_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

const generatePaymentId = () =>
  `mf_pay_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

// ══════════════════════════════════════════════════════════════════════════════
// CREATE ORDER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a mock payment order for plan upgrade
 * @param {string} mongoUserId
 * @param {string} plan - "pro" | "enterprise"
 */
const createPlanUpgradeOrder = async (mongoUserId, plan) => {
  const planConfig = PLAN_PRICES[plan];
  if (!planConfig) throw new Error(`Invalid plan: ${plan}`);

  const user = await User.findById(mongoUserId);
  if (!user) throw new Error("User not found");
  if (user.plan === plan) throw new Error(`Already on ${plan} plan`);

  const billingUser = await ensureBillingUser(user);
  const orderId = generateOrderId();

  // Save pending transaction
  await query(
    `INSERT INTO transactions
       (user_id, amount, currency, order_id, status, payment_method, metadata)
     VALUES ($1, $2, $3, $4, 'pending', 'mock_payment', $5)`,
    [
      billingUser.id,
      planConfig.amount,
      planConfig.currency,
      orderId,
      JSON.stringify({ plan, type: "plan_upgrade", orderId }),
    ],
  );

  logger.info("Mock order created", { orderId, userId: mongoUserId, plan });

  return {
    orderId,
    amount: planConfig.amount,
    currency: planConfig.currency,
    planName: planConfig.name,
    plan,
    user: { name: user.name, email: user.email },
  };
};

/**
 * Create a mock payment order for invoice payment
 */
const createInvoicePaymentOrder = async (mongoUserId, cycleId) => {
  const user = await User.findById(mongoUserId);
  if (!user) throw new Error("User not found");

  const billingUser = await ensureBillingUser(user);

  const cycleResult = await query(
    "SELECT * FROM billing_cycles WHERE id = $1 AND user_id = $2",
    [cycleId, billingUser.id],
  );

  const cycle = cycleResult.rows[0];
  if (!cycle) throw new Error("Billing cycle not found");
  if (cycle.status === "paid") throw new Error("Invoice already paid");
  if (cycle.amount_due <= 0) throw new Error("No amount due");

  const orderId = generateOrderId();

  await query(
    `INSERT INTO transactions
       (user_id, billing_cycle_id, amount, currency, order_id, status, payment_method, metadata)
     VALUES ($1, $2, $3, $4, $5, 'pending', 'mock_payment', $6)`,
    [
      billingUser.id,
      cycleId,
      cycle.amount_due,
      cycle.currency || "INR",
      orderId,
      JSON.stringify({ type: "invoice_payment", cycleId, orderId }),
    ],
  );

  return {
    orderId,
    amount: cycle.amount_due,
    currency: cycle.currency || "INR",
    user: { name: user.name, email: user.email },
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// PROCESS PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Process a mock payment
 * Simulates realistic payment processing with delay
 *
 * @param {string} orderId
 * @param {string} mongoUserId
 * @param {Object} paymentDetails - { cardNumber, expiry, cvv, upiId, method }
 * @returns {Object} payment result
 */
const processPayment = async (orderId, mongoUserId, paymentDetails = {}) => {
  const user = await User.findById(mongoUserId);
  if (!user) throw new Error("User not found");

  const billingUser = await ensureBillingUser(user);

  // Get pending transaction
  const txResult = await query(
    "SELECT * FROM transactions WHERE order_id = $1 AND user_id = $2 AND status = $3",
    [orderId, billingUser.id, "pending"],
  );

  const tx = txResult.rows[0];
  if (!tx) throw new Error("Order not found or already processed");

  // Simulate payment processing delay (realistic UX)
  await new Promise((r) => setTimeout(r, 1500));

  // Simulate 95% success rate (realistic)
  // In test mode: specific card numbers trigger failure
  const isFailure =
    paymentDetails.cardNumber === "4000000000000002" ||
    paymentDetails.simulateFail === true;

  const paymentId = generatePaymentId();
  const metadata = tx.metadata || {};

  if (isFailure) {
    // Mark transaction as failed
    await query(
      `UPDATE transactions SET
         payment_id = $1, status = 'failed',
         metadata = metadata || $2::jsonb
       WHERE order_id = $3`,
      [
        paymentId,
        JSON.stringify({
          failedAt: new Date().toISOString(),
          reason: "Card declined",
        }),
        orderId,
      ],
    );

    throw new Error("Payment failed — card declined. Use a different card.");
  }

  // ── Payment Success ──────────────────────────────────────────────────────
  await withTransaction(async (client) => {
    // Update transaction to captured
    await client.query(
      `UPDATE transactions SET
         payment_id = $1,
         status = 'captured',
         metadata = metadata || $2::jsonb
       WHERE order_id = $3`,
      [
        paymentId,
        JSON.stringify({
          capturedAt: new Date().toISOString(),
          method: paymentDetails.method || "card",
        }),
        orderId,
      ],
    );

    // If plan upgrade → update user plan
    if (metadata.type === "plan_upgrade" && metadata.plan) {
      await User.findByIdAndUpdate(mongoUserId, { plan: metadata.plan });
      await client.query("UPDATE billing_users SET plan = $1 WHERE id = $2", [
        metadata.plan,
        billingUser.id,
      ]);
      logger.info("Plan upgraded via mock payment", {
        userId: mongoUserId,
        plan: metadata.plan,
      });
    }

    // If invoice payment → mark cycle as paid
    if (metadata.type === "invoice_payment" && tx.billing_cycle_id) {
      await client.query(
        "UPDATE billing_cycles SET status = 'paid', updated_at = NOW() WHERE id = $1",
        [tx.billing_cycle_id],
      );
    }
  });

  logger.info("Mock payment captured", {
    orderId,
    paymentId,
    userId: mongoUserId,
    amount: tx.amount,
  });

  return {
    paymentId,
    orderId,
    amount: tx.amount,
    currency: tx.currency,
    status: "captured",
    plan: metadata.plan || null,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT HISTORY
// ══════════════════════════════════════════════════════════════════════════════

const getPaymentHistory = async (mongoUserId) => {
  const user = await User.findById(mongoUserId);
  if (!user) return [];

  const billingUser = await ensureBillingUser(user);

  const result = await query(
    `SELECT * FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [billingUser.id],
  );

  return result.rows;
};

module.exports = {
  createPlanUpgradeOrder,
  createInvoicePaymentOrder,
  processPayment,
  getPaymentHistory,
  PLAN_PRICES,
};
