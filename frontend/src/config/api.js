// src/config/api.js

const detectBackendUrl = () => {
  if (process.env.REACT_APP_API_BASE_URL) return process.env.REACT_APP_API_BASE_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith("vercel.app")) {
      return "https://dropout-backend-hpjl.onrender.com";
    }
  }
  return "http://localhost:4000";
};

export const API_BASE_URL = detectBackendUrl();

export const ML_BASE_URL =
  process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
