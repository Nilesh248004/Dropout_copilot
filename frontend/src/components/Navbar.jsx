import React from "react";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";

const Navbar = () => {
  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AI Student Dropout Copilot
        </Typography>
        <Button color="inherit" href="/">
          Dashboard
        </Button>
        <Button color="inherit" href="/add">
          Add Student
        </Button>
        <Button color="inherit" href="/predict">
          Predict
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
