import argparse
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

from train_model import build_features, load_from_csv, load_from_db

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "model.pkl"
SCALER_PATH = MODELS_DIR / "scaler.pkl"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        choices=["auto", "db", "csv"],
        default="auto",
        help="Evaluation data source: db, csv, or auto",
    )
    args = parser.parse_args()

    df = None
    if args.source in {"auto", "db"}:
        try:
            df = load_from_db()
            if df.empty:
                raise ValueError("No rows returned from DB.")
            print(f"Loaded {len(df)} records from DB.")
        except Exception as exc:
            if args.source == "db":
                raise
            print(f"DB load failed ({exc}). Falling back to CSV.")

    if df is None:
        df = load_from_csv()
        print(f"Loaded {len(df)} records from CSV.")

    if "dropout" not in df.columns:
        raise ValueError("Expected 'dropout' column in dataset.")

    x = build_features(df)
    y = df["dropout"].astype(int)

    loaded = joblib.load(MODEL_PATH)
    if isinstance(loaded, tuple):
        model = loaded[0]
    else:
        model = loaded
    scaler = joblib.load(SCALER_PATH)

    x_scaled = scaler.transform(x)
    preds = model.predict(x_scaled)
    probas = model.predict_proba(x_scaled)[:, 1] if hasattr(model, "predict_proba") else preds

    metrics = {
        "accuracy": float(accuracy_score(y, preds)),
        "precision": float(precision_score(y, preds, zero_division=0)),
        "recall": float(recall_score(y, preds, zero_division=0)),
        "f1": float(f1_score(y, preds, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, probas)),
    }

    print("Evaluation metrics:")
    for key, value in metrics.items():
        print(f"{key}: {value:.4f}")


if __name__ == "__main__":
    main()
