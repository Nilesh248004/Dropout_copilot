import React from "react";
import { Box, Grid, Paper, Stack, Typography, Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getRiskLevel, getRiskScore } from "../utils/risk";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const MetricGauge = ({ label, value, max, color }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const safeMax = max || 100;
  const percent = Number.isFinite(value)
    ? clamp((value / safeMax) * 100, 0, 100)
    : 0;
  const displayValue = Number.isFinite(value)
    ? `${Math.round(value * 10) / 10}`
    : "--";

  return (
    <Stack spacing={0.6} alignItems="center">
      <Box
        sx={{
          width: { xs: 72, sm: 86 },
          height: { xs: 72, sm: 86 },
          borderRadius: "50%",
          background: `conic-gradient(${color} ${percent}%, ${alpha(color, 0.12)} ${percent}% 100%)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Box
          sx={{
            width: { xs: 54, sm: 64 },
            height: { xs: 54, sm: 64 },
            borderRadius: "50%",
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.8 : 0.95),
            border: `1px solid ${alpha(color, 0.25)}`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {displayValue}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Stack>
  );
};

const StudentInsightGrid = ({ students = [] }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const borderSoft = alpha(theme.palette.text.primary, isDark ? 0.2 : 0.12);

  if (!students.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No students available for visualization yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack spacing={0.4} mb={2}>
        <Typography variant="overline" sx={{ letterSpacing: 2.5, color: "text.secondary" }}>
          Student Visuals
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Risk, Attendance, and CGPA for every student
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {students.map((student) => {
          const riskScore = getRiskScore(student);
          const riskPercent = Number.isFinite(riskScore) ? riskScore * 100 : null;
          const attendance = toNumber(student.attendance);
          const cgpa = toNumber(student.cgpa);
          const riskLevel = getRiskLevel(student);
          const riskColor =
            riskLevel === "HIGH"
              ? theme.palette.error.main
              : riskLevel === "MEDIUM"
                ? theme.palette.warning.main
                : theme.palette.success.main;

          return (
            <Grid item xs={12} sm={6} lg={4} key={student.id || student.register_number}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  borderColor: borderSoft,
                  background: isDark
                    ? `linear-gradient(135deg, ${alpha(riskColor, 0.2)} 0%, ${alpha(
                        theme.palette.background.paper,
                        0.95
                      )} 55%)`
                    : `linear-gradient(135deg, ${alpha(riskColor, 0.12)} 0%, ${alpha(
                        theme.palette.background.paper,
                        0.98
                      )} 55%)`,
                }}
              >
                <Stack spacing={0.8} mb={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {student.name || "Student"}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={student.register_number || "No Reg No"}
                      variant="outlined"
                    />
                    {riskLevel && (
                      <Chip
                        size="small"
                        label={`${riskLevel} RISK`}
                        color={
                          riskLevel === "HIGH"
                            ? "error"
                            : riskLevel === "MEDIUM"
                              ? "warning"
                              : "success"
                        }
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1.5, sm: 2 }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  flexWrap="wrap"
                >
                  <MetricGauge label="Risk %" value={riskPercent} max={100} color={riskColor} />
                  <MetricGauge
                    label="Attendance"
                    value={attendance}
                    max={100}
                    color={theme.palette.info.main}
                  />
                  <MetricGauge
                    label="CGPA"
                    value={cgpa}
                    max={10}
                    color={theme.palette.primary.main}
                  />
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default StudentInsightGrid;
