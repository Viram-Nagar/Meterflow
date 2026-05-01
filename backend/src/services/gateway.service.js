// /**
//  * @file gateway.service.js
//  * @description Core gateway logic — validates key, checks rate limit,
//  * forwards request to target API, logs usage asynchronously.
//  *
//  * Request flow:
//  * 1. Extract & validate API key  (Redis cache → MongoDB fallback)
//  * 2. Check rate limit            (Redis sliding window)
//  * 3. Forward request             (axios proxy)
//  * 4. Log usage                   (async — non-blocking)
//  * 5. Return response
//  */

// const axios = require("axios");
// const crypto = require("crypto");
// const APIKey = require("../models/APIKey.model");
// const API = require("../models/API.model");
// const UsageLog = require("../models/UsageLog.model");
// const { redis, redisKeys } = require("../config/redis");
// const logger = require("../utils/logger");
// const env = require("../config/env");
// const { emitLimitWarning, emitLimitExceeded } = require("./webhook.service");
// const {
//   sendQuotaWarningEmail,
//   sendQuotaExceededEmail,
// } = require("./email.service");
// const User = require("../models/User.model");

// const KEY_CACHE_TTL = 300; // 5 minutes

// // ══════════════════════════════════════════════════════════════════════════════
// // STEP 1 — Validate API Key
// // ══════════════════════════════════════════════════════════════════════════════

// const validateAPIKey = async (rawKey) => {
//   const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
//   const cacheKey = redisKeys.apiKeyCache(keyHash);

//   // Try Redis cache first
//   try {
//     const cached = await redis.get(cacheKey);
//     if (cached) {
//       logger.debug("API key cache HIT", { prefix: rawKey.substring(0, 15) });
//       return JSON.parse(cached);
//     }
//   } catch (redisErr) {
//     logger.warn("Redis cache unavailable, falling back to MongoDB", {
//       error: redisErr.message,
//     });
//   }

//   // MongoDB lookup
//   logger.debug("API key cache MISS — querying MongoDB");
//   const apiKey = await APIKey.findOne({ keyHash, status: "active" }).lean();
//   if (!apiKey) return null;

//   // Check expiry
//   if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
//     APIKey.findByIdAndUpdate(apiKey._id, { status: "expired" }).catch(() => {});
//     return null;
//   }

//   const api = await API.findOne({ _id: apiKey.apiId, status: "active" }).lean();
//   if (!api) return null;

//   const result = { apiKey, api };

//   // Cache in Redis
//   try {
//     await redis.setex(cacheKey, KEY_CACHE_TTL, JSON.stringify(result));
//   } catch {
//     /* Cache failed — not critical */
//   }

//   return result;
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STEP 2 — Rate Limiting (Redis Sliding Window)
// // ══════════════════════════════════════════════════════════════════════════════

// const checkRateLimit = async (apiKey) => {
//   const limit = apiKey.rateLimit.requestsPerMinute;
//   const windowSeconds = 60;
//   const now = Math.floor(Date.now() / 1000);
//   const windowKey = Math.floor(now / windowSeconds);
//   const redisKey = redisKeys.rateLimit(apiKey._id.toString(), windowKey);

//   try {
//     const pipeline = redis.pipeline();
//     pipeline.incr(redisKey);
//     pipeline.expire(redisKey, windowSeconds * 2);
//     const results = await pipeline.exec();

//     const currentCount = results[0][1];
//     const remaining = Math.max(0, limit - currentCount);
//     const resetAt = new Date((windowKey + 1) * windowSeconds * 1000);

//     return {
//       allowed: currentCount <= limit,
//       limit,
//       remaining,
//       resetAt,
//       current: currentCount,
//     };
//   } catch (redisErr) {
//     logger.warn("Rate limit check failed — allowing request", {
//       error: redisErr.message,
//     });
//     return { allowed: true, limit, remaining: limit, resetAt: new Date() };
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STEP 3 — Forward Request to Target API
// // ══════════════════════════════════════════════════════════════════════════════

// const forwardRequest = async (api, req, gatewayPath) => {
//   const targetUrl = `${api.baseUrl}${gatewayPath}`;
//   const forwardHeaders = { ...req.headers };

//   // Strip sensitive headers
//   const stripList = [
//     "host",
//     "x-api-key",
//     "authorization",
//     "x-forwarded-for",
//     "x-request-id",
//     "connection",
//     ...(api.stripHeaders || []),
//   ];
//   stripList.forEach((h) => delete forwardHeaders[h.toLowerCase()]);

//   // Add target API auth if configured
//   if (api.targetAuth && api.targetAuth.type !== "none") {
//     if (api.targetAuth.type === "header")
//       forwardHeaders[api.targetAuth.key] = api.targetAuth.value;
//     else if (api.targetAuth.type === "bearer")
//       forwardHeaders["authorization"] = `Bearer ${api.targetAuth.value}`;
//   }

//   // Build query params
//   const params = { ...req.query };
//   if (api.targetAuth?.type === "query") {
//     params[api.targetAuth.key] = api.targetAuth.value;
//   }

//   const response = await axios({
//     method: req.method,
//     url: targetUrl,
//     headers: forwardHeaders,
//     params,
//     data: req.body && Object.keys(req.body).length ? req.body : undefined,
//     timeout: api.timeout || env.GATEWAY.timeout,
//     maxRedirects: env.GATEWAY.maxRedirects,
//     validateStatus: () => true,
//     responseType: "json",
//   });

//   return {
//     data: response.data,
//     status: response.status,
//     headers: response.headers,
//     targetUrl,
//     responseSize: JSON.stringify(response.data || "").length,
//   };
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STEP 4 — Log Usage (Async Non-blocking)
// // ══════════════════════════════════════════════════════════════════════════════

// const logUsageAsync = (logData) => {
//   setImmediate(async () => {
//     try {
//       await UsageLog.create(logData);

//       await APIKey.findByIdAndUpdate(logData.apiKeyId, {
//         lastUsedAt: new Date(),
//         lastUsedIp: logData.ip,
//         $inc: {
//           totalRequests: 1,
//           successRequests: logData.isSuccess ? 1 : 0,
//           failedRequests: logData.isSuccess ? 0 : 1,
//           currentMonthRequests: 1,
//         },
//       });

//       await API.findByIdAndUpdate(logData.apiId, {
//         $inc: { totalRequests: 1 },
//       });
//     } catch (error) {
//       logger.error("Failed to log gateway usage", {
//         error: error.message,
//         apiKeyId: logData.apiKeyId,
//       });
//     }
//   });
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // MAIN — Process Gateway Request
// // ══════════════════════════════════════════════════════════════════════════════

// const processGatewayRequest = async (req, res, apiId, gatewayPath) => {
//   const startTime = Date.now();

//   // Extract API Key from request
//   const rawKey =
//     req.headers["x-api-key"] ||
//     req.headers["authorization"]?.replace("Bearer ", "") ||
//     req.query.api_key;

//   if (!rawKey) {
//     return res.status(401).json({
//       success: false,
//       error: {
//         code: "API_KEY_REQUIRED",
//         message: "API key required. Pass it in X-API-Key header.",
//       },
//     });
//   }

//   // Validate Key
//   const validated = await validateAPIKey(rawKey);
//   if (!validated) {
//     return res.status(401).json({
//       success: false,
//       error: {
//         code: "INVALID_API_KEY",
//         message: "Invalid or expired API key.",
//       },
//     });
//   }

//   const { apiKey, api } = validated;

//   // Key must belong to requested API
//   if (apiKey.apiId.toString() !== apiId) {
//     return res.status(403).json({
//       success: false,
//       error: {
//         code: "KEY_API_MISMATCH",
//         message: "This API key is not authorized for this API.",
//       },
//     });
//   }

//   // Check monthly quota
//   if (apiKey.currentMonthRequests >= apiKey.rateLimit.requestsPerMonth) {
//     // Fire quota exceeded events (async)
//     setImmediate(async () => {
//       try {
//         const user = await User.findById(apiKey.userId);
//         if (user) {
//           emitLimitExceeded(apiKey.userId.toString(), {
//             used: apiKey.currentMonthRequests,
//             limit: apiKey.rateLimit.requestsPerMonth,
//             resetAt: apiKey.monthResetAt,
//           });
//           sendQuotaExceededEmail(user, {
//             used: apiKey.currentMonthRequests,
//             limit: apiKey.rateLimit.requestsPerMonth,
//             resetAt: apiKey.monthResetAt,
//           }).catch(() => {});
//         }
//       } catch {}
//     });
//     return res.status(429).json({
//       success: false,
//       error: {
//         code: "MONTHLY_QUOTA_EXCEEDED",
//         message: `Monthly limit of ${apiKey.rateLimit.requestsPerMonth} requests reached.`,
//         resetAt: apiKey.monthResetAt,
//         upgradeUrl: `${env.FRONTEND_URL}/billing/upgrade`,
//       },
//     });
//   }

//   // Warn at 80% quota (fire once per session via Redis flag)
//   const usagePercent =
//     (apiKey.currentMonthRequests / apiKey.rateLimit.requestsPerMonth) * 100;
//   if (usagePercent >= 80 && usagePercent < 100) {
//     const warnKey = `mf:warn:${apiKey._id}:${new Date().getMonth()}`;
//     redis
//       .get(warnKey)
//       .then(async (warned) => {
//         if (!warned) {
//           await redis.setex(warnKey, 60 * 60 * 24 * 7, "1"); // flag for 7 days
//           const user = await User.findById(apiKey.userId);
//           if (user) {
//             emitLimitWarning(apiKey.userId.toString(), {
//               used: apiKey.currentMonthRequests,
//               limit: apiKey.rateLimit.requestsPerMonth,
//               percentUsed: Math.round(usagePercent),
//               resetAt: apiKey.monthResetAt,
//             });
//             sendQuotaWarningEmail(user, {
//               used: apiKey.currentMonthRequests,
//               limit: apiKey.rateLimit.requestsPerMonth,
//               percentUsed: Math.round(usagePercent),
//               resetAt: apiKey.monthResetAt,
//             }).catch(() => {});
//           }
//         }
//       })
//       .catch(() => {});
//   }

//   // Check per-minute rate limit
//   const rateLimit = await checkRateLimit(apiKey);

//   // Always set rate limit headers
//   res.set({
//     "X-RateLimit-Limit": rateLimit.limit,
//     "X-RateLimit-Remaining": rateLimit.remaining,
//     "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
//     "X-Request-Id": req.requestId,
//   });

//   if (!rateLimit.allowed) {
//     logUsageAsync({
//       apiKeyId: apiKey._id,
//       apiId: api._id,
//       userId: apiKey.userId,
//       method: req.method,
//       endpoint: gatewayPath || "/",
//       targetUrl: `${api.baseUrl}${gatewayPath}`,
//       statusCode: 429,
//       isSuccess: false,
//       latency: Date.now() - startTime,
//       ip: req.ip,
//       userAgent: req.headers["user-agent"],
//       errorCode: "RATE_LIMIT_EXCEEDED",
//       errorMessage: "Per-minute rate limit exceeded",
//       isBillable: false,
//     });

//     return res.status(429).json({
//       success: false,
//       error: {
//         code: "RATE_LIMIT_EXCEEDED",
//         message: `Rate limit of ${rateLimit.limit} req/min exceeded.`,
//         retryAfter: rateLimit.resetAt,
//       },
//     });
//   }

//   // Forward request to target API
//   let forwardResult;
//   let forwardError = null;

//   try {
//     forwardResult = await forwardRequest(api, req, gatewayPath);
//   } catch (error) {
//     forwardError = error;
//     logger.error("Gateway forward error", {
//       error: error.message,
//       apiId: api._id,
//       targetUrl: `${api.baseUrl}${gatewayPath}`,
//     });
//   }

//   const latency = Date.now() - startTime;
//   const statusCode = forwardError ? 502 : forwardResult.status;
//   const isSuccess = statusCode >= 200 && statusCode < 400;
//   const isBillable =
//     isSuccess && apiKey.currentMonthRequests >= api.pricing.freeQuota;

//   // Log asynchronously
//   logUsageAsync({
//     apiKeyId: apiKey._id,
//     apiId: api._id,
//     userId: apiKey.userId,
//     method: req.method,
//     endpoint: gatewayPath || "/",
//     targetUrl: forwardResult?.targetUrl || `${api.baseUrl}${gatewayPath}`,
//     statusCode,
//     isSuccess,
//     latency,
//     requestSize: JSON.stringify(req.body || {}).length,
//     responseSize: forwardResult?.responseSize || 0,
//     ip: req.ip,
//     userAgent: req.headers["user-agent"],
//     origin: req.headers["origin"],
//     errorCode: forwardError ? "UPSTREAM_ERROR" : null,
//     errorMessage: forwardError ? forwardError.message : null,
//     isBillable,
//   });

//   // Add MeterFlow headers
//   res.set("X-MeterFlow-Latency", `${latency}ms`);
//   res.set("X-MeterFlow-RequestId", req.requestId);

//   if (forwardError) {
//     return res.status(502).json({
//       success: false,
//       error: {
//         code: "UPSTREAM_ERROR",
//         message: "Target API is unreachable or returned an error.",
//         latency: `${latency}ms`,
//       },
//     });
//   }

//   return res.status(forwardResult.status).json(forwardResult.data);
// };

// module.exports = {
//   validateAPIKey,
//   checkRateLimit,
//   forwardRequest,
//   logUsageAsync,
//   processGatewayRequest,
// };

/**
 * @file gateway.service.js
 * @description Core gateway logic.
 *
 * Flow:
 * 1. Extract + validate API key
 * 2. Check monthly quota
 * 3. Check per-minute rate limit
 * 4. Forward request to target API
 * 5. Log usage async
 * 6. Return response
 */

const axios = require("axios");
const crypto = require("crypto");
const APIKey = require("../models/APIKey.model");
const API = require("../models/API.model");
const UsageLog = require("../models/UsageLog.model");
const { redis, redisKeys } = require("../config/redis");
const logger = require("../utils/logger");
const env = require("../config/env");

// Safe imports — these may not exist yet
let emitLimitWarning, emitLimitExceeded;
let sendQuotaWarningEmail, sendQuotaExceededEmail;
let User;

try {
  const webhookSvc = require("./webhook.service");
  emitLimitWarning = webhookSvc.emitLimitWarning;
  emitLimitExceeded = webhookSvc.emitLimitExceeded;
} catch {
  /* webhook service optional */
}

try {
  const emailSvc = require("./email.service");
  sendQuotaWarningEmail = emailSvc.sendQuotaWarningEmail;
  sendQuotaExceededEmail = emailSvc.sendQuotaExceededEmail;
} catch {
  /* email service optional */
}

try {
  User = require("../models/User.model");
} catch {
  /* optional */
}

const KEY_CACHE_TTL = 300; // 5 minutes

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Validate API Key
// ══════════════════════════════════════════════════════════════════════════════

const validateAPIKey = async (rawKey) => {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const cacheKey = redisKeys.apiKeyCache(keyHash);

  // Try Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    /* Redis down — fall through */
  }

  // MongoDB lookup
  const apiKey = await APIKey.findOne({ keyHash, status: "active" }).lean();
  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
    APIKey.findByIdAndUpdate(apiKey._id, { status: "expired" }).catch(() => {});
    return null;
  }

  // Get the API
  const api = await API.findOne({ _id: apiKey.apiId, status: "active" }).lean();
  if (!api) return null;

  const result = { apiKey, api };

  // Cache in Redis
  try {
    await redis.setex(cacheKey, KEY_CACHE_TTL, JSON.stringify(result));
  } catch {
    /* Cache failed — not critical */
  }

  return result;
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Rate Limiting
// ══════════════════════════════════════════════════════════════════════════════

const checkRateLimit = async (apiKey) => {
  const limit = apiKey.rateLimit?.requestsPerMinute || 60;
  const windowSeconds = 60;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);
  const redisKey = redisKeys.rateLimit(apiKey._id.toString(), windowKey);

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, windowSeconds * 2);
    const results = await pipeline.exec();
    const currentCount = results[0][1];
    const remaining = Math.max(0, limit - currentCount);
    const resetAt = new Date((windowKey + 1) * windowSeconds * 1000);
    return {
      allowed: currentCount <= limit,
      limit,
      remaining,
      resetAt,
      current: currentCount,
    };
  } catch {
    // Redis down — allow request (fail open)
    return { allowed: true, limit, remaining: limit, resetAt: new Date() };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Forward Request
// ══════════════════════════════════════════════════════════════════════════════

const forwardRequest = async (api, req, gatewayPath) => {
  // Build target URL — carefully handle trailing slashes
  const baseUrl = api.baseUrl.replace(/\/$/, ""); // remove trailing slash
  const path = gatewayPath.startsWith("/") ? gatewayPath : `/${gatewayPath}`;
  const targetUrl = `${baseUrl}${path}`;

  logger.debug("Forwarding to target", { targetUrl, method: req.method });

  // Build headers — copy safe ones, strip gateway-specific ones
  const forwardHeaders = {};
  const SKIP_HEADERS = new Set([
    "host",
    "x-api-key",
    "authorization",
    "x-forwarded-for",
    "x-request-id",
    "x-meterflow-latency",
    "connection",
    "content-length", // axios recalculates this
  ]);

  Object.entries(req.headers).forEach(([key, value]) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  });

  // Add target API auth if configured
  if (api.targetAuth && api.targetAuth.type !== "none") {
    if (api.targetAuth.type === "header" && api.targetAuth.key) {
      forwardHeaders[api.targetAuth.key] = api.targetAuth.value;
    } else if (api.targetAuth.type === "bearer" && api.targetAuth.value) {
      forwardHeaders["authorization"] = `Bearer ${api.targetAuth.value}`;
    }
  }

  // Build query params
  const params = { ...req.query };
  if (api.targetAuth?.type === "query" && api.targetAuth.key) {
    params[api.targetAuth.key] = api.targetAuth.value;
  }

  // Build request body
  let requestData;
  if (!["GET", "HEAD", "DELETE"].includes(req.method.toUpperCase())) {
    if (req.body && Object.keys(req.body).length > 0) {
      requestData = req.body;
    }
  }

  const response = await axios({
    method: req.method,
    url: targetUrl,
    headers: forwardHeaders,
    params,
    data: requestData,
    timeout: api.timeout || env.GATEWAY.timeout || 30000,
    maxRedirects: 5,
    validateStatus: () => true, // never throw on 4xx/5xx — pass through
  });

  return {
    data: response.data,
    status: response.status,
    headers: response.headers,
    targetUrl,
    responseSize: JSON.stringify(response.data || "").length,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Log Usage (Non-blocking)
// ══════════════════════════════════════════════════════════════════════════════

const logUsageAsync = (logData) => {
  setImmediate(async () => {
    try {
      await UsageLog.create(logData);
      await APIKey.findByIdAndUpdate(logData.apiKeyId, {
        lastUsedAt: new Date(),
        lastUsedIp: logData.ip,
        $inc: {
          totalRequests: 1,
          successRequests: logData.isSuccess ? 1 : 0,
          failedRequests: logData.isSuccess ? 0 : 1,
          currentMonthRequests: 1,
        },
      });
      await API.findByIdAndUpdate(logData.apiId, {
        $inc: { totalRequests: 1 },
      });
    } catch (error) {
      logger.error("Failed to log gateway usage", { error: error.message });
    }
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — Process Gateway Request
// ══════════════════════════════════════════════════════════════════════════════

const processGatewayRequest = async (req, res, apiId, gatewayPath) => {
  const startTime = Date.now();

  // ── Extract API Key ──────────────────────────────────────────────────────
  const rawKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    req.query.api_key;

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: "API_KEY_REQUIRED",
        message: "API key required. Add X-API-Key header.",
      },
    });
  }

  // ── Validate Key ────────────────────────────────────────────────────────
  let validated;
  try {
    validated = await validateAPIKey(rawKey);
  } catch (err) {
    logger.error("Key validation error", { error: err.message });
    return res.status(500).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Key validation failed" },
    });
  }

  if (!validated) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid or expired API key.",
      },
    });
  }

  const { apiKey, api } = validated;

  // ── Check key belongs to this API ────────────────────────────────────────
  if (apiKey.apiId.toString() !== apiId) {
    return res.status(403).json({
      success: false,
      error: {
        code: "KEY_API_MISMATCH",
        message: "This API key is not authorized for this API.",
      },
    });
  }

  // ── Check Monthly Quota ──────────────────────────────────────────────────
  const monthlyLimit = apiKey.rateLimit?.requestsPerMonth || 10000;
  const currentMonthReqs = apiKey.currentMonthRequests || 0;

  if (currentMonthReqs >= monthlyLimit) {
    // Fire quota exceeded events async
    if (emitLimitExceeded || sendQuotaExceededEmail) {
      setImmediate(async () => {
        try {
          if (User && emitLimitExceeded) {
            const user = await User.findById(apiKey.userId);
            if (user) {
              if (emitLimitExceeded)
                emitLimitExceeded(apiKey.userId.toString(), {
                  used: currentMonthReqs,
                  limit: monthlyLimit,
                  resetAt: apiKey.monthResetAt,
                });
              if (sendQuotaExceededEmail)
                sendQuotaExceededEmail(user, {
                  used: currentMonthReqs,
                  limit: monthlyLimit,
                  resetAt: apiKey.monthResetAt,
                }).catch(() => {});
            }
          }
        } catch {}
      });
    }

    return res.status(429).json({
      success: false,
      error: {
        code: "MONTHLY_QUOTA_EXCEEDED",
        message: `Monthly limit of ${monthlyLimit} requests reached.`,
        resetAt: apiKey.monthResetAt,
        upgradeUrl: `${env.FRONTEND_URL}/billing`,
      },
    });
  }

  // ── Warn at 80% quota ────────────────────────────────────────────────────
  const usagePercent = (currentMonthReqs / monthlyLimit) * 100;
  if (usagePercent >= 80 && (emitLimitWarning || sendQuotaWarningEmail)) {
    setImmediate(async () => {
      try {
        const warnKey = `mf:warn:${apiKey._id}:${new Date().getMonth()}`;
        const warned = await redis.get(warnKey).catch(() => null);
        if (!warned && User) {
          await redis.setex(warnKey, 60 * 60 * 24 * 7, "1").catch(() => {});
          const user = await User.findById(apiKey.userId);
          if (user) {
            if (emitLimitWarning)
              emitLimitWarning(apiKey.userId.toString(), {
                used: currentMonthReqs,
                limit: monthlyLimit,
                percentUsed: Math.round(usagePercent),
                resetAt: apiKey.monthResetAt,
              });
            if (sendQuotaWarningEmail)
              sendQuotaWarningEmail(user, {
                used: currentMonthReqs,
                limit: monthlyLimit,
                percentUsed: Math.round(usagePercent),
                resetAt: apiKey.monthResetAt,
              }).catch(() => {});
          }
        }
      } catch {}
    });
  }

  // ── Check Rate Limit ─────────────────────────────────────────────────────
  const rateLimit = await checkRateLimit(apiKey);

  res.set({
    "X-RateLimit-Limit": rateLimit.limit,
    "X-RateLimit-Remaining": rateLimit.remaining,
    "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
    "X-Request-Id": req.requestId,
  });

  if (!rateLimit.allowed) {
    logUsageAsync({
      apiKeyId: apiKey._id,
      apiId: api._id,
      userId: apiKey.userId,
      method: req.method,
      endpoint: gatewayPath || "/",
      targetUrl: `${api.baseUrl}${gatewayPath}`,
      statusCode: 429,
      isSuccess: false,
      latency: Date.now() - startTime,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      errorCode: "RATE_LIMIT_EXCEEDED",
      errorMessage: "Per-minute rate limit exceeded",
      isBillable: false,
    });

    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit of ${rateLimit.limit} req/min exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
        retryAfter: rateLimit.resetAt,
      },
    });
  }

  // ── Forward Request ──────────────────────────────────────────────────────
  let forwardResult;
  let forwardError = null;

  try {
    forwardResult = await forwardRequest(api, req, gatewayPath);
  } catch (error) {
    forwardError = error;
    logger.error("Gateway forward failed", {
      error: error.message,
      apiId: api._id,
      targetUrl: `${api.baseUrl}${gatewayPath}`,
    });
  }

  const latency = Date.now() - startTime;
  const statusCode = forwardError ? 502 : forwardResult.status;
  const isSuccess = statusCode >= 200 && statusCode < 400;
  const isBillable =
    isSuccess && currentMonthReqs >= (api.pricing?.freeQuota || 1000);

  // ── Log async ────────────────────────────────────────────────────────────
  logUsageAsync({
    apiKeyId: apiKey._id,
    apiId: api._id,
    userId: apiKey.userId,
    method: req.method,
    endpoint: gatewayPath || "/",
    targetUrl: forwardResult?.targetUrl || `${api.baseUrl}${gatewayPath}`,
    statusCode,
    isSuccess,
    latency,
    requestSize: JSON.stringify(req.body || {}).length,
    responseSize: forwardResult?.responseSize || 0,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    origin: req.headers["origin"],
    errorCode: forwardError ? "UPSTREAM_ERROR" : null,
    errorMessage: forwardError ? forwardError.message : null,
    isBillable,
  });

  // ── Set response headers ─────────────────────────────────────────────────
  res.set("X-MeterFlow-Latency", `${latency}ms`);
  res.set("X-MeterFlow-RequestId", req.requestId);

  // ── Handle forward error ─────────────────────────────────────────────────
  if (forwardError) {
    return res.status(502).json({
      success: false,
      error: {
        code: "UPSTREAM_ERROR",
        message:
          "Could not reach the target API. It may be down or unreachable.",
        detail: env.IS_DEVELOPMENT ? forwardError.message : undefined,
        latency: `${latency}ms`,
      },
    });
  }

  // ── Return target API response ───────────────────────────────────────────
  return res.status(forwardResult.status).json(forwardResult.data);
};

module.exports = {
  validateAPIKey,
  checkRateLimit,
  forwardRequest,
  logUsageAsync,
  processGatewayRequest,
};
