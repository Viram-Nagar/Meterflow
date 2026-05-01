/**
 * @file redis.js
 * @description Redis client using ioredis.
 * Used for:
 * - Rate limiting (sliding window counters)
 * - API key caching (avoid DB hit on every request)
 * - Session/token blacklisting
 * - BullMQ job queue backend
 */

const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

// ── Client Options ───────────────────────────────────────────────────────────

const redisOptions = {
  host: env.REDIS.host,
  port: env.REDIS.port,
  ...(env.REDIS.password && { password: env.REDIS.password }),
  ...(env.REDIS.tls && { tls: {} }),

  // Auto-reconnect settings
  retryStrategy(times) {
    if (times > 10) {
      logger.error("❌ Redis: Too many reconnect attempts. Giving up.");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 3000);
    logger.warn(`⏳ Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },

  // Prevent blocking entire app on Redis failure
  enableOfflineQueue: false,

  // Connection timeout
  connectTimeout: 10000,

  // Keep alive
  keepAlive: 30000,

  // Descriptive name for monitoring
  connectionName: "meterflow-main",

  lazyConnect: true, // Don't connect until .connect() is called
};

// ── Create Clients ───────────────────────────────────────────────────────────

// Main client — for all operations
const redis = new Redis(redisOptions);

// Subscriber client — for pub/sub (separate connection required)
const redisSubscriber = new Redis({
  ...redisOptions,
  connectionName: "meterflow-subscriber",
  lazyConnect: true,
});

// ── Event Listeners ──────────────────────────────────────────────────────────

redis.on("connect", () => {
  logger.info("✅ Redis connected", {
    host: env.REDIS.host,
    port: env.REDIS.port,
  });
});

redis.on("error", (err) => {
  logger.error("❌ Redis error", { error: err.message });
});

redis.on("close", () => {
  logger.warn("⚠️  Redis connection closed");
});

redis.on("reconnecting", () => {
  logger.info("🔄 Redis reconnecting...");
});

// ── Connect Function ─────────────────────────────────────────────────────────

const connectRedis = async () => {
  try {
    logger.info("🔌 Connecting to Redis...");
    await redis.connect();

    // Test connection with PING
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("Redis PING failed");

    logger.info("✅ Redis ready (PING → PONG)");
  } catch (error) {
    // Redis failure is non-fatal in dev — app still works without cache
    // In production, this should be fatal
    logger.error("❌ Redis connection failed", { error: error.message });

    if (env.IS_PRODUCTION) {
      logger.error("Redis is required in production. Exiting.");
      process.exit(1);
    } else {
      logger.warn(
        "⚠️  Running without Redis (dev mode) — rate limiting disabled",
      );
    }
  }
};

// ── Disconnect Function ──────────────────────────────────────────────────────

const disconnectRedis = async () => {
  await redis.quit();
  await redisSubscriber.quit();
  logger.info("🔌 Redis disconnected gracefully");
};

// ── Health Check ─────────────────────────────────────────────────────────────

const isRedisHealthy = async () => {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
};

// ── Key Helpers (Namespaced Keys) ─────────────────────────────────────────────

/**
 * Centralized Redis key builder — prevents typos, ensures naming convention
 */
const redisKeys = {
  // Rate limiting: sliding window per API key per minute
  rateLimit: (apiKeyId, window) => `mf:rl:${apiKeyId}:${window}`,

  // API key cache: avoid DB lookup on every gateway request
  apiKeyCache: (keyHash) => `mf:key:${keyHash}`,

  // Refresh token blacklist
  tokenBlacklist: (jti) => `mf:bl:${jti}`,

  // Usage buffer: batch writes to DB
  usageBuffer: (apiKeyId) => `mf:usage:${apiKeyId}`,

  // Session
  session: (userId) => `mf:session:${userId}`,
};

module.exports = {
  redis,
  redisSubscriber,
  connectRedis,
  disconnectRedis,
  isRedisHealthy,
  redisKeys,
};
