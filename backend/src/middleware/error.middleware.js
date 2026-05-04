const logger = require("../utils/logger");
const { sendError } = require("../utils/response");
const env = require("../config/env");

// ── Custom Error Class ────────────────────────────────────────────────────────

class AppError extends Error {
  /**
   * @param {string} message - Human readable message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Machine readable error code
   * @param {*} details - Extra details (validation errors etc)
   */
  constructor(
    message,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Mark as expected error (not a bug)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Error Type Handlers ──────────────────────────────────────────────────────

const handleMongooseValidationError = (err) => {
  const details = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError("Validation failed", 400, "VALIDATION_ERROR", details);
};

const handleMongooseDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field} already exists`, 409, "DUPLICATE_KEY");
};

const handleMongooseCastError = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");
};

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", 401, "INVALID_TOKEN");

const handleJWTExpiredError = () =>
  new AppError("Token expired. Please log in again.", 401, "TOKEN_EXPIRED");

const handleZodError = (err) => {
  const details = err.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
  return new AppError("Validation failed", 400, "VALIDATION_ERROR", details);
};

// ── Not Found Handler ────────────────────────────────────────────────────────

const notFoundHandler = (req, res, next) => {
  const err = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    "ROUTE_NOT_FOUND",
  );
  next(err);
};

// ── Global Error Handler ─────────────────────────────────────────────────────

const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // ── Map known error types to AppError ─────────────────────────────────────

  // Mongoose validation error
  if (err.name === "ValidationError") {
    error = handleMongooseValidationError(err);
  }

  // MongoDB duplicate key (e.g. unique email)
  else if (err.code === 11000) {
    error = handleMongooseDuplicateKeyError(err);
  }

  // Mongoose invalid ObjectId
  else if (err.name === "CastError") {
    error = handleMongooseCastError(err);
  }

  // JWT errors
  else if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  } else if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  }

  // Zod validation
  else if (err.name === "ZodError") {
    error = handleZodError(err);
  }

  // Default to 500 if statusCode not set
  error.statusCode = error.statusCode || 500;
  error.code = error.code || "INTERNAL_ERROR";

  // ── Log the error ─────────────────────────────────────────────────────────

  if (error.statusCode >= 500) {
    logger.error("💥 Server Error", {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id || "unauthenticated",
      requestId: req.requestId,
    });
  } else {
    logger.warn("⚠️  Client Error", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      url: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
    });
  }

  // ── Send response ─────────────────────────────────────────────────────────

  // Never leak stack traces in production
  const message =
    env.IS_PRODUCTION && error.statusCode === 500
      ? "Something went wrong. Please try again later."
      : error.message;

  return sendError(
    res,
    message,
    error.statusCode,
    error.code,
    error.details || (env.IS_DEVELOPMENT ? { stack: error.stack } : null),
  );
};

// ── Unhandled Rejection / Uncaught Exception ──────────────────────────────────

const handleUncaughtExceptions = () => {
  process.on("uncaughtException", (err) => {
    logger.error("💥 UNCAUGHT EXCEPTION — Shutting down", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("💥 UNHANDLED PROMISE REJECTION", {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
    // Give time to finish pending requests then exit
    process.exit(1);
  });
};

module.exports = {
  AppError,
  notFoundHandler,
  globalErrorHandler,
  handleUncaughtExceptions,
};
