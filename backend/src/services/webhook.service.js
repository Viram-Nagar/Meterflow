const axios = require("axios");
const crypto = require("crypto");
const Webhook = require("../models/Webhook.model");
const logger = require("../utils/logger");

// ── Sign Payload ──────────────────────────────────────────────────────────────
/**
 * Create HMAC-SHA256 signature for webhook payload
 * Consumer verifies this to ensure it came from MeterFlow
 */
const signPayload = (secret, payload) => {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
};

// ── Deliver Webhook ───────────────────────────────────────────────────────────
/**
 * Deliver a webhook to a single URL with retry logic
 * @param {Object} webhook - Webhook document
 * @param {Object} payload - Event payload
 * @param {number} attempt - Current attempt number
 */
const deliverWebhook = async (webhook, payload, attempt = 1) => {
  const MAX_ATTEMPTS = 3;
  const signature = signPayload(webhook.secret, payload);

  try {
    await axios.post(webhook.url, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "X-MeterFlow-Signature": `sha256=${signature}`,
        "X-MeterFlow-Event": payload.event,
        "X-MeterFlow-Delivery": payload.deliveryId,
        "User-Agent": "MeterFlow-Webhook/1.0",
      },
    });

    // Update success stats
    await Webhook.findByIdAndUpdate(webhook._id, {
      $inc: { totalDeliveries: 1, successDeliveries: 1 },
      lastDeliveredAt: new Date(),
      lastError: null,
    });

    logger.info("Webhook delivered successfully", {
      webhookId: webhook._id,
      url: webhook.url,
      event: payload.event,
    });

    return { success: true };
  } catch (error) {
    logger.warn(
      `Webhook delivery failed (attempt ${attempt}/${MAX_ATTEMPTS})`,
      {
        webhookId: webhook._id,
        url: webhook.url,
        error: error.message,
      },
    );

    // Retry with exponential backoff
    if (attempt < MAX_ATTEMPTS) {
      const delay = 1000 * 2 ** attempt; // 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, delay));
      return deliverWebhook(webhook, payload, attempt + 1);
    }

    // All attempts failed
    await Webhook.findByIdAndUpdate(webhook._id, {
      $inc: { totalDeliveries: 1, failedDeliveries: 1 },
      lastFailedAt: new Date(),
      lastError: error.message,
    });

    return { success: false, error: error.message };
  }
};

// ── Dispatch Event ────────────────────────────────────────────────────────────
/**
 * Dispatch an event to all matching webhooks for a user
 * Called from various parts of the app when events occur
 *
 * @param {string} userId - MongoDB user ObjectId
 * @param {string} event - Event name (e.g. "limit.warning")
 * @param {Object} data - Event data
 */
const dispatchEvent = async (userId, event, data) => {
  try {
    // Find all active webhooks for this user that listen to this event
    const webhooks = await Webhook.find({
      userId,
      isActive: true,
      events: event,
    }).select("+secret"); // Include secret for signing

    if (!webhooks.length) return;

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      deliveryId: crypto.randomUUID(),
      data,
    };

    logger.info(`Dispatching webhook event: ${event}`, {
      userId,
      webhookCount: webhooks.length,
    });

    // Deliver to all webhooks in parallel (non-blocking)
    setImmediate(async () => {
      await Promise.allSettled(
        webhooks.map((wh) => deliverWebhook(wh, payload)),
      );
    });
  } catch (error) {
    logger.error("Failed to dispatch webhook event", {
      event,
      userId,
      error: error.message,
    });
  }
};

// ── Predefined Event Dispatchers ──────────────────────────────────────────────

const emitLimitWarning = (userId, data) =>
  dispatchEvent(userId, "limit.warning", {
    message: `You have used ${data.percentUsed}% of your monthly quota`,
    used: data.used,
    limit: data.limit,
    percentUsed: data.percentUsed,
    resetAt: data.resetAt,
    upgradeUrl: `${process.env.FRONTEND_URL}/billing`,
  });

const emitLimitExceeded = (userId, data) =>
  dispatchEvent(userId, "limit.exceeded", {
    message: "Monthly request limit exceeded",
    used: data.used,
    limit: data.limit,
    resetAt: data.resetAt,
    upgradeUrl: `${process.env.FRONTEND_URL}/billing/upgrade`,
  });

const emitKeyRevoked = (userId, data) =>
  dispatchEvent(userId, "key.revoked", {
    message: `API key ${data.keyPrefix} has been revoked`,
    keyPrefix: data.keyPrefix,
    reason: data.reason,
    revokedAt: new Date().toISOString(),
  });

const emitPaymentSuccess = (userId, data) =>
  dispatchEvent(userId, "payment.success", {
    message: `Payment of ₹${data.amount} successful`,
    amount: data.amount,
    currency: data.currency,
    paymentId: data.paymentId,
    plan: data.plan,
  });

const emitPaymentFailed = (userId, data) =>
  dispatchEvent(userId, "payment.failed", {
    message: "Payment failed",
    amount: data.amount,
    error: data.error,
  });

const emitErrorSpike = (userId, data) =>
  dispatchEvent(userId, "api.error_spike", {
    message: `Error rate spike detected: ${data.errorRate}%`,
    apiId: data.apiId,
    apiName: data.apiName,
    errorRate: data.errorRate,
    threshold: 10,
  });

// ── Test Webhook ──────────────────────────────────────────────────────────────
/**
 * Send a test event to verify webhook URL is working
 * @param {Object} webhook
 */
const testWebhook = async (webhook) => {
  const testPayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    deliveryId: crypto.randomUUID(),
    data: {
      message: "This is a test webhook from MeterFlow",
      webhookId: webhook._id,
      name: webhook.name,
    },
  };

  return deliverWebhook(
    { ...webhook.toObject(), secret: webhook.secret },
    testPayload,
  );
};

module.exports = {
  dispatchEvent,
  emitLimitWarning,
  emitLimitExceeded,
  emitKeyRevoked,
  emitPaymentSuccess,
  emitPaymentFailed,
  emitErrorSpike,
  testWebhook,
  signPayload,
};
