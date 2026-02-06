import { createTheme } from "@mui/material/styles";

const getTheme = (mode = "light") =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? "#2563eb" : "#60a5fa",
      },
      secondary: {
        main: mode === "light" ? "#f97316" : "#fbbf24",
      },
      background: {
        default: mode === "light" ? "#f5f7fa" : "#0b1220",
        paper: mode === "light" ? "#ffffff" : "#0f172a",
      },
    },
    typography: {
      fontFamily: "'Manrope', 'Space Grotesk', sans-serif",
      h5: {
        fontWeight: 700,
      },
    },
  });

export default getTheme;
