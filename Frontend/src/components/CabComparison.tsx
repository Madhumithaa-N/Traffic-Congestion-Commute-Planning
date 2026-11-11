import React from 'react';
import { Car, Clock, Flag, Info } from 'lucide-react';
import { CabService } from '../data/mockRoutes';

interface CabComparisonProps {
  services: CabService[];
  onSelectService?: (service: CabService) => void;
  selectedServiceId?: string;
}

export const CabComparison: React.FC<CabComparisonProps> = ({
  services,
  onSelectService,
  selectedServiceId,
}) => {
  return (
    <section className="mt-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
        <div className="flex items-center gap-2.5">
          <Car className="w-5 h-5 text-blue-600 stroke-[2.2]" />
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Cab Fare & Departure Comparison
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Sample estimates only — live fares and ETAs vary by availability and traffic.</span>
        </div>
      </div>

      {/* 3 Horizontally Aligned Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map((service) => {
          const isHighlighted = service.isHighlighted;
          const isUserSelected = selectedServiceId === service.id;

          return (
            <div
              key={service.id}
              onClick={() => onSelectService && onSelectService(service)}
              className={`rounded-2xl p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer relative ${
                isHighlighted
                  ? 'bg-white border-2 border-[#16a34a] shadow-sm hover:shadow-md'
                  : 'bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
              } ${isUserSelected ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* Highlight badge for Best Balance (Namma Yatri) */}
              {isHighlighted && service.tag && (
                <div className="absolute -top-3.5 right-6 bg-[#16a34a] text-white text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-sm tracking-wide">
                  {service.tag}
                </div>
              )}

              {/* Brand Logo & Name */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {/* Brand Logos */}
                  {service.brand === 'Uber' && (
                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs">
                      <span className="text-white font-bold text-[13px] tracking-tight">
                        Uber
                      </span>
                    </div>
                  )}

                  {service.brand === 'Namma Yatri' && (
                    <div className="w-10 h-10 rounded-xl bg-[#032e3b] flex flex-col items-center justify-center shrink-0 p-1 shadow-xs">
                      <span className="text-white font-bold text-[9px] leading-tight">
                        namma
                      </span>
                      <span className="text-emerald-400 font-bold text-[10px] leading-tight">
                        yatri
                      </span>
                    </div>
                  )}

                  {service.brand === 'Ola' && (
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0 border border-slate-900 p-1 shadow-xs relative">
                      <div className="w-6 h-6 rounded-full border-2 border-[#a3e635] flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#a3e635]" />
                      </div>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-slate-900 leading-none">
                    {service.name}
                  </h3>
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
                      <span className="truncate">Suggested Departure</span>
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 tracking-tight">
                      {service.suggestedDeparture}
                    </span>
                  </div>

                  {/* Estimated Arrival */}
                  <div className="pl-2">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <Flag className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">Estimated Arrival</span>
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 tracking-tight">
                      {service.estimatedArrival}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Duration Badge */}
              <div className="pt-1">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${service.colorScheme.pillBg} ${service.colorScheme.pillText} ${service.colorScheme.pillBorder}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{service.duration}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
