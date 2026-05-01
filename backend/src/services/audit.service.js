/**
 * @file audit.service.js
 * @description Audit log service — tracks all important user actions.
 *
 * FIXED BUGS:
 * 1. userId type mismatch — now converts to ObjectId for storage,
 *    and handles both string and ObjectId in queries
 * 2. Added billing audit logs
 * 3. Added settings audit logs
 */

const AuditLog = require("../models/AuditLog.model");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

// ── Helper — safely convert any userId to ObjectId ───────────────────────────
const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id.toString());
  }
  return null;
};

// ── Core log function (non-blocking) ─────────────────────────────────────────
const log = (data) => {
  setImmediate(async () => {
    try {
      const userId = toObjectId(data.userId);
      if (!userId) {
        logger.warn("Audit log skipped — invalid userId", { data });
        return;
      }

      await AuditLog.create({
        userId, // ← stored as ObjectId
        category: data.category,
        action: data.action,
        description: data.description,
        resourceType: data.resourceType || null,
        resourceId: data.resourceId?.toString() || null,
        ip: data.ip || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata || {},
        status: data.status || "success",
      });

      logger.debug("Audit log written", {
        category: data.category,
        action: data.action,
        userId: userId.toString(),
      });
    } catch (error) {
      logger.error("Failed to write audit log", {
        error: error.message,
        category: data.category,
        action: data.action,
      });
    }
  });
};

// ── All predefined audit loggers ──────────────────────────────────────────────
const audit = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (userId, ip, userAgent) =>
    log({
      userId,
      category: "auth",
      action: "login",
      description: "User logged in",
      ip,
      userAgent,
    }),

  logout: (userId, ip) =>
    log({
      userId,
      category: "auth",
      action: "logout",
      description: "User logged out",
      ip,
    }),

  register: (userId, ip) =>
    log({
      userId,
      category: "auth",
      action: "register",
      description: "New account created",
      ip,
    }),

  passwordChange: (userId, ip) =>
    log({
      userId,
      category: "auth",
      action: "password_change",
      description: "Password changed",
      ip,
    }),

  // ── API ──────────────────────────────────────────────────────────────────
  apiCreated: (userId, apiId, apiName, ip) =>
    log({
      userId,
      category: "api",
      action: "create",
      description: `Created API: ${apiName}`,
      resourceType: "API",
      resourceId: apiId,
      ip,
    }),

  apiUpdated: (userId, apiId, apiName, ip) =>
    log({
      userId,
      category: "api",
      action: "update",
      description: `Updated API: ${apiName}`,
      resourceType: "API",
      resourceId: apiId,
      ip,
    }),

  apiDeleted: (userId, apiId, apiName, ip) =>
    log({
      userId,
      category: "api",
      action: "delete",
      description: `Deleted API: ${apiName}`,
      resourceType: "API",
      resourceId: apiId,
      ip,
    }),

  apiToggled: (userId, apiId, apiName, status, ip) =>
    log({
      userId,
      category: "api",
      action: "toggle",
      description: `API "${apiName}" set to ${status}`,
      resourceType: "API",
      resourceId: apiId,
      ip,
      metadata: { status },
    }),

  // ── API Keys ──────────────────────────────────────────────────────────────
  keyGenerated: (userId, keyId, keyPrefix, apiName, ip) =>
    log({
      userId,
      category: "key",
      action: "generate",
      description: `Generated key ${keyPrefix} for ${apiName}`,
      resourceType: "APIKey",
      resourceId: keyId,
      ip,
    }),

  keyRevoked: (userId, keyId, keyPrefix, reason, ip) =>
    log({
      userId,
      category: "key",
      action: "revoke",
      description: `Revoked key ${keyPrefix}`,
      resourceType: "APIKey",
      resourceId: keyId,
      ip,
      metadata: { reason },
    }),

  keyRotated: (userId, oldKeyId, newKeyPrefix, ip) =>
    log({
      userId,
      category: "key",
      action: "rotate",
      description: `Rotated key → ${newKeyPrefix}`,
      resourceType: "APIKey",
      resourceId: oldKeyId,
      ip,
    }),

  // ── Billing ───────────────────────────────────────────────────────────────
  planUpgraded: (userId, oldPlan, newPlan, ip) =>
    log({
      userId,
      category: "billing",
      action: "plan_upgrade",
      description: `Plan upgraded: ${oldPlan} → ${newPlan}`,
      ip,
      metadata: { oldPlan, newPlan },
    }),

  invoicePaid: (userId, cycleId, amount, ip) =>
    log({
      userId,
      category: "billing",
      action: "invoice_paid",
      description: `Invoice paid: ₹${amount}`,
      resourceType: "BillingCycle",
      resourceId: cycleId,
      ip,
      metadata: { amount },
    }),

  // ── Webhooks ──────────────────────────────────────────────────────────────
  webhookCreated: (userId, webhookId, url, ip) =>
    log({
      userId,
      category: "webhook",
      action: "create",
      description: `Webhook created: ${url}`,
      resourceType: "Webhook",
      resourceId: webhookId,
      ip,
    }),

  webhookDeleted: (userId, webhookId, ip) =>
    log({
      userId,
      category: "webhook",
      action: "delete",
      description: "Webhook deleted",
      resourceType: "Webhook",
      resourceId: webhookId,
      ip,
    }),

  webhookTested: (userId, webhookId, success, ip) =>
    log({
      userId,
      category: "webhook",
      action: "test",
      description: `Webhook test ${success ? "succeeded" : "failed"}`,
      resourceType: "Webhook",
      resourceId: webhookId,
      ip,
      status: success ? "success" : "failed",
    }),

  // ── Settings ──────────────────────────────────────────────────────────────
  profileUpdated: (userId, ip) =>
    log({
      userId,
      category: "settings",
      action: "profile_update",
      description: "Profile updated",
      ip,
    }),
};

// ── Get audit logs — fixed userId query ──────────────────────────────────────
const getAuditLogs = async (userId, filters = {}) => {
  const { category, from, to, page = 1, limit = 20 } = filters;

  // KEY FIX: convert userId to ObjectId for the query
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return {
      logs: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  const query = { userId: userObjectId }; // ← ObjectId, not string

  if (category) query.category = category;

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  logger.debug("Audit logs fetched", {
    userId: userId.toString(),
    category,
    total,
    found: logs.length,
  });

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

module.exports = { log, audit, getAuditLogs };

// /**
//  * @file audit.service.js
//  * @description Audit log service — track all important user actions.
//  * Always async/non-blocking — never affects main request flow.
//  */

// const AuditLog = require("../models/AuditLog.model");
// const logger = require("../utils/logger");

// /**
//  * Log an audit event (non-blocking)
//  * @param {Object} data
//  */
// const log = (data) => {
//   setImmediate(async () => {
//     try {
//       await AuditLog.create({
//         userId: data.userId,
//         category: data.category,
//         action: data.action,
//         description: data.description,
//         resourceType: data.resourceType || null,
//         resourceId: data.resourceId?.toString() || null,
//         ip: data.ip || null,
//         userAgent: data.userAgent || null,
//         metadata: data.metadata || {},
//         status: data.status || "success",
//       });
//     } catch (error) {
//       logger.error("Failed to write audit log", { error: error.message });
//     }
//   });
// };

// // ── Predefined Audit Loggers ──────────────────────────────────────────────────

// const audit = {
//   // Auth
//   login: (userId, ip, userAgent) =>
//     log({
//       userId,
//       category: "auth",
//       action: "login",
//       description: "User logged in",
//       ip,
//       userAgent,
//     }),

//   logout: (userId, ip) =>
//     log({
//       userId,
//       category: "auth",
//       action: "logout",
//       description: "User logged out",
//       ip,
//     }),

//   register: (userId, ip) =>
//     log({
//       userId,
//       category: "auth",
//       action: "register",
//       description: "New account created",
//       ip,
//     }),

//   passwordChange: (userId, ip) =>
//     log({
//       userId,
//       category: "auth",
//       action: "password_change",
//       description: "Password changed",
//       ip,
//     }),

//   // API
//   apiCreated: (userId, apiId, apiName, ip) =>
//     log({
//       userId,
//       category: "api",
//       action: "create",
//       description: `Created API: ${apiName}`,
//       resourceType: "API",
//       resourceId: apiId,
//       ip,
//     }),

//   apiUpdated: (userId, apiId, apiName, ip) =>
//     log({
//       userId,
//       category: "api",
//       action: "update",
//       description: `Updated API: ${apiName}`,
//       resourceType: "API",
//       resourceId: apiId,
//       ip,
//     }),

//   apiDeleted: (userId, apiId, apiName, ip) =>
//     log({
//       userId,
//       category: "api",
//       action: "delete",
//       description: `Deleted API: ${apiName}`,
//       resourceType: "API",
//       resourceId: apiId,
//       ip,
//     }),

//   apiToggled: (userId, apiId, apiName, status, ip) =>
//     log({
//       userId,
//       category: "api",
//       action: "toggle",
//       description: `API ${apiName} set to ${status}`,
//       resourceType: "API",
//       resourceId: apiId,
//       ip,
//       metadata: { status },
//     }),

//   // API Keys
//   keyGenerated: (userId, keyId, keyPrefix, apiName, ip) =>
//     log({
//       userId,
//       category: "key",
//       action: "generate",
//       description: `Generated key ${keyPrefix} for ${apiName}`,
//       resourceType: "APIKey",
//       resourceId: keyId,
//       ip,
//     }),

//   keyRevoked: (userId, keyId, keyPrefix, reason, ip) =>
//     log({
//       userId,
//       category: "key",
//       action: "revoke",
//       description: `Revoked key ${keyPrefix}`,
//       resourceType: "APIKey",
//       resourceId: keyId,
//       ip,
//       metadata: { reason },
//     }),

//   keyRotated: (userId, oldKeyId, newKeyPrefix, ip) =>
//     log({
//       userId,
//       category: "key",
//       action: "rotate",
//       description: `Rotated key → ${newKeyPrefix}`,
//       resourceType: "APIKey",
//       resourceId: oldKeyId,
//       ip,
//     }),

//   // Billing
//   planUpgraded: (userId, oldPlan, newPlan, ip) =>
//     log({
//       userId,
//       category: "billing",
//       action: "plan_upgrade",
//       description: `Plan upgraded: ${oldPlan} → ${newPlan}`,
//       ip,
//       metadata: { oldPlan, newPlan },
//     }),

//   invoicePaid: (userId, cycleId, amount, ip) =>
//     log({
//       userId,
//       category: "billing",
//       action: "invoice_paid",
//       description: `Invoice paid: ₹${amount}`,
//       resourceType: "BillingCycle",
//       resourceId: cycleId,
//       ip,
//       metadata: { amount },
//     }),

//   // Webhooks
//   webhookCreated: (userId, webhookId, url, ip) =>
//     log({
//       userId,
//       category: "webhook",
//       action: "create",
//       description: `Webhook created: ${url}`,
//       resourceType: "Webhook",
//       resourceId: webhookId,
//       ip,
//     }),

//   webhookDeleted: (userId, webhookId, ip) =>
//     log({
//       userId,
//       category: "webhook",
//       action: "delete",
//       description: "Webhook deleted",
//       resourceType: "Webhook",
//       resourceId: webhookId,
//       ip,
//     }),

//   webhookTested: (userId, webhookId, success, ip) =>
//     log({
//       userId,
//       category: "webhook",
//       action: "test",
//       description: `Webhook test ${success ? "succeeded" : "failed"}`,
//       resourceType: "Webhook",
//       resourceId: webhookId,
//       ip,
//       status: success ? "success" : "failed",
//     }),
// };

// /**
//  * Get audit logs for a user
//  * @param {string} userId
//  * @param {Object} filters - { category, from, to, page, limit }
//  */
// const getAuditLogs = async (userId, filters = {}) => {
//   const { category, from, to, page = 1, limit = 20 } = filters;

//   const query = { userId };
//   if (category) query.category = category;
//   if (from || to) {
//     query.timestamp = {};
//     if (from) query.timestamp.$gte = new Date(from);
//     if (to) query.timestamp.$lte = new Date(to);
//   }

//   const skip = (parseInt(page) - 1) * parseInt(limit);

//   const [logs, total] = await Promise.all([
//     AuditLog.find(query)
//       .sort({ timestamp: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .lean(),
//     AuditLog.countDocuments(query),
//   ]);

//   return {
//     logs,
//     pagination: {
//       page: parseInt(page),
//       limit: parseInt(limit),
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//   };
// };

// module.exports = { log, audit, getAuditLogs };
