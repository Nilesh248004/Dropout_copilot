// db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  password: "Shreej@12",
  host: "localhost",
  port: 5432,
  database: "dropout_copilot",
});


pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ DB Connection Error:", err));

module.exports = pool;
