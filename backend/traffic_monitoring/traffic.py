import json
import requests

API_KEY = "AIzaSyCe2JMyzT13cmMCaIi1RvP-XYvN5wrxglM"
ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"

# Speed thresholds used to flag a segment as an incident anomaly (km/h)
INCIDENT_SPEED_THRESHOLD_KMPH = 10.0   # segment speed at or below this → likely blocked
INCIDENT_DROP_RATIO = 0.35              # segment speed ≤ 35% of route average → sharp anomaly


def _parse_secs(raw) -> float:
    """Strip trailing 's' and return float seconds; fallback to 0.0."""
    try:
        return float(str(raw).rstrip("s")) if raw else 0.0
    except ValueError:
        return 0.0


def _classify_interval_speed(speed_type: str) -> float:
    """
    Map Google's SpeedReadingInterval.Speed enum to an approximate km/h midpoint.
    TRAFFIC_JAM  → ~5 km/h
    SLOW         → ~25 km/h
    NORMAL       → ~70 km/h  (conservative highway estimate)
    """
    mapping = {
        "TRAFFIC_JAM": 5.0,
        "SLOW": 25.0,
        "NORMAL": 70.0,
    }
    return mapping.get(speed_type, 70.0)


def _detect_incidents(travel_advisory: dict, route_avg_speed_kmph: float) -> dict:
    """
    Analyse travelAdvisory to surface:
      • trafficRestriction  – hard road closure / restricted access reported by the API
      • speedReadingIntervals – segments where speed drops to TRAFFIC_JAM or falls
        below INCIDENT_DROP_RATIO of the route average (proxy for accident / roadblock)

    Returns a dict describing the incident analysis.
    """
    incidents = {
        "road_restriction_detected": False,
        "restriction_reason": None,
        "anomalous_segments_detected": False,
        "anomalous_segment_count": 0,
        "slowest_segment_speed_kmph": None,
        "incident_likelihood": "NONE",
        "advisory_note": None,
    }

    if not travel_advisory:
        incidents["advisory_note"] = "No travel advisory data returned by the API."
        return incidents

    # --- Hard traffic restriction (road closure / access restriction) ---
    restriction = travel_advisory.get("trafficRestriction")
    if restriction:
        incidents["road_restriction_detected"] = True
        incidents["restriction_reason"] = restriction.get("restrictionReason", "UNKNOWN")

    # --- Speed reading intervals (per-polyline-segment speed) ---
    intervals = travel_advisory.get("speedReadingIntervals", [])
    if not intervals:
        incidents["advisory_note"] = (
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
            if seg_speed < min_speed:
                min_speed = seg_speed

            is_jam = speed_type == "TRAFFIC_JAM"
            is_anomaly = (
                route_avg_speed_kmph > 0
                and seg_speed <= route_avg_speed_kmph * INCIDENT_DROP_RATIO
                and seg_speed <= INCIDENT_SPEED_THRESHOLD_KMPH
            )
            if is_jam:
                jam_count += 1
            if is_jam or is_anomaly:
                anomaly_count += 1

        incidents["anomalous_segments_detected"] = anomaly_count > 0
        incidents["anomalous_segment_count"] = anomaly_count
        incidents["slowest_segment_speed_kmph"] = (
            round(min_speed, 1) if min_speed != float("inf") else None
        )

        # Likelihood rating
        if incidents["road_restriction_detected"] or jam_count >= 3:
            incidents["incident_likelihood"] = "HIGH"
        elif jam_count >= 1 or anomaly_count >= 2:
            incidents["incident_likelihood"] = "MEDIUM"
        elif anomaly_count >= 1:
            incidents["incident_likelihood"] = "LOW"
        else:
            incidents["incident_likelihood"] = "NONE"

    return incidents


def traffic_monitor_agent_tool(origin: str, destination: str) -> str:
    """
    Callable agent tool that queries the Google Routes API v2 for real-time
    traffic data between origin and destination, including accident /
    roadblock detection via travelAdvisory analysis.

    Returns a JSON string with computed traffic metrics and incident analysis.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": (
            "routes.duration,"
            "routes.staticDuration,"
            "routes.distanceMeters,"
            "routes.description,"
            "routes.travelAdvisory"
        ),
    }

    body = {
        "origin": {"address": origin},
        "destination": {"address": destination},
        "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
        "travelMode": "DRIVE",
        "languageCode": "en-US",
        "units": "METRIC",
        "computeAlternativeRoutes": False,
    }

    try:
        response = requests.post(ROUTES_ENDPOINT, headers=headers, json=body, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.Timeout:
        return json.dumps({"error": "Request timed out. Please try again."}, indent=2)
    except requests.exceptions.ConnectionError:
        return json.dumps({"error": "Network connection error. Check your internet connection."}, indent=2)
    except requests.exceptions.HTTPError as exc:
        return json.dumps({"error": f"API returned HTTP {exc.response.status_code}: {exc.response.text}"}, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Unexpected error: {str(exc)}"}, indent=2)

    routes = data.get("routes")
    if not routes:
        return json.dumps({"error": "No routes found for the given origin and destination.", "raw_response": data}, indent=2)

    route = routes[0]

    # --- Defensive parsing of duration strings (e.g. "1234s") ---
    duration_secs = _parse_secs(route.get("duration", "0s"))
    static_secs   = _parse_secs(route.get("staticDuration", "0s"))

    distance_meters = route.get("distanceMeters", 0)
    description = route.get("description", "")

    # --- Derived metrics ---
    distance_km = round(distance_meters / 1000, 2)
    average_time_to_travel_mins = round(static_secs / 60, 1)
    current_time_with_traffic_mins = round(duration_secs / 60, 1)
    traffic_delay_mins = round(max(0.0, current_time_with_traffic_mins - average_time_to_travel_mins), 1)

    # Speed calculations (guard against zero time)
    if average_time_to_travel_mins > 0:
        average_normal_speed_kmph = round(distance_km / (average_time_to_travel_mins / 60), 2)
    else:
        average_normal_speed_kmph = 0.0

    if current_time_with_traffic_mins > 0:
        current_traffic_speed_kmph = round(distance_km / (current_time_with_traffic_mins / 60), 2)
    else:
        current_traffic_speed_kmph = 0.0

    # --- Congestion classification ---
    time_ratio = (
        current_time_with_traffic_mins / average_time_to_travel_mins
        if average_time_to_travel_mins > 0
        else 1.0
    )

    if time_ratio >= 1.40 or traffic_delay_mins >= 15:
        congestion_level = "HEAVY"
        is_heavy_traffic = True
    elif time_ratio >= 1.15 or traffic_delay_mins >= 5:
        congestion_level = "MODERATE"
        is_heavy_traffic = False
    else:
        congestion_level = "LOW / NORMAL"
        is_heavy_traffic = False

    # --- Accident / Roadblock detection ---
    travel_advisory = route.get("travelAdvisory", {})
    incidents = _detect_incidents(travel_advisory, current_traffic_speed_kmph)

    result = {
        "origin": origin,
        "destination": destination,
        "route_description": description,
        "distance_km": distance_km,
        "average_time_to_travel_mins": average_time_to_travel_mins,
        "current_time_with_traffic_mins": current_time_with_traffic_mins,
        "traffic_delay_mins": traffic_delay_mins,
        "average_normal_speed_kmph": average_normal_speed_kmph,
        "current_traffic_speed_kmph": current_traffic_speed_kmph,
        "congestion_level": congestion_level,
        "is_heavy_traffic": is_heavy_traffic,
        "incidents_and_roadblocks": incidents,
    }

    return json.dumps(result, indent=2)


if __name__ == "__main__":
    origin = input("Enter Origin Location: ")
    destination = input("Enter Destination Location: ")
    output = traffic_monitor_agent_tool(origin, destination)
    print(output)
