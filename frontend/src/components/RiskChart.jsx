// src/components/RiskCharts.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Typography, Paper, CircularProgress } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from "recharts";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { getRiskLevel, getRiskScore } from "../utils/risk";

const RiskCharts = ({ students: propStudents }) => {
  const { role, facultyId } = useRole();
  const [students, setStudents] = useState(propStudents || []);
  const [loading, setLoading] = useState(true);
  const [weeklyRisk, setWeeklyRisk] = useState([]);

  // ================= FETCH STUDENTS IF NOT PASSED FROM DASHBOARD =================
  useEffect(() => {
    if (propStudents && propStudents.length > 0) {
      setStudents(propStudents);
      setLoading(false);
      return;
    }

    const fetchStudents = async () => {
      try {
        const params = {};
        if (role === "faculty" && facultyId) {
          params.faculty_id = facultyId;
        }
        const res = await axios.get(`${API_BASE_URL}/students/full`, { params });
        setStudents(res.data);
      } catch (err) {
        console.error("Chart fetch error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [propStudents, role, facultyId]);

  // ================= FETCH WEEKLY RISK HISTORY (ALL STUDENTS AVG) =================
  useEffect(() => {
    const fetchWeeklyRisk = async () => {
      try {
        const params =
          role === "faculty" && facultyId ? { faculty_id: facultyId } : undefined;
        const res = await axios.get(`${API_BASE_URL}/students/risk/history`, { params });
        // Expected format: [{week: 'Week 1', avg_risk: 0.45}, ...]
        const formatted = res.data.map((d) => ({
          week: d.week,
          risk: (d.avg_risk * 100).toFixed(2),
        }));
        setWeeklyRisk(formatted);
      } catch (err) {
        console.warn("Weekly risk history not available yet.");
      }
    };

    fetchWeeklyRisk();
  }, [role, facultyId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  // ================= DATA TRANSFORMATION =================
  const dropoutData = students.map((s) => {
    const riskScore = getRiskScore(s);
    const riskLevel = getRiskLevel(s);
    return {
      name: s.register_number,
      dropoutRisk: riskScore ? riskScore * 100 : 0,
      riskLevel: riskLevel || "LOW",
    };
  });

  const cgpaData = students.map((s) => ({
    name: s.register_number,
    cgpa: s.cgpa || 0,
  }));

  const attendanceData = students.map((s) => ({
    name: s.register_number,
    attendance: s.attendance || 0,
  }));

  // ================= COLOR FUNCTION =================
  const riskColor = (level) => {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return "#d32f2f";
      case "MEDIUM":
        return "#f57c00";
      case "LOW":
      default:
        return "#2e7d32";
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={4}>

      {/* ================= DROPOUT RISK BAR CHART ================= */}
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        <Typography variant="h6" mb={1}>📊 Dropout Risk (%)</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dropoutData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="dropoutRisk" name="Risk %">
              {dropoutData.map((entry, index) => (
                <Cell key={index} fill={riskColor(entry.riskLevel)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* ================= CGPA TREND ================= */}
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        <Typography variant="h6" mb={1}>📈 CGPA Trend</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cgpaData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 10]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cgpa" stroke="#1976d2" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* ================= ATTENDANCE TREND ================= */}
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        <Typography variant="h6" mb={1}>📉 Attendance %</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={attendanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="attendance" stroke="#2e7d32" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* ================= WEEKLY RISK TREND (OPTIONAL) ================= */}
      {weeklyRisk.length > 0 && (
        <Paper sx={{ p: 2, boxShadow: 3 }}>
          <Typography variant="h6" mb={1}>🧠 Weekly Average Risk Trend</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyRisk}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="risk" stroke="#d32f2f" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

    </Box>
  );
};

export default RiskCharts;
