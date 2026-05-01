const express = require("express");
const router = express.Router();
const { getAuditLogsHandler } = require("../controllers/webhook.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);
router.get("/", getAuditLogsHandler);

module.exports = router;
