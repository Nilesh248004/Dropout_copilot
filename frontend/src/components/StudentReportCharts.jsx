import React from "react";
import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getRiskScore } from "../utils/risk";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const StudentReportCharts = ({ student }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const borderSoft = alpha(textPrimary, isDark ? 0.2 : 0.12);
  const cardShadow = isDark
    ? "0 18px 45px rgba(0, 0, 0, 0.45)"
    : "0 18px 40px rgba(15, 23, 42, 0.08)";

  if (!student) return null;

  const cgpa = toNumber(student.cgpa);
  const attendance = toNumber(student.attendance);
  const riskScore = getRiskScore(student);
  const riskPercent = Number.isFinite(riskScore) ? riskScore * 100 : null;

  const cgpaScore = cgpa === null ? null : (cgpa / 10) * 100;
  const improvementParts = [
    cgpaScore,
    attendance,
    Number.isFinite(riskPercent) ? 100 - riskPercent : null,
  ].filter((value) => Number.isFinite(value));
  const improvementScore = improvementParts.length
    ? improvementParts.reduce((sum, value) => sum + value, 0) / improvementParts.length
    : null;

  const metrics = [
    {
      key: "cgpa",
      title: "CGPA",
      value: cgpa,
      max: 10,
      color: "#2563eb",
      format: (value) => value.toFixed(2),
      caption: "Academic performance scale",
    },
    {
      key: "attendance",
      title: "Attendance %",
      value: attendance,
      max: 100,
      color: "#16a34a",
      format: (value) => `${value.toFixed(1)}%`,
      caption: "Lecture participation",
    },
    {
      key: "dropout",
      title: "Dropout Risk %",
      value: riskPercent,
      max: 100,
      color: "#dc2626",
      format: (value) => `${value.toFixed(1)}%`,
      caption: "Predicted risk level",
    },
    {
      key: "improvement",
      title: "Improvement Index",
      value: improvementScore,
      max: 100,
      color: "#7c3aed",
      format: (value) => `${value.toFixed(1)}%`,
      caption: "Composite growth metric",
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="overline" sx={{ letterSpacing: 3, color: textSecondary }}>
          Performance Overview
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Academic and Risk Indicators
        </Typography>
      </Box>
      <Grid container spacing={2}>
        {metrics.map((metric) => {
          const displayValue = Number.isFinite(metric.value)
            ? metric.format(metric.value)
            : "No data";
          const percent = Number.isFinite(metric.value)
            ? Math.min(100, Math.max(0, (metric.value / metric.max) * 100))
            : 0;

          return (
            <Grid item xs={12} md={6} key={metric.key}>
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: 3.5,
                  border: `1px solid ${borderSoft}`,
                  boxShadow: cardShadow,
                  background: isDark
                    ? `linear-gradient(140deg, ${alpha(metric.color, 0.22)} 0%, ${alpha(
                        theme.palette.background.paper,
                        0.9
                      )} 55%, ${alpha(metric.color, 0.08)} 100%)`
                    : `linear-gradient(140deg, ${alpha(metric.color, 0.12)} 0%, ${alpha(
                        theme.palette.background.paper,
                        0.98
                      )} 55%, ${alpha(metric.color, 0.05)} 100%)`,
                }}
              >
                <Stack direction="row" spacing={2.5} alignItems="center">
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: `conic-gradient(${metric.color} ${percent}%, ${alpha(
                        metric.color,
                        0.15
                      )} ${percent}% 100%)`,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: 88,
                        height: 88,
                        borderRadius: "50%",
                        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.85 : 0.96),
                        border: `1px solid ${alpha(metric.color, 0.3)}`,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {displayValue}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: textPrimary }}>
                      {metric.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {metric.caption}
                    </Typography>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: alpha(metric.color, 0.15),
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${percent}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${metric.color}, ${alpha(
                            metric.color,
                            0.6
                          )})`,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {Number.isFinite(metric.value)
                        ? `${Math.round(percent)}% of target`
                        : "Awaiting data update"}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default StudentReportCharts;
