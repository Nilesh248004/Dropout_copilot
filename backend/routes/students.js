const router = require("express").Router();
const pool = require("../db");

// GET all students + academic info
router.get("/full", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.register_number, s.year, s.semester,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid,
             a.dropout_risk AS risk_score, a.dropout_flag AS dropout_prediction, p.risk_level
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      ORDER BY s.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /students/full ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ADD student
router.post("/", async (req, res) => {
  try {
    const { name, register_number, year, semester } = req.body;
    const result = await pool.query(`
      INSERT INTO students(name, register_number, year, semester)
      VALUES ($1,$2,$3,$4) RETURNING id
    `, [name, register_number, year, semester]);

    await pool.query(
      "INSERT INTO academic_records(student_id, dropout_risk, dropout_flag) VALUES($1, NULL, NULL)",
      [result.rows[0].id]
    );
    res.status(201).json({ studentId: result.rows[0].id });
  } catch (err) {
    console.error("ADD STUDENT ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE student
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query("BEGIN");
    await client.query("DELETE FROM counselling_requests WHERE student_id=$1", [id]);
    await client.query("DELETE FROM student_alerts WHERE student_id=$1", [id]);
    await client.query("DELETE FROM faculty_alerts WHERE student_id=$1", [id]);
    await client.query("DELETE FROM prediction_history WHERE student_id=$1", [id]);
    await client.query("DELETE FROM predictions WHERE student_id=$1", [id]);
    await client.query("DELETE FROM academic_records WHERE student_id=$1", [id]);
    await client.query("DELETE FROM app_users WHERE student_id=$1", [id]);
    await client.query("DELETE FROM students WHERE id=$1", [id]);
    await client.query("COMMIT");
    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE STUDENT ERROR:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get("/:id/full", async (req, res) => {
  const id = req.params.id;
  const [student] = await db.query(
    "SELECT * FROM students LEFT JOIN predictions ON students.id = predictions.student_id WHERE students.id=?",
    [id]
  );
  res.json(student[0]);
});


router.get("/:id/history", async (req, res) => {
  const id = req.params.id;
  const result = await db.query(
    "SELECT dropout_risk, predicted_at FROM prediction_history WHERE student_id=$1 ORDER BY predicted_at ASC",
    [id]
  );
  res.json(result.rows);
});




module.exports = router;
