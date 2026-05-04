const API = require("../models/API.model");
const APIKey = require("../models/APIKey.model");
const User = require("../models/User.model");
const { generateAPIKey } = require("../utils/apiKeyGen");
const {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendPaginated,
} = require("../utils/response");
const logger = require("../utils/logger");
const { audit } = require("../services/audit.service");

// ══════════════════════════════════════════════════════════════════════════════
// API CRUD
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/apis
 * Create a new API
 */
const createAPI = async (req, res) => {
  const {
    name,
    description,
    category,
    baseUrl,
    targetAuth,
    pricing,
    rateLimit,
    timeout,
    isPublic,
    tags,
  } = req.body;

  // Check plan limits
  const user = req.user;
  const planLimits = { free: 1, pro: 10, enterprise: Infinity };
  const currentAPICount = await API.countDocuments({
    userId: user._id,
    status: { $ne: "suspended" },
  });

  if (currentAPICount >= planLimits[user.plan]) {
    return sendForbidden(
      res,
      `Your '${user.plan}' plan allows maximum ${planLimits[user.plan]} API(s). Please upgrade.`,
    );
  }

  const api = await API.create({
    userId: user._id,
    name,
    description,
    category,
    baseUrl,
    targetAuth,
    pricing,
    rateLimit,
    timeout,
    isPublic,
    tags,
  });

  // Update user's API count
  await User.findByIdAndUpdate(user._id, { $inc: { totalAPIs: 1 } });

  logger.info("API created", {
    apiId: api._id,
    userId: user._id,
    name: api.name,
  });
  audit.apiCreated(user._id, api._id, api.name, req.ip);

  return sendCreated(res, { api }, "API registered successfully");
};

/**
 * GET /api/v1/apis
 * Get all APIs for the logged-in owner
 */
const getMyAPIs = async (req, res) => {
  const { page = 1, limit = 10, status, category, search } = req.query;

  const filter = { userId: req.userId };

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [apis, total] = await Promise.all([
    API.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("activeKeys"),
    API.countDocuments(filter),
  ]);

  return sendPaginated(
    res,
    apis,
    { page: parseInt(page), limit: parseInt(limit), total },
    "APIs fetched successfully",
  );
};

/**
 * GET /api/v1/apis/:apiId
 * Get single API details
 */
const getAPI = async (req, res) => {
  const api = await API.findOne({
    _id: req.params.apiId,
    userId: req.userId,
  }).populate("activeKeys");

  if (!api) {
    return sendNotFound(res, "API not found");
  }

  return sendSuccess(res, { api }, "API fetched successfully");
};

/**
 * PATCH /api/v1/apis/:apiId
 * Update API configuration
 */
const updateAPI = async (req, res) => {
  const allowedUpdates = [
    "name",
    "description",
    "category",
    "baseUrl",
    "targetAuth",
    "pricing",
    "rateLimit",
    "timeout",
    "isPublic",
    "tags",
    "stripHeaders",
  ];

  // Only keep allowed fields
  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const api = await API.findOneAndUpdate(
    { _id: req.params.apiId, userId: req.userId },
    updates,
    { new: true, runValidators: true },
  );

  if (!api) return sendNotFound(res, "API not found");

  logger.info("API updated", { apiId: api._id, userId: req.userId });
  audit.apiUpdated(req.userId, api._id, api.name, req.ip);

  return sendSuccess(res, { api }, "API updated successfully");
};

/**
 * DELETE /api/v1/apis/:apiId
 * Soft delete — set status to suspended
 */
const deleteAPI = async (req, res) => {
  const api = await API.findOneAndUpdate(
    { _id: req.params.apiId, userId: req.userId },
    { status: "suspended" },
    { new: true },
  );

  if (!api) return sendNotFound(res, "API not found");

  // Revoke all active keys for this API
  await APIKey.updateMany(
    { apiId: api._id, status: "active" },
    { status: "revoked", revokedAt: new Date(), revokedReason: "API deleted" },
  );

  await User.findByIdAndUpdate(req.userId, { $inc: { totalAPIs: -1 } });

  logger.info("API deleted", { apiId: api._id, userId: req.userId });
  audit.apiDeleted(req.userId, api._id, api.name, req.ip);

  return sendSuccess(res, null, "API deleted successfully");
};

/**
 * PATCH /api/v1/apis/:apiId/toggle
 * Toggle API status between active and inactive
 */
const toggleStatus = async (req, res) => {
  const api = await API.findOne({
    _id: req.params.apiId,
    userId: req.userId,
  });

  if (!api) return sendNotFound(res, "API not found");

  if (api.status === "suspended") {
    return sendBadRequest(res, "Cannot toggle a suspended API.");
  }

  api.status = api.status === "active" ? "inactive" : "active";
  await api.save();

  audit.apiToggled(req.userId, api._id, api.name, api.status, req.ip);
  return sendSuccess(
    res,
    { api },
    `API ${api.status === "active" ? "activated" : "deactivated"} successfully`,
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// API KEY OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/apis/:apiId/keys
 * Generate a new API key
 */
const generateKey = async (req, res) => {
  const { name, description, tier, rateLimit, expiresAt, allowedOrigins } =
    req.body;

  // Verify API belongs to user
  const api = await API.findOne({
    _id: req.params.apiId,
    userId: req.userId,
    status: "active",
  });

  if (!api) return sendNotFound(res, "API not found or inactive");

  // Check key limits per plan
  const keyLimits = { free: 3, pro: 50, enterprise: Infinity };
  const activeKeyCount = await APIKey.countDocuments({
    apiId: api._id,
    status: "active",
  });

  if (activeKeyCount >= keyLimits[req.user.plan]) {
    return sendForbidden(
      res,
      `Your plan allows maximum ${keyLimits[req.user.plan]} active keys per API.`,
    );
  }

  // Generate the key
  const { rawKey, keyHash, keyPrefix } = generateAPIKey("live");

  const apiKey = await APIKey.create({
    apiId: api._id,
    userId: req.userId,
    keyPrefix,
    keyHash,
    name: name || `Key ${activeKeyCount + 1}`,
    description,
    tier: tier || req.user.plan,
    rateLimit: rateLimit || {
      requestsPerMinute: api.rateLimit.requestsPerMinute,
      requestsPerMonth: api.rateLimit.requestsPerMonth,
    },
    expiresAt: expiresAt || null,
    allowedOrigins: allowedOrigins || [],
  });

  // Update counts
  await Promise.all([
    API.findByIdAndUpdate(api._id, { $inc: { totalKeys: 1 } }),
    User.findByIdAndUpdate(req.userId, { $inc: { totalAPIKeys: 1 } }),
  ]);

  logger.info("API key generated", {
    keyId: apiKey._id,
    apiId: api._id,
    userId: req.userId,
    prefix: keyPrefix,
  });
  audit.keyGenerated(req.userId, apiKey._id, keyPrefix, api.name, req.ip);

  // Return the RAW key ONCE — it will never be shown again
  return sendCreated(
    res,
    {
      key: {
        id: apiKey._id,
        rawKey, // ← SHOWN ONCE ONLY
        keyPrefix,
        name: apiKey.name,
        tier: apiKey.tier,
        status: apiKey.status,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      warning: "Save this key securely. It will NOT be shown again.",
    },
    "API key generated successfully",
  );
};

/**
 * GET /api/v1/apis/:apiId/keys
 * List all keys for an API
 */
const getKeys = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  // Verify API ownership
  const api = await API.findOne({ _id: req.params.apiId, userId: req.userId });
  if (!api) return sendNotFound(res, "API not found");

  const filter = { apiId: api._id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [keys, total] = await Promise.all([
    APIKey.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-keyHash"), // Never return the hash
    APIKey.countDocuments(filter),
  ]);

  return sendPaginated(
    res,
    keys,
    { page: parseInt(page), limit: parseInt(limit), total },
    "API keys fetched",
  );
};

/**
 * GET /api/v1/apis/:apiId/keys/:keyId
 * Get single key details
 */
const getKey = async (req, res) => {
  const api = await API.findOne({ _id: req.params.apiId, userId: req.userId });
  if (!api) return sendNotFound(res, "API not found");

  const key = await APIKey.findOne({
    _id: req.params.keyId,
    apiId: api._id,
  }).select("-keyHash");

  if (!key) return sendNotFound(res, "API key not found");

  return sendSuccess(res, { key }, "Key fetched successfully");
};

/**
 * PATCH /api/v1/apis/:apiId/keys/:keyId/revoke
 * Revoke an API key
 */
const revokeKey = async (req, res) => {
  const { reason } = req.body;

  const api = await API.findOne({ _id: req.params.apiId, userId: req.userId });
  if (!api) return sendNotFound(res, "API not found");

  const key = await APIKey.findOneAndUpdate(
    { _id: req.params.keyId, apiId: api._id, status: "active" },
    {
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: reason || "Revoked by owner",
    },
    { new: true },
  );

  if (!key) return sendNotFound(res, "Active API key not found");

  logger.info("API key revoked", {
    keyId: key._id,
    apiId: api._id,
    userId: req.userId,
    reason,
  });
  audit.keyRevoked(
    req.userId,
    key._id,
    key.keyPrefix,
    reason || "Revoked by owner",
    req.ip,
  );

  return sendSuccess(res, { key }, "API key revoked successfully");
};

/**
 * POST /api/v1/apis/:apiId/keys/:keyId/rotate
 * Rotate key — revoke old, generate new
 * This is the industry-standard way to replace a compromised key
 */
const rotateKey = async (req, res) => {
  const api = await API.findOne({
    _id: req.params.apiId,
    userId: req.userId,
    status: "active",
  });
  if (!api) return sendNotFound(res, "API not found");

  // Find old key
  const oldKey = await APIKey.findOne({
    _id: req.params.keyId,
    apiId: api._id,
    status: "active",
  });

  if (!oldKey) return sendNotFound(res, "Active API key not found");

  // Generate new key with same settings
  const { rawKey, keyHash, keyPrefix } = generateAPIKey("live");

  const newKey = await APIKey.create({
    apiId: api._id,
    userId: req.userId,
    keyPrefix,
    keyHash,
    name: `${oldKey.name} (Rotated)`,
    description: oldKey.description,
    tier: oldKey.tier,
    rateLimit: oldKey.rateLimit,
    expiresAt: oldKey.expiresAt,
    allowedOrigins: oldKey.allowedOrigins,
  });

  // Revoke old key
  oldKey.status = "revoked";
  oldKey.revokedAt = new Date();
  oldKey.revokedReason = "Rotated — replaced by new key";
  await oldKey.save();

  logger.info("API key rotated", {
    oldKeyId: oldKey._id,
    newKeyId: newKey._id,
    apiId: api._id,
    userId: req.userId,
  });
  audit.keyRotated(req.userId, oldKey._id, keyPrefix, req.ip);

  return sendCreated(
    res,
    {
      oldKey: { id: oldKey._id, status: oldKey.status },
      newKey: {
        id: newKey._id,
        rawKey, // ← SHOWN ONCE ONLY
        keyPrefix,
        name: newKey.name,
        tier: newKey.tier,
        status: newKey.status,
        rateLimit: newKey.rateLimit,
        createdAt: newKey.createdAt,
      },
      warning: "Save this new key securely. It will NOT be shown again.",
    },
    "API key rotated successfully",
  );
};

module.exports = {
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
};
