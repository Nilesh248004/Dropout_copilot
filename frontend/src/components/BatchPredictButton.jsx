import React from "react";
import { Button } from "@mui/material";
import { batchPredictAll } from "../api/studentApi";

const BatchPredictButton = ({ reload }) => {
  const handleBatchPredict = async () => {
    alert("Starting AI prediction for all students...");
    await batchPredictAll();
    alert("Prediction completed for all students!");
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
