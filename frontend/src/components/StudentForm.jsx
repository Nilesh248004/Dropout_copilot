import React, { useState, useEffect } from "react";
import { TextField, Button, Box, Typography } from "@mui/material";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const StudentForm = ({ student, onClose, refresh }) => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    register_number: "",
    attendance: "",
    cgpa: "",
    arrear_count: "",
    fees_paid: "",
    disciplinary_issues: "",
    year: "",
    semester: "",
  });

  // If editing an existing student, populate form with their data
  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || "",
        register_number: student.register_number || "",
        attendance: student.attendance ?? "",
        cgpa: student.cgpa ?? "",
        arrear_count: student.arrear_count ?? "",
        fees_paid: student.fees_paid ?? "",
        disciplinary_issues: student.disciplinary_issues ?? "",
        year: student.year ?? "",
        semester: student.semester ?? "",
      });
    }
  }, [student]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Ensure numeric fields are numbers
    const numericFields = ["attendance", "cgpa", "arrear_count", "fees_paid", "disciplinary_issues", "year", "semester"];
    const newValue = numericFields.includes(name) ? (value === "" ? "" : Number(value)) : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.register_number) {
        alert("Name and Register Number are required");
        return;
      }

      if (student) {
        // UPDATE existing student
        await axios.put(`${API_BASE_URL}/students/${student.id}`, formData);
      } else {
        // ADD new student
        const res = await axios.post(`${API_BASE_URL}/students`, formData);

        // Optionally, create a blank academic record
        if (res.data.id) {
          await axios.post(`${API_BASE_URL}/academic`, {
            student_id: res.data.id,
            attendance: null,
            cgpa: null,
            arrear_count: null,
            fees_paid: null,
          });
        }
      }

      // Refresh parent table and close form
      refresh();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save student. Check console for details.");
    }
  };

  return (
    <Box p={2} width={400}>
      <Typography variant="h6" mb={2}>
        {student ? "Edit Student" : "Add Student"}
      </Typography>

      <TextField
        label="Name"
        name="name"
        fullWidth
        margin="dense"
        value={formData.name}
        onChange={handleChange}
      />
      <TextField
        label="Register Number"
        name="register_number"
        fullWidth
        margin="dense"
        value={formData.register_number}
        onChange={handleChange}
      />

      <TextField
        label="Attendance %"
        name="attendance"
        type="number"
        fullWidth
        margin="dense"
        value={formData.attendance}
        onChange={handleChange}
      />
      <TextField
        label="CGPA"
        name="cgpa"
        type="number"
        fullWidth
        margin="dense"
        value={formData.cgpa}
        onChange={handleChange}
      />
      <TextField
        label="Arrear Count"
        name="arrear_count"
        type="number"
        fullWidth
        margin="dense"
        value={formData.arrear_count}
        onChange={handleChange}
      />

      <TextField
        label="Fees Paid (1=Yes,0=No)"
        name="fees_paid"
        type="number"
        fullWidth
        margin="dense"
        value={formData.fees_paid}
        onChange={handleChange}
      />
      <TextField
        label="Disciplinary Issues"
        name="disciplinary_issues"
        type="number"
        fullWidth
        margin="dense"
        value={formData.disciplinary_issues}
        onChange={handleChange}
      />

      <TextField
        label="Year"
        name="year"
        type="number"
        fullWidth
        margin="dense"
        value={formData.year}
        onChange={handleChange}
      />
      <TextField
        label="Semester"
        name="semester"
        type="number"
        fullWidth
        margin="dense"
        value={formData.semester}
        onChange={handleChange}
      />

      <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={handleSubmit}>
        Save
      </Button>
    </Box>
  );
};

export default StudentForm;
