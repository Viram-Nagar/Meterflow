/**
 * @file auth.middleware.js
 * @description Authentication and authorization middleware.
 *
 * protect      → validates JWT, attaches user to req.user
 * authorize    → checks user role
 * requirePlan  → checks user plan tier
 */

const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User.model");
const { sendUnauthorized, sendForbidden } = require("../utils/response");
const logger = require("../utils/logger");

/**
 * Protect routes — verify JWT access token
 * Attaches decoded user to req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return sendUnauthorized(res, "Access token required. Please log in.");
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return sendUnauthorized(res, "Access token expired. Please refresh.");
      }
      return sendUnauthorized(res, "Invalid access token. Please log in.");
    }

    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select("-refreshTokens");

    if (!user) {
      return sendUnauthorized(res, "User no longer exists.");
    }

    if (!user.isActive) {
      return sendUnauthorized(res, "Your account has been deactivated.");
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    logger.debug("User authenticated", {
      userId: req.userId,
      role: user.role,
      requestId: req.requestId,
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize by role
 * Usage: authorize("admin", "owner")
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res, "Please log in first.");
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Unauthorized role access attempt", {
        userId: req.userId,
        userRole: req.user.role,
        requiredRoles: roles,
        url: req.originalUrl,
      });
      return sendForbidden(
        res,
        `Role '${req.user.role}' is not authorized for this action.`,
      );
    }

    next();
  };
};

/**
 * Require minimum plan tier
 * Usage: requirePlan("pro")
 * @param {string} minPlan - Minimum required plan
 */
const requirePlan = (minPlan) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res, "Please log in first.");
    }

    if (!req.user.hasPlan(minPlan)) {
      return sendForbidden(
        res,
        `This feature requires '${minPlan}' plan or higher. Please upgrade.`,
      );
    }

    next();
  };
};

/**
 * Optional auth — attaches user if token present, continues if not
 * Useful for public routes that show extra data when logged in
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return next(); // No token — continue as guest

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("-refreshTokens");
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id.toString();
      }
    } catch {
      // Invalid token — continue as guest
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  authorize,
  requirePlan,
  optionalAuth,
};
