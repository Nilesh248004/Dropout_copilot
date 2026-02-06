const router = require("express").Router();
const pool = require("../db");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const useB2 = Boolean(
  process.env.B2_BUCKET_NAME &&
    process.env.B2_KEY_ID &&
    process.env.B2_APPLICATION_KEY &&
    process.env.B2_S3_ENDPOINT &&
    String(process.env.B2_ENABLED || "").toLowerCase() === "true"
);

const ensureHttps = (value) => {
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};

const b2Client = useB2
  ? new S3Client({
      region: process.env.B2_REGION || "us-east-005",
      endpoint: ensureHttps(process.env.B2_S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
      forcePathStyle: true,
    })
  : null;

const countDataRows = (content) => {
  if (!content) return 0;
  const lines = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return 0;
  return lines.length - 1;
};

const buildObjectKey = (facultyId, fileName) => {
  const safeName = String(fileName || "export.csv")
    .trim()
    .replace(/[^\w.-]+/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `exports/${facultyId}/${timestamp}_${safeName}`;
};

const buildSignedDownloadUrl = async (objectKey, fileName) => {
  if (!b2Client || !objectKey) return null;
  const expiresIn = Number(process.env.B2_SIGNED_URL_TTL || 600);
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${fileName || "faculty-export.csv"}"`,
    ResponseContentType: "text/csv",
  });
  return getSignedUrl(b2Client, command, { expiresIn });
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
    const contentPreview = String(content).slice(0, 20000);
    let objectKey = null;
    let storageProvider = null;
    let storedContent = content;

    if (useB2) {
      try {
        objectKey = buildObjectKey(normalizedFacultyId, file_name);
        const command = new PutObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: objectKey,
          Body: content,
          ContentType: "text/csv",
        });
        await b2Client.send(command);
        storageProvider = "b2";
        storedContent = null;
      } catch (storageError) {
        console.warn("B2 upload failed, storing export in database instead.");
        objectKey = null;
        storageProvider = null;
        storedContent = content;
      }
    }

    const result = await pool.query(
      `
      INSERT INTO faculty_exports (
        faculty_id,
        uploaded_by_email,
        file_name,
        file_size,
        row_count,
        content,
        content_preview,
        object_key,
        storage_provider
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at
      `,
      [
        normalizedFacultyId,
        normalizedEmail || null,
        file_name,
        Number.isFinite(Number(file_size)) ? Number(file_size) : null,
        rowCount,
        storedContent,
        contentPreview,
        objectKey,
        storageProvider,
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
             COALESCE(content_preview, LEFT(content, 20000)) AS content_preview,
             object_key,
             storage_provider
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
      SELECT id,
             faculty_id,
             uploaded_by_email,
             file_name,
             file_size,
             row_count,
             created_at,
             content,
             COALESCE(content_preview, LEFT(content, 20000)) AS content_preview,
             object_key,
             storage_provider
      FROM faculty_exports
      WHERE id = $1
      `,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Export not found." });
    }
    const row = result.rows[0];
    if (useB2 && row.storage_provider === "b2" && row.object_key) {
      row.download_url = await buildSignedDownloadUrl(row.object_key, row.file_name);
    }
    res.json(row);
  } catch (err) {
    console.error("EXPORT FETCH ERROR:", err);
    res.status(500).json({ error: "Unable to load export." });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(
      `
      SELECT id, file_name, content, object_key, storage_provider
      FROM faculty_exports
      WHERE id = $1
      `,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Export not found." });
    }
    const row = result.rows[0];
    if (useB2 && row.storage_provider === "b2" && row.object_key) {
      const downloadUrl = await buildSignedDownloadUrl(row.object_key, row.file_name);
      return res.json({ download_url: downloadUrl });
    }
    return res.json({
      content: row.content || "",
      file_name: row.file_name,
    });
  } catch (err) {
    console.error("EXPORT DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Unable to download export." });
  }
});

module.exports = router;
