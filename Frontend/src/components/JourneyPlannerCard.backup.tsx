import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Flag, Clock, Sparkles, ArrowUpDown, ChevronDown, Navigation } from 'lucide-react';
import { sampleLocations } from '../data/mockRoutes';

interface JourneyPlannerCardProps {
  startLocation: string;
  destination: string;
  arrivalTime: string;
  onUpdate: (data: { startLocation: string; destination: string; arrivalTime: string }) => void;
  onPlan: () => void;
  isPlanning?: boolean;
}

// ── Time presets covering all-day commute hours ───────────────────────────────
const TIME_PRESETS = [
  '6:00 AM','6:30 AM','7:00 AM','7:30 AM',
  '8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','12:00 PM',
  '1:00 PM','2:00 PM','3:00 PM','4:00 PM',
  '5:00 PM','5:30 PM','6:00 PM','6:30 PM',
  '7:00 PM','8:00 PM','9:00 PM',
];

// ── Google Places Autocomplete input ─────────────────────────────────────────
interface PlacesInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (val: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  suggestions: string[];
  suggestionsLabel: string;
}

const PlacesInput: React.FC<PlacesInputProps> = ({
  value, onChange, onSelect, placeholder, icon, suggestions, suggestionsLabel,
}) => {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Wire up Google Places Autocomplete
  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    if (autocompleteRef.current) return; // already attached

    try {
      const ac = new placesLib.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['formatted_address', 'name', 'geometry'],
        bounds: new google.maps.LatLngBounds(
          { lat: 12.7343, lng: 77.3795 }, // SW Bengaluru
          { lat: 13.1407, lng: 77.7832 }  // NE Bengaluru
        ),
        strictBounds: false,
      });
      autocompleteRef.current = ac;

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        const name = place.name || place.formatted_address || '';
        const address = place.formatted_address || name;
        // Use "Name, City" format for cleaner display
        const display = name && address && !address.startsWith(name)
          ? `${name}, ${address.split(',').slice(-2).join(',').trim()}`
          : address;
        onSelect(display);
        setShowSuggestions(false);
      });
    } catch { /* ignore if Places API not available */ }
  }, [placesLib, onSelect]);

  const filtered = suggestions.filter(s =>
    value.length > 1 ? s.toLowerCase().includes(value.toLowerCase()) : true
  );

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <span className="absolute left-3 text-slate-400 pointer-events-none">{icon}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
          autoComplete="off"
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setShowSuggestions(v => !v); }}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Suggestions dropdown – only shown when Places autocomplete hasn't taken over */}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 max-h-52 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {suggestionsLabel}
          </div>
          {filtered.slice(0, 10).map(loc => (
            <button
              key={loc}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(loc); setShowSuggestions(false); }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${value === loc ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'}`}
            >
              <Navigation className="w-3 h-3 shrink-0 opacity-50" />
              <span className="truncate">{loc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main JourneyPlannerCard ────────────────────────────────────────────────────
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
  const [timeMode, setTimeMode] = useState<'arrival' | 'departure'>('arrival');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const timePickerRef = useRef<HTMLDivElement>(null);

  // Sync props → local state when parent updates
  useEffect(() => { setStartLoc(startLocation); }, [startLocation]);
  useEffect(() => { setDestLoc(destination); }, [destination]);
  useEffect(() => { setTime(arrivalTime); }, [arrivalTime]);

  // Close time picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notify = useCallback((s: string, d: string, t: string) => {
    onUpdate({ startLocation: s, destination: d, arrivalTime: t });
  }, [onUpdate]);

  const handleSwap = () => {
    setStartLoc(destLoc);
    setDestLoc(startLoc);
    notify(destLoc, startLoc, time);
  };

  const handleTimeSelect = (t: string) => {
    setTime(t);
    setShowTimePicker(false);
    notify(startLoc, destLoc, t);
  };

  const handleCustomTime = () => {
    if (!customTime) return;
    // Convert HH:MM (native time input) to 12-h display
    const [hStr, mStr] = customTime.split(':');
    const h = parseInt(hStr, 10), m = parseInt(mStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const display = `${h12}:${m.toString().padStart(2, '0')} ${period}`;
    handleTimeSelect(display);
    setCustomTime('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    notify(startLoc, destLoc, time);
    onPlan();
  };

  // Time label shown in input
  const timeLabel = time
    ? `${timeMode === 'arrival' ? 'Arrive by' : 'Depart at'} ${time}`
    : 'Select time';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 fill-blue-600 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Plan Your Journey</h2>
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
          {/* Starting Location with Places Autocomplete */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Starting Location
            </label>
            <PlacesInput
              value={startLoc}
              onChange={v => { setStartLoc(v); notify(v, destLoc, time); }}
              onSelect={v => { setStartLoc(v); notify(v, destLoc, time); }}
              placeholder="Enter or search starting point"
              icon={<MapPin className="w-4 h-4" />}
              suggestions={sampleLocations}
              suggestionsLabel="Popular Bengaluru Spots"
            />
          </div>

          {/* Destination with Places Autocomplete */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Destination
            </label>
            <PlacesInput
              value={destLoc}
              onChange={v => { setDestLoc(v); notify(startLoc, v, time); }}
              onSelect={v => { setDestLoc(v); notify(startLoc, v, time); }}
              placeholder="Enter or search destination"
              icon={<Flag className="w-4 h-4" />}
              suggestions={sampleLocations}
              suggestionsLabel="Popular Destinations"
            />
          </div>

          {/* Time picker with Arrival / Departure toggle */}
          <div className="relative" ref={timePickerRef}>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Travel Time
            </label>

            {/* Mode toggle pills */}
            <div className="inline-flex mb-2 p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTimeMode('arrival')}
                className={`px-3 py-1 rounded-md transition-all ${timeMode === 'arrival' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Arrival time
              </button>
              <button
                type="button"
                onClick={() => setTimeMode('departure')}
                className={`px-3 py-1 rounded-md transition-all ${timeMode === 'departure' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Departure time
              </button>
            </div>

            {/* Time display input */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-400 pointer-events-none">
                <Clock className="w-4 h-4" />
              </span>
              <button
                type="button"
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="w-full text-left pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {timeLabel}
              </button>
            </div>

            {/* Time picker dropdown */}
            {showTimePicker && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {timeMode === 'arrival' ? 'Select Arrival Time' : 'Select Departure Time'}
                </div>

                {/* Preset grid */}
                <div className="grid grid-cols-4 gap-1 mb-3 max-h-40 overflow-y-auto">
                  {TIME_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleTimeSelect(preset)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-medium text-center transition-colors ${
                        time === preset
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Custom time input */}
                <div className="border-t border-slate-100 pt-2 mt-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Custom time
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={customTime}
                      onChange={e => setCustomTime(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={handleCustomTime}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Set
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Plan button */}
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

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Bengaluru Traffic AI Engine</span>
        <span className="text-emerald-600 font-medium">⚡ Real-time synced</span>
      </div>
    </div>
  );
};
