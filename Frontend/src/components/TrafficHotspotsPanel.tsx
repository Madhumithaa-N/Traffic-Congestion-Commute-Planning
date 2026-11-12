/**
 * TrafficHotspotsPanel.tsx
 *
 * Displays the top-5 most congested Bengaluru traffic corridors, ranked
 * dynamically using live Google Routes API data from the backend.
 *
 * Data is fetched once on mount and refreshed every REFRESH_MS milliseconds.
 * Only real API values are shown — never simulated or hardcoded congestion.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flame,
  RefreshCw,
  WifiOff,
  Loader2,
  Clock,
  Gauge,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { getTrafficHotspots, HotspotArea } from '../services/api';

// Auto-refresh every 3 minutes (hotspots change slowly; cache is 60 s)
const REFRESH_MS = 3 * 60 * 1000;

// ── Severity helpers (mirrors SmartRouteAnalysisPanel) ────────────────────────
type Severity = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

function sev(level: string | undefined): Severity {
  if (!level) return 'unknown';
  const u = level.toUpperCase().replace(/[^A-Z]/g, '');
  if (u === 'SEVERE')   return 'severe';
  if (u === 'HEAVY' || u === 'HIGH') return 'heavy';
  if (u === 'MODERATE' || u === 'MEDIUM') return 'moderate';
  if (u === 'LOW' || u === 'NORMAL') return 'low';
  return 'unknown';
}

const SEV_CONFIG: Record<Severity, {
  badgeBg: string; badgeText: string; badgeBorder: string; dot: string;
  barColor: string; rowBg: string; label: string; icon: React.ReactNode;
}> = {
  low:     {
    badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', badgeBorder: 'border-emerald-200',
    dot: 'bg-emerald-500', barColor: 'bg-emerald-500', rowBg: '',
    label: 'LOW',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  moderate:{
    badgeBg: 'bg-amber-50',   badgeText: 'text-amber-700',   badgeBorder: 'border-amber-200',
    dot: 'bg-amber-400', barColor: 'bg-amber-400', rowBg: '',
    label: 'MODERATE',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  },
  heavy:   {
    badgeBg: 'bg-orange-50',  badgeText: 'text-orange-700',  badgeBorder: 'border-orange-200',
    dot: 'bg-orange-500', barColor: 'bg-orange-500', rowBg: 'bg-orange-50/30',
    label: 'HEAVY',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-orange-600" />,
  },
  severe:  {
    badgeBg: 'bg-red-50',     badgeText: 'text-red-700',     badgeBorder: 'border-red-300',
    dot: 'bg-red-600', barColor: 'bg-red-600', rowBg: 'bg-red-50/40',
    label: 'SEVERE',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-red-600" />,
  },
  unknown: {
    badgeBg: 'bg-slate-50',   badgeText: 'text-slate-500',   badgeBorder: 'border-slate-200',
    dot: 'bg-slate-400', barColor: 'bg-slate-300', rowBg: '',
    label: '—',
    icon: <Gauge className="w-3.5 h-3.5 text-slate-400" />,
  },
};

// ── Single hotspot row ─────────────────────────────────────────────────────────
function HotspotRow({ spot, rank }: { spot: HotspotArea; rank: number }) {
  const s  = sev(spot.congestion_level);
  const c  = SEV_CONFIG[s];
  const delay = Math.round(spot.traffic_delay_mins);
  const speed = Math.round(spot.current_traffic_speed_kmph);
  const pct   = Math.min(100, Math.round(spot.delay_percentage));

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${c.rowBg}`}>
      {/* Rank badge */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
        rank === 1 ? 'bg-red-600 text-white' : rank === 2 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
      }`}>
        {rank}
      </div>

      {/* Area name + route */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-900 truncate">{spot.area}</span>
          {/* Severity badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
          </span>
        </div>

        {/* Delay bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${c.barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 font-medium">{pct}% delay</span>
        </div>
      </div>

      {/* Stats column */}
      <div className="shrink-0 flex flex-col items-end gap-1 min-w-[80px]">
        <div className="flex items-center gap-1 text-xs font-semibold">
          {c.icon}
          <span className={delay > 0 ? 'text-slate-800' : 'text-emerald-700'}>
            {delay > 0 ? `+${delay} min` : 'No delay'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Gauge className="w-3 h-3" />
          <span>{speed > 0 ? `${speed} km/h` : '—'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export const TrafficHotspotsPanel: React.FC = () => {
  const [hotspots, setHotspots] = useState<HotspotArea[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHotspots = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const resp = await getTrafficHotspots(5);
      if (resp.status === 'ok' && resp.data?.hotspots) {
        setHotspots(resp.data.hotspots);
        setUpdatedAt(new Date());
        setCacheHit(resp.data.cache_hit ?? false);
      } else {
        setError('Hotspot data unavailable. The backend may be starting up.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach the traffic service.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotspots(false);
    intervalRef.current = setInterval(() => fetchHotspots(true), REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchHotspots]);

  const dominantLevel = hotspots?.[0]?.congestion_level;
  const dominantSev   = sev(dominantLevel);
  const dominantCfg   = SEV_CONFIG[dominantSev];

  return (
    <section className="mt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <Flame className="w-5 h-5 text-red-500 stroke-[2.2]" />
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Highest Traffic Areas in Bengaluru
          </h2>
          {/* Live pulse */}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          {updatedAt && !loading && (
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {cacheHit && ' (cached)'}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchHotspots(false)}
            disabled={loading}
            title="Refresh hotspots"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Card header strip */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span>Top 5 congested corridors right now · Ranked by live delay</span>
          </div>
          {dominantLevel && !loading && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${dominantCfg.badgeBg} ${dominantCfg.badgeText} ${dominantCfg.badgeBorder}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dominantCfg.dot}`} />
              Worst: {dominantCfg.label}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && !hotspots && (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Fetching live traffic from 12 Bengaluru corridors…</span>
          </div>
        )}

        {/* Error */}
        {error && !hotspots && (
          <div className="flex items-start gap-3 px-4 py-6">
            <WifiOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-700">Hotspot data unavailable</div>
              <div className="text-xs text-slate-500 mt-0.5">{error}</div>
              <button
                type="button"
                onClick={() => fetchHotspots(false)}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Try again →
              </button>
            </div>
          </div>
        )}

        {/* Hotspot rows */}
        {hotspots && hotspots.length > 0 && (
          <>
            {hotspots.map((spot, idx) => (
              <HotspotRow key={spot.area} spot={spot} rank={idx + 1} />
            ))}
          </>
        )}

        {/* Empty state */}
        {hotspots && hotspots.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-8 text-slate-500 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>All monitored corridors show clear traffic conditions right now.</span>
          </div>
        )}

        {/* Error overlay with stale data still showing */}
        {error && hotspots && (
          <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-amber-700 bg-amber-50 border-t border-amber-200">
            <WifiOff className="w-3 h-3 shrink-0" />
            <span>Last refresh failed – showing cached data. <button type="button" onClick={() => fetchHotspots(false)} className="underline font-semibold">Retry</button></span>
          </div>
        )}

        {/* Footer attribution */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
          <Info className="w-3 h-3 shrink-0" />
          <span>
            Source: Google Routes API v2 · 12 Bengaluru corridors monitored ·
            Congestion calculated from live traffic-aware vs free-flow duration · Refreshes every 3 min
          </span>
        </div>
      </div>
    </section>
  );
};
