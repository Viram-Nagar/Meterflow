const { Queue, Worker, QueueEvents } = require("bullmq");
const { redis } = require("../config/redis");
const { processUserBilling } = require("../services/billing.service");
const User = require("../models/User.model");
const logger = require("../utils/logger");
const env = require("../config/env");

// ── Queue Setup ───────────────────────────────────────────────────────────────
const QUEUE_NAME = "meterflow-billing";

const connection = {
  host: env.REDIS.host,
  port: env.REDIS.port,
  ...(env.REDIS.password && { password: env.REDIS.password }),
  ...(env.REDIS.tls && { tls: {} }),
};

// Create queue
const billingQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times on failure
    backoff: {
      type: "exponential", // Wait longer between each retry
      delay: 5000, // Start with 5 second delay
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Remove after 24 hours
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs for debugging
    },
  },
});

// ── Worker (Job Processor) ────────────────────────────────────────────────────
let billingWorker = null;

const startBillingWorker = () => {
  billingWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`Processing billing job: ${job.name}`, {
        jobId: job.id,
        data: job.data,
      });

      switch (job.name) {
        // ── Process billing for ONE user ──────────────────────────────────────
        case "process-user-billing": {
          const { userId } = job.data;
          const result = await processUserBilling(userId);
          logger.info("User billing processed", {
            userId,
            amountDue: result.total,
            totalRequests: result.totalRequests,
          });
          return result;
        }

        // ── Queue billing for ALL users ───────────────────────────────────────
        case "process-all-billing": {
          // Get all active users
          const users = await User.find({ isActive: true })
            .select("_id")
            .lean();

          logger.info(`Queuing billing for ${users.length} users`);

          // Add individual billing job for each user
          const jobs = users.map((user) => ({
            name: "process-user-billing",
            data: { userId: user._id.toString() },
            opts: {
              // Spread jobs over time to avoid DB overload
              delay: Math.random() * 60000, // Random delay 0-60 seconds
            },
          }));

          await billingQueue.addBulk(jobs);
          return { queued: users.length };
        }

        // ── Mark a billing cycle as completed ─────────────────────────────────
        case "mark-cycle-complete": {
          const { cycleId } = job.data;
          const { query } = require("../config/postgres");
          await query(
            `UPDATE billing_cycles
             SET status = 'completed', updated_at = NOW()
             WHERE id = $1`,
            [cycleId],
          );
          logger.info("Billing cycle marked complete", { cycleId });
          return { cycleId, status: "completed" };
        }

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: env.BULL_CONCURRENCY,
    },
  );

  // Worker events
  billingWorker.on("completed", (job, result) => {
    logger.debug(`Billing job completed`, { jobId: job.id, jobName: job.name });
  });

  billingWorker.on("failed", (job, error) => {
    logger.error(`Billing job failed`, {
      jobId: job?.id,
      jobName: job?.name,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  billingWorker.on("error", (error) => {
    logger.error("Billing worker error", { error: error.message });
  });

  logger.info("✅ Billing worker started");
  return billingWorker;
};

// ── Job Adders (Called from controllers) ──────────────────────────────────────

/**
 * Queue billing calculation for a specific user
 * @param {string} userId
 * @param {number} delay - milliseconds delay (optional)
 */
const queueUserBilling = async (userId, delay = 0) => {
  const job = await billingQueue.add(
    "process-user-billing",
    { userId },
    { delay },
  );
  logger.debug("Billing job queued", { jobId: job.id, userId });
  return job;
};

/**
 * Queue billing for ALL users (run at end of month)
 */
const queueAllUsersBilling = async () => {
  const job = await billingQueue.add("process-all-billing", {});
  logger.info("All-users billing job queued", { jobId: job.id });
  return job;
};

/**
 * Get billing queue stats
 */
const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    billingQueue.getWaitingCount(),
    billingQueue.getActiveCount(),
    billingQueue.getCompletedCount(),
    billingQueue.getFailedCount(),
    billingQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

/**
 * Graceful shutdown
 */
const stopBillingWorker = async () => {
  if (billingWorker) {
    await billingWorker.close();
    logger.info("Billing worker stopped");
  }
  await billingQueue.close();
};

module.exports = {
  billingQueue,
  startBillingWorker,
  stopBillingWorker,
  queueUserBilling,
  queueAllUsersBilling,
  getQueueStats,
};
