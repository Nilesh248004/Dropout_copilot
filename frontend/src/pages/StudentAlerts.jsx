import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useRole } from "../context/RoleContext";

const StudentAlerts = () => {
  const { role, studentId } = useRole();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const fetchAlerts = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setStatus(null);
      const studentRes = await axios.get(
        `${API_BASE_URL}/students/lookup/${encodeURIComponent(studentId)}`
      );
      const studentRecordId = studentRes.data?.id;
      if (!studentRecordId) {
        setStatus({ type: "error", message: "Student record not found." });
        setAlerts([]);
        return;
      }
      const res = await axios.get(`${API_BASE_URL}/student-alerts`, {
        params: { student_id: studentRecordId },
      });
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to load alerts.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [studentId]);

  if (role !== "student") {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Student alerts are available for students only.</Alert>
      </Container>
    );
  }

  if (!studentId) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Student ID is required to load alerts.</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Student Alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Notifications from your faculty for immediate attention.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={fetchAlerts}
            sx={{ ml: { md: "auto" } }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {status && (
        <Alert severity={status.type} sx={{ mb: 2 }}>
          {status.message}
        </Alert>
      )}

      {alerts.length === 0 && !loading && (
        <Alert severity="info">No alerts yet.</Alert>
      )}

      <Stack spacing={2}>
        {alerts.map((alert) => (
          <Paper key={alert.id} sx={{ p: 2.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <Box flexGrow={1}>
                <Typography fontWeight={600}>{alert.message}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(alert.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Chip label="Faculty Alert" color="warning" size="small" />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Container>
  );
};

export default StudentAlerts;
