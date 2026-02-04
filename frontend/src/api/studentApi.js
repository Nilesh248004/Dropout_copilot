import axios from "axios";
import { API_BASE_URL } from "../config/api";

/**
 * Fetch all students from the backend
 */
export const getStudents = async (facultyId) => {
  try {
    const params = facultyId ? { faculty_id: facultyId } : undefined;
    const res = await axios.get(`${API_BASE_URL}/students`, { params });
    return res.data;
  } catch (err) {
    console.error("Error fetching students:", err.message);
    return [];
  }
};

/**
 * Batch predict dropout risk for all students
 */
export const batchPredictAll = async (facultyId) => {
  const students = await getStudents(facultyId);

  for (let s of students) {
    try {
      await axios.post(`${API_BASE_URL}/predict/${s.id}`);
    } catch (err) {
      console.error(`Prediction failed for student ${s.id}:`, err.message);
    }
  }

  return true;
};
