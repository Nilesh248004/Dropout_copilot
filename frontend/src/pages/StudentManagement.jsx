import React, { useState } from "react";
import { Box, Container, Paper, Stack, TextField, Typography, Chip } from "@mui/material";
import StudentTable from "../components/StudentTable";

const StudentManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 3, boxShadow: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "center" }}
          mb={2}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Student Records Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Search and manage student records.
            </Typography>
          </Box>
          <TextField
            placeholder="Search by name, register no, phone, year, semester..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 320 } }}
          />
          <Chip size="small" label="Student List" variant="outlined" />
        </Stack>
        <Box>
          <StudentTable searchTerm={searchTerm} />
        </Box>
      </Paper>
    </Container>
  );
};

export default StudentManagement;
