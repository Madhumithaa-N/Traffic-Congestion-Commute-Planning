"""
Route Optimisation & Multimodal Recommendation package.
Public API: optimize_routes(origin, destination, traffic_data) -> dict
"""
from .routes import optimize_routes

__all__ = ["optimize_routes"]
