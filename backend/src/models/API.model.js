/**
 * @file API.model.js
 * @description Schema for APIs registered by owners on MeterFlow.
 * An API is the service the owner wants to proxy and monetize.
 */

const mongoose = require("mongoose");

const apiSchema = new mongoose.Schema(
  {
    // ── Owner ───────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // ── Basic Info ──────────────────────────────────────────
    name: {
      type: String,
      required: [true, "API name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    category: {
      type: String,
      enum: [
        "weather",
        "finance",
        "crypto",
        "ai",
        "maps",
        "social",
        "ecommerce",
        "health",
        "sports",
        "news",
        "utilities",
        "other",
      ],
      default: "other",
    },

    // ── Target URL (the real API we proxy to) ───────────────
    baseUrl: {
      type: String,
      required: [true, "Base URL is required"],
      trim: true,
      match: [/^https?:\/\/.+/, "Base URL must be a valid HTTP/HTTPS URL"],
    },

    // ── Auth Config for target API ──────────────────────────
    // If the real API needs its own key, store it here (encrypted)
    targetAuth: {
      type: {
        type: String,
        enum: ["none", "header", "query", "bearer"],
        default: "none",
      },
      key: { type: String, default: null }, // Header/param name
      value: { type: String, default: null }, // Encrypted secret value
    },

    // ── Status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    // ── Pricing ─────────────────────────────────────────────
    pricing: {
      freeQuota: {
        type: Number,
        default: 1000, // Free requests per month
        min: 0,
      },
      pricePerHundred: {
        type: Number,
        default: 0.5, // ₹0.50 per 100 requests after free quota
        min: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },

    // ── Rate Limiting ───────────────────────────────────────
    rateLimit: {
      requestsPerMinute: {
        type: Number,
        default: 60,
        min: 1,
        max: 10000,
      },
      requestsPerMonth: {
        type: Number,
        default: 10000,
        min: 1,
      },
    },

    // ── Gateway Config ──────────────────────────────────────
    timeout: {
      type: Number,
      default: 30000, // 30 seconds
      min: 1000,
      max: 120000,
    },

    // Strip these headers before forwarding to target API
    stripHeaders: {
      type: [String],
      default: ["x-api-key", "authorization"],
    },

    // ── Stats (cached — updated by background job) ──────────
    totalRequests: { type: Number, default: 0 },
    totalKeys: { type: Number, default: 0 },
    successRate: { type: Number, default: 100 },
    avgLatency: { type: Number, default: 0 },

    // ── Visibility ──────────────────────────────────────────
    isPublic: {
      type: Boolean,
      default: false, // Public = listed in marketplace
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.length <= 10,
        message: "Maximum 10 tags allowed",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
apiSchema.index({ userId: 1, status: 1 });
apiSchema.index({ userId: 1, createdAt: -1 });
apiSchema.index({ status: 1, isPublic: 1 });
apiSchema.index({ category: 1 });

// ── Virtual — active keys count ───────────────────────────────────────────────
apiSchema.virtual("activeKeys", {
  ref: "APIKey",
  localField: "_id",
  foreignField: "apiId",
  count: true,
  match: { status: "active" },
});

const API = mongoose.model("API", apiSchema);
module.exports = API;
