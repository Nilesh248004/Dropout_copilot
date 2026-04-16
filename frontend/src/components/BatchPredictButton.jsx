import React, { useState } from "react";
import { Button } from "@mui/material";
import { batchPredictAll } from "../api/studentApi";
import { useRole } from "../context/RoleContext";

const BatchPredictButton = ({ reload }) => {
  const { role, facultyId } = useRole();
  const [running, setRunning] = useState(false);

  const handleBatchPredict = async () => {
    if (role === "faculty" && !facultyId) {
      alert("Please sign in with your Faculty ID before predicting.");
      return;
    }

    const targetLabel = role === "faculty" ? "your students" : "all students";

    try {
      setRunning(true);
      const result = await batchPredictAll(role === "faculty" ? facultyId : undefined);

      if (!result.total) {
        alert(`No students found for ${targetLabel}.`);
        return;
      }

      const lines = [
        `Prediction run finished for ${targetLabel}.`,
        `Success: ${result.succeeded}/${result.total}`,
      ];

      if (result.skipped) {
        lines.push(`Skipped (incomplete data): ${result.skipped}`);
      }
      if (result.failed) {
        lines.push(`Failed: ${result.failed}`);
      }
      if (result.failures.length) {
        const preview = result.failures
          .slice(0, 3)
          .map((item) => `${item.name}: ${item.message}`);
        lines.push("", ...preview);
        if (result.failures.length > 3) {
          lines.push(`...and ${result.failures.length - 3} more.`);
        }
      }

      alert(lines.join("\n"));
      if (reload) {
        await reload();
      }
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Batch prediction failed.";
      alert(message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="contained"
      color="error"
      onClick={handleBatchPredict}
      disabled={running}
      sx={{ mb: 2 }}
    >
      {running ? "Predicting..." : "Predict All Students"}
    </Button>
  );
};

export default BatchPredictButton;
