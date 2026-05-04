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
