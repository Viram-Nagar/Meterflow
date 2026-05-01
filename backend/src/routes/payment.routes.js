const express = require("express");
const router = express.Router();
const {
  createPlanOrder,
  createInvoiceOrder,
  processPaymentHandler,
  getHistory,
} = require("../controllers/payment.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.post("/order/plan", createPlanOrder);
router.post("/order/invoice", createInvoiceOrder);
router.post("/process", processPaymentHandler);
router.get("/history", getHistory);

module.exports = router;
