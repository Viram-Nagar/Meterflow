const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  logoutAll,
  refresh,
  getMe,
  updateMe,
  changePassword,
} = require("../controllers/auth.controller");

const { protect } = require("../middleware/auth.middleware");
const { validate, schemas } = require("../utils/validators");

// ── Public Routes ─────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post("/register", validate(schemas.register), register);

// POST /api/v1/auth/login
router.post("/login", validate(schemas.login), login);

// POST /api/v1/auth/refresh
router.post("/refresh", refresh);

// ── Private Routes (require JWT) ──────────────────────────────────────────────

// POST /api/v1/auth/logout
router.post("/logout", protect, logout);

// POST /api/v1/auth/logout-all
router.post("/logout-all", protect, logoutAll);

// GET  /api/v1/auth/me
router.get("/me", protect, getMe);

// PATCH /api/v1/auth/me
router.patch("/me", protect, validate(schemas.updateProfile), updateMe);

// PATCH /api/v1/auth/change-password
router.patch(
  "/change-password",
  protect,
  validate(schemas.changePassword),
  changePassword,
);

module.exports = router;
