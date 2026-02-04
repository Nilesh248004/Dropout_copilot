const router = require("express").Router();
const pool = require("../db");

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const countDataRows = (content) => {
  if (!content) return 0;
  const lines = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return 0;
  return lines.length - 1;
};

router.post("/", async (req, res) => {
  try {
    const { file_name, file_size, content, faculty_id, uploaded_by_email } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedEmail = normalizeEmail(uploaded_by_email);

    if (!file_name || !content || !normalizedFacultyId) {
      return res.status(400).json({
        error: "file_name, content, and faculty_id are required.",
      });
    }

    const rowCount = countDataRows(content);

    const result = await pool.query(
      `
      INSERT INTO faculty_exports (
        faculty_id,
        uploaded_by_email,
        file_name,
        file_size,
        row_count,
        content
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
      `,
      [
        normalizedFacultyId,
        normalizedEmail || null,
        file_name,
        Number.isFinite(Number(file_size)) ? Number(file_size) : null,
        rowCount,
        content,
      ]
    );

    res.json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error("EXPORT UPLOAD ERROR:", err);
    res.status(500).json({ error: "Unable to upload export." });
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
             uploaded_by_email,
             file_name,
             file_size,
             row_count,
             created_at,
             LEFT(content, 20000) AS content_preview
      FROM faculty_exports
      ${whereClause}
      ORDER BY created_at DESC
      `,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error("EXPORT LIST ERROR:", err);
    res.status(500).json({ error: "Unable to load exports." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(
      `
      SELECT id, faculty_id, uploaded_by_email, file_name, file_size, row_count, created_at, content
      FROM faculty_exports
      WHERE id = $1
      `,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Export not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("EXPORT FETCH ERROR:", err);
    res.status(500).json({ error: "Unable to load export." });
  }
});

module.exports = router;
