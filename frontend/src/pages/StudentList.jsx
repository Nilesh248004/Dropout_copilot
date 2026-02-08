// src/pages/StudentList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  CircularProgress,
  Chip,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { filterStudentsByFaculty } from "../utils/faculty";
import { getRiskLevel, getRiskScore } from "../utils/risk";
import { toIsoFromLocalDateTime } from "../utils/date";

const StudentList = ({ students: propStudents, reload, counsellingRequests, onCounsellingUpdate }) => {
  const { role, facultyId } = useRole();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const textPrimary = theme.palette.text.primary;
  const surface = theme.palette.background.paper;
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const borderSoft = alpha(textPrimary, isDark ? 0.2 : 0.12);
  const borderStrong = alpha(textPrimary, isDark ? 0.35 : 0.18);
  const glassSurface = alpha(surface, isDark ? 0.75 : 0.95);
  const tableHeaderBg = alpha(theme.palette.primary.main, isDark ? 0.2 : 0.08);
  const hideOnXs = { display: { xs: "none", sm: "table-cell" } };
  const hideOnSmDown = { display: { xs: "none", md: "table-cell" } };
  const [students, setStudents] = useState(propStudents || []);
  const [loading, setLoading] = useState(!Array.isArray(propStudents));
  const [predictingId, setPredictingId] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignDate, setAssignDate] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignClassroom, setAssignClassroom] = useState("");
  const [assignClassroomCustom, setAssignClassroomCustom] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assignStatus, setAssignStatus] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignMode, setAssignMode] = useState("");
  const classroomOptions = ["ME 303", "EW201", "EW203", "WW202", "WW203"];

  const counsellingByStudent = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(counsellingRequests)) return map;
    counsellingRequests.forEach((request) => {
      const studentId = request?.student_id;
      if (!studentId) return;
      const hasCounsellingData =
        String(request?.meet_link || "").trim().length > 0 ||
        Boolean(request?.scheduled_at);
      if (!hasCounsellingData) return;
      const ts = new Date(request.request_date || request.scheduled_at || 0).getTime();
      const existing = map.get(studentId);
      if (!existing || ts > existing._ts) {
        map.set(studentId, { ...request, _ts: ts });
      }
    });
    return map;
  }, [counsellingRequests]);

  const riskSummary = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    let assigned = 0;
    let completed = 0;
    students.forEach((student) => {
      const level = String(getRiskLevel(student) || "").toUpperCase();
      if (level === "HIGH") high += 1;
      else if (level === "MEDIUM") medium += 1;
      else if (level === "LOW") low += 1;
    });
    Array.from(counsellingByStudent.values()).forEach((request) => {
      const status = String(request?.status || "").toUpperCase();
      if (status === "SCHEDULED") assigned += 1;
      if (status === "COMPLETED") completed += 1;
    });
    return { high, medium, low, assigned, completed };
  }, [students, counsellingByStudent]);

  // ================= FETCH STUDENTS ==================
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
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
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [role, facultyId]);

  useEffect(() => {
    if (Array.isArray(propStudents)) {
      const scoped =
        role === "faculty" ? filterStudentsByFaculty(propStudents, facultyId) : propStudents;
      setStudents(scoped);
      setLoading(false);
      return;
    }
    fetchStudents();
  }, [propStudents, fetchStudents, role, facultyId]);

  useEffect(() => {
    if (Array.isArray(propStudents)) return;
    const handleFocus = () => fetchStudents();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [propStudents, fetchStudents]);

  // ================= RUN PREDICTION ==================
  const runPrediction = async (studentId) => {
    try {
      setPredictingId(studentId);
      const res = await axios.post(`${API_BASE_URL}/predict/${studentId}`);
      const data = res.data;

      alert(`Risk: ${data.risk_level} | Score: ${(data.risk_score * 100).toFixed(2)}%`);

      if (reload) await reload();
      if (!Array.isArray(propStudents)) {
        await fetchStudents(); // refresh UI
      }
      if (onCounsellingUpdate) {
        await onCounsellingUpdate();
      }
    } catch (err) {
      console.error("Prediction Error:", err);
      const message = err.response?.data?.error || "Prediction failed";
      alert(message);
    } finally {
      setPredictingId(null);
    }
  };

  const openAssignDialog = (student, riskLevel) => {
    setAssignTarget(student);
    setAssignDate("");
    setAssignLink("");
    setAssignClassroom("");
    setAssignClassroomCustom("");
    setAssignReason(
      riskLevel ? `${riskLevel} risk counselling session` : "Counselling session"
    );
    setAssignMode(riskLevel === "HIGH" ? "OFFLINE" : "ONLINE");
    setAssignStatus(null);
    setAssignDialogOpen(true);
  };

  const closeAssignDialog = () => {
    if (assigning) return;
    setAssignDialogOpen(false);
  };

  const handleAssignCounselling = async () => {
    if (!assignTarget?.id) return;
    if (!facultyId) {
      setAssignStatus({
        type: "error",
        message: "Faculty ID is required to schedule counselling.",
      });
      return;
    }
    const scheduledAt = toIsoFromLocalDateTime(assignDate);
    if (!scheduledAt) {
      setAssignStatus({
        type: "error",
        message: "Date/time is required.",
      });
      return;
    }
    if (assignMode === "ONLINE" && !assignLink.trim()) {
      setAssignStatus({
        type: "error",
        message: "Google Meet link is required for online counselling.",
      });
      return;
    }
    const resolvedClassroom =
      assignClassroomCustom.trim() || assignClassroom.trim();
    if (assignMode === "OFFLINE" && !resolvedClassroom) {
      setAssignStatus({
        type: "error",
        message: "Classroom is required for offline counselling.",
      });
      return;
    }

    try {
      setAssigning(true);
      setAssignStatus(null);
      await axios.post(`${API_BASE_URL}/counselling/assign`, {
        student_id: assignTarget.id,
        faculty_id: facultyId,
        scheduled_at: scheduledAt,
        scheduled_at_local: assignDate,
        meet_link: assignMode === "ONLINE" ? assignLink.trim() : "",
        classroom: assignMode === "OFFLINE" ? resolvedClassroom : "",
        counselling_mode: assignMode,
        reason: assignReason.trim(),
      });
      setAssignStatus({
        type: "success",
        message: "Counselling session scheduled successfully.",
      });
      if (onCounsellingUpdate) {
        await onCounsellingUpdate();
      }
    } catch (err) {
      setAssignStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to schedule counselling.",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkCompleted = async (requestId) => {
    if (!requestId) return;
    try {
      await axios.put(`${API_BASE_URL}/counselling/${requestId}`, { status: "COMPLETED" });
      if (onCounsellingUpdate) {
        await onCounsellingUpdate();
      }
    } catch (err) {
      console.error("Update counselling status error:", err.message);
      alert(err.response?.data?.error || "Unable to mark counselling as completed.");
    }
  };

  // ================= CHIP COLOR ==================
  const riskColor = (level, score) => {
    const normalized = level?.toUpperCase();
    if (normalized === "HIGH") return "error";
    if (normalized === "MEDIUM") return "warning";
    if (normalized === "LOW") return "success";
    if (Number.isFinite(score)) {
      if (score > 0.7) return "error";
      if (score > 0.4) return "warning";
      return "success";
    }
    return "default";
  };

  const hasCompleteAcademic = (s) =>
    s.attendance !== null &&
    s.attendance !== undefined &&
    s.cgpa !== null &&
    s.cgpa !== undefined &&
    s.arrear_count !== null &&
    s.arrear_count !== undefined &&
    s.fees_paid !== null &&
    s.fees_paid !== undefined;

  if (role === "faculty" && !facultyId) {
    return (
      <Alert severity="warning">
        Faculty ID is required to load your students. Please sign in again.
      </Alert>
    );
  }

  if (loading) return <CircularProgress />;

  return (
    <Paper
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 4,
        border: `1px solid ${borderSoft}`,
        background: glassSurface,
        boxShadow: `0 20px 45px ${alpha(theme.palette.common.black, isDark ? 0.45 : 0.08)}`,
      }}
    >
      <Stack spacing={2} mb={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: 3, color: "text.secondary" }}>
              Enterprise Student Console
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
              Student List
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor risk signals, counselling flow, and interventions in one view.
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`Total: ${students.length}`}
            variant="outlined"
            sx={{ borderColor: borderStrong, fontWeight: 600 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`High ${riskSummary.high}`} color="error" variant="outlined" />
          <Chip size="small" label={`Medium ${riskSummary.medium}`} color="warning" variant="outlined" />
          <Chip size="small" label={`Low ${riskSummary.low}`} color="success" variant="outlined" />
          <Chip size="small" label={`Assigned ${riskSummary.assigned}`} color="info" variant="outlined" />
          <Chip size="small" label={`Completed ${riskSummary.completed}`} variant="outlined" />
        </Stack>
      </Stack>

      {isMobile && (
        <Stack spacing={2} sx={{ mb: 2 }}>
          {students.map((s) => {
            const riskScore = getRiskScore(s);
            const riskLevelRaw = getRiskLevel(s);
            const riskLevelNormalized =
              typeof riskLevelRaw === "string" ? riskLevelRaw.toUpperCase() : null;
            const hasPrediction =
              riskLevelNormalized !== null &&
              ["HIGH", "MEDIUM", "LOW"].includes(riskLevelNormalized);
            const isLowRisk = riskLevelNormalized === "LOW";
            const canAssign =
              role === "faculty" &&
              ["HIGH", "MEDIUM"].includes(riskLevelNormalized || "");
            const counsellingEntry = counsellingByStudent.get(s.id);
            const counsellingStatusRaw = counsellingEntry?.status || "";
            const counsellingStatusNormalized = String(counsellingStatusRaw).toUpperCase();
            const hasScheduled = counsellingStatusNormalized === "SCHEDULED";
            const assignColor = riskLevelNormalized === "HIGH" ? "error" : "warning";
            const isPredicting = predictingId === s.id;
            const feeLabel =
              s.fees_paid === null || s.fees_paid === undefined
                ? "N/A"
                : s.fees_paid
                  ? "Yes"
                  : "No";

            return (
              <Paper
                key={s.id}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: `1px solid ${borderSoft}`,
                  background: alpha(surface, isDark ? 0.7 : 0.96),
                  boxShadow: `0 14px 26px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.06)}`,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {s.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.register_number || "--"}
                    </Typography>
                  </Box>
                  {hasPrediction && riskScore !== null ? (
                    <Chip
                      label={`${(riskScore * 100).toFixed(1)}% ${riskLevelNormalized || ""}`.trim()}
                      color={riskColor(riskLevelNormalized, riskScore)}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  ) : (
                    <Chip
                      label={hasCompleteAcademic(s) ? "Not Predicted" : "Incomplete"}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>

                <Stack spacing={0.6} mt={1.2}>
                  <Typography variant="body2" color="text.secondary">
                    Year/Sem: {s.year} / {s.semester}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Attendance: {s.attendance ?? "N/A"} | CGPA: {s.cgpa ?? "N/A"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Arrears: {s.arrear_count ?? "N/A"} | Fees: {feeLabel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Disciplinary: {s.disciplinary_issues ?? "N/A"}
                  </Typography>
                  {s.phone_number && (
                    <Typography variant="body2" color="text.secondary">
                      Phone: {s.phone_number}
                    </Typography>
                  )}
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => runPrediction(s.id)}
                    disabled={isPredicting || !hasCompleteAcademic(s)}
                    color={hasPrediction ? "success" : "primary"}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    {isPredicting ? "Predicting..." : hasPrediction ? "Predicted" : "Predict"}
                  </Button>
                  {isLowRisk ? (
                    <Chip label="Low risk" size="small" variant="outlined" />
                  ) : hasScheduled ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color="info"
                      onClick={() => handleMarkCompleted(counsellingEntry?.id)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Mark Completed
                    </Button>
                  ) : counsellingStatusNormalized === "COMPLETED" ? (
                    <Chip label="Completed" size="small" color="success" />
                  ) : counsellingStatusNormalized === "CANCELLED" ? (
                    <Chip label="Cancelled" size="small" color="error" variant="outlined" />
                  ) : canAssign ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color={assignColor}
                      onClick={() => openAssignDialog(s, riskLevelNormalized)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Assign Counselling
                    </Button>
                  ) : (
                    <Chip label="No counselling" size="small" variant="outlined" />
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {!isMobile && (
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 3,
          border: `1px solid ${borderSoft}`,
          overflowX: "auto",
          background: alpha(surface, isDark ? 0.65 : 0.9),
          boxShadow: `0 14px 30px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.06)}`,
        }}
      >
        <Table sx={{ minWidth: { xs: 720, sm: 960, md: 1200 } }} size="medium">
          <TableHead>
            <TableRow sx={{ background: tableHeaderBg }}>
              {[
                { label: "Name" },
                { label: "Reg No" },
                { label: "Year", sx: hideOnXs },
                { label: "Sem", sx: hideOnXs },
                { label: "Phone", sx: hideOnSmDown },
                { label: "Attendance", sx: hideOnSmDown },
                { label: "CGPA", sx: hideOnSmDown },
                { label: "Arrears", sx: hideOnSmDown },
                { label: "Fees", sx: hideOnSmDown },
                { label: "Disciplinary", sx: hideOnSmDown },
                { label: "Risk Score" },
                { label: "Counselling" },
                { label: "Actions" },
              ].map(({ label, sx }) => (
                <TableCell
                  key={label}
                  sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontSize: 12,
                    color: "text.secondary",
                    ...(sx || {}),
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {students.map((s, index) => {
              const riskScore = getRiskScore(s);
              const riskLevelRaw = getRiskLevel(s);
              const riskLevelNormalized =
                typeof riskLevelRaw === "string" ? riskLevelRaw.toUpperCase() : null;
              const hasPrediction =
                riskLevelNormalized !== null &&
                ["HIGH", "MEDIUM", "LOW"].includes(riskLevelNormalized);
              const isLowRisk = riskLevelNormalized === "LOW";
              const canAssign =
                role === "faculty" &&
                ["HIGH", "MEDIUM"].includes(riskLevelNormalized || "");
              const counsellingEntry = counsellingByStudent.get(s.id);
              const counsellingStatusRaw = counsellingEntry?.status || "";
              const counsellingStatusNormalized = String(counsellingStatusRaw).toUpperCase();
              const hasScheduled = counsellingStatusNormalized === "SCHEDULED";
              const assignColor = riskLevelNormalized === "HIGH" ? "error" : "warning";
              const isPredicting = predictingId === s.id;
              return (
              <TableRow
                key={s.id}
                sx={{
                  backgroundColor: index % 2 === 1
                    ? alpha(surface, isDark ? 0.15 : 0.45)
                    : "transparent",
                  "& td": {
                    py: 1.6,
                    borderBottom: `1px solid ${borderSoft}`,
                  },
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.06),
                  },
                }}
              >
              <TableCell>
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.register_number || "--"}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>{s.register_number}</TableCell>
              <TableCell align="center" sx={hideOnXs}>{s.year}</TableCell>
              <TableCell align="center" sx={hideOnXs}>{s.semester}</TableCell>
              <TableCell sx={hideOnSmDown}>{s.phone_number ?? "N/A"}</TableCell>
              <TableCell align="center" sx={hideOnSmDown}>{s.attendance ?? "N/A"}</TableCell>
              <TableCell align="center" sx={hideOnSmDown}>{s.cgpa ?? "N/A"}</TableCell>
              <TableCell align="center" sx={hideOnSmDown}>{s.arrear_count ?? "N/A"}</TableCell>
              <TableCell align="center" sx={hideOnSmDown}>
                {s.fees_paid === null || s.fees_paid === undefined ? "N/A" : s.fees_paid ? "Yes" : "No"}
              </TableCell>
              <TableCell align="center" sx={hideOnSmDown}>{s.disciplinary_issues ?? "N/A"}</TableCell>

                {/* Show prediction score */}
                <TableCell align="center">
                  {hasPrediction && riskScore !== null ? (
                    <Chip
                      label={`${(riskScore * 100).toFixed(2)}% - ${riskLevelNormalized || "Pending"}`}
                      color={riskColor(riskLevelNormalized, riskScore)}
                      sx={{ fontWeight: 700 }}
                    />
                  ) : hasCompleteAcademic(s) ? "Not Predicted" : "Incomplete Data"}
                </TableCell>

                <TableCell align="center">
                  {isLowRisk ? (
                    <Typography variant="caption" color="text.secondary">
                      --
                    </Typography>
                  ) : hasScheduled ? (
                    <Button
                      variant="contained"
                      size="small"
                      color="info"
                      onClick={() => handleMarkCompleted(counsellingEntry?.id)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Assigned
                    </Button>
                  ) : counsellingStatusNormalized === "COMPLETED" ? (
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      disabled
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        "&.Mui-disabled": {
                          color: "#fff",
                          bgcolor: alpha(theme.palette.success.main, isDark ? 0.7 : 0.85),
                        },
                      }}
                    >
                      Completed
                    </Button>
                  ) : counsellingStatusNormalized === "CANCELLED" ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      disabled
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Cancelled
                    </Button>
                  ) : canAssign ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color={assignColor}
                      onClick={() => openAssignDialog(s, riskLevelNormalized)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Assign Counselling
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      --
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => runPrediction(s.id)}
                      disabled={isPredicting || !hasCompleteAcademic(s)}
                      color={hasPrediction ? "success" : "primary"}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {isPredicting ? "Predicting..." : hasPrediction ? "Predicted" : "Predict"}
                    </Button>
                  </Stack>
                </TableCell>

              </TableRow>
            )})}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Dialog
        open={assignDialogOpen}
        onClose={closeAssignDialog}
        fullWidth
        maxWidth="sm"
      >
      <DialogTitle>Schedule Counselling Session</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Student: {assignTarget?.name || "Student"}
          </Typography>
          {assignMode && (
            <Chip
              size="small"
              label={assignMode === "OFFLINE" ? "Offline Counselling" : "Online Counselling"}
              color={assignMode === "OFFLINE" ? "warning" : "info"}
              variant="outlined"
              sx={{ alignSelf: "flex-start", fontWeight: 600 }}
            />
          )}
          <TextField
            label="Date & Time"
            type="datetime-local"
            value={assignDate}
            onChange={(event) => setAssignDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          {assignMode === "ONLINE" ? (
            <TextField
              label="Google Meet Link"
              value={assignLink}
              onChange={(event) => setAssignLink(event.target.value)}
              placeholder="https://meet.google.com/..."
              fullWidth
            />
          ) : (
            <TextField
              label="Classroom"
              select
              value={assignClassroom}
              onChange={(event) => setAssignClassroom(event.target.value)}
              fullWidth
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => selected || "Select classroom",
              }}
              InputLabelProps={{ shrink: true }}
              helperText="Select the classroom for offline counselling"
            >
              <MenuItem value="" disabled>
                Select classroom
              </MenuItem>
              {classroomOptions.map((room) => (
                <MenuItem key={room} value={room}>
                  {room}
                </MenuItem>
              ))}
            </TextField>
          )}
          {assignMode === "OFFLINE" && (
            <TextField
              label="Custom Classroom (optional)"
              value={assignClassroomCustom}
              onChange={(event) => setAssignClassroomCustom(event.target.value)}
              placeholder="Type any classroom"
              fullWidth
              helperText="If filled, this overrides the dropdown selection."
            />
          )}
          <TextField
            label="Reason (optional)"
            value={assignReason}
            onChange={(event) => setAssignReason(event.target.value)}
            fullWidth
          />
            {assignStatus && (
              <Alert severity={assignStatus.type}>{assignStatus.message}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAssignDialog} disabled={assigning}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignCounselling}
            disabled={assigning}
          >
            {assigning ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default StudentList;
