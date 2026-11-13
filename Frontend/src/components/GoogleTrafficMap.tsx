import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Polyline,
  useMap,
} from '@vis.gl/react-google-maps';
import { Layers, Train, Navigation, ShieldAlert, Sparkles, MapPin } from 'lucide-react';
import { RouteOption } from '../data/mockRoutes';

interface GoogleTrafficMapProps {
  activeRoute: RouteOption;
  secondaryRoute?: RouteOption;
  onSelectRoute?: (routeId: string) => void;
  startLabel: string;
  destLabel: string;
}

// Real-world coordinates for Bengaluru commute
const RAJAJINAGAR_COORDS = { lat: 12.9982, lng: 77.553 };
const DR_AMBEDKAR_INST_COORDS = { lat: 12.9644, lng: 77.5065 };
const MAJESTIC_INTERCHANGE = { lat: 12.9756, lng: 77.5728 };

// Route 1 GPS Path (via Mysore Rd / Chord Rd)
const ROUTE_1_GPS = [
  { lat: 12.9982, lng: 77.553 },
  { lat: 12.9915, lng: 77.549 },
  { lat: 12.984, lng: 77.545 },
  { lat: 12.978, lng: 77.541 },
  { lat: 12.971, lng: 77.535 },
  { lat: 12.965, lng: 77.53 },
  { lat: 12.9605, lng: 77.524 },
  { lat: 12.961, lng: 77.518 },
  { lat: 12.9635, lng: 77.512 },
  { lat: 12.9644, lng: 77.5065 },
];

// Route 2 GPS Path (via Tumkur Rd / Outer Ring Rd)
const ROUTE_2_GPS = [
  { lat: 12.9982, lng: 77.553 },
  { lat: 13.008, lng: 77.547 },
  { lat: 13.012, lng: 77.535 },
  { lat: 13.002, lng: 77.521 },
  { lat: 12.985, lng: 77.512 },
  { lat: 12.971, lng: 77.509 },
  { lat: 12.9644, lng: 77.5065 },
];

// Namma Metro Green Line GPS (North-South via Rajajinagar to Majestic)
const METRO_GREEN_GPS = [
  { lat: 13.018, lng: 77.555 },
  { lat: 12.9982, lng: 77.553 },
  { lat: 12.988, lng: 77.562 },
  { lat: 12.9756, lng: 77.5728 },
];

// Namma Metro Purple Line GPS (East-West via Majestic to Vijayanagar / Deepanjali Nagar)
const METRO_PURPLE_GPS = [
  { lat: 12.9756, lng: 77.5728 },
  { lat: 12.971, lng: 77.55 },
  { lat: 12.968, lng: 77.538 },
  { lat: 12.9515, lng: 77.527 },
];

// BMTC Bus Corridor GPS (Direct along Chord Road to Nagarbhavi)
const BMTC_BUS_GPS = [
  { lat: 12.9982, lng: 77.553 },
  { lat: 12.982, lng: 77.54 },
  { lat: 12.971, lng: 77.525 },
  { lat: 12.9644, lng: 77.5065 },
];

/**
 * Traffic Layer Component hook for live real-time traffic tiles
 */
const TrafficLayerComponent: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    let trafficLayer: google.maps.TrafficLayer | null = null;
    try {
      trafficLayer = new google.maps.TrafficLayer();
      if (enabled) {
        trafficLayer.setMap(map);
      }
    } catch {
      // Ignore if traffic API is not available
    }

    return () => {
      if (trafficLayer) {
        trafficLayer.setMap(null);
      }
    };
  }, [map, enabled]);

  return null;
};

export const GoogleTrafficMap: React.FC<GoogleTrafficMapProps> = ({
  activeRoute,
  secondaryRoute,
  onSelectRoute,
  startLabel,
  destLabel,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

  const [showTraffic, setShowTraffic] = useState(true);
  const [showTransit, setShowTransit] = useState(true);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [apiError, setApiError] = useState<string | null>(null);

  const activeGpsPath = activeRoute.id === 'route-2' ? ROUTE_2_GPS : ROUTE_1_GPS;
  const secondaryGpsPath =
    activeRoute.id === 'route-2' ? ROUTE_1_GPS : ROUTE_2_GPS;

  // Global auth failure catch for invalid keys
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setApiError('Google Maps API Key Authentication Notice: Check key referrers or permissions.');
    };
  }, []);

  return (
    <div className="relative w-full h-[420px] sm:h-[440px] lg:h-full min-h-[420px] rounded-2xl overflow-hidden bg-[#eaf1e8] border border-slate-200/90 shadow-sm">
      {apiError && (
        <div className="absolute top-2 left-2 right-2 z-40 bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button
            onClick={() => setApiError(null)}
            className="text-amber-700 font-bold hover:text-amber-900 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <APIProvider apiKey={apiKey}>
        <Map
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={{ lat: 12.981, lng: 77.53 }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeId={mapType}
          className="w-full h-full"
        >
          {/* Live Google Traffic Layer */}
          <TrafficLayerComponent enabled={showTraffic} />

          {/* ACTIVE ROUTE POLYLINE (Vivid Blue) */}
          <Polyline
            path={activeGpsPath}
            strokeColor="#1d64e8"
            strokeOpacity={0.95}
            strokeWeight={6}
          />

          {/* SECONDARY ROUTE POLYLINE (Dashed / Gray) */}
          {secondaryRoute && (
            <Polyline
              path={secondaryGpsPath}
              strokeColor="#64748b"
              strokeOpacity={0.65}
              strokeWeight={4}
            />
          )}

          {/* NAMMA METRO GREEN LINE OVERLAY */}
          {showTransit && (
            <Polyline
              path={METRO_GREEN_GPS}
              strokeColor="#16a34a"
              strokeOpacity={0.9}
              strokeWeight={4}
            />
          )}

          {/* NAMMA METRO PURPLE LINE OVERLAY */}
          {showTransit && (
            <Polyline
              path={METRO_PURPLE_GPS}
              strokeColor="#7e22ce"
              strokeOpacity={0.9}
              strokeWeight={4}
            />
          )}

          {/* BMTC DEDICATED BUS CORRIDOR */}
          {showTransit && (
            <Polyline
              path={BMTC_BUS_GPS}
              strokeColor="#0284c7"
              strokeOpacity={0.7}
              strokeWeight={3}
            />
          )}

          {/* START PIN: Rajajinagar (Green Pin + White Label) */}
          <AdvancedMarker
            position={RAJAJINAGAR_COORDS}
            title={startLabel}
          >
            <div className="flex flex-col items-center pointer-events-auto cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-[#16a34a] border-2 border-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
              <div className="mt-1 bg-white px-2.5 py-1 rounded-md shadow-md text-xs font-bold text-slate-900 border border-slate-200 text-center whitespace-nowrap">
                {startLabel}
              </div>
            </div>
          </AdvancedMarker>

          {/* DESTINATION PIN: Dr. Ambedkar Institute of Technology (Red Pin + White Label) */}
          <AdvancedMarker
            position={DR_AMBEDKAR_INST_COORDS}
            title={destLabel}
          >
            <div className="flex flex-col items-center pointer-events-auto cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-[#dc2626] border-2 border-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
              <div className="mt-1 bg-white px-2.5 py-1 rounded-md shadow-md text-[11px] font-bold text-slate-900 border border-slate-200 text-center leading-tight whitespace-nowrap">
                <div>Dr. Ambedkar</div>
                <div>Institute of Technology</div>
              </div>
            </div>
          </AdvancedMarker>

          {/* METRO MAJESTIC INTERCHANGE STATION PIN */}
          {showTransit && (
            <AdvancedMarker
              position={MAJESTIC_INTERCHANGE}
              title="Majestic Metro Interchange"
            >
              <div className="flex flex-col items-center pointer-events-auto cursor-pointer">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white flex items-center justify-center shadow-md">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div className="mt-0.5 bg-white px-1.5 py-0.5 rounded shadow text-[9px] font-semibold text-purple-900 border border-purple-200 whitespace-nowrap">
                  Majestic Interchange
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      {/* FLOATING TRAFFIC & TRANSIT LEGEND (Top-Right) */}
      <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-700 pointer-events-auto z-10">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#16a34a] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Fast Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#f59e0b] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#ef4444] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Heavy Traffic</span>
          </div>
          {showTransit && (
            <div className="pt-1 mt-0.5 border-t border-slate-100 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-[#7e22ce] rounded-full shrink-0" />
                <span className="text-purple-800 text-[10px] font-medium">Namma Metro</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-[#0284c7] rounded-full shrink-0" />
                <span className="text-sky-800 text-[10px] font-medium">BMTC Bus Route</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer Toggles (Bottom-Left) */}
      <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center gap-2 pointer-events-auto flex-wrap">
        <button
          type="button"
          onClick={() => setShowTraffic(!showTraffic)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
            showTraffic
              ? 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Live Traffic</span>
        </button>

        <button
          type="button"
          onClick={() => setShowTransit(!showTransit)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
            showTransit
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white'
          }`}
        >
          <Train className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">Metro & BMTC</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))
          }
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white/90 text-slate-600 hover:bg-white shadow-sm"
        >
          <span className="capitalize">{mapType === 'roadmap' ? 'Satellite' : 'Roadmap'}</span>
        </button>
      </div>

      {/* Live Google Maps Connected Badge */}
      <div className="absolute bottom-3.5 right-3.5 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Google Maps Live</span>
        </div>
      </div>
    </div>
  );
};
