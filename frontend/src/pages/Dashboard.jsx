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
} from "@mui/material";
import StudentList from "./StudentList";
import BatchPredictButton from "../components/BatchPredictButton";
import RiskCharts from "../components/RiskChart";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Container sx={{ mt: 4, mb: 4 }}>

      {/* ================= HEADER SECTION ================= */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          🎓 AI Student Dropout Dashboard
        </Typography>

        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate("/students/add")}
        >
          + Add New Student
        </Button>
      </Box>

      {/* ================= KPI SUMMARY CARDS ================= */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: "#1976d2", color: "#fff" }}>
            <CardContent>
              <Typography>Total Students</Typography>
              <Typography variant="h4">{totalStudents}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: "#d32f2f", color: "#fff" }}>
            <CardContent>
              <Typography>High Risk</Typography>
              <Typography variant="h4">{highRisk}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: "#f57c00", color: "#fff" }}>
            <CardContent>
              <Typography>Medium Risk</Typography>
              <Typography variant="h4">{mediumRisk}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: "#2e7d32", color: "#fff" }}>
            <CardContent>
              <Typography>Low Risk</Typography>
              <Typography variant="h4">{lowRisk}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ================= ACTION SECTION ================= */}
      <Paper sx={{ p: 2, mb: 4, boxShadow: 3 }}>
        <Typography variant="h6" mb={2}>⚡ AI Actions</Typography>
        <BatchPredictButton reload={fetchStudents} />
      </Paper>

      {/* ================= RISK ANALYTICS SECTION ================= */}
      <Paper sx={{ p: 2, mb: 4, boxShadow: 3 }}>
        <Typography variant="h6" mb={2}>📊 Risk Analytics Overview</Typography>
        <RiskCharts students={students} />
      </Paper>

      {/* ================= COUNSELLING INSIGHTS SECTION ================= */}
      <Paper sx={{ p: 2, mb: 4, boxShadow: 3, bgcolor: "#f5f5f5" }}>
        <Typography variant="h6" mb={2}>🧠 Counselling Insights</Typography>
        <Typography>
          High-risk students should be contacted for counselling sessions. 
          AI identifies students with attendance issues, low CGPA, and unpaid fees.
        </Typography>
        <Button
          sx={{ mt: 2 }}
          variant="outlined"
          color="primary"
          onClick={() => navigate("/counselling")}
        >
          View Counselling Requests
        </Button>
      </Paper>

      {/* ================= STUDENT MANAGEMENT SECTION ================= */}
      <Paper sx={{ p: 2, boxShadow: 3, overflowX: "auto" }}>
        <Typography variant="h6" mb={2}>📋 Student Management</Typography>

        <StudentList
          students={students}
          reload={fetchStudents}
          onDelete={handleDeleteStudent}
        />
      </Paper>

    </Container>
  );
};

export default Dashboard;
