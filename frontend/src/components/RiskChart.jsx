// src/components/RiskCharts.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Box, Typography, Paper, CircularProgress, Grid, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { getRiskLevel, getRiskScore } from "../utils/risk";

const RiskCharts = ({ students: propStudents }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const surface = theme.palette.background.paper;
  const borderSoft = alpha(textPrimary, isDark ? 0.2 : 0.12);
  const panelShadow = isDark
    ? "0 18px 45px rgba(0, 0, 0, 0.45)"
    : "0 18px 40px rgba(15, 23, 42, 0.08)";
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

  const chartGradientIds = useMemo(
    () => ({
      cgpa: `cgpa-${Math.random().toString(36).slice(2)}`,
      attendance: `attendance-${Math.random().toString(36).slice(2)}`,
      weekly: `weekly-${Math.random().toString(36).slice(2)}`,
    }),
    []
  );

  const hasStudents = students && students.length > 0;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!hasStudents) {
    return (
      <Typography variant="body2" color="text.secondary">
        No student data available to visualize yet.
      </Typography>
    );
  }

  // ================= DATA TRANSFORMATION =================
  const dropoutData = students.map((s) => {
    const riskScore = getRiskScore(s);
    const riskLevel = getRiskLevel(s);
    return {
      name: s.register_number || s.name || "Student",
      dropoutRisk: Number.isFinite(riskScore) ? riskScore * 100 : 0,
      riskLevel: riskLevel || "LOW",
    };
  });

  const cgpaData = students.map((s) => ({
    name: s.register_number || s.name || "Student",
    cgpa: Number.isFinite(Number(s.cgpa)) ? Number(s.cgpa) : 0,
  }));

  const attendanceData = students.map((s) => ({
    name: s.register_number || s.name || "Student",
    attendance: Number.isFinite(Number(s.attendance)) ? Number(s.attendance) : 0,
  }));

  const riskValues = students
    .map((s) => getRiskScore(s))
    .filter((value) => Number.isFinite(value));
  const averageRisk =
    riskValues.length > 0
      ? (riskValues.reduce((sum, value) => sum + value, 0) / riskValues.length) * 100
      : null;
  const cgpaValues = students
    .map((s) => Number(s.cgpa))
    .filter((value) => Number.isFinite(value));
  const attendanceValues = students
    .map((s) => Number(s.attendance))
    .filter((value) => Number.isFinite(value));
  const averageCgpa =
    cgpaValues.length > 0
      ? cgpaValues.reduce((sum, value) => sum + value, 0) / cgpaValues.length
      : null;
  const averageAttendance =
    attendanceValues.length > 0
      ? attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length
      : null;

  // ================= COLOR FUNCTION =================
  const riskColor = (level) => {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return theme.palette.error.main;
      case "MEDIUM":
        return theme.palette.warning.main;
      case "LOW":
      default:
        return theme.palette.success.main;
    }
  };

  const axisStyle = {
    fontSize: 11,
    fill: textSecondary,
  };
  const tooltipStyle = {
    backgroundColor: surface,
    borderRadius: 12,
    border: `1px solid ${borderSoft}`,
    boxShadow: panelShadow,
  };

  const summaryCards = [
    {
      label: "Avg Risk",
      value: Number.isFinite(averageRisk) ? `${averageRisk.toFixed(1)}%` : "N/A",
      color: theme.palette.error.main,
      sub: "Across predicted students",
    },
    {
      label: "Avg CGPA",
      value: Number.isFinite(averageCgpa) ? averageCgpa.toFixed(2) : "N/A",
      color: theme.palette.primary.main,
      sub: "Academic performance",
    },
    {
      label: "Avg Attendance",
      value: Number.isFinite(averageAttendance)
        ? `${averageAttendance.toFixed(1)}%`
        : "N/A",
      color: theme.palette.success.main,
      sub: "Lecture presence",
    },
  ];

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Grid container spacing={2}>
        {summaryCards.map((card) => (
          <Grid item xs={12} md={4} key={card.label}>
            <Paper
              sx={{
                p: 2.2,
                borderRadius: 3,
                border: `1px solid ${borderSoft}`,
                boxShadow: panelShadow,
                background: isDark
                  ? `linear-gradient(140deg, ${alpha(card.color, 0.18)} 0%, ${alpha(
                      surface,
                      0.9
                    )} 55%)`
                  : `linear-gradient(140deg, ${alpha(card.color, 0.12)} 0%, ${alpha(
                      surface,
                      0.98
                    )} 55%)`,
              }}
            >
              <Typography variant="overline" sx={{ letterSpacing: 2.5, color: textSecondary }}>
                {card.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {card.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {card.sub}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ================= DROPOUT RISK BAR CHART ================= */}
      <Paper
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: `1px solid ${borderSoft}`,
          boxShadow: panelShadow,
          background: isDark
            ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.16)} 0%, ${alpha(
                surface,
                0.9
              )} 65%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.08)} 0%, ${alpha(
                surface,
                0.98
              )} 65%)`,
        }}
      >
        <Stack spacing={0.6} mb={1.5}>
          <Typography variant="overline" sx={{ letterSpacing: 2.5, color: textSecondary }}>
            Risk Distribution
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Dropout Risk by Student (%)
          </Typography>
        </Stack>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dropoutData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={alpha(textSecondary, 0.12)} strokeDasharray="4 4" />
            <XAxis dataKey="name" tick={axisStyle} minTickGap={8} />
            <YAxis domain={[0, 100]} tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="dropoutRisk" name="Risk %" radius={[8, 8, 0, 0]} barSize={18}>
              {dropoutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={riskColor(entry.riskLevel)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <Grid container spacing={2}>
        {/* ================= CGPA TREND ================= */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${borderSoft}`,
              boxShadow: panelShadow,
              background: isDark
                ? `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(
                    surface,
                    0.88
                  )} 60%)`
                : `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
                    surface,
                    0.98
                  )} 60%)`,
            }}
          >
            <Stack spacing={0.6} mb={1.5}>
              <Typography variant="overline" sx={{ letterSpacing: 2.5, color: textSecondary }}>
                Academic Trend
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                CGPA Distribution
              </Typography>
            </Stack>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cgpaData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={chartGradientIds.cgpa} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={alpha(textSecondary, 0.12)} strokeDasharray="4 4" />
                <XAxis dataKey="name" tick={axisStyle} minTickGap={8} />
                <YAxis domain={[0, 10]} tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cgpa"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  fill={`url(#${chartGradientIds.cgpa})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* ================= ATTENDANCE TREND ================= */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${borderSoft}`,
              boxShadow: panelShadow,
              background: isDark
                ? `linear-gradient(140deg, ${alpha(theme.palette.success.main, 0.2)} 0%, ${alpha(
                    surface,
                    0.88
                  )} 60%)`
                : `linear-gradient(140deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(
                    surface,
                    0.98
                  )} 60%)`,
            }}
          >
            <Stack spacing={0.6} mb={1.5}>
              <Typography variant="overline" sx={{ letterSpacing: 2.5, color: textSecondary }}>
                Engagement Trend
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Attendance Coverage
              </Typography>
            </Stack>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={attendanceData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={chartGradientIds.attendance} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.palette.success.main} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={theme.palette.success.main} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={alpha(textSecondary, 0.12)} strokeDasharray="4 4" />
                <XAxis dataKey="name" tick={axisStyle} minTickGap={8} />
                <YAxis domain={[0, 100]} tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="attendance"
                  stroke={theme.palette.success.main}
                  strokeWidth={2}
                  fill={`url(#${chartGradientIds.attendance})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* ================= WEEKLY RISK TREND (OPTIONAL) ================= */}
      {weeklyRisk.length > 0 && (
        <Paper
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: `1px solid ${borderSoft}`,
            boxShadow: panelShadow,
            background: isDark
              ? `linear-gradient(140deg, ${alpha(theme.palette.error.main, 0.22)} 0%, ${alpha(
                  surface,
                  0.9
                )} 65%)`
              : `linear-gradient(140deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(
                  surface,
                  0.98
                )} 65%)`,
          }}
        >
          <Stack spacing={0.6} mb={1.5}>
            <Typography variant="overline" sx={{ letterSpacing: 2.5, color: textSecondary }}>
              Momentum
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Weekly Average Risk Trend
            </Typography>
          </Stack>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weeklyRisk} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={chartGradientIds.weekly} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.palette.error.main} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={theme.palette.error.main} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={alpha(textSecondary, 0.12)} strokeDasharray="4 4" />
              <XAxis dataKey="week" tick={axisStyle} />
              <YAxis domain={[0, 100]} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="risk"
                stroke={theme.palette.error.main}
                strokeWidth={2}
                fill={`url(#${chartGradientIds.weekly})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
};

export default RiskCharts;
