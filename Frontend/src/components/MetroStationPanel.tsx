import React, { useState, useEffect } from 'react';
import { Train, MapPin, Clock, Navigation, Info, Loader2 } from 'lucide-react';
import { findNearbyMetro, MetroStation } from '../services/api';

interface MetroStationPanelProps {
  origin: string;
  destination: string;
}

const LINE_COLORS: Record<string, string> = {
  Purple: 'bg-purple-100 text-purple-800 border-purple-200',
  Green:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Purple/Green': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const FEEDER_ICONS: Record<string, string> = {
  Walking: '🚶',
  Auto:    '🛺',
  Cab:     '🚗',
  Bus:     '🚌',
};

function feedIcon(feeder: string): string {
  for (const [k, v] of Object.entries(FEEDER_ICONS)) {
    if (feeder.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '🚌';
}

interface StationCardProps {
  station: MetroStation;
  rank: number;
}

const StationCard: React.FC<StationCardProps> = ({ station, rank }) => {
  const lineKey = Object.keys(LINE_COLORS).find(k => station.line.includes(k)) || 'Purple';
  const lineClass = LINE_COLORS[lineKey] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-2 ${rank === 0 ? 'ring-1 ring-purple-300/60' : ''}`}>
      {rank === 0 && (
        <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Nearest</div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${rank === 0 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {rank + 1}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm leading-tight">{station.name}</div>
            <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${lineClass}`}>
              {station.line}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-slate-900 font-bold text-sm">
            {typeof station.distance_km === 'number'
              ? `${station.distance_km} km`
              : station.distance_km}
          </div>
          <div className="text-slate-500 text-[11px]">straight line</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-0.5">
        <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <div className="text-slate-800 font-semibold text-xs">
              ~{station.walking_mins} min walk
            </div>
            {station.is_estimate && (
              <div className="text-[10px] text-slate-400">estimate</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
          <span className="text-base leading-none">{feedIcon(station.feeder)}</span>
          <div>
            <div className="text-slate-800 font-semibold text-xs truncate">{station.feeder.split('(')[0].trim()}</div>
            <div className="text-[10px] text-slate-400">to station</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MetroStationPanel: React.FC<MetroStationPanelProps> = ({
  origin,
  destination,
}) => {
  const [originStations, setOriginStations] = useState<MetroStation[]>([]);
  const [destStations, setDestStations] = useState<MetroStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState('');
  const [expanded, setExpanded] = useState<'origin' | 'destination'>('origin');

  useEffect(() => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);

    Promise.all([
      findNearbyMetro(origin, 3),
      findNearbyMetro(destination, 3),
    ])
      .then(([oRes, dRes]) => {
        setOriginStations(oRes.data.stations || []);
        setDestStations(dRes.data.stations || []);
        setTimestamp(new Date().toLocaleTimeString());
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [origin, destination]);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Train className="w-4.5 h-4.5 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-sm">Nearby Namma Metro Stations</h3>
          <span className="text-[10px] text-slate-400 font-medium">Green &amp; Purple Line</span>
        </div>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-[10px] text-slate-400">Updated {timestamp}</span>
          )}
          <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" />
            <span>Walking times are estimates</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Finding nearest metro stations...</span>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 text-sm text-red-700 bg-red-50">
          Could not load metro stations: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="p-4">
          {/* Tab selector */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-semibold mb-4">
            <button
              type="button"
              onClick={() => setExpanded('origin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${expanded === 'origin' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'}`}
            >
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px]">A</div>
              <span className="truncate max-w-[120px]">{origin.split(',')[0]}</span>
            </button>
            <button
              type="button"
              onClick={() => setExpanded('destination')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${expanded === 'destination' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'}`}
            >
              <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[9px]">B</div>
              <span className="truncate max-w-[120px]">{destination.split(',')[0]}</span>
            </button>
          </div>

          {expanded === 'origin' && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5 text-xs text-slate-600 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Near <strong>{origin.split(',')[0]}</strong> (boarding stations)</span>
              </div>
              {originStations.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center">No metro stations within 3 km of origin.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {originStations.map((s, i) => <StationCard key={s.name} station={s} rank={i} />)}
                </div>
              )}
            </div>
          )}

          {expanded === 'destination' && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5 text-xs text-slate-600 font-medium">
                <Navigation className="w-3.5 h-3.5 text-red-600" />
                <span>Near <strong>{destination.split(',')[0]}</strong> (alighting stations)</span>
              </div>
              {destStations.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center">No metro stations within 3 km of destination.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {destStations.map((s, i) => <StationCard key={s.name} station={s} rank={i} />)}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Info className="w-3 h-3" />
            <span>Distances are straight-line. Actual walking times may vary. Source: Namma Metro station data + Google Geocoding API.</span>
          </div>
        </div>
      )}
    </div>
  );
};
