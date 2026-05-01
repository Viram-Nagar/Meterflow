const jwt = require("jsonwebtoken");
const env = require("../config/env");

const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT.accessSecret, {
    expiresIn: env.JWT.accessExpires,
    issuer: "meterflow",
    audience: "meterflow-client",
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT.refreshSecret, {
    expiresIn: env.JWT.refreshExpires,
    issuer: "meterflow",
    audience: "meterflow-client",
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT.accessSecret, {
    issuer: "meterflow",
    audience: "meterflow-client",
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT.refreshSecret, {
    issuer: "meterflow",
    audience: "meterflow-client",
  });
};

const generateTokenPair = (user) => {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    plan: user.plan,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user._id.toString() });

  return { accessToken, refreshToken };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true, // Cannot be accessed by JavaScript
    secure: env.IS_PRODUCTION, // HTTPS only in production
    sameSite: "strict", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: "/api/v1/auth", // Only sent to auth routes
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: "strict",
    path: "/api/v1/auth",
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
