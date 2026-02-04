// server.js
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ================= LOGGER =================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("✅ AI Student Dropout Backend Running");
});

// ================= GET FULL STUDENTS =================
app.get("/students/full", async (req, res) => {
  try {
    const data = await pool.query(`
      SELECT s.id, s.name, s.register_number, s.year, s.semester,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid,
             a.dropout_risk AS risk_score, 
             a.dropout_flag AS dropout_prediction,
             p.risk_level
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      ORDER BY s.id DESC
    `);
    res.json(data.rows);
  } catch (err) {
    console.error("GET students ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// ================= ADD STUDENT =================
app.post("/students", async (req, res) => {
  try {
    const { name, register_number, year, semester } = req.body;

    const result = await pool.query(
      `INSERT INTO students(name, register_number, year, semester)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [name, register_number, year, semester]
    );

    // create academic record row
    await pool.query("INSERT INTO academic_records(student_id) VALUES($1)", [
      result.rows[0].id,
    ]);

    res.status(201).json({ studentId: result.rows[0].id });
  } catch (err) {
    console.error("ADD STUDENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE STUDENT =================
app.delete("/students/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await pool.query("DELETE FROM academic_records WHERE student_id=$1", [id]);
    await pool.query("DELETE FROM predictions WHERE student_id=$1", [id]);
    await pool.query("DELETE FROM students WHERE id=$1", [id]);

    res.json({ message: "Student deleted" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// ================= UPDATE ACADEMIC DATA =================
app.put("/academic/:student_id", async (req, res) => {
  try {
    const { attendance, cgpa, arrear_count, fees_paid } = req.body;
    const student_id = req.params.student_id;

    await pool.query(
      `
      UPDATE academic_records
      SET attendance=$1, cgpa=$2, arrear_count=$3, fees_paid=$4
      WHERE student_id=$5
    `,
      [attendance, cgpa, arrear_count, fees_paid, student_id]
    );

    res.json({ message: "Academic Updated" });
  } catch (err) {
    console.error("UPDATE ACADEMIC ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= AI PREDICT + SAVE =================
app.post("/predict/:student_id", async (req, res) => {
  const client = await pool.connect();
  try {
    const student_id = Number(req.params.student_id);

    const q = await client.query(`
      SELECT s.name, s.year, s.semester, a.*
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      WHERE s.id=$1
    `, [student_id]);

    if (!q.rows.length) return res.status(404).json({ error: "Student not found" });

    const s = q.rows[0];

    const payload = {
      attendance: Number(s.attendance || 0),
      cgpa: Number(s.cgpa || 0),
      arrear_count: Number(s.arrear_count || 0),
      fees_paid: Number(s.fees_paid || 0),
      disciplinary_issues: 0,
      year: Number(s.year),
      semester: Number(s.semester),
    };

    console.log("📡 ML PAYLOAD:", payload);

    const ml = await axios.post("http://127.0.0.1:8000/predict", payload);
    console.log("🤖 ML RESPONSE:", ml.data);

    const risk_score = ml.data.risk_score ?? 0;
    const risk_level = ml.data.risk_level ?? "UNKNOWN";
    const dropout = ml.data.dropout_prediction === 1 ? 1 : 0; // convert to integer

    await client.query("BEGIN");

    // Update academic table
    await client.query(`
      UPDATE academic_records
      SET dropout_risk=$1, dropout_flag=$2
      WHERE student_id=$3
    `, [risk_score, dropout, student_id]);

    await client.query("COMMIT");

    // ✅ Return a clean response
    res.json({
      student_id,
      name: s.name,
      risk_score,
      risk_level,
      dropout
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ PREDICT ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Prediction failed. Check server logs." });
  } finally {
    client.release();
  }
});

// ================= PREDICTION ROUTES =================
const predictionRoutes = require("./routes/prediction");
app.use("/prediction", predictionRoutes);


const counsellingRoutes = require("./routes/counselling");
app.use("/counselling", counsellingRoutes);




// students/risk/history
router.get("/risk/history", async (req, res) => {
  const result = await db.query(`
    SELECT 
      TO_CHAR(predicted_at, 'Week WW') AS week,
      AVG(dropout_risk) AS avg_risk
    FROM prediction_history
    GROUP BY week
    ORDER BY week;
  `);
  res.json(result.rows);
});


// ================= START SERVER =================
app.listen(4000, () => console.log("✅ Backend running on http://localhost:4000"));
