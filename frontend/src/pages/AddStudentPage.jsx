import React, { useState } from "react";
import { Container, Paper, Box, TextField, Button, Typography, Snackbar, Alert } from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AddStudentPage = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState({
    name: "",
    register_number: "",
    year: "",
    semester: "",
  });
  const [loading, setLoading] = useState(false);

  // Snackbar for feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const handleChange = (e) => {
    setStudent({ ...student, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const { name, register_number, year, semester } = student;

    // Basic validation
    if (!name || !register_number || !year || !semester) {
      setSnackbar({ open: true, message: "Please fill all fields", severity: "error" });
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Add student
      await axios.post("http://localhost:4000/students", student, {
        headers: { "Content-Type": "application/json" },
      });

      // 2️⃣ Get the student id
      const addedStudent = await axios.get(
        `http://localhost:4000/students/${student.register_number}`
      );

      const student_id = addedStudent.data.id;

      // 3️⃣ Add blank academic record
      await axios.post("http://localhost:4000/academic", {
        student_id,
        attendance: null,
        cgpa: null,
        arrear_count: null,
        fees_paid: null,
      });

      setSnackbar({ open: true, message: "Student added successfully!", severity: "success" });

      // Redirect after short delay
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      console.error("Error adding student:", err.response || err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to add student",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 5 }}>
      <Paper sx={{ p: 4, boxShadow: 3 }}>
        <Typography variant="h5" mb={3}>
          + Add New Student
        </Typography>
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Name"
            name="name"
            value={student.name}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Register Number"
            name="register_number"
            value={student.register_number}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Year"
            name="year"
            type="number"
            value={student.year}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Semester"
            name="semester"
            type="number"
            value={student.semester}
            onChange={handleChange}
            fullWidth
          />

          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Student"}
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate("/dashboard")}
          >
            Cancel
          </Button>
        </Box>

        {/* Snackbar for messages */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Container>
  );
};

export default AddStudentPage;
