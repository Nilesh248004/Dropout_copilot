// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentRegNo, setStudentRegNo] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [queryReason, setQueryReason] = useState("");
  const [queryStatus, setQueryStatus] = useState(null);
  const [facultyFilter, setFacultyFilter] = useState("All Faculties");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");

  // ================= FETCH STUDENTS ==================
  
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:4000/students/full");
      setStudents(res.data);
    } catch (err) {
      console.error("Fetch Students Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // ================= DELETE STUDENT ==================
  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      await axios.delete(`http://localhost:4000/students/${studentId}`);
      await fetchStudents();
    } catch (err) {
      console.error("Delete Error:", err.message);
      alert("Failed to delete student.");
    }
  };

  // ================= DASHBOARD STATS ==================
  const totalStudents = students.length;
  const highRisk = students.filter(s => s.dropout_risk > 0.7).length;
  const mediumRisk = students.filter(s => s.dropout_risk > 0.4 && s.dropout_risk <= 0.7).length;
  const lowRisk = students.filter(s => s.dropout_risk <= 0.4).length;
const isStudent = role === "student";
  const isFaculty = role === "faculty";
  const isAdmin = role === "admin";

  const facultyOptions = ["All Faculties", "Faculty Alpha", "Faculty Beta", "Faculty Gamma"];
  const getFacultyForStudent = (student) => {
    if (!student) return "Faculty Alpha";
    const mapping = [ "Faculty Alpha", "Faculty Beta", "Faculty Gamma" ];
    return mapping[(student.year || 1) % mapping.length];
  };

  const handleStudentLookup = () => {
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
    try {
      setQueryStatus(null);
      await axios.post("http://localhost:4000/counselling/book", {
        student_id: studentRecord.id,
        reason: queryReason || "Requesting support",
      });
      setQueryReason("");
      setQueryStatus("success");
    } catch (err) {
      console.error("Query submission error:", err.message);
      setQueryStatus("error");
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

  const handleAlertStudent = (student) => {
    alert(`Alert sent to ${student.name} for immediate support.`);
  };

  const handleNotifyFaculty = (student) => {
    alert(`Faculty notified to upgrade support for ${student.name}.`);
  };

  const filteredByFaculty = facultyFilter === "All Faculties"
    ? students
    : students.filter((student) => getFacultyForStudent(student) === facultyFilter);

  const normalizedAdminQuery = adminSearchQuery.trim().toLowerCase();
  const filteredAdminStudents = normalizedAdminQuery
    ? filteredByFaculty.filter((student) => {
        const name = student.name?.toLowerCase() || "";
        const regNo = student.register_number?.toLowerCase() || "";
        return name.includes(normalizedAdminQuery) || regNo.includes(normalizedAdminQuery);
      })
    : filteredByFaculty;

  const studentRiskColor =
    studentRecord?.dropout_risk > 0.7 ? "error" :
    studentRecord?.dropout_risk > 0.4 ? "warning" : "success";
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
            <Typography variant="h4">🎓 AI Student Dropout Copilot</Typography>
            <Typography variant="subtitle1" sx={{ color: "rgba(255,255,255,0.85)" }}>
              Role-based insights for {isStudent ? "students" : isFaculty ? "faculty" : "administrators"}.
            </Typography>
          </Box>
          {isFaculty && (
            <Button
              variant="contained"
              color="secondary"
              onClick={() => navigate("/students/add")}
            >
              + Add New Student
            </Button>
          )}
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
              sx={{ minWidth: 240 }}
            />
            <Button variant="contained" onClick={handleStudentLookup} disabled={loading}>
              View My Report
            </Button>
          </Stack>

      <Divider sx={{ my: 3 }} />

      {studentRecord ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" mb={1}>Student Snapshot</Typography>
                  <Stack spacing={1}>
                    <Typography><b>Name:</b> {studentRecord.name}</Typography>
                    <Typography><b>Year/Sem:</b> {studentRecord.year} / {studentRecord.semester}</Typography>
                    <Typography><b>Attendance:</b> {studentRecord.attendance ?? "N/A"}%</Typography>
                    <Typography><b>CGPA:</b> {studentRecord.cgpa ?? "N/A"}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" mb={1}>Prediction Status</Typography>
                  <Chip
                    label={`${((studentRecord.dropout_risk ?? 0) * 100).toFixed(2)}% - ${studentRecord.risk_level || "Pending"}`}
                    color={studentRiskColor}
                    sx={{ mb: 2 }}
                  />
                  <Typography>
                    Risk Insight: {studentRecord.dropout_risk > 0.6
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

<Typography variant="h6" mb={1}>🗂 Raise a Support Query</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Share your concern to request academic or counselling support.
          </Typography>
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
            disabled={!studentRecord}
            onClick={handleSubmitQuery}
          >
            Submit Query
          </Button>
          {queryStatus === "success" && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Your query has been sent. A faculty member will follow up soon.
            </Alert>
          )}
          {queryStatus === "error" && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Unable to submit your query right now. Please try again shortly.
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

          {/* ================= RISK ANALYTICS SECTION ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>📊 Risk Analytics Overview</Typography>
            <RiskCharts students={students} />
          </Paper>

          {/* ================= HIGH RISK ALERTS ================= */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" mb={2}>🚨 High-Risk Student Alerts</Typography>
            <Stack spacing={2}>
              {students.filter((s) => s.risk_level?.toUpperCase() === "HIGH").slice(0, 5).map((student) => (
                <Paper key={student.id} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography fontWeight={600}>{student.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {student.register_number} • Risk {(student.risk_score * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Button variant="contained" color="error" onClick={() => handleAlertStudent(student)}>
                    Alert Student
                  </Button>
                </Paper>
              ))}
              {students.filter((s) => s.risk_level?.toUpperCase() === "HIGH").length === 0 && (
                <Alert severity="success">No high-risk students right now. Great work!</Alert>
              )}
            </Stack>
          </Paper>

          {/* ================= STUDENT MANAGEMENT SECTION ================= */}
          <Paper sx={{ p: 3, boxShadow: 3, overflowX: "auto" }}>
            <Typography variant="h6" mb={2}>📋 Student Management</Typography>
            <StudentList
              students={students}
              reload={fetchStudents}
              onDelete={handleDeleteStudent}
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
                        <Button size="small" variant="outlined" onClick={() => handleNotifyFaculty(student)}>
                          Notify Faculty
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
