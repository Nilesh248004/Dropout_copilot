import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./styles/theme";

// Components & Pages
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import AddStudentPage from "./pages/AddStudentPage";
import EditStudent from "./components/EditStudent";
import StudentManagement from "./pages/StudentManagement";
import StudentAnalytics from "./pages/StudentAnalytics";
import LoginPage from "./pages/LoginPage";
import FacultyExports from "./pages/FacultyExports";
import FacultyAlerts from "./pages/FacultyAlerts";
import StudentAlerts from "./pages/StudentAlerts";
import { RoleProvider, useRole } from "./context/RoleContext";

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

const AppLayout = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login";

  return (
    <>
      {!hideNavbar && <Navbar />}
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
    </>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RoleProvider>
        <Router>
          <AppLayout />
        </Router>
      </RoleProvider>
    </ThemeProvider>
  );
};

export default App;
