import React, { useMemo } from "react";
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  alpha,
  useTheme,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";

const MobileNav = ({ themeMode = "light", onToggleTheme }) => {
  const { role } = useRole();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const themeToggle = {
      label: themeMode === "dark" ? "Light" : "Dark",
      action: "toggle-theme",
      icon: themeMode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />,
    };
    switch (role) {
      case "student":
        return [
          { label: "Home", to: "/dashboard/student", icon: <DashboardRoundedIcon /> },
          { label: "Report", to: "/student/report", icon: <InsightsRoundedIcon /> },
          { label: "Alerts", to: "/student/alerts", icon: <NotificationsRoundedIcon /> },
          themeToggle,
        ];
      case "faculty":
        return [
          { label: "Home", to: "/dashboard/faculty", icon: <DashboardRoundedIcon /> },
          { label: "Students", to: "/studentlist", icon: <ListAltRoundedIcon /> },
          { label: "Add", to: "/students/add", icon: <PersonAddAlt1RoundedIcon /> },
          { label: "Alerts", to: "/faculty/alerts", icon: <NotificationsRoundedIcon /> },
          themeToggle,
        ];
      case "admin":
        return [
          { label: "Home", to: "/dashboard/admin", icon: <DashboardRoundedIcon /> },
          { label: "Exports", to: "/admin/exports", icon: <CloudUploadRoundedIcon /> },
          { label: "Students", to: "/studentlist", icon: <ListAltRoundedIcon /> },
          themeToggle,
        ];
      default:
        return [];
    }
  }, [role, themeMode]);

  if (!items.length) return null;

  const activeIndex = items.findIndex(
    (item) => item.to && location.pathname.startsWith(item.to.split("/:")[0])
  );

  return (
    <Paper
      elevation={10}
      sx={{
        position: "fixed",
        left: "max(12px, env(safe-area-inset-left))",
        right: "max(12px, env(safe-area-inset-right))",
        bottom: "max(10px, env(safe-area-inset-bottom))",
        borderRadius: 3,
        px: 1,
        py: 0.5,
        zIndex: 1201,
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92))"
            : "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(241,245,255,0.94))",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 22px 38px rgba(0,0,0,0.55)"
            : "0 18px 40px rgba(15,23,42,0.16)",
      }}
    >
      <BottomNavigation
        showLabels
        value={activeIndex === -1 ? false : activeIndex}
        onChange={(_, newIndex) => {
          const target = items[newIndex];
          if (!target) return;
          if (target.action === "toggle-theme") {
            onToggleTheme?.();
            return;
          }
          if (target.to) navigate(target.to);
        }}
        sx={{
          "& .MuiBottomNavigationAction-root": {
            minWidth: 72,
            maxWidth: 160,
            fontWeight: 700,
          },
        }}
      >
        {items.map((item) => (
          <BottomNavigationAction key={item.label} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileNav;
