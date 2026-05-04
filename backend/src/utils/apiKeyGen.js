const crypto = require("crypto");

/**
 * Generate a new secure API key
 * @param {string} env - "live" or "test"
 * @returns {{ rawKey, keyHash, keyPrefix }}
 */
const generateAPIKey = (env = "live") => {
  // Generate 32 random bytes → 64 hex chars
  const randomPart = crypto.randomBytes(32).toString("hex");

  // Full key: mf_live_<64 hex chars>
  const rawKey = `mf_${env}_${randomPart}`;

  // Hash for DB storage (SHA-256)
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Prefix for display (first 16 chars of random part)
  // e.g. "mf_live_a8f3k2x9..."
  const keyPrefix = `mf_${env}_${randomPart.substring(0, 8)}...`;

  return {
    rawKey, // Return to user ONCE — never store this
    keyHash, // Store in DB — used for lookup
    keyPrefix, // Store in DB — shown in UI
  };
};

/**
 * Hash a raw key for DB lookup
 * @param {string} rawKey
 * @returns {string} SHA-256 hash
 */
const hashAPIKey = (rawKey) => {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

/**
 * Validate API key format
 * @param {string} key
 * @returns {boolean}
 */
const isValidKeyFormat = (key) => {
  return /^mf_(live|test)_[a-f0-9]{64}$/.test(key);
};

module.exports = {
  generateAPIKey,
  hashAPIKey,
  isValidKeyFormat,
};
