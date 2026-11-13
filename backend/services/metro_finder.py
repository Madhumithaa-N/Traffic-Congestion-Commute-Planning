"""
services/metro_finder.py
Find Namma Metro stations near a given address using Google Places API.
Returns closest stations with walking distance and feeder options.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

import requests
from config.settings import GOOGLE_MAPS_API_KEY, REQUEST_TIMEOUT

# ── Known Namma Metro stations (Purple + Green Line) ─────────────────────────
METRO_STATIONS = [
    # Purple Line (East-West)
    {"name": "Baiyappanahalli",    "lat": 12.9887, "lng": 77.6488, "line": "Purple"},
    {"name": "Swami Vivekananda Road", "lat": 12.9551, "lng": 77.6510, "line": "Purple"},
    {"name": "Indiranagar",        "lat": 12.9782, "lng": 77.6408, "line": "Purple"},
    {"name": "Halasuru",           "lat": 12.9822, "lng": 77.6249, "line": "Purple"},
    {"name": "Trinity",            "lat": 12.9696, "lng": 77.6101, "line": "Purple"},
    {"name": "MG Road",            "lat": 12.9752, "lng": 77.6094, "line": "Purple"},
    {"name": "Cubbon Park",        "lat": 12.9762, "lng": 77.5942, "line": "Purple"},
    {"name": "Vidhana Soudha",     "lat": 12.9796, "lng": 77.5918, "line": "Purple"},
    {"name": "Sir M Visvesvaraya", "lat": 12.9799, "lng": 77.5779, "line": "Purple"},
    {"name": "Majestic",           "lat": 12.9756, "lng": 77.5728, "line": "Purple/Green"},
    {"name": "City Railway Station","lat": 12.9783, "lng": 77.5715, "line": "Purple/Green"},
    {"name": "Magadi Road",        "lat": 12.9871, "lng": 77.5634, "line": "Purple"},
    {"name": "Hosahalli",          "lat": 12.9916, "lng": 77.5576, "line": "Purple"},
    {"name": "Vijayanagar",        "lat": 12.9744, "lng": 77.5463, "line": "Purple"},
    {"name": "Attiguppe",          "lat": 12.9693, "lng": 77.5397, "line": "Purple"},
    {"name": "Deepanjali Nagar",   "lat": 12.9646, "lng": 77.5331, "line": "Purple"},
    {"name": "Mysuru Road",        "lat": 12.9606, "lng": 77.5246, "line": "Purple"},
    # Green Line (North-South)
    {"name": "Nagasandra",         "lat": 13.0358, "lng": 77.5148, "line": "Green"},
    {"name": "Dasarahalli",        "lat": 13.0248, "lng": 77.5286, "line": "Green"},
    {"name": "Jalahalli",          "lat": 13.0155, "lng": 77.5400, "line": "Green"},
    {"name": "Peenya Industry",    "lat": 13.0085, "lng": 77.5400, "line": "Green"},
    {"name": "Peenya",             "lat": 12.9993, "lng": 77.5297, "line": "Green"},
    {"name": "Goraguntepalya",     "lat": 12.9983, "lng": 77.5400, "line": "Green"},
    {"name": "Yeshwanthpur",       "lat": 13.0181, "lng": 77.5547, "line": "Green"},
    {"name": "Sandal Soap Factory","lat": 13.0052, "lng": 77.5590, "line": "Green"},
    {"name": "Mahalakshmi",        "lat": 12.9982, "lng": 77.5530, "line": "Green"},
    {"name": "Rajajinagar",        "lat": 12.9876, "lng": 77.5530, "line": "Green"},
    {"name": "Mahakavi Kuvempu Road","lat": 12.9827, "lng": 77.5670, "line": "Green"},
    {"name": "Srirampura",         "lat": 12.9812, "lng": 77.5720, "line": "Green"},
    {"name": "Sampige Road",       "lat": 12.9782, "lng": 77.5728, "line": "Green"},
    {"name": "Chickpete",          "lat": 12.9634, "lng": 77.5764, "line": "Green"},
    {"name": "KR Market",          "lat": 12.9631, "lng": 77.5782, "line": "Green"},
    {"name": "National College",   "lat": 12.9569, "lng": 77.5808, "line": "Green"},
    {"name": "Lalbagh",            "lat": 12.9499, "lng": 77.5845, "line": "Green"},
    {"name": "South End Circle",   "lat": 12.9449, "lng": 77.5869, "line": "Green"},
    {"name": "Jayanagar",          "lat": 12.9385, "lng": 77.5829, "line": "Green"},
    {"name": "Rashtreeya Vidyalaya Road", "lat": 12.9313, "lng": 77.5793, "line": "Green"},
    {"name": "Banashankari",       "lat": 12.9259, "lng": 77.5757, "line": "Green"},
    {"name": "JP Nagar",           "lat": 12.9124, "lng": 77.5852, "line": "Green"},
    {"name": "Yelachenahalli",     "lat": 12.8944, "lng": 77.5924, "line": "Green"},
]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate straight-line distance in km between two GPS points."""
    import math
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLng/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _geocode_address(address: str) -> tuple[float, float] | None:
    """Geocode an address using Google Geocoding API. Returns (lat, lng) or None."""
    if not GOOGLE_MAPS_API_KEY:
        return None
    try:
        r = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address + ", Bengaluru, India", "key": GOOGLE_MAPS_API_KEY},
            timeout=REQUEST_TIMEOUT,
        )
        data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
    except Exception:
        pass
    return None


def _walking_distance(origin_lat: float, origin_lng: float, station: dict) -> int:
    """
    Estimate walking time in minutes from origin to station.
    Uses straight-line distance × 1.3 detour factor at 4.5 km/h walking speed.
    Returns minutes.
    """
    dist_km = _haversine_km(origin_lat, origin_lng, station["lat"], station["lng"])
    # 1.3 detour factor for actual road vs straight line
    road_dist_km = dist_km * 1.3
    walk_speed_kmh = 4.5
    return max(1, round(road_dist_km / walk_speed_kmh * 60))


def find_nearby_stations(
    address: str,
    max_results: int = 3,
    max_walking_km: float = 3.0,
) -> dict[str, Any]:
    """
    Find the nearest Namma Metro stations to a given address.

    Parameters
    ----------
    address      : Address string to search near
    max_results  : Number of stations to return (default 3)
    max_walking_km: Maximum straight-line radius (km) to consider

    Returns
    -------
    dict with:
        address, stations (list of station dicts), data_source, error (if any)
    """
    coords = _geocode_address(address)
    if not coords:
        # Fallback: return the 3 central stations as they connect most routes
        fallback = [
            {
                "name": "Majestic",
                "line": "Purple/Green (Interchange)",
                "walking_mins": "~15-20",
                "distance_km": "estimated",
                "feeder": "Auto / BMTC from origin",
                "is_estimate": True,
            },
            {
                "name": "MG Road",
                "line": "Purple Line",
                "walking_mins": "~10-15",
                "distance_km": "estimated",
                "feeder": "Auto / Cab from origin",
                "is_estimate": True,
            },
        ]
        return {
            "address": address,
            "stations": fallback,
            "data_source": "static_estimate",
            "error": "Could not geocode address – showing central stations as reference",
        }

    lat, lng = coords

    # Score all stations by straight-line distance
    candidates = []
    for station in METRO_STATIONS:
        dist_km = _haversine_km(lat, lng, station["lat"], station["lng"])
        if dist_km <= max_walking_km:
            walk_mins = _walking_distance(lat, lng, station)
            feeder = "Walking" if dist_km <= 0.6 else ("Auto-rickshaw (~5 min)" if dist_km <= 1.5 else "Cab/Bus (~10 min)")
            candidates.append({
                "name": station["name"],
                "line": f"{station['line']} Line",
                "walking_mins": walk_mins,
                "distance_km": round(dist_km, 2),
                "feeder": feeder,
                "is_estimate": True,  # Walking time is always an estimate
                "lat": station["lat"],
                "lng": station["lng"],
            })

    candidates.sort(key=lambda s: s["distance_km"])
    top = candidates[:max_results]

    return {
        "address": address,
        "lat": lat,
        "lng": lng,
        "stations": top,
        "data_source": "google_geocoding_api + namma_metro_station_data",
    }
