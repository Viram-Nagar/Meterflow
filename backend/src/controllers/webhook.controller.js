/**
 * @file webhook.controller.js
 * @description Webhook management endpoints.
 *
 * POST   /api/v1/webhooks          → Create webhook
 * GET    /api/v1/webhooks          → List webhooks
 * GET    /api/v1/webhooks/:id      → Get webhook
 * PATCH  /api/v1/webhooks/:id      → Update webhook
 * DELETE /api/v1/webhooks/:id      → Delete webhook
 * POST   /api/v1/webhooks/:id/test → Test webhook
 * GET    /api/v1/audit             → Get audit logs
 */

const Webhook = require("../models/Webhook.model");
const { testWebhook } = require("../services/webhook.service");
const { audit, getAuditLogs } = require("../services/audit.service");
const {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
} = require("../utils/response");

// ── Create Webhook ────────────────────────────────────────────────────────────
const createWebhook = async (req, res) => {
  const { url, name, events } = req.body;

  if (!url || !name) return sendBadRequest(res, "URL and name are required");

  const secret = Webhook.generateSecret();

  const webhook = await Webhook.create({
    userId: req.userId,
    url,
    name,
    events: events || ["limit.warning", "limit.exceeded"],
    secret,
  });

  audit.webhookCreated(req.userId, webhook._id, url, req.ip);

  return sendCreated(
    res,
    {
      webhook: { ...webhook.toObject(), secret }, // Return secret ONCE
      warning: "Save this secret — it will not be shown again.",
    },
    "Webhook created",
  );
};

// ── List Webhooks ─────────────────────────────────────────────────────────────
const getWebhooks = async (req, res) => {
  const webhooks = await Webhook.find({ userId: req.userId }).sort({
    createdAt: -1,
  });

  return sendSuccess(
    res,
    { webhooks, count: webhooks.length },
    "Webhooks fetched",
  );
};

// ── Get Webhook ───────────────────────────────────────────────────────────────
const getWebhook = async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (!webhook) return sendNotFound(res, "Webhook not found");
  return sendSuccess(res, { webhook }, "Webhook fetched");
};

// ── Update Webhook ────────────────────────────────────────────────────────────
const updateWebhook = async (req, res) => {
  const { url, name, events, isActive } = req.body;

  const webhook = await Webhook.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { url, name, events, isActive },
    { new: true, runValidators: true },
  );

  if (!webhook) return sendNotFound(res, "Webhook not found");
  return sendSuccess(res, { webhook }, "Webhook updated");
};

// ── Delete Webhook ────────────────────────────────────────────────────────────
const deleteWebhook = async (req, res) => {
  const webhook = await Webhook.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!webhook) return sendNotFound(res, "Webhook not found");
  audit.webhookDeleted(req.userId, req.params.id, req.ip);
  return sendSuccess(res, null, "Webhook deleted");
};

// ── Test Webhook ──────────────────────────────────────────────────────────────
const testWebhookHandler = async (req, res) => {
  const webhook = await Webhook.findOne({
    _id: req.params.id,
    userId: req.userId,
  }).select("+secret");

  if (!webhook) return sendNotFound(res, "Webhook not found");

  const result = await testWebhook(webhook);
  audit.webhookTested(req.userId, req.params.id, result.success, req.ip);

  return sendSuccess(
    res,
    result,
    result.success ? "Test webhook delivered!" : "Test webhook failed",
  );
};

// ── Get Audit Logs ────────────────────────────────────────────────────────────
const getAuditLogsHandler = async (req, res) => {
  const { category, from, to, page, limit } = req.query;
  const result = await getAuditLogs(req.userId, {
    category,
    from,
    to,
    page,
    limit,
  });
  return sendSuccess(res, result, "Audit logs fetched");
};

module.exports = {
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhookHandler,
  getAuditLogsHandler,
};
