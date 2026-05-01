/**
 * @file postgres.js
 * @description PostgreSQL connection pool using node-postgres (pg).
 * Used for:
 * - Billing cycles (ACID compliance for money)
 * - Transactions & payment records
 * - Invoice generation
 *
 * Why PostgreSQL for billing?
 * → ACID transactions prevent double billing
 * → Strong consistency for financial data
 * → Better for relational billing queries
 */

const { Pool } = require("pg");
const env = require("./env");
const logger = require("../utils/logger");

// ── Connection Pool ──────────────────────────────────────────────────────────

const pool = new Pool({
  host: env.POSTGRES.host,
  port: env.POSTGRES.port,
  database: env.POSTGRES.database,
  user: env.POSTGRES.user,
  password: env.POSTGRES.password,

  // Pool settings
  max: 20, // Max connections in pool
  min: 2, // Min connections kept alive
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10s

  // SSL for production
  ...(env.POSTGRES.ssl && {
    ssl: { rejectUnauthorized: false },
  }),
});

// ── Event Listeners ──────────────────────────────────────────────────────────

pool.on("connect", (client) => {
  logger.debug("PostgreSQL: New client connected to pool");
});

pool.on("error", (err) => {
  logger.error("❌ PostgreSQL pool error", { error: err.message });
});

pool.on("remove", () => {
  logger.debug("PostgreSQL: Client removed from pool");
});

// ── Connect & Initialize ─────────────────────────────────────────────────────

const connectPostgres = async () => {
  try {
    logger.info("🔌 Connecting to PostgreSQL...");

    // Test connection
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as now, version()");
    client.release();

    logger.info("✅ PostgreSQL connected", {
      time: result.rows[0].now,
      version: result.rows[0].version.split(" ").slice(0, 2).join(" "),
    });

    // Create tables if not exists
    await initializeTables();
  } catch (error) {
    logger.error("❌ PostgreSQL connection failed", { error: error.message });

    if (env.IS_PRODUCTION) {
      process.exit(1);
    } else {
      logger.warn("⚠️  Running without PostgreSQL — billing features disabled");
    }
  }
};

// ── Initialize Tables ────────────────────────────────────────────────────────

const initializeTables = async () => {
  const createTablesSQL = `
    -- Users billing info (mirrors MongoDB users)
    CREATE TABLE IF NOT EXISTS billing_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mongo_user_id VARCHAR(24) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      plan VARCHAR(50) DEFAULT 'free',
      razorpay_customer_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Billing cycles (monthly)
    CREATE TABLE IF NOT EXISTS billing_cycles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES billing_users(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      total_requests BIGINT DEFAULT 0,
      billable_requests BIGINT DEFAULT 0,
      amount_due DECIMAL(10, 2) DEFAULT 0.00,
      currency VARCHAR(3) DEFAULT 'INR',
      status VARCHAR(50) DEFAULT 'active',
      invoice_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, period_start)
    );

    -- Payment transactions
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES billing_users(id) ON DELETE SET NULL,
      billing_cycle_id UUID REFERENCES billing_cycles(id) ON DELETE SET NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      payment_id VARCHAR(255),
      order_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(100),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Pricing plans
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(50) UNIQUE NOT NULL,
      free_quota INTEGER DEFAULT 1000,
      price_per_hundred DECIMAL(10, 4) DEFAULT 0.00,
      currency VARCHAR(3) DEFAULT 'INR',
      rate_limit_per_minute INTEGER DEFAULT 60,
      rate_limit_per_month INTEGER DEFAULT 1000,
      features JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_billing_cycles_user_id ON billing_cycles(user_id);
    CREATE INDEX IF NOT EXISTS idx_billing_cycles_status ON billing_cycles(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

    -- Insert default pricing plans (ignore if exists)
    INSERT INTO pricing_plans (name, free_quota, price_per_hundred, rate_limit_per_minute, rate_limit_per_month, features)
    VALUES
      ('free',       1000,  0.00, 10,   1000,   '["1K requests/month", "Basic analytics", "1 API"]'),
      ('pro',        10000, 0.50, 100,  100000, '["10K free + ₹0.50/100 req", "Full analytics", "10 APIs", "Webhooks"]'),
      ('enterprise', 50000, 0.30, 1000, 999999, '["50K free + ₹0.30/100 req", "Priority support", "Unlimited APIs", "SLA"]')
    ON CONFLICT (name) DO NOTHING;
  `;

  try {
    await pool.query(createTablesSQL);
    logger.info("✅ PostgreSQL tables initialized");
  } catch (error) {
    logger.error("❌ Failed to initialize PostgreSQL tables", {
      error: error.message,
    });
    throw error;
  }
};

// ── Query Helper ─────────────────────────────────────────────────────────────

/**
 * Execute a query with automatic client management
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn("⚠️  Slow PostgreSQL query detected", {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    logger.error("PostgreSQL query error", {
      query: text.substring(0, 100),
      error: error.message,
    });
    throw error;
  }
};

/**
 * Execute queries in a transaction
 * @param {Function} callback - async (client) => { ... }
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ── Health Check ─────────────────────────────────────────────────────────────

const isPostgresHealthy = async () => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

// ── Disconnect ───────────────────────────────────────────────────────────────

const disconnectPostgres = async () => {
  await pool.end();
  logger.info("🔌 PostgreSQL pool closed gracefully");
};

module.exports = {
  pool,
  query,
  withTransaction,
  connectPostgres,
  disconnectPostgres,
  isPostgresHealthy,
};
