"""
tools/ml_tool.py – Adapter for the ml_model.prediction module.

Handles:
  • Lazy model training/loading (train from CSV if joblib not found)
  • Inference via predict_from_dict()
  • Graceful error handling without crashing the server
"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path
from typing import Any

# ── Path bootstrap ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from config.settings import ML_MODEL_PATH, ML_CSV_PATH  # noqa: E402

# ── Module-level state ─────────────────────────────────────────────────────────
_model_ready = False
_model_lock = threading.Lock()
_model_error: str | None = None

# Delay the heavy sklearn import until first use
_predict_fn = None


def _ensure_model() -> str | None:
    """
    Ensure the Random Forest model is available.
    Trains from CSV if the joblib file doesn't exist.
    Returns None on success, or an error string on failure.
    """
    global _model_ready, _model_error, _predict_fn

    if _model_ready:
        return None
    if _model_error:
        return _model_error

    with _model_lock:
        if _model_ready:
            return None
        if _model_error:
            return _model_error

        try:
            # Suppress matplotlib / print output during import
            import io
            from contextlib import redirect_stdout, redirect_stderr

            import joblib

            model_path = Path(ML_MODEL_PATH)
            csv_path = Path(ML_CSV_PATH)

            if not model_path.exists():
                # Train model from CSV
                if not csv_path.exists():
                    _model_error = (
                        f"ML model file not found at {model_path} "
                        f"and CSV dataset not found at {csv_path}. "
                        "Cannot train model."
                    )
                    return _model_error

                # Import training functions
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    from ml_model.prediction import load_data, preprocess, build_pipeline  # type: ignore

                df = load_data(str(csv_path))
                X, y = preprocess(df)
                pipeline = build_pipeline()
                pipeline.fit(X, y)
                joblib.dump(pipeline, str(model_path))

            # Load the model and wire up predict function
            from ml_model.prediction import predict_from_dict  # type: ignore
            _predict_fn = predict_from_dict
            _model_ready = True
            return None

        except Exception as exc:
            _model_error = f"ML model initialisation error: {exc}"
            return _model_error


def run_ml_predict(data: dict[str, Any]) -> dict[str, Any]:
    """
    Run ML congestion prediction.

    Parameters
    ----------
    data : dict with keys:
        hour, day_of_week, vehicle_count_per_min, avg_speed_kmph,
        road_occupancy, road_name, area, vehicle_type, weather,
        road_condition, incident_type

    Returns a dict with:
        congestion_level, confidence, description, data_source, error (if any)
    """
    err = _ensure_model()
    if err:
        return {
            "error": err,
            "data_source": "ml_random_forest",
        }

    try:
        result = _predict_fn(data, model_path=ML_MODEL_PATH)  # type: ignore[call-arg]
        result["data_source"] = "ml_random_forest_bengaluru_dataset"
        return result
    except Exception as exc:
        return {
            "error": f"ML prediction error: {exc}",
            "data_source": "ml_random_forest",
        }


def is_model_available() -> bool:
    """Return True if the ML model can be used."""
    err = _ensure_model()
    return err is None
