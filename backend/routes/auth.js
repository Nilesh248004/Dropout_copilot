const router = require("express").Router();
const pool = require("../db");
const axios = require("axios");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "877119541780-lhrkbjv2kfb7ev8kmb1innnu7coifbs8.apps.googleusercontent.com";
const RESET_CODE_TTL_MINUTES = Number.parseInt(
  process.env.RESET_CODE_TTL_MINUTES || "10",
  10
);
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "log").toLowerCase();
const SMS_PROVIDER = String(process.env.SMS_PROVIDER || "off").toLowerCase();
const allowedRoles = new Set(["student", "faculty", "admin"]);

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeStudentId = (value) => (value || "").trim().toLowerCase();
const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");
const normalizePhoneForSend = (value) => String(value || "").trim();
const isValidMode = (value) => value === "signin" || value === "signup";

const phoneMatches = (left, right) => {
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
};

const getUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT id, email, role, auth_provider, password_hash, faculty_id, student_id, phone_number FROM app_users WHERE email=$1",
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

const getStudentPhoneNumber = async (studentId) => {
  if (!studentId) return null;
  const result = await pool.query(
    "SELECT phone_number FROM students WHERE LOWER(register_number)=LOWER($1)",
    [studentId]
  );
  return result.rows[0]?.phone_number || null;
};

const getPhoneForUser = async (user) => {
  if (!user) return null;
  if (user.role === "student") {
    if (user.phone_number) return user.phone_number;
    return getStudentPhoneNumber(user.student_id);
  }
  return user.phone_number || null;
};

const ensureAuthResetSchema = async () => {
  await pool.query(
    "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone_number TEXT"
  );
  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      used_at TIMESTAMP
    )
    `
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_id ON password_reset_codes(user_id)"
  );
};

ensureAuthResetSchema().catch((err) => {
  console.error("AUTH RESET schema error:", err.message);
});

const sendSms = async ({ to, body }) => {
  const target = normalizePhoneForSend(to);
  if (!target) {
    throw new Error("Phone number is required.");
  }
  if (SMS_PROVIDER === "twilio") {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error("Twilio credentials are not configured.");
    }
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const payload = new URLSearchParams({
      To: target,
      From: TWILIO_FROM_NUMBER,
      Body: body,
    });
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      payload,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return;
  }
  if (SMS_PROVIDER === "log") {
    console.log(`[SMS][${target}] ${body}`);
    return;
  }
  throw new Error("SMS provider is not configured.");
};

const sendEmail = async ({ to, subject, text }) => {
  const target = normalizeEmail(to);
  if (!target) {
    throw new Error("Email address is required.");
  }
  if (EMAIL_PROVIDER === "smtp") {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM,
      SMTP_SECURE,
    } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      throw new Error("SMTP credentials are not configured.");
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE || "").toLowerCase() === "true" || Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: SMTP_FROM,
      to: target,
      subject,
      text,
    });
    return;
  }
  if (EMAIL_PROVIDER === "log") {
    console.log(`[EMAIL][${target}] ${subject}\n${text}`);
    return;
  }
  throw new Error("Email provider is not configured.");
};

const generateResetCode = () => String(crypto.randomInt(100000, 1000000));

// ================= SIGN UP (LOCAL) =================
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role, faculty_id, student_id, phone_number } = req.body;
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    const normalizedStudentId = normalizeStudentId(student_id);
    const roleFacultyId = role === "faculty" ? normalizedFacultyId : null;
    const roleStudentId = role === "student" ? normalizedStudentId : null;
    const normalizedPhone = normalizePhoneForSend(phone_number);

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
      INSERT INTO app_users (email, role, password_hash, auth_provider, faculty_id, student_id, phone_number)
      VALUES ($1, $2, $3, 'local', $4, $5, $6)
      `,
      [normalizedEmail, role, hash, roleFacultyId, roleStudentId, normalizedPhone || null]
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

// ================= FORGOT PASSWORD (SMS CODE) =================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, role, phone, delivery } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = String(role || "").toLowerCase();
    const method = String(delivery || (phone ? "sms" : "email")).toLowerCase();
    if (!normalizedEmail || !normalizedRole) {
      return res.status(400).json({ error: "email and role are required" });
    }
    if (!allowedRoles.has(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "No account found." });
    }
    if (user.role !== normalizedRole) {
      return res.status(403).json({ error: `This email is registered as ${user.role}` });
    }
    if (user.auth_provider !== "local") {
      return res.status(400).json({ error: "Use Google sign-in for this account." });
    }

    if (method === "sms") {
      if (!phone) {
        return res.status(400).json({ error: "phone is required for SMS delivery" });
      }
      const storedPhone = await getPhoneForUser(user);
      if (!storedPhone) {
        return res.status(400).json({ error: "Phone number is not linked to this account." });
      }
      if (!phoneMatches(storedPhone, phone)) {
        return res.status(403).json({ error: "Phone number does not match this account." });
      }
    } else if (method !== "email") {
      return res.status(400).json({ error: "delivery must be email or sms" });
    }

    const code = generateResetCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

    await pool.query("DELETE FROM password_reset_codes WHERE user_id = $1", [user.id]);
    await pool.query(
      `
      INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [user.id, codeHash, expiresAt]
    );

    if (method === "sms") {
      await sendSms({
        to: normalizePhoneForSend(phone),
        body: `Your Dropout Copilot reset code is ${code}. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`,
      });
    } else {
      await sendEmail({
        to: user.email,
        subject: "Your Dropout Copilot reset code",
        text: `Your Dropout Copilot reset code is ${code}. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`,
      });
    }

    res.json({ message: "Reset code sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err.message);
    res.status(500).json({ error: err.message || "Unable to send reset code." });
  }
});

// ================= RESET PASSWORD (VERIFY CODE) =================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, role, phone, code, new_password, delivery } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = String(role || "").toLowerCase();
    const method = String(delivery || (phone ? "sms" : "email")).toLowerCase();
    if (!normalizedEmail || !code || !new_password || !normalizedRole) {
      return res.status(400).json({ error: "email, role, code, and new_password are required" });
    }
    if (!allowedRoles.has(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "No account found." });
    }
    if (user.role !== normalizedRole) {
      return res.status(403).json({ error: `This email is registered as ${user.role}` });
    }
    if (user.auth_provider !== "local") {
      return res.status(400).json({ error: "Use Google sign-in for this account." });
    }

    if (method === "sms") {
      if (!phone) {
        return res.status(400).json({ error: "phone is required for SMS delivery" });
      }
      const storedPhone = await getPhoneForUser(user);
      if (!storedPhone) {
        return res.status(400).json({ error: "Phone number is not linked to this account." });
      }
      if (!phoneMatches(storedPhone, phone)) {
        return res.status(403).json({ error: "Phone number does not match this account." });
      }
    } else if (method !== "email") {
      return res.status(400).json({ error: "delivery must be email or sms" });
    }

    const codeResult = await pool.query(
      `
      SELECT id, code_hash, expires_at
      FROM password_reset_codes
      WHERE user_id = $1 AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );
    const record = codeResult.rows[0];
    if (!record) {
      return res.status(400).json({ error: "Reset code not found. Request a new one." });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: "Reset code has expired. Request a new one." });
    }

    const codeOk = await bcrypt.compare(String(code), record.code_hash || "");
    if (!codeOk) {
      return res.status(401).json({ error: "Invalid reset code." });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      "UPDATE app_users SET password_hash=$1, updated_at=NOW() WHERE id=$2",
      [hash, user.id]
    );
    await pool.query(
      "UPDATE password_reset_codes SET used_at=NOW() WHERE id=$1",
      [record.id]
    );

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err.message);
    res.status(500).json({ error: err.message || "Unable to reset password." });
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
