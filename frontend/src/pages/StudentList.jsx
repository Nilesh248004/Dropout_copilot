// src/pages/StudentList.jsx
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  CircularProgress,
  Chip,
  Alert,
} from "@mui/material";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";
import { filterStudentsByFaculty } from "../utils/faculty";
import { getRiskScore } from "../utils/risk";

const StudentList = ({ students: propStudents, reload }) => {
  const { role, facultyId } = useRole();
  const [students, setStudents] = useState(propStudents || []);
  const [loading, setLoading] = useState(!Array.isArray(propStudents));
  const [predictingId, setPredictingId] = useState(null);

  // ================= FETCH STUDENTS ==================
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
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [role, facultyId]);

  useEffect(() => {
    if (Array.isArray(propStudents)) {
      const scoped =
        role === "faculty" ? filterStudentsByFaculty(propStudents, facultyId) : propStudents;
      setStudents(scoped);
      setLoading(false);
      return;
    }
    fetchStudents();
  }, [propStudents, fetchStudents, role, facultyId]);

  useEffect(() => {
    if (Array.isArray(propStudents)) return;
    const handleFocus = () => fetchStudents();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [propStudents, fetchStudents]);

  // ================= RUN PREDICTION ==================
  const runPrediction = async (studentId) => {
    try {
      setPredictingId(studentId);
      const res = await axios.post(`${API_BASE_URL}/predict/${studentId}`);
      const data = res.data;

      alert(`Risk: ${data.risk_level} | Score: ${(data.risk_score * 100).toFixed(2)}%`);

      if (reload) await reload();
      if (!Array.isArray(propStudents)) {
        await fetchStudents(); // refresh UI
      }
    } catch (err) {
      console.error("Prediction Error:", err);
      const message = err.response?.data?.error || "Prediction failed";
      alert(message);
    } finally {
      setPredictingId(null);
    }
  };

  // ================= CHIP COLOR ==================
  const riskColor = (level, score) => {
    const normalized = level?.toUpperCase();
    if (normalized === "HIGH") return "error";
    if (normalized === "MEDIUM") return "warning";
    if (normalized === "LOW") return "success";
    if (Number.isFinite(score)) {
      if (score > 0.7) return "error";
      if (score > 0.4) return "warning";
      return "success";
    }
    return "default";
  };

  const hasCompleteAcademic = (s) =>
    s.attendance !== null &&
    s.attendance !== undefined &&
    s.cgpa !== null &&
    s.cgpa !== undefined &&
    s.arrear_count !== null &&
    s.arrear_count !== undefined &&
    s.fees_paid !== null &&
    s.fees_paid !== undefined;

  if (role === "faculty" && !facultyId) {
    return (
      <Alert severity="warning">
        Faculty ID is required to load your students. Please sign in again.
      </Alert>
    );
  }

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <TableContainer component={Paper}>
        <Table>
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
                "Arrears",
                "Fees",
                "Disciplinary",
                "Risk Score",
                "Actions",
              ].map((h) => (
                <TableCell key={h}><b>{h}</b></TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {students.map((s) => {
              const riskScore = getRiskScore(s);
              const riskLevelRaw = s?.risk_level ?? null;
              const riskLevelNormalized =
                typeof riskLevelRaw === "string" ? riskLevelRaw.toUpperCase() : null;
              const hasPrediction =
                riskLevelNormalized !== null &&
                ["HIGH", "MEDIUM", "LOW"].includes(riskLevelNormalized);
              const isPredicting = predictingId === s.id;
              return (
              <TableRow key={s.id}>
              <TableCell>{s.name}</TableCell>
              <TableCell>{s.register_number}</TableCell>
              <TableCell>{s.year}</TableCell>
              <TableCell>{s.semester}</TableCell>
              <TableCell>{s.phone_number ?? "N/A"}</TableCell>
              <TableCell>{s.attendance ?? "N/A"}</TableCell>
              <TableCell>{s.cgpa ?? "N/A"}</TableCell>
              <TableCell>{s.arrear_count ?? "N/A"}</TableCell>
              <TableCell>{s.fees_paid === null || s.fees_paid === undefined ? "N/A" : s.fees_paid ? "Yes" : "No"}</TableCell>
              <TableCell>{s.disciplinary_issues ?? "N/A"}</TableCell>

                {/* ✅ SHOW PREDICTION SCORE */}
                <TableCell>
                  {hasPrediction && riskScore !== null ? (
                    <Chip
                      label={`${(riskScore * 100).toFixed(2)}% - ${riskLevelNormalized || "Pending"}`}
                      color={riskColor(riskLevelNormalized, riskScore)}
                    />
                  ) : hasCompleteAcademic(s) ? "Not Predicted" : "Incomplete Data"}
                </TableCell>

                <TableCell>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => runPrediction(s.id)}
                      disabled={isPredicting || !hasCompleteAcademic(s)}
                      color={hasPrediction ? "success" : "primary"}
                    >
                      {isPredicting ? "Predicting..." : hasPrediction ? "Predicted" : "Predict"}
                    </Button>
                  </Box>
                </TableCell>

              </TableRow>
            )})}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StudentList;
