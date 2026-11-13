/**
 * SmartRouteAnalysisPanel.tsx
 *
 * User-friendly journey analysis shown BELOW the map.
 * No technical ML model names, no Random Forest, no prediction percentages.
 *
 * Sections:
 *   1. Journey header  – A → B with key metrics
 *   2. Traffic Status  – congestion severity, delay, speeds
 *   3. Best Route      – road name, distance, duration, steps
 *   4. Alternatives    – clickable route rows
 *   5. Transport & Fares – cab + transit costs and departure times
 *   6. Departure Guide – when to leave by transport mode
 *   7. Recommendation  – final AI/deterministic advice
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Car,
  Train,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Zap,
  Info,
  ShieldAlert,
  MapPin,
  IndianRupee,
  Timer,
  TrendingDown,
  TrendingUp,
  CalendarClock,
  RefreshCw,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { CommutePlanResponse, BestRoute, DepartureOption, TrafficData, monitorTraffic } from '../services/api';

// ── Auto-refresh interval (ms). 90 s keeps well within API quota. ─────────────
const REFRESH_INTERVAL_MS = 90_000;

// ── useTrafficData hook ───────────────────────────────────────────────────────
// Owns all traffic state for the panel.
// - Initialises immediately from the initial plan response (no extra API call).
// - Re-fetches when origin/destination change (new journey planned).
// - Polls every REFRESH_INTERVAL_MS while the panel is mounted.
// - Exposes loading, error and last-updated timestamp.
function useTrafficData(
  origin: string,
  destination: string,
  initial: TrafficData | null,
) {
  const [traffic, setTraffic]       = useState<TrafficData | null>(initial);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [updatedAt, setUpdatedAt]   = useState<Date | null>(initial ? new Date() : null);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevKeyRef                  = useRef('');

  const fetch = useCallback(async (quiet = false) => {
    if (!origin || !destination) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const resp = await monitorTraffic(origin, destination);
      if (resp.status === 'ok' && resp.data) {
        setTraffic(resp.data);
        setUpdatedAt(new Date());
      } else {
        setError('Traffic data unavailable for this route.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach the traffic service.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [origin, destination]);

  // Re-fetch when the origin/destination pair changes (new journey planned)
  useEffect(() => {
    const key = `${origin}||${destination}`;
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (initial) {
      // Use the initial data from the plan response immediately (no extra call)
      setTraffic(initial);
      setUpdatedAt(new Date());
      setError(null);
    } else {
      fetch(false);
    }
  }, [origin, destination, initial, fetch]);

  // Periodic silent refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!origin || !destination) return;

    intervalRef.current = setInterval(() => fetch(true), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [origin, destination, fetch]);

  return { traffic, loading, error, updatedAt, refresh: () => fetch(false) };
}

// ── Severity helpers ──────────────────────────────────────────────────────────
// Four tiers matching backend: LOW | MODERATE | HEAVY | SEVERE
type Severity = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

function sev(level: string | undefined): Severity {
  if (!level) return 'unknown';
  const u = level.toUpperCase().replace(/[^A-Z]/g, '');
  if (u === 'SEVERE')   return 'severe';
  if (u === 'HEAVY' || u === 'HIGH') return 'heavy';
  if (u === 'MODERATE' || u === 'MEDIUM') return 'moderate';
  if (u === 'LOW' || u === 'NORMAL' || u === 'FAST') return 'low';
  return 'unknown';
}

// Traffic severity colour tokens – 4 tiers + unknown
const T: Record<Severity, { dot: string; bg: string; text: string; border: string; bar: string; label: string; headlineText: string }> = {
  low:     { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', label: 'LOW',      headlineText: 'Roads are clear – great time to travel' },
  moderate:{ dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   bar: 'bg-amber-400',   label: 'MODERATE', headlineText: 'Moderate congestion – expect some slowdowns' },
  heavy:   { dot: 'bg-orange-500',  bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  bar: 'bg-orange-500',  label: 'HEAVY',    headlineText: 'Heavy congestion – consider alternative routes' },
  severe:  { dot: 'bg-red-600',     bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300',     bar: 'bg-red-600',     label: 'SEVERE',   headlineText: 'Severe congestion – strongly consider alternatives' },
  unknown: { dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-500',   border: 'border-slate-200',   bar: 'bg-slate-300',   label: '—',        headlineText: 'Fetching live conditions…' },
};

// ── Reusable atoms ────────────────────────────────────────────────────────────

function CongestionPill({ level }: { level: string | undefined }) {
  const s = sev(level); const c = T[s];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {c.label !== '—' ? c.label : (level ?? 'Unknown')}
    </span>
  );
}

// SeverityBar uses delay_percentage (0–100+) from the API; falls back to
// tier-based percentage estimates only when delay_percentage is unavailable.
function SeverityBar({ level, delayPct }: { level: string | undefined; delayPct?: number }) {
  const s = sev(level);
  const tierFallback = s === 'severe' ? 95 : s === 'heavy' ? 75 : s === 'moderate' ? 45 : s === 'low' ? 15 : 0;
  // Cap at 100 for display; delay_percentage can exceed 100 for severe gridlock
  const pct = Math.min(100, delayPct != null && delayPct > 0 ? Math.round(delayPct) : tierFallback);
  return (
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${T[s].bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-bold ${color ?? 'text-slate-900'}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100 my-3" />;
}

// ── Route row ─────────────────────────────────────────────────────────────────
function RouteRow({ route, isActive, rank, onClick }: {
  route: BestRoute; isActive: boolean; rank: number; onClick: () => void;
}) {
  const s = sev(route.congestion_level); const c = T[s];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${
        isActive
          ? 'bg-blue-50 border border-blue-300 ring-1 ring-blue-200'
          : 'bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white'
      }`}
    >
      {/* Rank badge */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
        isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
      }`}>{rank}</div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-800 truncate">
          {route.description || 'Recommended route'}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
          <span>{route.distance_km} km</span>
          <span>·</span>
          <span>{Math.round(route.duration_mins)} min</span>
          {route.delay_mins > 1 && (
            <span className="text-amber-600 font-medium">· +{Math.round(route.delay_mins)} min delay</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <CongestionPill level={route.congestion_level} />
        {isActive && (
          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">Selected</span>
        )}
      </div>
    </button>
  );
}

// ── Transport card ────────────────────────────────────────────────────────────
function TransportCard({ opt, isRec }: { opt: DepartureOption; isRec: boolean }) {
  const isTransit = opt.category === 'transit';
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      isRec
        ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
        : 'bg-white border-slate-200'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isTransit ? 'bg-purple-100' : 'bg-blue-100'
      }`}>
        {isTransit
          ? <Train className="w-4 h-4 text-purple-600" />
          : <Car   className="w-4 h-4 text-blue-600" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-900">{opt.provider}</span>
          {isRec && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              Recommended ★
            </span>
          )}
          {opt.tags?.map(tag => (
            <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-1.5">
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Fare (est.)</div>
            <div className="text-xs font-bold text-slate-800">₹{opt.fare_min}–₹{opt.fare_max}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Depart</div>
            <div className="text-xs font-bold text-slate-800">{opt.depart}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Arrive</div>
            <div className="text-xs font-bold text-slate-800">{opt.arrive}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
          <Timer className="w-3 h-3" />
          <span>{opt.duration_min} min journey</span>
          {opt.frequency_min && (
            <span className="ml-1">· every {opt.frequency_min} min</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export interface SmartRouteAnalysisPanelProps {
  data: CommutePlanResponse;
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
}

export const SmartRouteAnalysisPanel: React.FC<SmartRouteAnalysisPanelProps> = ({
  data, selectedRouteId, onSelectRoute,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // ── Live traffic state – owned by the hook, not frozen in data prop ─────────
  const { traffic, loading: trafficLoading, error: trafficError, updatedAt, refresh: refreshTraffic } =
    useTrafficData(data.origin ?? '', data.destination ?? '', data.traffic ?? null);

  const routes    = data.routes;
  const dep       = data.departure;

  const bestRoute  = routes?.best_route ?? null;
  const altRoutes  = routes?.alternative_routes ?? [];
  const allRoutes  = bestRoute ? [bestRoute, ...altRoutes] : [];

  const cabOpts    = dep?.options?.filter((o: DepartureOption) => o.category === 'cab') ?? [];
  const transitOpts= dep?.options?.filter((o: DepartureOption) => o.category === 'transit') ?? [];
  const allOpts    = [...cabOpts, ...transitOpts];
  const recProvider= dep?.recommended?.provider;

  const trafficSev   = sev(traffic?.congestion_level);
  const trafficCfg   = T[trafficSev];
  const delayMins    = Math.round(traffic?.traffic_delay_mins ?? 0);
  const delayPct     = traffic?.delay_percentage ?? 0;
  const currSpeed    = Math.round(traffic?.current_traffic_speed_kmph ?? 0);
  const normalSpeed  = Math.round(traffic?.average_normal_speed_kmph ?? 0);
  // Guard against 0 / NaN ETA — only show when the value is meaningful (> 0)
  const etaRaw       = traffic?.current_time_with_traffic_mins;
  const etaMins      = etaRaw != null && etaRaw > 0 ? Math.round(etaRaw) : null;
  const staticRaw    = traffic?.average_time_to_travel_mins;
  const staticMins   = staticRaw != null && staticRaw > 0 ? Math.round(staticRaw) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2e5c] to-[#1a56db] hover:from-[#1d3368] hover:to-[#1d64e8] transition-all"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span className="font-bold text-white text-sm tracking-tight">SmartRoute Analysis</span>
          <span className="hidden sm:flex items-center gap-1.5 ml-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${trafficCfg.bg} ${trafficCfg.text} ${trafficCfg.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${trafficCfg.dot}`} />
              {trafficCfg.label}
            </span>
            {delayMins > 0 && (
              <span className="text-blue-200 text-[10px]">· {delayMins} min delay</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.timestamp && (
            <span className="text-blue-300 text-[10px] hidden md:inline">
              Updated {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-blue-200" />
            : <ChevronUp   className="w-4 h-4 text-blue-200" />}
        </div>
      </button>

      {/* Collapsed summary strip */}
      {collapsed && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
          {data.overall_recommendation}
        </div>
      )}

      {!collapsed && (
        <div className="px-5 py-4">

          {/* ── 1. Journey Header ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white text-[9px]">A</div>
              <span className="text-xs font-bold text-emerald-800 max-w-[140px] truncate">
                {data.origin?.split(',')[0] ?? '—'}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center font-bold text-white text-[9px]">B</div>
              <span className="text-xs font-bold text-red-800 max-w-[140px] truncate">
                {data.destination?.split(',')[0] ?? '—'}
              </span>
            </div>

            {data.arrival_time && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl ml-auto">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-bold text-blue-700">Arrive by {data.arrival_time}</span>
              </div>
            )}
          </div>

          {/* Quick KPIs */}
          {bestRoute && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 mb-0">
              <Kpi label="Distance" value={`${bestRoute.distance_km} km`} sub="best route" />
              <Kpi label="Travel Time" value={`${Math.round(bestRoute.duration_mins)} min`}
                sub={delayMins > 0 ? `+${delayMins} min delay` : 'no delay'}
                color={delayMins > 10 ? 'text-red-600' : delayMins > 3 ? 'text-amber-600' : 'text-emerald-600'} />
              <Kpi label="Current Speed" value={`${currSpeed} km/h`} sub={`normal ${normalSpeed} km/h`} />
              <Kpi label="ETA" value={etaMins != null ? `${etaMins} min` : 'N/A'} sub="with live traffic" />
            </div>
          )}

          <Divider />

          {/* ── 2. Traffic Status ──────────────────────────────────────────── */}
          <>
            {/* Section head with refresh button + timestamp */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">
                  {trafficLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    : <Gauge className="w-4 h-4" />}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Current Traffic Conditions
                </span>
                {/* Live badge */}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2">
                {updatedAt && !trafficLoading && (
                  <span className="text-[10px] text-slate-400">
                    Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshTraffic}
                  disabled={trafficLoading}
                  title="Refresh traffic data"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${trafficLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {trafficLoading && !traffic && (
              <div className="rounded-xl border border-slate-100 overflow-hidden animate-pulse">
                <div className="h-12 bg-slate-100" />
                <div className="h-2 bg-slate-50 mx-4 my-2 rounded-full" />
                <div className="grid grid-cols-4 gap-px bg-slate-100">
                  {[0,1,2,3].map(i => <div key={i} className="h-14 bg-white" />)}
                </div>
              </div>
            )}

            {/* Error state – never show fabricated values */}
            {trafficError && !traffic && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 flex items-start gap-3">
                <WifiOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-700">Traffic data unavailable</div>
                  <div className="text-xs text-slate-500 mt-0.5">{trafficError}</div>
                  <button
                    type="button"
                    onClick={refreshTraffic}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Try again →
                  </button>
                </div>
              </div>
            )}

            {/* Live data */}
            {traffic && (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                {/* Congestion headline bar – colour-coded */}
                <div className={`flex items-center justify-between gap-3 px-4 py-3 ${trafficCfg.bg}`}>
                  <div className="flex items-center gap-2.5">
                    {trafficSev === 'low'      && <CheckCircle2  className={`w-4 h-4 ${trafficCfg.text}`} />}
                    {trafficSev === 'moderate' && <AlertTriangle className={`w-4 h-4 ${trafficCfg.text}`} />}
                    {trafficSev === 'heavy'    && <ShieldAlert   className={`w-4 h-4 ${trafficCfg.text}`} />}
                    {trafficSev === 'severe'   && <ShieldAlert   className={`w-4 h-4 ${trafficCfg.text}`} />}
                    {trafficSev === 'unknown'  && <Gauge         className={`w-4 h-4 ${trafficCfg.text}`} />}
                    <span className={`text-sm font-bold ${trafficCfg.text}`}>
                      {trafficCfg.headlineText}
                    </span>
                  </div>
                  <CongestionPill level={traffic.congestion_level} />
                </div>

                {/* Severity fill bar */}
                <div className="px-4 pt-2 pb-1 bg-white">
                  <SeverityBar level={traffic.congestion_level} delayPct={delayPct} />
                </div>

                {/* 4 data cells – all from API response */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
                  {[
                    {
                      label: 'Traffic Delay',
                      value: delayMins > 0 ? `+${delayMins} min` : 'None',
                      color: delayMins > 10 ? 'text-red-600 font-bold'
                           : delayMins > 3  ? 'text-amber-600 font-semibold'
                                            : 'text-emerald-600 font-semibold',
                      icon: delayMins > 3
                              ? <TrendingUp   className="w-3 h-3 text-amber-500" />
                              : <TrendingDown className="w-3 h-3 text-emerald-500" />,
                    },
                    {
                      label: 'Current Speed',
                      value: currSpeed > 0 ? `${currSpeed} km/h` : '—',
                      color: 'text-slate-800',
                      icon: <Gauge className="w-3 h-3" />,
                    },
                    {
                      label: 'Normal Speed',
                      value: normalSpeed > 0 ? `${normalSpeed} km/h` : '—',
                      color: 'text-slate-600',
                      icon: null,
                    },
                    {
                      label: 'Distance',
                      value: traffic.distance_km != null ? `${traffic.distance_km} km` : '—',
                      color: 'text-slate-800',
                      icon: null,
                    },
                  ].map(({ label, value, color, icon }) => (
                    <div key={label} className="flex flex-col gap-0.5 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        {icon}<span>{label}</span>
                      </div>
                      <span className={`text-sm ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* ETA row */}
                <div className="grid grid-cols-2 gap-px bg-slate-100">
                  <div className="flex flex-col gap-0.5 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                      <Clock className="w-3 h-3" /><span>ETA with traffic</span>
                    </div>
                    <span className="text-sm text-slate-800 font-semibold">
                      {etaMins != null ? `${etaMins} min` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                      <Clock className="w-3 h-3" /><span>ETA without traffic</span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {staticMins != null ? `${staticMins} min` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Source attribution */}
                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>
                    Source: {traffic.data_source?.replace(/_/g, ' ') ?? 'Google Routes API'}
                    {traffic.is_heavy_traffic && (
                      <span className="ml-1.5 text-red-500 font-semibold">· Heavy traffic detected</span>
                    )}
                  </span>
                </div>

                {/* Incident row */}
                {traffic.incidents_and_roadblocks && (
                  <div className={`flex items-center gap-2 px-4 py-2 text-[11px] font-semibold border-t ${
                    traffic.incidents_and_roadblocks.road_restriction_detected
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : traffic.incidents_and_roadblocks.incident_likelihood === 'HIGH'
                        ? 'bg-amber-50 border-amber-100 text-amber-700'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    {traffic.incidents_and_roadblocks.road_restriction_detected
                      ? <><ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Road restriction detected on this route</>
                      : traffic.incidents_and_roadblocks.incident_likelihood === 'HIGH'
                        ? <><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Possible incidents – drive cautiously</>
                        : <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> No incidents reported on this route</>
                    }
                  </div>
                )}
              </div>
            )}

            {/* Error overlay when stale data is still showing */}
            {trafficError && traffic && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <WifiOff className="w-3 h-3 shrink-0" />
                <span>Last refresh failed – showing cached data. <button type="button" onClick={refreshTraffic} className="underline font-semibold">Retry</button></span>
              </div>
            )}

            <Divider />
          </>

          {/* ── 3. Best Route ──────────────────────────────────────────────── */}
          {bestRoute && (
            <>
              <SectionHead icon={<Navigation className="w-4 h-4 text-blue-600" />} title="Best Route" />
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      via {bestRoute.description ?? 'recommended route'}
                    </div>
                    <div className="text-[11px] text-blue-600 mt-0.5 font-medium">Fastest available option</div>
                  </div>
                  <CongestionPill level={bestRoute.congestion_level} />
                </div>

                <div className="grid grid-cols-3 gap-px bg-blue-100">
                  {[
                    { label: 'Distance',   value: `${bestRoute.distance_km} km` },
                    { label: 'Duration',   value: `${Math.round(bestRoute.duration_mins)} min`,
                      sub: bestRoute.delay_mins > 1 ? `+${Math.round(bestRoute.delay_mins)} min delay` : undefined },
                    { label: 'Without traffic', value: `${Math.round(bestRoute.static_mins)} min` },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="bg-white px-3 py-2.5 flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">{label}</span>
                      <span className="text-sm font-bold text-blue-700">{value}</span>
                      {sub && <span className="text-[10px] text-amber-600 font-semibold">{sub}</span>}
                    </div>
                  ))}
                </div>

                {/* Top turn-by-turn */}
                {bestRoute.steps && bestRoute.steps.length > 0 && (
                  <div className="px-4 py-3 bg-white border-t border-blue-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Key directions</div>
                    <div className="space-y-1.5">
                      {bestRoute.steps.slice(0, 4).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[9px] mt-0.5">
                            {i + 1}
                          </span>
                          <span className="flex-1" dangerouslySetInnerHTML={{ __html: step.instruction }} />
                          <span className="text-slate-400 shrink-0 font-medium">{step.distance_km} km</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Divider />
            </>
          )}

          {/* ── 4. Alternative Routes ──────────────────────────────────────── */}
          {allRoutes.length > 1 && (
            <>
              <SectionHead icon={<MapPin className="w-4 h-4" />} title="Route Options" />
              <div className="space-y-2">
                {allRoutes.map((route, idx) => {
                  const rId = `route-${idx + 1}`;
                  return (
                    <RouteRow
                      key={rId}
                      route={route}
                      isActive={selectedRouteId === rId}
                      rank={idx + 1}
                      onClick={() => onSelectRoute(rId)}
                    />
                  );
                })}
              </div>
              <Divider />
            </>
          )}

          {/* ── 5. Transport Options & Fares ───────────────────────────────── */}
          {allOpts.length > 0 && (
            <>
              <SectionHead icon={<IndianRupee className="w-4 h-4" />} title="Transport Options & Estimated Fares" />
              <div className="space-y-2.5">
                {allOpts.map(opt => (
                  <TransportCard
                    key={opt.provider}
                    opt={opt}
                    isRec={opt.provider === recProvider}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                <Info className="w-3 h-3 shrink-0" />
                <span>Fares are estimates. Live rates vary by provider, demand and route.</span>
              </div>
              <Divider />
            </>
          )}

          {/* ── 6. Departure Recommendation ────────────────────────────────── */}
          {dep?.recommended?.explanation && (
            <>
              <SectionHead icon={<CalendarClock className="w-4 h-4 text-amber-600" />} title="Departure Recommendation" />
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-800 mb-0.5">
                    Best option: {dep.recommended.provider}
                  </div>
                  <div className="text-xs text-amber-700 leading-relaxed">
                    {dep.recommended.explanation}
                  </div>
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* ── 7. Final Recommendation ────────────────────────────────────── */}
          {data.overall_recommendation && (
            <>
              <SectionHead
                icon={<Sparkles className="w-4 h-4 text-blue-500" />}
                title={data.gemini_used ? 'AI Recommendation' : 'SmartRoute Recommendation'}
              />
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-xl border border-blue-200/60 px-4 py-3.5">
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {data.overall_recommendation}
                </p>
                {data.explanation && data.explanation !== data.overall_recommendation && (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {data.explanation}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-blue-400 font-medium">
                  <Info className="w-3 h-3" />
                  <span>
                    Based on live Google Maps traffic data
                    {data.gemini_used ? ' · Explanation by Gemini AI' : ''}
                  </span>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};
