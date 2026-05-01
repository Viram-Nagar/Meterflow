/**
 * @file APIKey.model.js
 * @description Schema for API keys generated for APIs.
 * Each key is given to a consumer to access an API through our gateway.
 *
 * Security model:
 * - Full key shown ONCE on generation (like GitHub tokens)
 * - Only hashed version stored in DB
 * - Key prefix stored for display (mf_live_a8f3...)
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

const apiKeySchema = new mongoose.Schema(
  {
    // ── Relations ───────────────────────────────────────────
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "API",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Key Data ────────────────────────────────────────────
    // Only prefix stored in plaintext (for display)
    // e.g. "mf_live_a8f3k2x9"
    keyPrefix: {
      type: String,
      required: true,
    },

    // SHA-256 hash of the full key (for lookup)
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ── Metadata ────────────────────────────────────────────
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Default Key",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    // ── Status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "revoked", "expired", "suspended"],
      default: "active",
      index: true,
    },

    // ── Tier / Plan ─────────────────────────────────────────
    tier: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },

    // ── Rate Limiting (can override API defaults) ────────────
    rateLimit: {
      requestsPerMinute: { type: Number, default: 60 },
      requestsPerMonth: { type: Number, default: 10000 },
    },

    // ── Usage Stats (updated by background job) ─────────────
    totalRequests: { type: Number, default: 0 },
    successRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },

    // Current month usage (reset monthly)
    currentMonthRequests: { type: Number, default: 0 },
    monthResetAt: {
      type: Date,
      default: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      },
    },

    // ── Expiry ──────────────────────────────────────────────
    expiresAt: {
      type: Date,
      default: null, // null = never expires
    },

    // ── Tracking ────────────────────────────────────────────
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: null },

    // Who revoked it and why
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },

    // ── Allowed origins (CORS for this key) ─────────────────
    allowedOrigins: {
      type: [String],
      default: [], // Empty = allow all
    },

    // ── Webhook for this key ─────────────────────────────────
    webhookUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
apiKeySchema.index({ apiId: 1, status: 1 });
apiKeySchema.index({ userId: 1, status: 1 });
apiKeySchema.index({ userId: 1, createdAt: -1 });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });

// ── Static — Hash a key ───────────────────────────────────────────────────────
apiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

// ── Static — Find by raw key ──────────────────────────────────────────────────
apiKeySchema.statics.findByRawKey = function (rawKey) {
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  return this.findOne({ keyHash: hash, status: "active" });
};

// ── Method — Check if expired ─────────────────────────────────────────────────
apiKeySchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// ── Method — Check rate limit ─────────────────────────────────────────────────
apiKeySchema.methods.isMonthlyLimitReached = function () {
  return this.currentMonthRequests >= this.rateLimit.requestsPerMonth;
};

const APIKey = mongoose.model("APIKey", apiKeySchema);
module.exports = APIKey;
