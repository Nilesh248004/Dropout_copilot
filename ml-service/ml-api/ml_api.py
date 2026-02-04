from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from pathlib import Path
import os

# ============================
# Paths (SAFE FOR WINDOWS)
# ============================

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR.parent / "models"

MODEL_PATH = MODELS_DIR / "model.pkl"
SCALER_PATH = MODELS_DIR / "scaler.pkl"

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
        # Risk Level Logic
        # ----------------------------
        if prob > 0.6:
            risk_level = "HIGH"
        elif prob > 0.01:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "dropout_prediction": pred,
            "risk_score": round(prob, 4),
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
