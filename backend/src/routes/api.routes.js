const express = require("express");
const router = express.Router();

const {
  createAPI,
  getMyAPIs,
  getAPI,
  updateAPI,
  deleteAPI,
  toggleStatus,
  generateKey,
  getKeys,
  getKey,
  revokeKey,
  rotateKey,
} = require("../controllers/api.controller");

const { protect, authorize } = require("../middleware/auth.middleware");
const { validate, schemas } = require("../utils/validators");

// All routes require login
router.use(protect);

// ── API Routes ─────────────────────────────────────────────────────────────────

// POST   /api/v1/apis          → Create API
// GET    /api/v1/apis          → Get my APIs
router
  .route("/")
  .post(authorize("owner", "admin"), validate(schemas.createAPI), createAPI)
  .get(getMyAPIs);

// GET    /api/v1/apis/:apiId   → Get single API
// PATCH  /api/v1/apis/:apiId   → Update API
// DELETE /api/v1/apis/:apiId   → Delete API
router
  .route("/:apiId")
  .get(getAPI)
  .patch(authorize("owner", "admin"), validate(schemas.updateAPI), updateAPI)
  .delete(authorize("owner", "admin"), deleteAPI);

// PATCH  /api/v1/apis/:apiId/toggle → Toggle status
router.patch("/:apiId/toggle", authorize("owner", "admin"), toggleStatus);

// ── API Key Routes ─────────────────────────────────────────────────────────────

// POST  /api/v1/apis/:apiId/keys     → Generate key
// GET   /api/v1/apis/:apiId/keys     → List keys
router
  .route("/:apiId/keys")
  .post(authorize("owner", "admin"), validate(schemas.generateKey), generateKey)
  .get(getKeys);

// GET   /api/v1/apis/:apiId/keys/:keyId → Get key
router.get("/:apiId/keys/:keyId", getKey);

// PATCH /api/v1/apis/:apiId/keys/:keyId/revoke → Revoke
router.patch(
  "/:apiId/keys/:keyId/revoke",
  authorize("owner", "admin"),
  validate(schemas.revokeKey),
  revokeKey,
);

// POST  /api/v1/apis/:apiId/keys/:keyId/rotate → Rotate
router.post(
  "/:apiId/keys/:keyId/rotate",
  authorize("owner", "admin"),
  rotateKey,
);

module.exports = router;
