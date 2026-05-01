/**
 * @file env.js
 * @description Centralized environment variable config with validation.
 * App crashes on startup if required vars are missing — fail fast principle.
 */

const requiredVars = [
  "MONGODB_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ENCRYPTION_KEY",
];

const validateEnv = () => {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `\n❌ FATAL: Missing required environment variables:\n   ${missing.join(", ")}\n`,
    );
    console.error(`   → Copy .env.example to .env and fill in values\n`);
    process.exit(1);
  }
};

validateEnv();

const env = {
  // ── Server ──────────────────────────────────────
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,
  API_VERSION: process.env.API_VERSION || "v1",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",

  // ── MongoDB ─────────────────────────────────────
  MONGODB_URI: process.env.MONGODB_URI,

  // ── PostgreSQL ───────────────────────────────────
  POSTGRES: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    database: process.env.POSTGRES_DB || "meterflow_billing",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "",
    ssl: process.env.POSTGRES_SSL === "true",
  },

  // ── Redis ────────────────────────────────────────
  REDIS: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === "true",
  },

  // ── JWT ──────────────────────────────────────────
  JWT: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  },

  // ── Encryption ───────────────────────────────────
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // ── Razorpay ─────────────────────────────────────
  RAZORPAY: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  // ── Email ─────────────────────────────────────────
  EMAIL: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "MeterFlow <noreply@meterflow.dev>",
  },

  // ── URLs ─────────────────────────────────────────
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

  // ── Gateway ──────────────────────────────────────
  GATEWAY: {
    timeout: parseInt(process.env.GATEWAY_TIMEOUT, 10) || 30000,
    maxRedirects: parseInt(process.env.GATEWAY_MAX_REDIRECTS, 10) || 3,
  },

  // ── BullMQ ───────────────────────────────────────
  BULL_CONCURRENCY: parseInt(process.env.BULL_CONCURRENCY, 10) || 5,

  // ── Rate Limiting ────────────────────────────────
  RATE_LIMIT: {
    windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW, 10) || 15,
    max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX, 10) || 100,
  },

  // ── Logging ──────────────────────────────────────
  LOG: {
    level: process.env.LOG_LEVEL || "debug",
    filePath: process.env.LOG_FILE_PATH || "logs",
  },
};

module.exports = env;
