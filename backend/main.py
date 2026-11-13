"""
main.py – SmartRoute AI FastAPI Application

Endpoints:
  POST /api/commute/plan       – Main unified agent recommendation
  POST /api/routes/optimize    – Route alternatives
  POST /api/traffic/monitor    – Current traffic information
  POST /api/traffic/predict    – ML traffic prediction
  POST /api/departure/plan     – Departure recommendation
  GET  /health                 – Backend health status
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Path bootstrap so all modules are importable ───────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_BACKEND_DIR))

from config.settings import (  # noqa: E402
    GOOGLE_MAPS_API_KEY,
    GEMINI_API_KEY,
    CORS_ORIGINS,
    BACKEND_HOST,
    BACKEND_PORT,
)
from schemas import (  # noqa: E402
    CommutePlanRequest,
    RouteOptimizeRequest,
    TrafficMonitorRequest,
    TrafficPredictRequest,
    DeparturePlanRequest,
    CommutePlanResponse,
    GenericResponse,
    HealthResponse,
    ToolStatus,
)
from tools import (  # noqa: E402
    run_traffic_monitor,
    run_route_optimize,
    run_ml_predict,
    run_departure_plan,
    is_model_available,
)
from agent import SmartRouteAgent  # noqa: E402
from services.metro_finder import find_nearby_stations  # noqa: E402
from traffic_monitoring.hotspots import get_traffic_hotspots  # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("smartroute")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="SmartRoute AI – Bengaluru Commute Planner",
    description=(
        "AI-powered traffic congestion and commute planning for Bengaluru. "
        "Combines Google Maps real-time data, ML predictions, and Gemini AI "
        "for intelligent route recommendations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# CORS_ORIGINS is read from the environment (set in .env or Render Dashboard).
# Production Vercel frontend: https://traffic-congestion-commute-planning.vercel.app
#
# If CORS_ORIGINS contains "*" as one of its values, or is empty, wildcard mode
# is used. If specific origins are listed, the production Vercel URL is always
# appended to ensure the deployed frontend can always reach the backend.
# allow_credentials must be False when allow_origins includes "*".
_cors_origins = [o.strip() for o in CORS_ORIGINS if o.strip()]
_use_wildcard = not _cors_origins or "*" in _cors_origins

# Known production frontend origins — always allowed regardless of env var
_production_origins = [
    "https://traffic-congestion-commute-planning.vercel.app",
    "https://smartroute-frontend.onrender.com",
]

if _use_wildcard:
    _final_origins: list[str] = ["*"]
    _allow_credentials = False
else:
    _final_origins = list(set(_cors_origins + _production_origins))
    _allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_final_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin"],
    expose_headers=["*"],
    max_age=600,
)

# ── Singleton agent ───────────────────────────────────────────────────────────
_agent = SmartRouteAgent()


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": "Internal server error. Please try again.",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Returns the health status of all backend components."""
    return HealthResponse(
        status="ok",
        google_maps_configured=bool(GOOGLE_MAPS_API_KEY),
        gemini_configured=bool(GEMINI_API_KEY),
        ml_model_available=is_model_available(),
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


# ─────────────────────────────────────────────────────────────────────────────
# MAIN COMMUTE PLAN  (uses SmartRouteAgent)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/commute/plan", response_model=CommutePlanResponse, tags=["Commute"])
async def plan_commute(body: CommutePlanRequest) -> CommutePlanResponse:
    """
    Main unified commute recommendation.

    Orchestrates all four tools through the SmartRouteAgent:
    traffic monitoring → route optimization → ML prediction → departure planning.
    Returns a comprehensive commute plan with Gemini-enhanced explanations.
    """
    logger.info(
        "plan_commute  origin=%r  dest=%r  arrival=%r",
        body.origin, body.destination, body.arrival_time,
    )

    result = _agent.plan_commute(
        origin=body.origin,
        destination=body.destination,
        arrival_time=body.arrival_time,
    )

    return CommutePlanResponse(
        status=result.get("status", "ok"),
        origin=result.get("origin", body.origin),
        destination=result.get("destination", body.destination),
        arrival_time=result.get("arrival_time"),
        traffic=result.get("traffic"),
        routes=result.get("routes"),
        ml_prediction=result.get("ml_prediction"),
        departure=result.get("departure"),
        overall_recommendation=result.get("overall_recommendation", ""),
        explanation=result.get("explanation", ""),
        data_sources=result.get("data_sources", []),
        tool_statuses=ToolStatus(**result.get("tool_statuses", {})),
        gemini_used=result.get("gemini_used", False),
        timestamp=result.get("timestamp", datetime.utcnow().isoformat() + "Z"),
        warnings=result.get("warnings", []),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ROUTE OPTIMIZATION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/routes/optimize", response_model=GenericResponse, tags=["Routes"])
async def optimize_routes(body: RouteOptimizeRequest) -> GenericResponse:
    """
    Fetch driving route alternatives and transit options.

    Calls the Google Routes API v2 (driving) and Directions API (transit).
    Optionally accepts pre-fetched traffic data to enhance recommendations.
    """
    logger.info("optimize_routes  origin=%r  dest=%r", body.origin, body.destination)

    result = run_route_optimize(body.origin, body.destination, body.traffic_data)

    if "error" in result:
        return GenericResponse(
            status="error",
            error=result["error"],
            data_sources=[result.get("data_source", "unknown")],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    return GenericResponse(
        status="ok",
        data=result,
        data_sources=result.get("data_sources", []),
        timestamp=datetime.utcnow().isoformat() + "Z",
        warnings=result.get("warnings", []),
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRAFFIC MONITORING
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/traffic/monitor", response_model=GenericResponse, tags=["Traffic"])
async def monitor_traffic(body: TrafficMonitorRequest) -> GenericResponse:
    """
    Fetch real-time traffic conditions via Google Routes API v2.

    Returns congestion level, traffic delay, speed metrics and
    incident / roadblock detection for the given route.
    """
    logger.info("monitor_traffic  origin=%r  dest=%r", body.origin, body.destination)

    result = run_traffic_monitor(body.origin, body.destination)

    if "error" in result:
        return GenericResponse(
            status="error",
            error=result["error"],
            data_sources=[result.get("data_source", "google_routes_api_v2")],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    return GenericResponse(
        status="ok",
        data=result,
        data_sources=[result.get("data_source", "google_routes_api_v2")],
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


# ─────────────────────────────────────────────────────────────────────────────
# ML TRAFFIC PREDICTION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/traffic/predict", response_model=GenericResponse, tags=["Traffic"])
async def predict_traffic(body: TrafficPredictRequest) -> GenericResponse:
    """
    ML-based congestion prediction using the Random Forest model
    trained on Bengaluru road traffic dataset (4,354 records).

    Returns congestion_level (LOW | MEDIUM | HIGH), per-class probabilities,
    and a human-readable description.
    """
    logger.info("predict_traffic  hour=%d  dow=%d  road=%r", body.hour, body.day_of_week, body.road_name)

    result = run_ml_predict(body.model_dump())

    if "error" in result:
        return GenericResponse(
            status="error",
            error=result["error"],
            data_sources=["ml_random_forest"],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    return GenericResponse(
        status="ok",
        data=result,
        data_sources=[result.get("data_source", "ml_random_forest_bengaluru_dataset")],
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


# ─────────────────────────────────────────────────────────────────────────────
# DEPARTURE PLANNING
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/departure/plan", response_model=GenericResponse, tags=["Departure"])
async def plan_departure(body: DeparturePlanRequest) -> GenericResponse:
    """
    Recommend when to depart to arrive on time.

    Calculates optimal departure times for cabs (Uber, Namma Yatri, Ola)
    and public transit (Namma Metro, BMTC, BMTC Vajra AC) given the
    required arrival time and traffic conditions.
    """
    logger.info(
        "plan_departure  origin=%r  dest=%r  arrival=%r",
        body.origin, body.destination, body.required_arrival,
    )

    result = run_departure_plan(
        origin=body.origin,
        destination=body.destination,
        required_arrival=body.required_arrival,
        route=body.route,
    )

    if result.get("status") == "error":
        return GenericResponse(
            status="error",
            error=result.get("message", "Departure planning failed"),
            data_sources=["departure_planner"],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    return GenericResponse(
        status="ok",
        data=result,
        data_sources=["departure_planner"],
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


# ─────────────────────────────────────────────────────────────────────────────
# NEARBY METRO STATIONS
# ─────────────────────────────────────────────────────────────────────────────

class _MetroReq(BaseModel):
    address: str
    max_results: int = 3


@app.post("/api/metro/nearby", response_model=GenericResponse, tags=["Metro"])
async def nearby_metro(body: _MetroReq) -> GenericResponse:
    """
    Find the nearest Namma Metro stations to a given Bengaluru address.
    Uses Google Geocoding API for coordinates + haversine distance calculation.
    Returns walking distance estimates (labelled as estimates), feeder options, and line info.
    """
    logger.info("nearby_metro  address=%r", body.address)
    result = find_nearby_stations(body.address, max_results=body.max_results)
    return GenericResponse(
        status="ok",
        data=result,
        data_sources=[result.get("data_source", "namma_metro_station_data")],
        timestamp=datetime.utcnow().isoformat() + "Z",
        warnings=["Walking times are estimates based on straight-line distance × 1.3 detour factor."]
            if not result.get("error") else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# TRAFFIC HOTSPOTS
# ─────────────────────────────────────────────────────────────────────────────

class _HotspotsReq(BaseModel):
    top_n: int = 5


@app.post("/api/traffic/hotspots", response_model=GenericResponse, tags=["Traffic"])
async def traffic_hotspots(body: _HotspotsReq) -> GenericResponse:
    """
    Return the top-N most congested Bengaluru corridors right now.

    Queries the Google Routes API for a fixed set of monitored corridors
    (Silk Board, Marathahalli, KR Puram, Hebbal, Electronic City, etc.)
    and ranks them by live traffic delay.

    Responses are cached for TRAFFIC_CACHE_TTL seconds to avoid hammering
    the API on every dashboard refresh.
    """
    logger.info("traffic_hotspots  top_n=%d", body.top_n)
    result = get_traffic_hotspots(top_n=body.top_n)

    if result.get("status") == "error":
        return GenericResponse(
            status="error",
            error=result.get("error", "Hotspot data unavailable"),
            data_sources=["google_routes_api_v2"],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    return GenericResponse(
        status="ok",
        data=result,
        data_sources=[result.get("data_source", "google_routes_api_v2")],
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


# Also expose as GET for simple browser/curl access
@app.get("/api/traffic/hotspots", response_model=GenericResponse, tags=["Traffic"])
async def traffic_hotspots_get() -> GenericResponse:
    """GET version of the hotspots endpoint (returns top 5)."""
    return await traffic_hotspots(_HotspotsReq(top_n=5))


# ─────────────────────────────────────────────────────────────────────────────
# Entry point for direct execution (development)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    logger.info("Starting SmartRoute AI backend on %s:%d", BACKEND_HOST, BACKEND_PORT)
    uvicorn.run(
        "main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=True,
        log_level="info",
    )
