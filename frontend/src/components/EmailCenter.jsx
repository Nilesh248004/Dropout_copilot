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

const EmailCenter = ({ role }) => {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    replyTo: "",
    recipients: [],
  });

  const recipientOptions = useMemo(() => {
    if (role === "student") {
      return ["faculty", "admin"];
    }
    if (role === "faculty") {
      return ["student", "admin"];
    }
    return ["student", "faculty"];
  }, [role]);

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
      await sendEmail({
        fromRole: role,
        toRoles: formData.recipients,
        subject: formData.subject,
        message: formData.message,
        replyTo: formData.replyTo,
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
        <Chip label={`From: ${role}`} color="secondary" sx={{ ml: { md: "auto" } }} />
      </Stack>

      <Divider sx={{ mb: 3 }} />

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
            label="Reply-to Email"
            name="replyTo"
            type="email"
            value={formData.replyTo}
            onChange={handleChange}
            fullWidth
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
            disabled={sending || formData.recipients.length === 0}
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