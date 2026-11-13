import requests
import json
import sys

BASE = 'http://localhost:8000'
RESULTS = []

def test(name, passed, detail):
    status = 'PASS' if passed else 'FAIL'
    RESULTS.append((name, status, detail))
    print(f'  [{status}] {name}: {detail}')

print('=== PHASE 9: End-to-End Test Suite ===')
print()

# 1. Health check
print('1. Backend health check')
try:
    r = requests.get(f'{BASE}/health', timeout=5)
    d = r.json()
    test('GET /health', d.get('status') == 'ok', 
         f'maps={d.get("google_maps_configured")} gemini={d.get("gemini_configured")} ml={d.get("ml_model_available")}')
except Exception as e:
    test('GET /health', False, str(e))

# 2. Traffic monitor
print('2. Traffic monitoring tool')
try:
    r = requests.post(f'{BASE}/api/traffic/monitor',
        json={'origin': 'Rajajinagar, Bengaluru', 'destination': 'Koramangala 5th Block, Bengaluru'},
        timeout=20)
    d = r.json()
    data = d.get('data', {})
    test('POST /api/traffic/monitor', 
         d.get('status') == 'ok' and data.get('congestion_level') is not None,
         'congestion=' + str(data.get('congestion_level')) + ' delay=' + str(data.get('traffic_delay_mins')) + 'min')
except Exception as e:
    test('POST /api/traffic/monitor', False, str(e))

# 3. Route optimize
print('3. Route optimization tool')
try:
    r = requests.post(f'{BASE}/api/routes/optimize',
        json={'origin': 'Indiranagar, Bengaluru', 'destination': 'Whitefield ITPL, Bengaluru'},
        timeout=30)
    d = r.json()
    br = d.get('data', {}).get('best_route', {})
    alts = len(d.get('data', {}).get('alternative_routes', []))
    test('POST /api/routes/optimize',
         d.get('status') == 'ok' and br.get('description') is not None,
         'best_route=' + str(br.get('description')) + ' alts=' + str(alts))
except Exception as e:
    test('POST /api/routes/optimize', False, str(e))

# 4. ML predict
print('4. ML traffic prediction')
try:
    r = requests.post(f'{BASE}/api/traffic/predict', json={
        'hour': 8, 'day_of_week': 0, 'vehicle_count_per_min': 20.0,
        'avg_speed_kmph': 20.0, 'road_occupancy': 0.75,
        'road_name': 'Outer Ring Road', 'area': 'IT Corridor',
        'vehicle_type': 'Car', 'weather': 'Clear',
        'road_condition': 'Dry', 'incident_type': 'None'
    }, timeout=30)
    d = r.json()
    data = d.get('data', {})
    conf = data.get('confidence', {})
    max_conf = max(conf.values(), default=0)
    test('POST /api/traffic/predict',
         d.get('status') == 'ok' and data.get('congestion_level') in ['LOW', 'MEDIUM', 'HIGH'],
         'congestion=' + str(data.get('congestion_level')) + ' confidence=' + str(round(max_conf, 2)))
except Exception as e:
    test('POST /api/traffic/predict', False, str(e))

# 5. Departure plan
print('5. Departure planning tool')
try:
    r = requests.post(f'{BASE}/api/departure/plan', json={
        'origin': 'Yeshwanthpur, Bengaluru',
        'destination': 'Electronic City Phase 2, Bengaluru',
        'required_arrival': '9:00 AM'
    }, timeout=15)
    d = r.json()
    rec = d.get('data', {}).get('recommended', {})
    test('POST /api/departure/plan',
         d.get('status') == 'ok' and rec.get('provider') is not None,
         'rec=' + str(rec.get('provider')) + ' depart=' + str(rec.get('depart')))
except Exception as e:
    test('POST /api/departure/plan', False, str(e))

# 6. Full SmartRouteAgent commute plan
print('6. Full SmartRouteAgent commute plan')
try:
    r = requests.post(f'{BASE}/api/commute/plan', json={
        'origin': 'Hebbal Bengaluru',
        'destination': 'Koramangala 3rd Block Bengaluru',
        'arrival_time': '9:30 AM'
    }, timeout=90)
    d = r.json()
    ts = d.get('tool_statuses', {})
    all_ok = all(v in ['ok', 'skipped_no_arrival_time'] for v in ts.values())
    test('POST /api/commute/plan - all tools ok', all_ok, str(ts))
    test('POST /api/commute/plan - traffic present',
         d.get('traffic') is not None,
         'congestion=' + str(d.get('traffic', {}).get('congestion_level')))
    br2 = d.get('routes', {}).get('best_route', {}) if d.get('routes') else {}
    test('POST /api/commute/plan - routes present',
         d.get('routes') is not None and br2.get('description') is not None,
         'best_route=' + str(br2.get('description')))
    ml = d.get('ml_prediction', {})
    test('POST /api/commute/plan - ML present',
         ml is not None and not ml.get('error'),
         'ml=' + str(ml.get('congestion_level')))
    dep = d.get('departure', {})
    rec2 = dep.get('recommended', {}) if dep else {}
    test('POST /api/commute/plan - departure present',
         dep is not None and dep.get('status') == 'ok',
         'provider=' + str(rec2.get('provider')))
    rec_text = d.get('overall_recommendation', '')
    test('POST /api/commute/plan - recommendation',
         bool(rec_text), rec_text[:80] if rec_text else 'EMPTY')
except Exception as e:
    test('POST /api/commute/plan', False, str(e))

# 7. Error handling: invalid input
print('7. Error handling')
try:
    r = requests.post(f'{BASE}/api/commute/plan',
        json={'origin': '', 'destination': 'Electronic City'},
        timeout=5)
    test('Empty origin returns 422', r.status_code == 422, 'HTTP ' + str(r.status_code))
except Exception as e:
    test('Empty origin validation', False, str(e))

# 8. Missing API key graceful handling - simulate with bad origin
print('8. Graceful error handling')
try:
    r = requests.post(f'{BASE}/api/departure/plan', json={
        'origin': 'Rajajinagar',
        'destination': 'MG Road',
        'required_arrival': '25:99'  # invalid time
    }, timeout=5)
    d = r.json()
    test('Invalid time returns error status', d.get('status') == 'error', 'status=' + str(d.get('status')))
except Exception as e:
    test('Invalid time handling', False, str(e))

# 9. Frontend reachable
print('9. Frontend connectivity')
try:
    rf = requests.get('http://localhost:5173', timeout=5)
    test('Frontend dev server', rf.status_code == 200, 'HTTP ' + str(rf.status_code))
except Exception as e:
    test('Frontend dev server', False, str(e))

# 10. CORS
print('10. CORS headers')
try:
    r = requests.options(f'{BASE}/api/commute/plan',
        headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'},
        timeout=5)
    cors = r.headers.get('access-control-allow-origin', '')
    test('CORS allows frontend origin', '*' in cors or 'localhost' in cors, 'cors_origin=' + cors)
except Exception as e:
    test('CORS', False, str(e))

print()
passed = sum(1 for _, s, _ in RESULTS if s == 'PASS')
failed = sum(1 for _, s, _ in RESULTS if s in ('FAIL', 'ERROR'))
print('=== RESULTS: ' + str(passed) + ' passed, ' + str(failed) + ' failed out of ' + str(len(RESULTS)) + ' tests ===')
