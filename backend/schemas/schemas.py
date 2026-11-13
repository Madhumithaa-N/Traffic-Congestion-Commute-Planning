"""
schemas.py – Pydantic request / response models for SmartRoute AI FastAPI endpoints.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Shared request bases
# ─────────────────────────────────────────────────────────────────────────────

class OriginDestRequest(BaseModel):
    origin: str = Field(..., min_length=2, max_length=300, description="Starting location address")
    destination: str = Field(..., min_length=2, max_length=300, description="Destination address")


class CommutePlanRequest(OriginDestRequest):
    arrival_time: Optional[str] = Field(
        None,
        description="Required arrival time in HH:MM (24h) or 'H:MM AM/PM' format",
        examples=["09:00", "8:30 AM"],
    )

    @field_validator("arrival_time")
    @classmethod
    def validate_arrival_time(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        return v


class RouteOptimizeRequest(OriginDestRequest):
    traffic_data: Optional[dict[str, Any]] = Field(
        None,
        description="Pre-fetched traffic monitoring dict (optional; fetched automatically if omitted)",
    )


class TrafficMonitorRequest(OriginDestRequest):
    pass


class TrafficPredictRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")
    vehicle_count_per_min: float = Field(..., ge=0, description="Vehicles per minute")
    avg_speed_kmph: float = Field(..., ge=0, description="Average speed km/h")
    road_occupancy: float = Field(..., ge=0, le=1, description="Road occupancy (0-1)")
    road_name: str = Field(..., description="Road name from dataset")
    area: str = Field(..., description="Area category")
    vehicle_type: str = Field(..., description="Vehicle type")
    weather: str = Field(..., description="Weather condition")
    road_condition: str = Field(..., description="Road condition")
    incident_type: str = Field(..., description="Incident type")


class DeparturePlanRequest(OriginDestRequest):
    required_arrival: str = Field(
        ...,
        description="Required arrival time in HH:MM (24h) or 'H:MM AM/PM' format",
        examples=["09:00", "8:30 AM"],
    )
    route: Optional[dict[str, Any]] = Field(
        None,
        description="Pre-computed route dict with keys: name, duration_min, distance_km, traffic",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Response envelopes
# ─────────────────────────────────────────────────────────────────────────────

class ToolStatus(BaseModel):
    traffic_monitor: str = "not_run"
    route_optimize: str = "not_run"
    ml_predict: str = "not_run"
    departure_plan: str = "not_run"


class CommutePlanResponse(BaseModel):
    status: str
    origin: str
    destination: str
    arrival_time: Optional[str] = None
    traffic: Optional[dict[str, Any]] = None
    routes: Optional[dict[str, Any]] = None
    ml_prediction: Optional[dict[str, Any]] = None
    departure: Optional[dict[str, Any]] = None
    overall_recommendation: str = ""
    explanation: str = ""
    data_sources: list[str] = Field(default_factory=list)
    tool_statuses: ToolStatus = Field(default_factory=ToolStatus)
    gemini_used: bool = False
    timestamp: str = ""
    warnings: list[str] = Field(default_factory=list)


class GenericResponse(BaseModel):
    status: str
    data: Optional[dict[str, Any]] = None
    data_sources: list[str] = Field(default_factory=list)
    timestamp: str = ""
    warnings: list[str] = Field(default_factory=list)
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    google_maps_configured: bool
    gemini_configured: bool
    ml_model_available: bool
    timestamp: str = ""
