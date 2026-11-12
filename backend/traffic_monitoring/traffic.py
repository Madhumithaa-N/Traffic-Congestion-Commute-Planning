"""
traffic_monitoring/traffic.py – SmartRoute AI Real-Time Traffic Monitor
=======================================================================

Queries the Google Routes API v2 (TRAFFIC_AWARE_OPTIMAL) for live traffic
conditions between an origin and destination, including:

  • Traffic-aware and static (no-traffic) travel durations
  • Distance and route description
  • Up to 3 alternative routes for comparison
  • Congestion classification: LOW | MODERATE | HEAVY | SEVERE
  • Delay in minutes and as a percentage of free-flow time
  • Per-segment speed analysis for incident / roadblock detection
  • Human-readable traffic summary for Bengaluru commuters

Credentials are read exclusively from environment variables / .env.
The API key is NEVER hardcoded here.

Public API
----------
  traffic_monitor_agent_tool(origin, destination) -> str   (JSON string)

Consumed by:
  tools/traffic_tool.py  – wraps in TTL cache, returns dict
  agent/smart_route_agent.py  – uses dict output
  route_optimisation/routes.py  – accepts dict for traffic context
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import requests

# ── Import shared config (falls back gracefully if run standalone) ────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

try:
    from config.settings import GOOGLE_MAPS_API_KEY, REQUEST_TIMEOUT, TRAFFIC_CACHE_TTL  # noqa: F401
except ImportError:
    # Standalone execution without the full backend installed
    import os
    from dotenv import load_dotenv
    for _candidate in [_BACKEND_DIR / ".env", _BACKEND_DIR.parent / ".env"]:
        if _candidate.exists():
            load_dotenv(dotenv_path=_candidate, override=False)
            break
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "20"))
    TRAFFIC_CACHE_TTL: int = int(os.getenv("TRAFFIC_CACHE_TTL", "60"))

# ── Google Routes API endpoint ────────────────────────────────────────────────
ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"

# ── Congestion thresholds ─────────────────────────────────────────────────────
# Congestion is classified by the ratio of traffic-aware to free-flow duration
# AND an absolute delay floor (minutes), whichever is more conservative.
#
#  Level     | time_ratio  | delay_mins  | Typical Bengaluru scenario
#  ----------|-------------|-------------|--------------------------------------------
#  SEVERE    | ≥ 2.0       | ≥ 30        | Near-standstill; accident / road closure
#  HEAVY     | ≥ 1.40      | ≥ 15        | Major peak-hour gridlock (Hosur Rd at 9 AM)
#  MODERATE  | ≥ 1.15      | ≥  5        | Noticeable slowdown; still moving
#  LOW       | < 1.15      | <  5        | Free-flow or light traffic
#
_CONGESTION_TIERS: list[tuple[float, float, str]] = [
    (2.00, 30.0, "SEVERE"),
    (1.40, 15.0, "HEAVY"),
    (1.15,  5.0, "MODERATE"),
    (0.00,  0.0, "LOW"),
]

# Speed thresholds for per-segment incident detection
_INCIDENT_SPEED_THRESHOLD_KMPH = 10.0   # segment speed ≤ this → likely blocked
_INCIDENT_DROP_RATIO = 0.35              # segment speed ≤ 35 % of route average → sharp anomaly


# ── Small helpers ─────────────────────────────────────────────────────────────

def _parse_secs(raw: Any) -> float:
    """Strip trailing 's' and return float seconds; fallback to 0.0."""
    try:
        return float(str(raw).rstrip("s")) if raw else 0.0
    except ValueError:
        return 0.0


def _secs_to_mins(secs: float) -> float:
    return round(secs / 60, 1)


def _meters_to_km(meters: Any) -> float:
    try:
        return round(float(meters) / 1000, 2)
    except (TypeError, ValueError):
        return 0.0


def _classify_interval_speed(speed_type: str) -> float:
    """
    Map Google's SpeedReadingInterval.Speed enum to an approximate km/h midpoint.
      TRAFFIC_JAM  →  5 km/h
      SLOW         → 25 km/h
      NORMAL       → 70 km/h
    """
    return {"TRAFFIC_JAM": 5.0, "SLOW": 25.0, "NORMAL": 70.0}.get(speed_type, 70.0)


def _classify_congestion(time_ratio: float, delay_mins: float) -> str:
    """
    Return congestion label using the tier table above.
    Either criterion (time_ratio OR delay_mins) can trigger a tier.
    """
    for ratio_threshold, delay_threshold, label in _CONGESTION_TIERS:
        if time_ratio >= ratio_threshold or delay_mins >= delay_threshold:
            return label
    return "LOW"


def _delay_percentage(time_ratio: float) -> float:
    """Return the traffic overhead as a percentage of free-flow time, ≥ 0."""
    return round(max(0.0, (time_ratio - 1.0) * 100), 1)


# ── Per-route incident analysis ───────────────────────────────────────────────

def _detect_incidents(travel_advisory: dict, route_avg_speed_kmph: float) -> dict:
    """
    Analyse travelAdvisory speed intervals and restriction flags.

    Returns a dict with:
      road_restriction_detected, restriction_reason,
      anomalous_segments_detected, anomalous_segment_count,
      slowest_segment_speed_kmph, incident_likelihood, advisory_note.
    """
    result = {
        "road_restriction_detected": False,
        "restriction_reason": None,
        "anomalous_segments_detected": False,
        "anomalous_segment_count": 0,
        "slowest_segment_speed_kmph": None,
        "incident_likelihood": "NONE",
        "advisory_note": None,
    }

    if not travel_advisory:
        result["advisory_note"] = "No travel advisory data returned by the API."
        return result

    # Hard restriction (road closure / access restriction)
    restriction = travel_advisory.get("trafficRestriction")
    if restriction:
        result["road_restriction_detected"] = True
        result["restriction_reason"] = restriction.get("restrictionReason", "UNKNOWN")

    # Per-segment speed analysis
    intervals = travel_advisory.get("speedReadingIntervals", [])
    if not intervals:
        result["advisory_note"] = (
            "Speed interval data unavailable for this route "
            "(may require Routes Preferred / high-volume API tier)."
        )
    else:
        jam_count = 0
        anomaly_count = 0
        min_speed = float("inf")

        for seg in intervals:
            speed_type = seg.get("speed", "NORMAL")
            seg_speed = _classify_interval_speed(speed_type)
            min_speed = min(min_speed, seg_speed)

            is_jam = speed_type == "TRAFFIC_JAM"
            is_anomaly = (
                route_avg_speed_kmph > 0
                and seg_speed <= route_avg_speed_kmph * _INCIDENT_DROP_RATIO
                and seg_speed <= _INCIDENT_SPEED_THRESHOLD_KMPH
            )
            if is_jam:
                jam_count += 1
            if is_jam or is_anomaly:
                anomaly_count += 1

        result["anomalous_segments_detected"] = anomaly_count > 0
        result["anomalous_segment_count"] = anomaly_count
        result["slowest_segment_speed_kmph"] = (
            round(min_speed, 1) if min_speed != float("inf") else None
        )

        # Likelihood rating
        if result["road_restriction_detected"] or jam_count >= 3:
            result["incident_likelihood"] = "HIGH"
        elif jam_count >= 1 or anomaly_count >= 2:
            result["incident_likelihood"] = "MEDIUM"
        elif anomaly_count >= 1:
            result["incident_likelihood"] = "LOW"
        else:
            result["incident_likelihood"] = "NONE"

    return result


# ── Traffic summary generator ─────────────────────────────────────────────────

def _build_traffic_summary(
    origin: str,
    destination: str,
    congestion_level: str,
    delay_mins: float,
    delay_pct: float,
    current_mins: float,
    static_mins: float,
    current_speed_kmph: float,
    distance_km: float,
    incidents: dict,
    alt_count: int,
) -> str:
    """
    Generate a human-readable one-paragraph traffic summary for Bengaluru
    commuters, using only verified API values. No invented content.
    """
    parts: list[str] = []

    # Core status sentence
    congestion_phrases = {
        "SEVERE":   "Traffic is severely congested",
        "HEAVY":    "Heavy traffic is affecting this route",
        "MODERATE": "Moderate traffic conditions",
        "LOW":      "Traffic is flowing freely",
    }
    congestion_phrase = congestion_phrases.get(congestion_level, "Traffic conditions are unknown")

    if delay_mins >= 1:
        parts.append(
            f"{congestion_phrase} from {origin} to {destination}. "
            f"Current travel time is ~{current_mins:.0f} min "
            f"(+{delay_mins:.0f} min delay, {delay_pct:.0f}% longer than usual)."
        )
    else:
        parts.append(
            f"{congestion_phrase} from {origin} to {destination}. "
            f"Expected travel time is ~{current_mins:.0f} min over {distance_km} km."
        )

    # Speed context
    if current_speed_kmph > 0:
        parts.append(
            f"Average traffic speed: {current_speed_kmph:.1f} km/h "
            f"(free-flow baseline: {round(distance_km / (static_mins / 60), 1) if static_mins > 0 else 'N/A'} km/h)."
        )

    # Incident note
    if incidents.get("road_restriction_detected"):
        reason = incidents.get("restriction_reason") or "unknown reason"
        parts.append(f"Road restriction active: {reason}.")
    elif incidents.get("incident_likelihood") in ("HIGH", "MEDIUM"):
        slowest = incidents.get("slowest_segment_speed_kmph")
        count = incidents.get("anomalous_segment_count", 0)
        if slowest is not None:
            parts.append(
                f"Incident likelihood is {incidents['incident_likelihood']} — "
                f"{count} slow segment(s) detected (min speed ~{slowest} km/h)."
            )
        else:
            parts.append(
                f"Incident likelihood is {incidents['incident_likelihood']} on this route."
            )
    elif incidents.get("advisory_note"):
        parts.append(incidents["advisory_note"])

    # Alternative routes note
    if alt_count > 0:
        parts.append(
            f"{alt_count} alternative route(s) available — "
            "check alternative_routes for comparison."
        )

    return " ".join(parts)


# ── Route parser ─────────────────────────────────────────────────────────────

def _parse_route(route_raw: dict, idx: int) -> dict:
    """
    Parse a single raw route dict from the Routes API response into a
    structured monitoring result. Does NOT include the primary incident
    analysis (that's done externally for the primary route).
    """
    duration_secs  = _parse_secs(route_raw.get("duration", "0s"))
    static_secs    = _parse_secs(route_raw.get("staticDuration", "0s"))
    distance_m     = route_raw.get("distanceMeters", 0)

    distance_km    = _meters_to_km(distance_m)
    current_mins   = _secs_to_mins(duration_secs)
    static_mins    = _secs_to_mins(static_secs)
    delay_mins     = round(max(0.0, current_mins - static_mins), 1)

    time_ratio = (current_mins / static_mins) if static_mins > 0 else 1.0
    delay_pct  = _delay_percentage(time_ratio)
    congestion = _classify_congestion(time_ratio, delay_mins)

    # Speed estimates
    normal_speed = (
        round(distance_km / (static_mins / 60), 2) if static_mins > 0 else 0.0
    )
    traffic_speed = (
        round(distance_km / (current_mins / 60), 2) if current_mins > 0 else 0.0
    )

    # Travel advisory
    advisory = route_raw.get("travelAdvisory", {})
    restriction = advisory.get("trafficRestriction")
    has_restriction = restriction is not None

    return {
        "route_index": idx,
        "description": route_raw.get("description", f"Route {idx + 1}"),
        "distance_km": distance_km,
        "average_time_to_travel_mins": static_mins,
        "current_time_with_traffic_mins": current_mins,
        "traffic_delay_mins": delay_mins,
        "delay_percentage": delay_pct,
        "average_normal_speed_kmph": normal_speed,
        "current_traffic_speed_kmph": traffic_speed,
        "congestion_level": congestion,
        "is_heavy_traffic": congestion in ("HEAVY", "SEVERE"),
        "has_road_restriction": has_restriction,
        "restriction_reason": (
            restriction.get("restrictionReason", "UNKNOWN") if has_restriction else None
        ),
    }


# ── Main public function ──────────────────────────────────────────────────────

def traffic_monitor_agent_tool(origin: str, destination: str) -> str:
    """
    Query the Google Routes API v2 for real-time traffic data between
    origin and destination.

    Returns a JSON string with the following top-level keys:
      origin, destination, route_description,
      distance_km,
      average_time_to_travel_mins,  – free-flow (staticDuration)
      current_time_with_traffic_mins,
      traffic_delay_mins,
      delay_percentage,             – delay as % of free-flow time
      average_normal_speed_kmph,
      current_traffic_speed_kmph,
      congestion_level,             – LOW | MODERATE | HEAVY | SEVERE
      is_heavy_traffic,             – True when HEAVY or SEVERE
      traffic_summary,              – human-readable paragraph
      incidents_and_roadblocks,     – per-segment incident analysis
      alternative_routes,           – list of up to 2 alternative route summaries
      data_source                   – "google_routes_api_v2"

    On error, returns: {"error": "<message>"}
    """
    if not GOOGLE_MAPS_API_KEY:
        return json.dumps(
            {"error": "GOOGLE_MAPS_API_KEY is not configured. Add it to the backend .env file."},
            indent=2,
        )

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "routes.duration,"
            "routes.staticDuration,"
            "routes.distanceMeters,"
            "routes.description,"
            "routes.travelAdvisory,"
            "routes.legs.duration,"
            "routes.legs.staticDuration,"
            "routes.legs.travelAdvisory"
        ),
    }

    body = {
        "origin": {"address": origin},
        "destination": {"address": destination},
        "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
        "travelMode": "DRIVE",
        "languageCode": "en-US",
        "units": "METRIC",
        "computeAlternativeRoutes": True,
    }

    try:
        response = requests.post(
            ROUTES_ENDPOINT,
            headers=headers,
            json=body,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.Timeout:
        return json.dumps(
            {"error": "Request timed out after {} s. Please try again.".format(REQUEST_TIMEOUT)},
            indent=2,
        )
    except requests.exceptions.ConnectionError:
        return json.dumps(
            {"error": "Network connection error. Check your internet connection."},
            indent=2,
        )
    except requests.exceptions.HTTPError as exc:
        return json.dumps(
            {"error": "API returned HTTP {}: {}".format(
                exc.response.status_code, exc.response.text[:400]
            )},
            indent=2,
        )
    except Exception as exc:
        return json.dumps({"error": "Unexpected error: {}".format(exc)}, indent=2)

    routes_raw = data.get("routes")
    if not routes_raw:
        return json.dumps(
            {"error": "No routes found for the given origin and destination."},
            indent=2,
        )

    # ── Parse primary route ───────────────────────────────────────────────────
    primary = _parse_route(routes_raw[0], 0)

    # ── Incident detection on primary route ───────────────────────────────────
    travel_advisory = routes_raw[0].get("travelAdvisory", {})
    incidents = _detect_incidents(travel_advisory, primary["current_traffic_speed_kmph"])

    # ── Parse alternative routes (up to 2) ────────────────────────────────────
    alternative_routes: list[dict] = []
    for idx, alt_raw in enumerate(routes_raw[1:3], start=1):
        alt = _parse_route(alt_raw, idx)
        # Include only the summary fields relevant for comparison
        alternative_routes.append({
            "route_index": alt["route_index"],
            "description": alt["description"],
            "distance_km": alt["distance_km"],
            "current_time_with_traffic_mins": alt["current_time_with_traffic_mins"],
            "average_time_to_travel_mins": alt["average_time_to_travel_mins"],
            "traffic_delay_mins": alt["traffic_delay_mins"],
            "delay_percentage": alt["delay_percentage"],
            "congestion_level": alt["congestion_level"],
            "is_heavy_traffic": alt["is_heavy_traffic"],
            "has_road_restriction": alt["has_road_restriction"],
        })

    # ── Build traffic summary ─────────────────────────────────────────────────
    traffic_summary = _build_traffic_summary(
        origin=origin,
        destination=destination,
        congestion_level=primary["congestion_level"],
        delay_mins=primary["traffic_delay_mins"],
        delay_pct=primary["delay_percentage"],
        current_mins=primary["current_time_with_traffic_mins"],
        static_mins=primary["average_time_to_travel_mins"],
        current_speed_kmph=primary["current_traffic_speed_kmph"],
        distance_km=primary["distance_km"],
        incidents=incidents,
        alt_count=len(alternative_routes),
    )

    result = {
        "origin": origin,
        "destination": destination,
        "route_description": primary["description"],
        "distance_km": primary["distance_km"],
        "average_time_to_travel_mins": primary["average_time_to_travel_mins"],
        "current_time_with_traffic_mins": primary["current_time_with_traffic_mins"],
        "traffic_delay_mins": primary["traffic_delay_mins"],
        "delay_percentage": primary["delay_percentage"],
        "average_normal_speed_kmph": primary["average_normal_speed_kmph"],
        "current_traffic_speed_kmph": primary["current_traffic_speed_kmph"],
        "congestion_level": primary["congestion_level"],
        "is_heavy_traffic": primary["is_heavy_traffic"],
        "traffic_summary": traffic_summary,
        "incidents_and_roadblocks": incidents,
        "alternative_routes": alternative_routes,
        "data_source": "google_routes_api_v2",
    }

    return json.dumps(result, indent=2)


# ── CLI test harness ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    _origin = input("Enter Origin Location: ").strip()
    _destination = input("Enter Destination Location: ").strip()
    if not _origin or not _destination:
        print('Usage: python traffic.py  (then enter origin and destination)')
    else:
        print(traffic_monitor_agent_tool(_origin, _destination))
