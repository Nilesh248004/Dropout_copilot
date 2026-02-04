const savePrediction = async (studentId, data) => {
  await fetch("http://localhost:5000/api/prediction/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_id: studentId,
      dropout_prediction: data.dropout_prediction,
      risk_score: data.risk_score,
      risk_level: data.risk_level
    })
  });
};
