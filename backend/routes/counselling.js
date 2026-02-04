// routes/counselling.js
const router = require("express").Router();
const pool = require("../db"); // PostgreSQL connection

// ================= BOOK COUNSELLING REQUEST =================
router.post("/book", async (req, res) => {
  try {
    const { student_id, reason } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: "student_id is required" });
    }

    // Prevent duplicate open requests
    const existing = await pool.query(
      "SELECT * FROM counselling_requests WHERE student_id=$1 AND status='PENDING'",
      [student_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Counselling already requested" });
    }

    await pool.query(
      `
      INSERT INTO counselling_requests (student_id, reason, status, request_date)
      VALUES ($1, $2, 'PENDING', NOW())
      `,
      [student_id, reason || "High dropout risk"]
    );

    console.log("📥 Counselling booked for student:", student_id);
    res.json({ message: "Counselling booked successfully" });

  } catch (err) {
    console.error("❌ Counselling Book Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ALL COUNSELLING REQUESTS =================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, s.name, s.register_number
      FROM counselling_requests c
      JOIN students s ON s.id = c.student_id
      ORDER BY c.request_date DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE COUNSELLING STATUS =================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["PENDING", "COMPLETED", "CANCELLED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      "UPDATE counselling_requests SET status=$1 WHERE id=$2",
      [status, id]
    );

    res.json({ message: "Status updated" });
  } catch (err) {
    console.error("❌ Update Status Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE COUNSELLING REQUEST =================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM counselling_requests WHERE id=$1", [id]);

    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("❌ Delete Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
