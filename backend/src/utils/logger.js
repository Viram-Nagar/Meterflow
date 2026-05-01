/**
 * @file logger.js
 * @description Production-grade structured logger using Winston.
 * - Console logs in dev (colorized)
 * - JSON file logs in production (daily rotation)
 * - Separate error log file
 * - All logs include timestamp, level, message
 */

const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const env = require("../config/env");

// ── Custom Log Format ────────────────────────────────────────────────────────
const { combine, timestamp, printf, colorize, align, json, errors } =
  winston.format;

// Dev format: colorized, human readable
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  align(),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2)}`
      : "";
    return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
  }),
);

// Production format: structured JSON for log aggregators (DataDog, Logtail etc)
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// ── Transports ───────────────────────────────────────────────────────────────

const transports = [];

// Always log to console
transports.push(
  new winston.transports.Console({
    format: env.IS_DEVELOPMENT ? devFormat : prodFormat,
    silent: env.NODE_ENV === "test",
  }),
);

// In production, also write to rotating files
if (env.IS_PRODUCTION) {
  const logDir = path.resolve(env.LOG.filePath);

  // All logs (info and above)
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: "meterflow-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      format: prodFormat,
      level: "info",
    }),
  );

  // Error-only logs
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: "meterflow-error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "90d",
      format: prodFormat,
      level: "error",
    }),
  );
}

// ── Create Logger ────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: env.LOG.level,
  transports,
  // Don't exit on unhandled errors from logger itself
  exitOnError: false,
});

// ── Helper Methods ───────────────────────────────────────────────────────────

/**
 * Log HTTP request (used in morgan middleware)
 */
logger.http = (message, meta = {}) => {
  logger.log("http", message, meta);
};

/**
 * Log with request context (requestId, userId)
 */
logger.withContext = (context) => ({
  info: (msg, meta = {}) => logger.info(msg, { ...context, ...meta }),
  error: (msg, meta = {}) => logger.error(msg, { ...context, ...meta }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...context, ...meta }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...context, ...meta }),
});

module.exports = logger;
