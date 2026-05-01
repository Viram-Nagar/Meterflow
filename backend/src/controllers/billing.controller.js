/**
 * @file billing.controller.js
 * @description Billing API endpoints.
 *
 * GET  /api/v1/billing/current     → Current cycle usage + bill
 * GET  /api/v1/billing/history     → Past billing cycles
 * GET  /api/v1/billing/invoice/:id → Specific invoice
 * GET  /api/v1/billing/plans       → Available pricing plans
 * POST /api/v1/billing/calculate   → Preview bill calculation
 */

const {
  calculateBill,
  getInvoiceData,
  getBillingHistory,
  processUserBilling,
  PRICING,
  GST_RATE,
} = require("../services/billing.service");
const { queueUserBilling, getQueueStats } = require("../jobs/billing.job");
const { query } = require("../config/postgres");
const { sendSuccess, sendNotFound, sendError } = require("../utils/response");
const logger = require("../utils/logger");

// ── Get Current Billing ────────────────────────────────────────────────────────

/**
 * GET /api/v1/billing/current
 * Get current month's usage and billing summary
 */
const getCurrentBilling = async (req, res) => {
  const invoiceData = await getInvoiceData(req.userId);

  if (!invoiceData) {
    // No billing cycle yet — return zero usage
    const bill = calculateBill(req.userId, req.user.plan, 0);
    return sendSuccess(
      res,
      {
        invoice: null,
        usage: {
          totalRequests: 0,
          freeQuota: bill.freeQuota,
          billableRequests: 0,
        },
        pricing: {
          plan: req.user.plan,
          freeQuota: bill.freeQuota,
          pricePerHundred: bill.pricePerHundred,
          currency: bill.currency,
        },
        billing: {
          subtotal: 0,
          tax: 0,
          total: 0,
          currency: "INR",
        },
      },
      "Current billing fetched",
    );
  }

  return sendSuccess(res, invoiceData, "Current billing fetched");
};

// ── Get Billing History ───────────────────────────────────────────────────────

/**
 * GET /api/v1/billing/history
 * Get past 12 months billing cycles
 */
const getBillingHistoryController = async (req, res) => {
  const history = await getBillingHistory(req.userId);

  return sendSuccess(
    res,
    { history, count: history.length },
    "Billing history fetched",
  );
};

// ── Get Specific Invoice ──────────────────────────────────────────────────────

/**
 * GET /api/v1/billing/invoice/:cycleId
 * Get detailed invoice for a specific billing cycle
 */
const getInvoice = async (req, res) => {
  const { cycleId } = req.params;

  const invoiceData = await getInvoiceData(req.userId, cycleId);

  if (!invoiceData) {
    return sendNotFound(res, "Invoice not found");
  }

  return sendSuccess(res, invoiceData, "Invoice fetched");
};

// ── Get All Plans ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/billing/plans
 * Get all available pricing plans
 */
const getPlans = async (req, res) => {
  const plans = [
    {
      id: "free",
      name: "Free",
      description: "Perfect for testing and small projects",
      price: 0,
      currency: "INR",
      freeQuota: PRICING.free.freeQuota,
      pricePerHundred: PRICING.free.pricePerHundred,
      features: [
        "1,000 requests/month",
        "1 API",
        "3 API keys",
        "Basic analytics",
        "Community support",
      ],
      limits: {
        apis: 1,
        keysPerAPI: 3,
        requestsPerMonth: 1000,
        requestsPerMinute: 10,
      },
      isCurrent: req.user.plan === "free",
      isPopular: false,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For growing businesses and developers",
      price: 499,
      currency: "INR",
      freeQuota: PRICING.pro.freeQuota,
      pricePerHundred: PRICING.pro.pricePerHundred,
      features: [
        "10,000 requests/month free",
        "₹0.50 per 100 requests after",
        "10 APIs",
        "50 API keys",
        "Full analytics",
        "Webhooks",
        "Email support",
      ],
      limits: {
        apis: 10,
        keysPerAPI: 50,
        requestsPerMonth: 100000,
        requestsPerMinute: 100,
      },
      isCurrent: req.user.plan === "pro",
      isPopular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "For large scale applications",
      price: 2999,
      currency: "INR",
      freeQuota: PRICING.enterprise.freeQuota,
      pricePerHundred: PRICING.enterprise.pricePerHundred,
      features: [
        "50,000 requests/month free",
        "₹0.30 per 100 requests after",
        "Unlimited APIs",
        "Unlimited API keys",
        "Priority analytics",
        "Webhooks + Audit logs",
        "Priority support",
        "SLA guarantee",
        "Custom rate limits",
      ],
      limits: {
        apis: -1, // unlimited
        keysPerAPI: -1, // unlimited
        requestsPerMonth: -1,
        requestsPerMinute: 1000,
      },
      isCurrent: req.user.plan === "enterprise",
      isPopular: false,
    },
  ];

  return sendSuccess(
    res,
    { plans, currentPlan: req.user.plan },
    "Plans fetched",
  );
};

// ── Preview Bill Calculation ──────────────────────────────────────────────────

/**
 * POST /api/v1/billing/calculate
 * Preview what a bill would look like for given usage
 * Used in the frontend billing calculator
 */
const calculateBillPreview = async (req, res) => {
  const { requests = 0, plan = req.user.plan } = req.body;

  if (requests < 0) {
    return sendError(res, "Requests cannot be negative", 400);
  }

  const bill = calculateBill(req.userId, plan, parseInt(requests));

  return sendSuccess(
    res,
    {
      input: { requests: parseInt(requests), plan },
      breakdown: {
        freeRequests: Math.min(requests, bill.freeQuota),
        billableRequests: bill.billableRequests,
        pricePerHundred: bill.pricePerHundred,
      },
      pricing: {
        subtotal: bill.subtotal,
        gst: bill.tax,
        gstRate: `${GST_RATE * 100}%`,
        total: bill.total,
        currency: bill.currency,
      },
    },
    "Bill calculated",
  );
};

// ── Trigger Manual Billing (Admin) ────────────────────────────────────────────

/**
 * POST /api/v1/billing/trigger
 * Manually trigger billing calculation for current user
 * Useful for testing
 */
const triggerBilling = async (req, res) => {
  const job = await queueUserBilling(req.userId);

  return sendSuccess(
    res,
    { jobId: job.id, message: "Billing calculation queued" },
    "Billing job queued successfully",
  );
};

// ── Queue Stats (Admin only) ──────────────────────────────────────────────────

/**
 * GET /api/v1/billing/queue-stats
 * Get BullMQ queue statistics
 */
const getBillingQueueStats = async (req, res) => {
  const stats = await getQueueStats();
  return sendSuccess(res, stats, "Queue stats fetched");
};

module.exports = {
  getCurrentBilling,
  getBillingHistoryController,
  getInvoice,
  getPlans,
  calculateBillPreview,
  triggerBilling,
  getBillingQueueStats,
};
