/**
 * @file db.js
 * @description MongoDB connection manager using Mongoose.
 * Features:
 * - Connection with retry logic
 * - Graceful disconnect on shutdown
 * - Connection event logging
 * - Index creation on startup
 */

const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

// ── Mongoose Settings ────────────────────────────────────────────────────────

mongoose.set("strictQuery", true);

// ── Connection Options ───────────────────────────────────────────────────────

const options = {
  // Connection pool size — handles concurrent requests
  maxPoolSize: 10,
  minPoolSize: 2,

  // Timeouts
  serverSelectionTimeoutMS: 5000, // How long to try to find a server
  socketTimeoutMS: 45000, // How long socket stays open
  connectTimeoutMS: 10000, // Initial connection timeout

  // Keep alive
  heartbeatFrequencyMS: 10000,
};

// ── Event Listeners ──────────────────────────────────────────────────────────

mongoose.connection.on("connected", () => {
  logger.info("✅ MongoDB connected", {
    host: mongoose.connection.host,
    db: mongoose.connection.name,
  });
});

mongoose.connection.on("error", (err) => {
  logger.error("❌ MongoDB connection error", { error: err.message });
});

mongoose.connection.on("disconnected", () => {
  logger.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("🔄 MongoDB reconnected");
});

// ── Connect Function ─────────────────────────────────────────────────────────

/**
 * Connect to MongoDB with retry logic
 * @param {number} retries - Number of retry attempts
 */
const connectMongoDB = async (retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(
        `🔌 Connecting to MongoDB (attempt ${attempt}/${retries})...`,
      );
      await mongoose.connect(env.MONGODB_URI, options);
      return; // Success — exit loop
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed`, {
        error: error.message,
      });

      if (attempt === retries) {
        logger.error("❌ All MongoDB connection attempts failed. Exiting.");
        process.exit(1);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      logger.info(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// ── Disconnect Function ──────────────────────────────────────────────────────

const disconnectMongoDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("🔌 MongoDB disconnected gracefully");
  }
};

// ── Health Check ─────────────────────────────────────────────────────────────

const isMongoHealthy = () => {
  // 1 = connected
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectMongoDB,
  disconnectMongoDB,
  isMongoHealthy,
};
