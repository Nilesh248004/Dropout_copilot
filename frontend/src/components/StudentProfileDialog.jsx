import React from "react";
import { Box, Typography, Paper, Chip, Button, TextField } from "@mui/material";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getRiskLevel, getRiskScore } from "../utils/risk";

const StudentProfileDialog = ({ student }) => {

  const riskScore = getRiskScore(student);
  const riskLevel = getRiskLevel(student);
  const riskColor = riskScore === null ? "default" : riskScore > 0.7 ? "error" : riskScore > 0.4 ? "warning" : "success";

  const graphData = [
    { name: "Attendance", value: student.attendance || 0 },
    { name: "CGPA", value: student.cgpa || 0 },
    { name: "Risk %", value: (riskScore || 0) * 100 },
  ];

  return (
    <Box display="flex" flexDirection="column" gap={2}>

      {/* STUDENT DETAILS */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Student Profile</Typography>
        <Typography>Name: {student.name}</Typography>
        <Typography>Register No: {student.register_number}</Typography>
        <Typography>Year: {student.year} | Semester: {student.semester}</Typography>
        <Typography>Attendance: {student.attendance}%</Typography>
        <Typography>CGPA: {student.cgpa}</Typography>

        <Chip
          label={
            riskScore === null
              ? "Risk Score: Pending"
              : `Risk Score: ${(riskScore * 100).toFixed(2)}% (${riskLevel || "Pending"})`
          }
          color={riskColor}
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* GRAPH SECTION */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Performance Graph</Typography>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* COUNSELLING SECTION */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">🧠 Counselling Request</Typography>

        <Typography>
          Student Risk Level: <b>{riskLevel || "Pending"}</b>
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Student Message (Optional)"
          sx={{ mt: 2 }}
        />

        <Box mt={2} display="flex" gap={2}>
          <Button variant="contained" color="success">
            Book Counselling
          </Button>
          <Button variant="outlined" color="error">
            Cancel
          </Button>
        </Box>
      </Paper>

    </Box>
  );
};

export default StudentProfileDialog;
