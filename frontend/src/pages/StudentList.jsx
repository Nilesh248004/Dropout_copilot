// src/pages/StudentList.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Box, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip
} from "@mui/material";

const StudentList = ({ reload, onDelete }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPredict, setOpenPredict] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const [formData, setFormData] = useState({
    attendance: 75,
    cgpa: 7,
    arrear_count: 0,
    fees_paid: 1,
  });

  // ================= FETCH STUDENTS ==================
  const fetchStudents = async () => {
    try {
      const res = await axios.get("http://localhost:4000/students/full");
      setStudents(res.data);
    } catch (err) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // ================= OPEN PREDICT FORM ==================
  const handlePredictClick = (s) => {
    setSelectedStudent(s);
    setFormData({
      attendance: s.attendance ?? 75,
      cgpa: s.cgpa ?? 7,
      arrear_count: s.arrear_count ?? 0,
      fees_paid: s.fees_paid ?? 1,
    });
    setOpenPredict(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ================= SAVE PREDICTION ==================
  const savePrediction = async (studentId, data) => {
    await axios.post("http://localhost:4000/prediction/save", {
      student_id: studentId,
      dropout_prediction: data.dropout_prediction,
      risk_score: data.risk_score,
      risk_level: data.risk_level
    });
  };

  // ================= RUN PREDICTION ==================
  const runPrediction = async () => {
    try {
      setPredicting(true);

      await axios.put(`http://localhost:4000/academic/${selectedStudent.id}`, {
        attendance: Number(formData.attendance),
        cgpa: Number(formData.cgpa),
        arrear_count: Number(formData.arrear_count),
        fees_paid: Number(formData.fees_paid),
      });

      const res = await axios.post(`http://localhost:4000/predict/${selectedStudent.id}`);
      const data = res.data;

      alert(`Risk: ${data.risk_level} | Score: ${(data.risk_score * 100).toFixed(2)}%`);

      await savePrediction(selectedStudent.id, data);

      await fetchStudents(); // refresh UI
      if (reload) reload();

      setOpenPredict(false);
    } catch (err) {
      console.error("Prediction Error:", err);
      alert("Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  // ================= CHIP COLOR ==================
  const riskColor = (level) => {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "success";
      default:
        return "default";
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {["Name","Reg No","Year","Sem","Attendance","CGPA","Fees","Risk Score","Actions"].map(h =>
                <TableCell key={h}><b>{h}</b></TableCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {students.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.register_number}</TableCell>
                <TableCell>{s.year}</TableCell>
                <TableCell>{s.semester}</TableCell>
                <TableCell>{s.attendance}</TableCell>
                <TableCell>{s.cgpa}</TableCell>
                <TableCell>{s.fees_paid ? "Yes" : "No"}</TableCell>

                {/* ✅ SHOW PREDICTION SCORE */}
                <TableCell>
                  {s.risk_level ? (
                    <Chip
                      label={`${(s.risk_score * 100).toFixed(2)}% - ${s.risk_level}`}
                      color={riskColor(s.risk_level)}
                    />
                  ) : "Not Predicted"}
                </TableCell>

                <TableCell>
                  <Box display="flex" gap={1}>
                    <Button variant="contained" size="small" onClick={() => handlePredictClick(s)}>
                      Predict
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => onDelete(s.id)}
                    >
                      Delete
                    </Button>
                  </Box>
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Prediction Dialog */}
      <Dialog open={openPredict} onClose={() => setOpenPredict(false)}>
        <DialogTitle>AI Prediction</DialogTitle>
        <DialogContent>
          {Object.keys(formData).map(k => (
            <TextField
              key={k}
              name={k}
              label={k}
              value={formData[k]}
              onChange={handleChange}
              type="number"
              fullWidth
              sx={{ mt:1 }}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPredict(false)}>Cancel</Button>
          <Button onClick={runPrediction} variant="contained">
            {predicting ? "Predicting..." : "Predict"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default StudentList;
