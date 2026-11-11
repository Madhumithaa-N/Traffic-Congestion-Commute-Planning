import React from 'react';
import { Train, Clock, Flag, Info, ArrowRight, Zap, Bus } from 'lucide-react';
import { TransitService } from '../data/mockRoutes';
import { NammaMetroLogo, BMTCLogo, BMTCVajraLogo } from './TransitLogos';

interface PublicTransitComparisonProps {
  transitServices: TransitService[];
  onSelectTransit?: (transit: TransitService) => void;
  selectedTransitId?: string;
}

export const PublicTransitComparison: React.FC<PublicTransitComparisonProps> = ({
  transitServices,
  onSelectTransit,
  selectedTransitId,
}) => {
  return (
    <section className="mt-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
        <div className="flex items-center gap-2.5">
          <Train className="w-5 h-5 text-purple-700 stroke-[2.2]" />
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Public Transit: Metro & BMTC Comparison
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Eco-friendly, fixed fares, and dedicated metro corridors.</span>
        </div>
      </div>

      {/* 3 Horizontally Aligned Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {transitServices.map((service) => {
          const isSelected = selectedTransitId === service.id;
          const isMetro = service.type === 'metro';

          return (
            <div
              key={service.id}
              onClick={() => onSelectTransit && onSelectTransit(service)}
              className={`rounded-2xl p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer relative ${
                service.isHighlighted
                  ? 'bg-white border-2 border-purple-500 shadow-sm hover:shadow-md'
                  : 'bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
              } ${isSelected ? 'ring-2 ring-purple-600' : ''}`}
            >
              {/* Highlight badge on top right */}
              {service.tag && (
                <div
                  className={`absolute -top-3.5 right-6 ${service.colorScheme.badgeBg} ${service.colorScheme.badgeText} text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-sm tracking-wide flex items-center gap-1`}
                >
                  {service.tag}
                </div>
              )}

              {/* Brand Logo & Name */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {/* Logos */}
                  {service.agency === 'Namma Metro' && (
                    <NammaMetroLogo size={42} />
                  )}
                  {service.agency === 'BMTC' && (
                    <BMTCLogo size={42} />
                  )}
                  {service.agency === 'BMTC Vajra' && (
                    <BMTCVajraLogo size={42} />
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      {service.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {service.lineOrRoute}
                    </p>
                  </div>
                </div>

                {/* Route Station summary preview */}
                <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 my-3 text-[11px] text-slate-600 flex items-center gap-1.5 overflow-hidden">
                  <span className="font-semibold text-slate-800 truncate">
                    {service.details.boarding.split('(')[0]}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">
                    {service.details.alighting.split('(')[0]}
                  </span>
                </div>

                {/* 3 Metric Columns with dividers */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 py-1 mb-4">
                  {/* Estimated Fare */}
                  <div className="pr-2">
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Estimated Fare
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 tracking-tight">
                      {service.estimatedFare}
                    </span>
                  </div>

                  {/* Suggested Departure */}
                  <div className="px-2">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">Departure</span>
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 tracking-tight">
                      {service.suggestedDeparture}
                    </span>
                  </div>

                  {/* Estimated Arrival */}
                  <div className="pl-2">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <Flag className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">Arrival</span>
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 tracking-tight">
                      {service.estimatedArrival}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Duration Badge & Frequency */}
              <div className="pt-1 flex items-center justify-between">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${service.colorScheme.pillBg} ${service.colorScheme.pillText} ${service.colorScheme.pillBorder}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{service.duration}</span>
                </div>

                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  {isMetro ? (
                    <Zap className="w-3 h-3 text-amber-500" />
                  ) : (
                    <Bus className="w-3 h-3 text-blue-500" />
                  )}
                  <span>{service.frequency}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
