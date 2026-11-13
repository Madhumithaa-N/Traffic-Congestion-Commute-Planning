"""
settings.py – Centralised environment-based configuration for SmartRoute AI backend.

All secrets are read exclusively from environment variables / .env file.
No keys are hardcoded here. Copy .env.example to .env and fill your values.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Walk up to the backend root (.env lives there) OR fall back to the repo root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent

for _candidate in [_BACKEND_DIR / ".env", _REPO_ROOT / ".env"]:
    if _candidate.exists():
        load_dotenv(dotenv_path=_candidate, override=False)
        break
else:
    load_dotenv(override=False)  # try system env / CWD

# ── Google Maps ───────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Gemini model / endpoint ───────────────────────────────────────────────────
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_ENDPOINT: str = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# ── ML Model ──────────────────────────────────────────────────────────────────
ML_MODEL_PATH: str = os.getenv(
    "ML_MODEL_PATH",
    str(_BACKEND_DIR / "ml_model" / "traffic_prediction_model.joblib"),
)
ML_CSV_PATH: str = os.getenv(
    "ML_CSV_PATH",
    str(_BACKEND_DIR / "ml_model" / "road_traffic_4354_records.csv"),
)

# ── Request timeouts ──────────────────────────────────────────────────────────
REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "20"))

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000",
).split(",")

# ── Cache TTL (seconds) ───────────────────────────────────────────────────────
TRAFFIC_CACHE_TTL: int = int(os.getenv("TRAFFIC_CACHE_TTL", "60"))

# ── Server ────────────────────────────────────────────────────────────────────
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
