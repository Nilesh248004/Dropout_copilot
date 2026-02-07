from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from pathlib import Path
import os
import json

# ============================
# Paths (SAFE FOR WINDOWS)
# ============================

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR.parent / "models"

MODEL_PATH = MODELS_DIR / "model.pkl"
SCALER_PATH = MODELS_DIR / "scaler.pkl"
METRICS_PATH = MODELS_DIR / "model_metrics.json"

print("BASE_DIR:", BASE_DIR)
print("MODEL_PATH:", MODEL_PATH)
print("SCALER_PATH:", SCALER_PATH)
print("FILES IN MODELS:", os.listdir(MODELS_DIR))

# ============================
# Load Model & Scaler SAFELY
# ============================

loaded_model = joblib.load(MODEL_PATH)

# ✅ model.pkl may contain a tuple (model, feature_names)
if isinstance(loaded_model, tuple):
    model = loaded_model[0]
    feature_names = loaded_model[1]
    print("⚠ Tuple detected. Extracted model + feature names")
else:
    model = loaded_model
    feature_names = None

scaler = joblib.load(SCALER_PATH)

print("✅ Model Type:", type(model))
print("✅ Scaler Type:", type(scaler))
print("✅ Scaler Feature Count:", scaler.n_features_in_)

# ============================
# Risk thresholds (optional)
# ============================
risk_thresholds = {"low": 0.4, "high": 0.7}
prediction_threshold = 0.5
if METRICS_PATH.exists():
    try:
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        thresholds = metrics.get("risk_thresholds")
        if thresholds and "low" in thresholds and "high" in thresholds:
            risk_thresholds = {
                "low": float(thresholds["low"]),
                "high": float(thresholds["high"]),
            }
            print("✅ Loaded risk thresholds:", risk_thresholds)
        if "prediction_threshold" in metrics:
            prediction_threshold = float(metrics["prediction_threshold"])
            print("✅ Loaded prediction threshold:", prediction_threshold)
    except Exception as e:
        print("⚠️ Failed to load thresholds:", e)

# ============================
# FastAPI App
# ============================

app = FastAPI(
    title="AI Student Dropout Copilot ML API",
    description="Predicts student dropout risk in real-time",
    version="1.0.0"
)

# ============================
# CORS
# ============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================
# Input Schema
# ============================

class StudentData(BaseModel):
    attendance: float
    cgpa: float
    arrear_count: int
    fees_paid: int
    disciplinary_issues: int
    year: int
    semester: int

# ============================
# Root Endpoint
# ============================

@app.get("/")
def root():
    return {"message": "AI Student Dropout API Running"}

# ============================
# Prediction Endpoint
# ============================

@app.post("/predict")
def predict(student: StudentData):
    try:
        # ----------------------------
        # Rule-Based Risk Scoring
        # ----------------------------
        is_high = False
        is_medium = False

        if student.attendance < 60:
            is_high = True
        if student.cgpa < 5:
            is_high = True
        if student.disciplinary_issues >= 2:
            is_high = True
        if student.fees_paid == 0 and student.attendance < 75:
            is_high = True

        if not is_high:
            if 60 <= student.attendance <= 70:
                is_medium = True
            if 5 <= student.cgpa < 6:
                is_medium = True
            if student.disciplinary_issues == 1:
                is_medium = True
            if student.fees_paid == 0:
                is_medium = True

        if is_high:
            risk_level = "HIGH"
            adjusted_prob = 0.85
        elif is_medium:
            risk_level = "MEDIUM"
            adjusted_prob = 0.55
        else:
            risk_level = "LOW"
            adjusted_prob = 0.2

        pred = int(risk_level in {"HIGH", "MEDIUM"})

        return {
            "dropout_prediction": pred,
            "risk_score": round(adjusted_prob, 4),
            "risk_level": risk_level
        }

    except Exception as e:
        # ----------------------------
        # Catch Errors
        # ----------------------------
        return {"error": str(e)}

# ============================
# Health Check
# ============================

@app.get("/health")
def health():
    return {"status": "OK"}
