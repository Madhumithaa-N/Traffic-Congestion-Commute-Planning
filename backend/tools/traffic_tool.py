"""
tools/traffic_tool.py – Adapter for the traffic_monitoring.traffic module.

Wraps traffic_monitor_agent_tool() with:
  • Standardised dict output (not raw JSON string)
  • Safe error handling
  • A simple in-memory TTL cache to avoid hammering the API on repeated calls
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

# ── Path bootstrap so the existing module is importable from any cwd ──────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from traffic_monitoring.traffic import traffic_monitor_agent_tool  # type: ignore


# ── Simple in-memory TTL cache ────────────────────────────────────────────────
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 60  # seconds


def _cache_key(origin: str, destination: str) -> str:
    return f"{origin.lower().strip()}|{destination.lower().strip()}"


def run_traffic_monitor(origin: str, destination: str) -> dict[str, Any]:
    """
    Fetch real-time traffic data for origin → destination.

    Returns a structured dict with keys:
      origin, destination, distance_km, congestion_level,
      traffic_delay_mins, current_time_with_traffic_mins,
      average_time_to_travel_mins, incidents_and_roadblocks,
      is_heavy_traffic, data_source, error (if any).
    """
    key = _cache_key(origin, destination)
    now = time.monotonic()

    # Return cached result if fresh
    if key in _CACHE:
        ts, cached = _CACHE[key]
        if now - ts < _CACHE_TTL:
            return {**cached, "from_cache": True}

    try:
        raw_json: str = traffic_monitor_agent_tool(origin, destination)
        result: dict = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        return {
            "origin": origin,
            "destination": destination,
            "error": f"Traffic monitor returned invalid JSON: {exc}",
            "data_source": "google_routes_api_v2",
        }
    except Exception as exc:
        return {
            "origin": origin,
            "destination": destination,
            "error": f"Traffic monitor error: {exc}",
            "data_source": "google_routes_api_v2",
        }

    # Tag data source
    result["data_source"] = "google_routes_api_v2"
    result["from_cache"] = False

    # Store in cache only if no error
    if "error" not in result:
        _CACHE[key] = (now, result)

    return result
