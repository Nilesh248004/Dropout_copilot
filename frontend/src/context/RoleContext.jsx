import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const RoleContext = createContext({
  role: "faculty",
  setRole: () => {},
  email: "",
  setEmail: () => {},
  facultyId: "",
  setFacultyId: () => {},
  studentId: "",
  setStudentId: () => {},
});

const ROLE_STORAGE_KEY = "dropoutcopilot.role";
const EMAIL_STORAGE_KEY = "dropoutcopilot.email";
const FACULTY_STORAGE_KEY = "dropoutcopilot.faculty_id";
const STUDENT_STORAGE_KEY = "dropoutcopilot.student_id";

export const RoleProvider = ({ children }) => {
  const [role, setRoleState] = useState(() => {
    if (typeof window === "undefined") {
      return "faculty";
    }
    return localStorage.getItem(ROLE_STORAGE_KEY) || "faculty";
  });
  const [email, setEmailState] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem(EMAIL_STORAGE_KEY) || "";
  });
  const [facultyId, setFacultyIdState] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem(FACULTY_STORAGE_KEY) || "";
  });
  const [studentId, setStudentIdState] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem(STUDENT_STORAGE_KEY) || "";
  });

  const setRole = (nextRole) => {
    setRoleState(nextRole);
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
      if (nextRole !== "faculty") {
        localStorage.removeItem(FACULTY_STORAGE_KEY);
        setFacultyIdState("");
      }
      if (nextRole !== "student") {
        localStorage.removeItem(STUDENT_STORAGE_KEY);
        setStudentIdState("");
      }
    }
  };

  const setEmail = (nextEmail) => {
    const normalized = (nextEmail || "").trim().toLowerCase();
    setEmailState(normalized);
    if (typeof window !== "undefined") {
      if (normalized) {
        localStorage.setItem(EMAIL_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(EMAIL_STORAGE_KEY);
      }
    }
  };

  useEffect(() => {
    if (email || typeof window === "undefined") {
      return;
    }
    const token = localStorage.getItem("google_id_token");
    if (!token) {
      return;
    }
    try {
      const parts = token.split(".");
      if (parts.length < 2) {
        return;
      }
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
      const payload = JSON.parse(atob(padded));
      const tokenEmail = (payload?.email || "").trim().toLowerCase();
      if (tokenEmail) {
        setEmail(tokenEmail);
      }
    } catch {
      // Ignore token parsing errors.
    }
  }, [email, setEmail]);

  const setFacultyId = (nextId) => {
    const normalized = (nextId || "").trim().toLowerCase();
    setFacultyIdState(normalized);
    if (typeof window !== "undefined") {
      if (normalized) {
        localStorage.setItem(FACULTY_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(FACULTY_STORAGE_KEY);
      }
    }
  };

  const setStudentId = (nextId) => {
    const normalized = (nextId || "").trim().toLowerCase();
    setStudentIdState(normalized);
    if (typeof window !== "undefined") {
      if (normalized) {
        localStorage.setItem(STUDENT_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(STUDENT_STORAGE_KEY);
      }
    }
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      email,
      setEmail,
      facultyId,
      setFacultyId,
      studentId,
      setStudentId,
    }),
    [role, email, facultyId, studentId]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => useContext(RoleContext);
