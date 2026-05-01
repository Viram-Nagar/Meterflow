const express = require("express");
const router = express.Router();
const {
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhookHandler,
  getAuditLogsHandler,
} = require("../controllers/webhook.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.route("/").post(createWebhook).get(getWebhooks);

router.route("/:id").get(getWebhook).patch(updateWebhook).delete(deleteWebhook);

router.post("/:id/test", testWebhookHandler);

module.exports = router;
