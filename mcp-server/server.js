import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Pool } from "pg";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local MCP env first, then merge backend env for shared secrets.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../backend/.env"), override: false });

const MCP_PORT = Number(process.env.MCP_PORT || process.env.PORT || 8787);
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const LLM_PROVIDER = String(process.env.LLM_PROVIDER || "openai").toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const XAI_BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-2-latest";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "";
const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "local-model";

let openaiClient;
const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

let xaiClient;
const getXaiClient = () => {
  if (!xaiClient) {
    xaiClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: XAI_BASE_URL,
    });
  }
  return xaiClient;
};

let groqClient;
const getGroqClient = () => {
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: GROQ_BASE_URL,
    });
  }
  return groqClient;
};

const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.DB_SSL === "1" ||
  (process.env.DATABASE_URL || "").includes("sslmode=");

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "dropout_copilot",
    };

if (useSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toPercent = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num > 1 ? Math.round(num) : Math.round(num * 100);
};

const formatValue = (value, fallback = "unknown") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatBoolean = (value) => {
  if (value === null || value === undefined) return "unknown";
  return value ? "yes" : "no";
};

const getTrend = (historyRows = []) => {
  if (!Array.isArray(historyRows) || historyRows.length < 2) {
    return { trend: "STABLE", delta: null };
  }
  const first = toNumber(historyRows[0]?.dropout_risk);
  const last = toNumber(historyRows[historyRows.length - 1]?.dropout_risk);
  if (first === null || last === null) return { trend: "STABLE", delta: null };
  const delta = Number((last - first).toFixed(1));
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
    questions.push("Is there any area where you would like extra guidance?");
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
      ? "Support is available. Lets build a recovery plan together."
      : isMedium
        ? "You are close to a strong track. A few adjustments can make a big difference."
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
    focus = "It is okay to ask for help. Reach out to a counselor or trusted faculty member.";
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

const buildChatContext = (payload, baseInsights) => {
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
    `name: ${formatValue(payload.name)}`,
    `register_number: ${formatValue(payload.register_number)}`,
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
    `summary: ${formatValue(baseInsights?.summary)}`,
    `recommendations: ${Array.isArray(baseInsights?.recommendations)
      ? baseInsights.recommendations.join("; ")
      : "none"}`,
  ].join("\n");
};

const normalizeBaseUrl = (value) => String(value || "").replace(/\/$/, "");

const ensureFetch = () => {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Use Node 18+ or install a fetch polyfill.");
  }
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON payload."));
      }
    });
    req.on("error", reject);
  });

const buildExplanationSystemPrompt = (safeContext) =>
  "You are a student success counsellor. Provide an empathetic explanation only. " +
  "Do not give recommendations, action steps, or questions. Do not use bullet points. " +
  "Use the student context provided. If data is missing, say so plainly. " +
  "Answer in 3-4 sentences." +
  `\n\nStudent context:\n${safeContext}`;

const callOllamaExplanation = async ({ systemPrompt, question }) => {
  ensureFetch();
  const url = `${normalizeBaseUrl(OLLAMA_BASE_URL)}/api/generate`;
  const prompt = `${systemPrompt}\n\nQuestion: ${question}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }
  const data = await response.json();
  return String(data?.response || "").trim();
};

const streamOllamaExplanation = async ({ systemPrompt, question, onToken, signal }) => {
  ensureFetch();
  const url = `${normalizeBaseUrl(OLLAMA_BASE_URL)}/api/generate`;
  const prompt = `${systemPrompt}\n\nQuestion: ${question}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: true,
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Ollama stream unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
        return;
      }
    }
  }
};

const callLmStudioExplanation = async ({ systemPrompt, question, history }) => {
  ensureFetch();
  const url = `${normalizeBaseUrl(LMSTUDIO_BASE_URL)}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LMSTUDIO_MODEL,
      temperature: 0.4,
      max_tokens: 260,
      messages: [
        { role: "system", content: systemPrompt },
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: question },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`LM Studio HTTP ${response.status}`);
  }
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "").trim();
};

const callGrokExplanation = async ({ systemPrompt, question, history }) => {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is missing.");
  }
  const client = getXaiClient();
  const response = await client.chat.completions.create({
    model: XAI_MODEL,
    temperature: 0.4,
    max_tokens: 260,
    messages: [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: question },
    ],
  });
  return String(response?.choices?.[0]?.message?.content || "").trim();
};

const callGroqExplanation = async ({ systemPrompt, question, history }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }
  if (!GROQ_BASE_URL) {
    throw new Error("GROQ_BASE_URL is missing.");
  }
  if (!GROQ_MODEL) {
    throw new Error("GROQ_MODEL is missing.");
  }
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.4,
    max_tokens: 260,
    messages: [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: question },
    ],
  });
  return String(response?.choices?.[0]?.message?.content || "").trim();
};

const streamGrokExplanation = async ({
  systemPrompt,
  question,
  history,
  onToken,
  signal,
}) => {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is missing.");
  }
  const client = getXaiClient();
  const stream = await client.chat.completions.create({
    model: XAI_MODEL,
    temperature: 0.4,
    max_tokens: 260,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: question },
    ],
    ...(signal ? { signal } : {}),
  });

  for await (const chunk of stream) {
    const token = chunk?.choices?.[0]?.delta?.content;
    if (token) {
      onToken(String(token));
    }
  }
};

const streamGroqExplanation = async ({
  systemPrompt,
  question,
  history,
  onToken,
}) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }
  if (!GROQ_BASE_URL) {
    throw new Error("GROQ_BASE_URL is missing.");
  }
  if (!GROQ_MODEL) {
    throw new Error("GROQ_MODEL is missing.");
  }
  const client = getGroqClient();
  const stream = await client.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.4,
    max_tokens: 260,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: question },
    ],
  });

  for await (const chunk of stream) {
    const token = chunk?.choices?.[0]?.delta?.content;
    if (token) {
      onToken(String(token));
    }
  }
};

const fetchStudentPayload = async (studentId) => {
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
    LEFT JOIN LATERAL (
      SELECT *
      FROM predictions
      WHERE student_id = s.id
      ORDER BY prediction_date DESC
      LIMIT 1
    ) p ON true
    WHERE s.id = $1
    `,
    [studentId]
  );

  if (!studentResult.rows.length) {
    return null;
  }

  const historyResult = await pool.query(
    `
    SELECT dropout_risk, risk_level, predicted_at
    FROM prediction_history
    WHERE student_id = $1
    ORDER BY predicted_at ASC
    `,
    [studentId]
  );

  const student = studentResult.rows[0];
  const historyRows = historyResult.rows || [];
  const lastHistory = historyRows[historyRows.length - 1] || null;
  const riskScore = student.risk_score ?? lastHistory?.dropout_risk ?? null;
  const riskLevel = student.risk_level ?? lastHistory?.risk_level ?? null;
  const riskPercent = toPercent(riskScore);
  const { trend, delta } = getTrend(historyRows);
  const lastPredictionAt = student.prediction_date || lastHistory?.predicted_at || null;

  return {
    student_id: student.id,
    name: student.name,
    register_number: student.register_number,
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
};

const createCounsellingServer = () => {
  const server = new McpServer({
    name: "dropout-copilot-counselling",
    version: "1.0.0",
  });

  server.registerTool(
    "counselling_generate",
    {
      title: "Generate counselling guidance",
      description: "Return guidance based on a student's prediction and academics.",
      inputSchema: z.object({
        student_id: z.number().int(),
      }),
    },
    async ({ student_id }) => {
      const payload = await fetchStudentPayload(student_id);
      if (!payload) {
        return {
          content: [{ type: "text", text: "Student not found." }],
          structuredContent: { error: "Student not found." },
        };
      }
      const guidance = buildRuleBasedCounselling(payload);
      return {
        content: [{ type: "text", text: guidance.summary }],
        structuredContent: guidance,
      };
    }
  );

  server.registerTool(
    "counselling_chat",
    {
      title: "Chat counselling assistant",
      description: "Answer student questions using prediction context.",
      inputSchema: z.object({
        student_id: z.number().int(),
        question: z.string().min(1),
        chat_history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1),
            })
          )
          .optional(),
      }),
    },
    async ({ student_id, question, chat_history }) => {
      const payload = await fetchStudentPayload(student_id);
      if (!payload) {
        return {
          content: [{ type: "text", text: "Student not found." }],
          structuredContent: { error: "Student not found." },
        };
      }
      const baseInsights = buildRuleBasedCounselling(payload);
      let reply = "";
      let source = "rule";
      let meta = null;

      const context = buildChatContext(payload, baseInsights);
      const safeContext = context.replace(/[\u0000-\u001F]/g, "");
      const systemPrompt = buildExplanationSystemPrompt(safeContext);
      const history = Array.isArray(chat_history) ? chat_history.slice(-6) : [];

      try {
        if (LLM_PROVIDER === "ollama") {
          reply = await callOllamaExplanation({ systemPrompt, question });
          if (reply) source = "ollama";
        } else if (LLM_PROVIDER === "lmstudio") {
          reply = await callLmStudioExplanation({ systemPrompt, question, history });
          if (reply) source = "lmstudio";
        } else if (LLM_PROVIDER === "groq") {
          reply = await callGroqExplanation({ systemPrompt, question, history });
          if (reply) source = "groq";
        } else if (LLM_PROVIDER === "grok" || LLM_PROVIDER === "xai") {
          reply = await callGrokExplanation({ systemPrompt, question, history });
          if (reply) source = "grok";
        } else if (process.env.OPENAI_API_KEY) {
          const client = getOpenAIClient();
          const response = await client.responses.create({
            model: OPENAI_MODEL,
            temperature: 0.4,
            max_output_tokens: 260,
            input: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...history,
              {
                role: "user",
                content: question,
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
        }
      } catch (err) {
        meta = { error: err.message, provider: LLM_PROVIDER };
      }

      if (!reply) {
        const response = buildRuleBasedChatResponse(payload, question);
        reply = response.reply;
      }

      return {
        content: [{ type: "text", text: reply }],
        structuredContent: {
          reply,
          recommendations: baseInsights.recommendations,
          follow_up_questions: baseInsights.follow_up_questions,
          urgency: baseInsights.urgency,
          metadata: {
            generated_at: new Date().toISOString(),
            source,
            ...(meta ? { openai: meta } : {}),
          },
        },
      };
    }
  );

  return server;
};

const handleChatStream = async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }

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

  const controller = new AbortController();
  req.on("close", () => {
    controller.abort();
  });

  try {
    const body = await readJsonBody(req);
    const id = Number(body?.student_id);
    const prompt = String(body?.question || "").trim();

    if (!Number.isInteger(id)) {
      send({ error: "student_id is required" });
      res.end();
      return;
    }
    if (!prompt) {
      send({ error: "question is required" });
      res.end();
      return;
    }

    if (LLM_PROVIDER !== "ollama" &&
        LLM_PROVIDER !== "grok" &&
        LLM_PROVIDER !== "xai" &&
        LLM_PROVIDER !== "groq") {
      send({ error: "Streaming is only supported for LLM_PROVIDER=ollama, grok, or groq." });
      res.end();
      return;
    }

    const payload = await fetchStudentPayload(id);
    if (!payload) {
      send({ error: "Student not found." });
      res.end();
      return;
    }

    const baseInsights = buildRuleBasedCounselling(payload);
    const context = buildChatContext(payload, baseInsights);
    const safeContext = context.replace(/[\u0000-\u001F]/g, "");
    const systemPrompt = buildExplanationSystemPrompt(safeContext);

    if (LLM_PROVIDER === "ollama") {
      await streamOllamaExplanation({
        systemPrompt,
        question: prompt,
        onToken: (token) => send({ token }),
        signal: controller.signal,
      });
    } else if (LLM_PROVIDER === "groq") {
      await streamGroqExplanation({
        systemPrompt,
        question: prompt,
        onToken: (token) => send({ token }),
      });
    } else {
      await streamGrokExplanation({
        systemPrompt,
        question: prompt,
        onToken: (token) => send({ token }),
        signal: controller.signal,
      });
    }

    send({ done: true });
    res.end();
  } catch (err) {
    if (err?.name === "AbortError") {
      res.end();
      return;
    }
    send({ error: err.message || "Streaming failed" });
    res.end();
  }
};
const handler = async (req, res) => {
  if (!req.url?.startsWith(MCP_PATH)) {
    res.writeHead(404);
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.url?.startsWith(`${MCP_PATH}/chat/stream`)) {
    await handleChatStream(req, res);
    return;
  }

  const requiredAccept = "application/json, text/event-stream";
  req.headers.accept = requiredAccept;
  if (!req.headers["content-type"]) {
    req.headers["content-type"] = "application/json";
  }

  const originalUrl = req.url;
  if (req.url?.startsWith(MCP_PATH)) {
    const stripped = req.url.slice(MCP_PATH.length);
    req.url = stripped && stripped.length > 0 ? stripped : "/";
  }

  const server = createCounsellingServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await transport.handleRequest(req, res);
  } finally {
    req.url = originalUrl;
  }
};

const httpServer = createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error("MCP server error:", err);
    res.writeHead(500);
    res.end("MCP server error");
  });
});

const startServer = async () => {
  httpServer.listen(MCP_PORT, () => {
    console.log(`MCP counselling server running on http://localhost:${MCP_PORT}${MCP_PATH}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});




