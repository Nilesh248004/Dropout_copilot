import React, { useEffect, useState } from "react";
import { Container, Paper, Box, TextField, Button, Typography, Snackbar, Alert, MenuItem } from "@mui/material";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import { normalizeFacultyId } from "../utils/faculty";

const AddStudentPage = () => {
  const navigate = useNavigate();
  const { role, facultyId } = useRole();
  const [student, setStudent] = useState({
    name: "",
    register_number: "",
    year: "",
    semester: "",
    faculty_id: role === "faculty" ? facultyId : "",
    phone_number: "",
    attendance: "",
    cgpa: "",
    arrear_count: "",
    fees_paid: "",
    disciplinary_issues: "",
  });
  const [loading, setLoading] = useState(false);

  // Snackbar for feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const handleChange = (e) => {
    setStudent({ ...student, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (role === "faculty") {
      setStudent((prev) => ({ ...prev, faculty_id: facultyId || "" }));
    }
  }, [role, facultyId]);

  const handleSubmit = async () => {
    const {
      name,
      register_number,
      year,
      semester,
      faculty_id,
      phone_number,
      attendance,
      cgpa,
      arrear_count,
      fees_paid,
      disciplinary_issues,
    } = student;

    // Basic validation
    if (!name || !register_number || !year || !semester) {
      setSnackbar({ open: true, message: "Please fill all fields", severity: "error" });
      return;
    }
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    if ((role === "faculty" || role === "admin") && !normalizedFacultyId) {
      setSnackbar({ open: true, message: "Please enter the faculty ID", severity: "error" });
      return;
    }
    if (attendance === "" || cgpa === "" || arrear_count === "" || fees_paid === "") {
      setSnackbar({
        open: true,
        message: "Please enter attendance, CGPA, arrear count, and fees status.",
        severity: "error",
      });
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_BASE_URL}/students`,
        {
          name,
          register_number,
          year,
          semester,
          faculty_id: normalizedFacultyId || null,
          phone_number: phone_number || null,
          attendance: attendance === "" ? null : Number(attendance),
          cgpa: cgpa === "" ? null : Number(cgpa),
          arrear_count: arrear_count === "" ? null : Number(arrear_count),
          fees_paid: fees_paid === "" ? null : Boolean(fees_paid),
          disciplinary_issues: disciplinary_issues === "" ? null : Number(disciplinary_issues),
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      setSnackbar({ open: true, message: "Student added successfully!", severity: "success" });

      // Redirect after short delay
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      console.error("Error adding student:", err.response?.data || err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || err.response?.data?.detail || "Failed to add student",
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
          <TextField
            label="Phone Number"
            name="phone_number"
            value={student.phone_number}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Attendance %"
            name="attendance"
            type="number"
            value={student.attendance}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            label="CGPA"
            name="cgpa"
            type="number"
            value={student.cgpa}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            label="Arrear Count"
            name="arrear_count"
            type="number"
            value={student.arrear_count}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            select
            label="Fees Status"
            name="fees_paid"
            value={student.fees_paid}
            onChange={handleChange}
            fullWidth
            required
          >
            <MenuItem value={true}>Paid</MenuItem>
            <MenuItem value={false}>Not Paid</MenuItem>
          </TextField>
          <TextField
            label="Disciplinary Issues"
            name="disciplinary_issues"
            type="number"
            value={student.disciplinary_issues}
            onChange={handleChange}
            fullWidth
          />
          {role === "faculty" ? (
            <TextField
              label="Faculty ID"
              name="faculty_id"
              value={student.faculty_id}
              fullWidth
              disabled
              helperText="Students will be mapped to your faculty ID"
            />
          ) : (
            <TextField
              label="Faculty ID"
              name="faculty_id"
              value={student.faculty_id}
              onChange={handleChange}
              fullWidth
              required
            />
          )}

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
