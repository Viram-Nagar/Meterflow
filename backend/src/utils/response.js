/**
 * @file response.js
 * @description Standardized API response helpers.
 * Every endpoint returns the same shape — frontend can rely on this contract.
 *
 * Success shape:  { success: true,  data: {...}, message: "..." }
 * Error shape:    { success: false, error: { code, message, details? } }
 */

/**
 * Send a success response
 * @param {Response} res - Express response object
 * @param {*} data - Response payload
 * @param {string} message - Human readable message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (
  res,
  data = null,
  message = "Success",
  statusCode = 200,
) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 */
const sendCreated = (res, data = null, message = "Created successfully") => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {string} code - Machine-readable error code
 * @param {*} details - Extra error details (validation errors etc)
 */
const sendError = (
  res,
  message = "Something went wrong",
  statusCode = 500,
  code = "INTERNAL_ERROR",
  details = null,
) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Response} res
 * @param {Array} data
 * @param {Object} pagination - { page, limit, total, totalPages }
 */
const sendPaginated = (res, data, pagination, message = "Success") => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNextPage:
        pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrevPage: pagination.page > 1,
    },
  });
};

// ── Common Error Senders ─────────────────────────────────────────────────────

const sendNotFound = (res, message = "Resource not found") =>
  sendError(res, message, 404, "NOT_FOUND");

const sendUnauthorized = (res, message = "Unauthorized") =>
  sendError(res, message, 401, "UNAUTHORIZED");

const sendForbidden = (res, message = "Forbidden") =>
  sendError(res, message, 403, "FORBIDDEN");

const sendBadRequest = (res, message = "Bad request", details = null) =>
  sendError(res, message, 400, "BAD_REQUEST", details);

const sendRateLimited = (res, resetAt = null) =>
  sendError(
    res,
    "Rate limit exceeded. Please slow down.",
    429,
    "RATE_LIMIT_EXCEEDED",
    resetAt ? { resetAt } : null,
  );

const sendConflict = (res, message = "Resource already exists") =>
  sendError(res, message, 409, "CONFLICT");

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendPaginated,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
  sendRateLimited,
  sendConflict,
};
