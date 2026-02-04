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
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { normalizeFacultyId } from "../utils/faculty";

const EditStudent = () => {
  const { id } = useParams(); // Get student ID from URL
  const navigate = useNavigate();
  const { role, facultyId } = useRole();

  const [formData, setFormData] = useState({
    name: "",
    year: "",
    semester: "",
    faculty_id: "",
    phone_number: "",
    attendance: "",
    cgpa: "",
    arrear_count: "",
    fees_paid: "",
    disciplinary_issues: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Fetch student data on load
  useEffect(() => {
    let active = true;
    const fetchStudent = async () => {
      try {
        setFetching(true);
        setAccessDenied(false);
        const params =
          role === "faculty" && facultyId ? { faculty_id: facultyId } : undefined;
        const res = await axios.get(`${API_BASE_URL}/students/${id}/full`, { params });
        const data = res.data;
        if (role === "faculty" && facultyId) {
          const normalizedFaculty = normalizeFacultyId(facultyId);
          if (normalizeFacultyId(data?.faculty_id) !== normalizedFaculty) {
            if (active) {
              setAccessDenied(true);
            }
            return;
          }
        }
        if (!active) return;
        setFormData({
          name: data.name,
          year: data.year,
          semester: data.semester,
          faculty_id: data.faculty_id ?? "",
          phone_number: data.phone_number ?? "",
          attendance: data.attendance ?? "",
          cgpa: data.cgpa ?? "",
          arrear_count: data.arrear_count ?? "",
          fees_paid: data.fees_paid ?? "",
          disciplinary_issues: data.disciplinary_issues ?? "",
        });
      } catch (error) {
        if (!active) return;
        console.error(error);
        if (role === "faculty") {
          setAccessDenied(true);
        } else {
          setSnackbar({ open: true, message: "Error fetching student data", severity: "error" });
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    };

    fetchStudent();
    return () => {
      active = false;
    };
  }, [id, role, facultyId]);

  if (fetching) {
    return (
      <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (accessDenied) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">You do not have access to edit this student.</Alert>
      </Box>
    );
  }

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
      const normalizedFacultyId =
        role === "admin" ? normalizeFacultyId(formData.faculty_id) : null;
      await axios.put(`${API_BASE_URL}/students/${id}`, {
        name: formData.name,
        year: formData.year,
        semester: formData.semester,
        ...(role === "admin" ? { faculty_id: normalizedFacultyId || null } : {}),
        phone_number: formData.phone_number,
      });
      await axios.put(`${API_BASE_URL}/academic/${id}`, {
        attendance: Number(formData.attendance),
        cgpa: Number(formData.cgpa),
        arrear_count: Number(formData.arrear_count),
        fees_paid: Number(formData.fees_paid),
        disciplinary_issues: Number(formData.disciplinary_issues),
      });
      setLoading(false);
      setSnackbar({ open: true, message: "Student updated successfully!", severity: "success" });

      setTimeout(() => navigate("/studentlist"), 800);
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

        <TextField
          label="Attendance %"
          name="attendance"
          type="number"
          value={formData.attendance}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label="Phone Number"
          name="phone_number"
          value={formData.phone_number}
          onChange={handleChange}
          fullWidth
        />
        {role === "faculty" ? (
          <TextField
            label="Faculty ID"
            name="faculty_id"
            value={formData.faculty_id || facultyId || ""}
            fullWidth
            disabled
          />
        ) : (
          <TextField
            label="Faculty ID"
            name="faculty_id"
            value={formData.faculty_id}
            onChange={handleChange}
            fullWidth
          />
        )}
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
          label="Fees Paid (1=Yes,0=No)"
          name="fees_paid"
          type="number"
          value={formData.fees_paid}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label="Disciplinary Issues"
          name="disciplinary_issues"
          type="number"
          value={formData.disciplinary_issues}
          onChange={handleChange}
          fullWidth
        />

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
