const pool = require("./db");

(async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected Successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection Failed:", err.message);
    process.exit(1);
  }
})();
