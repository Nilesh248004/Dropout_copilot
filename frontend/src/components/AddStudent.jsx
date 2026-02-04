import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AddStudent = () => {
  const [formData, setFormData] = useState({
    name: "",
    register_number: "",
    year: "",
    semester: "",
    attendance: 75, // default
    cgpa: 7.0,     // default
    arrear_count: 0,
    fees_paid: 1,
    disciplinary_issues: 0,
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const navigate = useNavigate();

  // Handle form field changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.register_number || !formData.year || !formData.semester) {
      setSnackbar({ open: true, message: "All fields are required", severity: "error" });
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Add student to backend
      const addResponse = await axios.post(
        "http://localhost:4000/students",
        formData,
        { headers: { "Content-Type": "application/json" } }
      );

      if (addResponse.status !== 200 && addResponse.status !== 201) {
        throw new Error("Failed to add student");
      }

      // 2️⃣ Call ML API to get risk prediction
      const mlResponse = await axios.post(
        "http://127.0.0.1:8000/predict",
        {
          attendance: Number(formData.attendance),
          cgpa: Number(formData.cgpa),
          arrear_count: Number(formData.arrear_count),
          fees_paid: Number(formData.fees_paid),
          disciplinary_issues: Number(formData.disciplinary_issues),
          year: Number(formData.year),
          semester: Number(formData.semester),
        },
        { headers: { "Content-Type": "application/json" } }
      );

      setLoading(false);

      // 3️⃣ Show success Snackbar with risk level
      setSnackbar({
        open: true,
        message: `Student added! Risk Level: ${mlResponse.data.risk_level}`,
        severity: "success",
      });

      console.log("ML Prediction:", mlResponse.data);

      // 4️⃣ Redirect to dashboard after short delay
      setTimeout(() => navigate("/dashboard"), 1500);

    } catch (error) {
      setLoading(false);
      console.error("Error adding student:", error.response || error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || "Failed to add student",
        severity: "error",
      });
    }
  };

  return (
    <Paper sx={{ p: 4, mt: 3, maxWidth: 500, margin: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Add New Student
      </Typography>

      <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
        <TextField
          label="Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          fullWidth
          required
        />

        <TextField
          label="Register Number"
          name="register_number"
          value={formData.register_number}
          onChange={handleChange}
          fullWidth
          required
        />

        <TextField
          select
          label="Year"
          name="year"
          value={formData.year}
          onChange={handleChange}
          fullWidth
          required
        >
          {[1, 2, 3, 4].map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Semester"
          name="semester"
          value={formData.semester}
          onChange={handleChange}
          fullWidth
          required
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>

        {/* Optional ML Inputs */}
        <TextField
          label="Attendance %"
          name="attendance"
          type="number"
          value={formData.attendance}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label="CGPA"
          name="cgpa"
          type="number"
          value={formData.cgpa}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label="Arrear Count"
          name="arrear_count"
          type="number"
          value={formData.arrear_count}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          select
          label="Fees Paid"
          name="fees_paid"
          value={formData.fees_paid}
          onChange={handleChange}
          fullWidth
        >
          <MenuItem value={1}>Yes</MenuItem>
          <MenuItem value={0}>No</MenuItem>
        </TextField>
        <TextField
          label="Disciplinary Issues"
          name="disciplinary_issues"
          type="number"
          value={formData.disciplinary_issues}
          onChange={handleChange}
          fullWidth
        />

        <Button type="submit" variant="contained" color="primary" disabled={loading}>
          {loading ? "Adding..." : "Add Student"}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default AddStudent;
