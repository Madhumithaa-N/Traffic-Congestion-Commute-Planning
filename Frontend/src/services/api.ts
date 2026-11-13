/**
 * api.ts – SmartRoute AI Frontend API Client
 *
 * All backend calls go through this module.
 * Base URL is read from VITE_API_BASE_URL env var (defaults to localhost:8000).
 * Never call the backend directly from components.
 */

// Priority: build-time env var → localhost dev fallback
// VITE_API_BASE_URL MUST be set in Vercel/Render environment dashboard for production.
// There is no hardcoded production URL here — the env var is the single source of truth.
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommutePlanRequest {
  origin: string;
  destination: string;
  arrival_time?: string;
}

export interface ToolStatuses {
  traffic_monitor: string;
  route_optimize: string;
  ml_predict: string;
  departure_plan: string;
}

export interface TrafficData {
  origin: string;
  destination: string;
  distance_km: number;
  congestion_level: string;          // LOW | MODERATE | HEAVY | SEVERE
  traffic_delay_mins: number;
  delay_percentage: number;          // delay as % of free-flow time
  current_time_with_traffic_mins: number;
  average_time_to_travel_mins: number;
  average_normal_speed_kmph: number;
  current_traffic_speed_kmph: number;
  is_heavy_traffic: boolean;
  traffic_summary?: string;          // human-readable paragraph
  route_description?: string;
  incidents_and_roadblocks?: {
    incident_likelihood: string;
    anomalous_segments_detected: boolean;
    road_restriction_detected: boolean;
    slowest_segment_speed_kmph?: number | null;
  };
  data_source: string;
}

export interface HotspotArea {
  area: string;
  origin: string;
  destination: string;
  congestion_level: string;          // LOW | MODERATE | HEAVY | SEVERE
  traffic_delay_mins: number;
  delay_percentage: number;
  current_traffic_speed_kmph: number;
  average_normal_speed_kmph: number;
  current_time_with_traffic_mins: number;
  average_time_to_travel_mins: number;
  distance_km: number;
  is_heavy_traffic: boolean;
  incidents_and_roadblocks: {
    incident_likelihood: string;
    road_restriction_detected: boolean;
  };
  traffic_summary: string;
}

export interface HotspotsData {
  status: string;
  hotspots: HotspotArea[];
  total_monitored: number;
  successful_queries: number;
  timestamp: string;
  data_source: string;
  cache_hit: boolean;
}

export interface RouteStep {
  instruction: string;
  distance_km: number;
  duration_mins: number;
}

export interface BestRoute {
  id: string;
  description: string;
  distance_km: number;
  duration_mins: number;
  static_mins: number;
  static_duration_mins?: number;   // backward-compat alias
  delay_mins: number;
  traffic_delay_mins?: number;     // backward-compat alias
  congestion_level: string;        // LOW | MODERATE | HEAVY | SEVERE
  has_restriction: boolean;
  has_road_restriction?: boolean;  // backward-compat alias
  steps: RouteStep[];
}

export interface TransitOption {
  mode: string;
  steps: { travel_mode: string; instruction: string; duration_text: string; distance_text: string }[];
  total_duration_mins: number;
  fare?: string;
  has_real_transit?: boolean;
}

export interface RoutesData {
  origin: string;
  destination: string;
  best_route: BestRoute;
  alternative_routes: BestRoute[];
  transport_options: TransitOption[];
  overall_recommendation: string;
  data_sources: string[];
  warnings: string[];
}

export interface MLPrediction {
  congestion_level: string;
  confidence: Record<string, number>;
  description: string;
  data_source: string;
  error?: string;
}

export interface DepartureOption {
  category: string;
  provider: string;
  fare_min: number;
  fare_max: number;
  depart: string;
  arrive: string;
  duration_min: number;
  frequency_min: number | null;
  tags: string[];
}

export interface DepartureData {
  status: string;
  data_source: string;
  route: {
    name: string;
    duration_min: number;
    distance_km: number;
    traffic: string;
  };
  options: DepartureOption[];
  recommended: {
    provider: string;
    explanation: string;
    depart?: string;
    arrive?: string;
    fare_min?: number;
    fare_max?: number;
  };
}

export interface CommutePlanResponse {
  status: string;
  origin: string;
  destination: string;
  arrival_time?: string;
  traffic: TrafficData | null;
  routes: RoutesData | null;
  ml_prediction: MLPrediction | null;
  departure: DepartureData | null;
  overall_recommendation: string;
  explanation: string;
  data_sources: string[];
  tool_statuses: ToolStatuses;
  gemini_used: boolean;
  timestamp: string;
  warnings: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: object): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    try {
      const json = await resp.json();
      errMsg = json.error || json.detail || errMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  return resp.json();
}

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ── Exported API functions ────────────────────────────────────────────────────

/** Main commute planning – calls the SmartRouteAgent. */
export async function planCommute(
  req: CommutePlanRequest
): Promise<CommutePlanResponse> {
  return post<CommutePlanResponse>('/api/commute/plan', req);
}

/** Fetch real-time traffic only. */
export async function monitorTraffic(
  origin: string,
  destination: string
): Promise<{ status: string; data: TrafficData }> {
  return post('/api/traffic/monitor', { origin, destination });
}

/** Fetch route alternatives only. */
export async function optimizeRoutes(
  origin: string,
  destination: string
): Promise<{ status: string; data: RoutesData; warnings: string[] }> {
  return post('/api/routes/optimize', { origin, destination });
}

/** Backend health check. */
export async function healthCheck(): Promise<{
  status: string;
  google_maps_configured: boolean;
  gemini_configured: boolean;
  ml_model_available: boolean;
}> {
  return get('/health');
}

// ── Metro Station ─────────────────────────────────────────────────────────────

export interface MetroStation {
  name: string;
  line: string;
  walking_mins: number | string;
  distance_km: number | string;
  feeder: string;
  is_estimate: boolean;
}

export interface MetroNearbyResponse {
  status: string;
  data: {
    address: string;
    stations: MetroStation[];
    data_source: string;
    error?: string;
  };
  warnings: string[];
  timestamp: string;
}

/** Find nearest Namma Metro stations to an address. */
export async function findNearbyMetro(
  address: string,
  maxResults = 3
): Promise<MetroNearbyResponse> {
  return post<MetroNearbyResponse>('/api/metro/nearby', { address, max_results: maxResults });
}

/** Fetch live Bengaluru traffic hotspots ranked by congestion. */
export async function getTrafficHotspots(
  topN = 5
): Promise<{ status: string; data: HotspotsData; warnings?: string[] }> {
  return post('/api/traffic/hotspots', { top_n: topN });
}
