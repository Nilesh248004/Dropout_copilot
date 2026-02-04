import React, { useState, useEffect } from "react";
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
import { useNavigate, useParams } from "react-router-dom";

const EditStudent = () => {
  const { id } = useParams(); // Get student ID from URL
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    year: "",
    semester: "",
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Fetch student data on load
  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await axios.get(`http://localhost:4000/students/${id}`);
        setFormData({
          name: res.data.name,
          year: res.data.year,
          semester: res.data.semester,
        });
      } catch (error) {
        console.error(error);
        setSnackbar({ open: true, message: "Error fetching student data", severity: "error" });
      }
    };

    fetchStudent();
  }, [id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.year || !formData.semester) {
      setSnackbar({ open: true, message: "All fields are required", severity: "error" });
      return;
    }

    try {
      setLoading(true);
      await axios.put(`http://localhost:4000/students/${id}`, formData);
      setLoading(false);
      setSnackbar({ open: true, message: "Student updated successfully!", severity: "success" });

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setLoading(false);
      console.error(error);
      setSnackbar({ open: true, message: "Error updating student", severity: "error" });
    }
  };

  return (
    <Paper sx={{ p: 4, mt: 3, maxWidth: 500, margin: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Edit Student
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
          select
          label="Year"
          name="year"
          value={formData.year}
          onChange={handleChange}
          fullWidth
          required
        >
          {[1, 2, 3, 4].map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
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
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>

        <Button type="submit" variant="contained" color="primary" disabled={loading}>
          {loading ? "Updating..." : "Update Student"}
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

export default EditStudent;
