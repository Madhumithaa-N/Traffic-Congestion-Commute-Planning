import React from 'react';
import { Map as MapIcon } from 'lucide-react';
import { RouteOption } from '../data/mockRoutes';

interface RouteComparisonProps {
  routes: RouteOption[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
}

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
}) => {
  return (
    <section className="mt-6">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <MapIcon className="w-5 h-5 text-blue-600 stroke-[2.2]" />
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Route Comparison
        </h2>
      </div>

      {/* Two route cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          const status = route.trafficStatus; // 'Fast' | 'Moderate' | 'Heavy' from mapCongestion

          // Traffic pill config – maps 3-value trafficStatus to display
          const pillConfig = {
            Heavy:    { bg: 'bg-[#fff7ed]', text: 'text-[#c2410c]', border: 'border-[#fed7aa]', dot: 'bg-[#f97316]', label: 'HEAVY' },
            Moderate: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', border: 'border-[#fde68a]', dot: 'bg-[#f59e0b]', label: 'MODERATE' },
            Fast:     { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', border: 'border-[#bbf7d0]', dot: 'bg-[#22c55e]', label: 'LOW' },
          } as const;
          const pill = pillConfig[status] ?? pillConfig.Fast;

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`relative rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-[#f0f6ff] border-2 border-blue-400 shadow-sm'
                  : 'bg-white border border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              {/* Floating "Recommended" Badge for Route 1 */}
              {route.isRecommended && (
                <div className="absolute -top-3.5 right-6 bg-[#1d64e8] text-white text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-sm tracking-wide">
                  Recommended
                </div>
              )}

              {/* Left Column: Radio button + Route Name + Distance */}
              <div className="flex items-center gap-3.5">
                {/* Radio Circle */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-2 border-blue-600 bg-white'
                      : 'border-2 border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>

                {/* Details */}
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                    {route.name} – {route.via}
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm font-normal mt-0.5">
                    {route.duration} • {route.distance}
                  </p>
                </div>
              </div>

              {/* Right Column: Traffic Status Pill */}
              <div className="shrink-0 pl-2">
                <div className={`inline-flex items-center gap-1.5 ${pill.bg} ${pill.text} border ${pill.border} text-xs font-semibold px-3 py-1 rounded-full`}>
                  <span className={`w-2 h-2 rounded-full ${pill.dot}`} />
                  <span>{pill.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
