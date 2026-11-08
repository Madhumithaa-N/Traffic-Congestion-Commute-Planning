import React, { useState } from 'react';
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
import { defaultJourneyData, CabService, TransitService } from './data/mockRoutes';
import { Car, Train, Sparkles, Map as MapIcon, Globe } from 'lucide-react';

export default function App() {
  const [journeyData, setJourneyData] = useState(defaultJourneyData);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-1');
  const [selectedCabService, setSelectedCabService] = useState<CabService | null>(null);
  const [selectedTransitService, setSelectedTransitService] = useState<TransitService | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [transitFilter, setTransitFilter] = useState<'all' | 'cabs' | 'public'>('all');
  const [mapEngine, setMapEngine] = useState<'google' | 'vector'>('google');

  // Active route
  const activeRoute =
    journeyData.routes.find((r) => r.id === selectedRouteId) ||
    journeyData.routes[0];

  // Secondary route for background map overlay
  const secondaryRoute = journeyData.routes.find((r) => r.id !== selectedRouteId);

  // Handle location or time updates
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

  // Simulate AI route optimization & re-calculation
  const handlePlanMyJourney = () => {
    setIsPlanning(true);

    setTimeout(() => {
      setIsPlanning(false);
      setJourneyData((prev) => ({
        ...prev,
        routes: prev.routes.map((r, idx) => ({
          ...r,
          duration: idx === 0 ? '40 min' : '46 min',
        })),
      }));
    }, 700);
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f9] text-slate-900 font-sans antialiased flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Dark Navy Header */}
      <Header isLive={true} />

      {/* Main Content Dashboard */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Upper Layout: Two-Column Section (Journey Plan + Interactive Map) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
          {/* Left Column: Plan Your Journey Card */}
          <div className="lg:col-span-4 h-full">
            <JourneyPlannerCard
              startLocation={journeyData.startLocation}
              destination={journeyData.destination}
              arrivalTime={journeyData.requiredArrivalTime}
              onUpdate={handleJourneyUpdate}
              onPlan={handlePlanMyJourney}
              isPlanning={isPlanning}
            />
          </div>

          {/* Right Column: Interactive Bengaluru Traffic Map */}
          <div className="lg:col-span-8 h-full flex flex-col">
            {/* Map Mode Switcher Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Bengaluru Live Navigation Map</span>
              </div>
              <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMapEngine('google')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    mapEngine === 'google'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Google Maps (Live Connected)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapEngine('vector')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    mapEngine === 'vector'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapIcon className="w-3 h-3 text-slate-500" />
                  <span>Vector Illustrated</span>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[410px]">
              {mapEngine === 'google' ? (
                <GoogleTrafficMap
                  activeRoute={activeRoute}
                  secondaryRoute={secondaryRoute}
                  onSelectRoute={handleRouteSelect}
                  startLabel={journeyData.startLocation.split(',')[0]}
                  destLabel={journeyData.destination.split(',')[0]}
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
          </div>
        </section>

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
              <span>Cabs & Autos (3)</span>
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
              <span>Metro & BMTC (3)</span>
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

        {/* 5. Full-Width Recommendation Banner */}
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
  );
}
