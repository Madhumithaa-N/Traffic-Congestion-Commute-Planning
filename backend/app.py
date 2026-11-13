"""
app.py – SmartRoute AI Backend API
====================================
Flask entry-point for Render Web Service deployment.

Endpoints
---------
GET  /health                  → liveness probe
POST /api/predict             → traffic congestion prediction
POST /api/plan_departure      → departure time planner

CORS
----
Allowed origins are controlled by the FRONTEND_URL environment variable
(set it to your Render Static Site URL, e.g. https://smartroute.onrender.com).
A bare "*" wildcard is used only when FRONTEND_URL is not set (local dev).
"""

import os
import sys

# Ensure local packages (ml_model, departure_planner) are importable
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# ---------------------------------------------------------------------------
# CORS – tightly scoped to the deployed frontend origin.
# Set  FRONTEND_URL=https://your-site.onrender.com  in Render's dashboard.
# Locally, leave it unset and every origin is allowed for convenience.
# ---------------------------------------------------------------------------

_frontend_url = os.environ.get("FRONTEND_URL", "*")
CORS(app, origins=_frontend_url, supports_credentials=False)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Traffic prediction  (POST /api/predict)
# ---------------------------------------------------------------------------

@app.post("/api/predict")
def predict():
    """
    Expects JSON body with all 11 feature keys:
      hour, day_of_week, vehicle_count_per_min, avg_speed_kmph,
      road_occupancy, road_name, area, vehicle_type, weather,
      road_condition, incident_type

    Returns:
      { congestion_level, confidence, description }
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    required_keys = [
        "hour", "day_of_week", "vehicle_count_per_min", "avg_speed_kmph",
        "road_occupancy", "road_name", "area", "vehicle_type",
        "weather", "road_condition", "incident_type",
    ]
    missing = [k for k in required_keys if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    model_path = os.environ.get(
        "MODEL_PATH",
        os.path.join(os.path.dirname(__file__), "ml_model", "traffic_prediction_model.joblib"),
    )

    try:
        from ml_model.prediction import predict_from_dict
        result = predict_from_dict(data, model_path=model_path)
        return jsonify(result)
    except FileNotFoundError:
        return jsonify({
            "error": (
                "Trained model not found. "
                "Run `python ml_model/prediction.py` to train and save it first."
            ),
            "model_path": model_path,
        }), 503
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Departure planner  (POST /api/plan_departure)
# ---------------------------------------------------------------------------

@app.post("/api/plan_departure")
def plan_departure():
    """
    Expects JSON body:
      { origin, destination, required_arrival, route? }

    Returns the full departure plan dict from departure_planner.
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    origin  = data.get("origin", "")
    dest    = data.get("destination", "")
    arrival = data.get("required_arrival", "")
    route   = data.get("route")          # optional pre-computed route dict

    if not origin or not dest or not arrival:
        return jsonify(
            {"error": "origin, destination, and required_arrival are required"}
        ), 400

    try:
        from departure_planner.departure import plan_departure as _plan
        result = _plan(origin, dest, arrival, route=route)
        return jsonify(result)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point  (used only for local `python app.py`; Render uses Procfile)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
