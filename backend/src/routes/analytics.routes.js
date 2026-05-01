/**
 * @file analytics.routes.js
 */
const express = require("express");
const router = express.Router();
const {
  getOverview,
  getUsageOverTime,
  getLatencyStats,
  getErrorBreakdown,
  getTopEndpoints,
  getStatusCodeDistribution,
} = require("../controllers/analytics.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/overview", getOverview);
router.get("/usage", getUsageOverTime);
router.get("/latency", getLatencyStats);
router.get("/errors", getErrorBreakdown);
router.get("/top-endpoints", getTopEndpoints);
router.get("/status-codes", getStatusCodeDistribution);

module.exports = router;
