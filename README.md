<<<<<<< HEAD
# SmartRoute AI – Bengaluru Traffic Congestion & Commute Planner

Full-stack AI application with **ONE SmartRouteAgent + FOUR Python Tools + ONE FastAPI Backend + ONE React Frontend**.

---

## Architecture

```
React Frontend (Vite + TypeScript)
        │  POST /api/commute/plan
        │  POST /api/routes/optimize
        │  POST /api/traffic/monitor
        │  POST /api/traffic/predict
        │  POST /api/departure/plan
        │  GET  /health
        ▼
FastAPI Backend  (backend/main.py)
        │
        ▼
SmartRouteAgent  (backend/agent/smart_route_agent.py)
  ├── Tool 1: TrafficMonitor   → traffic_monitoring/traffic.py  (Google Routes API v2)
  ├── Tool 2: RouteOptimizer   → route_optimisation/routes.py   (Google Routes API v2 + Directions API)
  ├── Tool 3: MLPredictor      → ml_model/prediction.py         (Random Forest, 4,354-record dataset)
  └── Tool 4: DeparturePlanner → departure_planner/departure.py (Deterministic calculation)
                   │
                   └── Gemini AI (optional: natural-language explanation only)
```

---

## Quick Start

### 1. Set up API keys

```bash
python setup_env.py
```

This creates `Traffic-Congestion-Commute-Planning/backend/.env` with the Google Maps and Gemini API keys.

### 2. Install backend dependencies

```bash
cd Traffic-Congestion-Commute-Planning/backend
pip install -r requirements.txt
```

### 3. Start the backend

```bash
# From repo root:
python start.py

# Or directly:
cd Traffic-Congestion-Commute-Planning/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend API: http://localhost:8000  
API Docs: http://localhost:8000/docs  
Health: http://localhost:8000/health

### 4. Install and start the frontend

```bash
cd Traffic-Congestion-Commute-Planning/Frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend: http://localhost:5173

---

## Environment Variables

### Backend: `Traffic-Congestion-Commute-Planning/backend/.env`

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps Platform key (server-side, unrestricted or IP-restricted) |
| `GEMINI_API_KEY` | Optional | Gemini API key for AI explanations (deterministic fallback if absent) |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-2.0-flash` |
| `BACKEND_PORT` | Optional | Defaults to `8000` |
| `CORS_ORIGINS` | Optional | Comma-separated allowed origins |

### Frontend: `Traffic-Congestion-Commute-Planning/Frontend/.env.local`

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JS API key (HTTP referrer restricted) |
| `VITE_API_BASE_URL` | Optional | Backend URL, defaults to `http://localhost:8000` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health status of all backend components |
| `POST` | `/api/commute/plan` | **Main:** SmartRouteAgent full commute recommendation |
| `POST` | `/api/routes/optimize` | Route alternatives (Google Routes API v2) |
| `POST` | `/api/traffic/monitor` | Real-time traffic (Google Routes API v2) |
| `POST` | `/api/traffic/predict` | ML congestion prediction (Random Forest) |
| `POST` | `/api/departure/plan` | When to depart (cabs + transit options) |

Interactive docs at http://localhost:8000/docs

---

## Created & Modified Files

### New backend files
```
backend/
  main.py                           ← FastAPI application (6 endpoints)
  requirements.txt                  ← Python dependencies
  .env.example                      ← Environment template

  config/
    __init__.py
    settings.py                     ← Centralised env-based config

  schemas/
    __init__.py
    schemas.py                      ← Pydantic request/response models

  tools/
    __init__.py
    traffic_tool.py                 ← Adapter: traffic_monitoring/traffic.py
    routes_tool.py                  ← Adapter: route_optimisation/routes.py
    ml_tool.py                      ← Adapter: ml_model/prediction.py
    departure_tool.py               ← Adapter: departure_planner/departure.py

  agent/
    __init__.py
    smart_route_agent.py            ← ONE SmartRouteAgent (Gemini + 4 tools)
```

### Modified frontend files
```
Frontend/src/
  App.tsx                           ← Wired to real backend API
  services/api.ts                   ← New: typed API client module
  .env.example                      ← Updated with VITE_API_BASE_URL
```

### Root utility files
```
setup_env.py                        ← Creates backend .env from keys
start.py                            ← Starts backend server
test_e2e.py                         ← End-to-end test suite (15 tests)
```

### Existing modules (NOT modified)
```
backend/traffic_monitoring/traffic.py     ← Preserved as-is
backend/route_optimisation/routes.py      ← Preserved as-is
backend/ml_model/prediction.py            ← Preserved as-is
backend/departure_planner/departure.py    ← Preserved as-is
```

---

## Test Results

```
=== PHASE 9: End-to-End Test Suite ===
  [PASS] GET /health
  [PASS] POST /api/traffic/monitor
  [PASS] POST /api/routes/optimize
  [PASS] POST /api/traffic/predict
  [PASS] POST /api/departure/plan
  [PASS] POST /api/commute/plan - all tools ok
  [PASS] POST /api/commute/plan - traffic present
  [PASS] POST /api/commute/plan - routes present
  [PASS] POST /api/commute/plan - ML present
  [PASS] POST /api/commute/plan - departure present
  [PASS] POST /api/commute/plan - recommendation
  [PASS] Empty origin returns 422
  [PASS] Invalid time returns error status
  [PASS] Frontend dev server
  [PASS] CORS allows frontend origin

=== RESULTS: 15 passed, 0 failed out of 15 tests ===
```

---

## Known Limitations & Manual Configuration

1. **Gemini API key**: The key provided (`AQ.Ab8RN6KIL...`) does not appear to be a standard Google AI Studio key format. Obtain a valid key from https://aistudio.google.com/app/apikey. The app works fully without it (deterministic fallback).

2. **Google Maps billing**: Routes API v2 with `TRAFFIC_AWARE_OPTIMAL` and `computeAlternativeRoutes: true` requires billing enabled. Speed reading intervals (for detailed incident data) may require a higher-volume API tier.

3. **ML model auto-trains**: On first run, if `traffic_prediction_model.joblib` doesn't exist, it trains from the CSV dataset (~2 seconds). Subsequent calls use the cached model.

4. **Public transit fares**: Namma Metro, BMTC, and Vajra AC fares are fixed ranges from the dataset config – not live BMTC API data (no public API available).

5. **Uber/Ola/Namma Yatri booking**: The "Book Ride" buttons open the provider's website. Actual API booking requires provider OAuth credentials.

6. **Google Directions transit mode**: May return limited transit data for some Bengaluru routes depending on GTFS feed coverage.
=======

>>>>>>> a725275779e19637c3d151ab8dcfbec64b8ad1fa
