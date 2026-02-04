import React, { createContext, useContext, useMemo, useState } from "react";

const RoleContext = createContext({
  role: "faculty",
  setRole: () => {},
});

const ROLE_STORAGE_KEY = "dropoutcopilot.role";

export const RoleProvider = ({ children }) => {
  const [role, setRoleState] = useState(() => {
    if (typeof window === "undefined") {
      return "faculty";
    }
    return localStorage.getItem(ROLE_STORAGE_KEY) || "faculty";
  });

  const setRole = (nextRole) => {
    setRoleState(nextRole);
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    }
  };

  const value = useMemo(() => ({ role, setRole }), [role]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => useContext(RoleContext);
