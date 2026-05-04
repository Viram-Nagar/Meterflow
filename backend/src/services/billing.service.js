const { query, withTransaction } = require("../config/postgres");
const UsageLog = require("../models/UsageLog.model");
const User = require("../models/User.model");
const logger = require("../utils/logger");

// ── Pricing Config ────────────────────────────────────────────────────────────
const PRICING = {
  free: { freeQuota: 1000, pricePerHundred: 0, currency: "INR" },
  pro: { freeQuota: 10000, pricePerHundred: 0.5, currency: "INR" },
  enterprise: { freeQuota: 50000, pricePerHundred: 0.3, currency: "INR" },
};

// ── Tax Rate ──────────────────────────────────────────────────────────────────
const GST_RATE = 0.18; // 18% GST

// ══════════════════════════════════════════════════════════════════════════════
// CORE BILLING CALCULATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate bill for a user based on usage
 * @param {string} mongoUserId - User's MongoDB ObjectId
 * @param {string} plan - "free" | "pro" | "enterprise"
 * @param {number} totalRequests - Total requests this billing cycle
 * @returns {Object} Billing breakdown
 */
const calculateBill = (mongoUserId, plan, totalRequests) => {
  const pricing = PRICING[plan] || PRICING.free;

  const billableRequests = Math.max(0, totalRequests - pricing.freeQuota);
  const subtotal = (billableRequests / 100) * pricing.pricePerHundred;
  const tax = subtotal * GST_RATE;
  const total = subtotal + tax;

  return {
    plan,
    totalRequests,
    freeQuota: pricing.freeQuota,
    billableRequests,
    pricePerHundred: pricing.pricePerHundred,
    currency: pricing.currency,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// BILLING USER MANAGEMENT (PostgreSQL)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure billing user exists in PostgreSQL
 * Creates if not exists (upsert)
 * @param {Object} user - MongoDB user document
 * @returns {Object} PostgreSQL billing user row
 */
const ensureBillingUser = async (user) => {
  const result = await query(
    `INSERT INTO billing_users (mongo_user_id, email, plan)
     VALUES ($1, $2, $3)
     ON CONFLICT (mongo_user_id)
     DO UPDATE SET
       plan = EXCLUDED.plan,
       updated_at = NOW()
     RETURNING *`,
    [user._id.toString(), user.email, user.plan],
  );
  return result.rows[0];
};

// ══════════════════════════════════════════════════════════════════════════════
// BILLING CYCLE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get or create current billing cycle for a user
 * Billing cycle = calendar month (1st to last day)
 * @param {string} billingUserId - PostgreSQL billing_users.id
 * @returns {Object} billing cycle row
 */
const getOrCreateCurrentCycle = async (billingUserId) => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]; // "2025-04-01"
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]; // "2025-04-30"

  const result = await query(
    `INSERT INTO billing_cycles
       (user_id, period_start, period_end, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (user_id, period_start)
     DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [billingUserId, periodStart, periodEnd],
  );

  return result.rows[0];
};

/**
 * Update billing cycle with latest usage and cost
 * @param {string} cycleId - billing_cycles.id
 * @param {number} totalRequests
 * @param {Object} billBreakdown - from calculateBill()
 */
const updateBillingCycle = async (cycleId, totalRequests, billBreakdown) => {
  await query(
    `UPDATE billing_cycles SET
       total_requests   = $1,
       billable_requests = $2,
       amount_due       = $3,
       currency         = $4,
       updated_at       = NOW()
     WHERE id = $5`,
    [
      totalRequests,
      billBreakdown.billableRequests,
      billBreakdown.total,
      billBreakdown.currency,
      cycleId,
    ],
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// USAGE AGGREGATION (MongoDB → PostgreSQL)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Count total requests for a user in current billing period
 * @param {string} mongoUserId
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @returns {number} total request count
 */
const getUserUsageForPeriod = async (mongoUserId, periodStart, periodEnd) => {
  const result = await UsageLog.countDocuments({
    userId: mongoUserId,
    timestamp: {
      $gte: new Date(periodStart),
      $lte: new Date(periodEnd + "T23:59:59.999Z"),
    },
    isSuccess: true, // Only count successful requests
  });
  return result;
};

/**
 * Get detailed usage breakdown by API for a user
 * @param {string} mongoUserId
 * @param {Date} periodStart
 * @param {Date} periodEnd
 */
const getDetailedUsageBreakdown = async (
  mongoUserId,
  periodStart,
  periodEnd,
) => {
  const result = await UsageLog.aggregate([
    {
      $match: {
        userId: require("mongoose").Types.ObjectId.createFromHexString
          ? require("mongoose").Types.ObjectId.createFromHexString(
              mongoUserId.toString(),
            )
          : new (require("mongoose").Types.ObjectId)(mongoUserId.toString()),
        timestamp: {
          $gte: new Date(periodStart),
          $lte: new Date(periodEnd + "T23:59:59.999Z"),
        },
      },
    },
    {
      $group: {
        _id: "$apiId",
        totalRequests: { $sum: 1 },
        successRequests: {
          $sum: { $cond: ["$isSuccess", 1, 0] },
        },
        failedRequests: {
          $sum: { $cond: ["$isSuccess", 0, 1] },
        },
        avgLatency: { $avg: "$latency" },
        billableRequests: {
          $sum: { $cond: ["$isBillable", 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "apis",
        localField: "_id",
        foreignField: "_id",
        as: "api",
      },
    },
    { $unwind: { path: "$api", preserveNullAndEmpty: true } },
    {
      $project: {
        apiId: "$_id",
        apiName: "$api.name",
        totalRequests: 1,
        successRequests: 1,
        failedRequests: 1,
        avgLatency: { $round: ["$avgLatency", 2] },
        billableRequests: 1,
      },
    },
    { $sort: { totalRequests: -1 } },
  ]);

  return result;
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — Process Billing for a User
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Process complete billing for a single user.
 * Called by BullMQ billing job.
 * @param {string} mongoUserId
 * @returns {Object} billing summary
 */
const processUserBilling = async (mongoUserId) => {
  // Get user from MongoDB
  const user = await User.findById(mongoUserId);
  if (!user) throw new Error(`User ${mongoUserId} not found`);

  // Get current billing period dates
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Count usage in MongoDB
  const totalRequests = await getUserUsageForPeriod(
    mongoUserId,
    periodStart,
    periodEnd,
  );

  // Calculate bill
  const bill = calculateBill(mongoUserId, user.plan, totalRequests);

  // Upsert billing user in PostgreSQL
  const billingUser = await ensureBillingUser(user);

  // Get or create billing cycle
  const cycle = await getOrCreateCurrentCycle(billingUser.id);

  // Update cycle with latest numbers
  await updateBillingCycle(cycle.id, totalRequests, bill);

  logger.info("Billing processed for user", {
    userId: mongoUserId,
    plan: user.plan,
    totalRequests,
    billableRequests: bill.billableRequests,
    amountDue: bill.total,
  });

  return {
    userId: mongoUserId,
    email: user.email,
    plan: user.plan,
    cycleId: cycle.id,
    periodStart,
    periodEnd,
    ...bill,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// INVOICE GENERATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get full invoice data for a user's billing cycle
 * @param {string} mongoUserId
 * @param {string} cycleId - optional, defaults to current cycle
 */
const getInvoiceData = async (mongoUserId, cycleId = null) => {
  const user = await User.findById(mongoUserId);
  if (!user) throw new Error("User not found");

  const billingUser = await ensureBillingUser(user);

  let cycleResult;
  if (cycleId) {
    cycleResult = await query(
      "SELECT * FROM billing_cycles WHERE id = $1 AND user_id = $2",
      [cycleId, billingUser.id],
    );
  } else {
    // Get current cycle
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    cycleResult = await query(
      "SELECT * FROM billing_cycles WHERE user_id = $1 AND period_start = $2",
      [billingUser.id, periodStart],
    );
  }

  const cycle = cycleResult.rows[0];
  if (!cycle) return null;

  // Get usage breakdown by API
  const breakdown = await getDetailedUsageBreakdown(
    mongoUserId,
    cycle.period_start,
    cycle.period_end,
  );

  // Get payment history for this cycle
  const payments = await query(
    "SELECT * FROM transactions WHERE billing_cycle_id = $1 ORDER BY created_at DESC",
    [cycle.id],
  );

  const bill = calculateBill(mongoUserId, user.plan, cycle.total_requests || 0);

  return {
    invoice: {
      cycleId: cycle.id,
      periodStart: cycle.period_start,
      periodEnd: cycle.period_end,
      status: cycle.status,
      generatedAt: new Date().toISOString(),
    },
    user: {
      name: user.name,
      email: user.email,
      company: user.company,
      plan: user.plan,
    },
    usage: {
      totalRequests: cycle.total_requests || 0,
      freeQuota: bill.freeQuota,
      billableRequests: cycle.billable_requests || 0,
      byAPI: breakdown,
    },
    pricing: {
      plan: user.plan,
      freeQuota: bill.freeQuota,
      pricePerHundred: bill.pricePerHundred,
      currency: bill.currency,
    },
    billing: {
      subtotal: bill.subtotal,
      tax: bill.tax,
      taxRate: `${GST_RATE * 100}%`,
      total: bill.total,
      currency: bill.currency,
      amountPaid: payments.rows
        .filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    },
    payments: payments.rows,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// BILLING HISTORY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get all billing cycles for a user
 * @param {string} mongoUserId
 */
const getBillingHistory = async (mongoUserId) => {
  const user = await User.findById(mongoUserId);
  if (!user) return [];

  const billingUser = await ensureBillingUser(user);

  const result = await query(
    `SELECT bc.*, 
       COALESCE(
         (SELECT SUM(amount) FROM transactions 
          WHERE billing_cycle_id = bc.id AND status = 'captured'), 0
       ) as amount_paid
     FROM billing_cycles bc
     WHERE bc.user_id = $1
     ORDER BY bc.period_start DESC
     LIMIT 12`,
    [billingUser.id],
  );

  return result.rows;
};

module.exports = {
  calculateBill,
  ensureBillingUser,
  getOrCreateCurrentCycle,
  updateBillingCycle,
  getUserUsageForPeriod,
  getDetailedUsageBreakdown,
  processUserBilling,
  getInvoiceData,
  getBillingHistory,
  PRICING,
  GST_RATE,
};
