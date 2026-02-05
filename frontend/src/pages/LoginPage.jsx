import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
        background:
          "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.28), transparent 48%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.36), transparent 42%), linear-gradient(140deg, #0b1224 0%, #0f172a 45%, #111827 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
        "&:before": {
          content: '""',
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "rgba(148,163,184,0.08)",
          top: -140,
          right: -140,
        },
        "&:after": {
          content: '""',
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.12)",
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
          background: "rgba(56,189,248,0.25)",
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
        <Stack spacing={3} sx={{ color: "#e2e8f0", pr: { md: 4 } }}>
          <Chip
            label="Dropout Copilot"
            sx={{
              alignSelf: "flex-start",
              bgcolor: "rgba(59,130,246,0.2)",
              color: "#bfdbfe",
              fontWeight: 600,
              letterSpacing: 1.1,
            }}
          />
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Modern insights for every role in your campus.
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(226,232,240,0.78)", maxWidth: 520 }}>
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
                  color: "rgba(226,232,240,0.9)",
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#7dd3fc",
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
              background: "linear-gradient(145deg, rgba(15,23,42,0.85), rgba(30,41,59,0.7))",
              border: "1px solid rgba(148,163,184,0.2)",
              maxWidth: 420,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Built for clarity at every level
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.75)" }}>
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
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(255,255,255,0.97)",
            boxShadow: "0 30px 80px rgba(15,23,42,0.45)",
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
                    borderColor: "rgba(15,23,42,0.2)",
                    color: "#0f172a",
                    textTransform: "none",
                    py: 1.1,
                    fontWeight: 600,
                    bgcolor: "rgba(248,250,252,0.6)",
                    width: "100%",
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
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
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

            <Divider>or</Divider>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {mode === "signup" && (
                  <TextField
                    label="Full name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    fullWidth
                  />
                )}
                <TextField
                  label="Email address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  fullWidth
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  fullWidth
                />
                {mode === "signup" && (
                  <TextField
                    label="Confirm password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    fullWidth
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
                            borderColor: "rgba(15,23,42,0.18)",
                            bgcolor: isSelected ? "#0f172a" : "transparent",
                            color: isSelected ? "#fff" : "#0f172a",
                            "&:hover": {
                              bgcolor: isSelected ? "#111827" : "rgba(15,23,42,0.05)",
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
                  />
                )}

                <Button
                  variant="contained"
                  type="submit"
                  sx={{
                    py: 1.2,
                    textTransform: "none",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
                    boxShadow: "0 10px 24px rgba(37,99,235,0.35)",
                  }}
                >
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>

                {authError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {authError}
                  </Alert>
                )}
                {needsFacultyLink && (
                  <Box>
                    <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
                      This faculty account needs to be linked to a Faculty ID once.
                    </Alert>
                    <TextField
                      label="Faculty ID"
                      value={linkFacultyId}
                      onChange={(event) => setLinkFacultyId(event.target.value)}
                      fullWidth
                      required
                      helperText="Enter your faculty ID to complete setup"
                    />
                    <Button
                      variant="contained"
                      sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
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
              <Link component="button" type="button" onClick={handleModeChange}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Link>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default LoginPage;
