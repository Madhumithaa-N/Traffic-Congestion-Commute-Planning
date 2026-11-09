# =============================================================================
# Traffic Congestion Prediction using Machine Learning
# Module: Traffic Prediction Using ML
# IBM Bobathon - Traffic Congestion & Commute Planning
#
# Dataset: road_traffic_4354_records.csv  (Bengaluru road traffic records)
# Model  : Random Forest Classifier
# Target : Predict congestion level → LOW | MEDIUM | HIGH
# =============================================================================

import os
import sys
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

from sklearn.ensemble           import RandomForestClassifier
from sklearn.model_selection    import train_test_split
from sklearn.preprocessing      import OneHotEncoder
from sklearn.compose            import ColumnTransformer
from sklearn.pipeline           import Pipeline
from sklearn.metrics            import (accuracy_score,
                                        classification_report,
                                        confusion_matrix,
                                        ConfusionMatrixDisplay)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 – DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_data(filepath: str) -> pd.DataFrame:
    """
    Load the CSV traffic dataset from the given file path.
    Returns a Pandas DataFrame, or exits with an error message on failure.
    """
    if not os.path.exists(filepath):
        print(f"\n[ERROR] File not found: {filepath}")
        print("        Please provide the correct path to the CSV file.")
        sys.exit(1)

    try:
        df = pd.read_csv(filepath)
        print(f"\n[✓] Dataset loaded successfully → {len(df)} records, "
              f"{len(df.columns)} columns")
        return df
    except Exception as e:
        print(f"\n[ERROR] Could not read the file: {e}")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 – DATA PREPROCESSING
# ─────────────────────────────────────────────────────────────────────────────

def preprocess(df: pd.DataFrame):
    """
    Clean the raw DataFrame and engineer features needed for training.

    Steps
    -----
    1. Remove duplicate rows.
    2. Parse timestamps → extract hour and day-of-week.
    3. Drop rows where key columns are missing.
    4. Map the target (congestion_level) to three standard labels:
           Low      → LOW
           Moderate → MEDIUM
           High     → HIGH
    5. Select the feature columns used by the model.

    Returns
    -------
    X : pd.DataFrame  – feature matrix
    y : pd.Series     – target labels (LOW / MEDIUM / HIGH)
    """
    print("\n[→] Preprocessing data …")

    # 2a. Remove duplicates
    before = len(df)
    df = df.drop_duplicates()
    print(f"    Duplicate rows removed : {before - len(df)}")

    # 2b. Parse timestamp; extract time-based features
    df["timestamp"] = pd.to_datetime(df["timestamp"], dayfirst=False)
    df["hour"]        = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek   # 0=Mon … 6=Sun

    # 2c. Drop rows with missing values in columns the model needs
    required_cols = [
        "hour", "day_of_week",
        "vehicle_count_per_min", "avg_speed_kmph", "road_occupancy",
        "road_name", "area", "vehicle_type", "weather", "road_condition",
        "incident_type", "congestion_level"
    ]
    before = len(df)
    df = df.dropna(subset=required_cols)
    print(f"    Rows dropped (missing)  : {before - len(df)}")
    print(f"    Clean records remaining : {len(df)}")

    # 2d. Standardise target labels
    label_map = {"Low": "LOW", "Moderate": "MEDIUM", "High": "HIGH"}
    df["congestion_level"] = df["congestion_level"].map(label_map.get)

    # Drop any rows whose congestion_level didn't map (unexpected values)
    df = df.dropna(subset=["congestion_level"])

    print(f"\n    Class distribution:")
    for label, count in df["congestion_level"].value_counts().items():
        print(f"      {label:<8} : {count} records")

    # 2e. Build feature matrix and target vector
    feature_cols = [
        "hour", "day_of_week",
        "vehicle_count_per_min", "avg_speed_kmph", "road_occupancy",
        "road_name", "area", "vehicle_type", "weather",
        "road_condition", "incident_type"
    ]
    X = pd.DataFrame(df[feature_cols].copy())
    y = pd.Series(df["congestion_level"].copy())

    print("\n[✓] Preprocessing complete")
    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 – MODEL BUILDING & TRAINING
# ─────────────────────────────────────────────────────────────────────────────

# Columns that contain text / categories
CATEGORICAL_COLS = ["road_name", "area", "vehicle_type",
                    "weather", "road_condition", "incident_type"]

# Columns that are already numbers
NUMERIC_COLS = ["hour", "day_of_week",
                "vehicle_count_per_min", "avg_speed_kmph", "road_occupancy"]


def build_pipeline() -> Pipeline:
    """
    Build a Scikit-learn Pipeline that:
      • OneHotEncodes categorical columns  (handle_unknown='ignore' so new
        categories at prediction time don't crash the model)
      • Passes numeric columns through as-is
      • Feeds everything into a Random Forest Classifier
    """
    # Preprocessor: encode categoricals, pass-through numerics
    preprocessor = ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
         CATEGORICAL_COLS),
        ("num", "passthrough", NUMERIC_COLS)
    ])

    # Full pipeline: preprocess → classify
    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier",   RandomForestClassifier(
            n_estimators=100,    # 100 decision trees in the forest
            random_state=42,     # fixed seed → reproducible results
            class_weight="balanced"  # handle class imbalance fairly
        ))
    ])
    return pipeline


def train_model(X: pd.DataFrame, y: pd.Series) -> tuple[Pipeline, pd.DataFrame, pd.Series, np.ndarray]:
    """
    Split data 80 / 20, train the pipeline, and return the trained model
    together with the test split for evaluation.

    Returns
    -------
    model   : trained Pipeline
    X_test  : test features
    y_test  : true test labels
    y_pred  : predicted labels on the test set
    """
    print("\n[→] Splitting dataset → 80% train / 20% test …")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    X_test  = pd.DataFrame(X_test)
    y_test  = pd.Series(y_test)
    print(f"    Training samples : {len(X_train)}")
    print(f"    Testing  samples : {len(X_test)}")

    print("\n[→] Training Random Forest Classifier …")
    model = build_pipeline()
    model.fit(X_train, y_train)
    print("[✓] Training complete")

    y_pred: np.ndarray = model.predict(X_test)
    return model, X_test, y_test, y_pred


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 – MODEL EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_model(y_test: pd.Series, y_pred: np.ndarray) -> None:
    """
    Print accuracy, a full classification report, and display a
    colour-coded confusion matrix using Matplotlib.
    """
    print("\n" + "=" * 60)
    print("  MODEL EVALUATION RESULTS")
    print("=" * 60)

    # Accuracy
    acc = accuracy_score(y_test, y_pred)
    print(f"\n  Overall Accuracy : {acc * 100:.2f}%")

    # Derive the sorted set of classes present in both y_test and y_pred
    labels = sorted(set(y_test) | set(y_pred))

    # Classification report (precision, recall, F1 per class)
    print("\n  Classification Report:")
    print("  " + "-" * 56)
    report: str = str(classification_report(y_test, y_pred,
                                             labels=labels,
                                             target_names=labels,
                                             output_dict=False))
    for line in report.splitlines():
        print("  " + line)

    # Confusion matrix as a Matplotlib figure
    cm = confusion_matrix(y_test, y_pred, labels=labels)

    fig, ax = plt.subplots(figsize=(6, 5))
    disp    = ConfusionMatrixDisplay(confusion_matrix=cm,
                                     display_labels=labels)
    disp.plot(ax=ax, colorbar=True, cmap="Blues")
    ax.set_title("Confusion Matrix – Traffic Congestion Prediction",
                 fontsize=12, pad=12)
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=120)
    plt.show(block=False)
    plt.pause(0.1)
    print("\n  Confusion matrix saved → confusion_matrix.png")
    print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4b – AUTOMATIC TRAFFIC PREDICTION (10 unseen test records)
# ─────────────────────────────────────────────────────────────────────────────

def predict_sample_records(
    model: Pipeline,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    n: int = 10,
) -> None:
    """
    Pick the first *n* records from the held-out test set, run the trained
    model on them, and display a formatted table showing:
      road_name, vehicle_count_per_min, avg_speed_kmph,
      actual_traffic, predicted_traffic, prediction_result (CORRECT/INCORRECT)
    """
    print("\n" + "=" * 60)
    print("  AUTOMATIC TRAFFIC PREDICTION  (sample test records)")
    print("=" * 60)

    sample_X = X_test.iloc[:n].reset_index(drop=True)
    sample_y = y_test.iloc[:n].reset_index(drop=True)

    predictions: np.ndarray = model.predict(sample_X)

    # Header
    col_w = [22, 10, 10, 10, 12, 12]
    headers = ["road_name", "veh/min", "speed", "actual", "predicted", "result"]
    header_line = (
        f"  {'#':<4}"
        f"  {headers[0]:<{col_w[0]}}"
        f"  {headers[1]:>{col_w[1]}}"
        f"  {headers[2]:>{col_w[2]}}"
        f"  {headers[3]:>{col_w[3]}}"
        f"  {headers[4]:>{col_w[4]}}"
        f"  {headers[5]}"
    )
    print(header_line)
    print("  " + "-" * (sum(col_w) + 16))

    for i, (pred, actual) in enumerate(zip(predictions, sample_y), start=1):
        road     = str(sample_X.at[i - 1, "road_name"])
        veh_cnt  = int(sample_X.at[i - 1, "vehicle_count_per_min"])
        speed    = float(sample_X.at[i - 1, "avg_speed_kmph"])
        result   = "CORRECT" if pred == actual else "INCORRECT"
        print(
            f"  {i:<4}"
            f"  {road:<{col_w[0]}}"
            f"  {veh_cnt:>{col_w[1]}}"
            f"  {speed:>{col_w[2]}.1f}"
            f"  {actual:>{col_w[3]}}"
            f"  {pred:>{col_w[4]}}"
            f"  {result}"
        )

    correct = sum(p == a for p, a in zip(predictions, sample_y))
    print(f"\n  Correct : {correct}/{n}  ({correct / n * 100:.0f}%)")
    print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4c – LATEST TEST PREDICTION  (Whitefield Main Road)
# ─────────────────────────────────────────────────────────────────────────────

def predict_latest_test(model: Pipeline) -> None:
    """
    Predict congestion for a fixed test scenario:
      Road            : Whitefield Main Road
      Vehicle count   : 33 / min
      Average speed   : 35 km/h

    The remaining features (area, vehicle_type, weather, road_condition,
    incident_type, hour, day_of_week, road_occupancy) are set to common
    neutral defaults so the pipeline sees a complete, valid row.
    The prediction and full per-class probabilities are printed.
    """
    print("\n" + "=" * 60)
    print("  LATEST TEST PREDICTION")
    print("  Road            : Whitefield Main Road")
    print("  Vehicle count   : 33 / min")
    print("  Average speed   : 35 km/h")
    print("=" * 60)

    input_data = pd.DataFrame([{
        "hour"                 : 9,          # morning rush-hour default
        "day_of_week"          : 0,          # Monday
        "vehicle_count_per_min": 33,
        "avg_speed_kmph"       : 35.0,
        "road_occupancy"       : 0.6,        # moderate occupancy default
        "road_name"            : "Whitefield Main Road",
        "area"                 : "IT Corridor",
        "vehicle_type"         : "Car",
        "weather"              : "Clear",
        "road_condition"       : "Dry",
        "incident_type"        : "None",
    }])

    prediction    = model.predict(input_data)[0]
    probabilities = model.predict_proba(input_data)[0]
    class_labels  = model.classes_

    icons = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}
    descs = {
        "LOW"   : "Light traffic – smooth commute expected.",
        "MEDIUM": "Moderate traffic – minor delays possible.",
        "HIGH"  : "Heavy congestion – expect significant delays.",
    }

    print(f"\n  PREDICTED CONGESTION LEVEL : {icons.get(prediction, '')} {prediction}")
    print(f"  {descs.get(prediction, '')}")
    print("\n  Model confidence (predict_proba):")
    for label, prob in zip(class_labels, probabilities):
        bar = "█" * int(prob * 30)
        print(f"    {label:<8} {prob * 100:5.1f}%  {bar}")
    print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4d – AGENT / API PREDICTION  (predict_from_dict)
# ─────────────────────────────────────────────────────────────────────────────

def predict_from_dict(
    data: dict,
    model_path: str = "traffic_prediction_model.joblib",
) -> dict:
    """
    Agent/API-facing prediction function.

    Accepts a plain dict of road conditions and returns a plain dict result —
    no print(), no input(), no matplotlib side-effects.

    Parameters
    ----------
    data : dict
        Must contain all 11 feature keys:
          hour, day_of_week, vehicle_count_per_min, avg_speed_kmph,
          road_occupancy, road_name, area, vehicle_type, weather,
          road_condition, incident_type
    model_path : str
        Path to the saved joblib model file (default: traffic_prediction_model.joblib).

    Returns
    -------
    dict with keys:
      congestion_level : str          – "LOW" | "MEDIUM" | "HIGH"
      confidence       : dict[str, float]  – per-class probabilities (0–1, rounded to 4dp)
      description      : str          – human-readable summary
    """
    model: Pipeline = joblib.load(model_path)

    input_df      = pd.DataFrame([data])
    prediction    = model.predict(input_df)[0]
    probabilities = model.predict_proba(input_df)[0]
    class_labels  = model.classes_

    descs = {
        "LOW"   : "Light traffic – smooth commute expected.",
        "MEDIUM": "Moderate traffic – minor delays possible.",
        "HIGH"  : "Heavy congestion – expect significant delays.",
    }

    return {
        "congestion_level": str(prediction),
        "confidence": {
            str(label): round(float(prob), 4)
            for label, prob in zip(class_labels, probabilities)
        },
        "description": descs.get(str(prediction), ""),
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 – FEATURE IMPORTANCE CHART
# ─────────────────────────────────────────────────────────────────────────────

def plot_feature_importance(model: Pipeline) -> None:
    """
    Plot the top-15 most important features from the trained Random Forest.
    This gives a quick visual of which inputs drive predictions most.
    """
    rf          = model.named_steps["classifier"]
    preprocessor = model.named_steps["preprocessor"]

    # Retrieve feature names after OneHotEncoding
    ohe_names   = preprocessor.named_transformers_["cat"]\
                               .get_feature_names_out(CATEGORICAL_COLS).tolist()
    all_features = ohe_names + NUMERIC_COLS

    importances = rf.feature_importances_
    indices     = np.argsort(importances)[::-1][:15]   # top 15

    fig, ax = plt.subplots(figsize=(9, 5))
    ax.barh(range(len(indices)),
            importances[indices][::-1],
            align="center", color="#3b82d4")
    ax.set_yticks(range(len(indices)))
    ax.set_yticklabels([all_features[i] for i in indices[::-1]], fontsize=9)
    ax.set_xlabel("Feature Importance Score")
    ax.set_title("Top 15 Feature Importances – Random Forest", fontsize=12)
    plt.tight_layout()
    plt.savefig("feature_importance.png", dpi=120)
    plt.show(block=False)
    plt.pause(0.1)
    print("  Feature importance chart saved → feature_importance.png")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 – INTERACTIVE PREDICTION
# ─────────────────────────────────────────────────────────────────────────────

# Valid options drawn from the dataset (shown to guide user input)
ROAD_OPTIONS      = ["MG Road", "Hosur Road", "Bannerghatta Road",
                     "Kanakapura Road", "Tumakuru Road", "Bellary Road",
                     "Old Madras Road", "Outer Ring Road",
                     "Electronic City Flyover", "Airport Road",
                     "Whitefield Main Road"]
AREA_OPTIONS      = ["Central", "South", "North", "East", "West",
                     "IT Corridor", "Industrial", "Residential"]
VEHICLE_OPTIONS   = ["Car", "Bus", "Two-wheeler", "Van"]
WEATHER_OPTIONS   = ["Clear", "Cloudy", "Light Rain", "Heavy Rain", "Fog"]
ROAD_COND_OPTIONS = ["Dry", "Wet", "Under Repair"]
INCIDENT_OPTIONS  = ["None", "Road Closure", "Accident", "Construction"]


def _ask(prompt: str, options: list) -> str:
    """Helper: show numbered options and return the user's validated choice."""
    print(f"\n  {prompt}")
    for i, opt in enumerate(options, 1):
        print(f"    {i}. {opt}")
    while True:
        raw = input("  Enter number: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print(f"  [!] Please enter a number between 1 and {len(options)}.")


def _ask_int(prompt: str, low: int, high: int) -> int:
    """Helper: prompt for an integer in [low, high]."""
    while True:
        raw = input(f"  {prompt} ({low}–{high}): ").strip()
        if raw.isdigit() and low <= int(raw) <= high:
            return int(raw)
        print(f"  [!] Please enter a whole number between {low} and {high}.")


def _ask_float(prompt: str, low: float, high: float) -> float:
    """Helper: prompt for a decimal number in [low, high]."""
    while True:
        raw = input(f"  {prompt} ({low}–{high}): ").strip()
        try:
            val = float(raw)
            if low <= val <= high:
                return val
        except ValueError:
            pass
        print(f"  [!] Please enter a number between {low} and {high}.")


def predict_traffic(model: Pipeline) -> None:
    """
    Interactively collect traffic details from the user and print
    the predicted congestion level (LOW / MEDIUM / HIGH).
    """
    print("\n" + "=" * 60)
    print("  TRAFFIC CONGESTION PREDICTOR")
    print("  Enter the current road conditions below.")
    print("=" * 60)

    hour         = _ask_int("Hour of the day (24-hour format)", 0, 23)
    day_of_week  = _ask_int("Day of week (0=Monday … 6=Sunday)", 0, 6)
    vehicle_cnt  = _ask_int("Vehicle count per minute", 1, 300)
    avg_speed    = _ask_int("Average speed (km/h)", 1, 120)
    occupancy    = _ask_float("Road occupancy ratio", 0.0, 1.0)
    road_name    = _ask("Road name", ROAD_OPTIONS)
    area         = _ask("Area / zone", AREA_OPTIONS)
    vehicle_type = _ask("Predominant vehicle type", VEHICLE_OPTIONS)
    weather      = _ask("Weather condition", WEATHER_OPTIONS)
    road_cond    = _ask("Road condition", ROAD_COND_OPTIONS)
    incident     = _ask("Incident type", INCIDENT_OPTIONS)

    # Build a one-row DataFrame that matches the training feature columns
    input_data = pd.DataFrame([{
        "hour"                 : hour,
        "day_of_week"          : day_of_week,
        "vehicle_count_per_min": vehicle_cnt,
        "avg_speed_kmph"       : avg_speed,
        "road_occupancy"       : occupancy,
        "road_name"            : road_name,
        "area"                 : area,
        "vehicle_type"         : vehicle_type,
        "weather"              : weather,
        "road_condition"       : road_cond,
        "incident_type"        : incident
    }])

    prediction   = model.predict(input_data)[0]
    probabilities = model.predict_proba(input_data)[0]
    class_labels  = model.classes_

    # Display result
    icons = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}
    descs = {
        "LOW"   : "Light traffic – smooth commute expected.",
        "MEDIUM": "Moderate traffic – minor delays possible.",
        "HIGH"  : "Heavy congestion – expect significant delays."
    }
    print("\n" + "=" * 60)
    print(f"  PREDICTED CONGESTION LEVEL : {icons.get(prediction, '')} {prediction}")
    print(f"  {descs.get(prediction, '')}")
    print("\n  Prediction confidence:")
    for label, prob in zip(class_labels, probabilities):
        bar = "█" * int(prob * 30)
        print(f"    {label:<8} {prob*100:5.1f}%  {bar}")
    print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  TRAFFIC CONGESTION PREDICTION – IBM Bobathon")
    print("  Module : Traffic Prediction Using ML")
    print("=" * 60)

    # ── Step 1: Load data ──────────────────────────────────────────────────
    # Change the path below if your CSV is in a different location.
    CSV_PATH = r"C:\Users\Dhanya\Downloads\road_traffic_4354_records.csv"

    # Allow overriding from the command line:  python prediction.py my_data.csv
    if len(sys.argv) > 1:
        CSV_PATH = sys.argv[1]

    df = load_data(CSV_PATH)

    # ── Step 2: Preprocess ────────────────────────────────────────────────
    X, y = preprocess(df)

    # ── Step 3: Train ─────────────────────────────────────────────────────
    model, X_test, y_test, y_pred = train_model(X, y)

    # ── Step 4: Evaluate ──────────────────────────────────────────────────
    evaluate_model(y_test, y_pred)

    # ── Step 4b: Automatic prediction on 10 unseen test records ───────────
    predict_sample_records(model, X_test, y_test, n=10)

    # ── Step 4c: Latest test prediction (Whitefield Main Road) ────────────
    predict_latest_test(model)

    # ── Step 4d: Save trained model ───────────────────────────────────────
    MODEL_PATH = "traffic_prediction_model.joblib"
    joblib.dump(model, MODEL_PATH)
    print(f"\n[✓] Trained model saved → {MODEL_PATH}")

    # ── Step 5: Feature importance chart ──────────────────────────────────
    print("\n[→] Generating feature importance chart …")
    plot_feature_importance(model)

    # ── Step 6: Interactive prediction ────────────────────────────────────
    while True:
        predict_traffic(model)
        again = input("\n  Predict again? (y/n): ").strip().lower()
        if again != "y":
            break

    print("\n[✓] Program complete. Goodbye!\n")


if __name__ == "__main__":
    main()
