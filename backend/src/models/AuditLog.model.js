/**
 * @file AuditLog.model.js
 * @description Audit log for tracking all important user actions.
 * Stored in MongoDB with 1-year TTL.
 *
 * Logged actions:
 * - auth: login, logout, register, password_change
 * - api: create, update, delete, toggle
 * - key: generate, revoke, rotate
 * - billing: plan_upgrade, invoice_paid
 * - webhook: create, delete, test
 */

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Action category and name
    category: {
      type: String,
      enum: ["auth", "api", "key", "billing", "webhook", "settings"],
      required: true,
    },

    action: {
      type: String,
      required: true,
    },

    // Human readable description
    description: {
      type: String,
      required: true,
    },

    // What was affected
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },

    // Request context
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },

    // Extra data
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Success or failure
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

// Indexes
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, category: 1 });
auditLogSchema.index({ timestamp: -1 });

// TTL — auto delete after 1 year
auditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 },
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
module.exports = AuditLog;
