// routes/prediction.js
const router = require("express").Router();
const pool = require("../db");

// ================= SAVE PREDICTION =================
router.post("/save", async (req, res) => {
  try {
    const { student_id, dropout_prediction, risk_score, risk_level } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: "student_id is required" });
    }

    // Convert boolean → integer
    const dropout = dropout_prediction ? 1 : 0;

    // UPSERT prediction
    await pool.query(
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

    // Update academic_records
    await pool.query(
      `
      UPDATE academic_records
      SET dropout_risk=$1, dropout_flag=$2
      WHERE student_id=$3
      `,
      [risk_score, dropout, student_id]
    );

    // Save prediction history
    await pool.query(
      `
      INSERT INTO prediction_history(student_id, dropout_risk, risk_level)
      VALUES($1,$2,$3)
      `,
      [student_id, risk_score, risk_level]
    );

    console.log("📥 Prediction Saved:", { student_id, risk_score, risk_level, dropout });
    res.json({ message: "Prediction saved successfully" });

  } catch (err) {
    console.error("❌ Prediction Save Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
