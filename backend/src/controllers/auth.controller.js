/**
 * @file auth.controller.js
 * @description Handles all authentication logic.
 *
 * register     → Create new user account
 * login        → Authenticate user, return tokens
 * logout       → Invalidate refresh token
 * logoutAll    → Invalidate all refresh tokens (all devices)
 * refresh      → Get new access token using refresh token
 * getMe        → Get current user profile
 * updateMe     → Update profile
 * changePassword → Change password
 */

const User = require("../models/User.model");
const {
  generateTokenPair,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require("../utils/jwt");
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendBadRequest,
  sendConflict,
} = require("../utils/response");
const logger = require("../utils/logger");
const { audit } = require("../services/audit.service");
const { sendWelcomeEmail } = require("../services/email.service");

// ── Register ──────────────────────────────────────────────────────────────────

const register = async (req, res) => {
  const { name, email, password, company, role } = req.body;

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendConflict(res, "An account with this email already exists.");
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    company,
    role: role || "owner",
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user);

  // Save refresh token to user
  await user.addRefreshToken(refreshToken);

  // Set refresh token in httpOnly cookie
  setRefreshTokenCookie(res, refreshToken);

  // Update last login
  user.lastLoginAt = new Date();
  await user.save();

  logger.info("New user registered", {
    userId: user._id,
    email: user.email,
    role: user.role,
  });
  audit.register(user._id, req.ip);
  sendWelcomeEmail(user).catch(() => {});

  return sendCreated(
    res,
    {
      user,
      accessToken,
    },
    "Account created successfully",
  );
};

// ── Login ─────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  const { email, password } = req.body;

  // Find user with password (select: false by default)
  const user = await User.findByEmailWithPassword(email);

  if (!user) {
    // Generic message — don't reveal if email exists
    return sendUnauthorized(res, "Invalid email or password.");
  }

  // Check if account is active
  if (!user.isActive) {
    return sendUnauthorized(
      res,
      "Your account has been deactivated. Contact support.",
    );
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logger.warn("Failed login attempt", { email, ip: req.ip });
    return sendUnauthorized(res, "Invalid email or password.");
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user);

  // Save refresh token
  await user.addRefreshToken(refreshToken);

  // Set cookie
  setRefreshTokenCookie(res, refreshToken);

  // Update last login
  user.lastLoginAt = new Date();
  await user.save();

  logger.info("User logged in", {
    userId: user._id,
    email: user.email,
    ip: req.ip,
  });
  audit.login(user._id, req.ip, req.headers["user-agent"]);

  // Remove password from response
  const userResponse = user.toJSON();

  return sendSuccess(
    res,
    { user: userResponse, accessToken },
    "Login successful",
  );
};

// ── Logout ────────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  // Get refresh token from cookie or body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (refreshToken) {
    try {
      // Remove this specific refresh token
      await req.user.removeRefreshToken(refreshToken);
    } catch {
      // Ignore errors — still clear cookie
    }
  }

  // Clear cookie
  clearRefreshTokenCookie(res);

  logger.info("User logged out", { userId: req.userId });

  return sendSuccess(res, null, "Logged out successfully");
};

// ── Logout All Devices ────────────────────────────────────────────────────────

const logoutAll = async (req, res) => {
  await req.user.removeAllRefreshTokens();
  clearRefreshTokenCookie(res);

  logger.info("User logged out from all devices", { userId: req.userId });

  return sendSuccess(res, null, "Logged out from all devices successfully");
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

const refresh = async (req, res) => {
  // Get refresh token from cookie (preferred) or body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return sendUnauthorized(res, "Refresh token not found. Please log in.");
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    clearRefreshTokenCookie(res);
    return sendUnauthorized(
      res,
      "Invalid or expired refresh token. Please log in.",
    );
  }

  // Find user and check if refresh token exists
  const user = await User.findById(decoded.id);

  if (!user) {
    clearRefreshTokenCookie(res);
    return sendUnauthorized(res, "User not found. Please log in.");
  }

  if (!user.isActive) {
    clearRefreshTokenCookie(res);
    return sendUnauthorized(res, "Account deactivated.");
  }

  // Check if this refresh token is in user's list (token rotation security)
  const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);
  if (!tokenExists) {
    // Token reuse detected — possible token theft
    logger.warn("Refresh token reuse detected — clearing all tokens", {
      userId: user._id,
    });
    await user.removeAllRefreshTokens();
    clearRefreshTokenCookie(res);
    return sendUnauthorized(res, "Session expired. Please log in again.");
  }

  // Generate new token pair (token rotation)
  const { accessToken, refreshToken: newRefreshToken } =
    generateTokenPair(user);

  // Remove old refresh token, add new one
  await user.removeRefreshToken(refreshToken);
  await user.addRefreshToken(newRefreshToken);

  // Set new cookie
  setRefreshTokenCookie(res, newRefreshToken);

  return sendSuccess(res, { accessToken }, "Token refreshed successfully");
};

// ── Get Current User ──────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  // req.user is already attached by protect middleware
  return sendSuccess(res, { user: req.user }, "Profile fetched successfully");
};

// ── Update Profile ────────────────────────────────────────────────────────────

const updateMe = async (req, res) => {
  const { name, company } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.userId,
    { name, company },
    {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    },
  );

  logger.info("User profile updated", { userId: req.userId });
  audit.profileUpdated(req.userId, req.ip);

  return sendSuccess(
    res,
    { user: updatedUser },
    "Profile updated successfully",
  );
};

// ── Change Password ───────────────────────────────────────────────────────────

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.userId).select("+password");

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return sendBadRequest(res, "Current password is incorrect.");
  }

  // Update password
  user.password = newPassword;

  // Invalidate all refresh tokens (security — logout other devices)
  user.refreshTokens = [];
  await user.save();

  clearRefreshTokenCookie(res);

  logger.info("User changed password", { userId: req.userId });
  audit.passwordChange(req.userId, req.ip);

  return sendSuccess(
    res,
    null,
    "Password changed successfully. Please log in again.",
  );
};

module.exports = {
  register,
  login,
  logout,
  logoutAll,
  refresh,
  getMe,
  updateMe,
  changePassword,
};

// /**
//  * @file auth.controller.js
//  * @description Handles all authentication logic.
//  *
//  * register     → Create new user account
//  * login        → Authenticate user, return tokens
//  * logout       → Invalidate refresh token
//  * logoutAll    → Invalidate all refresh tokens (all devices)
//  * refresh      → Get new access token using refresh token
//  * getMe        → Get current user profile
//  * updateMe     → Update profile
//  * changePassword → Change password
//  */

// const User = require("../models/User.model");
// const {
//   generateTokenPair,
//   verifyRefreshToken,
//   setRefreshTokenCookie,
//   clearRefreshTokenCookie,
// } = require("../utils/jwt");
// const {
//   sendSuccess,
//   sendCreated,
//   sendError,
//   sendUnauthorized,
//   sendBadRequest,
//   sendConflict,
// } = require("../utils/response");
// const logger = require("../utils/logger");
// const { audit } = require("../services/audit.service");
// const { sendWelcomeEmail } = require("../services/email.service");

// // ── Register ──────────────────────────────────────────────────────────────────

// const register = async (req, res) => {
//   const { name, email, password, company, role } = req.body;

//   // Check if email already exists
//   const existingUser = await User.findOne({ email });
//   if (existingUser) {
//     return sendConflict(res, "An account with this email already exists.");
//   }

//   // Create user
//   const user = await User.create({
//     name,
//     email,
//     password,
//     company,
//     role: role || "owner",
//   });

//   // Generate tokens
//   const { accessToken, refreshToken } = generateTokenPair(user);

//   // Save refresh token to user
//   await user.addRefreshToken(refreshToken);

//   // Set refresh token in httpOnly cookie
//   setRefreshTokenCookie(res, refreshToken);

//   // Update last login
//   user.lastLoginAt = new Date();
//   await user.save();

//   logger.info("New user registered", {
//     userId: user._id,
//     email: user.email,
//     role: user.role,
//   });
//   audit.register(user._id, req.ip);
//   sendWelcomeEmail(user).catch(() => {});

//   return sendCreated(
//     res,
//     {
//       user,
//       accessToken,
//     },
//     "Account created successfully",
//   );
// };

// // ── Login ─────────────────────────────────────────────────────────────────────

// const login = async (req, res) => {
//   const { email, password } = req.body;

//   // Find user with password (select: false by default)
//   const user = await User.findByEmailWithPassword(email);

//   if (!user) {
//     // Generic message — don't reveal if email exists
//     return sendUnauthorized(res, "Invalid email or password.");
//   }

//   // Check if account is active
//   if (!user.isActive) {
//     return sendUnauthorized(
//       res,
//       "Your account has been deactivated. Contact support.",
//     );
//   }

//   // Verify password
//   const isPasswordValid = await user.comparePassword(password);
//   if (!isPasswordValid) {
//     logger.warn("Failed login attempt", { email, ip: req.ip });
//     return sendUnauthorized(res, "Invalid email or password.");
//   }

//   // Generate tokens
//   const { accessToken, refreshToken } = generateTokenPair(user);

//   // Save refresh token
//   await user.addRefreshToken(refreshToken);

//   // Set cookie
//   setRefreshTokenCookie(res, refreshToken);

//   // Update last login
//   user.lastLoginAt = new Date();
//   await user.save();

//   logger.info("User logged in", {
//     userId: user._id,
//     email: user.email,
//     ip: req.ip,
//   });
//   audit.login(user._id, req.ip, req.headers["user-agent"]);

//   // Remove password from response
//   const userResponse = user.toJSON();

//   return sendSuccess(
//     res,
//     { user: userResponse, accessToken },
//     "Login successful",
//   );
// };

// // ── Logout ────────────────────────────────────────────────────────────────────

// const logout = async (req, res) => {
//   // Get refresh token from cookie or body
//   const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

//   if (refreshToken) {
//     try {
//       // Remove this specific refresh token
//       await req.user.removeRefreshToken(refreshToken);
//     } catch {
//       // Ignore errors — still clear cookie
//     }
//   }

//   // Clear cookie
//   clearRefreshTokenCookie(res);

//   logger.info("User logged out", { userId: req.userId });

//   return sendSuccess(res, null, "Logged out successfully");
// };

// // ── Logout All Devices ────────────────────────────────────────────────────────

// const logoutAll = async (req, res) => {
//   await req.user.removeAllRefreshTokens();
//   clearRefreshTokenCookie(res);

//   logger.info("User logged out from all devices", { userId: req.userId });

//   return sendSuccess(res, null, "Logged out from all devices successfully");
// };

// // ── Refresh Token ─────────────────────────────────────────────────────────────

// const refresh = async (req, res) => {
//   // Get refresh token from cookie (preferred) or body
//   const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

//   if (!refreshToken) {
//     return sendUnauthorized(res, "Refresh token not found. Please log in.");
//   }

//   // Verify refresh token
//   let decoded;
//   try {
//     decoded = verifyRefreshToken(refreshToken);
//   } catch (err) {
//     clearRefreshTokenCookie(res);
//     return sendUnauthorized(
//       res,
//       "Invalid or expired refresh token. Please log in.",
//     );
//   }

//   // Find user and check if refresh token exists
//   const user = await User.findById(decoded.id);

//   if (!user) {
//     clearRefreshTokenCookie(res);
//     return sendUnauthorized(res, "User not found. Please log in.");
//   }

//   if (!user.isActive) {
//     clearRefreshTokenCookie(res);
//     return sendUnauthorized(res, "Account deactivated.");
//   }

//   // Check if this refresh token is in user's list (token rotation security)
//   const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);
//   if (!tokenExists) {
//     // Token reuse detected — possible token theft
//     logger.warn("Refresh token reuse detected — clearing all tokens", {
//       userId: user._id,
//     });
//     await user.removeAllRefreshTokens();
//     clearRefreshTokenCookie(res);
//     return sendUnauthorized(res, "Session expired. Please log in again.");
//   }

//   // Generate new token pair (token rotation)
//   const { accessToken, refreshToken: newRefreshToken } =
//     generateTokenPair(user);

//   // Remove old refresh token, add new one
//   await user.removeRefreshToken(refreshToken);
//   await user.addRefreshToken(newRefreshToken);

//   // Set new cookie
//   setRefreshTokenCookie(res, newRefreshToken);

//   return sendSuccess(res, { accessToken }, "Token refreshed successfully");
// };

// // ── Get Current User ──────────────────────────────────────────────────────────

// const getMe = async (req, res) => {
//   // req.user is already attached by protect middleware
//   return sendSuccess(res, { user: req.user }, "Profile fetched successfully");
// };

// // ── Update Profile ────────────────────────────────────────────────────────────

// const updateMe = async (req, res) => {
//   const { name, company } = req.body;

//   const updatedUser = await User.findByIdAndUpdate(
//     req.userId,
//     { name, company },
//     {
//       new: true, // Return updated document
//       runValidators: true, // Run schema validators
//     },
//   );

//   logger.info("User profile updated", { userId: req.userId });

//   return sendSuccess(
//     res,
//     { user: updatedUser },
//     "Profile updated successfully",
//   );
// };

// // ── Change Password ───────────────────────────────────────────────────────────

// const changePassword = async (req, res) => {
//   const { currentPassword, newPassword } = req.body;

//   // Get user with password
//   const user = await User.findById(req.userId).select("+password");

//   // Verify current password
//   const isCurrentPasswordValid = await user.comparePassword(currentPassword);
//   if (!isCurrentPasswordValid) {
//     return sendBadRequest(res, "Current password is incorrect.");
//   }

//   // Update password
//   user.password = newPassword;

//   // Invalidate all refresh tokens (security — logout other devices)
//   user.refreshTokens = [];
//   await user.save();

//   clearRefreshTokenCookie(res);

//   logger.info("User changed password", { userId: req.userId });

//   return sendSuccess(
//     res,
//     null,
//     "Password changed successfully. Please log in again.",
//   );
// };

// module.exports = {
//   register,
//   login,
//   logout,
//   logoutAll,
//   refresh,
//   getMe,
//   updateMe,
//   changePassword,
// };
