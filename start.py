"""
start.py – SmartRoute AI: start backend + (optionally) check frontend.
Run from repo root: python start.py
"""
import subprocess, sys, os, time, webbrowser
from pathlib import Path

BACKEND_DIR = Path(__file__).parent / "Traffic-Congestion-Commute-Planning" / "backend"
FRONTEND_DIR = Path(__file__).parent / "Traffic-Congestion-Commute-Planning" / "Frontend"

print("[SmartRoute AI] Starting FastAPI backend on http://localhost:8000 ...")
backend = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
    cwd=str(BACKEND_DIR),
)
time.sleep(2)
print("[SmartRoute AI] Backend PID:", backend.pid)
print()
print("[SmartRoute AI] To start the React frontend, run in a separate terminal:")
print("    cd Traffic-Congestion-Commute-Planning/Frontend")
print("    npm run dev")
print()
print("[SmartRoute AI] API docs: http://localhost:8000/docs")
print("[SmartRoute AI] Health:   http://localhost:8000/health")
print()
print("Press Ctrl+C to stop.")

try:
    backend.wait()
except KeyboardInterrupt:
    backend.terminate()
    print("\n[SmartRoute AI] Backend stopped.")
