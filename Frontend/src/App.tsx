import React, { useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Header } from './components/Header';
import { JourneyPlannerCard } from './components/JourneyPlannerCard';
import { TrafficMap } from './components/TrafficMap';
import { GoogleTrafficMap } from './components/GoogleTrafficMap';
import { RouteComparison } from './components/RouteComparison';
import { CabComparison } from './components/CabComparison';
import { PublicTransitComparison } from './components/PublicTransitComparison';
import { RecommendationBanner } from './components/RecommendationBanner';
import { BookRideModal } from './components/BookRideModal';
import { TransitDetailsModal } from './components/TransitDetailsModal';
import { MetroStationPanel } from './components/MetroStationPanel';
import { SmartRouteAnalysisPanel } from './components/SmartRouteAnalysisPanel';
import {
  defaultJourneyData,
  JourneyData,
  RouteOption,
  CabService,
  TransitService,
} from './data/mockRoutes';
import { planCommute, CommutePlanResponse, DepartureOption } from './services/api';
import { Car, Train, Sparkles, Map as MapIcon, Globe, AlertCircle, Clock } from 'lucide-react';

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  'AIzaSyCe2JMyzT13cmMCaIi1RvP-XYvN5wrxglM';

// ── Map congestion level strings from backend to RouteOption traffic status ───
function mapCongestion(level: string): 'Fast' | 'Moderate' | 'Heavy' {
  if (!level) return 'Fast';
  const u = level.toUpperCase();
  if (u === 'HEAVY') return 'Heavy';
  if (u === 'MODERATE') return 'Moderate';
  return 'Fast';
}

// ── Build RouteOption array from backend routes data ─────────────────────────
function buildRoutes(routesData: CommutePlanResponse['routes']): RouteOption[] {
  if (!routesData) return defaultJourneyData.routes;

  const all = [routesData.best_route, ...(routesData.alternative_routes || [])];
  const built: RouteOption[] = all.slice(0, 3).map((r, idx) => ({
    id: `route-${idx + 1}`,
    name: `Route ${idx + 1}`,
    via: r?.description ? `via ${r.description}` : 'via recommended route',
    duration: r?.duration_mins ? `${Math.round(r.duration_mins)} min` : '—',
    durationMinutes: r?.duration_mins ? Math.round(r.duration_mins) : 0,
    distance: r?.distance_km ? `${r.distance_km} km` : '—',
    trafficStatus: mapCongestion(r?.congestion_level || ''),
    isRecommended: idx === 0,
    // Keep static path coordinates from defaults for map rendering
    pathCoordinates: defaultJourneyData.routes[idx]?.pathCoordinates ||
      defaultJourneyData.routes[0].pathCoordinates,
    trafficSegments: defaultJourneyData.routes[idx]?.trafficSegments ||
      defaultJourneyData.routes[0].trafficSegments,
  }));

  return built.length > 0 ? built : defaultJourneyData.routes;
}

// ── Build CabService array from departure options ─────────────────────────────
function buildCabServices(
  departureData: CommutePlanResponse['departure'],
): CabService[] {
  if (!departureData || !departureData.options) return defaultJourneyData.cabServices;

  const cabOpts = departureData.options.filter((o: DepartureOption) => o.category === 'cab');
  if (!cabOpts.length) return defaultJourneyData.cabServices;

  const colorMap: Record<string, CabService['colorScheme']> = {
    Uber: {
      badgeBg: '', badgeText: '', badgeBorder: '',
      pillBg: 'bg-blue-50', pillText: 'text-blue-600', pillBorder: 'border-blue-200',
    },
    'Namma Yatri': {
      badgeBg: 'bg-[#16a34a]', badgeText: 'text-white', badgeBorder: 'border-transparent',
      pillBg: 'bg-emerald-50', pillText: 'text-emerald-700', pillBorder: 'border-emerald-200',
    },
    Ola: {
      badgeBg: '', badgeText: '', badgeBorder: '',
      pillBg: 'bg-purple-50', pillText: 'text-purple-700', pillBorder: 'border-purple-200',
    },
  };

  return cabOpts.map((o: DepartureOption) => ({
    id: o.provider.toLowerCase().replace(/\s+/g, '-'),
    name: o.provider,
    brand: (o.provider as 'Uber' | 'Namma Yatri' | 'Ola') || 'Uber',
    estimatedFare: `₹${o.fare_min} – ₹${o.fare_max}`,
    fareMin: o.fare_min,
    fareMax: o.fare_max,
    suggestedDeparture: o.depart,
    estimatedArrival: o.arrive,
    duration: `${o.duration_min} min`,
    durationMinutes: o.duration_min,
    tag: o.tags?.includes('Best Balance') ? 'Best Balance ★' :
      o.tags?.includes('Most Economical') ? 'Most Economical 💰' : undefined,
    isHighlighted: o.tags?.includes('Best Balance') || false,
    colorScheme: colorMap[o.provider] || colorMap['Uber'],
  }));
}

// ── Build TransitService array ────────────────────────────────────────────────
function buildTransitServices(
  departureData: CommutePlanResponse['departure'],
): TransitService[] {
  if (!departureData || !departureData.options) return defaultJourneyData.transitServices;

  const transitOpts = departureData.options.filter(
    (o: DepartureOption) => o.category === 'transit'
  );
  if (!transitOpts.length) return defaultJourneyData.transitServices;

  const providerMeta: Record<string, Partial<TransitService>> = {
    'Namma Metro': {
      type: 'metro',
      agency: 'Namma Metro',
      lineOrRoute: 'Green Line / Purple Line',
      tag: '100% Traffic Free ⚡',
      isHighlighted: true,
      colorScheme: {
        badgeBg: 'bg-[#7e22ce]',
        badgeText: 'text-white',
        pillBg: 'bg-purple-50',
        pillText: 'text-purple-800',
        pillBorder: 'border-purple-200',
      },
      details: {
        boarding: 'Nearest Metro Station (Green Line)',
        interchangeOrStops: 'Interchange at Majestic if needed',
        alighting: 'Nearest destination Metro Station',
        lastMile: '5–10 min walk / auto',
      },
    },
    'BMTC City Bus': {
      type: 'bus',
      agency: 'BMTC',
      lineOrRoute: 'City Bus Direct',
      routeNumber: 'BMTC',
      tag: 'Most Economical 💰',
      colorScheme: {
        badgeBg: 'bg-[#004085]',
        badgeText: 'text-white',
        pillBg: 'bg-blue-50',
        pillText: 'text-blue-800',
        pillBorder: 'border-blue-200',
      },
      details: {
        boarding: 'Nearest BMTC Bus Stop',
        interchangeOrStops: 'Multiple stops en route',
        alighting: 'Destination bus stop',
        lastMile: '5 min walk',
      },
    },
    'BMTC Vajra AC': {
      type: 'bus',
      agency: 'BMTC Vajra',
      lineOrRoute: 'Vajra AC Express',
      routeNumber: 'V-Route',
      tag: 'AC Comfort ❄️',
      colorScheme: {
        badgeBg: 'bg-[#0284c7]',
        badgeText: 'text-white',
        pillBg: 'bg-cyan-50',
        pillText: 'text-cyan-800',
        pillBorder: 'border-cyan-200',
      },
      details: {
        boarding: 'Nearest Vajra AC Stop',
        interchangeOrStops: 'Limited stops – faster',
        alighting: 'Destination Vajra stop',
        lastMile: '5 min walk / auto',
      },
    },
  };

  return transitOpts.map((o: DepartureOption) => ({
    id: o.provider.toLowerCase().replace(/\s+/g, '-'),
    name: o.provider,
    type: (providerMeta[o.provider]?.type || 'bus') as 'metro' | 'bus',
    agency: (providerMeta[o.provider]?.agency || 'BMTC') as TransitService['agency'],
    lineOrRoute: providerMeta[o.provider]?.lineOrRoute || 'City Route',
    routeNumber: (providerMeta[o.provider] as TransitService)?.routeNumber,
    estimatedFare: `₹${o.fare_min} – ₹${o.fare_max}`,
    fareMin: o.fare_min,
    fareMax: o.fare_max,
    suggestedDeparture: o.depart,
    estimatedArrival: o.arrive,
    duration: `${o.duration_min} min`,
    durationMinutes: o.duration_min,
    frequency: o.frequency_min ? `Every ${o.frequency_min} min` : 'On demand',
    tag: providerMeta[o.provider]?.tag || (o.tags?.[0]),
    isHighlighted: providerMeta[o.provider]?.isHighlighted || false,
    colorScheme: providerMeta[o.provider]?.colorScheme || defaultJourneyData.transitServices[0].colorScheme,
    details: (providerMeta[o.provider] as TransitService)?.details || {
      boarding: 'Nearest stop',
      interchangeOrStops: 'En route stops',
      alighting: 'Destination stop',
      lastMile: '5 min walk',
    },
  }));
}

// ── API result → JourneyData mapping ─────────────────────────────────────────
function responseToJourneyData(
  resp: CommutePlanResponse,
  startLocation: string,
  destination: string,
  arrivalTime: string,
): JourneyData {
  const routes = buildRoutes(resp.routes);
  const cabs = buildCabServices(resp.departure);
  const transit = buildTransitServices(resp.departure);

  const recProvider = resp.departure?.recommended?.provider || 'Namma Yatri';
  const recReason = resp.overall_recommendation ||
    `Leave by ${resp.departure?.recommended?.depart || 'recommended time'} via ${recProvider}.`;

  return {
    startLocation,
    destination,
    requiredArrivalTime: arrivalTime,
    routes,
    cabServices: cabs,
    transitServices: transit,
    recommendation: {
      serviceName: recProvider,
      reason: recReason,
    },
  };
}

// ── Status badge component ────────────────────────────────────────────────────
function StatusBanner({
  type,
  message,
  onDismiss,
}: {
  type: 'error' | 'success' | 'info';
  message: string;
  onDismiss: () => void;
}) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = {
    error: <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />,
    success: <AlertCircle className="w-4 h-4 shrink-0 text-emerald-500" />,
    info: <Clock className="w-4 h-4 shrink-0 text-blue-500" />,
  };

  return (
    <div className={`mb-4 px-4 py-2.5 rounded-xl border flex items-center gap-2.5 text-sm font-medium ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 font-bold opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [journeyData, setJourneyData] = useState<JourneyData>(defaultJourneyData);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-1');
  const [selectedCabService, setSelectedCabService] = useState<CabService | null>(null);
  const [selectedTransitService, setSelectedTransitService] = useState<TransitService | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [transitFilter, setTransitFilter] = useState<'all' | 'cabs' | 'public'>('all');
  const [mapEngine, setMapEngine] = useState<'google' | 'vector'>('google');
  const [hasPlanned, setHasPlanned] = useState(false);
  // Full API response stored for the analysis panel
  const [lastResponse, setLastResponse] = useState<CommutePlanResponse | null>(null);

  // UI feedback state
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dataAge, setDataAge] = useState<string>('');

  // Active route
  const activeRoute =
    journeyData.routes.find((r) => r.id === selectedRouteId) ||
    journeyData.routes[0];

  // Secondary route
  const secondaryRoute = journeyData.routes.find((r) => r.id !== selectedRouteId);

  // Handle location / time updates from the form
  const handleJourneyUpdate = (data: {
    startLocation: string;
    destination: string;
    arrivalTime: string;
  }) => {
    setJourneyData((prev) => ({
      ...prev,
      startLocation: data.startLocation,
      destination: data.destination,
      requiredArrivalTime: data.arrivalTime,
    }));
  };

  // ── Plan My Journey – real API call ──────────────────────────────────────
  const handlePlanMyJourney = async () => {
    const { startLocation, destination, requiredArrivalTime } = journeyData;
    if (!startLocation.trim() || !destination.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both a starting location and destination.' });
      return;
    }

    setIsPlanning(true);
    setStatusMessage(null);
    setWarnings([]);

    try {
      const resp = await planCommute({
        origin: startLocation,
        destination: destination,
        arrival_time: requiredArrivalTime || undefined,
      });

      // Map backend response to frontend data model
      const newData = responseToJourneyData(resp, startLocation, destination, requiredArrivalTime);
      setJourneyData(newData);
      setSelectedRouteId('route-1');
      setHasPlanned(true);
      setLastResponse(resp);
      setDataAge(new Date().toLocaleTimeString());

      if (resp.warnings && resp.warnings.length > 0) {
        setWarnings(resp.warnings);
      }

      // Surface key status
      const toolStatuses = resp.tool_statuses;
      const failedTools = Object.entries(toolStatuses)
        .filter(([, v]) => v === 'error')
        .map(([k]) => k.replace(/_/g, ' '));

      if (failedTools.length === 0) {
        setStatusMessage({
          type: 'success',
          text: `Live data fetched at ${new Date().toLocaleTimeString()}. All systems OK.`,
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: `Route planned. Some data sources unavailable: ${failedTools.join(', ')}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage({
        type: 'error',
        text: `Could not reach the SmartRoute AI backend: ${msg}. Ensure the backend is running on port 8000.`,
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
  };

  return (
    <APIProvider apiKey={MAPS_API_KEY} libraries={['places', 'geocoding', 'routes']}>
    <div className="min-h-screen bg-[#f3f6f9] text-slate-900 font-sans antialiased flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Dark Navy Header */}
      <Header isLive={true} />

      {/* Main Content Dashboard */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Status banner */}
        {statusMessage && (
          <StatusBanner
            type={statusMessage.type}
            message={statusMessage.text}
            onDismiss={() => setStatusMessage(null)}
          />
        )}

        {/* Warnings (non-Gemini) */}
        {warnings.filter(w => !w.toLowerCase().includes('gemini')).map((w, i) => (
          <div key={i} className="mb-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{w}</span>
          </div>
        ))}

        {/* ── Top section: Planner (left) + Map (right, larger) ──────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-5 items-start">

          {/* Left column: Journey Planner Card */}
          <div className="lg:col-span-4">
            <JourneyPlannerCard
              startLocation={journeyData.startLocation}
              destination={journeyData.destination}
              arrivalTime={journeyData.requiredArrivalTime}
              onUpdate={handleJourneyUpdate}
              onPlan={handlePlanMyJourney}
              isPlanning={isPlanning}
            />
          </div>

          {/* Right column: Map – tall, prominent, reference-image style */}
          <div className="lg:col-span-8 flex flex-col gap-2">
            {/* Map header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Bengaluru Live Navigation</span>
                {dataAge && <span className="text-emerald-600 ml-1.5">· Updated {dataAge}</span>}
              </div>
              <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMapEngine('google')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mapEngine === 'google' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Google Maps</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapEngine('vector')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mapEngine === 'vector' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                >
                  <MapIcon className="w-3 h-3 text-slate-500" />
                  <span>Illustrated</span>
                </button>
              </div>
            </div>

            {/* Map itself – full height */}
            {mapEngine === 'google' ? (
              <GoogleTrafficMap
                activeRoute={activeRoute}
                secondaryRoute={secondaryRoute}
                onSelectRoute={handleRouteSelect}
                startLabel={hasPlanned ? journeyData.startLocation : ''}
                destLabel={hasPlanned ? journeyData.destination : ''}
                heightClass="h-[520px] lg:h-[560px]"
              />
            ) : (
              <TrafficMap
                activeRoute={activeRoute}
                secondaryRoute={secondaryRoute}
                onSelectRoute={handleRouteSelect}
                startLabel={journeyData.startLocation.split(',')[0]}
                destLabel={journeyData.destination.split(',')[0]}
              />
            )}
          </div>
        </section>

        {/* ── SmartRoute Analysis Panel – below the map ──────────────────── */}
        {hasPlanned && lastResponse && (
          <div className="mt-5">
            <SmartRouteAnalysisPanel
              data={lastResponse}
              selectedRouteId={selectedRouteId}
              onSelectRoute={handleRouteSelect}
            />
          </div>
        )}

        {/* 2. Full-Width Route Comparison Section */}
        <RouteComparison
          routes={journeyData.routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleRouteSelect}
        />

        {/* Mode Filter Selector Pill Tabs */}
        <div className="mt-7 mb-2 flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex p-1 bg-white border border-slate-200/90 rounded-xl shadow-xs text-xs font-semibold">
            <button
              onClick={() => setTransitFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                transitFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>All Commute Modes</span>
            </button>
            <button
              onClick={() => setTransitFilter('cabs')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                transitFilter === 'cabs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Cabs & Autos ({journeyData.cabServices.length})</span>
            </button>
            <button
              onClick={() => setTransitFilter('public')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                transitFilter === 'public'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Train className="w-3.5 h-3.5" />
              <span>Metro & BMTC ({journeyData.transitServices.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Click on any card to view detailed stops, fares, and booking
          </div>
        </div>

        {/* 3. Cab Fare & Departure Comparison Section */}
        {(transitFilter === 'all' || transitFilter === 'cabs') && (
          <CabComparison
            services={journeyData.cabServices}
            onSelectService={(service) => setSelectedCabService(service)}
            selectedServiceId={selectedCabService?.id}
            dataTimestamp={dataAge || undefined}
          />
        )}

        {/* 4. Public Transit: Namma Metro & BMTC Bus Comparison Section */}
        {(transitFilter === 'all' || transitFilter === 'public') && (
          <PublicTransitComparison
            transitServices={journeyData.transitServices}
            onSelectTransit={(transit) => setSelectedTransitService(transit)}
            selectedTransitId={selectedTransitService?.id}
          />
        )}

        {/* 5. Nearby Namma Metro Stations Panel */}
        {hasPlanned && (transitFilter === 'all' || transitFilter === 'public') && (
          <MetroStationPanel
            origin={journeyData.startLocation}
            destination={journeyData.destination}
          />
        )}

        {/* 6. Full-Width Recommendation Banner */}
        <RecommendationBanner
          recommendedService={journeyData.recommendation.serviceName}
          recommendationReason={journeyData.recommendation.reason}
          onBookClick={() => {
            const rec = journeyData.cabServices.find(
              (s) => s.name === journeyData.recommendation.serviceName
            );
            if (rec) setSelectedCabService(rec);
          }}
        />

        {/* Data sources footer */}
        {dataAge && (
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-500">Live Data Sources:</span>
            <span>Google Routes API v2</span>
            <span>·</span>
            <span>ML Random Forest (Bengaluru dataset)</span>
            <span>·</span>
            <span>Departure Planner</span>
            {lastResponse?.gemini_used && (
              <>
                <span>·</span>
                <span className="text-blue-500 font-medium">Gemini AI Explanation</span>
              </>
            )}
            <span className="ml-auto">Updated: {dataAge}</span>
          </div>
        )}
      </main>

      {/* Interactive Modal when user clicks any cab service card */}
      {selectedCabService && (
        <BookRideModal
          service={selectedCabService}
          route={activeRoute}
          startLocation={journeyData.startLocation}
          destination={journeyData.destination}
          onClose={() => setSelectedCabService(null)}
        />
      )}

      {/* Interactive Modal when user clicks any public transit service card */}
      {selectedTransitService && (
        <TransitDetailsModal
          transit={selectedTransitService}
          startLocation={journeyData.startLocation}
          destination={journeyData.destination}
          onClose={() => setSelectedTransitService(null)}
        />
      )}
    </div>
    </APIProvider>
  );
}
