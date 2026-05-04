require("dotenv").config();
require("express-async-errors"); // Patches Express to catch async errors automatically

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const { v4: uuidv4 } = require("uuid");

const env = require("./config/env");
const logger = require("./utils/logger");
const { sendSuccess } = require("./utils/response");
const {
  notFoundHandler,
  globalErrorHandler,
} = require("./middleware/error.middleware");

const app = express();

// ── Trust Proxy (for deployment behind Nginx/Railway) ────────────────────────
app.set("trust proxy", 1);

// ── Request ID Middleware ─────────────────────────────────────────────────────
// Every request gets a unique ID for tracing through logs
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// ── Security Headers (Helmet) ─────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: env.IS_PRODUCTION ? undefined : false,
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
      ];

      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true, // Allow cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Request-Id",
    ],
    exposedHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "X-Request-Id",
    ],
  }),
);

// ── HTTP Request Logger (Morgan) ──────────────────────────────────────────────
const morganFormat = env.IS_DEVELOPMENT ? "dev" : "combined";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
    skip: (req) => req.url === "/health", // Don't log health checks
  }),
);

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── MongoDB Injection Prevention ──────────────────────────────────────────────
app.use(mongoSanitize());

// ── Response Compression ──────────────────────────────────────────────────────
app.use(compression());

// ── Global Rate Limiter (DoS protection) ─────────────────────────────────────
// This is separate from per-API-key rate limiting
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT.windowMs * 60 * 1000, // minutes → ms
  max: env.RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "GLOBAL_RATE_LIMIT",
      message: "Too many requests from this IP. Please try again later.",
    },
  },
  skip: (req) => req.url === "/health",
});
app.use("/api", globalLimiter);

// ── Health Check ──────────────────────────────────────────────────────────────
// Simple ping endpoint for deployment health checks
app.get("/health", (req, res) => {
  sendSuccess(
    res,
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
    },
    "MeterFlow API is running",
  );
});

// ── API Routes ────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const apiRoutes = require("./routes/api.routes");
const gatewayRoutes = require("./routes/gateway.routes");
const billingRoutes = require("./routes/billing.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const paymentRoutes = require("./routes/payment.routes");
const webhookRoutes = require("./routes/webhook.routes");
const auditRoutes = require("./routes/audit.routes");

app.use(`/api/${env.API_VERSION}/auth`, authRoutes);
app.use(`/api/${env.API_VERSION}/apis`, apiRoutes);
app.use(`/api/${env.API_VERSION}/billing`, billingRoutes);
app.use(`/api/${env.API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${env.API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${env.API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${env.API_VERSION}/audit`, auditRoutes);

// Gateway — consumers call: /gateway/:apiId/any/path
app.use(`/api/${env.API_VERSION}/gateway`, gatewayRoutes);

// ── Detailed Health Check (DB status) ────────────────────────────────────────
app.get(`/api/${env.API_VERSION}/health`, async (req, res) => {
  const { isMongoHealthy } = require("./config/db");
  const { isRedisHealthy } = require("./config/redis");
  const { isPostgresHealthy } = require("./config/postgres");

  const [mongo, redisOk, postgres] = await Promise.allSettled([
    Promise.resolve(isMongoHealthy()),
    isRedisHealthy(),
    isPostgresHealthy(),
  ]);

  const health = {
    api: "ok",
    mongodb: mongo.value ? "connected" : "disconnected",
    redis: redisOk.value ? "connected" : "disconnected",
    postgresql: postgres.value ? "connected" : "disconnected",
    uptime: `${Math.floor(process.uptime())}s`,
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
    timestamp: new Date().toISOString(),
  };

  const allHealthy = health.mongodb === "connected"; // MongoDB is required minimum

  sendSuccess(res, health, "Health check", allHealthy ? 200 : 207);
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler ──────────────────────────────────────────────────────
// Must be LAST middleware — 4 parameters = error handler in Express
app.use(globalErrorHandler);

module.exports = app;
