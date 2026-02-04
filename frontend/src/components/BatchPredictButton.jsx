import React from "react";
import { Button } from "@mui/material";
import { batchPredictAll } from "../api/studentApi";
import { useRole } from "../context/RoleContext";

const BatchPredictButton = ({ reload }) => {
  const { role, facultyId } = useRole();

  const handleBatchPredict = async () => {
    if (role === "faculty" && !facultyId) {
      alert("Please sign in with your Faculty ID before predicting.");
      return;
    }
    const targetLabel = role === "faculty" ? "your students" : "all students";
    alert(`Starting AI prediction for ${targetLabel}...`);
    await batchPredictAll(role === "faculty" ? facultyId : undefined);
    alert(`Prediction completed for ${targetLabel}!`);
    reload();
  };

  return (
    <Button
      variant="contained"
      color="error"
      onClick={handleBatchPredict}
      sx={{ mb: 2 }}
    >
      ⚡ Predict All Students
    </Button>
  );
};

export default BatchPredictButton;
