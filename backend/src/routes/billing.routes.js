const express = require("express");
const router = express.Router();
const {
  getCurrentBilling,
  getBillingHistoryController,
  getInvoice,
  getPlans,
  calculateBillPreview,
  triggerBilling,
  getBillingQueueStats,
} = require("../controllers/billing.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/current", getCurrentBilling);
router.get("/history", getBillingHistoryController);
router.get("/plans", getPlans);
router.get("/invoice/:cycleId", getInvoice);
router.post("/calculate", calculateBillPreview);
router.post("/trigger", triggerBilling);
router.get("/queue-stats", authorize("admin"), getBillingQueueStats);

module.exports = router;
