// db.js
// Use Neon over WebSocket only for Neon-hosted databases, and fall back
// to the standard pg driver for local or other Postgres instances.
const { Pool: NeonPool, neonConfig } = require("@neondatabase/serverless");
const { Pool: PgPool } = require("pg");
const WebSocket = require("ws");

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "require", "required"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) {
    return false;
  }
  return null;
};

const defaultDbConfig = {
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "Shreej@12",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "dropout_copilot",
};

const databaseUrl = process.env.DATABASE_URL || "";

const resolveDbHost = () => {
  if (!databaseUrl) return defaultDbConfig.host;
  try {
    return new URL(databaseUrl).hostname || defaultDbConfig.host;
  } catch {
    return defaultDbConfig.host;
  }
};

const resolvedDbHost = resolveDbHost();
const isNeonConnection = /(^|\.)neon\.tech$/i.test(resolvedDbHost);
const sslEnabled = parseBoolean(process.env.DB_SSL) ?? isNeonConnection;
const sslOptions = sslEnabled ? { rejectUnauthorized: false } : undefined;

if (isNeonConnection) {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineTLS = true;
}

const pool = isNeonConnection
  ? new NeonPool({
      connectionString:
        databaseUrl ||
        `postgresql://${defaultDbConfig.user}:${encodeURIComponent(
          defaultDbConfig.password
        )}@${defaultDbConfig.host}:${defaultDbConfig.port}/${defaultDbConfig.database}${
          sslEnabled ? "?sslmode=require" : ""
        }`,
      ...(sslOptions ? { ssl: sslOptions } : {}),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : new PgPool({
      ...(databaseUrl ? { connectionString: databaseUrl } : defaultDbConfig),
      ...(sslOptions ? { ssl: sslOptions } : {}),
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

const poolLabel = isNeonConnection ? "Neon serverless" : "pg";

pool.on("error", (err) => {
  console.error("Unexpected DB error:", err);
});

pool.on("connect", async (client) => {
  try {
    await client.query("SET TIME ZONE 'UTC'");
  } catch (err) {
    console.warn("Could not set UTC timezone for session:", err.message);
  }
});

pool
  .connect()
  .then((client) => {
    client.release();
    console.log(`PostgreSQL connected (TZ=UTC) via ${poolLabel}`);
  })
  .catch((err) => console.error("DB connection error:", err));

module.exports = pool;
