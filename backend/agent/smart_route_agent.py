"""
agent/smart_route_agent.py – SmartRouteAgent

One central agent that orchestrates all four Python tools using deterministic
Python logic as the primary backbone. Gemini is used ONLY for:
  1. Generating a natural-language overall explanation of verified results.
  2. Optionally extracting intent from ambiguous natural-language requests.

Gemini NEVER generates routes, times, distances, fares or traffic data.
All of those come from the four tool modules. The agent has a full deterministic
fallback so the application works even when Gemini is unavailable.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# ── Path bootstrap ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

import requests  # noqa: E402

from config.settings import GEMINI_API_KEY, GEMINI_ENDPOINT, REQUEST_TIMEOUT  # noqa: E402
from tools import (  # noqa: E402
    run_traffic_monitor,
    run_route_optimize,
    run_ml_predict,
    run_departure_plan,
)


# ── Gemini system prompt ──────────────────────────────────────────────────────
_SYSTEM_PROMPT = """
You are SmartRoute AI's explanation engine for Bengaluru commute planning.

STRICT RULES:
1. Only reference facts present in the verified data provided to you.
2. Do NOT invent routes, roads, distances, times, fares, or traffic conditions.
3. Output ONLY a JSON object with the exact schema described in each prompt.
4. No markdown fences. No explanation outside the JSON.
5. If data is missing, write "unknown" – never guess.
""".strip()


def _call_gemini(prompt: str, retries: int = 2) -> Optional[str]:
    """
    Call Gemini to generate a natural-language explanation.
    Returns the response text or None if unavailable.
    """
    if not GEMINI_API_KEY:
        return None

    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 600,
        },
    }

    url = f"{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}"

    for attempt in range(retries + 1):
        try:
            resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 503 and attempt < retries:
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None
            parts = candidates[0].get("content", {}).get("parts", [])
            return parts[0].get("text", "").strip() if parts else None
        except Exception:
            return None

    return None


def _clean_gemini_json(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse JSON. Returns None on failure."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# ── Deterministic recommendation builder ─────────────────────────────────────

def _build_recommendation(
    traffic: dict,
    routes: dict,
    departure: dict,
    ml_pred: Optional[dict],
) -> tuple[str, str]:
    """
    Build overall_recommendation and explanation strings from verified tool data.
    Returns (overall_recommendation, explanation).
    """
    congestion = traffic.get("congestion_level", "UNKNOWN")
    delay = traffic.get("traffic_delay_mins", 0)

    best_route = routes.get("best_route", {})
    drive_mins = best_route.get("duration_mins", 0)
    drive_dist = best_route.get("distance_km", 0)
    drive_desc = best_route.get("description", "the recommended route")

    transport = routes.get("transport_options", [])
    best_transit = (
        min(transport, key=lambda t: t.get("total_duration_mins", 9999))
        if transport else None
    )

    recommended_option = routes.get("overall_recommendation", "")
    if recommended_option:
        rec_str = recommended_option
    elif congestion in ("HEAVY",) and best_transit:
        rec_str = (
            f"Heavy traffic detected ({delay} min delay). "
            f"Consider {best_transit.get('mode', 'transit')} "
            f"({best_transit.get('total_duration_mins')} min) instead of driving."
        )
    elif congestion == "MODERATE":
        rec_str = (
            f"Moderate traffic ({delay} min delay). "
            f"Drive via {drive_desc} (~{drive_mins} min) or take transit."
        )
    else:
        rec_str = (
            f"Traffic is clear. Drive via {drive_desc} "
            f"({drive_dist} km, ~{drive_mins} min)."
        )

    # Add departure suggestion
    dep_rec = departure.get("recommended", {})
    if dep_rec and dep_rec.get("provider"):
        dep_time = dep_rec.get("depart", "")
        rec_str += (
            f" Recommended departure: {dep_time} via {dep_rec['provider']}."
        )

    # ML supplement
    ml_note = ""
    if ml_pred and not ml_pred.get("error"):
        ml_level = ml_pred.get("congestion_level", "")
        if ml_level:
            ml_note = (
                f" ML model predicts {ml_level.lower()} congestion "
                f"for the current road/time conditions."
            )

    explanation_parts = [
        f"Origin: {traffic.get('origin', 'unknown')} → Destination: {traffic.get('destination', 'unknown')}.",
        f"Current congestion: {congestion} (delay: {delay} min).",
    ]
    if drive_mins:
        explanation_parts.append(
            f"Best driving route: {drive_dist} km, ~{drive_mins} min via {drive_desc}."
        )
    if best_transit:
        explanation_parts.append(
            f"Best transit option: {best_transit.get('mode', 'transit')} "
            f"~{best_transit.get('total_duration_mins')} min, "
            f"fare {best_transit.get('fare', 'unknown')}."
        )
    if ml_note:
        explanation_parts.append(ml_note.strip())

    explanation = " ".join(explanation_parts)
    return rec_str, explanation


def _gemini_explanation_prompt(
    origin: str,
    destination: str,
    congestion_level: str,
    delay_mins: float,
    best_route: dict,
    departure_rec: dict,
    ml_pred: Optional[dict],
) -> str:
    return f"""
You are summarising a verified commute plan from "{origin}" to "{destination}".

=== VERIFIED DATA ===
Congestion: {congestion_level} (delay: {delay_mins} min)
Best route: {json.dumps(best_route)}
Departure recommendation: {json.dumps(departure_rec)}
ML prediction: {json.dumps(ml_pred or {})}

TASK: Produce a JSON with these exact keys:
{{
  "overall_recommendation": "<one clear sentence telling the traveller what to do right now>",
  "explanation": "<2-3 sentences summarising the commute plan using only the data above>"
}}

Output only the JSON. No markdown.
""".strip()


# ── Main agent entry point ─────────────────────────────────────────────────────

class SmartRouteAgent:
    """
    Central orchestrator for SmartRoute AI.

    Executes four tools in order:
      1. Traffic monitor (Google Routes API v2)
      2. Route optimizer (Google Routes API v2 + Directions API)
      3. ML predictor (Random Forest on Bengaluru dataset)
      4. Departure planner (deterministic calculation)

    Gemini adds a natural-language explanation layer on top of verified data.
    """

    def plan_commute(
        self,
        origin: str,
        destination: str,
        arrival_time: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Execute the full commute planning pipeline.

        Returns a dict with:
          status, origin, destination, arrival_time,
          traffic, routes, ml_prediction, departure,
          overall_recommendation, explanation,
          data_sources, tool_statuses, gemini_used,
          timestamp, warnings.
        """
        warnings: list[str] = []
        data_sources: list[str] = []
        tool_statuses: dict[str, str] = {
            "traffic_monitor": "not_run",
            "route_optimize": "not_run",
            "ml_predict": "not_run",
            "departure_plan": "not_run",
        }

        # ── STEP 1: Traffic Monitoring ────────────────────────────────────────
        traffic = run_traffic_monitor(origin, destination)
        if "error" in traffic:
            warnings.append(f"Traffic monitor: {traffic['error']}")
            tool_statuses["traffic_monitor"] = "error"
        else:
            tool_statuses["traffic_monitor"] = "ok"
            data_sources.append("google_routes_api_v2_traffic")

        # ── STEP 2: Route Optimization ────────────────────────────────────────
        # Pass traffic data so routes module can use it for context
        routes = run_route_optimize(origin, destination, traffic if "error" not in traffic else {})
        if "error" in routes:
            warnings.append(f"Route optimizer: {routes['error']}")
            tool_statuses["route_optimize"] = "error"
        else:
            tool_statuses["route_optimize"] = "ok"
            for src in routes.get("data_sources", []):
                if src not in data_sources:
                    data_sources.append(src)

        # ── STEP 3: ML Prediction ─────────────────────────────────────────────
        ml_pred = self._run_ml_for_route(traffic, routes)
        if ml_pred and "error" in ml_pred:
            warnings.append(f"ML predictor: {ml_pred['error']}")
            tool_statuses["ml_predict"] = "error"
        elif ml_pred:
            tool_statuses["ml_predict"] = "ok"
            data_sources.append("ml_random_forest_bengaluru_dataset")

        # ── STEP 4: Departure Planning ────────────────────────────────────────
        departure: dict = {}
        if arrival_time:
            # Build route dict for departure planner from routes output
            route_dict = self._build_departure_route_dict(routes, traffic)
            departure = run_departure_plan(origin, destination, arrival_time, route_dict)
            if departure.get("status") == "error":
                warnings.append(f"Departure planner: {departure.get('message', 'unknown error')}")
                tool_statuses["departure_plan"] = "error"
            else:
                tool_statuses["departure_plan"] = "ok"
                data_sources.append("departure_planner")
        else:
            tool_statuses["departure_plan"] = "skipped_no_arrival_time"

        # ── STEP 5: Generate recommendation (deterministic + optional Gemini) ─
        overall_rec, explanation = _build_recommendation(traffic, routes, departure, ml_pred)
        gemini_used = False

        if GEMINI_API_KEY and tool_statuses["route_optimize"] == "ok":
            gemini_prompt = _gemini_explanation_prompt(
                origin=origin,
                destination=destination,
                congestion_level=traffic.get("congestion_level", "UNKNOWN"),
                delay_mins=traffic.get("traffic_delay_mins", 0),
                best_route=routes.get("best_route", {}),
                departure_rec=departure.get("recommended", {}),
                ml_pred=ml_pred,
            )
            gemini_raw = _call_gemini(gemini_prompt)
            if gemini_raw:
                gemini_parsed = _clean_gemini_json(gemini_raw)
                if gemini_parsed:
                    overall_rec = gemini_parsed.get("overall_recommendation", overall_rec)
                    explanation = gemini_parsed.get("explanation", explanation)
                    gemini_used = True
                    data_sources.append("gemini_explanation")
                else:
                    warnings.append("Gemini returned non-JSON. Using deterministic explanation.")
            else:
                warnings.append("Gemini unavailable. Using deterministic explanation.")

        return {
            "status": "ok",
            "origin": origin,
            "destination": destination,
            "arrival_time": arrival_time,
            "traffic": traffic if "error" not in traffic else None,
            "routes": routes if "error" not in routes else None,
            "ml_prediction": ml_pred,
            "departure": departure if departure.get("status") == "ok" else None,
            "overall_recommendation": overall_rec,
            "explanation": explanation,
            "data_sources": data_sources,
            "tool_statuses": tool_statuses,
            "gemini_used": gemini_used,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "warnings": warnings,
        }

    def _run_ml_for_route(
        self,
        traffic: dict,
        routes: dict,
    ) -> Optional[dict[str, Any]]:
        """
        Build ML input from traffic + routes data and run prediction.
        Returns None if insufficient data.
        """
        try:
            best_route = routes.get("best_route", {})
            distance_km = best_route.get("distance_km", 0) or traffic.get("distance_km", 0)
            duration_mins = best_route.get("duration_mins", 0) or traffic.get("current_time_with_traffic_mins", 0)

            if not distance_km or not duration_mins:
                return None

            # Speed (km/h)
            avg_speed = round(distance_km / (duration_mins / 60), 2) if duration_mins > 0 else 30.0

            now = datetime.now()
            hour = now.hour
            dow = now.weekday()  # 0=Mon

            # Determine road_name from route description
            desc = best_route.get("description", "").lower()
            if "mysore" in desc or "chord" in desc:
                road_name = "Mysore Road"
            elif "tumkur" in desc or "tumakuru" in desc:
                road_name = "Tumakuru Road"
            elif "hosur" in desc:
                road_name = "Hosur Road"
            elif "bannerghatta" in desc:
                road_name = "Bannerghatta Road"
            elif "ring road" in desc or "outer ring" in desc:
                road_name = "Outer Ring Road"
            elif "old madras" in desc or "old madrass" in desc:
                road_name = "Old Madras Road"
            elif "bellary" in desc:
                road_name = "Bellary Road"
            elif "airport" in desc:
                road_name = "Airport Road"
            elif "whitefield" in desc:
                road_name = "Whitefield Main Road"
            elif "kanakapura" in desc:
                road_name = "Kanakapura Road"
            elif "electronic city" in desc:
                road_name = "Electronic City Flyover"
            else:
                road_name = "MG Road"

            # Determine area from destination
            dest = routes.get("destination", "").lower()
            if any(k in dest for k in ["electronic city", "hosur", "koramangala", "jayanagar"]):
                area = "South"
            elif any(k in dest for k in ["whitefield", "marathahalli", "indiranagar", "old madras"]):
                area = "East"
            elif any(k in dest for k in ["hebbal", "bellary", "tumkur", "yeshwanthpur"]):
                area = "North"
            elif any(k in dest for k in ["rajajinagar", "vijayanagar", "mysore", "nagarbhavi"]):
                area = "West"
            elif any(k in dest for k in ["it", "manyata", "ecospace", "outer ring"]):
                area = "IT Corridor"
            else:
                area = "Central"

            congestion = traffic.get("congestion_level", "LOW / NORMAL")
            incident_type = "None"
            incidents = traffic.get("incidents_and_roadblocks", {})
            if incidents.get("road_restriction_detected"):
                incident_type = "Road Closure"
            elif incidents.get("incident_likelihood") == "HIGH":
                incident_type = "Accident"

            ml_input = {
                "hour": hour,
                "day_of_week": dow,
                "vehicle_count_per_min": round(max(1.0, 60.0 / max(duration_mins, 1)), 2),
                "avg_speed_kmph": avg_speed,
                "road_occupancy": min(0.95, max(0.1, 1.0 - (avg_speed / 80.0))),
                "road_name": road_name,
                "area": area,
                "vehicle_type": "Car",
                "weather": "Clear",
                "road_condition": "Dry",
                "incident_type": incident_type,
            }

            return run_ml_predict(ml_input)

        except Exception as exc:
            return {"error": f"ML input build failed: {exc}"}

    def _build_departure_route_dict(
        self,
        routes: dict,
        traffic: dict,
    ) -> Optional[dict[str, Any]]:
        """
        Build the route dict accepted by plan_departure() from routes tool output.
        """
        best_route = routes.get("best_route", {})
        if not best_route:
            return None

        congestion = best_route.get("congestion_level") or traffic.get("congestion_level", "LOW / NORMAL")
        traffic_level_map = {
            "LOW": "Low",
            "LOW / NORMAL": "Low",
            "MODERATE": "Medium",
            "HEAVY": "High",
        }
        traffic_level = traffic_level_map.get(congestion.upper() if congestion else "", "Medium")

        return {
            "name": best_route.get("description", "via recommended route"),
            "duration_min": int(best_route.get("duration_mins", 40)),
            "distance_km": float(best_route.get("distance_km", 0)),
            "traffic": traffic_level,
        }
