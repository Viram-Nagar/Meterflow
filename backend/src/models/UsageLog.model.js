/**
 * @file UsageLog.model.js
 * @description Every gateway request gets logged here.
 * High write volume — optimized with indexes and TTL.
 */

const mongoose = require("mongoose");

const usageLogSchema = new mongoose.Schema(
  {
    // ── Relations ───────────────────────────────────────────
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "APIKey",
      required: true,
    },
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "API",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Request Info ────────────────────────────────────────
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    // Full URL forwarded to target API
    targetUrl: {
      type: String,
      trim: true,
    },
    // Query params (for analytics)
    queryParams: {
      type: Map,
      of: String,
      default: {},
    },

    // ── Response Info ───────────────────────────────────────
    statusCode: {
      type: Number,
      required: true,
    },
    // success = 2xx, failed = 4xx/5xx
    isSuccess: {
      type: Boolean,
      required: true,
    },

    // ── Performance ─────────────────────────────────────────
    // Latency in milliseconds
    latency: {
      type: Number,
      required: true,
      min: 0,
    },
    // Sizes in bytes
    requestSize: {
      type: Number,
      default: 0,
    },
    responseSize: {
      type: Number,
      default: 0,
    },

    // ── Client Info ─────────────────────────────────────────
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    origin: {
      type: String,
      default: null,
    },

    // ── Error Info (if failed) ──────────────────────────────
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },

    // ── Billing ─────────────────────────────────────────────
    // Was this request billable (after free quota)?
    isBillable: {
      type: Boolean,
      default: false,
    },
    billingProcessed: {
      type: Boolean,
      default: false,
    },

    // ── Timestamp ───────────────────────────────────────────
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // No timestamps: true — we use custom timestamp field
    // for better query performance
    versionKey: false,
  },
);

// ── Indexes (Critical for performance) ───────────────────────────────────────
// Most common query patterns:
usageLogSchema.index({ apiKeyId: 1, timestamp: -1 }); // Key usage history
usageLogSchema.index({ apiId: 1, timestamp: -1 }); // API usage history
usageLogSchema.index({ userId: 1, timestamp: -1 }); // User usage history
usageLogSchema.index({ userId: 1, billingProcessed: 1 }); // Billing jobs
// timestamp index covered by TTL index below
usageLogSchema.index({ isSuccess: 1, timestamp: -1 }); // Error rate queries

// ── TTL Index — Auto delete logs after 90 days ────────────────────────────────
// Keeps DB size manageable in production
usageLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }, // 90 days
);

const UsageLog = mongoose.model("UsageLog", usageLogSchema);
module.exports = UsageLog;
