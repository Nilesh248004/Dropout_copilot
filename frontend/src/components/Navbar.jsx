import React from "react";
import { AppBar, Toolbar, Typography, Button, Box, FormControl, MenuItem, Select, Chip } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useRole } from "../context/RoleContext";

const Navbar = () => {
  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
          AI Student Dropout Copilot

        </Typography>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Chip label={roleLabel} color="secondary" size="small" />
          <FormControl size="small" sx={{ minWidth: 140, bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1 }}>
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              displayEmpty
              sx={{ color: "#fff", ".MuiSvgIcon-root": { color: "#fff" } }}
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="faculty">Faculty</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ ml: 3, display: "flex", gap: 1 }}>
          <Button color="inherit" component={RouterLink} to="/dashboard">
            Dashboard
          </Button>
          <Button color="inherit" component={RouterLink} to="/login">
            Login
          </Button>
          {(isFaculty || isAdmin) && (
            <>
              <Button color="inherit" component={RouterLink} to="/students/add">
                Add Student
              </Button>
              <Button color="inherit" component={RouterLink} to="/studentlist">
                Student List
              </Button>
            </>
          )}
          {isStudent && (
            <Button color="inherit" component={RouterLink} to="/dashboard">
              My Report
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
