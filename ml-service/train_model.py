import argparse
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH = MODELS_DIR / "large_student_dropout_dataset_noisy.csv"
MODEL_PATH = MODELS_DIR / "model.pkl"
SCALER_PATH = MODELS_DIR / "scaler.pkl"
METRICS_PATH = MODELS_DIR / "model_metrics.json"


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    base = df[
        [
            "attendance",
            "cgpa",
            "arrear_count",
            "fees_paid",
            "disciplinary_issues",
            "year",
            "semester",
        ]
    ].copy()

    base["low_attendance"] = (base["attendance"] < 60).astype(int)
    base["low_cgpa"] = (base["cgpa"] < 5).astype(int)
    base["high_arrears"] = (base["arrear_count"] > 3).astype(int)
    base["financial_risk"] = (base["fees_paid"] == 0).astype(int)
    base["behavior_risk"] = base["disciplinary_issues"].astype(int)
    return base


def evaluate_model(name, model, x_train, x_test, y_train, y_test):
    model.fit(x_train, y_train)
    preds = model.predict(x_test)
    probas = model.predict_proba(x_test)[:, 1] if hasattr(model, "predict_proba") else preds
    metrics = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds, zero_division=0)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "f1": float(f1_score(y_test, preds, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, probas)),
    }
    return metrics


def load_from_csv() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
    return pd.read_csv(DATA_PATH)


def load_from_db() -> pd.DataFrame:
    import psycopg2

    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "Shreej@12"),
        dbname=os.getenv("DB_NAME", "dropout_copilot"),
    )

    query = """
        SELECT
          s.year,
          s.semester,
          a.attendance,
          a.cgpa,
          a.arrear_count,
          a.fees_paid,
          COALESCE(a.dropout_flag, p.dropout, 0) AS dropout
        FROM students s
        JOIN academic_records a ON s.id = a.student_id
        LEFT JOIN predictions p ON s.id = p.student_id
        WHERE a.attendance IS NOT NULL
          AND a.cgpa IS NOT NULL
          AND a.arrear_count IS NOT NULL
          AND a.fees_paid IS NOT NULL
    """
    df = pd.read_sql(query, conn)
    conn.close()

    if "disciplinary_issues" not in df.columns:
        df["disciplinary_issues"] = 0

    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        choices=["auto", "db", "csv"],
        default=os.getenv("TRAINING_SOURCE", "auto"),
        help="Training data source: db, csv, or auto",
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

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, stratify=y, random_state=42
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    models = {
        "logistic": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=42
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=350,
            max_depth=None,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=42,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=42),
    }

    results = {}
    best_name = None
    best_score = -1.0

    for name, model in models.items():
        metrics = evaluate_model(
            name, model, x_train_scaled, x_test_scaled, y_train, y_test
        )
        results[name] = metrics

        score = metrics["f1"] * 0.6 + metrics["roc_auc"] * 0.4
        if score > best_score:
            best_score = score
            best_name = name

    best_model = models[best_name]
    best_model.fit(x_train_scaled, y_train)

    best_probas = (
        best_model.predict_proba(x_test_scaled)[:, 1]
        if hasattr(best_model, "predict_proba")
        else best_model.predict(x_test_scaled)
    )
    low_threshold = float(np.quantile(best_probas, 0.33))
    high_threshold = float(np.quantile(best_probas, 0.67))

    feature_names = list(x.columns)
    joblib.dump((best_model, feature_names), MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    results["best_model"] = best_name
    results["feature_names"] = feature_names
    results["risk_thresholds"] = {
        "low": low_threshold,
        "high": high_threshold,
    }

    with METRICS_PATH.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("Best model:", best_name)
    print("Metrics:", json.dumps(results[best_name], indent=2))
    print("Saved:", MODEL_PATH)
    print("Saved:", SCALER_PATH)


if __name__ == "__main__":
    main()
