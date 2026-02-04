import React from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import StudentTable from "../components/StudentTable";

const StudentManagement = () => {
  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 3, boxShadow: 3 }}>
        <Typography variant="h6" mb={2}>
          Student Records Management
        </Typography>
        <Box>
          <StudentTable />
        </Box>
      </Paper>
    </Container>
  );
};

export default StudentManagement;
