const router = require("express").Router();
const pool = require("../db");

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();

router.post("/", async (req, res) => {
  try {
    const { faculty_id, student_id, student_name, register_number, message } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);

    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }

    const trimmedName = (student_name || "").trim();
    const trimmedReg = (register_number || "").trim();
    const fallbackMessage = trimmedName
      ? `Admin alert for ${trimmedName}${trimmedReg ? ` (${trimmedReg})` : ""}.`
      : "Admin alert for a student.";
    const finalMessage = String(message || fallbackMessage).trim();

    const result = await pool.query(
      `
      INSERT INTO faculty_alerts (
        faculty_id,
        student_id,
        student_name,
        register_number,
        message
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
      `,
      [
        normalizedFacultyId,
        student_id ? Number(student_id) : null,
        trimmedName || null,
        trimmedReg || null,
        finalMessage,
      ]
    );

    res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err) {
    console.error("ALERT CREATE ERROR:", err);
    res.status(500).json({ error: "Unable to create alert." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [];
    const whereClause = normalizedFacultyId ? "WHERE faculty_id = $1" : "";
    if (normalizedFacultyId) params.push(normalizedFacultyId);

    const result = await pool.query(
      `
      SELECT id,
             faculty_id,
             student_id,
             student_name,
             register_number,
             message,
             created_at
      FROM faculty_alerts
      ${whereClause}
      ORDER BY created_at DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ALERT LIST ERROR:", err);
    res.status(500).json({ error: "Unable to load alerts." });
  }
});

module.exports = router;
