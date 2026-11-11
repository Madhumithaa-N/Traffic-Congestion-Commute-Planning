"""
tools/routes_tool.py – Adapter for the route_optimisation.routes module.

The routes module raises EnvironmentError at import if API keys are missing.
This adapter catches that and returns a graceful error dict instead of crashing.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path
from typing import Any

# ── Path bootstrap ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

# ── Ensure the routes module has access to the keys from central config ────────
# The module loads its own .env; we supplement with env vars so our backend .env wins.
from config.settings import GOOGLE_MAPS_API_KEY, GEMINI_API_KEY  # noqa: E402

if GOOGLE_MAPS_API_KEY:
    os.environ.setdefault("GOOGLE_MAPS_API_KEY", GOOGLE_MAPS_API_KEY)
if GEMINI_API_KEY:
    os.environ.setdefault("GEMINI_API_KEY", GEMINI_API_KEY)

# ── Lazy import with graceful fallback ────────────────────────────────────────
_optimize_routes = None
_IMPORT_ERROR: str | None = None

try:
    from route_optimisation.routes import optimize_routes as _optimize_routes  # type: ignore
except EnvironmentError as exc:
    _IMPORT_ERROR = str(exc)
except Exception as exc:
    _IMPORT_ERROR = str(exc)


def run_route_optimize(
    origin: str,
    destination: str,
    traffic_data: dict | None = None,
) -> dict[str, Any]:
    """
    Fetch driving routes, transit options and multimodal recommendations.

    Parameters
    ----------
    origin      : Starting address
    destination : Destination address
    traffic_data: Optional pre-fetched traffic dict from run_traffic_monitor()

    Returns a structured dict with best_route, alternative_routes,
    transport_options, multimodal_recommendations, warnings, etc.
    """
    if _optimize_routes is None:
        return {
            "origin": origin,
            "destination": destination,
            "error": f"Route optimization module unavailable: {_IMPORT_ERROR}",
            "data_source": "unavailable",
        }

    # The routes module accepts traffic_data as str | dict | None
    td = traffic_data or {}

    try:
        result = _optimize_routes(origin, destination, td)
        return result
    except Exception as exc:
        return {
            "origin": origin,
            "destination": destination,
            "error": f"Route optimization error: {exc}",
            "data_source": "google_routes_api_v2",
        }
