/**
 * @file server.js
 * @description Application entry point.
 * Responsibilities:
 * 1. Load environment variables
 * 2. Connect to all databases
 * 3. Start Express server
 * 4. Handle graceful shutdown
 *
 * This file is intentionally thin — all logic lives in app.js and config files.
 */

require("dotenv").config();

const app = require("./src/app");
const env = require("./src/config/env");
const logger = require("./src/utils/logger");
const { connectMongoDB, disconnectMongoDB } = require("./src/config/db");
const { connectRedis, disconnectRedis } = require("./src/config/redis");
const {
  connectPostgres,
  disconnectPostgres,
} = require("./src/config/postgres");
const {
  handleUncaughtExceptions,
} = require("./src/middleware/error.middleware");
const {
  startBillingWorker,
  stopBillingWorker,
} = require("./src/jobs/billing.job");

// ── Setup global exception handlers FIRST ────────────────────────────────────
handleUncaughtExceptions();

// ── Bootstrap Function ────────────────────────────────────────────────────────

const bootstrap = async () => {
  try {
    logger.info("🚀 Starting MeterFlow API server...");
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   Node.js: ${process.version}`);

    // ── Connect to databases ─────────────────────────────────────────────────
    // MongoDB is required — exits if fails
    await connectMongoDB();

    // Redis — required in production, optional in dev
    await connectRedis();

    // PostgreSQL — required for billing
    await connectPostgres();

    // ── Start Billing Worker ─────────────────────────────────────────────────
    startBillingWorker();

    // ── Start HTTP server ────────────────────────────────────────────────────
    const server = app.listen(env.PORT, () => {
      logger.info(`\n✅ MeterFlow API running!`);
      logger.info(`   → Local:   http://localhost:${env.PORT}`);
      logger.info(`   → Health:  http://localhost:${env.PORT}/health`);
      logger.info(
        `   → API:     http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      );
      logger.info(
        `   → Docs:    http://localhost:${env.PORT}/api/${env.API_VERSION}/health\n`,
      );
    });

    // ── Graceful Shutdown ────────────────────────────────────────────────────
    // When deployment platform stops the server (SIGTERM)
    // or developer hits Ctrl+C (SIGINT)

    const gracefulShutdown = async (signal) => {
      logger.info(`\n⚠️  ${signal} received — starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info("HTTP server closed — no new connections");

        try {
          // Close all DB connections
          await stopBillingWorker();
          await disconnectMongoDB();
          await disconnectRedis();
          await disconnectPostgres();

          logger.info("✅ Graceful shutdown complete");
          process.exit(0);
        } catch (error) {
          logger.error("❌ Error during shutdown", { error: error.message });
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long (30s)
      setTimeout(() => {
        logger.error("❌ Graceful shutdown timeout — forcing exit");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    return server;
  } catch (error) {
    logger.error("❌ Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// ── Start ─────────────────────────────────────────────────────────────────────
bootstrap();

// /**
//  * @file server.js
//  * @description Application entry point.
//  * Responsibilities:
//  * 1. Load environment variables
//  * 2. Connect to all databases
//  * 3. Start Express server
//  * 4. Handle graceful shutdown
//  *
//  * This file is intentionally thin — all logic lives in app.js and config files.
//  */

// require("dotenv").config();

// const app = require("./src/app");
// const env = require("./src/config/env");
// const logger = require("./src/utils/logger");
// const { connectMongoDB, disconnectMongoDB } = require("./src/config/db");
// const { connectRedis, disconnectRedis } = require("./src/config/redis");
// const {
//   connectPostgres,
//   disconnectPostgres,
// } = require("./src/config/postgres");
// const {
//   handleUncaughtExceptions,
// } = require("./src/middleware/error.middleware");
// const {
//   startBillingWorker,
//   stopBillingWorker,
// } = require("./src/jobs/billing.job");

// // ── Setup global exception handlers FIRST ────────────────────────────────────
// handleUncaughtExceptions();

// // ── Bootstrap Function ────────────────────────────────────────────────────────

// const bootstrap = async () => {
//   try {
//     logger.info("🚀 Starting MeterFlow API server...");
//     logger.info(`   Environment: ${env.NODE_ENV}`);
//     logger.info(`   Node.js: ${process.version}`);

//     // ── Connect to databases ─────────────────────────────────────────────────
//     // MongoDB is required — exits if fails
//     await connectMongoDB();

//     // Redis — required in production, optional in dev
//     await connectRedis();

//     // PostgreSQL — required for billing
//     await connectPostgres();

//     // ── Start HTTP server ────────────────────────────────────────────────────
//     const server = app.listen(env.PORT, () => {
//       logger.info(`\n✅ MeterFlow API running!`);
//       logger.info(`   → Local:   http://localhost:${env.PORT}`);
//       logger.info(`   → Health:  http://localhost:${env.PORT}/health`);
//       logger.info(
//         `   → API:     http://localhost:${env.PORT}/api/${env.API_VERSION}`,
//       );
//       logger.info(
//         `   → Docs:    http://localhost:${env.PORT}/api/${env.API_VERSION}/health\n`,
//       );
//     });

//     // ── Graceful Shutdown ────────────────────────────────────────────────────
//     // When deployment platform stops the server (SIGTERM)
//     // or developer hits Ctrl+C (SIGINT)

//     const gracefulShutdown = async (signal) => {
//       logger.info(`\n⚠️  ${signal} received — starting graceful shutdown...`);

//       // Stop accepting new connections
//       server.close(async () => {
//         logger.info("HTTP server closed — no new connections");

//         try {
//           // Close all DB connections
//           await disconnectMongoDB();
//           await disconnectRedis();
//           await disconnectPostgres();

//           logger.info("✅ Graceful shutdown complete");
//           process.exit(0);
//         } catch (error) {
//           logger.error("❌ Error during shutdown", { error: error.message });
//           process.exit(1);
//         }
//       });

//       // Force exit if graceful shutdown takes too long (30s)
//       setTimeout(() => {
//         logger.error("❌ Graceful shutdown timeout — forcing exit");
//         process.exit(1);
//       }, 30000);
//     };

//     process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
//     process.on("SIGINT", () => gracefulShutdown("SIGINT"));

//     return server;
//   } catch (error) {
//     logger.error("❌ Failed to start server", {
//       error: error.message,
//       stack: error.stack,
//     });
//     process.exit(1);
//   }
// };

// // ── Start ─────────────────────────────────────────────────────────────────────
// bootstrap();
