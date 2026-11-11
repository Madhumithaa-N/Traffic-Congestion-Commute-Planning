import React, { useState } from 'react';
import { MapPin, Flag, Clock, Calendar, Sparkles, ArrowUpDown, ChevronDown } from 'lucide-react';
import { sampleLocations } from '../data/mockRoutes';

interface JourneyPlannerCardProps {
  startLocation: string;
  destination: string;
  arrivalTime: string;
  onUpdate: (data: { startLocation: string; destination: string; arrivalTime: string }) => void;
  onPlan: () => void;
  isPlanning?: boolean;
}

export const JourneyPlannerCard: React.FC<JourneyPlannerCardProps> = ({
  startLocation,
  destination,
  arrivalTime,
  onUpdate,
  onPlan,
  isPlanning = false,
}) => {
  const [startLoc, setStartLoc] = useState(startLocation);
  const [destLoc, setDestLoc] = useState(destination);
  const [time, setTime] = useState(arrivalTime);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const handleSwap = () => {
    const temp = startLoc;
    setStartLoc(destLoc);
    setDestLoc(temp);
    onUpdate({ startLocation: destLoc, destination: temp, arrivalTime: time });
  };

  const handleStartSelect = (loc: string) => {
    setStartLoc(loc);
    setShowStartDropdown(false);
    onUpdate({ startLocation: loc, destination: destLoc, arrivalTime: time });
  };

  const handleDestSelect = (loc: string) => {
    setDestLoc(loc);
    setShowDestDropdown(false);
    onUpdate({ startLocation: startLoc, destination: loc, arrivalTime: time });
  };

  const handleTimeSelect = (newTime: string) => {
    setTime(newTime);
    setShowTimeModal(false);
    onUpdate({ startLocation: startLoc, destination: destLoc, arrivalTime: newTime });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ startLocation: startLoc, destination: destLoc, arrivalTime: time });
    onPlan();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-full">
      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="text-blue-600">
              <MapPin className="w-5 h-5 fill-blue-600 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Plan Your Journey
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSwap}
            title="Swap locations"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Starting Location */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Starting Location
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 pointer-events-none">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={startLoc}
                onChange={(e) => {
                  setStartLoc(e.target.value);
                  onUpdate({ startLocation: e.target.value, destination: destLoc, arrivalTime: time });
                }}
                onFocus={() => setShowStartDropdown(true)}
                className="w-full pl-9.5 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                placeholder="Enter starting point"
              />
              <button
                type="button"
                onClick={() => setShowStartDropdown(!showStartDropdown)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Suggestions Dropdown */}
            {showStartDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowStartDropdown(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Popular Bengaluru Spots
                  </div>
                  {sampleLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleStartSelect(loc)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                        startLoc === loc ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{loc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Destination */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Destination
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 pointer-events-none">
                <Flag className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={destLoc}
                onChange={(e) => {
                  setDestLoc(e.target.value);
                  onUpdate({ startLocation: startLoc, destination: e.target.value, arrivalTime: time });
                }}
                onFocus={() => setShowDestDropdown(true)}
                className="w-full pl-9.5 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 truncate"
                placeholder="Enter destination"
              />
              <button
                type="button"
                onClick={() => setShowDestDropdown(!showDestDropdown)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Suggestions Dropdown */}
            {showDestDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowDestDropdown(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Popular Destinations
                  </div>
                  {sampleLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleDestSelect(loc)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                        destLoc === loc ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{loc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Required Arrival Time */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Required Arrival Time
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 pointer-events-none">
                <Clock className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={time}
                onClick={() => setShowTimeModal(true)}
                readOnly
                className="w-full pl-9.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 cursor-pointer hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowTimeModal(!showTimeModal)}
                className="absolute right-3 text-slate-500 hover:text-blue-600 transition-colors"
                title="Change Arrival Time"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            {/* Time Picker Dropdown */}
            {showTimeModal && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowTimeModal(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-30">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Select Target Arrival
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {['8:30 AM', '8:45 AM', '9:00 AM', '9:15 AM', '9:30 AM', '10:00 AM'].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleTimeSelect(preset)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-colors ${
                            time === preset
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPlanning}
              className="w-full bg-[#1d64e8] hover:bg-[#1557d0] active:scale-[0.99] text-white font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-75 cursor-pointer"
            >
              {isPlanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Calculating Live Routes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white/20" />
                  <span>Plan My Journey</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Subtle footnote */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Bengaluru Traffic AI Engine</span>
        <span className="text-emerald-600 font-medium">⚡ Real-time synced</span>
      </div>
    </div>
  );
};
