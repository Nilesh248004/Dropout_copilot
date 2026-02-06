import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GoogleIcon from "@mui/icons-material/Google";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { keyframes } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "877119541780-lhrkbjv2kfb7ev8kmb1innnu7coifbs8.apps.googleusercontent.com";
const PRIMARY_ORIGINS = (
  process.env.REACT_APP_PRIMARY_ORIGINS ||
  process.env.REACT_APP_PRIMARY_ORIGIN ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PRIMARY_ORIGIN = PRIMARY_ORIGINS[0] || "http://localhost:3000";
const LoginPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const palette = theme.palette;
  const primaryMain = palette.primary.main;
  const primaryLight = palette.primary.light || palette.primary.main;
  const textPrimary = palette.text.primary;
  const textSecondary = palette.text.secondary;
  const surface = palette.background.paper;
  const borderSoft = alpha(textPrimary, isDark ? 0.18 : 0.12);
  const borderStrong = alpha(textPrimary, isDark ? 0.28 : 0.18);
  const panelBg = alpha(surface, isDark ? 0.92 : 0.98);
  const fieldBg = alpha(surface, isDark ? 0.5 : 0.9);
  const primaryGradient = `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`;
  const navigate = useNavigate();
  const { role, setRole, email, setEmail, facultyId, setFacultyId, studentId, setStudentId } = useRole();
  const [mode, setMode] = useState("signin");
  const [selectedRole, setSelectedRole] = useState(role || "student");
  const [facultyIdInput, setFacultyIdInput] = useState(facultyId || "");
  const [studentIdInput, setStudentIdInput] = useState(studentId || "");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [authError, setAuthError] = useState("");
  const [needsFacultyLink, setNeedsFacultyLink] = useState(false);
  const [linkFacultyId, setLinkFacultyId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingGoogleToken, setPendingGoogleToken] = useState("");
  const [copied, setCopied] = useState(false);
  const googleButtonRef = useRef(null);
  const googleApiRef = useRef(null);
  const googleInitRef = useRef(false);
  const modeRef = useRef(mode);
  const roleRef = useRef(selectedRole);
  const facultyIdRef = useRef(facultyIdInput);
  const studentIdRef = useRef(studentIdInput);
  const facultyIdTouchedRef = useRef(false);
  const studentIdTouchedRef = useRef(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState("request");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState(null);
  const [resetForm, setResetForm] = useState({
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });

  const normalizeEmail = (email) => (email || "").trim().toLowerCase();
  const normalizeFacultyId = (value) => (value || "").trim().toLowerCase();
  const normalizeStudentId = (value) => (value || "").trim().toLowerCase();
  const fadeUp = useMemo(
    () => keyframes`
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    `,
    []
  );

  const glow = useMemo(
    () => keyframes`
      0% { transform: translateY(0px); opacity: 0.6; }
      50% { transform: translateY(-10px); opacity: 0.85; }
      100% { transform: translateY(0px); opacity: 0.6; }
    `,
    []
  );

  const handleModeChange = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setAuthError("");
    setGoogleError("");
    setNeedsFacultyLink(false);
    setLinkFacultyId("");
    setLinkError("");
    setPendingEmail("");
    setPendingPassword("");
    setPendingGoogleToken("");
    setResetOpen(false);
    setResetStatus(null);
    facultyIdTouchedRef.current = false;
    studentIdTouchedRef.current = false;
  };

  const handleChange = (event) => {
    setAuthError("");
    setLinkError("");
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleFacultyIdChange = (event) => {
    setAuthError("");
    setLinkError("");
    facultyIdTouchedRef.current = true;
    setFacultyIdInput(event.target.value);
  };
  const handleStudentIdChange = (event) => {
    setAuthError("");
    setLinkError("");
    studentIdTouchedRef.current = true;
    setStudentIdInput(event.target.value);
  };

  const handleResetChange = (event) => {
    setResetStatus(null);
    setResetForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const openResetDialog = () => {
    setResetStatus(null);
    setResetStep("request");
    setResetForm((prev) => ({
      ...prev,
      email: formData.email || "",
      code: "",
      newPassword: "",
      confirmPassword: "",
    }));
    setResetOpen(true);
  };

  const closeResetDialog = () => {
    setResetOpen(false);
    setResetLoading(false);
    setResetStatus(null);
  };

  const requestResetCode = async () => {
    const email = normalizeEmail(resetForm.email);
    if (!email) {
      setResetStatus({ type: "error", message: "Please enter your email." });
      return;
    }
    try {
      setResetLoading(true);
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        email,
        role: selectedRole,
        delivery: "email",
      });
      setResetStep("verify");
      setResetStatus({ type: "success", message: "Reset code sent to your email." });
    } catch (err) {
      setResetStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to send reset code.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const submitResetPassword = async () => {
    const email = normalizeEmail(resetForm.email);
    if (!email) {
      setResetStatus({ type: "error", message: "Please enter your email." });
      return;
    }
    if (!resetForm.code) {
      setResetStatus({ type: "error", message: "Enter the email code." });
      return;
    }
    if (!resetForm.newPassword || resetForm.newPassword.length < 6) {
      setResetStatus({
        type: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    try {
      setResetLoading(true);
      await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        email,
        role: selectedRole,
        code: resetForm.code,
        new_password: resetForm.newPassword,
        delivery: "email",
      });
      setResetStatus({ type: "success", message: "Password updated. Please sign in." });
      setResetOpen(false);
    } catch (err) {
      setResetStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to reset password.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const goToDashboard = useCallback((targetRole, nextFacultyId = "", nextStudentId = "", nextEmail = "") => {
    setRole(targetRole);
    if (nextEmail || email) {
      setEmail(nextEmail || email);
    }
    if (targetRole === "faculty") {
      setFacultyId(nextFacultyId);
      setStudentId("");
    } else if (targetRole === "student") {
      setStudentId(nextStudentId);
      setFacultyId("");
    } else {
      setFacultyId("");
      setStudentId("");
    }
    navigate(`/dashboard/${targetRole}`);
  }, [navigate, setRole, setEmail, setFacultyId, setStudentId, email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNeedsFacultyLink(false);
    setLinkError("");
    const email = normalizeEmail(formData.email);
    if (!email) {
      setAuthError("Please enter your email address.");
      return;
    }
    const facultyIdValue = normalizeFacultyId(facultyIdInput);
    const studentIdValue = normalizeStudentId(studentIdInput);
    if (selectedRole === "faculty" && mode === "signup" && !facultyIdValue) {
      setAuthError("Faculty ID is required for faculty access.");
      return;
    }
    if (selectedRole === "student" && mode === "signup" && !studentIdValue) {
      setAuthError("Student ID is required for student access.");
      return;
    }
    try {
      if (mode === "signup") {
        if (!formData.password) {
          setAuthError("Please choose a password.");
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setAuthError("Passwords do not match.");
          return;
        }
        const res = await axios.post(`${API_BASE_URL}/auth/signup`, {
          email,
          password: formData.password,
          role: selectedRole,
          ...(formData.phone ? { phone_number: formData.phone } : {}),
          ...(selectedRole === "faculty" ? { faculty_id: facultyIdValue } : {}),
          ...(selectedRole === "student" ? { student_id: studentIdValue } : {}),
        });
        goToDashboard(
          res.data.role,
          res.data.faculty_id || facultyIdValue,
          res.data.student_id || studentIdValue,
          res.data.email || email
        );
        return;
      }

      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password: formData.password,
        role: selectedRole,
      });
      if (res.data?.needs_faculty_id) {
        setNeedsFacultyLink(true);
        setPendingEmail(email);
        setPendingPassword(formData.password);
        return;
      }
      goToDashboard(
        res.data.role,
        res.data.faculty_id || facultyIdValue,
        res.data.student_id || studentIdValue,
        res.data.email || email
      );
    } catch (err) {
      setAuthError(err.response?.data?.error || "Authentication failed.");
    }
  };

  const handleGoogleSignIn = () => {
    setNeedsFacultyLink(false);
    setLinkError("");
    const facultyIdValue = normalizeFacultyId(facultyIdInput);
    const studentIdValue = normalizeStudentId(studentIdInput);
    if (selectedRole === "faculty" && mode === "signup" && !facultyIdValue) {
      setAuthError("Faculty ID is required for faculty access.");
      return;
    }
    if (selectedRole === "student" && mode === "signup" && !studentIdValue) {
      setAuthError("Student ID is required for student access.");
      return;
    }
    const googleApi = googleApiRef.current || window.google?.accounts?.id;
    if (!googleApi) {
      setGoogleError("Google sign-in is still loading.");
      return;
    }
    googleApi.prompt();
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const originMismatch =
    currentOrigin && !PRIMARY_ORIGINS.includes(currentOrigin);

  const copyDiagnostics = async () => {
    try {
      const payload = [
        `origin=${currentOrigin}`,
        `primary_origins=${PRIMARY_ORIGINS.join(",")}`,
        `client_id=${GOOGLE_CLIENT_ID}`,
        `google_loaded=${Boolean(window.google?.accounts?.id)}`,
      ].join("\n");
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const roleOptions = [
    { value: "student", label: "Student", icon: <SchoolRoundedIcon fontSize="small" /> },
    { value: "faculty", label: "Faculty", icon: <GroupsRoundedIcon fontSize="small" /> },
    { value: "admin", label: "Admin", icon: <AdminPanelSettingsRoundedIcon fontSize="small" /> },
  ];

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;

    const initGoogle = () => {
      if (cancelled) return;
      const googleApi = window.google?.accounts?.id;
      if (!googleApi) {
        attempts += 1;
        if (attempts <= maxAttempts) {
          setTimeout(initGoogle, 300);
        } else if (!cancelled) {
          setGoogleError("Google sign-in failed to load.");
        }
        return;
      }

      try {
        googleApiRef.current = googleApi;
        if (!googleInitRef.current) {
          googleApi.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (credentialResponse) => {
              if (!credentialResponse?.credential) {
                setGoogleError("Google sign-in did not return a credential.");
                return;
              }
              const activeRole = roleRef.current;
              const activeFacultyId = normalizeFacultyId(facultyIdRef.current);
              const activeStudentId = normalizeStudentId(studentIdRef.current);
              if (activeRole === "faculty" && modeRef.current === "signup" && !activeFacultyId) {
                setAuthError("Faculty ID is required for faculty access.");
                return;
              }
              if (activeRole === "student" && modeRef.current === "signup" && !activeStudentId) {
                setAuthError("Student ID is required for student access.");
                return;
              }
              try {
                const res = await axios.post(`${API_BASE_URL}/auth/google`, {
                  id_token: credentialResponse.credential,
                  role: activeRole,
                  mode: modeRef.current,
                  ...(activeRole === "faculty" && modeRef.current === "signup"
                    ? { faculty_id: activeFacultyId }
                    : {}),
                  ...(activeRole === "student" && modeRef.current === "signup"
                    ? { student_id: activeStudentId }
                    : {}),
                });
                if (res.data?.needs_faculty_id) {
                  setNeedsFacultyLink(true);
                  setPendingGoogleToken(credentialResponse.credential);
                  setPendingEmail(res.data?.email || "");
                  return;
                }
                localStorage.setItem("google_id_token", credentialResponse.credential);
                goToDashboard(
                  res.data.role,
                  res.data.faculty_id || activeFacultyId,
                  res.data.student_id || activeStudentId,
                  res.data.email || email
                );
              } catch (error) {
                const data = error.response?.data;
                const detail = data?.details ? ` (${data.details})` : "";
                setAuthError(`${data?.error || "Google sign-in failed."}${detail}`);
              }
            },
          });
          googleInitRef.current = true;
        }

        setGoogleReady(true);
      } catch (err) {
        setGoogleError("Google sign-in initialization failed.");
      }
    };

    initGoogle();

    return () => {
      cancelled = true;
    };
  }, [goToDashboard, email]);

  useEffect(() => {
    if (!googleReady) return;
    const googleApi = googleApiRef.current || window.google?.accounts?.id;
    if (!googleApi || !googleButtonRef.current) return;

    // Re-render button when toggling sign-in/sign-up mode.
    googleButtonRef.current.innerHTML = "";
    googleApi.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: mode === "signup" ? "signup_with" : "signin_with",
      shape: "pill",
      width: 360,
    });
  }, [googleReady, mode]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    roleRef.current = selectedRole;
    setAuthError("");
    if (selectedRole !== "faculty") {
      setNeedsFacultyLink(false);
      setLinkFacultyId("");
      setLinkError("");
      setPendingEmail("");
      setPendingPassword("");
      setPendingGoogleToken("");
      facultyIdTouchedRef.current = false;
    }
    if (selectedRole !== "faculty") {
      setFacultyIdInput("");
    } else if (!facultyIdTouchedRef.current && !facultyIdInput && facultyId) {
      setFacultyIdInput(facultyId);
    }
    if (selectedRole !== "student") {
      setStudentIdInput("");
      studentIdTouchedRef.current = false;
    } else if (!studentIdTouchedRef.current && !studentIdInput && studentId) {
      setStudentIdInput(studentId);
    }
  }, [selectedRole, facultyId, facultyIdInput, studentId, studentIdInput]);

  useEffect(() => {
    facultyIdRef.current = facultyIdInput;
  }, [facultyIdInput]);
  useEffect(() => {
    studentIdRef.current = studentIdInput;
  }, [studentIdInput]);

  const handleLinkFacultyId = async () => {
    const normalizedFacultyId = normalizeFacultyId(linkFacultyId);
    if (!normalizedFacultyId) {
      setLinkError("Faculty ID is required to continue.");
      return;
    }
    try {
      setLinking(true);
      setLinkError("");
      const payload = { faculty_id: normalizedFacultyId };
      if (pendingGoogleToken) {
        payload.id_token = pendingGoogleToken;
      } else {
        payload.email = pendingEmail || normalizeEmail(formData.email);
        payload.password = pendingPassword || formData.password;
      }
      const res = await axios.post(`${API_BASE_URL}/auth/link-faculty`, payload);
      setNeedsFacultyLink(false);
      setPendingEmail("");
      setPendingPassword("");
      setPendingGoogleToken("");
      setLinkFacultyId("");
      goToDashboard(
        res.data.role,
        res.data.faculty_id || normalizedFacultyId,
        res.data.student_id || "",
        res.data.email || email
      );
    } catch (err) {
      setLinkError(err.response?.data?.error || "Unable to link faculty ID.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, md: 6 },
        background: isDark
          ? `radial-gradient(circle at 12% 18%, ${alpha(primaryLight, 0.3)}, transparent 48%), radial-gradient(circle at 80% 0%, ${alpha(primaryMain, 0.32)}, transparent 42%), linear-gradient(140deg, #0b1224 0%, #0f172a 45%, #111827 100%)`
          : `radial-gradient(circle at 12% 18%, ${alpha(primaryLight, 0.2)}, transparent 52%), radial-gradient(circle at 80% 0%, ${alpha(primaryMain, 0.2)}, transparent 45%), linear-gradient(140deg, #f8fafc 0%, #e2e8f0 45%, #f1f5f9 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
        "&:before": {
          content: '""',
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: isDark ? alpha(textPrimary, 0.12) : alpha(primaryMain, 0.12),
          top: -140,
          right: -140,
        },
        "&:after": {
          content: '""',
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: isDark ? alpha(primaryMain, 0.16) : alpha(primaryMain, 0.2),
          bottom: -120,
          left: -120,
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: alpha(primaryMain, isDark ? 0.25 : 0.18),
          filter: "blur(12px)",
          top: { xs: 40, md: 60 },
          right: { xs: 40, md: 120 },
          animation: `${glow} 8s ease-in-out infinite`,
        }}
      />
      <Box
        sx={{
          width: "100%",
          maxWidth: 1140,
          display: "grid",
          gap: { xs: 4, md: 6 },
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
          position: "relative",
          zIndex: 1,
        }}
      >
        <Stack spacing={3} sx={{ color: textPrimary, pr: { md: 4 } }}>
          <Chip
            label="Dropout Copilot"
            sx={{
              alignSelf: "flex-start",
              bgcolor: alpha(primaryMain, isDark ? 0.2 : 0.12),
              color: isDark ? primaryLight : primaryMain,
              fontWeight: 600,
              letterSpacing: 1.1,
            }}
          />
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Modern insights for every role in your campus.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: textSecondary,
              maxWidth: 520,
            }}
          >
            Dropout Copilot connects students, faculty, and admins with a shared view
            of risk analytics, engagement signals, and intervention workflows.
          </Typography>
          <Stack spacing={2}>
            {[
              "Personalized dashboards that adapt to each role",
              "Early warning insights that surface what matters",
              "Collaboration tools for counselling and support",
            ].map((item) => (
              <Box
                key={item}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  color: textPrimary,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: primaryMain,
                  }}
                />
                <Typography variant="body2">{item}</Typography>
              </Box>
            ))}
          </Stack>
          <Box
            sx={{
              mt: 2,
              p: 2.5,
              borderRadius: 3,
              background: `linear-gradient(145deg, ${alpha(surface, isDark ? 0.95 : 0.98)}, ${alpha(surface, isDark ? 0.8 : 0.88)})`,
              border: `1px solid ${borderSoft}`,
              maxWidth: 420,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Built for clarity at every level
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: textSecondary }}
            >
              Switch between student, faculty, and admin views instantly to experience
              the full flow without reloading.
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            border: `1px solid ${borderSoft}`,
            background: panelBg,
            boxShadow: `0 30px 80px ${alpha(theme.palette.common.black, isDark ? 0.55 : 0.18)}`,
            animation: `${fadeUp} 0.6s ease-out`,
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mode === "signin"
                  ? "Sign in to access your dashboard."
                  : "Start tracking student success in minutes."}
              </Typography>
            </Box>

            <Box>
              <Box ref={googleButtonRef} sx={{ width: "100%", minHeight: 44 }} />
              {!googleReady && (
                <Button
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  onClick={handleGoogleSignIn}
                  sx={{
                    mt: 1,
                    borderColor: borderSoft,
                    color: textPrimary,
                    textTransform: "none",
                    py: 1.1,
                    fontWeight: 600,
                    bgcolor: alpha(surface, isDark ? 0.45 : 0.75),
                    width: "100%",
                    "&:hover": {
                      borderColor: borderStrong,
                      bgcolor: alpha(surface, isDark ? 0.6 : 0.9),
                    },
                  }}
                >
                  {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
                </Button>
              )}
              {googleError && (
                <Typography variant="caption" color="error">
                  {googleError}
                </Typography>
              )}
            </Box>

            {(originMismatch || googleError) && (
              <Alert
                severity="warning"
                sx={{
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Google Sign-In needs an authorized origin.
                </Typography>
                <Typography variant="body2">
                  Current: <b>{currentOrigin || "unknown"}</b>
                </Typography>
                <Typography variant="body2">
                  Allowed: <b>{PRIMARY_ORIGINS.join(", ")}</b>
                </Typography>
                <Stack direction="row" spacing={1} mt={1}>
                  {originMismatch && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        window.location.href = `${PRIMARY_ORIGIN}${window.location.pathname}`;
                      }}
                    >
                      Switch to Allowed URL
                    </Button>
                  )}
                  <Button size="small" variant="text" onClick={copyDiagnostics}>
                    {copied ? "Copied" : "Copy Diagnostics"}
                  </Button>
                </Stack>
              </Alert>
            )}

            <Divider
              sx={{
                color: textSecondary,
                "&::before, &::after": {
                  borderColor: borderSoft,
                },
              }}
            >
              or
            </Divider>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {mode === "signup" && (
                  <TextField
                    label="Full name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: fieldBg,
                        borderRadius: 2.5,
                        "& fieldset": { borderColor: borderSoft },
                        "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                        "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                      },
                      "& .MuiInputLabel-root": { color: textSecondary },
                    }}
                  />
                )}
                <TextField
                  label="Email address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: fieldBg,
                      borderRadius: 2.5,
                      "& fieldset": { borderColor: borderSoft },
                      "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                      "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                    },
                    "& .MuiInputLabel-root": { color: textSecondary },
                  }}
                />
                {mode === "signup" && (
                  <TextField
                    label="Phone number (for SMS reset)"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: fieldBg,
                        borderRadius: 2.5,
                        "& fieldset": { borderColor: borderSoft },
                        "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                        "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                      },
                      "& .MuiInputLabel-root": { color: textSecondary },
                    }}
                  />
                )}
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: fieldBg,
                      borderRadius: 2.5,
                      "& fieldset": { borderColor: borderSoft },
                      "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                      "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                    },
                    "& .MuiInputLabel-root": { color: textSecondary },
                  }}
                />
                {mode === "signup" && (
                  <TextField
                    label="Confirm password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: fieldBg,
                        borderRadius: 2.5,
                        "& fieldset": { borderColor: borderSoft },
                        "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                        "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                      },
                      "& .MuiInputLabel-root": { color: textSecondary },
                    }}
                  />
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Continue as
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 1,
                    }}
                  >
                  {roleOptions.map((option) => {
                    const isSelected = selectedRole === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant={isSelected ? "contained" : "outlined"}
                        onClick={() => setSelectedRole(option.value)}
                        startIcon={option.icon}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          borderRadius: 2,
                          borderColor: isSelected ? alpha(primaryMain, 0.55) : borderSoft,
                          bgcolor: isSelected ? primaryMain : alpha(surface, isDark ? 0.2 : 0.6),
                          color: isSelected
                            ? theme.palette.getContrastText(primaryMain)
                            : textPrimary,
                          boxShadow: isSelected
                            ? `0 10px 22px ${alpha(primaryMain, 0.25)}`
                            : "none",
                          "&:hover": {
                            bgcolor: isSelected
                              ? primaryLight
                              : alpha(primaryMain, isDark ? 0.14 : 0.08),
                            borderColor: isSelected
                              ? primaryLight
                              : alpha(primaryMain, isDark ? 0.4 : 0.3),
                          },
                        }}
                      >
                        {option.label}
                      </Button>
                    );
                    })}
                  </Box>
                </Box>
                {selectedRole === "faculty" && mode === "signup" && (
                  <TextField
                    label="Faculty ID"
                    value={facultyIdInput}
                    onChange={handleFacultyIdChange}
                    fullWidth
                    required
                    helperText="Required for faculty access"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: fieldBg,
                        borderRadius: 2.5,
                        "& fieldset": { borderColor: borderSoft },
                        "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                        "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                      },
                      "& .MuiInputLabel-root": { color: textSecondary },
                      "& .MuiFormHelperText-root": { color: textSecondary },
                    }}
                  />
                )}
                {selectedRole === "student" && mode === "signup" && (
                  <TextField
                    label="Student ID"
                    value={studentIdInput}
                    onChange={handleStudentIdChange}
                    fullWidth
                    required
                    helperText="Required for student access"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: fieldBg,
                        borderRadius: 2.5,
                        "& fieldset": { borderColor: borderSoft },
                        "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                        "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                      },
                      "& .MuiInputLabel-root": { color: textSecondary },
                      "& .MuiFormHelperText-root": { color: textSecondary },
                    }}
                  />
                )}

                <Button
                  variant="contained"
                  type="submit"
                  sx={{
                    py: 1.2,
                    textTransform: "none",
                    fontWeight: 700,
                    background: primaryGradient,
                    boxShadow: `0 12px 26px ${alpha(primaryMain, 0.35)}`,
                    "&:hover": {
                      background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                      boxShadow: `0 14px 28px ${alpha(primaryMain, 0.45)}`,
                    },
                  }}
                >
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>

                {mode === "signin" && (
                  <Box display="flex" justifyContent="flex-end">
                    <Link
                      component="button"
                      type="button"
                      onClick={openResetDialog}
                      sx={{ fontWeight: 600, color: primaryMain }}
                    >
                      Forgot password?
                    </Link>
                  </Box>
                )}

                {authError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {authError}
                  </Alert>
                )}
                {needsFacultyLink && (
                  <Box>
                    <Alert
                      severity="info"
                      sx={{
                        borderRadius: 2,
                        mb: 2,
                        backgroundColor: alpha(theme.palette.info.main, isDark ? 0.18 : 0.1),
                        border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                      }}
                    >
                      This faculty account needs to be linked to a Faculty ID once.
                    </Alert>
                    <TextField
                      label="Faculty ID"
                      value={linkFacultyId}
                      onChange={(event) => setLinkFacultyId(event.target.value)}
                      fullWidth
                      required
                      helperText="Enter your faculty ID to complete setup"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          backgroundColor: fieldBg,
                          borderRadius: 2.5,
                          "& fieldset": { borderColor: borderSoft },
                          "&:hover fieldset": { borderColor: alpha(primaryMain, 0.4) },
                          "&.Mui-focused fieldset": { borderColor: primaryMain, borderWidth: 1.5 },
                        },
                        "& .MuiInputLabel-root": { color: textSecondary },
                        "& .MuiFormHelperText-root": { color: textSecondary },
                      }}
                    />
                    <Button
                      variant="contained"
                      sx={{
                        mt: 2,
                        textTransform: "none",
                        fontWeight: 700,
                        background: primaryGradient,
                        boxShadow: `0 10px 22px ${alpha(primaryMain, 0.35)}`,
                        "&:hover": {
                          background: `linear-gradient(135deg, ${primaryMain} 0%, ${primaryLight} 100%)`,
                        },
                      }}
                      onClick={handleLinkFacultyId}
                      disabled={linking}
                    >
                      {linking ? "Linking..." : "Link Faculty ID"}
                    </Button>
                    {linkError && (
                      <Typography variant="caption" color="error" display="block" mt={1}>
                        {linkError}
                      </Typography>
                    )}
                  </Box>
                )}
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <Link
                component="button"
                type="button"
                onClick={handleModeChange}
                sx={{ fontWeight: 600, color: primaryMain }}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Link>
            </Typography>
          </Stack>
        </Paper>
      </Box>
      <Dialog open={resetOpen} onClose={closeResetDialog} fullWidth maxWidth="xs">
        <DialogTitle>Reset your password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              We'll send a reset code to your email address.
            </Typography>
            <Chip
              size="small"
              label={`Role: ${selectedRole}`}
              sx={{ alignSelf: "flex-start" }}
            />
            <TextField
              label="Email address"
              name="email"
              type="email"
              value={resetForm.email}
              onChange={handleResetChange}
              fullWidth
            />
            {resetStep === "verify" && (
              <>
                <TextField
                  label="Email code"
                  name="code"
                  value={resetForm.code}
                  onChange={handleResetChange}
                  fullWidth
                />
                <TextField
                  label="New password"
                  name="newPassword"
                  type="password"
                  value={resetForm.newPassword}
                  onChange={handleResetChange}
                  fullWidth
                />
                <TextField
                  label="Confirm new password"
                  name="confirmPassword"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={handleResetChange}
                  fullWidth
                />
              </>
            )}
            {resetStatus && (
              <Alert severity={resetStatus.type}>{resetStatus.message}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeResetDialog} disabled={resetLoading}>
            Cancel
          </Button>
          {resetStep === "request" ? (
            <Button
              variant="contained"
              onClick={requestResetCode}
              disabled={resetLoading}
            >
              {resetLoading ? "Sending..." : "Send code"}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={submitResetPassword}
              disabled={resetLoading}
            >
              {resetLoading ? "Updating..." : "Reset password"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoginPage;
