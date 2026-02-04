import React from "react";
import { AppBar, Toolbar, Typography, Button, Box, Chip } from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

const Navbar = () => {
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Role";
  const isStudent = role === "student";
  const isFaculty = role === "faculty";
  const isAdmin = role === "admin";
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        background: "linear-gradient(120deg, #0f172a 0%, #1e293b 50%, #0b1224 100%)",
        borderBottom: "1px solid rgba(148,163,184,0.25)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Toolbar sx={{ minHeight: 72 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 10px 20px rgba(37,99,235,0.35)",
            }}
          >
            DC
          </Box>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: "#e2e8f0" }}>
              Dropout Copilot
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(226,232,240,0.7)" }}>
              AI Student Success Suite
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={1.5}>
          <Chip
            label={roleLabel}
            size="small"
            sx={{
              bgcolor: "rgba(56,189,248,0.18)",
              color: "#bae6fd",
              fontWeight: 600,
              border: "1px solid rgba(56,189,248,0.4)",
            }}
          />
        </Box>
        <Box sx={{ ml: 3, display: "flex", gap: 1 }}>
          {isStudent ? (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard/student"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/dashboard/student")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/dashboard/student")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard/student"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                My Report
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/student/alerts"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/student/alerts")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/student/alerts")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Alerts
              </Button>
              <Button
                color="inherit"
                onClick={handleLogout}
                endIcon={<LogoutRoundedIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid rgba(248,113,113,0.5)",
                  color: "#fecaca",
                  "&:hover": { background: "rgba(248,113,113,0.15)" },
                }}
              >
                Logout
              </Button>
            </>
          ) : isFaculty ? (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard/faculty"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/dashboard/faculty")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/dashboard/faculty")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/students/add"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Add Student
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/studentlist"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Student List
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/faculty/alerts"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/faculty/alerts")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/faculty/alerts")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Alerts
              </Button>
              <Button
                color="inherit"
                onClick={handleLogout}
                endIcon={<LogoutRoundedIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid rgba(248,113,113,0.5)",
                  color: "#fecaca",
                  "&:hover": { background: "rgba(248,113,113,0.15)" },
                }}
              >
                Logout
              </Button>
            </>
          ) : isAdmin ? (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard/admin"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/dashboard/admin")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/dashboard/admin")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/admin/exports"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: isActive("/admin/exports")
                    ? "1px solid rgba(56,189,248,0.6)"
                    : "1px solid transparent",
                  background: isActive("/admin/exports")
                    ? "rgba(56,189,248,0.16)"
                    : "transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Faculty Exports
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/studentlist"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Student List
              </Button>
              <Button
                color="inherit"
                onClick={handleLogout}
                endIcon={<LogoutRoundedIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid rgba(248,113,113,0.5)",
                  color: "#fecaca",
                  "&:hover": { background: "rgba(248,113,113,0.15)" },
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid transparent",
                  "&:hover": { background: "rgba(148,163,184,0.18)" },
                }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/login"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  border: "1px solid rgba(56,189,248,0.4)",
                  color: "#bae6fd",
                  "&:hover": { background: "rgba(56,189,248,0.18)" },
                }}
              >
                Login
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
