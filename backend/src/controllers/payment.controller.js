const {
  createPlanUpgradeOrder,
  createInvoicePaymentOrder,
  processPayment,
  getPaymentHistory,
} = require("../services/payment.service");
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendBadRequest,
} = require("../utils/response");
const { audit } = require("../services/audit.service");
const logger = require("../utils/logger");

// ── Create Plan Upgrade Order ─────────────────────────────────────────────────
const createPlanOrder = async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["pro", "enterprise"].includes(plan)) {
    return sendBadRequest(res, "Invalid plan. Choose 'pro' or 'enterprise'");
  }
  const order = await createPlanUpgradeOrder(req.userId, plan);
  return sendCreated(res, order, "Order created successfully");
};

// ── Create Invoice Payment Order ──────────────────────────────────────────────
const createInvoiceOrder = async (req, res) => {
  const { cycleId } = req.body;
  if (!cycleId) return sendBadRequest(res, "cycleId is required");
  const order = await createInvoicePaymentOrder(req.userId, cycleId);
  return sendCreated(res, order, "Invoice order created");
};

// ── Process Payment ───────────────────────────────────────────────────────────
const processPaymentHandler = async (req, res) => {
  const {
    orderId,
    method = "card",
    cardNumber,
    expiry,
    cvv,
    upiId,
    simulateFail,
  } = req.body;

  if (!orderId) return sendBadRequest(res, "orderId is required");
  if (!method) return sendBadRequest(res, "payment method is required");

  const result = await processPayment(orderId, req.userId, {
    method,
    cardNumber,
    expiry,
    cvv,
    upiId,
    simulateFail,
  });

  // Log billing audit
  if (result.plan) {
    audit.planUpgraded(req.userId, "free", result.plan, req.ip);
  } else {
    audit.invoicePaid(req.userId, req.body.orderId, result.amount, req.ip);
  }

  return sendSuccess(res, result, "Payment successful");
};

// ── Payment History ───────────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  const history = await getPaymentHistory(req.userId);
  return sendSuccess(
    res,
    { history, count: history.length },
    "Payment history fetched",
  );
};

module.exports = {
  createPlanOrder,
  createInvoiceOrder,
  processPaymentHandler,
  getHistory,
};
