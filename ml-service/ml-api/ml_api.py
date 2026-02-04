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
        # Raw Features
        # ----------------------------
        x = np.array([[
            student.attendance,
            student.cgpa,
            student.arrear_count,
            student.fees_paid,
            student.disciplinary_issues,
            student.year,
            student.semester
        ]])

        # ----------------------------
        # Feature Engineering
        # ----------------------------
        low_attendance = int(student.attendance < 60)
        low_cgpa = int(student.cgpa < 5)
        high_arrears = int(student.arrear_count > 3)
        financial_risk = int(student.fees_paid == 0)
        behavior_risk = student.disciplinary_issues

        x_fe = np.concatenate([
            x,
            [[low_attendance, low_cgpa, high_arrears, financial_risk, behavior_risk]]
        ], axis=1)

        # ----------------------------
        # Scale Features
        # ----------------------------
        x_scaled = scaler.transform(x_fe)

        # ----------------------------
        # Predict
        # ----------------------------
        pred = int(model.predict(x_scaled)[0])
        prob = float(model.predict_proba(x_scaled)[0][1])

        # ----------------------------
        # Adjusted Risk Score (rules)
        # ----------------------------
        adjusted_prob = prob
        if student.arrear_count > 2:
            # enforce higher risk score when arrears are high
            adjusted_prob = max(adjusted_prob, 0.85)

        # ----------------------------
        # Risk Level Logic
        # ----------------------------
        if student.arrear_count > 2:
            risk_level = "HIGH"
        elif adjusted_prob >= risk_thresholds["high"]:
            risk_level = "HIGH"
        elif adjusted_prob >= risk_thresholds["low"]:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

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
