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
  const summary = {
    total: students.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const s of students) {
    try {
      await axios.post(`${API_BASE_URL}/predict/${s.id}`);
      summary.succeeded += 1;
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Prediction failed";
      const isIncompleteData = err.response?.status === 400;

      if (isIncompleteData) {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }

      summary.failures.push({
        studentId: s.id,
        name: s.name || `Student ${s.id}`,
        message,
      });
      console.error(`Prediction failed for student ${s.id}:`, message);
    }
  }

  return summary;
};
