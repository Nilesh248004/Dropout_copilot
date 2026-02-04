// backend/mlService.js
const axios = require("axios");

// FastAPI ML service URL
const ML_API_URL = "http://127.0.0.1:8000/predict";

// Function to get prediction from FastAPI
async function getPrediction(studentData) {
  try {
    const response = await axios.post(ML_API_URL, studentData);
    return response.data;
  } catch (error) {
    console.error("ML API Error:", error.message);
    throw error;
  }
}

module.exports = { getPrediction };
