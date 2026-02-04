import React, { useEffect, useState } from "react";
import {
  Card, CardContent, Typography, TextField,
  Button, Box, CircularProgress
} from "@mui/material";
import axios from "axios";
import { API_BASE_URL, ML_BASE_URL } from "../config/api";

const PredictionCard = ({ student, onSaved }) => {
  const [formData, setFormData] = useState({
    attendance: "",
    cgpa: "",
    arrear_count: "",
    fees_paid: "",
    disciplinary_issues: "",
    year: "",
    semester: "",
  });

  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);

  // Auto-fill student details
  useEffect(() => {
    if (student) {
      setFormData({
        attendance: student.attendance || 60,
        cgpa: student.cgpa || 6,
        arrear_count: student.arrear_count || 0,
        fees_paid: student.fees_paid || 1,
        disciplinary_issues: student.disciplinary_issues || 0,
        year: student.year,
        semester: student.semester,
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        attendance: parseFloat(formData.attendance),
        cgpa: parseFloat(formData.cgpa),
        arrear_count: parseInt(formData.arrear_count),
        fees_paid: parseInt(formData.fees_paid),
        disciplinary_issues: parseInt(formData.disciplinary_issues),
        year: parseInt(formData.year),
        semester: parseInt(formData.semester),
      };

      // ML Prediction
      const res = await axios.post(`${ML_BASE_URL}/predict`, payload);
      setPrediction(res.data);

      // Save to DB
      await axios.put(`${API_BASE_URL}/students/${student.id}/risk`, {
        risk_score: res.data.risk_score,
        dropout: res.data.dropout,
      });

      if (onSaved) onSaved();

    } catch (err) {
      console.error("Prediction error:", err);
      alert("Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ boxShadow: 0 }}>
      <CardContent>
        <Typography variant="h6">
          Predict for {student?.name}
        </Typography>

        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          {Object.keys(formData).map((key) => (
            <TextField
              key={key}
              label={key}
              name={key}
              type="number"
              value={formData[key]}
              onChange={handleChange}
            />
          ))}

          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? <CircularProgress size={22} /> : "Run AI Prediction"}
          </Button>
        </Box>

        {prediction && (
          <Box mt={2} p={2} sx={{ bgcolor: "#f5f5f5", borderRadius: 2 }}>
            <Typography>
              Dropout Risk: <b>{prediction.dropout ? "HIGH" : "LOW"}</b>
            </Typography>
            <Typography>
              Risk Score: <b>{(prediction.risk_score * 100).toFixed(2)}%</b>
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PredictionCard;
