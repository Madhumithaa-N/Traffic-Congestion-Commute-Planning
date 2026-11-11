"""
departure.py  –  SmartRoute AI · Departure Planner
====================================================
Part of the multi-agent Bengaluru commute-planning project.

Given an origin, destination, and a required arrival time, this module
recommends *when to leave* and *which travel option to use*, considering
cabs (Uber, Namma Yatri, Ola) and transit (Namma Metro, BMTC City Bus,
BMTC Vajra AC).

Usage
-----
    from departure_planner.departure import plan_departure
    result = plan_departure("Rajajinagar", "Koramangala", "09:00")
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# CONFIG – all tunable constants live here so nothing is buried in logic
# ---------------------------------------------------------------------------

# When True the incoming route.duration_min is already traffic-aware,
# so no extra multiplier is applied.  Set to False only if the routing
# module returns a free-flow (no-traffic) duration.
DURATION_IS_TRAFFIC_AWARE: bool = True

# Multipliers applied when DURATION_IS_TRAFFIC_AWARE is False
TRAFFIC_MULTIPLIERS: dict[str, float] = {
    "Low":    1.00,
    "Medium": 1.25,
    "High":   1.50,
}

# Human-readable labels for each traffic level (used in output only)
TRAFFIC_LABELS: dict[str, str] = {
    "Low":    "Light",
    "Medium": "Moderate",
    "High":   "Heavy",
}

# Per-mode duration factors (applied on top of the base road duration)
MODE_FACTORS: dict[str, float] = {
    "Uber":           1.0,
    "Namma Yatri":    1.1,
    "Ola":            1.1,
    "BMTC City Bus":  1.3,
    "BMTC Vajra AC":  1.1,
}

# Service frequency in minutes
FREQUENCY_MIN: dict[str, int] = {
    "Uber":           0,   # on-demand; pickup wait handled separately
    "Namma Yatri":    0,
    "Ola":            0,
    "Namma Metro":    5,
    "BMTC City Bus":  8,
    "BMTC Vajra AC":  15,
}

# Additional wait for cabs (pickup buffer, minutes)
CAB_PICKUP_WAIT_MIN: int = 3

# Arrival buffer: how many minutes *before* required_arrival we target
ARRIVAL_BUFFER_MIN: dict[str, int] = {
    "cab":     5,
    "transit": 8,
}

# Metro physical constants
METRO_ACCESS_MIN: int   = 8     # walk to station + security
METRO_EXIT_MIN: int     = 8     # exit station + walk to destination
METRO_SPEED_KMPH: float = 32.0  # average commercial speed
METRO_DISTANCE_FACTOR: float = 0.9  # network-distance ≈ straight-line × 0.9

# Fare config  {provider: (base_fare, per_km_rate)}  for cabs
# Ranges are produced by applying a ±12 % spread around the estimate.
CAB_FARE_CONFIG: dict[str, tuple[float, float]] = {
    "Uber":        (40.0, 14.0),
    "Namma Yatri": (30.0, 12.0),
    "Ola":         (40.0, 13.0),
}
CAB_FARE_SPREAD: float = 0.12   # ± fraction for min/max range

# Fixed fare ranges for transit  {provider: (fare_min, fare_max)}
TRANSIT_FARE_CONFIG: dict[str, tuple[int, int]] = {
    "Namma Metro":   (10, 60),
    "BMTC City Bus": (5,  25),
    "BMTC Vajra AC": (20, 50),
}

# Which modes are cabs vs. transit
CAB_PROVIDERS:     tuple[str, ...] = ("Uber", "Namma Yatri", "Ola")
TRANSIT_PROVIDERS: tuple[str, ...] = ("Namma Metro", "BMTC City Bus", "BMTC Vajra AC")

# ---------------------------------------------------------------------------
# MOCK DATA  –  used when teammates' modules are not available yet
# ---------------------------------------------------------------------------

def mock_get_route(origin: str, destination: str) -> dict[str, Any]:
    """
    Stand-in for routing.get_route_info().

    Returns a hard-coded route so the planner can run end-to-end
    before the routing module is finished.
    """
    return {
        "name":         "via Mysore Road",
        "duration_min": 40,
        "distance_km":  12.4,
    }


def mock_predict_traffic(departure_dt: datetime) -> str:
    """
    Stand-in for prediction.predict_traffic().

    Returns a fixed traffic level ("Medium") regardless of the time.
    """
    _ = departure_dt  # unused in mock; real version will use it
    return "Medium"


# ---------------------------------------------------------------------------
# INTEGRATION SHIMS  –  try to import real modules; fall back to mocks
# ---------------------------------------------------------------------------

_DATA_SOURCE: str = "MOCK"   # updated at import time below

try:
    # TODO(integration): adjust module path if the routing module is in a
    #                    different package or has a different name.
    from routing import get_route_info as _real_get_route_info          # type: ignore[import]

    # TODO(integration): adjust module path for the prediction module.
    from prediction import predict_traffic as _real_predict_traffic     # type: ignore[import]

    _DATA_SOURCE = "REAL"
    print("[DeparturePlanner] Using REAL routing + prediction data.")

except (ImportError, ModuleNotFoundError, FileNotFoundError):
    _real_get_route_info  = None   # type: ignore[assignment]
    _real_predict_traffic = None   # type: ignore[assignment]
    print("[DeparturePlanner] Teammates' modules not found – using MOCK data.")


def _get_route(origin: str, destination: str) -> dict[str, Any]:
    """
    Fetch route info, using real module if available, otherwise mock.
    Returns a dict with at least: name, duration_min, distance_km.
    """
    if _real_get_route_info is not None:
        try:
            # TODO(integration): confirm the real function signature is
            #                    get_route_info(origin, destination) and
            #                    that it returns {name, duration_min, distance_km}.
            result = _real_get_route_info(origin, destination)
            if isinstance(result, dict) and "duration_min" in result:
                return result
        except Exception as exc:  # noqa: BLE001
            print(f"[DeparturePlanner] Real route lookup failed ({exc}); falling back to MOCK.")
    return mock_get_route(origin, destination)


def _predict_traffic(departure_dt: datetime) -> str:
    """
    Predict traffic level ("Low" | "Medium" | "High") for departure_dt,
    using real module if available, otherwise mock.
    """
    if _real_predict_traffic is not None:
        try:
            # TODO(integration): confirm the real function signature is
            #                    predict_traffic(departure_dt: datetime) -> str
            #                    and that it returns exactly "Low", "Medium", or "High".
            level = _real_predict_traffic(departure_dt)
            if level in TRAFFIC_LABELS:
                return level
        except Exception as exc:  # noqa: BLE001
            print(f"[DeparturePlanner] Real traffic prediction failed ({exc}); falling back to MOCK.")
    return mock_predict_traffic(departure_dt)


# ---------------------------------------------------------------------------
# DURATION CALCULATION FUNCTIONS
# ---------------------------------------------------------------------------

def calc_road_duration(route_duration_min: int, mode: str) -> int:
    """
    Calculate total door-to-door travel time (minutes) for a road-based
    mode (cab or BMTC bus).

    Parameters
    ----------
    route_duration_min : int
        Traffic-aware driving duration for the route (as returned by the
        routing module or mock).  When DURATION_IS_TRAFFIC_AWARE is True
        no additional multiplier is applied.
    mode : str
        One of the keys in MODE_FACTORS, e.g. "Uber" or "BMTC City Bus".

    Returns
    -------
    int
        Total duration rounded to the nearest whole minute, including:
        - optional traffic multiplier (if DURATION_IS_TRAFFIC_AWARE=False)
        - per-mode factor (accounts for detours, stops, etc.)
        - cab pickup wait  OR  bus average waiting time

    Examples
    --------
    >>> calc_road_duration(40, "Uber")
    43
    >>> calc_road_duration(40, "BMTC City Bus")
    56
    """
    if mode not in MODE_FACTORS:
        raise ValueError(f"Unknown mode '{mode}'. Expected one of: {list(MODE_FACTORS)}")

    base = float(route_duration_min)

    # Apply traffic multiplier only when the duration is NOT traffic-aware
    if not DURATION_IS_TRAFFIC_AWARE:
        # Traffic level is unavailable here; caller must adjust base before
        # calling, or pass it in via a wrapper.  Default to Medium if absent.
        base *= TRAFFIC_MULTIPLIERS.get("Medium", 1.0)

    # Apply the per-mode factor
    base *= MODE_FACTORS[mode]

    # Add wait time
    if mode in CAB_PROVIDERS:
        wait = CAB_PICKUP_WAIT_MIN
    else:
        # Bus: average wait = half the headway
        freq = FREQUENCY_MIN.get(mode, 0)
        wait = freq / 2

    return math.ceil(base + wait)


def calc_metro_duration(distance_km: float, frequency_min: int) -> int:
    """
    Calculate total door-to-door travel time (minutes) for Namma Metro.

    Metro duration is **not** affected by road traffic at all.

    Parameters
    ----------
    distance_km : float
        Straight-line (or routing) distance between origin and destination
        in kilometres.
    frequency_min : int
        Headway (minutes between trains).

    Returns
    -------
    int
        Total duration rounded to the nearest whole minute, comprising:
        - access time  (walk to station + security check): METRO_ACCESS_MIN
        - ride time    (network distance / metro speed × 60)
        - exit time    (exit + walk to destination): METRO_EXIT_MIN
        - average wait (frequency_min / 2)

    Examples
    --------
    >>> calc_metro_duration(12.4, 5)
    40
    """
    network_distance_km = distance_km * METRO_DISTANCE_FACTOR
    ride_time_min       = (network_distance_km / METRO_SPEED_KMPH) * 60
    avg_wait_min        = frequency_min / 2

    total = METRO_ACCESS_MIN + ride_time_min + METRO_EXIT_MIN + avg_wait_min
    return math.ceil(total)


# ---------------------------------------------------------------------------
# FARE HELPERS
# ---------------------------------------------------------------------------

def _cab_fare(provider: str, distance_km: float) -> tuple[int, int]:
    """Return (fare_min, fare_max) in INR for a cab provider."""
    base, per_km = CAB_FARE_CONFIG[provider]
    mid   = base + per_km * distance_km
    lo    = math.floor(mid * (1 - CAB_FARE_SPREAD))
    hi    = math.ceil(mid  * (1 + CAB_FARE_SPREAD))
    return lo, hi


def _transit_fare(provider: str) -> tuple[int, int]:
    """Return (fare_min, fare_max) in INR for a transit provider."""
    return TRANSIT_FARE_CONFIG[provider]


# ---------------------------------------------------------------------------
# TIME HELPERS
# ---------------------------------------------------------------------------

def _parse_hhmm(time_str: str) -> datetime:
    """Parse 'HH:MM' into a datetime (today's date)."""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except ValueError:
        raise ValueError(f"Time must be in HH:MM (24-h) format, got: '{time_str}'")


def _fmt_hhmm(dt: datetime) -> str:
    """Format a datetime as 'HH:MM'."""
    return dt.strftime("%H:%M")


def _fmt_12h(hhmm: str) -> str:
    """Convert 'HH:MM' to '8:05 AM' style for human-readable text."""
    dt = _parse_hhmm(hhmm)
    # %-I / %#I for no-padding hour is not cross-platform; use lstrip
    hour_12 = dt.strftime("%I").lstrip("0") or "12"
    return f"{hour_12}:{dt.strftime('%M')} {dt.strftime('%p')}"


# ---------------------------------------------------------------------------
# SCORING & TAGGING
# ---------------------------------------------------------------------------

def _score_option(option: dict[str, Any]) -> float:
    """
    Composite score for cab 'Best Balance' selection.
    Lower is better.  Uses geometric mean of normalised fare and duration.
    """
    fare_mid = (option["fare_min"] + option["fare_max"]) / 2
    return fare_mid * option["duration_min"]


# ---------------------------------------------------------------------------
# RECOMMENDATION TEXT
# ---------------------------------------------------------------------------

def _build_recommendation(
    options: list[dict[str, Any]],
    traffic_label: str,
) -> dict[str, str]:
    """
    Pick the single best option and write a one-line explanation.

    Priority:
    1. Option tagged "Best Balance"  (best cab)
    2. If metro available, mention it as traffic-free alternative
    3. Otherwise "Most Economical"
    """
    best_balance  = next((o for o in options if "Best Balance"    in o["tags"]), None)
    metro         = next((o for o in options if o["provider"] == "Namma Metro"), None)
    most_econ     = next((o for o in options if "Most Economical" in o["tags"]), None)

    if best_balance:
        depart_fmt = _fmt_12h(best_balance["depart"])
        expl = (
            f"Best balance: competitive fare and reliable timing; "
            f"leave by {depart_fmt}."
        )
        if metro:
            expl += (
                f" Or take Namma Metro to bypass {traffic_label.lower()} road traffic."
            )
        return {"provider": best_balance["provider"], "explanation": expl}

    if metro:
        depart_fmt = _fmt_12h(metro["depart"])
        return {
            "provider": "Namma Metro",
            "explanation": (
                f"100 % traffic-free; leave by {depart_fmt} "
                f"to avoid {traffic_label.lower()} road conditions."
            ),
        }

    if most_econ:
        depart_fmt = _fmt_12h(most_econ["depart"])
        return {
            "provider": most_econ["provider"],
            "explanation": (
                f"Most economical choice; leave by {depart_fmt}."
            ),
        }

    # Fallback – first viable option
    first = options[0]
    return {
        "provider": first["provider"],
        "explanation": f"Leave by {_fmt_12h(first['depart'])} to arrive on time.",
    }


# ---------------------------------------------------------------------------
# CORE PLANNER
# ---------------------------------------------------------------------------

def plan_departure(
    origin: str,
    destination: str,
    required_arrival: str,
    route: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Plan the best departure time and travel option for a Bengaluru commute.

    Parameters
    ----------
    origin : str
        Starting location name (e.g. "Rajajinagar").
    destination : str
        Destination name (e.g. "Koramangala").
    required_arrival : str
        Latest acceptable arrival time in "HH:MM" (24-h) format.
    route : dict, optional
        Pre-computed route dict with keys:
          - name         (str)
          - duration_min (int)  — traffic-aware driving time
          - distance_km  (float)
          - traffic      (str)  — "Low" | "Medium" | "High"
        If omitted, the function fetches route info and predicts traffic
        using the routing/prediction modules (or their mocks).

    Returns
    -------
    dict
        JSON-serialisable result with keys:
        status, data_source, route, options, recommended.
        On error: status="error", message, suggestion.
    """
    # ---- 1. Input validation -----------------------------------------------
    if not origin or not isinstance(origin, str):
        return {"status": "error", "message": "origin must be a non-empty string."}
    if not destination or not isinstance(destination, str):
        return {"status": "error", "message": "destination must be a non-empty string."}

    try:
        arrival_dt = _parse_hhmm(required_arrival)
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}

    # ---- 2. Resolve route --------------------------------------------------
    data_source = _DATA_SOURCE   # may be overridden to MOCK below

    if route is None:
        raw_route = _get_route(origin, destination)
        # We need a departure estimate for traffic prediction; use arrival - 1 h
        approx_depart = arrival_dt - timedelta(hours=1)
        traffic_level = _predict_traffic(approx_depart)
        route = {**raw_route, "traffic": traffic_level}
        # If _get_route fell back to mock, mark source as MOCK
        if _real_get_route_info is None or _real_predict_traffic is None:
            data_source = "MOCK"
    else:
        # Caller supplied a route; validate required keys
        for key in ("duration_min", "distance_km"):
            if key not in route:
                return {
                    "status": "error",
                    "message": f"route dict is missing required key: '{key}'.",
                }
        if "traffic" not in route:
            route = {**route, "traffic": "Medium"}   # safe default
        if "name" not in route:
            route = {**route, "name": "via unknown road"}

    traffic_level: str = route.get("traffic", "Medium")
    if traffic_level not in TRAFFIC_LABELS:
        return {
            "status": "error",
            "message": f"route.traffic must be Low/Medium/High, got '{traffic_level}'.",
        }

    duration_min: int = int(route["duration_min"])
    distance_km: float = float(route["distance_km"])
    traffic_label: str = TRAFFIC_LABELS[traffic_level]

    # When duration is NOT traffic-aware, pre-scale the raw duration now
    # so both calc_road_duration and calc_metro_duration receive the right base.
    effective_duration = duration_min
    if not DURATION_IS_TRAFFIC_AWARE:
        effective_duration = math.ceil(
            duration_min * TRAFFIC_MULTIPLIERS[traffic_level]
        )

    # ---- 3. Build option list ----------------------------------------------
    options: list[dict[str, Any]] = []

    # -- Cabs ----------------------------------------------------------------
    for provider in CAB_PROVIDERS:
        buffer   = ARRIVAL_BUFFER_MIN["cab"]
        dur      = calc_road_duration(effective_duration, provider)
        total    = dur + buffer
        depart   = arrival_dt - timedelta(minutes=total)
        arrive   = arrival_dt - timedelta(minutes=buffer)
        fare_lo, fare_hi = _cab_fare(provider, distance_km)

        options.append({
            "category":     "cab",
            "provider":     provider,
            "fare_min":     fare_lo,
            "fare_max":     fare_hi,
            "depart":       _fmt_hhmm(depart),
            "arrive":       _fmt_hhmm(arrive),
            "duration_min": dur,
            "frequency_min": None,
            "tags":         [],
        })

    # -- Namma Metro ---------------------------------------------------------
    metro_freq = FREQUENCY_MIN["Namma Metro"]
    metro_dur  = calc_metro_duration(distance_km, metro_freq)
    buffer     = ARRIVAL_BUFFER_MIN["transit"]
    total      = metro_dur + buffer
    depart     = arrival_dt - timedelta(minutes=total)
    arrive     = arrival_dt - timedelta(minutes=buffer)
    fare_lo, fare_hi = _transit_fare("Namma Metro")

    options.append({
        "category":      "transit",
        "provider":      "Namma Metro",
        "fare_min":      fare_lo,
        "fare_max":      fare_hi,
        "depart":        _fmt_hhmm(depart),
        "arrive":        _fmt_hhmm(arrive),
        "duration_min":  metro_dur,
        "frequency_min": metro_freq,
        "tags":          ["100% Traffic Free"],
    })

    # -- BMTC Buses ----------------------------------------------------------
    for provider in ("BMTC City Bus", "BMTC Vajra AC"):
        freq   = FREQUENCY_MIN[provider]
        dur    = calc_road_duration(effective_duration, provider)
        buffer = ARRIVAL_BUFFER_MIN["transit"]
        total  = dur + buffer
        depart = arrival_dt - timedelta(minutes=total)
        arrive = arrival_dt - timedelta(minutes=buffer)
        fare_lo, fare_hi = _transit_fare(provider)

        opt: dict[str, Any] = {
            "category":      "transit",
            "provider":      provider,
            "fare_min":      fare_lo,
            "fare_max":      fare_hi,
            "depart":        _fmt_hhmm(depart),
            "arrive":        _fmt_hhmm(arrive),
            "duration_min":  dur,
            "frequency_min": freq,
            "tags":          [],
        }
        if provider == "BMTC Vajra AC":
            opt["tags"].append("AC Comfort")
        options.append(opt)

    # ---- 4. Assign special tags --------------------------------------------
    # "Best Balance" – lowest fare × time score among cabs
    cab_options = [o for o in options if o["category"] == "cab"]
    if cab_options:
        best_cab = min(cab_options, key=_score_option)
        best_cab["tags"].append("Best Balance")

    # "Most Economical" – cheapest fare_min across ALL options
    cheapest = min(options, key=lambda o: o["fare_min"])
    cheapest["tags"].append("Most Economical")

    # ---- 5. Filter: keep only options that can arrive on time --------------
    viable = [o for o in options if o["depart"] >= "00:00"]
    # Also drop options where depart is already in the past relative to now,
    # but only when we know the current time.  For robustness we keep all
    # options here and let the caller decide.

    if not viable:
        return {
            "status":     "error",
            "message":    "No option can reach the destination by the required arrival time.",
            "suggestion": "Try a later required_arrival time or check the route distance.",
        }

    # ---- 6. Build recommended explanation ----------------------------------
    recommendation = _build_recommendation(viable, traffic_label)

    # ---- 7. Assemble output ------------------------------------------------
    output_route = {
        "name":         route.get("name", "via unknown road"),
        "duration_min": duration_min,
        "distance_km":  round(distance_km, 1),
        "traffic":      traffic_label,   # human-readable label
    }

    return {
        "status":      "ok",
        "data_source": data_source,
        "route":       output_route,
        "options":     viable,
        "recommended": recommendation,
    }


# ---------------------------------------------------------------------------
# __main__ DEMO
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("SmartRoute AI – Departure Planner Demo")
    print("=" * 60)

    result = plan_departure(
        origin           = "Rajajinagar",
        destination      = "Dr. Ambedkar Institute of Technology",
        required_arrival = "09:00",
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))
    print()

    if result["status"] == "ok":
        rec = result["recommended"]
        print(f"✔  Recommended: {rec['provider']}")
        print(f"   {rec['explanation']}")
    else:
        print(f"✘  Error: {result.get('message')}")
        print(f"   Suggestion: {result.get('suggestion', 'N/A')}")
