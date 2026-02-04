import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Container, Typography, Box, Paper, Grid, Chip, Button
} from "@mui/material";
import RiskCharts from "../components/RiskChart";

const StudentAnalytics = () => {
  const { id } = useParams();
  const [student, setStudent] = useState(null);

  const fetchStudent = async () => {
    const res = await axios.get(`http://localhost:4000/students/${id}/full`);
    setStudent(res.data);
  };

  useEffect(() => {
    fetchStudent();
  }, []);

  if (!student) return <div>Loading...</div>;

  const riskColor =
    student.dropout_risk > 0.7 ? "error" :
    student.dropout_risk > 0.4 ? "warning" : "success";

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
          label={`${(student.dropout_risk * 100).toFixed(2)}%`}
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
          {student.dropout_risk > 0.6
            ? "High risk detected. Counselling strongly recommended."
            : "Student is performing normally."}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => axios.post("http://localhost:4000/counselling/book", { student_id: id })}
        >
          Book Counselling Session
        </Button>
      </Paper>
    </Container>
  );
};

export default StudentAnalytics;
