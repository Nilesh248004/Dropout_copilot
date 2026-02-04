import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#ff4081",
    },
  },
  typography: {
    fontFamily: "'Roboto', sans-serif",
    h5: {
      fontWeight: 600,
    },
  },
});

export default theme;
