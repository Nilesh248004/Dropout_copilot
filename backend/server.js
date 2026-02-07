// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const WebSocket = require("ws");
const pool = require("./db");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "20mb" }));

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      error: "File too large. Please upload a CSV smaller than 20MB.",
    });
  }
  return next(err);
});

const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:8000";
const PORT = process.env.PORT || 4000;
const CHAT_WS_PATH = "/counselling/chat/ws";
const normalizeBaseUrl = (value) => String(value || "").replace(/\/$/, "");
const BULK_IMPORT_LIMIT = Number.parseInt(
  process.env.BULK_IMPORT_LIMIT || "500",
  10
);

const normalizeFacultyId = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const normalizeFeesPaid = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["paid", "settled"].includes(normalized)) return true;
    if (["unpaid", "due"].includes(normalized)) return false;
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return null;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const resolveRiskLevel = (level, score) => {
  const normalized = String(level || "").trim().toUpperCase();
  if (normalized) return normalized;
  if (score === null) return "";
  if (score > 0.7) return "HIGH";
  if (score > 0.4) return "MEDIUM";
  return "LOW";
};

const resetPredictionForStudent = async (studentId) => {
  await pool.query(
    `
    UPDATE academic_records
    SET dropout_risk = NULL, dropout_flag = NULL
    WHERE student_id = $1
    `,
    [studentId]
  );
  await pool.query("DELETE FROM predictions WHERE student_id = $1", [studentId]);
};

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
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [];
    if (normalizedFacultyId) params.push(normalizedFacultyId);
    const data = await pool.query(
      `
      SELECT s.id, s.name, s.register_number, s.year, s.semester, s.faculty_id, s.phone_number,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid, a.disciplinary_issues,
             a.dropout_risk AS risk_score, 
             a.dropout_flag AS dropout_prediction,
             p.risk_level
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      ${normalizedFacultyId ? "WHERE LOWER(TRIM(s.faculty_id)) = $1" : ""}
      ORDER BY s.id DESC
      `,
      params
    );
    res.json(data.rows);
  } catch (err) {
    console.error("GET students ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ALL STUDENTS (BASIC LIST) =================
app.get("/students", async (req, res) => {
  try {
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [];
    if (normalizedFacultyId) params.push(normalizedFacultyId);
    const data = await pool.query(
      `
      SELECT id, name, register_number, year, semester, faculty_id, phone_number
      FROM students
      ${normalizedFacultyId ? "WHERE LOWER(TRIM(faculty_id)) = $1" : ""}
      ORDER BY id DESC
      `,
      params
    );
    res.json(data.rows);
  } catch (err) {
    console.error("GET students ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET STUDENTS (PAGINATED) =================
app.get("/students/page/:page", async (req, res) => {
  try {
    const page = Math.max(Number(req.params.page || 1), 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
      SELECT id, name, register_number, year, semester
      FROM students
      ORDER BY id DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET students page ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET STUDENT BY REG NO =================
app.get("/students/lookup/:regno", async (req, res) => {
  try {
    const regno = req.params.regno;
    const result = await pool.query(
      `
      SELECT id, name, register_number, year, semester
      FROM students
      WHERE LOWER(register_number)=LOWER($1)
      `,
      [regno]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET student by regno ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET FULL STUDENT BY REG NO =================
app.get("/students/lookup/:regno/full", async (req, res) => {
  try {
    const regno = req.params.regno;
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [regno];
    const facultyFilter = normalizedFacultyId ? "AND LOWER(TRIM(s.faculty_id)) = $2" : "";
    if (normalizedFacultyId) params.push(normalizedFacultyId);

    const result = await pool.query(
      `
      SELECT s.id, s.name, s.register_number, s.year, s.semester, s.faculty_id, s.phone_number,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid, a.disciplinary_issues,
             a.dropout_risk AS risk_score, 
             a.dropout_flag AS dropout_prediction,
             p.risk_level,
             u.email AS faculty_email
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      LEFT JOIN app_users u
        ON LOWER(TRIM(u.faculty_id)) = LOWER(TRIM(s.faculty_id))
       AND u.role = 'faculty'
      WHERE LOWER(s.register_number)=LOWER($1)
      ${facultyFilter}
      `,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET student full by regno ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET STUDENT BY ID =================
app.get("/students/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [id];
    const facultyFilter = normalizedFacultyId ? "AND LOWER(TRIM(faculty_id)) = $2" : "";
    if (normalizedFacultyId) params.push(normalizedFacultyId);
    const result = await pool.query(
      `
      SELECT id, name, register_number, year, semester, faculty_id, phone_number
      FROM students
      WHERE id=$1
      ${facultyFilter}
      `,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET student ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET FULL STUDENT BY ID =================
app.get("/students/:id/full", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [id];
    const facultyFilter = normalizedFacultyId ? "AND LOWER(TRIM(s.faculty_id)) = $2" : "";
    if (normalizedFacultyId) params.push(normalizedFacultyId);
    const result = await pool.query(
      `
      SELECT s.id, s.name, s.register_number, s.year, s.semester, s.faculty_id, s.phone_number,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid, a.disciplinary_issues,
             a.dropout_risk AS risk_score, 
             a.dropout_flag AS dropout_prediction,
             p.risk_level,
             u.email AS faculty_email
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      LEFT JOIN app_users u
        ON LOWER(TRIM(u.faculty_id)) = LOWER(TRIM(s.faculty_id))
       AND u.role = 'faculty'
      WHERE s.id=$1
      ${facultyFilter}
      `,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET student full ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= WEEKLY RISK HISTORY (ALL STUDENTS AVG) =================
app.get("/students/risk/history", async (req, res) => {
  try {
    const { faculty_id } = req.query;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const params = [];
    const facultyFilter = normalizedFacultyId ? "WHERE LOWER(TRIM(s.faculty_id)) = $1" : "";
    if (normalizedFacultyId) params.push(normalizedFacultyId);
    const result = await pool.query(
      `
      SELECT
        TO_CHAR(ph.predicted_at, 'Week WW') AS week,
        AVG(ph.dropout_risk) AS avg_risk
      FROM prediction_history ph
      JOIN students s ON s.id = ph.student_id
      ${facultyFilter}
      GROUP BY week
      ORDER BY week;
      `,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET risk history ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= STUDENT PREDICTION HISTORY =================
app.get("/students/:id/history", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid student id." });
    }
    const result = await pool.query(
      `
      SELECT dropout_risk, risk_level, predicted_at
      FROM prediction_history
      WHERE student_id = $1
      ORDER BY predicted_at ASC
      `,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET student history ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



// ================= ADD STUDENT =================
app.post("/students", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      register_number,
      year,
      semester,
      faculty_id,
      phone_number,
      attendance,
      cgpa,
      arrear_count,
      fees_paid,
      disciplinary_issues,
    } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedFeesPaid = normalizeFeesPaid(fees_paid);

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO students(name, register_number, year, semester, faculty_id, phone_number)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, register_number, year, semester, normalizedFacultyId || null, phone_number || null]
    );

    // create academic record row
    await client.query(
      `
      INSERT INTO academic_records(
        student_id,
        attendance,
        cgpa,
        arrear_count,
        fees_paid,
        disciplinary_issues,
        dropout_risk,
        dropout_flag
      )
      VALUES($1,$2,$3,$4,$5,$6, NULL, NULL)
      `,
      [
        result.rows[0].id,
        attendance ?? null,
        cgpa ?? null,
        arrear_count ?? null,
        normalizedFeesPaid,
        disciplinary_issues ?? null,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ studentId: result.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ADD STUDENT ERROR:", {
      code: err.code,
      constraint: err.constraint,
      message: err.message,
    });
    if (err.code === "23505" && err.constraint === "students_register_number_key") {
      return res.status(409).json({ error: "Register number already exists." });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ================= BULK ADD STUDENTS =================
app.post("/students/bulk", async (req, res) => {
  const { students, force_faculty_id } = req.body || {};
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students array is required" });
  }
  if (students.length > BULK_IMPORT_LIMIT) {
    return res.status(413).json({ error: `Bulk import limit is ${BULK_IMPORT_LIMIT} rows.` });
  }

  const forcedFacultyId = normalizeFacultyId(force_faculty_id);
  const results = [];
  let created = 0;
  let failed = 0;

  const client = await pool.connect();
  try {
    for (let i = 0; i < students.length; i += 1) {
      const row = students[i] || {};
      const name = String(row.name || "").trim();
      const register_number = String(row.register_number || "").trim();
      const year = toNumberOrNull(row.year);
      const semester = toNumberOrNull(row.semester);
      const attendance = toNumberOrNull(row.attendance);
      const cgpa = toNumberOrNull(row.cgpa);
      const arrear_count = toNumberOrNull(row.arrear_count);
      const fees_paid = normalizeFeesPaid(row.fees_paid);
      const disciplinary_issues = toNumberOrNull(row.disciplinary_issues);
      const phone_number = row.phone_number ? String(row.phone_number).trim() : null;
      const faculty_id = forcedFacultyId || normalizeFacultyId(row.faculty_id);

      const missing = [];
      if (!name) missing.push("name");
      if (!register_number) missing.push("register_number");
      if (year === null) missing.push("year");
      if (semester === null) missing.push("semester");
      if (attendance === null) missing.push("attendance");
      if (cgpa === null) missing.push("cgpa");
      if (arrear_count === null) missing.push("arrear_count");
      if (fees_paid === null) missing.push("fees_paid");

      if (missing.length > 0) {
        failed += 1;
        results.push({
          index: i,
          register_number,
          status: "error",
          error: `Missing or invalid: ${missing.join(", ")}`,
        });
        continue;
      }

      try {
        await client.query("BEGIN");
        const insertStudent = await client.query(
          `
          INSERT INTO students (name, register_number, year, semester, faculty_id, phone_number)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
          `,
          [name, register_number, year, semester, faculty_id || null, phone_number]
        );
        const studentId = insertStudent.rows[0].id;
        await client.query(
          `
          INSERT INTO academic_records (
            student_id,
            attendance,
            cgpa,
            arrear_count,
            fees_paid,
            disciplinary_issues,
            dropout_risk,
            dropout_flag
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)
          `,
          [
            studentId,
            attendance,
            cgpa,
            arrear_count,
            fees_paid,
            disciplinary_issues,
          ]
        );
        await client.query("COMMIT");
        created += 1;
        results.push({
          index: i,
          register_number,
          status: "success",
          student_id: studentId,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        failed += 1;
        let message = err.message;
        if (err.code === "23505") {
          message = "Register number already exists.";
        }
        results.push({
          index: i,
          register_number,
          status: "error",
          error: message,
        });
      }
    }

    res.json({
      total: students.length,
      created,
      failed,
      results,
    });
  } catch (err) {
    console.error("BULK ADD STUDENTS ERROR:", err.message);
    res.status(500).json({ error: "Bulk import failed." });
  } finally {
    client.release();
  }
});

// ================= UPDATE STUDENT =================
app.put("/students/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, register_number, year, semester, faculty_id, phone_number } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);

    await pool.query(
      `
      UPDATE students
      SET
        name = COALESCE($1, name),
        register_number = COALESCE($2, register_number),
        year = COALESCE($3, year),
        semester = COALESCE($4, semester),
        faculty_id = COALESCE($5, faculty_id),
        phone_number = COALESCE($6, phone_number)
      WHERE id=$7
      `,
      [
        name ?? null,
        register_number ?? null,
        year ?? null,
        semester ?? null,
        normalizedFacultyId || null,
        phone_number ?? null,
        id,
      ]
    );

    await resetPredictionForStudent(id);

    res.json({ message: "Student updated" });
  } catch (err) {
    console.error("UPDATE STUDENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADD/UPDATE ACADEMIC DATA =================
app.post("/academic", async (req, res) => {
  try {
    const { student_id, attendance, cgpa, arrear_count, fees_paid, disciplinary_issues } = req.body;
    const normalizedFeesPaid = normalizeFeesPaid(fees_paid);

    await pool.query(
      `
      INSERT INTO academic_records (student_id, attendance, cgpa, arrear_count, fees_paid, disciplinary_issues)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id)
      DO UPDATE SET
        attendance = EXCLUDED.attendance,
        cgpa = EXCLUDED.cgpa,
        arrear_count = EXCLUDED.arrear_count,
        fees_paid = EXCLUDED.fees_paid,
        disciplinary_issues = EXCLUDED.disciplinary_issues
      `,
      [student_id, attendance, cgpa, arrear_count, normalizedFeesPaid, disciplinary_issues]
    );

    await resetPredictionForStudent(student_id);

    res.status(201).json({ message: "Academic record saved" });
  } catch (err) {
    console.error("ADD ACADEMIC ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE STUDENT =================
app.delete("/students/:id", async (req, res) => {
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

    res.json({ message: "Student deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// ================= UPDATE ACADEMIC DATA =================
app.put("/academic/:student_id", async (req, res) => {
  try {
    const { attendance, cgpa, arrear_count, fees_paid, disciplinary_issues } = req.body;
    const student_id = req.params.student_id;
    const normalizedFeesPaid = normalizeFeesPaid(fees_paid);

    const updateResult = await pool.query(
      `
      UPDATE academic_records
      SET attendance=$1, cgpa=$2, arrear_count=$3, fees_paid=$4, disciplinary_issues=$5
      WHERE student_id=$6
      `,
      [attendance, cgpa, arrear_count, normalizedFeesPaid, disciplinary_issues, student_id]
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `
        INSERT INTO academic_records (student_id, attendance, cgpa, arrear_count, fees_paid, disciplinary_issues)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [student_id, attendance, cgpa, arrear_count, normalizedFeesPaid, disciplinary_issues]
      );
    }

    await resetPredictionForStudent(student_id);

    res.json({ message: "Academic Updated" });
  } catch (err) {
    console.error("UPDATE ACADEMIC ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE RISK SCORE =================
app.put("/students/:id/risk", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { risk_score, dropout } = req.body;

    await pool.query(
      `
      UPDATE academic_records
      SET dropout_risk=$1, dropout_flag=$2
      WHERE student_id=$3
      `,
      [risk_score, dropout ? 1 : 0, id]
    );

    res.json({ message: "Risk updated" });
  } catch (err) {
    console.error("UPDATE RISK ERROR:", err);
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

    const missingFields = [];
    if (s.attendance === null || s.attendance === undefined) missingFields.push("attendance");
    if (s.cgpa === null || s.cgpa === undefined) missingFields.push("cgpa");
    if (s.arrear_count === null || s.arrear_count === undefined) missingFields.push("arrear_count");
    if (s.fees_paid === null || s.fees_paid === undefined) missingFields.push("fees_paid");

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Academic data incomplete. Update student record before predicting.",
        missing_fields: missingFields,
      });
    }

    const payload = {
      attendance: Number(s.attendance || 0),
      cgpa: Number(s.cgpa || 0),
      arrear_count: Number(s.arrear_count || 0),
      fees_paid: Number(s.fees_paid || 0),
      disciplinary_issues: Number(s.disciplinary_issues || 0),
      year: Number(s.year),
      semester: Number(s.semester),
    };

    console.log("📡 ML PAYLOAD:", payload);

    const ml = await axios.post(`${ML_API_URL}/predict`, payload);
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

    // Upsert prediction summary
    await client.query(
      `
      INSERT INTO predictions (student_id, dropout_risk, dropout, risk_level, prediction_date)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (student_id)
      DO UPDATE SET 
        dropout_risk = EXCLUDED.dropout_risk,
        dropout = EXCLUDED.dropout,
        risk_level = EXCLUDED.risk_level,
        prediction_date = NOW()
      `,
      [student_id, risk_score, dropout, risk_level]
    );

    // Save prediction history
    await client.query(
      `
      INSERT INTO prediction_history(student_id, dropout_risk, risk_level)
      VALUES($1,$2,$3)
      `,
      [student_id, risk_score, risk_level]
    );

    const resolvedLevel = resolveRiskLevel(risk_level, toNumberOrNull(risk_score));
    if (["HIGH", "MEDIUM"].includes(resolvedLevel)) {
      await client.query(
        `
        UPDATE counselling_requests
        SET status = 'PENDING',
            request_date = NOW()
        WHERE id IN (
          SELECT id
          FROM counselling_requests
          WHERE student_id = $1
            AND (meet_link IS NOT NULL OR scheduled_at IS NOT NULL)
          ORDER BY request_date DESC
          LIMIT 1
        )
          AND status IN ('COMPLETED', 'CANCELLED')
        `,
        [student_id]
      );
    } else if (resolvedLevel === "LOW") {
      await client.query(
        `
        UPDATE counselling_requests
        SET status = 'CANCELLED',
            request_date = NOW()
        WHERE id IN (
          SELECT id
          FROM counselling_requests
          WHERE student_id = $1
            AND (meet_link IS NOT NULL OR scheduled_at IS NOT NULL)
          ORDER BY request_date DESC
          LIMIT 1
        )
          AND status IN ('PENDING', 'SCHEDULED', 'COMPLETED')
        `,
        [student_id]
      );
    }

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
    const details = err.response?.data || err.message;
    console.error("❌ PREDICT ERROR:", details);
    res.status(500).json({ error: "Prediction failed.", details });
  } finally {
    client.release();
  }
});

// ================= PREDICTION ROUTES =================
const predictionRoutes = require("./routes/prediction");
app.use("/prediction", predictionRoutes);

const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);


const counsellingRoutes = require("./routes/counselling");
app.use("/counselling", counsellingRoutes);

const alertRoutes = require("./routes/alerts");
app.use("/alerts", alertRoutes);

const studentAlertRoutes = require("./routes/studentAlerts");
app.use("/student-alerts", studentAlertRoutes);

const exportRoutes = require("./routes/exports");
app.use("/exports", exportRoutes);




// ================= WEBSOCKET CHAT STREAM =================
const wsServer = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith(CHAT_WS_PATH)) {
    socket.destroy();
    return;
  }

  wsServer.handleUpgrade(req, socket, head, (ws) => {
    wsServer.emit("connection", ws, req);
  });
});

wsServer.on("connection", (ws) => {
  let upstream = null;
  let buffer = "";
  let activeRequestId = null;

  const send = (payload) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  const closeUpstream = () => {
    if (upstream && !upstream.destroyed) {
      upstream.destroy();
    }
    upstream = null;
    buffer = "";
  };

  ws.on("close", closeUpstream);
  ws.on("error", closeUpstream);

  ws.on("message", async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      send({ type: "error", error: "Invalid JSON payload." });
      return;
    }

    if (message?.type !== "chat") {
      send({ type: "error", error: "Unsupported message type." });
      return;
    }

    const requestId = String(message.request_id || Date.now());
    activeRequestId = requestId;
    closeUpstream();

    const id = Number(message.student_id);
    const prompt = String(message.question || "").trim();

    if (!Number.isInteger(id)) {
      send({ type: "error", error: "student_id is required", request_id: requestId });
      return;
    }
    if (!prompt) {
      send({ type: "error", error: "question is required", request_id: requestId });
      return;
    }

    const enabled = String(process.env.MCP_ENABLED || "").toLowerCase() === "true";
    const mcpUrl = process.env.MCP_URL || process.env.MCP_SERVER_URL;
    if (!enabled || !mcpUrl) {
      send({ type: "error", error: "MCP streaming is disabled.", request_id: requestId });
      return;
    }

    const apiKey = process.env.MCP_API_KEY;
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const streamUrl = `${normalizeBaseUrl(mcpUrl)}/chat/stream`;

    // Let the client know the stream has started to avoid premature timeout.
    send({ type: "start", request_id: requestId });

    try {
      const response = await axios.post(
        streamUrl,
        { student_id: id, question: prompt },
        { headers, responseType: "stream", timeout: 60000 }
      );

      upstream = response.data;
      buffer = "";

      upstream.on("data", (chunk) => {
        if (requestId !== activeRequestId) return;
        buffer += chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let data;
          try {
            data = JSON.parse(trimmed);
          } catch (err) {
            continue;
          }
          if (data?.token) {
            send({ type: "token", token: data.token, request_id: requestId });
          }
          if (data?.error) {
            send({ type: "error", error: data.error, request_id: requestId });
            closeUpstream();
            return;
          }
          if (data?.done) {
            send({ type: "done", request_id: requestId });
            closeUpstream();
            return;
          }
        }
      });

      upstream.on("error", (err) => {
        send({ type: "error", error: err.message || "Streaming failed", request_id: requestId });
        closeUpstream();
      });

      upstream.on("end", () => {
        send({ type: "done", request_id: requestId });
        closeUpstream();
      });
    } catch (err) {
      send({ type: "error", error: err.message || "Streaming failed", request_id: requestId });
      closeUpstream();
    }
  });
});

// ================= START SERVER =================
server.listen(PORT, () =>
  console.log(`✅ Backend running on http://localhost:${PORT}`)
);
