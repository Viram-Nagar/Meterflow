// /**
//  * @file gateway.routes.js
//  * @description Gateway routes — wildcard pattern captures all paths.
//  *
//  * Pattern: /gateway/:apiId/*
//  *
//  * Examples:
//  * GET  /gateway/64f3abc/weather
//  * GET  /gateway/64f3abc/weather/forecast
//  * POST /gateway/64f3abc/users/create
//  * GET  /gateway/64f3abc/pokemon/1
//  */

// const express = require("express");
// const router = express.Router();
// const { gatewayHandler } = require("../middleware/gateway.middleware");

// // Wildcard route — captures everything after :apiId
// // :apiId   → the API's MongoDB ObjectId
// // (*)      → any path after that
// router.all("/:apiId/*", gatewayHandler);

// // Also handle root path (no sub-path)
// router.all("/:apiId", gatewayHandler);

// module.exports = router;

/**
 * @file gateway.routes.js
 * @description Gateway routes — wildcard captures ALL paths after apiId.
 *
 * Examples:
 * /gateway/64f3abc/posts/1         → apiId=64f3abc, path=/posts/1
 * /gateway/64f3abc/pokemon/pikachu → apiId=64f3abc, path=/pokemon/pikachu
 * /gateway/64f3abc                 → apiId=64f3abc, path=/
 */

const express = require("express");
const router = express.Router({ mergeParams: true });
const { gatewayHandler } = require("../middleware/gateway.middleware");

// Catch ALL methods and ALL paths after :apiId
// The * wildcard captures everything including slashes
router.all(
  "/:apiId*",
  (req, res, next) => {
    // Extract everything after the apiId as the path
    // req.params[0] contains the wildcard portion
    const wildcardPath = req.params[0] || "";
    req.gatewayPath = wildcardPath ? `/${wildcardPath}` : "/";
    req.gatewayApiId = req.params.apiId;
    next();
  },
  gatewayHandler,
);

module.exports = router;
