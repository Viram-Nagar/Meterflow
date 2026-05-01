// /**
//  * @file gateway.middleware.js
//  * @description Express middleware that intercepts all gateway requests.
//  * Extracts apiId + path from URL and passes to gateway service.
//  *
//  * URL pattern:
//  * /gateway/:apiId/any/path/here
//  *
//  * Example:
//  * /gateway/64f3abc/weather?city=Mumbai
//  *  → apiId     = "64f3abc"
//  *  → path      = "/weather"
//  *  → forwards  → baseUrl/weather?city=Mumbai
//  */

// const { processGatewayRequest } = require("../services/gateway.service");
// const logger = require("../utils/logger");

// /**
//  * Main gateway middleware
//  * Handles ALL methods: GET, POST, PUT, PATCH, DELETE
//  */
// const gatewayHandler = async (req, res, next) => {
//   try {
//     const { apiId } = req.params;

//     // Extract the path after /gateway/:apiId
//     // req.params[0] captures the wildcard (*) portion
//     const gatewayPath = req.params[0] ? `/${req.params[0]}` : "/";

//     logger.debug("Gateway request received", {
//       apiId,
//       path: gatewayPath,
//       method: req.method,
//       requestId: req.requestId,
//       ip: req.ip,
//     });

//     await processGatewayRequest(req, res, apiId, gatewayPath);
//   } catch (error) {
//     logger.error("Gateway middleware error", {
//       error: error.message,
//       stack: error.stack,
//       requestId: req.requestId,
//     });

//     if (!res.headersSent) {
//       return res.status(500).json({
//         success: false,
//         error: {
//           code: "GATEWAY_ERROR",
//           message: "An internal gateway error occurred.",
//           requestId: req.requestId,
//         },
//       });
//     }
//   }
// };

// module.exports = { gatewayHandler };

/**
 * @file gateway.middleware.js
 * @description Gateway middleware — extracts apiId and path, calls service.
 *
 * URL examples:
 * /gateway/64f3abc/posts/1         → path = /posts/1
 * /gateway/64f3abc/pokemon/pikachu → path = /pokemon/pikachu
 * /gateway/64f3abc/                → path = /
 * /gateway/64f3abc                 → path = /
 */

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
