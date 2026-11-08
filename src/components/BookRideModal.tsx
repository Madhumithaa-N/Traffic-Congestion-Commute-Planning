import React, { useState } from 'react';
import { X, CheckCircle, ShieldCheck, Zap } from 'lucide-react';
import { CabService, RouteOption } from '../data/mockRoutes';

interface BookRideModalProps {
  service: CabService;
  route: RouteOption;
  startLocation: string;
  destination: string;
  onClose: () => void;
}

export const BookRideModal: React.FC<BookRideModalProps> = ({
  service,
  route,
  startLocation,
  destination,
  onClose,
}) => {
  const [isBooked, setIsBooked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isBooked ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
                {service.brand === 'Uber' && 'Uber'}
                {service.brand === 'Namma Yatri' && 'NY'}
                {service.brand === 'Ola' && 'Ola'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{service.name} Ride</h3>
                <p className="text-xs text-slate-500">Fast pickup available in Rajajinagar</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2.5 mb-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Trip Distance</span>
                <span className="font-semibold text-slate-900">{route.distance}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Selected Route</span>
                <span className="font-semibold text-slate-900">{route.via}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Duration</span>
                <span className="font-semibold text-slate-900">{service.duration}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pickup Time</span>
                <span className="font-semibold text-emerald-600">{service.suggestedDeparture} (Recommended)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Estimated Fare</span>
                <span className="text-emerald-700">{service.estimatedFare}</span>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>SmartRoute AI locks your departure ETA to bypass Mysore Road signal peaks.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Zero surge guarantee for scheduled departures.</span>
              </div>
            </div>

            <button
              onClick={() => setIsBooked(true)}
              className="w-full bg-[#1d64e8] hover:bg-[#1557d0] text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all"
            >
              Confirm Ride via {service.name}
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Ride Confirmed!</h3>
            <p className="text-xs text-slate-600 mb-4">
              Driver assigned: <span className="font-semibold text-slate-800">Ramesh K. (KA-02-AB-4921)</span> arriving at {service.suggestedDeparture}.
            </p>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-xs font-medium mb-4">
              Pickup at: {startLocation}
              <br />
              Drop: {destination}
            </div>
            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
