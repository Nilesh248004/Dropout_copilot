import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./styles/theme";

// Components & Pages
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import AddStudentPage from "./pages/AddStudentPage";
import EditStudent from "./components/EditStudent";
import StudentListPage from "./pages/StudentList"; // StudentList.jsx page
import StudentAnalytics from "./pages/StudentAnalytics";
import LoginPage from "./pages/LoginPage";
import { RoleProvider, useRole } from "./context/RoleContext";

const RoleRoute = ({ allowedRoles, element }) => {
  const { role } = useRole();
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return element;
};
const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <CssBaseline />
      <RoleProvider>
        <Router>
          <Navbar />
          <Routes>
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<LoginPage />} />

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
              element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<StudentListPage />} />}
            />

            {/* Student Analytics */}
            <Route
              path="/students/:id/analytics"
              element={<RoleRoute allowedRoles={["faculty", "admin"]} element={<StudentAnalytics />} />}
            />

            {/* Catch all unmatched routes */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </RoleProvider>
        <Navbar />
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Add / Edit Student */}
          <Route path="/students/add" element={<AddStudentPage />} />
          <Route path="/students/edit/:id" element={<EditStudent />} />

          {/* Student List Page */}
          <Route path="/studentlist" element={<StudentListPage />} /> {/* <-- updated */}

          {/* Catch all unmatched routes */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
          <Route path="/students/:id/analytics" element={<StudentAnalytics />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
