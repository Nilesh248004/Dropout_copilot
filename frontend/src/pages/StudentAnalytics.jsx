import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Container, Typography, Paper, Grid, Chip, Button, Alert
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

  const handleBookCounselling = async () => {
    const mappedFacultyId = role === "faculty" ? facultyId : student.faculty_id;
    if (!mappedFacultyId) {
      alert("Faculty ID is required to book counselling.");
      return;
    }
    await axios.post(`${API_BASE_URL}/counselling/book`, {
      student_id: id,
      faculty_id: mappedFacultyId,
    });
    alert("Counselling session requested.");
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" mb={2}>
        📊 Student Analytics - {student.name}
      </Typography>

      {/* BASIC INFO */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>Reg No: {student.register_number}</Grid>
          <Grid item xs={6}>Year: {student.year}</Grid>
          <Grid item xs={6}>Semester: {student.semester}</Grid>
          <Grid item xs={6}>Attendance: {student.attendance}%</Grid>
          <Grid item xs={6}>CGPA: {student.cgpa}</Grid>
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
          {riskScore !== null && riskScore > 0.6
            ? "High risk detected. Counselling strongly recommended."
            : "Student is performing normally."}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={handleBookCounselling}
        >
          Book Counselling Session
        </Button>
      </Paper>
    </Container>
  );
};

export default StudentAnalytics;
