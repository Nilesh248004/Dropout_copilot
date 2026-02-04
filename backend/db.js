// db.js
const { Pool } = require("pg");

const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.DB_SSL === "1" ||
  (process.env.DATABASE_URL || "").includes("sslmode=");

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "Shreej@12",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "dropout_copilot",
    };

if (useSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);


pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ DB Connection Error:", err));

module.exports = pool;
