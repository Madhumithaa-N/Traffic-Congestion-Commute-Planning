#!/usr/bin/env python3
"""
setup_env.py – One-time setup: creates backend/.env from provided keys.
Run from repo root: python setup_env.py
"""
import os
from pathlib import Path

env_path = Path(__file__).parent / "Traffic-Congestion-Commute-Planning" / "backend" / ".env"

content = """GOOGLE_MAPS_API_KEY=AIzaSyCe2JMyzT13cmMCaIi1RvP-XYvN5wrxglM
GEMINI_API_KEY=AIzaSyAb8RN6KILDa9RiQf6z7vPtpOZlefqC7zkdQxoswoqIKZmzs0RQ
GEMINI_MODEL=gemini-2.0-flash
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
REQUEST_TIMEOUT=20
TRAFFIC_CACHE_TTL=60
"""

env_path.write_text(content)
print(f"[OK] Created {env_path}")
print("    Backend .env file is ready. Keep it secret – never commit it.")
