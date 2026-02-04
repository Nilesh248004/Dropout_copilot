// src/pages/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  CircularProgress,
  TextField,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
} from "@mui/material";
import StudentList from "./StudentList";
import BatchPredictButton from "../components/BatchPredictButton";
import RiskCharts from "../components/RiskChart";
import EmailCenter from "../components/EmailCenter";
import axios from "axios";
import { useRole } from "../context/RoleContext";
import { API_BASE_URL } from "../config/api";
import { filterStudentsByFaculty, normalizeFacultyId } from "../utils/faculty";
import { getRiskLevel, getRiskScore } from "../utils/risk";
const Dashboard = () => {
  const { role, facultyId, studentId, email } = useRole();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [studentRegNo, setStudentRegNo] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [queryReason, setQueryReason] = useState("");
  const [queryStatus, setQueryStatus] = useState(null);
  const [queryFacultyId, setQueryFacultyId] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("All Faculties");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [counsellingRequests, setCounsellingRequests] = useState([]);
  const [counsellingLoading, setCounsellingLoading] = useState(false);
  const [counsellingError, setCounsellingError] = useState(null);
  const [exportUploading, setExportUploading] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [adminNotifyStatus, setAdminNotifyStatus] = useState(null);
  const [notifiedStudents, setNotifiedStudents] = useState({});
  const [studentAlertStatus, setStudentAlertStatus] = useState(null);
  const [alertedStudents, setAlertedStudents] = useState({});

  // ================= FETCH STUDENTS ==================
  
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      if (role === "student") {
        setStudents([]);
        return;
      }
      if (role === "faculty" && !facultyId) {
        setStudents([]);
        return;
      }
      const params = {};
      if (role === "faculty" && facultyId) {
        params.faculty_id = facultyId;
      }
      const res = await axios.get(`${API_BASE_URL}/students/full`, { params });
      const incoming = Array.isArray(res.data) ? res.data : [];
      const scoped =
        role === "faculty" ? filterStudentsByFaculty(incoming, facultyId) : incoming;
      setStudents(scoped);
    } catch (err) {
      console.error("Fetch Students Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [role, facultyId]);

  const fetchStudentRecord = useCallback(async (regNo) => {
    const normalized = regNo.trim();
    if (!normalized) {
      setStudentRecord(null);
      return;
    }
    try {
      setStudentLookupLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/students/lookup/${encodeURIComponent(normalized)}/full`
      );
      setStudentRecord(res.data);
    } catch (err) {
      console.error("Student lookup error:", err.message);
      setStudentRecord(null);
    } finally {
      setStudentLookupLoading(false);
    }
  }, []);

  const fetchCounsellingRequests = useCallback(
    async (targetStudentId, targetFacultyId) => {
      try {
        setCounsellingLoading(true);
        setCounsellingError(null);
        if (role === "faculty") {
          if (!facultyId) {
            setCounsellingRequests([]);
            return;
          }
          const res = await axios.get(`${API_BASE_URL}/counselling`, {
            params: { faculty_id: facultyId },
          });
          const incoming = Array.isArray(res.data) ? res.data : [];
          const normalizedFaculty = normalizeFacultyId(facultyId);
          const scoped = normalizedFaculty
            ? incoming.filter((request) => {
                const requestFaculty = normalizeFacultyId(request.faculty_id);
                const studentFaculty = normalizeFacultyId(request.student_faculty_id);
                const hasStudentFaculty = Boolean(studentFaculty);
                return (
                  requestFaculty === normalizedFaculty &&
                  (!hasStudentFaculty || studentFaculty === normalizedFaculty)
                );
              })
            : incoming;
          setCounsellingRequests(scoped);
          return;
        }
        if (role === "student") {
          if (!targetStudentId) {
            setCounsellingRequests([]);
            return;
          }
          const params = { student_id: targetStudentId };
          const normalizedFaculty = normalizeFacultyId(targetFacultyId);
          if (normalizedFaculty) {
            params.faculty_id = normalizedFaculty;
          }
          const res = await axios.get(`${API_BASE_URL}/counselling`, { params });
          setCounsellingRequests(Array.isArray(res.data) ? res.data : []);
          return;
        }
        setCounsellingRequests([]);
      } catch (err) {
        console.error("Fetch counselling error:", err.message);
        setCounsellingError("Unable to load counselling requests.");
      } finally {
        setCounsellingLoading(false);
      }
    },
    [role, facultyId]
  );

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (role === "student" && studentId) {
      setStudentRegNo(studentId);
      fetchStudentRecord(studentId);
    }
  }, [role, studentId, fetchStudentRecord]);

  useEffect(() => {
    if (role === "faculty") {
      fetchCounsellingRequests();
      return;
    }
    if (role === "student") {
      fetchCounsellingRequests(studentRecord?.id, studentRecord?.faculty_id);
    }
  }, [role, facultyId, studentRecord?.id, fetchCounsellingRequests]);

  useEffect(() => {
    if (role === "student" && studentRecord?.faculty_id) {
      setQueryFacultyId(studentRecord.faculty_id);
    }
  }, [role, studentRecord?.faculty_id]);

  // ================= DASHBOARD STATS ==================
  const totalStudents = students.length;
  const highRisk = students.filter((s) => {
    const score = getRiskScore(s);
    return score !== null && score > 0.7;
  }).length;
  const mediumRisk = students.filter((s) => {
    const score = getRiskScore(s);
    return score !== null && score > 0.4 && score <= 0.7;
  }).length;
  const lowRisk = students.filter((s) => {
    const score = getRiskScore(s);
    return score !== null && score <= 0.4;
  }).length;
const isStudent = role === "student";
  const isFaculty = role === "faculty";
  const isAdmin = role === "admin";

  const getFacultyForStudent = (student) => student?.faculty_id || "Unassigned";
  const facultyOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((s) => s.faculty_id).filter(Boolean)));
    const options = ["All Faculties", ...unique];
    if (students.some((s) => !s.faculty_id)) {
      options.push("Unassigned");
    }
    return options;
  }, [students]);

  const handleStudentLookup = () => {
    if (role === "student") {
      fetchStudentRecord(studentRegNo);
      return;
    }
    const normalized = studentRegNo.trim().toLowerCase();
    if (!normalized) {
      setStudentRecord(null);
      return;
    }
    const match = students.find(
      (s) => s.register_number?.toLowerCase() === normalized
    );
    setStudentRecord(match || null);
  };

  const handleSubmitQuery = async () => {
    if (!studentRecord) return;
    const mappedFacultyId = String(studentRecord?.faculty_id || queryFacultyId || "").trim();
    if (!mappedFacultyId) {
      setQueryStatus({
        type: "error",
        message: "Please enter the faculty ID before submitting your query.",
      });
      return;
    }
    try {
      setQueryStatus(null);
    const res = await axios.post(`${API_BASE_URL}/counselling/book`, {
      student_id: studentRecord.id,
      reason: queryReason || "Requesting support",
      faculty_id: mappedFacultyId,
    });
    setQueryReason("");
    if (!studentRecord?.faculty_id) {
      setQueryFacultyId("");
    }
      const facultyLabel = res.data?.faculty_label;
      setQueryStatus({
        type: "success",
        message: facultyLabel
          ? `Your query has been sent to ${facultyLabel}.`
          : "Your query has been sent. A faculty member will follow up soon.",
      });
      fetchCounsellingRequests(studentRecord?.id, studentRecord?.faculty_id);
    } catch (err) {
      console.error("Query submission error:", err.message);
      setQueryStatus({
        type: "error",
        message:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to submit your query right now. Please try again shortly.",
      });
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Student ID",
      "Name",
      "Register Number",
      "Year",
      "Semester",
      "Risk Score",
      "Risk Level",
    ];
    const rows = students.map((s) => [
      s.id,
      s.name,
      s.register_number,
      s.year,
      s.semester,
      s.risk_score ?? "",
      s.risk_level ?? "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dropout_predictions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!facultyId) {
      setExportStatus({
        type: "error",
        message: "Faculty ID is required to upload exports.",
      });
      event.target.value = "";
      return;
    }
    setExportUploading(true);
    setExportStatus(null);
    try {
      const content = await file.text();
      await axios.post(`${API_BASE_URL}/exports`, {
        file_name: file.name,
        file_size: file.size,
        content,
        faculty_id: facultyId,
        uploaded_by_email: email || null,
      });
      setExportStatus({
        type: "success",
        message: "Export uploaded. Admins can review it now.",
      });
    } catch (err) {
      const status = err.response?.status;
      const errorMessage =
        err.response?.data?.error ||
        (status === 413
          ? "File too large. Please upload a CSV smaller than 20MB."
          : null) ||
        err.message ||
        "Unable to upload export right now.";
      setExportStatus({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setExportUploading(false);
      event.target.value = "";
    }
  };

  const handleAlertStudent = async (student) => {
    const normalizedFaculty = normalizeFacultyId(facultyId);
    if (!normalizedFaculty) {
      setStudentAlertStatus({
        type: "error",
        message: "Faculty ID is required to alert students.",
      });
      return;
    }
    const resolvedStudentId = student?.id ?? student?.student_id;
    if (!resolvedStudentId && !student?.register_number) {
      setStudentAlertStatus({
        type: "error",
        message: "Student ID is missing. Refresh and try again.",
      });
      return;
    }
    try {
      setStudentAlertStatus(null);
      const riskScore = student?.risk_score ?? null;
      const riskMessage =
        typeof riskScore === "number"
          ? `Risk ${(riskScore * 100).toFixed(1)}%.`
          : "Risk not computed yet.";
      await axios.post(`${API_BASE_URL}/student-alerts`, {
        faculty_id: normalizedFaculty,
        student_id: resolvedStudentId,
        student_name: student?.name,
        register_number: student?.register_number,
        message: `Faculty alert for ${student?.name || "student"}${student?.register_number ? ` (${student.register_number})` : ""}. ${riskMessage}`,
      });
      if (resolvedStudentId) {
        setAlertedStudents((prev) => ({ ...prev, [resolvedStudentId]: true }));
      }
      setStudentAlertStatus({
        type: "success",
        message: `Alert sent to ${student?.name || "student"}.`,
      });
    } catch (err) {
      const status = err.response?.status;
      const serverMessage =
        err.response?.data?.error || err.response?.data?.message || null;
      const fallbackMessage =
        status === 404
          ? "Alert service not available. Restart the backend and try again."
          : status === 400
            ? "Missing data to alert this student."
            : err.message?.includes("Network")
              ? "Cannot reach backend. Check the server and try again."
              : "Unable to alert student.";
      setStudentAlertStatus({
        type: "error",
        message: serverMessage || fallbackMessage,
      });
    }
  };

  const handleNotifyFaculty = async (student) => {
    const normalizedFaculty = normalizeFacultyId(student?.faculty_id);
    if (!normalizedFaculty) {
      setAdminNotifyStatus({
        type: "error",
        message: "This student is not mapped to a faculty yet.",
      });
      return;
    }
    const riskScore = student?.risk_score ?? null;
    const riskMessage =
      typeof riskScore === "number"
        ? `Risk ${(riskScore * 100).toFixed(1)}%.`
        : "Risk not computed yet.";
    try {
      setAdminNotifyStatus(null);
      await axios.post(`${API_BASE_URL}/alerts`, {
        faculty_id: normalizedFaculty,
        student_id: student?.id,
        student_name: student?.name,
        register_number: student?.register_number,
        message: `Admin alert for ${student?.name || "student"}${student?.register_number ? ` (${student.register_number})` : ""}. ${riskMessage}`,
      });
      setAdminNotifyStatus({
        type: "success",
        message: `Notified faculty ${normalizedFaculty}.`,
      });
      if (student?.id) {
        setNotifiedStudents((prev) => ({ ...prev, [student.id]: true }));
      }
    } catch (err) {
      setAdminNotifyStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to notify faculty.",
      });
    }
  };

  const counsellingStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return "success";
      case "CANCELLED":
        return "error";
      default:
        return "warning";
    }
  };

  const formatRequestDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  };

  const handleUpdateCounsellingStatus = async (requestId, status) => {
    try {
      await axios.put(`${API_BASE_URL}/counselling/${requestId}`, { status });
      fetchCounsellingRequests();
    } catch (err) {
      console.error("Update counselling status error:", err.message);
      setCounsellingError("Unable to update counselling status.");
    }
  };

  const filteredByFaculty = facultyFilter === "All Faculties"
    ? students
    : students.filter((student) => getFacultyForStudent(student) === facultyFilter);

  const studentScopedRequests = studentRecord
    ? counsellingRequests.filter((request) => {
        if (request.student_id !== studentRecord.id) return false;
        const expectedFaculty = normalizeFacultyId(studentRecord.faculty_id);
        if (!expectedFaculty) return true;
        return normalizeFacultyId(request.faculty_id) === expectedFaculty;
      })
    : [];
  const facultyScopedRequests = isFaculty
    ? counsellingRequests.filter((request) => {
        const expectedFaculty = normalizeFacultyId(facultyId);
        if (!expectedFaculty) return false;
        const studentFaculty = normalizeFacultyId(request.student_faculty_id);
        const hasStudentFaculty = Boolean(studentFaculty);
        return (
          normalizeFacultyId(request.faculty_id) === expectedFaculty &&
          (!hasStudentFaculty || studentFaculty === expectedFaculty)
        );
      })
    : counsellingRequests;

  const normalizedAdminQuery = adminSearchQuery.trim().toLowerCase();
  const filteredAdminStudents = normalizedAdminQuery
    ? filteredByFaculty.filter((student) => {
        const name = student.name?.toLowerCase() || "";
        const regNo = student.register_number?.toLowerCase() || "";
        return name.includes(normalizedAdminQuery) || regNo.includes(normalizedAdminQuery);
      })
    : filteredByFaculty;

  const studentRiskScore = getRiskScore(studentRecord);
  const studentRiskLevel = getRiskLevel(studentRecord);
  const studentRiskColor =
    studentRiskScore === null ? "default" :
    studentRiskScore > 0.7 ? "error" :
    studentRiskScore > 0.4 ? "warning" : "success";
  const highRiskStudents = students.filter((s) => getRiskLevel(s) === "HIGH");
  const facultyDisplayName = useMemo(() => {
    if (!email) return "Faculty Member";
    const handle = email.split("@")[0];
    if (!handle) return "Faculty Member";
    const cleaned = handle.replace(/[._-]+/g, " ").trim();
    if (!cleaned) return "Faculty Member";
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }, [email]);
  const facultyInitial = useMemo(() => {
    const source = email || facultyId || "F";
    const trimmed = String(source || "").trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : "F";
  }, [email, facultyId]);
  const adminDisplayName = useMemo(() => {
    if (!email) return "Administrator";
    const handle = email.split("@")[0];
    if (!handle) return "Administrator";
    const cleaned = handle.replace(/[._-]+/g, " ").trim();
    if (!cleaned) return "Administrator";
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }, [email]);
  return (
    <Container sx={{ mt: 4, mb: 6 }}>

      {/* ================= HEADER SECTION ================= */}
      <Paper
        sx={{
          p: 3,
          mb: 4,
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 45%, #38bdf8 100%)",
          color: "#fff",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: "rgba(255,255,255,0.75)" }}
            >
              Dropout Copilot
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                lineHeight: 1.1,
                textShadow: "0 12px 30px rgba(30,64,175,0.35)",
              }}
            >
              AI Student{" "}
              <Box
                component="span"
                sx={{
                  background: "rgba(255,255,255,0.18)",
                  px: 1.5,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              >
                Dropout Copilot
              </Box>
            </Typography>
            <Typography variant="subtitle1" sx={{ color: "rgba(255,255,255,0.85)", mt: 1 }}>
              Role-based insights for {isStudent ? "students" : isFaculty ? "faculty" : "administrators"}.
            </Typography>
            <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
              <Chip
                label={`Role: ${isStudent ? "Student" : isFaculty ? "Faculty" : "Admin"}`}
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              />
              <Chip
                label="Live Risk Insights"
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.15)",
                  color: "#e0f2fe",
                  fontWeight: 600,
                }}
              />
            </Stack>
          </Box>
          {/* Add Student moved to navbar */}
        </Stack>
      </Paper>

      {/* ================= KPI SUMMARY CARDS ================= */}
      {!isStudent && (
        <Grid container spacing={2} mb={4}>
          <Grid item xs={12} md={3}>
            <Card sx={{ bgcolor: "#1e40af", color: "#fff" }}>
              <CardContent>
                <Typography>Total Students</Typography>
                <Typography variant="h4">{totalStudents}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card sx={{ bgcolor: "#b91c1c", color: "#fff" }}>
              <CardContent>
                <Typography>High Risk</Typography>
                <Typography variant="h4">{highRisk}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card sx={{ bgcolor: "#ea580c", color: "#fff" }}>
              <CardContent>
                <Typography>Medium Risk</Typography>
                <Typography variant="h4">{mediumRisk}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card sx={{ bgcolor: "#15803d", color: "#fff" }}>
              <CardContent>
                <Typography>Low Risk</Typography>
                <Typography variant="h4">{lowRisk}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ================= STUDENT VIEW ================= */}
      {isStudent && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" mb={2}>👤 My Predicted Report</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              label="Registration Number"
              placeholder="Enter your reg no"
              value={studentRegNo}
              onChange={(event) => setStudentRegNo(event.target.value)}
              disabled={Boolean(studentId)}
              helperText={studentId ? "Loaded from your login" : ""}
              sx={{ minWidth: 240 }}
            />
            <Button variant="contained" onClick={handleStudentLookup} disabled={studentLookupLoading}>
              View My Report
            </Button>
          </Stack>

      <Divider sx={{ my: 3 }} />

      {studentRecord ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    position: "relative",
                    overflow: "hidden",
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 4,
                    background:
                      "linear-gradient(140deg, rgba(15, 23, 42, 0.03) 0%, rgba(59, 130, 246, 0.12) 55%, rgba(236, 254, 255, 0.6) 100%)",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: -120,
                      right: -120,
                      width: 220,
                      height: 220,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0) 65%)",
                    },
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      bottom: -140,
                      left: -140,
                      width: 240,
                      height: 240,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(14,165,233,0.25) 0%, rgba(14,165,233,0) 70%)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 6,
                      background: "linear-gradient(90deg, #2563eb, #38bdf8, #0ea5e9)",
                    }}
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "center" }} mb={2.5}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "18px",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: 24,
                        color: "#0f172a",
                        bgcolor: "rgba(255,255,255,0.85)",
                        border: "2px solid rgba(37, 99, 235, 0.35)",
                        boxShadow: "0 18px 30px rgba(37, 99, 235, 0.25)",
                      }}
                    >
                      {String(studentRecord.name || "S")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                        Student Snapshot
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                        {studentRecord.name}
                      </Typography>
                      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={studentRiskLevel ? `Risk: ${studentRiskLevel}` : "Risk: Pending"}
                          color={studentRiskColor}
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          label={studentRecord.register_number || "Reg No N/A"}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Faculty ID
                        </Typography>
                        <Typography fontWeight={700}>
                          {studentRecord.faculty_id || "Unassigned"}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Faculty Email
                        </Typography>
                        <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>
                          {studentRecord.faculty_email || "Not available"}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Year / Semester
                        </Typography>
                        <Typography fontWeight={700}>
                          {studentRecord.year} / {studentRecord.semester}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Attendance
                        </Typography>
                        <Typography fontWeight={700}>
                          {studentRecord.attendance ?? "N/A"}%
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          CGPA
                        </Typography>
                        <Typography fontWeight={700}>
                          {studentRecord.cgpa ?? "N/A"}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.7)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Phone Number
                        </Typography>
                        <Typography fontWeight={700}>
                          {studentRecord.phone_number || "N/A"}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" mb={1}>Prediction Status</Typography>
                  <Chip
                    label={
                      studentRiskScore === null
                        ? "Pending"
                        : `${(studentRiskScore * 100).toFixed(2)}% - ${studentRiskLevel || "Pending"}`
                    }
                    color={studentRiskColor}
                    sx={{ mb: 2 }}
                  />
                  <Typography>
                    Risk Insight: {studentRiskScore !== null && studentRiskScore > 0.6
                      ? "High risk detected. Please contact your faculty advisor."
                      : "Your risk is within a healthy range. Keep up the momentum!"}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Enter your registration number to view your personalized report.
            </Alert>
          )}

          {studentRecord && (
            <Paper sx={{ p: 3, mt: 3, bgcolor: "#f8fafc" }}>
              <Typography variant="h6" mb={2}>📊 My Performance Trends</Typography>
              <RiskCharts students={[studentRecord]} />
            </Paper>
          )}

<Typography variant="h6" mb={1}>🗂 Raise a Support Query</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Share your concern to request academic or counselling support.
          </Typography>
          <TextField
            label="Faculty ID"
            value={queryFacultyId}
            onChange={(event) => setQueryFacultyId(event.target.value)}
            fullWidth
            disabled={Boolean(studentRecord?.faculty_id)}
            helperText={
              studentRecord?.faculty_id
                ? "Mapped to your faculty advisor"
                : "Enter the faculty ID for your request"
            }
            sx={{ mb: 2 }}
          />
          <TextField
            label="Describe your concern"
            multiline
            minRows={3}
            value={queryReason}
            onChange={(event) => setQueryReason(event.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            disabled={!studentRecord || !String(studentRecord?.faculty_id || queryFacultyId || "").trim()}
            onClick={handleSubmitQuery}
          >
            Submit Query
          </Button>
          {queryStatus?.type === "success" && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {queryStatus.message}
            </Alert>
          )}
          {queryStatus?.type === "error" && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {queryStatus.message}
            </Alert>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" mb={2}>My Support Queries</Typography>
          {!studentRecord && (
            <Alert severity="info">Look up your registration number to view your query status.</Alert>
          )}
          {studentRecord && counsellingLoading && (
            <Box display="flex" justifyContent="center" mt={2}>
              <CircularProgress size={24} />
            </Box>
          )}
          {studentRecord && !counsellingLoading && studentScopedRequests.length === 0 && (
            <Alert severity="info">No support queries yet.</Alert>
          )}
          {studentRecord && studentScopedRequests.length > 0 && (
            <Stack spacing={2}>
              {studentScopedRequests.map((request) => (
                <Paper key={request.id} sx={{ p: 2, bgcolor: "#f8fafc" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ md: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography fontWeight={600}>{request.reason || "Support request"}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Sent to {request.faculty_label || request.faculty_id || "Faculty"} - {formatRequestDate(request.request_date)}
                      </Typography>
                    </Box>
                    <Chip
                      label={request.status || "PENDING"}
                      color={counsellingStatusColor(request.status)}
                      sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
          {counsellingError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {counsellingError}
            </Alert>
          )}
        </Paper>
      )}

      {isStudent && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <EmailCenter role={role} />
        </Paper>
      )}

      {/* ================= FACULTY VIEW ================= */}
      {isFaculty && (
        <>
          <Paper
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 2.5, md: 3 },
              borderRadius: 4,
              mb: 4,
              background:
                "linear-gradient(145deg, rgba(15, 23, 42, 0.04) 0%, rgba(14, 165, 233, 0.14) 55%, rgba(248, 250, 252, 0.9) 100%)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
              "&::before": {
                content: '""',
                position: "absolute",
                top: -100,
                right: -120,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(14,165,233,0.35) 0%, rgba(14,165,233,0) 65%)",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "linear-gradient(90deg, #0ea5e9, #22d3ee, #38bdf8)",
              }}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              alignItems={{ sm: "center" }}
              mb={2.5}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "18px",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 24,
                  color: "#0f172a",
                  bgcolor: "rgba(255,255,255,0.85)",
                  border: "2px solid rgba(14, 165, 233, 0.35)",
                  boxShadow: "0 18px 30px rgba(14, 165, 233, 0.25)",
                }}
              >
                {facultyInitial}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Faculty Snapshot
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  {facultyDisplayName}
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  <Chip size="small" label="Faculty" color="info" sx={{ fontWeight: 600 }} />
                  <Chip
                    size="small"
                    label={`Mapped Students: ${students.length}`}
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Faculty ID
                  </Typography>
                  <Typography fontWeight={700}>
                    {facultyId || "Not linked"}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>
                    {email || "Not available"}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          {/* ================= ACTION SECTION ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>⚡ Faculty AI Actions</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <BatchPredictButton reload={fetchStudents} />
              <Button variant="outlined" onClick={handleExportCsv}>
                Export Prediction Summary (Share with Admin)
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={1}>
              Upload Export for Admin Review
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Upload the CSV export so admins can review your latest predictions.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <Button
                variant="contained"
                component="label"
                disabled={exportUploading || !facultyId}
              >
                {exportUploading ? "Uploading..." : "Upload CSV Export"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={handleExportUpload}
                />
              </Button>
              {!facultyId && (
                <Alert severity="warning">Faculty ID is required to upload exports.</Alert>
              )}
            </Stack>
            {exportStatus && (
              <Alert severity={exportStatus.type} sx={{ mt: 2 }}>
                {exportStatus.message}
              </Alert>
            )}
          </Paper>

          {/* ================= RISK ANALYTICS SECTION ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>📊 Risk Analytics Overview</Typography>
            <RiskCharts students={students} />
          </Paper>

          {/* ================= HIGH RISK ALERTS ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>🚨 High-Risk Student Alerts</Typography>
            {studentAlertStatus && (
              <Alert severity={studentAlertStatus.type} sx={{ mb: 2 }}>
                {studentAlertStatus.message}
              </Alert>
            )}
            <Stack spacing={2}>
              {highRiskStudents.slice(0, 5).map((student) => (
                <Paper key={student.id} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography fontWeight={600}>{student.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {student.register_number} • Risk {(student.risk_score * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Button
                    variant={alertedStudents[student.id] ? "contained" : "outlined"}
                    color={alertedStudents[student.id] ? "success" : "error"}
                    onClick={() => handleAlertStudent(student)}
                    disabled={Boolean(alertedStudents[student.id])}
                    sx={{
                      "&.Mui-disabled": alertedStudents[student.id]
                        ? {
                            color: "#fff",
                            bgcolor: "rgba(22, 163, 74, 0.85)",
                          }
                        : undefined,
                    }}
                  >
                    {alertedStudents[student.id] ? "Alerted" : "Alert Student"}
                  </Button>
                </Paper>
              ))}
              {highRiskStudents.length === 0 && (
                <Alert severity="success">No high-risk students right now. Great work!</Alert>
              )}
            </Stack>
          </Paper>

          {/* ================= COUNSELLING REQUESTS ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mb={2}>
              <Box>
                <Typography variant="h6">Student Support Queries</Typography>
                <Typography variant="body2" color="text.secondary">
                  Requests from your mapped students.
                </Typography>
              </Box>
              <Chip
                label={`Open: ${facultyScopedRequests.filter((r) => String(r.status || "").toUpperCase() === "PENDING").length}`}
                color="warning"
                size="small"
                sx={{ ml: { md: "auto" } }}
              />
            </Stack>

            {counsellingLoading && (
              <Box display="flex" justifyContent="center" mt={2}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!counsellingLoading && facultyScopedRequests.length === 0 && (
              <Alert severity="info">No support queries yet.</Alert>
            )}
            {facultyScopedRequests.length > 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      {["Student", "Reg No", "Reason", "Requested", "Status", "Actions"].map((header) => (
                        <TableCell key={header}><b>{header}</b></TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {facultyScopedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.name}</TableCell>
                        <TableCell>{request.register_number}</TableCell>
                        <TableCell>{request.reason || "Support request"}</TableCell>
                        <TableCell>{formatRequestDate(request.request_date)}</TableCell>
                        <TableCell>
                          <Chip
                            label={request.status || "PENDING"}
                            color={counsellingStatusColor(request.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {request.status?.toUpperCase() === "PENDING" ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleUpdateCounsellingStatus(request.id, "COMPLETED")}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleUpdateCounsellingStatus(request.id, "CANCELLED")}
                              >
                                Cancel
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No actions
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {counsellingError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {counsellingError}
              </Alert>
            )}
          </Paper>

          {/* ================= STUDENT MANAGEMENT SECTION ================= */}
          <Paper sx={{ p: 3, boxShadow: 3, overflowX: "auto" }}>
            <Typography variant="h6" mb={2}>📋 Student Management</Typography>
            <StudentList
              students={students}
              reload={fetchStudents}
            />
          </Paper>

          <Paper sx={{ p: 3, mt: 4 }}>
            <EmailCenter role={role} />
          </Paper>
        </>
      )}

      {/* ================= ADMIN VIEW ================= */}
      {isAdmin && (
        <>
          <Paper
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 2.5, md: 3 },
              borderRadius: 4,
              mb: 4,
              background:
                "linear-gradient(145deg, rgba(2, 6, 23, 0.06) 0%, rgba(99, 102, 241, 0.16) 55%, rgba(248, 250, 252, 0.9) 100%)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
              "&::before": {
                content: '""',
                position: "absolute",
                top: -110,
                right: -120,
                width: 230,
                height: 230,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(99,102,241,0) 65%)",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #38bdf8)",
              }}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              alignItems={{ sm: "center" }}
              mb={2.5}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "18px",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 24,
                  color: "#0f172a",
                  bgcolor: "rgba(255,255,255,0.85)",
                  border: "2px solid rgba(99, 102, 241, 0.35)",
                  boxShadow: "0 18px 30px rgba(99, 102, 241, 0.25)",
                }}
              >
                {String(adminDisplayName || "A")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Admin Snapshot
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  {adminDisplayName}
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  <Chip size="small" label="Administrator" color="primary" sx={{ fontWeight: 600 }} />
                  <Chip size="small" label={`Total Students: ${students.length}`} variant="outlined" />
                </Stack>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>
                    {email || "Not available"}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Faculty Count
                  </Typography>
                  <Typography fontWeight={700}>
                    {facultyOptions.length > 1 ? facultyOptions.length - 1 : 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    High Risk Students
                  </Typography>
                  <Typography fontWeight={700}>
                    {highRisk}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>🏛 Faculty Overview</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <TextField
                select
                label="Select Faculty"
                value={facultyFilter}
                onChange={(event) => setFacultyFilter(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                {facultyOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                Viewing {filteredAdminStudents.length} students in {facultyFilter}.
              </Typography>
            </Stack>
          </Paper>
          {adminNotifyStatus && (
            <Alert severity={adminNotifyStatus.type} sx={{ mb: 3 }}>
              {adminNotifyStatus.message}
            </Alert>
          )}

          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>📈 Faculty Risk Analytics</Typography>
            <RiskCharts students={filteredByFaculty} />
          </Paper>

          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>🧾 Student Records</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
              <TextField
                label="Search student (name or reg no)"
                value={adminSearchQuery}
                onChange={(event) => setAdminSearchQuery(event.target.value)}
                sx={{ minWidth: { md: 320 } }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                Showing {filteredAdminStudents.length} student(s)
              </Typography>
            </Stack>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {["Name", "Reg No", "Year", "Semester", "Risk", "Faculty", "Actions"].map((header) => (
                      <TableCell key={header}><b>{header}</b></TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAdminStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.register_number}</TableCell>
                      <TableCell>{student.year}</TableCell>
                      <TableCell>{student.semester}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${((student.risk_score ?? 0) * 100).toFixed(1)}%`}
                          color={student.risk_level?.toUpperCase() === "HIGH" ? "error" : "default"}
                        />
                      </TableCell>
                      <TableCell>{getFacultyForStudent(student)}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant={notifiedStudents[student.id] ? "contained" : "outlined"}
                          color={notifiedStudents[student.id] ? "success" : "primary"}
                          onClick={() => handleNotifyFaculty(student)}
                          disabled={Boolean(notifiedStudents[student.id])}
                          sx={{
                            "&.Mui-disabled": notifiedStudents[student.id]
                              ? {
                                  color: "#fff",
                                  bgcolor: "rgba(22, 163, 74, 0.85)",
                                }
                              : undefined,
                          }}
                        >
                          {notifiedStudents[student.id] ? "Notified" : "Notify Faculty"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 3, mb: 4 }}>
            <EmailCenter role={role} />
          </Paper>
        </>
      )}

    </Container>
  );
};

export default Dashboard;
