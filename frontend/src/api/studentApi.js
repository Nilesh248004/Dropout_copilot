import axios from "axios";

/**
 * Fetch all students from the backend
 */
export const getStudents = async () => {
  try {
    const res = await axios.get("http://localhost:4000/students");
    return res.data;
  } catch (err) {
    console.error("Error fetching students:", err.message);
    return [];
  }
};

/**
 * Batch predict dropout risk for all students
 */
export const batchPredictAll = async () => {
  const students = await getStudents();

  for (let s of students) {
    try {
      await axios.post(`http://localhost:4000/predict/${s.id}`);
    } catch (err) {
      console.error(`Prediction failed for student ${s.id}:`, err.message);
    }
  }

  return true;
};
