import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import VideoCallRoundedIcon from "@mui/icons-material/VideoCallRounded";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import StudentReportCharts from "../components/StudentReportCharts";

const MyReport = () => {
  const { studentId } = useRole();
  const [studentRecord, setStudentRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [counselling, setCounselling] = useState(null);
  const [counsellingLoading, setCounsellingLoading] = useState(false);
  const [counsellingStatus, setCounsellingStatus] = useState(null);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledStatus, setScheduledStatus] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! Ask me about your CGPA, attendance, or dropout risk and I will suggest next steps.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState(null);
  const streamTimerRef = useRef(null);
  const wsRef = useRef(null);
  const wsConnectPromiseRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatCountRef = useRef(chatMessages.length);
  const wsUrl = `${API_BASE_URL.replace(/^http/i, "ws")}/counselling/chat/ws`;

  useEffect(() => {
    let active = true;
    if (!studentId) {
      setStudentRecord(null);
      setStatus(null);
      return undefined;
    }

    const fetchStudentReport = async () => {
      try {
        setLoading(true);
        setStatus(null);
        const res = await axios.get(
          `${API_BASE_URL}/students/lookup/${encodeURIComponent(studentId)}/full`
        );
        if (active) {
          setStudentRecord(res.data);
        }
      } catch (err) {
        if (active) {
          setStudentRecord(null);
          setStatus({
            type: "error",
            message: err.response?.data?.error || "Unable to load report.",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStudentReport();
    return () => {
      active = false;
    };
  }, [studentId]);

  const fetchCounselling = useCallback(
    async (force = false) => {
      if (!studentRecord?.id) {
        setCounselling(null);
        setCounsellingStatus(null);
        return;
      }
      try {
        setCounsellingLoading(true);
        setCounsellingStatus(null);
        const res = await axios.post(`${API_BASE_URL}/counselling/ai`, {
          student_id: studentRecord.id,
          force,
        });
        setCounselling(res.data);
      } catch (err) {
        setCounselling(null);
        setCounsellingStatus({
          type: "error",
          message: err.response?.data?.error || "Unable to load counselling insights.",
        });
      } finally {
        setCounsellingLoading(false);
      }
    },
    [studentRecord?.id]
  );

  const fetchScheduledSessions = useCallback(async () => {
    if (!studentRecord?.id) {
      setScheduledSessions([]);
      setScheduledStatus(null);
      return;
    }
    try {
      setScheduledLoading(true);
      setScheduledStatus(null);
      const res = await axios.get(`${API_BASE_URL}/counselling`, {
        params: { student_id: studentRecord.id, status: "SCHEDULED" },
      });
      setScheduledSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setScheduledSessions([]);
      setScheduledStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to load counselling sessions.",
      });
    } finally {
      setScheduledLoading(false);
    }
  }, [studentRecord?.id]);

  useEffect(() => {
    if (!studentRecord?.id) return;
    fetchCounselling(false);
  }, [studentRecord?.id, fetchCounselling]);

  useEffect(() => {
    if (!studentRecord?.id) return;
    fetchScheduledSessions();
  }, [studentRecord?.id, fetchScheduledSessions]);

  const getUrgencyColor = (value) => {
    switch (String(value || "").toUpperCase()) {
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "success";
      case "PENDING":
      default:
        return "default";
    }
  };

  const formatSessionDate = useCallback((value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const nextSession = useMemo(() => {
    if (!Array.isArray(scheduledSessions) || scheduledSessions.length === 0) return null;
    const withDates = scheduledSessions.filter((session) => session?.scheduled_at);
    const sorted = [...withDates].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    if (sorted.length === 0) return scheduledSessions[0];
    const now = Date.now();
    const upcoming = sorted.find((session) => new Date(session.scheduled_at).getTime() >= now);
    return upcoming || sorted[0];
  }, [scheduledSessions]);

  const scrollChatToBottom = useCallback((behavior = "auto") => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const previousCount = chatCountRef.current;
    const nextCount = chatMessages.length;
    chatCountRef.current = nextCount;
    const behavior = nextCount > previousCount ? "smooth" : "auto";
    const frame = requestAnimationFrame(() => {
      scrollChatToBottom(behavior);
    });
    return () => cancelAnimationFrame(frame);
  }, [chatMessages, scrollChatToBottom]);

  useEffect(
    () => () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    },
    []
  );

  const buildFallbackReply = useCallback(
    (question) => {
      const safeQuestion = String(question || "").toLowerCase();
      const summary = counselling?.summary || "";
      const support = counselling?.support_message || "";
      const recommendations = counselling?.recommendations || [];
      const attendance = studentRecord?.attendance;
      const cgpa = studentRecord?.cgpa;

      let focus = "";
      if (safeQuestion.includes("attendance")) {
        focus = Number.isFinite(Number(attendance))
          ? `Your attendance is ${attendance}%. Aim for 80%+ to stay on track.`
          : "Attendance data is not available yet. Please contact your faculty.";
      } else if (safeQuestion.includes("cgpa") || safeQuestion.includes("gpa")) {
        focus = Number.isFinite(Number(cgpa))
          ? `Your CGPA is ${cgpa}. Focus on your lowest-performing subjects first.`
          : "CGPA data is not available yet. Please contact your faculty.";
      } else if (safeQuestion.includes("risk") || safeQuestion.includes("dropout")) {
        focus = counselling?.summary || "";
      }

      const nextStep = recommendations[0] ? `Next step: ${recommendations[0]}` : "";
      return [summary, focus, support, nextStep].filter(Boolean).join(" ").trim();
    },
    [counselling, studentRecord?.attendance, studentRecord?.cgpa]
  );

  const startAssistantMessage = useCallback(() => {
    const id = `assistant-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      { id, role: "assistant", content: "", createdAt: new Date().toISOString() },
    ]);
    return id;
  }, []);

  const appendAssistantChunk = useCallback((id, chunk) => {
    if (!chunk) return;
    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content: `${msg.content}${chunk}` } : msg
      )
    );
  }, []);

  const streamAssistantReply = useCallback((text, existingId = null) => {
    const content = String(text || "").trim();
    if (!content) return Promise.resolve();

    const id = existingId || `assistant-${Date.now()}`;

    if (!existingId) {
      setChatMessages((prev) => [
        ...prev,
        { id, role: "assistant", content: "", createdAt: new Date().toISOString() },
      ]);
    } else {
      setChatMessages((prev) => {
        const alreadyExists = prev.some((msg) => msg.id === id);
        if (alreadyExists) return prev;
        return [
          ...prev,
          { id, role: "assistant", content: "", createdAt: new Date().toISOString() },
        ];
      });
    }

    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
    }

    return new Promise((resolve) => {
      let index = 0;
      streamTimerRef.current = setInterval(() => {
        index += 1;
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, content: content.slice(0, index) } : msg
          )
        );
        if (index >= content.length) {
          clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          resolve();
        }
      }, 12);
    });
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return Promise.resolve(wsRef.current);
    }
    if (wsConnectPromiseRef.current) {
      return wsConnectPromiseRef.current;
    }

    wsConnectPromiseRef.current = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const cleanup = () => {
          ws.removeEventListener("open", onOpen);
          ws.removeEventListener("error", onError);
          ws.removeEventListener("close", onClose);
        };

        const onOpen = () => {
          cleanup();
          wsConnectPromiseRef.current = null;
          resolve(ws);
        };

        const onError = () => {
          cleanup();
          wsConnectPromiseRef.current = null;
          reject(new Error("WebSocket connection failed"));
        };

        const onClose = () => {
          cleanup();
          wsConnectPromiseRef.current = null;
          wsRef.current = null;
        };

        ws.addEventListener("open", onOpen);
        ws.addEventListener("error", onError);
        ws.addEventListener("close", onClose);
      } catch (err) {
        wsConnectPromiseRef.current = null;
        reject(err);
      }
    });

    return wsConnectPromiseRef.current;
  }, [wsUrl]);

  const handleSendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || chatLoading || !studentRecord?.id) return;
    setChatInput("");
    setChatStatus(null);
    const createdAt = new Date().toISOString();
    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: message, createdAt },
    ]);

    const assistantId = startAssistantMessage();
    let receivedToken = false;
    let receivedAny = false;

    try {
      setChatLoading(true);
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }

      const ws = await connectWebSocket();
      const requestId = `chat-${Date.now()}`;

      await new Promise((resolve, reject) => {
        let finished = false;
        const timeout = setTimeout(() => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(new Error("No response from stream"));
        }, 15000);

        const cleanup = () => {
          clearTimeout(timeout);
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("error", onError);
          ws.removeEventListener("close", onClose);
        };

        const onMessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (err) {
            return;
          }
          if (data?.request_id && data.request_id !== requestId) {
            return;
          }
          if (data?.type === "token") {
            receivedAny = true;
            receivedToken = true;
            appendAssistantChunk(assistantId, data.token);
          }
          if (data?.type === "start") {
            receivedAny = true;
          }
          if (data?.type === "error") {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error(data.error));
          }
          if (data?.type === "done") {
            if (finished) return;
            finished = true;
            cleanup();
            resolve();
          }
        };

        const onError = () => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(new Error("WebSocket error"));
        };

        const onClose = () => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(new Error("WebSocket closed"));
        };

        ws.addEventListener("message", onMessage);
        ws.addEventListener("error", onError);
        ws.addEventListener("close", onClose);
        ws.send(
          JSON.stringify({
            type: "chat",
            request_id: requestId,
            student_id: studentRecord.id,
            question: message,
          })
        );
      });

      if (!receivedToken) {
        throw new Error("No response from stream");
      }
    } catch (err) {
      const errorMessage =
        err?.message ||
        "Chat assistant is offline. Showing local guidance.";
      let fallbackSucceeded = false;

      if (!receivedToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/counselling/chat`, {
            student_id: studentRecord.id,
            question: message,
          });
          const reply =
            res.data?.reply ||
            "Thanks for your question. Please reach out to your faculty for more support.";
          await streamAssistantReply(reply, assistantId);
          fallbackSucceeded = true;
        } catch (fallbackErr) {
          const fallback = buildFallbackReply(message);
          await streamAssistantReply(
            fallback || "Sorry, I could not load an answer right now.",
            assistantId
          );
          fallbackSucceeded = true;
        }
      }
      if (!fallbackSucceeded) {
        setChatStatus({ type: "warning", message: errorMessage });
      }
    } finally {
      setChatLoading(false);
    }
  }, [
    chatInput,
    chatLoading,
    connectWebSocket,
    studentRecord?.id,
    startAssistantMessage,
    appendAssistantChunk,
    streamAssistantReply,
    buildFallbackReply,
  ]);

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          My Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          CGPA, attendance, dropout risk, and improvement graphs for your profile.
        </Typography>
      </Paper>

      {!studentId && (
        <Alert severity="info">
          Student ID not found. Please log in to view your report.
        </Alert>
      )}

      {status && (
        <Alert severity={status.type} sx={{ mb: 2 }}>
          {status.message}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" mt={2}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && studentRecord && <StudentReportCharts student={studentRecord} />}

      {studentRecord && (
        <Paper
          sx={{
            p: { xs: 2.5, md: 3 },
            mt: 3,
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(37, 99, 235, 0.2)",
            background:
              "linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(14, 165, 233, 0.08) 60%, rgba(255, 255, 255, 0.9) 100%)",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
            }}
          />
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "16px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(37, 99, 235, 0.15)",
                  color: "primary.main",
                }}
              >
                <EventAvailableRoundedIcon />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Counselling Alert
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {nextSession ? "Your Scheduled Session" : "Counselling Updates"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {nextSession
                    ? "Join your faculty counselling session using the Google Meet link."
                    : "When your faculty schedules a session, the details will appear here."}
                </Typography>
              </Box>
            </Stack>
            {nextSession ? (
              nextSession.counselling_mode === "OFFLINE" || nextSession.classroom ? (
                <Chip
                  label="Offline Session"
                  color="warning"
                  variant="outlined"
                />
              ) : nextSession.meet_link ? (
                <Button
                  variant="contained"
                  color="primary"
                  component="a"
                  href={nextSession.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<VideoCallRoundedIcon />}
                  sx={{
                    textTransform: "none",
                    px: 3,
                    borderRadius: 999,
                    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  Join Google Meet
                </Button>
              ) : (
                <Chip label="Meet link pending" variant="outlined" />
              )
            ) : (
              <Chip label="Not scheduled" variant="outlined" />
            )}
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {scheduledStatus && (
            <Alert severity={scheduledStatus.type} sx={{ mb: 2 }}>
              {scheduledStatus.message}
            </Alert>
          )}

          {scheduledLoading && (
            <Box display="flex" justifyContent="center" mt={1}>
              <CircularProgress size={22} />
            </Box>
          )}

          {!scheduledLoading && nextSession && (
            <Stack spacing={1.2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Scheduled For
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatSessionDate(nextSession.scheduled_at)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Faculty
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {nextSession.faculty_label || nextSession.faculty_id || "Faculty"}
                  </Typography>
                </Box>
                {(nextSession.counselling_mode === "OFFLINE" || nextSession.classroom) && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Classroom
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {nextSession.classroom || "TBA"}
                    </Typography>
                  </Box>
                )}
              </Stack>
              {nextSession.reason && (
                <Typography variant="body2" color="text.secondary">
                  {nextSession.reason}
                </Typography>
              )}
            </Stack>
          )}

          {!scheduledLoading && !nextSession && (
            <Alert severity="info">
              No counselling session scheduled yet. Once your faculty assigns one, it will appear
              here with the Meet link.
            </Alert>
          )}
        </Paper>
      )}

      {studentRecord && (
        <Paper sx={{ p: { xs: 2.5, md: 3 }, mt: 3, borderRadius: 4 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1 }}>
              <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                AI Counselling
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Personalized Guidance (MCP Powered)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Insights are generated using the MCP counselling tool when available.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {counselling?.metadata?.source && (
                <Chip
                  size="small"
                  label={`Source: ${String(counselling.metadata.source).toUpperCase()}`}
                  variant="outlined"
                />
              )}
              {counselling?.urgency && (
                <Chip
                  size="small"
                  label={`Urgency: ${String(counselling.urgency).toUpperCase()}`}
                  color={getUrgencyColor(counselling.urgency)}
                />
              )}
              <Button
                variant="outlined"
                onClick={() => fetchCounselling(true)}
                disabled={counsellingLoading}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {counsellingStatus && (
            <Alert severity={counsellingStatus.type} sx={{ mb: 2 }}>
              {counsellingStatus.message}
            </Alert>
          )}

          {counsellingLoading && (
            <Box display="flex" justifyContent="center" mt={2}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!counsellingLoading && counselling && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Summary
                </Typography>
                <Typography fontWeight={600}>
                  {counselling.summary || "No summary available."}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Support Message
                </Typography>
                <Typography>
                  {counselling.support_message || "No support message available."}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Recommendations
                </Typography>
                {Array.isArray(counselling.recommendations) && counselling.recommendations.length > 0 ? (
                  <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                    {counselling.recommendations.map((item, index) => (
                      <Typography component="li" key={`${item}-${index}`} sx={{ mb: 0.5 }}>
                        {item}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography>No recommendations available.</Typography>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Follow-up Questions
                </Typography>
                {Array.isArray(counselling.follow_up_questions) &&
                counselling.follow_up_questions.length > 0 ? (
                  <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                    {counselling.follow_up_questions.map((item, index) => (
                      <Typography component="li" key={`${item}-${index}`} sx={{ mb: 0.5 }}>
                        {item}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography>No follow-up questions available.</Typography>
                )}
              </Paper>
            </Stack>
          )}
        </Paper>
      )}

      {studentRecord && (
        <Paper sx={{ p: { xs: 2.5, md: 3 }, mt: 3, borderRadius: 4 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                Student Chatbot
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Ask for Advice
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Get personalized help based on your prediction and academic data.
              </Typography>
            </Box>
            <Chip label={chatLoading ? "Thinking..." : "Ready"} size="small" />
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {chatStatus && (
            <Alert severity={chatStatus.type} sx={{ mb: 2 }}>
              {chatStatus.message}
            </Alert>
          )}

          <Box
            ref={chatScrollRef}
            sx={{
              maxHeight: 320,
              overflowY: "auto",
              p: 1,
              borderRadius: 2,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(148, 163, 184, 0.08)",
              scrollbarGutter: "stable",
            }}
          >
            <Stack spacing={1.5}>
              {chatMessages.map((msg, index) => (
                <Box
                  key={msg.id || `${msg.role}-${index}`}
                  sx={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: { xs: "100%", sm: "82%" },
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: 0.4 }}
                  >
                    {msg.role === "user" ? "You" : "Counsellor"}
                    {msg.createdAt ? ` • ${new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}` : ""}
                  </Typography>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.4,
                      borderRadius: 2.25,
                      bgcolor: msg.role === "user" ? "primary.main" : "background.paper",
                      color: msg.role === "user" ? "#fff" : "text.primary",
                      border: "1px solid",
                      borderColor:
                        msg.role === "user"
                          ? "rgba(59, 130, 246, 0.3)"
                          : "rgba(148, 163, 184, 0.3)",
                      boxShadow:
                        msg.role === "user"
                          ? "0 12px 24px rgba(37, 99, 235, 0.2)"
                          : "0 10px 22px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </Typography>
                  </Box>
                </Box>
              ))}
              <Box ref={chatEndRef} />
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={2}>
            <TextField
              placeholder="Ask about your CGPA, attendance, or risk..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              fullWidth
              multiline
              minRows={2}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendChat();
                }
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSendChat}
              disabled={chatLoading || !chatInput.trim()}
              sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
            >
              <SendRoundedIcon />
            </IconButton>
          </Stack>
        </Paper>
      )}
    </Container>
  );
};

export default MyReport;


