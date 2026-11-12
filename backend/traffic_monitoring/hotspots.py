"""
traffic_monitoring/hotspots.py – Bengaluru Traffic Hotspot Monitor
===================================================================

Queries the Google Routes API for a fixed set of known high-congestion
Bengaluru corridors, ranks them by live delay, and returns the top N most
congested spots at the current moment.

Each corridor is defined as origin → destination representing a short
1–3 km segment of a well-known congested road.  The delay on that
segment is compared to its free-flow duration to derive congestion
severity dynamically — no values are hardcoded.

Concurrent requests are used to keep total latency under ~5 s.
A shared TTL cache avoids repeated API calls within the same window.

Public API
----------
  get_traffic_hotspots(top_n=5) -> dict
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from traffic_monitoring.traffic import traffic_monitor_agent_tool  # noqa: E402

try:
    from config.settings import TRAFFIC_CACHE_TTL
except ImportError:
    import os
    TRAFFIC_CACHE_TTL = int(os.getenv("TRAFFIC_CACHE_TTL", "60"))

# ── Monitored corridors ────────────────────────────────────────────────────────
# Each entry: (area_name, origin, destination)
# These are short 1–5 km segments of Bengaluru's worst congestion corridors.
# The congestion level is derived entirely from the live API response.
_CORRIDORS: list[tuple[str, str, str]] = [
    (
        "Silk Board Junction",
        "Silk Board, Bengaluru",
        "BTM Layout 2nd Stage, Bengaluru",
    ),
    (
        "Marathahalli Bridge",
        "Marathahalli Bridge, Bengaluru",
        "Doddanekundi, Bengaluru",
    ),
    (
        "KR Puram Bridge",
        "KR Puram Railway Station, Bengaluru",
        "Tin Factory, Bengaluru",
    ),
    (
        "Hebbal Flyover",
        "Hebbal, Bengaluru",
        "Manyata Tech Park, Bengaluru",
    ),
    (
        "Electronic City Toll",
        "Electronic City Phase 1, Bengaluru",
        "Electronic City Phase 2, Bengaluru",
    ),
    (
        "Whitefield Main Road",
        "Whitefield, Bengaluru",
        "ITPL Main Road, Bengaluru",
    ),
    (
        "Hosur Road (Madiwala)",
        "Madiwala, Bengaluru",
        "Bommanahalli, Bengaluru",
    ),
    (
        "Outer Ring Road (Bellandur)",
        "Bellandur, Bengaluru",
        "Sarjapur Road Junction, Bengaluru",
    ),
    (
        "Bannerghatta Road",
        "JP Nagar, Bengaluru",
        "Gottigere, Bengaluru",
    ),
    (
        "MG Road / Trinity",
        "MG Road, Bengaluru",
        "Trinity Circle, Bengaluru",
    ),
    (
        "Koramangala 5th Block",
        "Koramangala 5th Block, Bengaluru",
        "Sony World Signal, Bengaluru",
    ),
    (
        "Yeshwanthpur Junction",
        "Yeshwanthpur, Bengaluru",
        "Tumkur Road, Bengaluru",
    ),
]

# ── TTL cache ─────────────────────────────────────────────────────────────────
_cache: dict[str, Any] = {}
_cache_ts: float = 0.0


def _fetch_corridor(area_name: str, origin: str, destination: str) -> dict | None:
    """Fetch live traffic for one corridor; return structured result or None."""
    try:
        raw = traffic_monitor_agent_tool(origin, destination)
        data = json.loads(raw)
        if "error" in data:
            return None
        return {
            "area": area_name,
            "origin": origin,
            "destination": destination,
            "congestion_level": data.get("congestion_level", "LOW"),
            "traffic_delay_mins": data.get("traffic_delay_mins", 0.0),
            "delay_percentage": data.get("delay_percentage", 0.0),
            "current_traffic_speed_kmph": data.get("current_traffic_speed_kmph", 0.0),
            "average_normal_speed_kmph": data.get("average_normal_speed_kmph", 0.0),
            "current_time_with_traffic_mins": data.get("current_time_with_traffic_mins", 0.0),
            "average_time_to_travel_mins": data.get("average_time_to_travel_mins", 0.0),
            "distance_km": data.get("distance_km", 0.0),
            "is_heavy_traffic": data.get("is_heavy_traffic", False),
            "incidents_and_roadblocks": data.get("incidents_and_roadblocks", {}),
            "traffic_summary": data.get("traffic_summary", ""),
        }
    except Exception:
        return None


# Map congestion label → integer rank for sorting
_CONGESTION_RANK = {"SEVERE": 4, "HEAVY": 3, "MODERATE": 2, "LOW": 1}


def get_traffic_hotspots(top_n: int = 5) -> dict:
    """
    Return the top-N most congested Bengaluru corridors at the current time.

    Uses a TTL cache (TRAFFIC_CACHE_TTL seconds) shared with the main
    traffic monitor to avoid duplicate API calls.

    Returns
    -------
    {
        "status": "ok",
        "hotspots": [ ...up to top_n dicts, ranked by delay... ],
        "total_monitored": int,
        "successful_queries": int,
        "timestamp": str ISO-8601,
        "data_source": "google_routes_api_v2",
        "cache_hit": bool,
    }
    """
    global _cache, _cache_ts

    now = time.monotonic()
    if _cache and (now - _cache_ts) < TRAFFIC_CACHE_TTL:
        return {**_cache, "cache_hit": True}

    results: list[dict] = []

    # Fan out to all corridors in parallel (max 6 workers to respect quota)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {
            pool.submit(_fetch_corridor, area, orig, dest): area
            for area, orig, dest in _CORRIDORS
        }
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                results.append(result)

    if not results:
        return {
            "status": "error",
            "error": "Could not retrieve traffic data for any monitored corridor.",
            "hotspots": [],
            "total_monitored": len(_CORRIDORS),
            "successful_queries": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data_source": "google_routes_api_v2",
            "cache_hit": False,
        }

    # Rank: primary key = congestion tier rank; secondary = delay_percentage
    results.sort(
        key=lambda r: (
            _CONGESTION_RANK.get(r["congestion_level"], 0),
            r["delay_percentage"],
        ),
        reverse=True,
    )

    payload = {
        "status": "ok",
        "hotspots": results[:top_n],
        "total_monitored": len(_CORRIDORS),
        "successful_queries": len(results),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_source": "google_routes_api_v2",
        "cache_hit": False,
    }

    _cache = payload
    _cache_ts = now
    return payload
