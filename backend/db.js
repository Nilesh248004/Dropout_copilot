// db.js
// Neon serverless driver over WebSocket/HTTPS to avoid blocked 5432 egress.
const { Pool, neonConfig } = require("@neondatabase/serverless");
const WebSocket = require("ws");

// Configure Neon for Node
neonConfig.webSocketConstructor = WebSocket;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineTLS = true;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "postgres"}:${encodeURIComponent(
      process.env.DB_PASSWORD || "Shreej@12"
    )}@${process.env.DB_HOST || "localhost"}:${Number(
      process.env.DB_PORT || 5432
    )}/${process.env.DB_NAME || "dropout_copilot"}?sslmode=require`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Prevent crashes on transient disconnects
pool.on("error", (err) => {
  console.error("Unexpected DB error:", err);
});

// Ensure every session uses UTC to avoid timezone drift
pool.on("connect", async (client) => {
  try {
    await client.query("SET TIME ZONE 'UTC'");
  } catch (err) {
    console.warn("⚠️ Could not set UTC timezone for session:", err.message);
  }
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL Connected (TZ=UTC) via Neon serverless"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

module.exports = pool;
