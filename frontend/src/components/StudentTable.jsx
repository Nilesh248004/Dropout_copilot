// src/pages/StudentTable.jsx
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Typography, Box, CircularProgress, Dialog, DialogContent, DialogTitle, Chip, Alert
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PsychologyIcon from "@mui/icons-material/Psychology";
import StudentProfileDialog from "../components/StudentProfileDialog";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { filterStudentsByFaculty } from "../utils/faculty";

const StudentTable = ({ refresh }) => {
  const { role, facultyId } = useRole();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openProfile, setOpenProfile] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const navigate = useNavigate();

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      if (role === "faculty" && !facultyId) {
        setStudents([]);
        return;
      }
      const params = {};
      if (role === "faculty" && facultyId) {
        params.faculty_id = facultyId;
      }
      const res = await axios.get(`${API_BASE_URL}/students/full`, { params });
      const incoming = Array.isArray(res.data) ? res.data : [];
      const scoped =
        role === "faculty" ? filterStudentsByFaculty(incoming, facultyId) : incoming;
      setStudents(scoped);
    } catch (err) {
      console.error("Fetch students error:", err);
    } finally {
      setLoading(false);
    }
  }, [role, facultyId]);

  useEffect(() => {
    fetchStudents();
  }, [refresh, fetchStudents]);

  useEffect(() => {
    const handleFocus = () => fetchStudents();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete student permanently?")) return;
    await axios.delete(`${API_BASE_URL}/students/${id}`);
    fetchStudents();
  };

  const handleEdit = (id) => navigate(`/students/edit/${id}`);
  const handleViewProfile = (student) => {
    setSelectedStudent(student);
    setOpenProfile(true);
  };

  if (role === "faculty" && !facultyId) {
    return (
      <Alert severity="warning">
        Faculty ID is required to load your students. Please sign in again.
      </Alert>
    );
  }

  return (
    <Box mt={3}>
      <Typography variant="h5" mb={2}>📋 Students List</Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "Name",
                  "Reg No",
                  "Year",
                  "Sem",
                  "Phone",
                  "Attendance",
                  "CGPA",
                  "Disciplinary",
                  "Risk Score",
                  "Actions",
                ].map(h => (
                  <TableCell key={h}><b>{h}</b></TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.register_number}</TableCell>
                  <TableCell>{s.year}</TableCell>
                  <TableCell>{s.semester}</TableCell>
                  <TableCell>{s.phone_number || "N/A"}</TableCell>
                  <TableCell>{s.attendance ?? "N/A"}</TableCell>
                  <TableCell>{s.cgpa ?? "N/A"}</TableCell>
                  <TableCell>{s.disciplinary_issues ?? "N/A"}</TableCell>

                  <TableCell>
                    {s.risk_score != null ? (
                      <Chip
                        label={`${(s.risk_score * 100).toFixed(1)}%`}
                        color={s.risk_score > 0.7 ? "error" : s.risk_score > 0.4 ? "warning" : "success"}
                      />
                    ) : "Not Predicted"}
                  </TableCell>

                  <TableCell>
                    <IconButton onClick={() => handleEdit(s.id)}>
                      <EditIcon color="primary" />
                    </IconButton>

                    <IconButton onClick={() => handleDelete(s.id)}>
                      <DeleteIcon color="error" />
                    </IconButton>

                    {/* VIEW FULL ANALYTICS */}
                    <IconButton onClick={() => handleViewProfile(s)}>
                      <PsychologyIcon color="secondary" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </TableContainer>
      )}

      {/* FULL STUDENT ANALYTICS MODAL */}
      <Dialog open={openProfile} onClose={() => setOpenProfile(false)} maxWidth="md" fullWidth>
        <DialogTitle>📊 Student Analytics & Counselling</DialogTitle>
        <DialogContent>
          {selectedStudent && <StudentProfileDialog student={selectedStudent} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default StudentTable;
