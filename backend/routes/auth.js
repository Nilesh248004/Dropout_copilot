const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "877119541780-lhrkbjv2kfb7ev8kmb1innnu7coifbs8.apps.googleusercontent.com";
const allowedRoles = new Set(["student", "faculty", "admin"]);

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeStudentId = (value) => (value || "").trim().toLowerCase();
const isValidMode = (value) => value === "signin" || value === "signup";

const getUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT id, email, role, auth_provider, password_hash, faculty_id, student_id FROM app_users WHERE email=$1",
    [email]
  );
  return result.rows[0];
};

const getStudentByRegisterNumber = async (studentId) => {
  if (!studentId) return null;
  const result = await pool.query(
    "SELECT id, register_number, faculty_id FROM students WHERE LOWER(register_number)=LOWER($1)",
    [studentId]
  );
  return result.rows[0];
};

// ================= SIGN UP (LOCAL) =================
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role, faculty_id, student_id } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedStudentId = normalizeStudentId(student_id);
    const roleFacultyId = role === "faculty" ? normalizedFacultyId : null;
    const roleStudentId = role === "student" ? normalizedStudentId : null;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password, and role are required" });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (role === "faculty" && !roleFacultyId) {
      return res.status(400).json({ error: "faculty_id is required for faculty signup" });
    }
    if (role === "student" && !roleStudentId) {
      return res.status(400).json({ error: "student_id is required for student signup" });
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await getUserByEmail(normalizedEmail);

    if (existing) {
      if (existing.role !== role) {
        return res.status(409).json({ error: `Email already registered as ${existing.role}` });
      }
      return res.status(409).json({ error: "Account already exists. Please sign in." });
    }
    if (role === "student") {
      const studentRecord = await getStudentByRegisterNumber(roleStudentId);
      if (!studentRecord) {
        return res.status(404).json({
          error: "Student ID not found. Ask your admin to add your record first.",
        });
      }
    }
    if (role === "student" && roleStudentId) {
      const studentMapped = await pool.query(
        "SELECT 1 FROM app_users WHERE student_id=$1",
        [roleStudentId]
      );
      if (studentMapped.rows.length > 0) {
        return res.status(409).json({ error: "Student ID already mapped to another account." });
      }
    }
    if (role === "faculty" && roleFacultyId) {
      const facultyMapped = await pool.query(
        "SELECT 1 FROM app_users WHERE faculty_id=$1",
        [roleFacultyId]
      );
      if (facultyMapped.rows.length > 0) {
        return res.status(409).json({ error: "Faculty ID already mapped to another account." });
      }
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO app_users (email, role, password_hash, auth_provider, faculty_id, student_id)
      VALUES ($1, $2, $3, 'local', $4, $5)
      `,
      [normalizedEmail, role, hash, roleFacultyId, roleStudentId]
    );

    res.json({
      email: normalizedEmail,
      role,
      faculty_id: roleFacultyId,
      student_id: roleStudentId,
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Sign up failed" });
  }
});

// ================= LOGIN (LOCAL) =================
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password, and role are required" });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(404).json({ error: "No account found. Please sign up." });
    }
    if (user.role !== role) {
      return res.status(403).json({ error: `This email is registered as ${user.role}` });
    }
    const needsFacultyId =
      role === "faculty" && !normalizeFacultyId(user.faculty_id);
    if (role === "student") {
      const storedStudentId = normalizeStudentId(user.student_id);
      if (!storedStudentId) {
        return res.status(403).json({ error: "Student ID is not mapped to this account." });
      }
      const studentRecord = await getStudentByRegisterNumber(storedStudentId);
      if (!studentRecord) {
        return res.status(404).json({ error: "Student record not found." });
      }
    }
    if (user.auth_provider !== "local") {
      return res.status(400).json({ error: "Use Google sign-in for this account." });
    }

    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Faculty IDs are mapped at signup only.

    res.json({
      email: user.email,
      role: user.role,
      faculty_id: user.faculty_id || null,
      student_id: user.student_id || null,
      needs_faculty_id: needsFacultyId,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ================= LINK FACULTY ID (RECOVERY) =================
router.post("/link-faculty", async (req, res) => {
  try {
    const { email, password, id_token, faculty_id } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);

    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }

    let normalizedEmail = normalizeEmail(email);
    let authProvider = "local";

    if (id_token) {
      authProvider = "google";
      try {
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: id_token,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        normalizedEmail = normalizeEmail(payload?.email);
      } catch (verifyError) {
        return res.status(401).json({
          error: "Invalid Google token",
          details: verifyError.message || "Token verification failed",
        });
      }
    }

    if (!normalizedEmail) {
      return res.status(400).json({ error: "email is required" });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }
    if (user.role !== "faculty") {
      return res.status(403).json({ error: "Only faculty accounts can link a faculty ID." });
    }
    if (normalizeFacultyId(user.faculty_id)) {
      return res.status(409).json({ error: "Faculty ID already linked." });
    }
    if (user.auth_provider !== authProvider) {
      return res.status(400).json({
        error:
          authProvider === "google"
            ? "Use password to link this account."
            : "Use Google to link this account.",
      });
    }

    if (authProvider === "local") {
      if (!password) {
        return res.status(400).json({ error: "password is required" });
      }
      const ok = await bcrypt.compare(password, user.password_hash || "");
      if (!ok) {
        return res.status(401).json({ error: "Invalid password" });
      }
    }

    const duplicate = await pool.query(
      "SELECT 1 FROM app_users WHERE LOWER(faculty_id)=LOWER($1)",
      [normalizedFacultyId]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: "Faculty ID already mapped to another account." });
    }

    await pool.query(
      "UPDATE app_users SET faculty_id=$1, updated_at=NOW() WHERE id=$2",
      [normalizedFacultyId, user.id]
    );

    res.json({
      email: user.email,
      role: user.role,
      faculty_id: normalizedFacultyId,
      student_id: user.student_id || null,
      needs_faculty_id: false,
    });
  } catch (err) {
    console.error("LINK FACULTY ERROR:", err);
    res.status(500).json({ error: "Link faculty ID failed" });
  }
});

// ================= GOOGLE SIGN-IN / SIGN-UP =================
router.post("/google", async (req, res) => {
  try {
    const { id_token, role, mode, faculty_id, student_id } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedStudentId = normalizeStudentId(student_id);
    const roleFacultyId = role === "faculty" ? normalizedFacultyId : null;
    const roleStudentId = role === "student" ? normalizedStudentId : null;

    if (!id_token || !role) {
      return res.status(400).json({ error: "id_token and role are required" });
    }
    if (!isValidMode(mode)) {
      return res.status(400).json({ error: "mode must be signin or signup" });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (role === "faculty" && mode === "signup" && !roleFacultyId) {
      return res.status(400).json({ error: "faculty_id is required for faculty signup" });
    }
    if (role === "student" && mode === "signup" && !roleStudentId) {
      return res.status(400).json({ error: "student_id is required for student signup" });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error("GOOGLE TOKEN VERIFY ERROR:", verifyError);
      return res.status(401).json({
        error: "Invalid Google token",
        details: verifyError.message || "Token verification failed",
      });
    }
    const normalizedEmail = normalizeEmail(payload?.email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    const user = await getUserByEmail(normalizedEmail);

    if (mode === "signin" && !user) {
      return res.status(404).json({ error: "No account found. Please sign up." });
    }

    if (user) {
      if (user.role !== role) {
        return res.status(403).json({ error: `This email is registered as ${user.role}` });
      }
      if (user.auth_provider !== "google") {
        return res.status(400).json({ error: "Use password sign-in for this account." });
      }
      const needsFacultyId =
        role === "faculty" && !normalizeFacultyId(user.faculty_id);
      if (role === "student") {
        const storedStudentId = normalizeStudentId(user.student_id);
        if (!storedStudentId) {
          return res.status(403).json({ error: "Student ID is not mapped to this account." });
        }
        const studentRecord = await getStudentByRegisterNumber(storedStudentId);
        if (!studentRecord) {
          return res.status(404).json({ error: "Student record not found." });
        }
      }
      return res.json({
        email: user.email,
        role: user.role,
        faculty_id: user.faculty_id || null,
        student_id: user.student_id || null,
        needs_faculty_id: needsFacultyId,
      });
    }

    if (role === "student" && roleStudentId) {
      const studentRecord = await getStudentByRegisterNumber(roleStudentId);
      if (!studentRecord) {
        return res.status(404).json({
          error: "Student ID not found. Ask your admin to add your record first.",
        });
      }
      const studentMapped = await pool.query(
        "SELECT 1 FROM app_users WHERE student_id=$1",
        [roleStudentId]
      );
      if (studentMapped.rows.length > 0) {
        return res.status(409).json({ error: "Student ID already mapped to another account." });
      }
    }
    if (role === "faculty" && roleFacultyId) {
      const facultyMapped = await pool.query(
        "SELECT 1 FROM app_users WHERE faculty_id=$1",
        [roleFacultyId]
      );
      if (facultyMapped.rows.length > 0) {
        return res.status(409).json({ error: "Faculty ID already mapped to another account." });
      }
    }

    await pool.query(
      `
      INSERT INTO app_users (email, role, auth_provider, faculty_id, student_id)
      VALUES ($1, $2, 'google', $3, $4)
      `,
      [normalizedEmail, role, roleFacultyId, roleStudentId]
    );

    res.json({
      email: normalizedEmail,
      role,
      faculty_id: roleFacultyId,
      student_id: roleStudentId,
    });
  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);
    res.status(500).json({
      error: "Google sign-in failed",
      details: err.message || "Unknown error",
    });
  }
});

module.exports = router;
