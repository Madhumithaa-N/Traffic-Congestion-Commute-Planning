"""
tools/departure_tool.py – Adapter for the departure_planner.departure module.

Translates API-facing inputs (arrival_time as "H:MM AM/PM") to the module's
expected 24-h "HH:MM" format and enriches the output with data_source tagging.
"""
from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# ── Path bootstrap ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from departure_planner.departure import plan_departure  # type: ignore  # noqa: E402


def _normalize_time(time_str: str) -> str:
    """
    Accept '9:00 AM', '09:00 AM', '9:00', '09:00' and return 'HH:MM' (24-h).
    Raises ValueError with a clear message on unexpected formats.
    """
    time_str = time_str.strip()

    # Already 24-h format (HH:MM)
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", time_str)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    # 12-h format with AM/PM
    m = re.fullmatch(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
    if m:
        h, mn, meridiem = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if meridiem == "AM":
            h = 0 if h == 12 else h
        else:
            h = 12 if h == 12 else h + 12
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    raise ValueError(
        f"Cannot parse arrival time '{time_str}'. "
        "Use HH:MM (24-h) or H:MM AM/PM format."
    )


def run_departure_plan(
    origin: str,
    destination: str,
    required_arrival: str,
    route: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Plan when to depart to reach the destination by required_arrival.

    Parameters
    ----------
    origin           : Starting location
    destination      : Destination
    required_arrival : Arrival time string ('09:00' or '9:00 AM')
    route            : Optional pre-computed route dict
                       {name, duration_min, distance_km, traffic}

    Returns a dict with keys: status, data_source, route, options, recommended.
    """
    try:
        normalized = _normalize_time(required_arrival)
    except ValueError as exc:
        return {
            "status": "error",
            "message": str(exc),
            "data_source": "departure_planner",
        }

    try:
        result = plan_departure(
            origin=origin,
            destination=destination,
            required_arrival=normalized,
            route=route,
        )
        result["data_source"] = "departure_planner"
        return result
    except Exception as exc:
        return {
            "status": "error",
            "message": f"Departure planner error: {exc}",
            "data_source": "departure_planner",
        }
