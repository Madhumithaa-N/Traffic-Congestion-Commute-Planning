import React from 'react';
import { X, Train, Bus, MapPin, ArrowRight, ShieldCheck, QrCode, CheckCircle2 } from 'lucide-react';
import { TransitService } from '../data/mockRoutes';
import { NammaMetroLogo, BMTCLogo, BMTCVajraLogo } from './TransitLogos';

interface TransitDetailsModalProps {
  transit: TransitService;
  startLocation: string;
  destination: string;
  onClose: () => void;
}

export const TransitDetailsModal: React.FC<TransitDetailsModalProps> = ({
  transit,
  startLocation,
  destination,
  onClose,
}) => {
  const isMetro = transit.type === 'metro';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          {transit.agency === 'Namma Metro' && <NammaMetroLogo size={48} />}
          {transit.agency === 'BMTC' && <BMTCLogo size={48} />}
          {transit.agency === 'BMTC Vajra' && <BMTCVajraLogo size={48} />}

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">{transit.name}</h3>
              {transit.tag && (
                <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  {transit.tag}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">{transit.lineOrRoute}</p>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-3 bg-slate-50 rounded-xl p-3 text-center border border-slate-100 mb-5">
          <div>
            <span className="text-[11px] text-slate-500 block">Single Fare</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{transit.estimatedFare}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Travel Duration</span>
            <span className="text-base font-bold text-emerald-700 mt-0.5 block">{transit.duration}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Frequency</span>
            <span className="text-base font-bold text-blue-700 mt-0.5 block">{transit.frequency}</span>
          </div>
        </div>

        {/* Step-by-Step Itinerary */}
        <div className="space-y-4 mb-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Step-by-Step Commute Route
          </h4>

          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <div className="w-0.5 flex-1 bg-slate-200 my-1" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Board at {transit.details.boarding}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Suggested boarding at <span className="font-semibold text-slate-800">{transit.suggestedDeparture}</span>
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                2
              </div>
              <div className="w-0.5 flex-1 bg-slate-200 my-1" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                {transit.details.interchangeOrStops}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isMetro
                  ? 'Switch between Green Line and Purple Line via underground concourse walkway'
                  : 'Transit via dedicated bus priority lane on West Bangalore Ring Road'}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                3
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Alight at {transit.details.alighting}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {transit.details.lastMile} • Estimated arrival <span className="font-semibold text-slate-800">{transit.estimatedArrival}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Benefits banner */}
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-5 flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Cost Saving: </span>
            Save up to ₹200 compared to cabs with zero traffic delay risk during peak morning hours!
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate QR Transit Pass</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
