import React, { useState, useEffect, useRef } from 'react';
import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Layers, Train, ShieldAlert, Navigation } from 'lucide-react';
import { RouteOption } from '../data/mockRoutes';

export interface GoogleTrafficMapProps {
  activeRoute: RouteOption;
  secondaryRoute?: RouteOption;
  onSelectRoute?: (routeId: string) => void;
  startLabel: string;
  destLabel: string;
  /** Height class applied to the outer wrapper. Default: min-h-[520px] */
  heightClass?: string;
}

const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };

// Namma Metro fixed corridors
const METRO_GREEN  = [
  { lat: 13.0358, lng: 77.5972 }, { lat: 13.0181, lng: 77.5547 },
  { lat: 12.9982, lng: 77.5530 }, { lat: 12.9871, lng: 77.5634 },
  { lat: 12.9756, lng: 77.5728 },
];
const METRO_PURPLE = [
  { lat: 12.9756, lng: 77.5728 }, { lat: 12.9726, lng: 77.5942 },
  { lat: 12.9696, lng: 77.6101 }, { lat: 12.9652, lng: 77.6205 },
  { lat: 12.9593, lng: 77.6392 }, { lat: 12.9551, lng: 77.6510 },
];

// ── Decode Google encoded polyline ────────────────────────────────────────────
function decode(encoded: string): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, s = 0, r = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lat += (r & 1) ? ~(r >> 1) : r >> 1; s = 0; r = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lng += (r & 1) ? ~(r >> 1) : r >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

// ── Route colours matching Google Maps style ──────────────────────────────────
const COLOR_ACTIVE = '#1a56db';   // Google-blue for selected route
const COLOR_ALT    = '#94a3b8';   // Muted grey for alternatives

// ── SVG teardrop pin ──────────────────────────────────────────────────────────
function pinSvg(letter: 'A' | 'B', fill: string): string {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 44 58">
  <path d="M22 0C9.85 0 0 9.85 0 22c0 16 22 36 22 36s22-20 22-36C44 9.85 34.15 0 22 0z"
        fill="${fill}" stroke="white" stroke-width="3"/>
  <circle cx="22" cy="22" r="12" fill="white"/>
  <text x="22" y="27" text-anchor="middle"
        font-family="-apple-system,Segoe UI,sans-serif"
        font-size="14" font-weight="800" fill="${fill}">${letter}</text>
</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(s.trim());
}

const PIN_A = pinSvg('A', '#16a34a');
const PIN_B = pinSvg('B', '#dc2626');

// ── Route label InfoWindow content ────────────────────────────────────────────
function routeLabelHtml(durationText: string, distanceText: string, isActive: boolean): string {
  const bg = isActive ? '#1a56db' : '#ffffff';
  const fg = isActive ? '#ffffff' : '#374151';
  const border = isActive ? 'none' : '1px solid #d1d5db';
  return `<div style="
    background:${bg}; color:${fg};
    border:${border};
    border-radius:8px; padding:5px 9px;
    font-family:-apple-system,Segoe UI,sans-serif;
    font-size:13px; font-weight:700;
    box-shadow:0 2px 8px rgba(0,0,0,0.18);
    white-space:nowrap; line-height:1.35;
  ">
    <div>${durationText}</div>
    <div style="font-weight:500;font-size:11px;opacity:0.85">${distanceText}</div>
  </div>`;
}

// ── MapLayer: all imperative drawing ─────────────────────────────────────────
interface MapLayerProps {
  origin: string;
  destination: string;
  activeRouteIndex: number;
  showTraffic: boolean;
  showTransit: boolean;
}

const MapLayer: React.FC<MapLayerProps> = ({
  origin, destination, activeRouteIndex, showTraffic, showTransit,
}) => {
  const map      = useMap();
  const routesLib = useMapsLibrary('routes');

  const polylinesRef   = useRef<google.maps.Polyline[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const markerARef     = useRef<google.maps.Marker | null>(null);
  const markerBRef     = useRef<google.maps.Marker | null>(null);
  const trafficRef     = useRef<google.maps.TrafficLayer | null>(null);
  const lastKeyRef     = useRef('');

  // Traffic layer toggle
  useEffect(() => {
    if (!map) return;
    if (!trafficRef.current) {
      try { trafficRef.current = new google.maps.TrafficLayer(); } catch { return; }
    }
    trafficRef.current.setMap(showTraffic ? map : null);
    return () => { trafficRef.current?.setMap(null); };
  }, [map, showTraffic]);

  // Directions + markers + labels
  useEffect(() => {
    if (!map || !routesLib || !origin || !destination) return;
    const key = `${origin}|||${destination}|||${activeRouteIndex}|||${showTransit}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    new routesLib.DirectionsService().route(
      {
        origin, destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
        region: 'IN',
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) return;

        // Clear old overlays
        polylinesRef.current.forEach(p => p.setMap(null)); polylinesRef.current = [];
        infoWindowsRef.current.forEach(iw => iw.close());  infoWindowsRef.current = [];

        const routes = result.routes;
        const active = routes[activeRouteIndex] ?? routes[0];

        // Draw alternatives behind (grey)
        routes.forEach((route, idx) => {
          if (route === active) return;
          const raw = route.overview_polyline as unknown as { points: string } | string;
          const path = decode(typeof raw === 'string' ? raw : raw.points);
          polylinesRef.current.push(new google.maps.Polyline({
            path, strokeColor: COLOR_ALT, strokeOpacity: 0.6,
            strokeWeight: 5, zIndex: 4, map,
          }));

          // Label on midpoint of alternative
          const mid = path[Math.floor(path.length / 2)];
          const leg = route.legs[0];
          if (mid && leg) {
            const iw = new google.maps.InfoWindow({
              content: routeLabelHtml(leg.duration?.text ?? '', leg.distance?.text ?? '', false),
              position: mid,
              disableAutoPan: true,
            });
            // Use plain InfoWindow without the default close button wrapper
            iw.open({ map });
            infoWindowsRef.current.push(iw);
          }
        });

        // Draw active route on top (bold blue)
        {
          const raw = active.overview_polyline as unknown as { points: string } | string;
          const path = decode(typeof raw === 'string' ? raw : raw.points);

          // Draw a white shadow polyline first for contrast on complex backgrounds
          polylinesRef.current.push(new google.maps.Polyline({
            path, strokeColor: '#ffffff', strokeOpacity: 0.6,
            strokeWeight: 10, zIndex: 8, map,
          }));
          polylinesRef.current.push(new google.maps.Polyline({
            path, strokeColor: COLOR_ACTIVE, strokeOpacity: 0.97,
            strokeWeight: 7, zIndex: 10, map,
          }));

          // Route label on upper-third of active route (like Google Maps)
          const labelIdx = Math.floor(path.length * 0.3);
          const labelPos = path[labelIdx];
          const leg = active.legs[0];
          if (labelPos && leg) {
            const iw = new google.maps.InfoWindow({
              content: routeLabelHtml(leg.duration_in_traffic?.text ?? leg.duration?.text ?? '', leg.distance?.text ?? '', true),
              position: labelPos,
              disableAutoPan: true,
            });
            iw.open({ map });
            infoWindowsRef.current.push(iw);
          }
        }

        // Metro overlay
        if (showTransit) {
          [[METRO_GREEN, '#16a34a'], [METRO_PURPLE, '#7e22ce']].forEach(([path, color]) => {
            polylinesRef.current.push(new google.maps.Polyline({
              path: path as { lat: number; lng: number }[],
              strokeColor: color as string, strokeOpacity: 0.9,
              strokeWeight: 4, zIndex: 15, map,
            }));
          });
        }

        // A/B markers from exact leg coordinates
        const leg = active.legs[0];
        if (leg) {
          const startPos = leg.start_location;
          const endPos   = leg.end_location;

          if (!markerARef.current) {
            markerARef.current = new google.maps.Marker({
              map, zIndex: 40, title: origin,
              icon: { url: PIN_A, scaledSize: new google.maps.Size(44, 58), anchor: new google.maps.Point(22, 58) },
            });
          } else { markerARef.current.setMap(map); }
          markerARef.current.setPosition(startPos);

          if (!markerBRef.current) {
            markerBRef.current = new google.maps.Marker({
              map, zIndex: 40, title: destination,
              icon: { url: PIN_B, scaledSize: new google.maps.Size(44, 58), anchor: new google.maps.Point(22, 58) },
            });
          } else { markerBRef.current.setMap(map); }
          markerBRef.current.setPosition(endPos);
        }

        // Auto-fit
        if (active.bounds) {
          map.fitBounds(active.bounds, { top: 90, right: 80, bottom: 90, left: 80 });
        }
      },
    );

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null)); polylinesRef.current = [];
      infoWindowsRef.current.forEach(iw => iw.close());  infoWindowsRef.current = [];
      markerARef.current?.setMap(null);
      markerBRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, origin, destination, showTransit]);

  // Re-draw on route switch
  useEffect(() => { lastKeyRef.current = ''; }, [activeRouteIndex]);

  return null;
};

// ── Main exported component ───────────────────────────────────────────────────
export const GoogleTrafficMap: React.FC<GoogleTrafficMapProps> = ({
  activeRoute, startLabel, destLabel, heightClass,
}) => {
  const [showTraffic, setShowTraffic] = useState(true);
  const [showTransit, setShowTransit] = useState(false);
  const [mapType, setMapType]         = useState<'roadmap' | 'satellite'>('roadmap');
  const [apiError, setApiError]       = useState<string | null>(null);

  const activeRouteIndex = Math.max(0, parseInt(activeRoute.id.replace('route-', ''), 10) - 1);

  useEffect(() => {
    (window as any).gm_authFailure = () =>
      setApiError('Google Maps key issue – check VITE_GOOGLE_MAPS_API_KEY in Frontend/.env.local');
  }, []);

  const wrapperH = heightClass ?? 'h-[520px] lg:h-[580px]';

  return (
    <div className={`relative w-full ${wrapperH} rounded-2xl overflow-hidden bg-[#e8f0e9] border border-slate-200 shadow-sm`}>

      {apiError && (
        <div className="absolute top-2 left-2 right-2 z-40 bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="flex-1">{apiError}</span>
          <button onClick={() => setApiError(null)} className="font-bold text-amber-700 ml-1">×</button>
        </div>
      )}

      <Map
        mapId="smartroute-live-map"
        defaultCenter={BENGALURU_CENTER}
        defaultZoom={13}
        gestureHandling="greedy"
        mapTypeId={mapType}
        className="w-full h-full"
        disableDefaultUI={false}
        styles={[
          // Slightly de-saturate POI labels so route stands out
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        ]}
      >
        {startLabel && destLabel && (
          <MapLayer
            origin={startLabel}
            destination={destLabel}
            activeRouteIndex={activeRouteIndex}
            showTraffic={showTraffic}
            showTransit={showTransit}
          />
        )}
      </Map>

      {/* ── Top-left: journey info pill (only after journey is planned) ─────── */}
      {startLabel && destLabel && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-slate-200 flex flex-col gap-0.5 pointer-events-none max-w-[220px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">{startLabel.split(',')[0]}</span>
          </div>
          <div className="w-0.5 h-2 bg-slate-300 ml-1" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <span className="truncate">{destLabel.split(',')[0]}</span>
          </div>
        </div>
      )}

      {/* ── Bottom-left: layer controls ──────────────────────────────────────── */}
      <div className="absolute bottom-10 left-3 z-10 flex flex-col gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowTraffic(v => !v)}
          title="Toggle live traffic"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-all ${
            showTraffic
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Live Traffic</span>
        </button>

        <button
          type="button"
          onClick={() => setShowTransit(v => !v)}
          title="Toggle metro overlay"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-all ${
            showTransit
              ? 'bg-purple-600 text-white border-purple-700'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Train className="w-3.5 h-3.5" />
          <span>Namma Metro</span>
        </button>

        <button
          type="button"
          onClick={() => setMapType(p => p === 'roadmap' ? 'satellite' : 'roadmap')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 shadow-sm"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{mapType === 'roadmap' ? 'Satellite' : 'Map'}</span>
        </button>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-slate-200 shadow-sm pointer-events-none min-w-[130px]">
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Legend</div>
        <div className="flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <img src={PIN_A} alt="A" className="w-3.5 h-4.5 object-contain" />
            <span className="font-semibold text-emerald-800">Start (A)</span>
          </div>
          <div className="flex items-center gap-2">
            <img src={PIN_B} alt="B" className="w-3.5 h-4.5 object-contain" />
            <span className="font-semibold text-red-800">Destination (B)</span>
          </div>
          <div className="border-t border-slate-100 my-0.5" />
          <div className="flex items-center gap-2">
            <span className="w-5 h-2 rounded bg-[#1a56db] shrink-0" />
            <span className="text-slate-700 font-medium">Best route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-2 rounded bg-[#94a3b8] shrink-0" />
            <span className="text-slate-500">Alternative</span>
          </div>
          <div className="border-t border-slate-100 my-0.5" />
          <div className="flex items-center gap-2">
            <span className="w-4 h-1.5 rounded bg-emerald-500 shrink-0" />
            <span className="text-slate-500">Free flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1.5 rounded bg-amber-400 shrink-0" />
            <span className="text-slate-500">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1.5 rounded bg-red-500 shrink-0" />
            <span className="text-slate-500">Heavy traffic</span>
          </div>
        </div>
      </div>

      {/* ── Live badge ─────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
        <div className="bg-white/90 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Google Maps Live
        </div>
      </div>
    </div>
  );
};
