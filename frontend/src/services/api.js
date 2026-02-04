// src/services/api.js
import axios from "axios";

const BASE_URL = "http://localhost:4000";
const ML_API = "http://localhost:8000";

// ================= STUDENT APIs =================

// Get all students with academic & AI data
export const getAllStudentsFull = async () => {
  const res = await axios.get(`${BASE_URL}/students/full`);
  return res.data;
};

// Get paginated students
export const getStudents = async (page = 1) => {
  const res = await axios.get(`${BASE_URL}/students/page/${page}`);
  return res.data;
};

// Get student by registration number
export const getStudentByRegNo = async (regno) => {
  const res = await axios.get(`${BASE_URL}/students/${regno}`);
  return res.data;
};

// Add a new student
export const addStudent = async (student) => {
  const res = await axios.post(`${BASE_URL}/students`, student);
  return res.data;
};

// Add blank academic record for a student
export const addAcademicRecord = async (record) => {
  const res = await axios.post(`${BASE_URL}/academic`, record);
  return res.data;
};

// Update student
export const updateStudent = async (id, updatedData) => {
  const res = await axios.put(`${BASE_URL}/students/${id}`, updatedData);
  return res.data;
};

// Delete student
export const deleteStudent = async (id) => {
  const res = await axios.delete(`${BASE_URL}/students/${id}`);
  return res.data;
};

// ================= ML PREDICTION =================

// Predict dropout from ML API
export const predictDropout = async (data) => {
  const res = await axios.post(`${ML_API}/predict`, data);
  return res.data;
};

// Predict and save result to database for a student
export const predictAndSave = async (student_id) => {
  const res = await axios.post(`${BASE_URL}/predict/${student_id}`);
  return res.data;
};
