const { processGatewayRequest } = require("../services/gateway.service");
const logger = require("../utils/logger");

const gatewayHandler = async (req, res, next) => {
  try {
    // Get apiId and path — set by gateway.routes.js
    const apiId = req.gatewayApiId || req.params.apiId;

    // Build gateway path from wildcard
    let gatewayPath = req.gatewayPath;

    // Fallback: build path manually if not set by routes
    if (!gatewayPath) {
      const fullPath = req.path; // e.g. /64f3abc/posts/1
      const parts = fullPath.split("/").filter(Boolean); // ['64f3abc', 'posts', '1']
      parts.shift(); // remove apiId from parts → ['posts', '1']
      gatewayPath = parts.length > 0 ? `/${parts.join("/")}` : "/";
    }

    // Clean up path — remove double slashes
    gatewayPath = gatewayPath.replace(/\/+/g, "/");
    if (!gatewayPath.startsWith("/")) gatewayPath = `/${gatewayPath}`;

    logger.info("Gateway request", {
      apiId,
      path: gatewayPath,
      method: req.method,
      query: req.query,
      ip: req.ip,
      requestId: req.requestId,
    });

    await processGatewayRequest(req, res, apiId, gatewayPath);
  } catch (error) {
    logger.error("Gateway middleware error", {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId,
    });

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: "GATEWAY_ERROR",
          message: "An internal gateway error occurred.",
          requestId: req.requestId,
        },
      });
    }
  }
};

module.exports = { gatewayHandler };
