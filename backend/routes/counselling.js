// routes/counselling.js
const router = require("express").Router();
const pool = require("../db"); // PostgreSQL connection
const axios = require("axios");
const nodemailer = require("nodemailer");
let openaiClientPromise;

const getOpenAIClient = async () => {
  if (openaiClientPromise) return openaiClientPromise;
  openaiClientPromise = import("openai").then((module) => {
    const OpenAI = module.default || module;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  });
  return openaiClientPromise;
};

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:8787/mcp";
const MCP_SERVER_LABEL = process.env.MCP_SERVER_LABEL || "counselling";

const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const AI_CACHE_TTL_MS = Number.parseInt(
  process.env.COUNSELLING_AI_CACHE_TTL_MS || "900000",
  10
);
const aiCounsellingCache = new Map();

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toPercent = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num > 1 ? Math.round(num) : Math.round(num * 100);
};

const formatFacultyNameFromEmail = (email) => {
  const address = String(email || "").trim().toLowerCase();
  const localPart = address.split("@")[0] || "";
  const tokens = localPart
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!tokens.length) return "";
  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const sendEmail = async ({ to, subject, text }) => {
  const target = normalizeEmail(to);
  if (!target) {
    throw new Error("Email address is required.");
  }

  const provider = String(process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (provider === "brevo") {
    const { BREVO_API_KEY, BREVO_FROM, BREVO_FROM_NAME } = process.env;
    if (!BREVO_API_KEY || !BREVO_FROM) {
      throw new Error("Brevo credentials are not configured.");
    }
    try {
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: BREVO_FROM_NAME || "Dropout Copilot",
            email: BREVO_FROM,
          },
          to: [{ email: target }],
          subject,
          textContent: text,
        },
        {
          headers: {
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
          },
        }
      );
      return;
    } catch (err) {
      const details = err.response?.data?.message;
      throw new Error(details || err.message || "Brevo email failed.");
    }
  }

  if (provider === "resend") {
    const { RESEND_API_KEY, RESEND_FROM } = process.env;
    if (!RESEND_API_KEY || !RESEND_FROM) {
      throw new Error("Resend credentials are not configured.");
    }
    try {
      await axios.post(
        "https://api.resend.com/emails",
        {
          from: RESEND_FROM,
          to: [target],
          subject,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "content-type": "application/json",
          },
        }
      );
      return;
    } catch (err) {
      const details = err.response?.data?.message;
      throw new Error(details || err.message || "Resend email failed.");
    }
  }

  if (provider === "smtp") {
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

  if (provider === "log") {
    console.log(`[EMAIL][${target}] ${subject}\n${text}`);
    return;
  }

  throw new Error("Email provider is not configured.");
};

const resolveRiskLevel = (riskLevel, riskScore) => {
  const normalized = String(riskLevel || "").trim().toUpperCase();
  if (normalized) return normalized;
  if (riskScore === null) return "UNKNOWN";
  if (riskScore > 0.7) return "HIGH";
  if (riskScore > 0.4) return "MEDIUM";
  return "LOW";
};

const isHighOrMedium = (riskLevel) => ["HIGH", "MEDIUM"].includes(riskLevel);

const getTrend = (historyRows = []) => {
  if (!Array.isArray(historyRows) || historyRows.length < 2) {
    return { trend: "STABLE", delta: null };
  }
  const first = toNumber(historyRows[0]?.dropout_risk);
  const last = toNumber(historyRows[historyRows.length - 1]?.dropout_risk);
  if (first === null || last === null) return { trend: "STABLE", delta: null };
  const delta = Number(((last - first) * 100).toFixed(1));
  if (delta >= 5) return { trend: "RISING", delta };
  if (delta <= -5) return { trend: "IMPROVING", delta };
  return { trend: "STABLE", delta };
};

const buildRuleBasedCounselling = (payload) => {
  const {
    risk_level,
    risk_percent,
    risk_trend,
    attendance,
    cgpa,
    arrear_count,
    fees_paid,
    disciplinary_issues,
  } = payload;

  const level = String(risk_level || "UNKNOWN").toUpperCase();
  const riskPct = toNumber(risk_percent);
  const trend = String(risk_trend || "STABLE").toUpperCase();
  const hasPrediction = (level && level !== "UNKNOWN") || riskPct !== null;

  const isHigh = hasPrediction && (level === "HIGH" || (riskPct !== null && riskPct >= 70));
  const isMedium = hasPrediction && (level === "MEDIUM" || (riskPct !== null && riskPct >= 40));
  const urgency = !hasPrediction ? "PENDING" : isHigh ? "HIGH" : isMedium ? "MEDIUM" : "LOW";

  const recommendations = [];
  const questions = [];

  if (hasPrediction && trend === "RISING") {
    recommendations.push("Schedule a check-in with your faculty advisor within 7 days.");
    questions.push("Are there recent changes affecting your study routine?");
  }
  if (hasPrediction && attendance !== null && attendance < 75) {
    recommendations.push("Create an attendance recovery plan (target 80%+ this month).");
    questions.push("What are the main reasons behind missed classes?");
  }
  if (hasPrediction && cgpa !== null && cgpa < 6.5) {
    recommendations.push("Enroll in subject tutoring for your lowest-performing course.");
    questions.push("Which topics feel most challenging right now?");
  }
  if (hasPrediction && toNumber(arrear_count) > 0) {
    recommendations.push("Prioritize clearing arrears with a weekly study schedule.");
    questions.push("Which arrear subject needs the most support?");
  }
  if (hasPrediction && fees_paid === false) {
    recommendations.push("Contact the finance office for a payment plan or fee support.");
    questions.push("Do you need help connecting with the finance team?");
  }
  if (hasPrediction && toNumber(disciplinary_issues) > 0) {
    recommendations.push("Book a wellbeing session to discuss support strategies.");
    questions.push("Would you like help with behavioural or personal support resources?");
  }

  if (!hasPrediction) {
    recommendations.push("Request a new prediction to unlock personalized guidance.");
    questions.push("Would you like help requesting a prediction from your faculty?");
  } else if (recommendations.length === 0) {
    recommendations.push("Maintain your current study routine and review progress monthly.");
    questions.push("Is there any area where you’d like extra guidance?");
  }

  const summary = !hasPrediction
    ? "Prediction not available yet. Run a prediction to generate personalized guidance."
    : isHigh
      ? "Risk is high. Immediate support and a structured plan are recommended."
      : isMedium
        ? "Risk is moderate. Focus on consistent attendance and study habits."
        : "Risk appears low. Continue steady progress and monitor monthly.";

  const supportMessage = !hasPrediction
    ? "Once a prediction is generated, your guidance will appear here."
    : isHigh
      ? "You’re not alone — support is available. Let’s build a recovery plan together."
      : isMedium
        ? "You’re close to a strong track. A few adjustments can make a big difference."
        : "Great momentum. Keep it steady and ask for help early if needed.";

  return {
    summary,
    urgency,
    recommendations,
    support_message: supportMessage,
    follow_up_questions: questions.slice(0, 3),
  };
};

const buildRuleBasedChatResponse = (payload, question) => {
  const base = buildRuleBasedCounselling(payload);
  const q = String(question || "").toLowerCase();
  const attendance = toNumber(payload.attendance);
  const cgpa = toNumber(payload.cgpa);
  const riskPercent = toNumber(payload.risk_percent);

  let focus = "";
  if (q.includes("attendance")) {
    focus = Number.isFinite(attendance)
      ? `Your attendance is ${attendance}%. Aim for 80%+ to stay on track.`
      : "Attendance data is not available yet. Ask your faculty to update it.";
  } else if (q.includes("cgpa") || q.includes("gpa")) {
    focus = Number.isFinite(cgpa)
      ? `Your CGPA is ${cgpa}. Focus on your lowest-performing subjects first.`
      : "CGPA data is not available yet. Ask your faculty to update it.";
  } else if (q.includes("risk") || q.includes("dropout")) {
    focus = Number.isFinite(riskPercent)
      ? `Your current dropout risk is ${riskPercent}%. Lets focus on attendance and study habits.`
      : "Risk data is not available yet. Request a prediction from your faculty.";
  } else if (q.includes("fees")) {
    focus = "If fees are a concern, contact the finance office to explore payment plans.";
  } else if (q.includes("arrear") || q.includes("backlog")) {
    focus = "Prioritize clearing arrears with a weekly study schedule and targeted tutoring.";
  } else if (q.includes("discipline") || q.includes("behav")) {
    focus = "Consider a wellbeing session to address behavioral or personal support needs.";
  } else if (q.includes("stress") || q.includes("anxiety") || q.includes("mental")) {
    focus = "Its okay to ask for help. Reach out to a counselor or trusted faculty member.";
  }

  const reply = [
    base.summary,
    focus,
    base.support_message,
  ].filter(Boolean).join(" ");

  return {
    reply,
    recommendations: base.recommendations,
    follow_up_questions: base.follow_up_questions,
    urgency: base.urgency,
  };
};

const formatValue = (value, fallback = "unknown") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatBoolean = (value) => {
  if (value === null || value === undefined) return "unknown";
  return value ? "yes" : "no";
};

const buildChatContext = (payload) => {
  const attendance = Number.isFinite(payload.attendance) ? `${payload.attendance}%` : "unknown";
  const cgpa = Number.isFinite(payload.cgpa) ? String(payload.cgpa) : "unknown";
  const arrears = Number.isFinite(payload.arrear_count)
    ? String(payload.arrear_count)
    : "unknown";
  const riskPercent = Number.isFinite(payload.risk_percent)
    ? `${payload.risk_percent}%`
    : "unknown";
  const trendDelta = Number.isFinite(payload.trend_delta)
    ? `${payload.trend_delta}%`
    : "unknown";

  return [
    `risk_level: ${formatValue(payload.risk_level, "UNKNOWN")}`,
    `risk_percent: ${riskPercent}`,
    `risk_trend: ${formatValue(payload.risk_trend, "UNKNOWN")}`,
    `trend_delta: ${trendDelta}`,
    `attendance: ${attendance}`,
    `cgpa: ${cgpa}`,
    `arrear_count: ${arrears}`,
    `fees_paid: ${formatBoolean(payload.fees_paid)}`,
    `disciplinary_issues: ${formatValue(payload.disciplinary_issues)}`,
    `last_prediction_at: ${formatValue(payload.last_prediction_at)}`,
    `year: ${formatValue(payload.context?.year)}`,
    `semester: ${formatValue(payload.context?.semester)}`,
  ].join("\n");
};

const buildExplanationSystemPrompt = (safeContext) =>
  "You are a student success counsellor. Provide an empathetic explanation only. " +
  "Do not give recommendations, action steps, or questions. Do not use bullet points. " +
  "Use the student context provided. If data is missing, say so plainly. " +
  "Answer in 3-4 sentences." +
  `\n\nStudent context:\n${safeContext}`;

const normalizeBaseUrl = (value) => String(value || "").replace(/\/$/, "");

const streamOllamaExplanation = async ({ systemPrompt, question, onToken }) => {
  const url = `${normalizeBaseUrl(OLLAMA_BASE_URL)}/api/generate`;
  const prompt = `${systemPrompt}\n\nQuestion: ${question}`;
  const response = await axios.post(
    url,
    { model: OLLAMA_MODEL, prompt, stream: true },
    { responseType: "stream" }
  );

  const stream = response.data;

  const done = new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      stream.removeListener("data", onData);
      stream.removeListener("error", onError);
      stream.removeListener("end", onEnd);
    };

    const onData = (chunk) => {
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
        if (data?.response) {
          onToken(String(data.response));
        }
        if (data?.done) {
          cleanup();
          resolve();
        }
      }
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    stream.on("data", onData);
    stream.on("error", onError);
    stream.on("end", onEnd);
  });

  return { stream, done };
};
const buildMcpHeaders = (apiKey) => ({
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

const parseMcpResponse = (payload) => {
  if (!payload) return null;
  const data = Array.isArray(payload) ? payload[0] : payload;
  if (!data) return null;
  if (data.error) {
    const message = data.error?.message || "MCP error";
    throw new Error(message);
  }
  return data.result ?? data.toolResult ?? data;
};

const callMcpTool = async ({ toolName, args, timeoutMs }) => {
  const enabled = String(process.env.MCP_ENABLED || "").toLowerCase() === "true";
  const mcpUrl = process.env.MCP_URL || process.env.MCP_SERVER_URL;
  if (!enabled || !mcpUrl) return null;

  const apiKey = process.env.MCP_API_KEY;
  const headers = buildMcpHeaders(apiKey);
  const requestPayload = {
    jsonrpc: "2.0",
    id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args || {},
    },
  };

  const startedAt = Date.now();
  const response = await axios.post(mcpUrl, requestPayload, {
    headers,
    timeout: timeoutMs || 15000,
  });
  const durationMs = Date.now() - startedAt;
  const rawData = response.data || null;
  const data = parseMcpResponse(rawData);
  const sizeBytes = JSON.stringify(rawData || {}).length;
  return {
    data,
    meta: {
      latency_ms: durationMs,
      response_bytes: sizeBytes,
    },
  };
};

const callMcpChat = async ({ student_id, question, chat_history }) => {
  try {
    return await callMcpTool({
      toolName: "counselling_chat",
      args: { student_id, question, chat_history },
    });
  } catch (err) {
    console.error("❌ MCP Chat Error:", err.message);
    return null;
  }
};

const callMcpCounselling = async (payload) => {
  try {
    const result = await callMcpTool({
      toolName: "counselling_generate",
      args: payload,
    });
    const usage = result?.data?.usage || result?.data?.token_usage || null;
    const sizeBytes = JSON.stringify(result?.data || {}).length;
    if (result?.meta) {
      console.log(
        `🧠 MCP counselling duration_ms=${result.meta.latency_ms} size_bytes=${sizeBytes}${
          usage ? ` usage=${JSON.stringify(usage)}` : ""
        }`
      );
    }
    return result
      ? {
          data: result.data,
          meta: {
            ...result.meta,
            response_bytes: sizeBytes,
            usage,
          },
        }
      : null;
  } catch (err) {
    console.error("❌ MCP Counselling Error:", err.message);
    return null;
  }
};

const getCachedCounselling = (studentId) => {
  const key = String(studentId);
  const entry = aiCounsellingCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    aiCounsellingCache.delete(key);
    return null;
  }
  return entry;
};

const setCachedCounselling = (studentId, data) => {
  const key = String(studentId);
  const createdAt = Date.now();
  aiCounsellingCache.set(key, {
    data,
    createdAt,
    expiresAt: createdAt + AI_CACHE_TTL_MS,
  });
};

// ================= BOOK COUNSELLING REQUEST =================
router.post("/book", async (req, res) => {
  try {
    const { student_id, reason, faculty_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: "student_id is required" });
    }
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }

    const studentResult = await pool.query(
      "SELECT year, faculty_id FROM students WHERE id=$1",
      [student_id]
    );
    if (!studentResult.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }
    const studentFacultyId = normalizeFacultyId(studentResult.rows[0].faculty_id);
    if (studentFacultyId && studentFacultyId !== normalizedFacultyId) {
      return res.status(403).json({ error: "Faculty ID does not match student's mapped faculty." });
    }
    const facultyLabel = String(normalizedFacultyId);

    // Prevent duplicate open requests
    const existing = await pool.query(
      "SELECT * FROM counselling_requests WHERE student_id=$1 AND status IN ('PENDING','SCHEDULED')",
      [student_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Counselling already requested" });
    }

    await pool.query(
      `
      INSERT INTO counselling_requests (student_id, reason, status, request_date, faculty_label, faculty_id)
      VALUES ($1, $2, 'PENDING', NOW(), $3, $4)
      `,
      [student_id, reason || "High dropout risk", facultyLabel, normalizedFacultyId]
    );

    console.log("📥 Counselling booked for student:", student_id);
    res.json({ message: "Counselling booked successfully", faculty_label: facultyLabel });

  } catch (err) {
    console.error("❌ Counselling Book Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= ASSIGN COUNSELLING SESSION =================
router.post("/assign", async (req, res) => {
  try {
    const {
      student_id,
      faculty_id,
      scheduled_at,
      meet_link,
      classroom,
      reason,
      counselling_mode,
      scheduled_at_local,
    } = req.body;

    const id = Number(student_id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "student_id is required" });
    }
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    if (!normalizedFacultyId) {
      return res.status(400).json({ error: "faculty_id is required" });
    }
    const trimmedLink = String(meet_link || "").trim();
    const trimmedClassroom = String(classroom || "").trim();
    const scheduledAt = scheduled_at ? new Date(scheduled_at) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: "scheduled_at is required" });
    }

    const studentResult = await pool.query(
      `
      SELECT s.id, s.faculty_id,
             a.dropout_risk AS risk_score,
             p.risk_level
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      WHERE s.id = $1
      `,
      [id]
    );
    if (!studentResult.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }
    const student = studentResult.rows[0];
    const studentFacultyId = normalizeFacultyId(student.faculty_id);
    if (studentFacultyId && studentFacultyId !== normalizedFacultyId) {
      return res.status(403).json({ error: "Faculty ID does not match student's mapped faculty." });
    }

    const riskScore = toNumber(student.risk_score);
    const resolvedRisk = resolveRiskLevel(student.risk_level, riskScore);
    if (!isHighOrMedium(resolvedRisk)) {
      return res.status(400).json({
        error: "Counselling can only be assigned for high or medium risk students.",
      });
    }
    const requestedMode = String(counselling_mode || "").trim().toUpperCase();
    const hasRequestedMode = requestedMode === "ONLINE" || requestedMode === "OFFLINE";
    const inferredMode = trimmedClassroom ? "OFFLINE" : trimmedLink ? "ONLINE" : null;
    const counsellingMode = hasRequestedMode
      ? requestedMode
      : inferredMode || (resolvedRisk === "HIGH" ? "OFFLINE" : "ONLINE");
    if (counsellingMode === "ONLINE" && !trimmedLink) {
      return res.status(400).json({ error: "meet_link is required for online counselling." });
    }
    if (counsellingMode === "OFFLINE" && !trimmedClassroom) {
      return res.status(400).json({ error: "classroom is required for offline counselling." });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM counselling_requests
      WHERE student_id = $1 AND status IN ('PENDING', 'SCHEDULED')
      ORDER BY request_date DESC
      LIMIT 1
      `,
      [id]
    );

    const facultyLabel = String(normalizedFacultyId);
    const safeReason = String(reason || "").trim() || "Faculty assigned counselling";
    let result;

    if (existing.rows.length > 0) {
      const requestId = existing.rows[0].id;
      result = await pool.query(
        `
        UPDATE counselling_requests
        SET status = 'SCHEDULED',
            scheduled_at = $1::timestamptz,
            meet_link = $2,
            classroom = $3,
            counselling_mode = $4,
            reason = $5,
            faculty_label = $6,
            faculty_id = $7,
            scheduled_local = $8
        WHERE id = $9
        RETURNING id, student_id, status, scheduled_at, scheduled_local, meet_link, classroom, counselling_mode, request_date, faculty_label
        `,
        [
          scheduledAt.toISOString(),
          counsellingMode === "ONLINE" ? trimmedLink : null,
          counsellingMode === "OFFLINE" ? trimmedClassroom : null,
          counsellingMode,
          safeReason,
          facultyLabel,
          normalizedFacultyId,
          scheduled_at_local || scheduled_at || null,
          requestId,
        ]
      );
    } else {
      result = await pool.query(
        `
        INSERT INTO counselling_requests (
          student_id,
          reason,
          status,
          request_date,
          faculty_label,
          faculty_id,
          scheduled_at,
          scheduled_local,
          meet_link,
          classroom,
          counselling_mode
        )
        VALUES ($1, $2, 'SCHEDULED', NOW(), $3, $4, $5::timestamptz, $6, $7, $8, $9)
        RETURNING id, student_id, status, scheduled_at, scheduled_local, meet_link, classroom, counselling_mode, request_date, faculty_label
        `,
        [
          id,
          safeReason,
          facultyLabel,
          normalizedFacultyId,
          scheduledAt.toISOString(),
          scheduled_at_local || scheduled_at || null,
          counsellingMode === "ONLINE" ? trimmedLink : null,
          counsellingMode === "OFFLINE" ? trimmedClassroom : null,
          counsellingMode,
        ]
      );
    }

    const scheduled = result.rows[0] || {};
    try {
      const emailResult = await pool.query(
        `
        SELECT u.email, s.name, s.register_number
        FROM students s
        JOIN app_users u
          ON LOWER(u.student_id) = LOWER(s.register_number)
        WHERE s.id = $1 AND u.role = 'student'
        LIMIT 1
        `,
        [id]
      );
      if (emailResult.rows.length) {
        const student = emailResult.rows[0];
        const when = scheduled.scheduled_at
          ? new Date(scheduled.scheduled_at).toLocaleString()
          : "scheduled time";
        const mode = scheduled.counselling_mode || counsellingMode;
        const facultyEmailResult = await pool.query(
          `
          SELECT email
          FROM app_users
          WHERE role = 'faculty'
            AND LOWER(TRIM(faculty_id)) = LOWER(TRIM($1))
          LIMIT 1
          `,
          [normalizedFacultyId]
        );
        const facultyEmail = facultyEmailResult.rows[0]?.email || "";
        const extractedName = formatFacultyNameFromEmail(facultyEmail);
        const facultyIdLabel = String(
          facultyLabel || normalizedFacultyId || ""
        ).trim();
        const facultyName =
          extractedName ||
          String(scheduled.faculty_label || facultyLabel || normalizedFacultyId || "Faculty");
        const regardsLine = facultyIdLabel ? `${facultyName} (${facultyIdLabel})` : facultyName;
        const location =
          mode === "OFFLINE"
            ? `Classroom: ${scheduled.classroom || trimmedClassroom}`
            : `Meet link: ${scheduled.meet_link || trimmedLink}`;
        await sendEmail({
          to: student.email,
          subject: "Counselling session scheduled",
          text:
            `Hi ${student.name || "Student"},\n\n` +
            `Your counselling session has been scheduled.\n` +
            `Mode: ${mode}\n` +
            `When: ${when}\n` +
            `${location}\n\n` +
            `Regards,\n${regardsLine}`,
        });
      }
    } catch (err) {
      console.error("❌ Counselling email error:", err.message);
    }

    res.json({
      message: "Counselling session scheduled",
      ...scheduled,
      scheduled_local: scheduled.scheduled_local || scheduled_at_local || scheduled.scheduled_at,
    });
  } catch (err) {
    console.error("❌ Assign Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ALL COUNSELLING REQUESTS =================
router.get("/", async (req, res) => {
  try {
    const { faculty_id, student_id, status } = req.query;
    const params = [];
    const conditions = [];

    if (faculty_id) {
      params.push(normalizeFacultyId(faculty_id));
      conditions.push(`LOWER(TRIM(c.faculty_id)) = $${params.length}`);
    }
    if (student_id) {
      params.push(Number(student_id));
      conditions.push(`c.student_id = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim().toUpperCase());
      conditions.push(`c.status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT c.*, s.name, s.register_number, s.faculty_id AS student_faculty_id
      FROM counselling_requests c
      JOIN students s ON s.id = c.student_id
      ${whereClause}
      ${whereClause ? "AND" : "WHERE"} LOWER(TRIM(s.faculty_id)) = LOWER(TRIM(c.faculty_id))
      ORDER BY c.request_date DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE COUNSELLING STATUS =================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const nextStatus = String(status || "").trim().toUpperCase();
    const allowed = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      "UPDATE counselling_requests SET status=$1 WHERE id=$2",
      [nextStatus, id]
    );

    res.json({ message: "Status updated" });
  } catch (err) {
    console.error("❌ Update Status Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE COUNSELLING REQUEST =================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM counselling_requests WHERE id=$1", [id]);

    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("❌ Delete Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= AI COUNSELLING INSIGHTS =================
router.post("/ai", async (req, res) => {
  try {
    const { student_id, force } = req.body;
    const id = Number(student_id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "student_id is required" });
    }
    if (!force) {
      const cached = getCachedCounselling(id);
      if (cached) {
        return res.json({
          ...cached.data,
          metadata: {
            ...(cached.data?.metadata || {}),
            cache: "hit",
            cached_at: new Date(cached.createdAt).toISOString(),
          },
        });
      }
    }

    const studentResult = await pool.query(
      `
      SELECT s.id, s.name, s.register_number, s.year, s.semester, s.faculty_id,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid, a.disciplinary_issues,
             a.dropout_risk AS risk_score,
             a.dropout_flag AS dropout_prediction,
             p.risk_level,
             p.prediction_date
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      WHERE s.id = $1
      `,
      [id]
    );

    if (!studentResult.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    const historyResult = await pool.query(
      `
      SELECT dropout_risk, risk_level, predicted_at
      FROM prediction_history
      WHERE student_id = $1
      ORDER BY predicted_at ASC
      `,
      [id]
    );

    const student = studentResult.rows[0];
    const historyRows = historyResult.rows || [];
    const lastHistory = historyRows[historyRows.length - 1] || null;
    const riskScore = student.risk_score ?? lastHistory?.dropout_risk ?? null;
    const riskLevel = student.risk_level ?? lastHistory?.risk_level ?? null;
    const riskPercent = toPercent(riskScore);
    const { trend, delta } = getTrend(historyRows);
    const lastPredictionAt = student.prediction_date || lastHistory?.predicted_at || null;

    const payload = {
      student_id: student.id,
      risk_level: riskLevel,
      risk_percent: riskPercent,
      risk_trend: trend,
      trend_delta: delta,
      attendance: toNumber(student.attendance),
      cgpa: toNumber(student.cgpa),
      arrear_count: toNumber(student.arrear_count),
      fees_paid: student.fees_paid,
      disciplinary_issues: toNumber(student.disciplinary_issues),
      last_prediction_at: lastPredictionAt,
      context: {
        year: student.year,
        semester: student.semester,
        faculty_id: student.faculty_id,
      },
    };

    const mcpResult = await callMcpCounselling(payload);
    const mcpResponse = mcpResult?.data || null;
    const mcpStructured =
      mcpResponse?.structuredContent || mcpResponse?.structured_content || null;
    const baseInsights = buildRuleBasedCounselling(payload);

    const response = {
      ...baseInsights,
      ...(mcpStructured && typeof mcpStructured === "object" ? mcpStructured : {}),
      metadata: {
        generated_at: new Date().toISOString(),
        source: mcpStructured ? "mcp" : "rule",
        cache: "miss",
        ...(mcpResult?.meta ? { mcp: mcpResult.meta } : {}),
      },
    };

    setCachedCounselling(id, response);
    res.json(response);
  } catch (err) {
    console.error("❌ AI Counselling Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/stream", async (req, res) => {
  let upstream = null;
  let ended = false;

  const closeUpstream = () => {
    if (upstream && !upstream.destroyed) {
      upstream.destroy();
    }
  };

  const finish = () => {
    if (ended) return;
    ended = true;
    res.end();
  };

  req.on("close", () => {
    closeUpstream();
  });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const send = (payload) => {
    if (res.writableEnded) return;
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    const { student_id, question } = req.body;
    const id = Number(student_id);
    const prompt = String(question || "").trim();

    if (!Number.isInteger(id)) {
      send({ error: "student_id is required" });
      return finish();
    }
    if (!prompt) {
      send({ error: "question is required" });
      return finish();
    }

    const enabled = String(process.env.MCP_ENABLED || "").toLowerCase() === "true";
    const mcpUrl = process.env.MCP_URL || process.env.MCP_SERVER_URL || MCP_SERVER_URL;
    if (!enabled || !mcpUrl) {
      send({ error: "MCP streaming is disabled." });
      return finish();
    }

    const apiKey = process.env.MCP_API_KEY;
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const streamUrl = `${normalizeBaseUrl(mcpUrl)}/chat/stream`;

    const response = await axios.post(
      streamUrl,
      { student_id: id, question: prompt },
      { headers, responseType: "stream", timeout: 30000 }
    );

    upstream = response.data;
    let buffer = "";

    upstream.on("data", (chunk) => {
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
          send({ token: data.token });
        }
        if (data?.error) {
          send({ error: data.error });
          closeUpstream();
          return finish();
        }
        if (data?.done) {
          send({ done: true });
          closeUpstream();
          return finish();
        }
      }
    });

    upstream.on("error", (err) => {
      send({ error: err.message || "Streaming failed" });
      finish();
    });

    upstream.on("end", () => {
      send({ done: true });
      finish();
    });
  } catch (err) {
    send({ error: err.message || "Streaming failed" });
    finish();
  } finally {
    if (ended) {
      closeUpstream();
    }
  }
});
// ================= AI COUNSELLING CHAT =================
router.post("/chat", async (req, res) => {
  try {
    const { student_id, question } = req.body;
    const id = Number(student_id);
    const prompt = String(question || "").trim();

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "student_id is required" });
    }
    if (!prompt) {
      return res.status(400).json({ error: "question is required" });
    }

    const studentResult = await pool.query(
      `
      SELECT s.id, s.name, s.register_number, s.year, s.semester, s.faculty_id,
             a.attendance, a.cgpa, a.arrear_count, a.fees_paid, a.disciplinary_issues,
             a.dropout_risk AS risk_score,
             a.dropout_flag AS dropout_prediction,
             p.risk_level,
             p.prediction_date
      FROM students s
      LEFT JOIN academic_records a ON s.id = a.student_id
      LEFT JOIN predictions p ON s.id = p.student_id
      WHERE s.id = $1
      `,
      [id]
    );

    if (!studentResult.rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    const historyResult = await pool.query(
      `
      SELECT dropout_risk, risk_level, predicted_at
      FROM prediction_history
      WHERE student_id = $1
      ORDER BY predicted_at ASC
      `,
      [id]
    );

    const student = studentResult.rows[0];
    const historyRows = historyResult.rows || [];
    const lastHistory = historyRows[historyRows.length - 1] || null;
    const riskScore = student.risk_score ?? lastHistory?.dropout_risk ?? null;
    const riskLevel = student.risk_level ?? lastHistory?.risk_level ?? null;
    const riskPercent = toPercent(riskScore);
    const { trend, delta } = getTrend(historyRows);
    const lastPredictionAt = student.prediction_date || lastHistory?.predicted_at || null;

    const payload = {
      student_id: student.id,
      risk_level: riskLevel,
      risk_percent: riskPercent,
      risk_trend: trend,
      trend_delta: delta,
      attendance: toNumber(student.attendance),
      cgpa: toNumber(student.cgpa),
      arrear_count: toNumber(student.arrear_count),
      fees_paid: student.fees_paid,
      disciplinary_issues: toNumber(student.disciplinary_issues),
      last_prediction_at: lastPredictionAt,
      user_question: prompt,
      context: {
        year: student.year,
        semester: student.semester,
        faculty_id: student.faculty_id,
      },
    };

    let reply = null;
    let recommendations = null;
    let follow_up_questions = null;
    let urgency = null;
    let source = "rule";
    let meta = null;

    const mcpChatResult = await callMcpChat({
      student_id: id,
      question: prompt,
    });
    const mcpData = mcpChatResult?.data || null;
    const structured = mcpData?.structuredContent || mcpData?.structured_content || null;
    const mcpReply =
      structured?.reply ||
      mcpData?.content?.[0]?.text ||
      "";

    if (mcpReply) {
      reply = String(mcpReply).trim();
      recommendations = structured?.recommendations || null;
      follow_up_questions = structured?.follow_up_questions || null;
      urgency = structured?.urgency || null;
      source = structured?.metadata?.source
        ? `mcp_${structured.metadata.source}`
        : "mcp";
      meta = structured?.metadata || mcpChatResult?.meta || null;
    }

    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
    if (!reply && hasOpenAIKey) {
      try {
        const client = await getOpenAIClient();
        const context = buildChatContext(payload);
        const safeContext = context.replace(/[\u0000-\u001F]/g, "");
        const response = await client.responses.create({
          model: OPENAI_MODEL,
          temperature: 0.4,
          max_output_tokens: 260,
          input: [
            {
              role: "system",
              content:
                "You are a student success counsellor. Provide an empathetic explanation only. " +
                "Do not give recommendations, action steps, or questions. Do not use bullet points. " +
                "Use the student context provided. If data is missing, say so plainly. " +
                "Answer in 3-4 sentences." +
                `\n\nStudent context:\n${safeContext}`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        reply =
          response.output_text?.trim?.() ||
          response.output?.[0]?.content?.[0]?.text?.trim?.() ||
          "";
        if (reply) {
          source = "openai";
        }
      } catch (err) {
        console.error("OpenAI chat error:", err.message);
        meta = { error: err.message };
      }
    }

    if (!reply) {
      const rule = buildRuleBasedChatResponse(payload, prompt);
      reply = rule.reply;
      recommendations = rule.recommendations;
      follow_up_questions = rule.follow_up_questions;
      urgency = rule.urgency;
    }

    res.json({
      reply,
      recommendations,
      follow_up_questions,
      urgency,
      metadata: {
        generated_at: new Date().toISOString(),
        source,
        ...(meta ? { mcp: meta } : {}),
      },
    });
  } catch (err) {
    console.error("❌ Counselling Chat Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;



