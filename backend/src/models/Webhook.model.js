const mongoose = require("mongoose");
const crypto = require("crypto");

const webhookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Target URL to POST to
    url: {
      type: String,
      required: [true, "Webhook URL is required"],
      trim: true,
      match: [/^https?:\/\/.+/, "Must be a valid URL"],
    },

    // Human readable name
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // HMAC secret — used to sign webhook payloads
    // Consumer verifies this to ensure payload is from MeterFlow
    secret: {
      type: String,
      required: true,
      select: false, // Never return in queries by default
    },

    // Which events trigger this webhook
    events: {
      type: [String],
      enum: [
        "limit.warning",
        "limit.exceeded",
        "payment.success",
        "payment.failed",
        "key.revoked",
        "api.error_spike",
      ],
      default: ["limit.warning", "limit.exceeded"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Delivery stats
    totalDeliveries: { type: Number, default: 0 },
    successDeliveries: { type: Number, default: 0 },
    failedDeliveries: { type: Number, default: 0 },
    lastDeliveredAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

// ── Static — Generate webhook secret ─────────────────────────────────────────
webhookSchema.statics.generateSecret = function () {
  return `mfwhsec_${crypto.randomBytes(24).toString("hex")}`;
};

const Webhook = mongoose.model("Webhook", webhookSchema);
module.exports = Webhook;
