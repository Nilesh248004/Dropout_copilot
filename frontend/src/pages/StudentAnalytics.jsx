import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  MenuItem,
} from "@mui/material";
import RiskCharts from "../components/RiskChart";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { normalizeFacultyId } from "../utils/faculty";
import { getRiskScore } from "../utils/risk";

const StudentAnalytics = () => {
  const { id } = useParams();
  const { role, facultyId } = useRole();
  const [student, setStudent] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleLink, setScheduleLink] = useState("");
  const [scheduleClassroom, setScheduleClassroom] = useState("");
  const [scheduleClassroomCustom, setScheduleClassroomCustom] = useState("");
  const [scheduleReason, setScheduleReason] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMode, setScheduleMode] = useState("");
  const classroomOptions = ["ME 303", "EW201", "EW203", "WW202", "WW203"];

  useEffect(() => {
    let active = true;
    const fetchStudent = async () => {
      try {
        setLoading(true);
        setAccessDenied(false);
        const params =
          role === "faculty" && facultyId ? { faculty_id: facultyId } : undefined;
        const res = await axios.get(`${API_BASE_URL}/students/${id}/full`, { params });
        const data = res.data;
        if (role === "faculty" && facultyId) {
          const normalizedFaculty = normalizeFacultyId(facultyId);
          if (normalizeFacultyId(data?.faculty_id) !== normalizedFaculty) {
            if (active) {
              setStudent(null);
              setAccessDenied(true);
            }
            return;
          }
        }
        if (active) {
          setStudent(data);
        }
      } catch (error) {
        if (active) {
          if (role === "faculty") {
            setAccessDenied(true);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStudent();
    return () => {
      active = false;
    };
  }, [id, role, facultyId]);

  if (loading) return <div>Loading...</div>;
  if (accessDenied) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          You do not have access to this student's analytics.
        </Alert>
      </Container>
    );
  }
  if (!student) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Student record not found.</Alert>
      </Container>
    );
  }

  const riskScore = getRiskScore(student);
  const riskColor =
    riskScore === null ? "default" :
    riskScore > 0.7 ? "error" :
    riskScore > 0.4 ? "warning" : "success";

  const openScheduleDialog = () => {
    const level = riskScore > 0.7 ? "HIGH" : "MEDIUM";
    setScheduleReason(`${level} risk counselling session`);
    setScheduleDate("");
    setScheduleLink("");
    setScheduleClassroom("");
    setScheduleClassroomCustom("");
    setScheduleMode(level === "HIGH" ? "OFFLINE" : "ONLINE");
    setScheduleStatus(null);
    setScheduleOpen(true);
  };

  const closeScheduleDialog = () => {
    if (scheduling) return;
    setScheduleOpen(false);
  };

  const handleScheduleCounselling = async () => {
    const mappedFacultyId = role === "faculty" ? facultyId : student.faculty_id;
    if (!mappedFacultyId) {
      setScheduleStatus({ type: "error", message: "Faculty ID is required." });
      return;
    }
    if (!scheduleDate) {
      setScheduleStatus({
        type: "error",
        message: "Date/time is required.",
      });
      return;
    }
    if (scheduleMode === "ONLINE" && !scheduleLink.trim()) {
      setScheduleStatus({
        type: "error",
        message: "Google Meet link is required for online counselling.",
      });
      return;
    }
    const resolvedClassroom =
      scheduleClassroomCustom.trim() || scheduleClassroom.trim();
    if (scheduleMode === "OFFLINE" && !resolvedClassroom) {
      setScheduleStatus({
        type: "error",
        message: "Classroom is required for offline counselling.",
      });
      return;
    }
    try {
      setScheduling(true);
      setScheduleStatus(null);
      await axios.post(`${API_BASE_URL}/counselling/assign`, {
        student_id: student.id,
        faculty_id: mappedFacultyId,
        scheduled_at: scheduleDate,
        meet_link: scheduleMode === "ONLINE" ? scheduleLink.trim() : "",
        classroom: scheduleMode === "OFFLINE" ? resolvedClassroom : "",
        counselling_mode: scheduleMode,
        reason: scheduleReason.trim(),
      });
      setScheduleStatus({
        type: "success",
        message: "Counselling session scheduled successfully.",
      });
    } catch (err) {
      setScheduleStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to schedule counselling.",
      });
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" mb={2}>
        📊 Student Analytics - {student.name}
      </Typography>

      {/* BASIC INFO */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>Reg No: {student.register_number}</Grid>
          <Grid item xs={12} sm={6}>Year: {student.year}</Grid>
          <Grid item xs={12} sm={6}>Semester: {student.semester}</Grid>
          <Grid item xs={12} sm={6}>Attendance: {student.attendance}%</Grid>
          <Grid item xs={12} sm={6}>CGPA: {student.cgpa}</Grid>
        </Grid>
      </Paper>

      {/* RISK SCORE */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">Dropout Risk Score</Typography>
        <Chip
          label={riskScore === null ? "Pending" : `${(riskScore * 100).toFixed(2)}%`}
          color={riskColor}
          sx={{ fontSize: 20, p: 2 }}
        />
      </Paper>

      {/* RISK GRAPH */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">📈 Risk Analytics</Typography>
        <RiskCharts students={[student]} />
      </Paper>

      {/* COUNSELLING SECTION */}
      <Paper sx={{ p: 2, bgcolor: "#f9f9f9" }}>
        <Typography variant="h6">🧠 Counselling Recommendation</Typography>
        <Typography>
          {riskScore !== null && riskScore > 0.7
            ? "High risk detected. Counselling strongly recommended."
            : riskScore !== null && riskScore > 0.4
              ? "Medium risk detected. Counselling recommended."
              : "Student is performing normally."}
        </Typography>

        {role === "faculty" && riskScore !== null && riskScore > 0.4 ? (
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            onClick={openScheduleDialog}
          >
            Schedule Counselling Session
          </Button>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            Counselling assignment is available for medium and high-risk students.
          </Alert>
        )}
      </Paper>

      <Dialog open={scheduleOpen} onClose={closeScheduleDialog} fullWidth maxWidth="sm">
        <DialogTitle>Schedule Counselling Session</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {scheduleMode && (
              <Alert severity={scheduleMode === "OFFLINE" ? "warning" : "info"}>
                {scheduleMode === "OFFLINE"
                  ? "Offline counselling required for high-risk students."
                  : "Online counselling required for medium-risk students."}
              </Alert>
            )}
            <TextField
              label="Date & Time"
              type="datetime-local"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            {scheduleMode === "ONLINE" ? (
              <TextField
                label="Google Meet Link"
                value={scheduleLink}
                onChange={(event) => setScheduleLink(event.target.value)}
                placeholder="https://meet.google.com/..."
                fullWidth
              />
            ) : (
              <TextField
                label="Classroom"
                select
                value={scheduleClassroom}
                onChange={(event) => setScheduleClassroom(event.target.value)}
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
            {scheduleMode === "OFFLINE" && (
              <TextField
                label="Custom Classroom (optional)"
                value={scheduleClassroomCustom}
                onChange={(event) => setScheduleClassroomCustom(event.target.value)}
                placeholder="Type any classroom"
                fullWidth
                helperText="If filled, this overrides the dropdown selection."
              />
            )}
            <TextField
              label="Reason (optional)"
              value={scheduleReason}
              onChange={(event) => setScheduleReason(event.target.value)}
              fullWidth
            />
            {scheduleStatus && (
              <Alert severity={scheduleStatus.type}>{scheduleStatus.message}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeScheduleDialog} disabled={scheduling}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleScheduleCounselling}
            disabled={scheduling}
          >
            {scheduling ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StudentAnalytics;
