const UsageLog = require("../models/UsageLog.model");
const mongoose = require("mongoose");
const { sendSuccess } = require("../utils/response");

// ── Helper — Parse date range from query ─────────────────────────────────────
const parseDateRange = (from, to) => {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // start of month
  const startDate = from ? new Date(from) : defaultFrom;
  const endDate = to ? new Date(to) : now;
  return { startDate, endDate };
};

// ── Helper — Convert string ID to ObjectId ───────────────────────────────────
const toObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

// ── Overview Stats ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/overview
 * High-level stats for the dashboard header cards
 */
const getOverview = async (req, res) => {
  const { from, to } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  const [stats] = await UsageLog.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        successRequests: { $sum: { $cond: ["$isSuccess", 1, 0] } },
        failedRequests: { $sum: { $cond: ["$isSuccess", 0, 1] } },
        avgLatency: { $avg: "$latency" },
        minLatency: { $min: "$latency" },
        maxLatency: { $max: "$latency" },
        totalDataTransferred: {
          $sum: { $add: ["$requestSize", "$responseSize"] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalRequests: 1,
        successRequests: 1,
        failedRequests: 1,
        successRate: {
          $round: [
            {
              $multiply: [
                {
                  $divide: [
                    "$successRequests",
                    { $max: ["$totalRequests", 1] },
                  ],
                },
                100,
              ],
            },
            2,
          ],
        },
        errorRate: {
          $round: [
            {
              $multiply: [
                {
                  $divide: ["$failedRequests", { $max: ["$totalRequests", 1] }],
                },
                100,
              ],
            },
            2,
          ],
        },
        avgLatency: { $round: ["$avgLatency", 2] },
        minLatency: 1,
        maxLatency: 1,
        totalDataTransferredKB: {
          $round: [{ $divide: ["$totalDataTransferred", 1024] }, 2],
        },
      },
    },
  ]);

  return sendSuccess(
    res,
    stats || {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      successRate: 100,
      errorRate: 0,
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      totalDataTransferredKB: 0,
    },
    "Overview fetched",
  );
};

// ── Usage Over Time ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/usage?from=&to=&groupBy=day
 * Usage chart data — grouped by hour, day, or month
 */
const getUsageOverTime = async (req, res) => {
  const { from, to, groupBy = "day", apiId } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  // Build match filter
  const match = {
    userId,
    timestamp: { $gte: startDate, $lte: endDate },
  };
  if (apiId && toObjectId(apiId)) {
    match.apiId = toObjectId(apiId);
  }

  // Group by hour, day, or month
  const groupFormats = {
    hour: {
      year: { $year: "$timestamp" },
      month: { $month: "$timestamp" },
      day: { $dayOfMonth: "$timestamp" },
      hour: { $hour: "$timestamp" },
    },
    day: {
      year: { $year: "$timestamp" },
      month: { $month: "$timestamp" },
      day: { $dayOfMonth: "$timestamp" },
    },
    month: { year: { $year: "$timestamp" }, month: { $month: "$timestamp" } },
  };

  const groupId = groupFormats[groupBy] || groupFormats.day;

  const data = await UsageLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupId,
        requests: { $sum: 1 },
        success: { $sum: { $cond: ["$isSuccess", 1, 0] } },
        failed: { $sum: { $cond: ["$isSuccess", 0, 1] } },
        avgLatency: { $avg: "$latency" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format:
              groupBy === "hour"
                ? "%Y-%m-%dT%H:00"
                : groupBy === "month"
                  ? "%Y-%m"
                  : "%Y-%m-%d",
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: { $ifNull: ["$_id.day", 1] },
                hour: { $ifNull: ["$_id.hour", 0] },
              },
            },
          },
        },
        requests: 1,
        success: 1,
        failed: 1,
        avgLatency: { $round: ["$avgLatency", 2] },
      },
    },
  ]);

  return sendSuccess(
    res,
    { data, groupBy, from: startDate, to: endDate },
    "Usage data fetched",
  );
};

// ── Latency Percentiles ───────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/latency
 * p50, p95, p99 latency — industry standard performance metrics
 */
const getLatencyStats = async (req, res) => {
  const { from, to, apiId } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  const match = {
    userId,
    timestamp: { $gte: startDate, $lte: endDate },
    isSuccess: true,
  };
  if (apiId && toObjectId(apiId)) match.apiId = toObjectId(apiId);

  const [result] = await UsageLog.aggregate([
    { $match: match },
    { $sort: { latency: 1 } },
    {
      $group: {
        _id: null,
        latencies: { $push: "$latency" },
        count: { $sum: 1 },
        avg: { $avg: "$latency" },
        min: { $min: "$latency" },
        max: { $max: "$latency" },
      },
    },
    {
      $project: {
        _id: 0,
        count: 1,
        avg: { $round: ["$avg", 2] },
        min: 1,
        max: 1,
        p50: {
          $arrayElemAt: [
            "$latencies",
            { $floor: { $multiply: [0.5, "$count"] } },
          ],
        },
        p75: {
          $arrayElemAt: [
            "$latencies",
            { $floor: { $multiply: [0.75, "$count"] } },
          ],
        },
        p95: {
          $arrayElemAt: [
            "$latencies",
            { $floor: { $multiply: [0.95, "$count"] } },
          ],
        },
        p99: {
          $arrayElemAt: [
            "$latencies",
            { $floor: { $multiply: [0.99, "$count"] } },
          ],
        },
      },
    },
  ]);

  return sendSuccess(
    res,
    result || {
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p75: 0,
      p95: 0,
      p99: 0,
    },
    "Latency stats fetched",
  );
};

// ── Error Breakdown ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/errors
 * Error breakdown by status code and error type
 */
const getErrorBreakdown = async (req, res) => {
  const { from, to } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  const byStatusCode = await UsageLog.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
        isSuccess: false,
      },
    },
    {
      $group: {
        _id: "$statusCode",
        count: { $sum: 1 },
        endpoints: { $addToSet: "$endpoint" },
      },
    },
    { $sort: { count: -1 } },
    {
      $project: {
        _id: 0,
        statusCode: "$_id",
        count: 1,
        uniqueEndpoints: { $size: "$endpoints" },
      },
    },
  ]);

  const byErrorCode = await UsageLog.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
        errorCode: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$errorCode",
        count: { $sum: 1 },
        lastSeen: { $max: "$timestamp" },
      },
    },
    { $sort: { count: -1 } },
    {
      $project: {
        _id: 0,
        errorCode: "$_id",
        count: 1,
        lastSeen: 1,
      },
    },
  ]);

  return sendSuccess(
    res,
    { byStatusCode, byErrorCode },
    "Error breakdown fetched",
  );
};

// ── Top Endpoints ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/top-endpoints
 * Most hit endpoints with their performance stats
 */
const getTopEndpoints = async (req, res) => {
  const { from, to, limit = 10 } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  const data = await UsageLog.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { apiId: "$apiId", endpoint: "$endpoint", method: "$method" },
        totalRequests: { $sum: 1 },
        successRequests: { $sum: { $cond: ["$isSuccess", 1, 0] } },
        avgLatency: { $avg: "$latency" },
        p95Latency: { $push: "$latency" },
      },
    },
    { $sort: { totalRequests: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "apis",
        localField: "_id.apiId",
        foreignField: "_id",
        as: "api",
      },
    },
    { $unwind: { path: "$api", preserveNullAndEmptyArrays: true } }, // previous preserveNullAndEmpty
    {
      $project: {
        _id: 0,
        apiName: { $ifNull: ["$api.name", "Unknown"] },
        endpoint: "$_id.endpoint",
        method: "$_id.method",
        totalRequests: 1,
        successRate: {
          $round: [
            {
              $multiply: [
                { $divide: ["$successRequests", "$totalRequests"] },
                100,
              ],
            },
            1,
          ],
        },
        avgLatency: { $round: ["$avgLatency", 2] },
      },
    },
  ]);

  return sendSuccess(
    res,
    { data, limit: parseInt(limit) },
    "Top endpoints fetched",
  );
};

// ── Status Code Distribution ──────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/status-codes
 * Distribution of HTTP status codes
 */
const getStatusCodeDistribution = async (req, res) => {
  const { from, to } = req.query;
  const { startDate, endDate } = parseDateRange(from, to);
  const userId = toObjectId(req.userId);

  const data = await UsageLog.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$statusCode",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        statusCode: "$_id",
        count: 1,
        category: {
          $switch: {
            branches: [
              { case: { $lt: ["$_id", 300] }, then: "2xx Success" },
              { case: { $lt: ["$_id", 400] }, then: "3xx Redirect" },
              { case: { $lt: ["$_id", 500] }, then: "4xx Client Error" },
              { case: { $gte: ["$_id", 500] }, then: "5xx Server Error" },
            ],
            default: "Unknown",
          },
        },
      },
    },
  ]);

  return sendSuccess(res, { data }, "Status code distribution fetched");
};

module.exports = {
  getOverview,
  getUsageOverTime,
  getLatencyStats,
  getErrorBreakdown,
  getTopEndpoints,
  getStatusCodeDistribution,
};
