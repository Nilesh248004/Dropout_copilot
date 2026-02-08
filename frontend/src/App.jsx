import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Box, Button, CssBaseline } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { ThemeProvider } from "@mui/material/styles";
import getTheme from "./styles/theme";

// Components & Pages (lazy-loaded to shrink initial bundle)
import Navbar from "./components/Navbar";
import { RoleProvider, useRole } from "./context/RoleContext";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const AddStudentPage = React.lazy(() => import("./pages/AddStudentPage"));
const EditStudent = React.lazy(() => import("./components/EditStudent"));
const StudentManagement = React.lazy(() => import("./pages/StudentManagement"));
const StudentAnalytics = React.lazy(() => import("./pages/StudentAnalytics"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const FacultyExports = React.lazy(() => import("./pages/FacultyExports"));
const FacultyAlerts = React.lazy(() => import("./pages/FacultyAlerts"));
const StudentAlerts = React.lazy(() => import("./pages/StudentAlerts"));
const MyReport = React.lazy(() => import("./pages/MyReport"));

const RoleRoute = ({ allowedRoles, element }) => {
  const { role } = useRole();
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return element;
};

const DashboardRedirect = () => {
  const { role } = useRole();
  const targetRole = role || "student";
  return <Navigate to={`/dashboard/${targetRole}`} replace />;
};

const RoleDashboard = ({ roleName }) => {
  const { role, setRole } = useRole();

  useEffect(() => {
    if (roleName && role !== roleName) {
      setRole(roleName);
    }
  }, [roleName, role, setRole]);

  return <Dashboard />;
};

const AppLayout = ({ themeMode, onToggleTheme }) => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login";

  return (
    <Suspense fallback={<Box sx={{ p: 4 }}>Loading...</Box>}>
      {!hideNavbar && <Navbar themeMode={themeMode} onToggleTheme={onToggleTheme} />}
      {hideNavbar && (
        <Box sx={{ position: "fixed", top: 16, right: 16, zIndex: 1300 }}>
          <Button
            variant="contained"
            onClick={onToggleTheme}
            startIcon={themeMode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            sx={{
              textTransform: "none",
              borderRadius: 999,
              px: 2.5,
              boxShadow: "0 14px 26px rgba(15, 23, 42, 0.25)",
              background:
                themeMode === "dark"
                  ? "linear-gradient(120deg, #38bdf8 0%, #0ea5e9 100%)"
                  : "linear-gradient(120deg, #1e293b 0%, #0f172a 100%)",
            }}
          >
            {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </Box>
      )}
      <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/dashboard/student" element={<RoleDashboard roleName="student" />} />
        <Route path="/dashboard/faculty" element={<RoleDashboard roleName="faculty" />} />
        <Route path="/dashboard/admin" element={<RoleDashboard roleName="admin" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/student/alerts"
          element={<RoleRoute allowedRoles={["student"]} element={<StudentAlerts />} />}
        />
        <Route
          path="/student/report"
          element={<RoleRoute allowedRoles={["student"]} element={<MyReport />} />}
        />

        {/* Add / Edit Student */}
        <Route
          path="/students/add"
          element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<AddStudentPage />} />}
        />
        <Route
          path="/students/edit/:id"
          element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<EditStudent />} />}
        />

        {/* Student List Page */}
        <Route
          path="/studentlist"
          element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<StudentManagement />} />}
        />

        {/* Student Analytics */}
        <Route
          path="/students/:id/analytics"
          element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<StudentAnalytics />} />}
        />
        <Route
          path="/faculty/alerts"
          element={<RoleRoute allowedRoles={["faculty"]} element={<FacultyAlerts />} />}
        />
        <Route
          path="/admin/exports"
          element={<RoleRoute allowedRoles={["admin"]} element={<FacultyExports />} />}
        />

        {/* Catch all unmatched routes */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("dropoutcopilot.theme") || "light";
  });
  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("dropoutcopilot.theme", next);
      }
      return next;
    });
  }, []);
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", themeMode);
    root.style.setProperty("--app-bg", theme.palette.background.default);
    root.style.setProperty("--app-text", theme.palette.text.primary);
    root.style.setProperty("--app-muted", theme.palette.text.secondary);
    root.style.setProperty("--app-surface", theme.palette.background.paper);
    root.style.setProperty("--app-border", theme.palette.divider);
    root.style.setProperty(
      "--app-card-shadow",
      themeMode === "dark"
        ? "0 14px 30px rgba(0,0,0,0.45)"
        : "0 4px 12px rgba(15,23,42,0.08)"
    );
    root.style.setProperty(
      "--app-table-head-bg",
      themeMode === "dark" ? "#1e293b" : "#2563eb"
    );
    root.style.setProperty(
      "--app-table-head-text",
      themeMode === "dark" ? "#e2e8f0" : "#ffffff"
    );
  }, [theme, themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RoleProvider>
        <Router>
          <AppLayout themeMode={themeMode} onToggleTheme={toggleTheme} />
        </Router>
      </RoleProvider>
    </ThemeProvider>
  );
};

export default App;
