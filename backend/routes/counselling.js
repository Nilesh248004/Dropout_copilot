// routes/counselling.js
const router = require("express").Router();
const pool = require("../db"); // PostgreSQL connection

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();

// ================= BOOK COUNSELLING REQUEST =================
router.post("/book", async (req, res) => {
  try {
    const { student_id, reason, faculty_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: "student_id is required" });
    }
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }

    const studentResult = await pool.query(
      "SELECT year, faculty_id FROM students WHERE id=$1",
      [student_id]
    );
    if (!studentResult.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }
    const studentFacultyId = normalizeFacultyId(studentResult.rows[0].faculty_id);
    if (studentFacultyId && studentFacultyId !== normalizedFacultyId) {
      return res.status(403).json({ error: "Faculty ID does not match student's mapped faculty." });
    }
    const facultyLabel = String(normalizedFacultyId);

    // Prevent duplicate open requests
    const existing = await pool.query(
      "SELECT * FROM counselling_requests WHERE student_id=$1 AND status='PENDING'",
      [student_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Counselling already requested" });
    }

    await pool.query(
      `
      INSERT INTO counselling_requests (student_id, reason, status, request_date, faculty_label, faculty_id)
      VALUES ($1, $2, 'PENDING', NOW(), $3, $4)
      `,
      [student_id, reason || "High dropout risk", facultyLabel, normalizedFacultyId]
    );

    console.log("📥 Counselling booked for student:", student_id);
    res.json({ message: "Counselling booked successfully", faculty_label: facultyLabel });

  } catch (err) {
    console.error("❌ Counselling Book Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ALL COUNSELLING REQUESTS =================
router.get("/", async (req, res) => {
  try {
    const { faculty_id, student_id, status } = req.query;
    const params = [];
    const conditions = [];

    if (faculty_id) {
      params.push(normalizeFacultyId(faculty_id));
      conditions.push(`LOWER(TRIM(c.faculty_id)) = $${params.length}`);
    }
    if (student_id) {
      params.push(Number(student_id));
      conditions.push(`c.student_id = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim().toUpperCase());
      conditions.push(`c.status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT c.*, s.name, s.register_number, s.faculty_id AS student_faculty_id
      FROM counselling_requests c
      JOIN students s ON s.id = c.student_id
      ${whereClause}
      ${whereClause ? "AND" : "WHERE"} LOWER(TRIM(s.faculty_id)) = LOWER(TRIM(c.faculty_id))
      ORDER BY c.request_date DESC
      `,
      params
    );

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

    const nextStatus = String(status || "").trim().toUpperCase();
    const allowed = ["PENDING", "COMPLETED", "CANCELLED"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      "UPDATE counselling_requests SET status=$1 WHERE id=$2",
      [nextStatus, id]
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
