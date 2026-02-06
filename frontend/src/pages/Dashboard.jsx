// src/pages/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import StudentReportCharts from "../components/StudentReportCharts";
import EmailCenter from "../components/EmailCenter";
import axios from "axios";
import { alpha, useTheme } from "@mui/material/styles";
import { useRole } from "../context/RoleContext";
import { API_BASE_URL } from "../config/api";
import { filterStudentsByFaculty, normalizeFacultyId } from "../utils/faculty";
import { getRiskLevel, getRiskScore } from "../utils/risk";
import { useLocation, useNavigate } from "react-router-dom";
const Dashboard = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const primaryMain = theme.palette.primary.main;
  const primaryLight = theme.palette.primary.light || theme.palette.primary.main;
  const surface = theme.palette.background.paper;
  const borderSoft = alpha(textPrimary, isDark ? 0.18 : 0.12);
  const borderStrong = alpha(textPrimary, isDark ? 0.28 : 0.18);
  const panelShadow = `0 18px 50px ${alpha(theme.palette.common.black, isDark ? 0.45 : 0.08)}`;
  const glassSurface = alpha(surface, isDark ? 0.72 : 0.9);
  const { role, facultyId, studentId, email } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const reportInViewRef = useRef(false);
  const [students, setStudents] = useState([]);
  const [, setLoading] = useState(true);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [studentRegNo, setStudentRegNo] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [queryReason, setQueryReason] = useState("");
  const [queryStatus, setQueryStatus] = useState(null);
  const [queryFacultyId, setQueryFacultyId] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("All Faculties");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchTerm, setAdminSearchTerm] = useState("");
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
  }, [role, facultyId, studentRecord?.id, studentRecord?.faculty_id, fetchCounsellingRequests]);

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
  const sectionPaperSx = {
    p: { xs: 2.5, md: 3 },
    mb: 4,
    borderRadius: 4,
    bgcolor: alpha(surface, isDark ? 0.92 : 0.98),
    border: `1px solid ${borderSoft}`,
    boxShadow: panelShadow,
    backdropFilter: "blur(8px)",
  };
  const inputSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(surface, isDark ? 0.55 : 0.9),
      borderRadius: 2.5,
      "& fieldset": { borderColor: borderSoft },
      "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
      "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
    },
    "& .MuiInputLabel-root": { color: textSecondary },
    "& .MuiFormHelperText-root": { color: textSecondary },
  };
  const infoCardSx = {
    p: 1.6,
    borderRadius: 2.5,
    bgcolor: glassSurface,
    border: `1px solid ${borderSoft}`,
    boxShadow: `0 12px 24px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.08)}`,
    backdropFilter: "blur(6px)",
  };
  const snapshotCardSx = {
    p: 1.6,
    borderRadius: 2.5,
    bgcolor: alpha(surface, isDark ? 0.78 : 0.88),
    border: `1px solid ${borderSoft}`,
    boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.08)}`,
    backdropFilter: "blur(8px)",
  };

  useEffect(() => {
    if (!isStudent) return;
    const wantsReport =
      location.hash === "#my-report" || location.hash === "#my-report-graph";
    if (!wantsReport) return;
    const raf = window.requestAnimationFrame(() => {
      const targetId =
        location.hash === "#my-report-graph" ? "my-report-graph" : "my-report";
      const target =
        document.getElementById(targetId) || document.getElementById("my-report");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.hash, isStudent]);

  useEffect(() => {
    if (!isStudent || location.pathname !== "/dashboard/student") return;
    const target =
      document.getElementById("my-report-graph") || document.getElementById("my-report");
    if (!target) return;
    const targetHash = target.id === "my-report-graph" ? "#my-report-graph" : "#my-report";

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.45;
        if (reportInViewRef.current === inView) return;
        reportInViewRef.current = inView;

        const nextHash = inView ? targetHash : "";
        const currentHash = location.hash || "";
        if (currentHash === nextHash) return;
        navigate(
          { pathname: location.pathname, search: location.search, hash: nextHash },
          { replace: true }
        );
      },
      { threshold: [0.45] }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isStudent, location.pathname, location.search, location.hash, navigate]);

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
  const pendingRequestsCount = facultyScopedRequests.filter(
    (request) => String(request.status || "").toUpperCase() === "PENDING"
  ).length;
  const predictedCount = students.filter((student) => {
    const level = String(student?.risk_level || "").toUpperCase();
    return ["HIGH", "MEDIUM", "LOW"].includes(level);
  }).length;
  const pendingPredictionCount = Math.max(students.length - predictedCount, 0);

  const normalizedAdminQuery = adminSearchTerm.trim().toLowerCase();
  const filteredAdminStudents = normalizedAdminQuery
    ? filteredByFaculty.filter((student) => {
        const name = student.name?.toLowerCase() || "";
        const regNo = student.register_number?.toLowerCase() || "";
        return name.includes(normalizedAdminQuery) || regNo.includes(normalizedAdminQuery);
      })
    : filteredByFaculty;
  const selectedAdminStudent =
    normalizedAdminQuery && filteredAdminStudents.length === 1
      ? filteredAdminStudents[0]
      : null;

  const studentRiskScore = getRiskScore(studentRecord);
  const studentRiskLevelRaw = studentRecord?.risk_level ?? null;
  const studentRiskLevel =
    typeof studentRiskLevelRaw === "string" ? studentRiskLevelRaw.toUpperCase() : null;
  const hasStudentPrediction =
    Boolean(studentRiskLevel) && ["HIGH", "MEDIUM", "LOW"].includes(studentRiskLevel);
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
    <Container
      sx={{
        mt: 4,
        mb: 6,
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: -140,
          right: -120,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            `radial-gradient(circle, ${alpha(primaryLight, 0.2)} 0%, ${alpha(primaryLight, 0)} 70%)`,
          pointerEvents: "none",
          zIndex: 0,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -180,
          left: -140,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            `radial-gradient(circle, ${alpha(primaryMain, 0.18)} 0%, ${alpha(primaryMain, 0)} 70%)`,
          pointerEvents: "none",
          zIndex: 0,
        },
        "& > *": {
          position: "relative",
          zIndex: 1,
        },
      }}
    >

      {/* ================= HEADER SECTION ================= */}
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 4,
          borderRadius: 5,
          position: "relative",
          overflow: "hidden",
          background: isDark
            ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #38bdf8 100%)"
            : `linear-gradient(135deg, ${alpha(primaryMain, 0.95)} 0%, ${alpha(primaryLight, 0.9)} 55%, #38bdf8 100%)`,
          color: "#fff",
          border: `1px solid ${borderSoft}`,
          boxShadow: `0 30px 60px ${alpha(theme.palette.common.black, isDark ? 0.45 : 0.2)}`,
          "&::before": {
            content: '""',
            position: "absolute",
            top: -120,
            right: -120,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              `radial-gradient(circle, ${alpha(primaryLight, 0.45)} 0%, ${alpha(primaryLight, 0)} 70%)`,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            bottom: -140,
            left: -120,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              `radial-gradient(circle, ${alpha(primaryMain, 0.35)} 0%, ${alpha(primaryMain, 0)} 70%)`,
          },
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: "rgba(255,255,255,0.78)" }}
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
                    bgcolor: "rgba(255,255,255,0.22)",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                />
              <Chip
                  label="Live Risk Insights"
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.16)",
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
            <Card
              sx={{
                height: "100%",
                color: "#fff",
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #38bdf8 100%)",
                boxShadow: "0 18px 40px rgba(30,64,175,0.35)",
                border: "1px solid rgba(255,255,255,0.2)",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                },
              }}
            >
              <CardContent>
                <Typography>Total Students</Typography>
                <Typography variant="h4">{totalStudents}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card
              sx={{
                height: "100%",
                color: "#fff",
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, #991b1b 0%, #dc2626 55%, #f87171 100%)",
                boxShadow: "0 18px 40px rgba(185,28,28,0.35)",
                border: "1px solid rgba(255,255,255,0.2)",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.14)",
                },
              }}
            >
              <CardContent>
                <Typography>High Risk</Typography>
                <Typography variant="h4">{highRisk}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card
              sx={{
                height: "100%",
                color: "#fff",
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #fb923c 100%)",
                boxShadow: "0 18px 40px rgba(234,88,12,0.35)",
                border: "1px solid rgba(255,255,255,0.2)",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.16)",
                },
              }}
            >
              <CardContent>
                <Typography>Medium Risk</Typography>
                <Typography variant="h4">{mediumRisk}</Typography>
              </CardContent>
            </Card>
          </Grid>

        <Grid item xs={12} md={3}>
            <Card
              sx={{
                height: "100%",
                color: "#fff",
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, #166534 0%, #16a34a 55%, #4ade80 100%)",
                boxShadow: "0 18px 40px rgba(22,163,74,0.35)",
                border: "1px solid rgba(255,255,255,0.2)",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.16)",
                },
              }}
            >
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
        <>
          <Paper
            sx={{
              ...sectionPaperSx,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "linear-gradient(90deg, #2563eb, #38bdf8, #a5f3fc)",
              }}
            />
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2.5}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
              mb={2}
            >
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Student Snapshot
                </Typography>
                <Typography variant="h6" mb={0.5}>Status and Details</Typography>
                <Typography variant="body2" color="text.secondary">
                  Logged student profile and current prediction status.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  label={!studentRecord ? "Record Not Loaded" : hasStudentPrediction ? "Prediction Ready" : "Prediction Pending"}
                  color={!studentRecord ? "default" : hasStudentPrediction ? "success" : "warning"}
                />
                <Chip
                  size="small"
                  label={`Reg No: ${studentRecord?.register_number || studentId || "Not set"}`}
                  variant="outlined"
                  sx={{ borderColor: borderStrong, color: textPrimary }}
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <TextField
                label="Registration Number"
                placeholder="Enter your reg no"
                value={studentRegNo}
                onChange={(event) => setStudentRegNo(event.target.value)}
                disabled={Boolean(studentId)}
                helperText={studentId ? "Loaded from your login" : ""}
                sx={{ minWidth: 240, ...inputSx }}
              />
              <Button
                variant="contained"
                onClick={handleStudentLookup}
                disabled={studentLookupLoading}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  px: 3,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                  boxShadow: `0 12px 24px ${alpha(primaryMain, 0.35)}`,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                    boxShadow: `0 14px 26px ${alpha(primaryMain, 0.45)}`,
                  },
                }}
              >
                View My Report
              </Button>
            </Stack>

            <Divider sx={{ my: 3, borderColor: borderSoft }} />

            {studentRecord ? (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      Student Name
                    </Typography>
                    <Typography fontWeight={700}>{studentRecord.name || "Not available"}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      Register Number
                    </Typography>
                    <Typography fontWeight={700}>{studentRecord.register_number || "Not available"}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      Year / Semester
                    </Typography>
                    <Typography fontWeight={700}>
                      {studentRecord.year || "N/A"} / {studentRecord.semester || "N/A"}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      Attendance
                    </Typography>
                    <Typography fontWeight={700}>
                      {studentRecord.attendance ?? "N/A"}%
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      CGPA
                    </Typography>
                    <Typography fontWeight={700}>{studentRecord.cgpa ?? "N/A"}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={infoCardSx}>
                    <Typography variant="caption" color="text.secondary">
                      Dropout Risk
                    </Typography>
                    <Typography fontWeight={700}>
                      {Number.isFinite(studentRiskScore)
                        ? `${(studentRiskScore * 100).toFixed(1)}%`
                        : "Pending"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                Enter your registration number to load student details.
              </Alert>
            )}
          </Paper>

          <Paper
            sx={{
              ...sectionPaperSx,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "linear-gradient(90deg, #14b8a6, #22c55e, #a3e635)",
              }}
            />
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
              mb={2}
            >
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Student Support
                </Typography>
                <Typography variant="h6" mb={0.5}>Support Request</Typography>
                <Typography variant="body2" color="text.secondary">
                  Send a query to your faculty advisor for academic or counselling support.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Faculty: ${studentRecord?.faculty_id || queryFacultyId || "Unassigned"}`}
                  variant="outlined"
                  sx={{ borderColor: borderStrong, color: textPrimary }}
                />
              </Stack>
            </Stack>
            <Stack spacing={2}>
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
                sx={inputSx}
              />
              <TextField
                label="Describe your concern"
                multiline
                minRows={3}
                value={queryReason}
                onChange={(event) => setQueryReason(event.target.value)}
                fullWidth
                sx={inputSx}
              />
              <Box>
                <Button
                  variant="contained"
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    px: 3,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                    boxShadow: `0 12px 24px ${alpha(primaryMain, 0.35)}`,
                    "&:hover": {
                      background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                      boxShadow: `0 14px 26px ${alpha(primaryMain, 0.45)}`,
                    },
                  }}
                  disabled={!studentRecord || !String(studentRecord?.faculty_id || queryFacultyId || "").trim()}
                  onClick={handleSubmitQuery}
                >
                  Submit Query
                </Button>
              </Box>
            </Stack>
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

            <Divider sx={{ my: 3, borderColor: borderSoft }} />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
              mb={2}
            >
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
                  Support History
                </Typography>
                <Typography variant="h6" mb={0.5}>My Support Queries</Typography>
                <Typography variant="body2" color="text.secondary">
                  Track the status of your requests and responses.
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`Total: ${studentScopedRequests.length}`}
                variant="outlined"
              />
            </Stack>
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
                  <Paper
                    key={request.id}
                    sx={{
                      p: 2,
                      bgcolor: alpha(surface, isDark ? 0.6 : 0.92),
                      border: `1px solid ${borderSoft}`,
                      boxShadow: `0 10px 20px ${alpha(theme.palette.common.black, isDark ? 0.25 : 0.06)}`,
                      borderRadius: 3,
                    }}
                  >
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
        </>
      )}

      {isStudent && (
        <Paper sx={{ ...sectionPaperSx }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Cohort health and prediction coverage at a glance.
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  <Chip size="small" label="Faculty" color="info" sx={{ fontWeight: 600 }} />
                  <Chip
                    size="small"
                    label={`Open Requests: ${pendingRequestsCount}`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`Predictions Pending: ${pendingPredictionCount}`}
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  sx={snapshotCardSx}
                >
                  <Typography variant="caption" color="text.secondary">
                    Faculty ID
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {facultyId || "Not linked"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mapped to your profile.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  sx={snapshotCardSx}
                >
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ wordBreak: "break-word" }}>
                    {email || "Not available"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Used for alerts and exports.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={snapshotCardSx}>
                  <Typography variant="caption" color="text.secondary">
                    Mapped Students
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {students.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active cohort size.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.warning.main, isDark ? 0.45 : 0.35),
                    bgcolor: alpha(theme.palette.warning.light, isDark ? 0.14 : 0.2),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Predictions Pending
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {pendingPredictionCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {predictedCount} already predicted.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.info.main, isDark ? 0.4 : 0.3),
                    bgcolor: alpha(theme.palette.info.light, isDark ? 0.12 : 0.18),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Open Requests
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {pendingRequestsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pending counselling actions.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.error.main, isDark ? 0.4 : 0.3),
                    bgcolor: alpha(theme.palette.error.light, isDark ? 0.12 : 0.18),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Risk Mix
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.8}>
                    <Chip
                      size="small"
                      label={`High ${highRisk}`}
                      color="error"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`Med ${mediumRisk}`}
                      color="warning"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`Low ${lowRisk}`}
                      color="success"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Distribution for mapped students.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          {/* ================= ACTION SECTION ================= */}
          <Paper sx={{ ...sectionPaperSx }}>
            <Typography variant="h6" mb={2}>⚡ Faculty AI Actions</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <BatchPredictButton reload={fetchStudents} />
              <Button variant="outlined" onClick={handleExportCsv}>
                Export Prediction Summary (Share with Admin)
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ ...sectionPaperSx }}>
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
          <Paper sx={{ ...sectionPaperSx }}>
            <Typography variant="h6" mb={2}>📊 Risk Analytics Overview</Typography>
            <RiskCharts students={students} />
          </Paper>

          {/* ================= HIGH RISK ALERTS ================= */}
          <Paper sx={{ ...sectionPaperSx }}>
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
          <Paper sx={{ ...sectionPaperSx }}>
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
          <Paper sx={{ ...sectionPaperSx, overflowX: "auto" }}>
            <Typography variant="h6" mb={2}>📋 Student Management</Typography>
            <StudentList
              students={students}
              reload={fetchStudents}
            />
          </Paper>

          <Paper sx={{ ...sectionPaperSx, mt: 4 }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Portfolio coverage and intervention load at a glance.
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  <Chip size="small" label="Administrator" color="primary" sx={{ fontWeight: 600 }} />
                  <Chip size="small" label={`Total Students: ${students.length}`} variant="outlined" />
                  <Chip
                    size="small"
                    label={`Predictions Pending: ${pendingPredictionCount}`}
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={snapshotCardSx}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ wordBreak: "break-word" }}>
                    {email || "Not available"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Used for admin alerts and exports.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={snapshotCardSx}>
                  <Typography variant="caption" color="text.secondary">
                    Faculty Count
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {facultyOptions.length > 1 ? facultyOptions.length - 1 : 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active faculty groups.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={snapshotCardSx}>
                  <Typography variant="caption" color="text.secondary">
                    Total Students
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {students.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active population.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.warning.main, isDark ? 0.45 : 0.35),
                    bgcolor: alpha(theme.palette.warning.light, isDark ? 0.14 : 0.2),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Predictions Pending
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {pendingPredictionCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {predictedCount} already predicted.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.error.main, isDark ? 0.4 : 0.3),
                    bgcolor: alpha(theme.palette.error.light, isDark ? 0.12 : 0.18),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    High Risk Students
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {highRisk}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Immediate outreach focus.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    ...snapshotCardSx,
                    borderColor: alpha(theme.palette.info.main, isDark ? 0.4 : 0.3),
                    bgcolor: alpha(theme.palette.info.light, isDark ? 0.12 : 0.18),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Risk Mix
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.8}>
                    <Chip size="small" label={`High ${highRisk}`} color="error" variant="outlined" />
                    <Chip size="small" label={`Med ${mediumRisk}`} color="warning" variant="outlined" />
                    <Chip size="small" label={`Low ${lowRisk}`} color="success" variant="outlined" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Distribution across all faculties.
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
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
              mb={2}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" sx={{ letterSpacing: 2.5, color: "text.secondary" }}>
                  Student Visuals
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Search to view a student's full graphical status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter a name or register number to load detailed charts.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ minWidth: { xs: "100%", md: 420 } }}>
                <TextField
                  label="Search student (name or reg no)"
                  value={adminSearchQuery}
                  onChange={(event) => setAdminSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setAdminSearchTerm(adminSearchQuery.trim());
                    }
                  }}
                  sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}
                />
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={() => setAdminSearchTerm(adminSearchQuery.trim())}
                    disabled={adminSearchQuery.trim() === adminSearchTerm.trim()}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setAdminSearchQuery("");
                      setAdminSearchTerm("");
                    }}
                    disabled={!adminSearchQuery.trim() && !adminSearchTerm.trim()}
                  >
                    Clear
                  </Button>
                </Stack>
              </Stack>
            </Stack>

            {!normalizedAdminQuery && (
              <Alert severity="info">
                Search and click Apply to view a student's full graphical status.
              </Alert>
            )}

            {normalizedAdminQuery && filteredAdminStudents.length === 0 && (
              <Alert severity="warning">
                No students match that search. Try a different name or register number.
              </Alert>
            )}

            {normalizedAdminQuery && filteredAdminStudents.length > 1 && (
              <Alert severity="info">
                Multiple students match. Refine your search to a single student to view charts.
              </Alert>
            )}

            {selectedAdminStudent && (
              <Box mt={2}>
                <StudentReportCharts student={selectedAdminStudent} />
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>🧾 Student Records</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                Search above and click Apply to filter. Showing {filteredAdminStudents.length} student(s).
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
