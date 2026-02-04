const router = require("express").Router();
const pool = require("../db");

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeRegisterNumber = (value) => (value || "").trim().toLowerCase();

router.post("/", async (req, res) => {
  try {
    const { faculty_id, student_id, student_name, register_number, message } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedReg = normalizeRegisterNumber(register_number);

    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }

    let resolvedStudentId = Number(student_id);
    let resolvedName = (student_name || "").trim();
    let resolvedReg = normalizedReg;

    if (!Number.isInteger(resolvedStudentId)) {
      if (!resolvedReg) {
        return res
          .status(400)
          .json({ error: "student_id or register_number is required" });
      }
      const lookup = await pool.query(
        `
        SELECT id, name, register_number
        FROM students
        WHERE LOWER(register_number) = LOWER($1)
        LIMIT 1
        `,
        [resolvedReg]
      );
      if (!lookup.rows.length) {
        return res.status(404).json({ error: "Student not found for register number." });
      }
      resolvedStudentId = lookup.rows[0].id;
      if (!resolvedName) {
        resolvedName = String(lookup.rows[0].name || "").trim();
      }
      if (!resolvedReg) {
        resolvedReg = normalizeRegisterNumber(lookup.rows[0].register_number);
      }
    }

    const trimmedName = resolvedName;
    const fallbackMessage = trimmedName
      ? `Faculty alert for ${trimmedName}${resolvedReg ? ` (${resolvedReg})` : ""}.`
      : "Faculty alert for a student.";
    const finalMessage = String(message || fallbackMessage).trim();

    const result = await pool.query(
      `
      INSERT INTO student_alerts (
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
        resolvedStudentId,
        trimmedName || null,
        resolvedReg || null,
        finalMessage,
      ]
    );

    res.json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
      student_id: resolvedStudentId,
    });
  } catch (err) {
    console.error("STUDENT ALERT CREATE ERROR:", err);
    res.status(500).json({ error: "Unable to create student alert." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { student_id, register_number } = req.query;
    const conditions = [];
    const params = [];

    if (student_id) {
      params.push(Number(student_id));
      conditions.push(`student_id = $${params.length}`);
    }
    if (register_number) {
      params.push(normalizeRegisterNumber(register_number));
      conditions.push(`LOWER(register_number) = $${params.length}`);
    }

    if (conditions.length === 0) {
      return res.status(400).json({ error: "student_id or register_number is required" });
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const result = await pool.query(
      `
      SELECT id,
             faculty_id,
             student_id,
             student_name,
             register_number,
             message,
             created_at
      FROM student_alerts
      ${whereClause}
      ORDER BY created_at DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("STUDENT ALERT LIST ERROR:", err);
    res.status(500).json({ error: "Unable to load student alerts." });
  }
});

module.exports = router;
