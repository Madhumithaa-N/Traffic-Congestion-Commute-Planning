"""
Route Optimisation & Multimodal Recommendation Module
======================================================
Person 2 – SmartRoute AI

Implements optimize_routes(origin, destination, traffic_data) which:
  1. Fetches traffic-aware driving routes + up to 3 alternatives via
     Google Maps Routes API v2.
  2. Fetches transit (bus, metro, rail, walk, taxi) via Google Maps
     Directions API (transit mode + driving mode for taxi estimate).
  3. Uses Gemini as a backend intelligence layer to explain and rank
     options using only the verified API data – never inventions.
  4. Returns a single structured JSON dict ready for FastAPI / React.

Environment variables (store in .env beside this file):
  GOOGLE_MAPS_API_KEY
  GEMINI_API_KEY
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment & constants
# ---------------------------------------------------------------------------

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# Google Maps API endpoints
ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"
DIRECTIONS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json"

# Gemini endpoint (gemini-3.8-flash – latest model for this API key)
GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-3.8-flash:generateContent"
)

REQUEST_TIMEOUT = 20  # seconds per outbound HTTP call


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _parse_secs(raw: Any) -> float:
    """Strip trailing 's' and return float seconds; fallback to 0.0."""
    try:
        return float(str(raw).rstrip("s")) if raw else 0.0
    except ValueError:
        return 0.0


def _meters_to_km(meters: Any) -> float:
    try:
        return round(float(meters) / 1000, 2)
    except (TypeError, ValueError):
        return 0.0


def _secs_to_mins(secs: float) -> float:
    return round(secs / 60, 1)


def _duration_text(secs: float) -> str:
    """Return a human-readable duration string, e.g. '1 h 23 min'."""
    secs = int(secs)
    if secs < 60:
        return f"{secs} sec"
    mins = secs // 60
    if mins < 60:
        return f"{mins} min"
    h, m = divmod(mins, 60)
    return f"{h} h {m} min" if m else f"{h} h"


def _route_fingerprint(distance_km: float, duration_mins: float) -> str:
    """Rough fingerprint for deduplication (±2 km, ±3 min buckets)."""
    return f"{round(distance_km / 2) * 2}_{round(duration_mins / 3) * 3}"


# ---------------------------------------------------------------------------
# 1. Driving routes via Google Routes API v2
# ---------------------------------------------------------------------------

def _fetch_driving_routes(origin: str, destination: str) -> dict:
    """
    Call Google Routes API v2 for up to 4 driving routes (1 best + 3 alts).
    Returns raw API response dict or an error dict.
    """
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "GOOGLE_MAPS_API_KEY not configured."}

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "routes.duration,"
            "routes.staticDuration,"
            "routes.distanceMeters,"
            "routes.description,"
            "routes.polyline,"
            "routes.travelAdvisory,"
            "routes.legs.steps.navigationInstruction,"
            "routes.legs.steps.distanceMeters,"
            "routes.legs.steps.staticDuration,"
            "routes.legs.distanceMeters,"
            "routes.legs.duration,"
            "routes.legs.staticDuration"
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
        resp = requests.post(ROUTES_ENDPOINT, headers=headers, json=body, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "Driving routes API timed out."}
    except requests.exceptions.ConnectionError:
        return {"error": "Network error fetching driving routes."}
    except requests.exceptions.HTTPError as exc:
        return {"error": f"Routes API HTTP {exc.response.status_code}: {exc.response.text[:300]}"}
    except Exception as exc:
        return {"error": f"Unexpected error fetching driving routes: {exc}"}


def _parse_driving_routes(raw: dict) -> list[dict]:
    """
    Parse raw Routes API response into a list of structured route dicts.
    Deduplicates by distance+duration fingerprint.
    """
    routes_raw = raw.get("routes", [])
    parsed: list[dict] = []
    seen_fingerprints: set[str] = set()

    for idx, r in enumerate(routes_raw[:4]):
        duration_secs = _parse_secs(r.get("duration", "0s"))
        static_secs = _parse_secs(r.get("staticDuration", "0s"))
        distance_m = r.get("distanceMeters", 0)

        distance_km = _meters_to_km(distance_m)
        duration_mins = _secs_to_mins(duration_secs)
        static_mins = _secs_to_mins(static_secs)
        delay_mins = round(max(0.0, duration_mins - static_mins), 1)

        fp = _route_fingerprint(distance_km, duration_mins)
        if fp in seen_fingerprints:
            continue
        seen_fingerprints.add(fp)

        # Congestion classification
        time_ratio = (duration_mins / static_mins) if static_mins > 0 else 1.0
        if time_ratio >= 1.40 or delay_mins >= 15:
            congestion = "HEAVY"
        elif time_ratio >= 1.15 or delay_mins >= 5:
            congestion = "MODERATE"
        else:
            congestion = "LOW"

        # Travel advisory
        advisory = r.get("travelAdvisory", {})
        restriction = advisory.get("trafficRestriction")
        has_restriction = restriction is not None

        # Steps summary (first leg)
        steps = []
        legs = r.get("legs", [])
        if legs:
            for step in legs[0].get("steps", [])[:8]:  # cap at 8 key steps
                nav = step.get("navigationInstruction", {})
                instr = nav.get("instructions", "")
                if instr:
                    steps.append({
                        "instruction": instr,
                        "distance_km": _meters_to_km(step.get("distanceMeters", 0)),
                        "duration_mins": _secs_to_mins(_parse_secs(step.get("staticDuration", "0s"))),
                    })

        parsed.append({
            "route_index": idx,
            "description": r.get("description", f"Route {idx + 1}"),
            "distance_km": distance_km,
            "duration_text": _duration_text(duration_secs),
            "duration_mins": duration_mins,
            "static_duration_mins": static_mins,
            "traffic_delay_mins": delay_mins,
            "congestion_level": congestion,
            "has_road_restriction": has_restriction,
            "restriction_reason": restriction.get("restrictionReason") if has_restriction else None,
            "polyline": r.get("polyline", {}).get("encodedPolyline", None),
            "steps": steps,
        })

    return parsed


# ---------------------------------------------------------------------------
# 2. Transit options via Google Directions API
# ---------------------------------------------------------------------------

def _fetch_transit_options(origin: str, destination: str) -> dict:
    """
    Fetch transit directions (bus, metro, rail, walk) via Directions API.
    Returns raw API response or error dict.
    """
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "GOOGLE_MAPS_API_KEY not configured."}

    params = {
        "origin": origin,
        "destination": destination,
        "mode": "transit",
        "alternatives": "true",
        "language": "en",
        "units": "metric",
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        resp = requests.get(DIRECTIONS_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "Transit API timed out."}
    except requests.exceptions.ConnectionError:
        return {"error": "Network error fetching transit options."}
    except requests.exceptions.HTTPError as exc:
        return {"error": f"Directions API HTTP {exc.response.status_code}: {exc.response.text[:300]}"}
    except Exception as exc:
        return {"error": f"Unexpected error fetching transit options: {exc}"}


def _fetch_walking_option(origin: str, destination: str) -> dict:
    """Fetch walking directions via Directions API."""
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "GOOGLE_MAPS_API_KEY not configured."}

    params = {
        "origin": origin,
        "destination": destination,
        "mode": "walking",
        "language": "en",
        "units": "metric",
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        resp = requests.get(DIRECTIONS_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        return {"error": f"Walking API error: {exc}"}


def _parse_transit_step(step: dict) -> dict:
    """Extract useful info from a single transit step."""
    transit = step.get("transit_details", {})
    line = transit.get("line", {})
    departure_stop = transit.get("departure_stop", {})
    arrival_stop = transit.get("arrival_stop", {})
    departure_time = transit.get("departure_time", {})
    arrival_time = transit.get("arrival_time", {})
    vehicle = line.get("vehicle", {})

    return {
        "travel_mode": step.get("travel_mode", "UNKNOWN"),
        "vehicle_type": vehicle.get("type", "UNKNOWN"),
        "vehicle_name": vehicle.get("name", ""),
        "line_name": line.get("name", "") or line.get("short_name", ""),
        "line_short_name": line.get("short_name", ""),
        "agency": line.get("agencies", [{}])[0].get("name", "") if line.get("agencies") else "",
        "departure_stop": departure_stop.get("name", ""),
        "arrival_stop": arrival_stop.get("name", ""),
        "departure_time": departure_time.get("text", ""),
        "arrival_time": arrival_time.get("text", ""),
        "num_stops": transit.get("num_stops", 0),
        "headsign": transit.get("headsign", ""),
        "distance_km": _meters_to_km(step.get("distance", {}).get("value", 0)),
        "duration_mins": round(step.get("duration", {}).get("value", 0) / 60, 1),
        "html_instructions": re.sub(r"<[^>]+>", "", step.get("html_instructions", "")),
    }


def _parse_transit_options(raw: dict) -> list[dict]:
    """
    Parse Directions API transit response into structured transport option list.
    Handles bus, metro, intercity rail, walking legs.
    """
    if "error" in raw:
        return []

    status = raw.get("status", "")
    if status not in ("OK", "ZERO_RESULTS"):
        return []

    options: list[dict] = []

    for route in raw.get("routes", [])[:3]:
        leg = route.get("legs", [{}])[0]

        total_distance_km = _meters_to_km(leg.get("distance", {}).get("value", 0))
        total_duration_mins = round(leg.get("duration", {}).get("value", 0) / 60, 1)
        departure_time = leg.get("departure_time", {}).get("text", "")
        arrival_time = leg.get("arrival_time", {}).get("text", "")

        steps_raw = leg.get("steps", [])
        parsed_steps: list[dict] = []
        vehicle_types: set[str] = set()
        transfers = 0

        for step in steps_raw:
            ps = _parse_transit_step(step)
            parsed_steps.append(ps)
            vt = ps.get("vehicle_type", "")
            if vt and vt not in ("UNKNOWN", "WALK", "WALKING"):
                vehicle_types.add(vt)
                # Sub-steps for walking within transit steps
                for sub in step.get("steps", []):
                    sub_ps = _parse_transit_step(sub)
                    if sub_ps.get("travel_mode") not in ("", "UNKNOWN"):
                        parsed_steps.append(sub_ps)

        # Count transfers = number of distinct transit vehicle boardings - 1
        transit_steps = [s for s in parsed_steps if s.get("travel_mode") == "TRANSIT"]
        transfers = max(0, len(transit_steps) - 1)

        # Classify dominant mode
        vt_list = list(vehicle_types)
        if "HEAVY_RAIL" in vt_list or "COMMUTER_TRAIN" in vt_list or "HIGH_SPEED_RAIL" in vt_list or "LONG_DISTANCE_TRAIN" in vt_list:
            mode_label = "intercity_rail"
        elif "SUBWAY" in vt_list or "METRO_RAIL" in vt_list:
            mode_label = "metro"
        elif "BUS" in vt_list or "INTERCITY_BUS" in vt_list:
            mode_label = "bus"
        elif "TRAM" in vt_list or "TROLLEYBUS" in vt_list:
            mode_label = "tram"
        else:
            mode_label = "transit"

        # Fare (if API returns it)
        fare_info = raw.get("fare", {})
        fare_text = fare_info.get("text", None)

        options.append({
            "mode": mode_label,
            "vehicle_types": vt_list,
            "total_distance_km": total_distance_km,
            "total_duration_mins": total_duration_mins,
            "duration_text": _duration_text(total_duration_mins * 60),
            "transfers": transfers,
            "departure_time": departure_time,
            "arrival_time": arrival_time,
            "fare": fare_text,
            "summary": route.get("summary", ""),
            "warnings": route.get("warnings", []),
            "steps": parsed_steps,
        })

    return options


def _parse_walking_option(raw: dict) -> dict | None:
    """Return a simplified walking option dict or None."""
    if "error" in raw or raw.get("status") != "OK":
        return None

    routes = raw.get("routes", [])
    if not routes:
        return None

    leg = routes[0].get("legs", [{}])[0]
    distance_km = _meters_to_km(leg.get("distance", {}).get("value", 0))
    duration_mins = round(leg.get("duration", {}).get("value", 0) / 60, 1)

    # Only return walking if it's a realistic walk (≤ 5 km)
    if distance_km > 5.0:
        return None

    return {
        "mode": "walking",
        "total_distance_km": distance_km,
        "total_duration_mins": duration_mins,
        "duration_text": _duration_text(duration_mins * 60),
        "transfers": 0,
        "fare": "Free",
        "steps": [],
    }


# ---------------------------------------------------------------------------
# 3. Taxi / ride-hail estimate (driving time + distance-based fare estimate)
# ---------------------------------------------------------------------------

def _build_taxi_option(driving_routes: list[dict]) -> dict | None:
    """
    Derive a taxi option from the best driving route.
    Fare is an estimate based on typical per-km rates; no real booking API.
    Clearly labelled as an estimate.
    """
    if not driving_routes:
        return None

    best = driving_routes[0]
    distance_km = best["distance_km"]
    duration_mins = best["duration_mins"]

    # Conservative fare estimate (base fare + per-km): adjust for locale
    base_fare = 30.0       # ₹ base fare (common in Indian cities)
    per_km_rate = 14.0     # ₹/km
    estimated_fare = round(base_fare + (distance_km * per_km_rate), 2)

    return {
        "mode": "taxi",
        "vehicle_types": ["TAXI"],
        "total_distance_km": distance_km,
        "total_duration_mins": duration_mins,
        "duration_text": _duration_text(duration_mins * 60),
        "transfers": 0,
        "fare": f"~₹{estimated_fare} (estimate)",
        "fare_note": "Estimate only – base ₹30 + ₹14/km. Actual fare depends on provider and surge pricing.",
        "follows_route": best.get("description", ""),
    }


# ---------------------------------------------------------------------------
# 4. Incorporate Person 1's traffic data
# ---------------------------------------------------------------------------

def _parse_traffic_data(traffic_data: str | dict) -> dict:
    """
    Accept Person 1's traffic_monitor_agent_tool output (JSON string or dict).
    Returns a parsed dict; returns empty dict on failure.
    """
    if not traffic_data:
        return {}
    if isinstance(traffic_data, str):
        try:
            return json.loads(traffic_data)
        except json.JSONDecodeError:
            return {}
    if isinstance(traffic_data, dict):
        return traffic_data
    return {}


def _build_traffic_context_summary(td: dict) -> str:
    """Build a compact text summary of Person 1's data for Gemini prompting."""
    if not td:
        return "No traffic monitoring data available."

    lines = [
        f"Origin: {td.get('origin', 'N/A')}",
        f"Destination: {td.get('destination', 'N/A')}",
        f"Route description: {td.get('route_description', 'N/A')}",
        f"Distance: {td.get('distance_km', 'N/A')} km",
        f"Normal travel time: {td.get('average_time_to_travel_mins', 'N/A')} min",
        f"Current travel time with traffic: {td.get('current_time_with_traffic_mins', 'N/A')} min",
        f"Traffic delay: {td.get('traffic_delay_mins', 'N/A')} min",
        f"Average normal speed: {td.get('average_normal_speed_kmph', 'N/A')} km/h",
        f"Current traffic speed: {td.get('current_traffic_speed_kmph', 'N/A')} km/h",
        f"Congestion level: {td.get('congestion_level', 'N/A')}",
        f"Heavy traffic: {td.get('is_heavy_traffic', 'N/A')}",
    ]

    incidents = td.get("incidents_and_roadblocks", {})
    if incidents:
        lines += [
            f"Incident likelihood: {incidents.get('incident_likelihood', 'N/A')}",
            f"Road restriction detected: {incidents.get('road_restriction_detected', False)}",
            f"Restriction reason: {incidents.get('restriction_reason', 'None')}",
            f"Anomalous segments: {incidents.get('anomalous_segment_count', 0)}",
            f"Slowest segment speed: {incidents.get('slowest_segment_speed_kmph', 'N/A')} km/h",
            f"Advisory note: {incidents.get('advisory_note', 'None')}",
        ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 5. Gemini intelligence layer
# ---------------------------------------------------------------------------

_GEMINI_SYSTEM_PROMPT = """
You are a backend route analysis engine for SmartRoute AI.

STRICT RULES – violating any of these makes your response invalid:
1. You MUST only reference facts present in the data provided to you.
2. You MUST NOT invent routes, road names, stops, fares, schedules, distances,
   travel times, traffic conditions, accidents, or roadblocks.
3. If information is absent from the data, say "unknown" – not "unavailable"
   or "safe to assume".
4. Do NOT recommend an option whose data is absent or incomplete.
5. Output ONLY a JSON object with the exact schema described in the prompt.
   Do NOT include markdown fences, preamble, or explanation outside the JSON.
""".strip()


def _call_gemini(prompt: str, _retries: int = 2) -> str | None:
    """
    Call Gemini with a single user prompt.
    Retries up to _retries times on transient 503 errors (high demand).
    Returns the text content of the first candidate, or None on failure.
    """
    if not GEMINI_API_KEY:
        return None

    payload = {
        "system_instruction": {"parts": [{"text": _GEMINI_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,   # low temperature → factual, deterministic
            "maxOutputTokens": 1500,
        },
    }

    url = f"{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}"

    for attempt in range(_retries + 1):
        try:
            resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            # Retry on 503 (high demand) with brief back-off
            if resp.status_code == 503 and attempt < _retries:
                time.sleep(2 ** attempt)  # 1s, 2s
                continue
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                return None
            return parts[0].get("text", "").strip()
        except requests.exceptions.Timeout:
            return None
        except Exception:
            return None

    return None


def _build_gemini_prompt(
    origin: str,
    destination: str,
    traffic_summary: str,
    driving_routes: list[dict],
    transport_options: list[dict],
) -> str:
    """
    Build the structured prompt sent to Gemini.
    All factual data is injected; Gemini is only asked to reason and explain.
    """
    driving_json = json.dumps(driving_routes, indent=2)
    transport_json = json.dumps(transport_options, indent=2)

    return f"""
You are analysing routes from "{origin}" to "{destination}".

=== PERSON 1 TRAFFIC MONITORING DATA ===
{traffic_summary}

=== VERIFIED DRIVING ROUTES (Google Routes API) ===
{driving_json}

=== VERIFIED TRANSPORT OPTIONS (Google Directions API) ===
{transport_json}

TASK:
Using ONLY the data above, produce a JSON object with this exact schema:

{{
  "best_route_explanation": "<2-3 sentences explaining why the best driving route is recommended, citing actual distance/duration/delay from the data>",
  "alternative_route_notes": [
    "<note on alternative route 1 vs best, using actual data>",
    "<note on alternative route 2 vs best, using actual data>"
  ],
  "transport_comparison": "<2-3 sentences comparing driving vs transit options using only verified data>",
  "multimodal_recommendations": [
    {{
      "combination": "<describe the multimodal combination, e.g. Walk + Metro + Walk>",
      "rationale": "<why this combination is useful given the current traffic/distance>",
      "estimated_total_mins": <number from verified data only or null>,
      "estimated_fare": "<fare string from data or 'unknown'>",
      "suitability": "<BEST | GOOD | FALLBACK>"
    }}
  ],
  "overall_recommendation": "<single clear sentence telling the traveller what to do right now>",
  "warnings": ["<warning if any route has restrictions, heavy traffic, or data gaps>"]
}}

Output only the JSON. No markdown. No explanation outside the JSON.
""".strip()


def _validate_gemini_output(
    gemini_dict: dict,
    driving_routes: list[dict],
    transport_options: list[dict],
) -> tuple[dict, list[str]]:
    """
    Validate Gemini's JSON output against source data.
    Strip any multimodal_recommendations whose estimated_total_mins deviates
    by more than 30% from the nearest matching transit option.
    Returns (validated_dict, validation_warnings).
    """
    validation_warnings: list[str] = []

    # Verify multimodal recommendations
    valid_recommendations = []
    for rec in gemini_dict.get("multimodal_recommendations", []):
        est_mins = rec.get("estimated_total_mins")
        if est_mins is not None:
            # Find the closest transport option by duration
            durations = [t.get("total_duration_mins", 0) for t in transport_options]
            if durations:
                closest = min(durations, key=lambda d: abs(d - est_mins))
                deviation = abs(est_mins - closest) / closest if closest > 0 else 1.0
                if deviation > 0.30:
                    validation_warnings.append(
                        f"Gemini estimated {est_mins} min for '{rec.get('combination', '')}' "
                        f"but nearest verified option is {closest} min (>{round(deviation*100)}% deviation). "
                        "Recommendation removed."
                    )
                    continue  # drop this recommendation
        valid_recommendations.append(rec)

    gemini_dict["multimodal_recommendations"] = valid_recommendations
    return gemini_dict, validation_warnings


def _python_fallback_recommendations(
    origin: str,
    destination: str,
    driving_routes: list[dict],
    transport_options: list[dict],
    traffic_data: dict,
) -> dict:
    """
    Pure Python fallback used when Gemini is unavailable or produces
    unsupported claims. Generates a structured recommendation dict
    based solely on verified API data.
    """
    best_drive = driving_routes[0] if driving_routes else {}
    congestion = best_drive.get("congestion_level", "UNKNOWN")
    delay_mins = best_drive.get("traffic_delay_mins", 0)
    drive_mins = best_drive.get("duration_mins", 0)
    distance_km = best_drive.get("distance_km", 0)

    # Build best-route explanation
    if congestion == "HEAVY":
        explanation = (
            f"The fastest driving route covers {distance_km} km in "
            f"~{drive_mins} min with {delay_mins} min of traffic delay "
            f"(HEAVY congestion). Consider transit alternatives."
        )
    elif congestion == "MODERATE":
        explanation = (
            f"The best driving route is {distance_km} km, currently taking "
            f"~{drive_mins} min with a {delay_mins} min delay due to MODERATE traffic."
        )
    else:
        explanation = (
            f"Traffic is LOW on the best driving route ({distance_km} km, "
            f"~{drive_mins} min). Driving is efficient at this time."
        )

    # Alternative route notes
    alt_notes = []
    for alt in driving_routes[1:3]:
        diff_mins = round(alt.get("duration_mins", 0) - drive_mins, 1)
        sign = "+" if diff_mins >= 0 else ""
        alt_notes.append(
            f"{alt.get('description', 'Alternative route')}: "
            f"{alt.get('distance_km')} km, {alt.get('duration_mins')} min "
            f"({sign}{diff_mins} min vs best), congestion: {alt.get('congestion_level')}."
        )

    # Transport comparison
    if transport_options:
        best_transit = min(transport_options, key=lambda t: t.get("total_duration_mins", 9999))
        transit_mins = best_transit.get("total_duration_mins", 0)
        transit_mode = best_transit.get("mode", "transit")
        transit_fare = best_transit.get("fare", "unknown")
        transport_comparison = (
            f"Best transit option ({transit_mode}) takes {transit_mins} min "
            f"with fare: {transit_fare}. "
            f"Driving takes {drive_mins} min "
            f"({'faster' if drive_mins < transit_mins else 'slower'} by "
            f"{abs(round(drive_mins - transit_mins, 1))} min)."
        )
    else:
        transport_comparison = (
            f"No transit options found for this route. "
            f"Driving ({drive_mins} min) is the only verified option."
        )

    # Multimodal recommendations
    multimodal = []
    for t in transport_options[:2]:
        multimodal.append({
            "combination": t.get("mode", "transit").title() + (
                " (with walking transfers)" if t.get("transfers", 0) > 0 else ""
            ),
            "rationale": (
                f"Verified by Google Directions API. "
                f"{t.get('transfers', 0)} transfer(s). "
                f"Fare: {t.get('fare', 'unknown')}."
            ),
            "estimated_total_mins": t.get("total_duration_mins"),
            "estimated_fare": t.get("fare", "unknown"),
            "suitability": "GOOD" if congestion in ("HEAVY", "MODERATE") else "FALLBACK",
        })

    # Overall recommendation
    if congestion == "HEAVY" and transport_options:
        best_transit = min(transport_options, key=lambda t: t.get("total_duration_mins", 9999))
        recommendation = (
            f"Heavy traffic detected ({delay_mins} min delay). "
            f"Consider {best_transit.get('mode', 'transit')} "
            f"({best_transit.get('total_duration_mins')} min) instead of driving."
        )
    elif congestion == "MODERATE":
        recommendation = (
            f"Moderate traffic ({delay_mins} min delay). Driving is still viable; "
            "transit is a reasonable alternative if available."
        )
    else:
        recommendation = (
            f"Traffic is clear. Drive via {best_drive.get('description', 'the recommended route')} "
            f"for the fastest journey (~{drive_mins} min)."
        )

    # Warnings from traffic data
    warnings: list[str] = []
    incidents = traffic_data.get("incidents_and_roadblocks", {})
    if incidents.get("road_restriction_detected"):
        warnings.append(
            f"Road restriction detected: {incidents.get('restriction_reason', 'unknown reason')}."
        )
    if incidents.get("incident_likelihood") in ("HIGH", "MEDIUM"):
        warnings.append(
            f"Incident likelihood is {incidents.get('incident_likelihood')} on the primary route. "
            "Anomalous slow segments detected."
        )
    if best_drive.get("has_road_restriction"):
        warnings.append("Google Routes API flagged a road restriction on the best driving route.")

    return {
        "best_route_explanation": explanation,
        "alternative_route_notes": alt_notes,
        "transport_comparison": transport_comparison,
        "multimodal_recommendations": multimodal,
        "overall_recommendation": recommendation,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# 6. Main public function
# ---------------------------------------------------------------------------

def optimize_routes(
    origin: str,
    destination: str,
    traffic_data: str | dict,
) -> dict:
    """
    Route Optimisation & Multimodal Recommendation entry point.

    Parameters
    ----------
    origin : str
        Plain-text origin address (e.g. "Majestic, Bengaluru").
    destination : str
        Plain-text destination address (e.g. "Electronic City, Bengaluru").
    traffic_data : str | dict
        JSON string or dict returned by Person 1's traffic_monitor_agent_tool().

    Returns
    -------
    dict
        Structured response with keys:
          best_route, alternative_routes, transport_options,
          multimodal_recommendations, data_sources, warnings.
    """
    warnings: list[str] = []
    data_sources: list[str] = []

    # ── Parse Person 1's traffic data ────────────────────────────────────────
    td = _parse_traffic_data(traffic_data)
    if not td:
        warnings.append("Traffic monitoring data is missing or unparseable. Proceeding without it.")
    else:
        data_sources.append("person1_traffic_monitor")

    traffic_summary = _build_traffic_context_summary(td)

    # ── Fetch driving routes ─────────────────────────────────────────────────
    raw_driving = _fetch_driving_routes(origin, destination)
    if "error" in raw_driving:
        warnings.append(f"Driving routes error: {raw_driving['error']}")
        driving_routes: list[dict] = []
    else:
        driving_routes = _parse_driving_routes(raw_driving)
        if driving_routes:
            data_sources.append("google_routes_api_v2")
        else:
            warnings.append("Google Routes API returned no usable driving routes.")

    # ── Fetch transit options ────────────────────────────────────────────────
    raw_transit = _fetch_transit_options(origin, destination)
    if "error" in raw_transit:
        warnings.append(f"Transit options error: {raw_transit['error']}")
        transit_options: list[dict] = []
    else:
        transit_options = _parse_transit_options(raw_transit)
        if transit_options:
            data_sources.append("google_directions_api_transit")
        else:
            warnings.append("No transit options found for this route.")

    # ── Fetch walking option ─────────────────────────────────────────────────
    raw_walking = _fetch_walking_option(origin, destination)
    walking_option = _parse_walking_option(raw_walking)

    # ── Build taxi estimate ───────────────────────────────────────────────────
    taxi_option = _build_taxi_option(driving_routes)

    # ── Compile all transport options ────────────────────────────────────────
    all_transport: list[dict] = []
    all_transport.extend(transit_options)
    if walking_option:
        all_transport.append(walking_option)
    if taxi_option:
        all_transport.append(taxi_option)

    # ── Gemini intelligence layer ─────────────────────────────────────────────
    gemini_output: dict = {}
    gemini_used = False
    gemini_validation_warnings: list[str] = []

    if driving_routes:  # only call Gemini if we have real data to reason over
        prompt = _build_gemini_prompt(
            origin, destination, traffic_summary, driving_routes, all_transport
        )
        gemini_raw_text = _call_gemini(prompt)

        if gemini_raw_text:
            # Strip any accidental markdown fences
            cleaned = re.sub(r"^```(?:json)?\s*", "", gemini_raw_text, flags=re.MULTILINE)
            cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
            try:
                gemini_dict = json.loads(cleaned)
                gemini_dict, gemini_validation_warnings = _validate_gemini_output(
                    gemini_dict, driving_routes, all_transport
                )
                gemini_output = gemini_dict
                gemini_used = True
                data_sources.append("gemini_3.8_flash")
                if gemini_validation_warnings:
                    warnings.extend(gemini_validation_warnings)
            except json.JSONDecodeError:
                warnings.append(
                    "Gemini returned non-JSON output. Using Python-based recommendations."
                )
        else:
            warnings.append(
                "Gemini API unavailable or returned empty response. "
                "Using Python-based recommendations."
            )

    # ── Python fallback if Gemini failed ─────────────────────────────────────
    if not gemini_used:
        gemini_output = _python_fallback_recommendations(
            origin, destination, driving_routes, all_transport, td
        )
        data_sources.append("python_fallback_recommender")

    # ── Construct best_route ──────────────────────────────────────────────────
    best_route: dict = {}
    if driving_routes:
        br = driving_routes[0]
        best_route = {
            "description": br["description"],
            "distance_km": br["distance_km"],
            "duration_mins": br["duration_mins"],
            "duration_text": br["duration_text"],
            "traffic_delay_mins": br["traffic_delay_mins"],
            "congestion_level": br["congestion_level"],
            "has_road_restriction": br["has_road_restriction"],
            "restriction_reason": br["restriction_reason"],
            "polyline": br.get("polyline"),
            "steps": br.get("steps", []),
            "explanation": gemini_output.get("best_route_explanation", ""),
        }

    # ── Construct alternative_routes ─────────────────────────────────────────
    alt_route_notes = gemini_output.get("alternative_route_notes", [])
    alternative_routes: list[dict] = []
    for i, alt in enumerate(driving_routes[1:]):
        alt_entry = {
            "description": alt["description"],
            "distance_km": alt["distance_km"],
            "duration_mins": alt["duration_mins"],
            "duration_text": alt["duration_text"],
            "traffic_delay_mins": alt["traffic_delay_mins"],
            "congestion_level": alt["congestion_level"],
            "has_road_restriction": alt["has_road_restriction"],
            "polyline": alt.get("polyline"),
            "note": alt_route_notes[i] if i < len(alt_route_notes) else None,
        }
        alternative_routes.append(alt_entry)

    # ── Assemble final warnings ───────────────────────────────────────────────
    gemini_warnings = gemini_output.get("warnings", [])
    all_warnings = warnings + [w for w in gemini_warnings if w not in warnings]

    # ── Final structured response ─────────────────────────────────────────────
    return {
        "origin": origin,
        "destination": destination,
        "best_route": best_route,
        "alternative_routes": alternative_routes,
        "transport_options": all_transport,
        "multimodal_recommendations": gemini_output.get("multimodal_recommendations", []),
        "transport_comparison": gemini_output.get("transport_comparison", ""),
        "overall_recommendation": gemini_output.get("overall_recommendation", ""),
        "data_sources": data_sources,
        "gemini_used": gemini_used,
        "traffic_context": {
            "congestion_level": td.get("congestion_level"),
            "traffic_delay_mins": td.get("traffic_delay_mins"),
            "incident_likelihood": td.get("incidents_and_roadblocks", {}).get("incident_likelihood"),
            "is_heavy_traffic": td.get("is_heavy_traffic"),
        },
        "warnings": all_warnings,
    }


# ---------------------------------------------------------------------------
# Resolve API keys at module load: read exclusively from environment / .env.
# Copy .env.example to .env and fill in your keys before running.
# ---------------------------------------------------------------------------
if not GOOGLE_MAPS_API_KEY:
    raise EnvironmentError(
        "GOOGLE_MAPS_API_KEY is not set. "
        "Add it to backend/route_optimisation/.env or set it as an environment variable."
    )

if not GEMINI_API_KEY:
    raise EnvironmentError(
        "GEMINI_API_KEY is not set. "
        "Add it to backend/route_optimisation/.env or set it as an environment variable."
    )


# ---------------------------------------------------------------------------
# 7. CLI test harness
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    # ---- Test 1: Local journey (Bengaluru) ----
    print("\n" + "=" * 60)
    print("TEST 1 – Local journey: Majestic → Electronic City, Bengaluru")
    print("=" * 60)

    # Simulate Person 1's traffic output for this route
    sample_traffic_local = {
        "origin": "Majestic, Bengaluru",
        "destination": "Electronic City, Bengaluru",
        "route_description": "Hosur Rd",
        "distance_km": 18.4,
        "average_time_to_travel_mins": 32.0,
        "current_time_with_traffic_mins": 52.0,
        "traffic_delay_mins": 20.0,
        "average_normal_speed_kmph": 34.5,
        "current_traffic_speed_kmph": 21.2,
        "congestion_level": "HEAVY",
        "is_heavy_traffic": True,
        "incidents_and_roadblocks": {
            "road_restriction_detected": False,
            "restriction_reason": None,
            "anomalous_segments_detected": True,
            "anomalous_segment_count": 3,
            "slowest_segment_speed_kmph": 5.0,
            "incident_likelihood": "HIGH",
            "advisory_note": None,
        },
    }

    result1 = optimize_routes(
        "Majestic, Bengaluru",
        "Electronic City, Bengaluru",
        sample_traffic_local,
    )
    print(json.dumps(result1, indent=2))

    # ---- Test 2: Intercity journey ----
    print("\n" + "=" * 60)
    print("TEST 2 – Intercity journey: Bengaluru → Chennai")
    print("=" * 60)

    sample_traffic_intercity = {
        "origin": "Bengaluru",
        "destination": "Chennai",
        "route_description": "NH 44",
        "distance_km": 346.0,
        "average_time_to_travel_mins": 330.0,
        "current_time_with_traffic_mins": 360.0,
        "traffic_delay_mins": 30.0,
        "average_normal_speed_kmph": 62.9,
        "current_traffic_speed_kmph": 57.7,
        "congestion_level": "MODERATE",
        "is_heavy_traffic": False,
        "incidents_and_roadblocks": {
            "road_restriction_detected": False,
            "restriction_reason": None,
            "anomalous_segments_detected": False,
            "anomalous_segment_count": 0,
            "slowest_segment_speed_kmph": 45.0,
            "incident_likelihood": "NONE",
            "advisory_note": None,
        },
    }

    result2 = optimize_routes(
        "Bengaluru",
        "Chennai",
        sample_traffic_intercity,
    )
    print(json.dumps(result2, indent=2))
