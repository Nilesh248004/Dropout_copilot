import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { sendEmail } from "../services/emailService";
import { useRole } from "../context/RoleContext";

const EmailCenter = ({ role }) => {
  const { role: contextRole, email } = useRole();
  const activeRole = role || contextRole;
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    toEmail: "",
    recipients: [],
  });

  const recipientOptions = useMemo(() => {
    if (activeRole === "student") {
      return ["faculty", "admin"];
    }
    if (activeRole === "faculty") {
      return ["student", "admin"];
    }
    return ["student", "faculty"];
  }, [activeRole]);

  const handleChange = (event) => {
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleRecipientsChange = (event) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      recipients: typeof value === "string" ? value.split(",") : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      if (!email) {
        throw new Error("Your login email is missing. Please sign in again.");
      }
      await sendEmail({
        fromRole: activeRole,
        toRoles: formData.recipients,
        fromEmail: email,
        toEmail: formData.toEmail,
        subject: formData.subject,
        message: formData.message,
      });
      setStatus({ type: "success", message: "Email sent successfully." });
      setFormData((prev) => ({ ...prev, subject: "", message: "" }));
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "Unable to send email right now.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">📩 Email Center</Typography>
          <Typography variant="body2" color="text.secondary">
            Send role-based updates and queries directly to the relevant stakeholders.
          </Typography>
        </Box>
        <Chip label={`From: ${activeRole}`} color="secondary" sx={{ ml: { md: "auto" } }} />
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {!email && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your login email is missing. Please sign in again.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <FormControl>
            <InputLabel id="recipient-select-label">Recipients</InputLabel>
            <Select
              labelId="recipient-select-label"
              multiple
              value={formData.recipients}
              onChange={handleRecipientsChange}
              input={<OutlinedInput label="Recipients" />}
              renderValue={(selected) => selected.join(", ")}
            >
              {recipientOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="To Email"
            name="toEmail"
            value={formData.toEmail}
            onChange={handleChange}
            fullWidth
            helperText="Use a single email address or comma-separated list"
          />
          <TextField
            label="Subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            multiline
            minRows={4}
            fullWidth
          />

          <Button
            variant="contained"
            type="submit"
            disabled={
              sending ||
              formData.recipients.length === 0 ||
              !String(formData.toEmail || "").trim() ||
              !email
            }
          >
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </Stack>
      </form>

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default EmailCenter;
