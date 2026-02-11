import { alpha, createTheme } from "@mui/material/styles";

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
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: "'Manrope', 'Space Grotesk', sans-serif",
      h5: {
        fontWeight: 700,
      },
      button: { textTransform: "none", fontWeight: 700, letterSpacing: 0.1 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999 },
          containedPrimary: {
            boxShadow: `0 12px 28px ${alpha("#2563eb", mode === "light" ? 0.28 : 0.5)}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: mode === "light" ? "rgba(255,255,255,0.96)" : "rgba(10,14,26,0.92)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${mode === "light" ? "rgba(15,23,42,0.06)" : "rgba(148,163,184,0.16)"}`,
            boxShadow: mode === "light"
              ? "0 18px 44px rgba(15,23,42,0.12)"
              : "0 22px 50px rgba(0,0,0,0.55)",
          },
        },
      },
      MuiCard: { styleOverrides: { root: { borderRadius: 18 } } },
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-head": {
              fontWeight: 700,
              letterSpacing: 0.08,
              backgroundColor: "var(--app-table-head-bg)",
              color: "var(--app-table-head-text)",
            },
          },
        },
      },
    },
  });

export default getTheme;
