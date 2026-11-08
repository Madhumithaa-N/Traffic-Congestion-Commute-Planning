import React, { useState, useRef } from 'react';
import { Plus, Minus, RotateCcw, Layers } from 'lucide-react';
import { RouteOption } from '../data/mockRoutes';

interface TrafficMapProps {
  activeRoute: RouteOption;
  secondaryRoute?: RouteOption;
  onSelectRoute?: (routeId: string) => void;
  startLabel: string;
  destLabel: string;
}

export const TrafficMap: React.FC<TrafficMapProps> = ({
  activeRoute,
  secondaryRoute,
  onSelectRoute,
  startLabel,
  destLabel,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showTransitLayer, setShowTransitLayer] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // SVG path generator from coordinate array
  const createPathD = (coords: [number, number][]) => {
    if (!coords || coords.length === 0) return '';
    return coords.reduce((acc, [x, y], idx) => {
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  // Convert coordinate points for active route
  const activePathD = createPathD(activeRoute.pathCoordinates);
  const secondaryPathD = secondaryRoute ? createPathD(secondaryRoute.pathCoordinates) : '';

  // Start & End points matching the screenshot layout
  const startPoint = activeRoute.pathCoordinates[0] || [485, 235];
  const endPoint = activeRoute.pathCoordinates[activeRoute.pathCoordinates.length - 1] || [792, 336];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[410px] sm:h-[430px] lg:h-full min-h-[410px] rounded-2xl overflow-hidden bg-[#eaf1e8] border border-slate-200/90 shadow-sm select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* SVG Canvas Map */}
      <div
        className="w-full h-full transition-transform duration-100 ease-out origin-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          viewBox="0 0 1000 550"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Map styling patterns */}
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e1e8df" strokeWidth="0.8" />
            </pattern>
            {/* Soft shadow for markers and badges */}
            <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" floodColor="#0f172a" />
            </filter>
            <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.3" floodColor="#000000" />
            </filter>
          </defs>

          {/* Base terrain */}
          <rect width="1000" height="550" fill="#f4f7f2" />

          {/* Urban land blocks / neighborhoods */}
          <path
            d="M 120,40 L 320,30 L 360,110 L 290,180 L 150,140 Z"
            fill="#edf3eb"
          />
          <path
            d="M 400,20 L 680,20 L 720,120 L 450,140 Z"
            fill="#eef4eb"
          />
          <path
            d="M 180,220 L 380,210 L 420,320 L 210,340 Z"
            fill="#edf3eb"
          />
          <path
            d="M 460,190 L 780,180 L 820,340 L 480,360 Z"
            fill="#f7f9f5"
          />
          <path
            d="M 320,360 L 600,350 L 640,490 L 310,480 Z"
            fill="#edf3eb"
          />

          {/* Green Parks & Open Spaces (Bangalore Garden City elements) */}
          {/* Sankey Tank / Malleswaram area */}
          <path
            d="M 420,100 C 440,90 480,95 490,115 C 475,135 440,140 425,125 Z"
            fill="#dbeadc"
          />
          {/* Cubbon Park Area */}
          <path
            d="M 590,260 C 620,240 660,250 670,280 C 650,305 600,310 585,285 Z"
            fill="#d5e8d6"
          />
          {/* Lalbagh Botanical Garden */}
          <ellipse cx="610" cy="380" rx="35" ry="25" fill="#d2e6d3" />
          {/* West Bangalore Green Belt */}
          <path
            d="M 140,280 C 170,270 190,290 185,330 C 160,350 130,330 140,280 Z"
            fill="#d9ecda"
          />
          <path
            d="M 750,420 C 780,410 810,430 800,470 C 770,480 740,450 750,420 Z"
            fill="#dbeadc"
          />

          {/* Water Bodies (Lakes) */}
          {/* Sankey tank water */}
          <ellipse cx="455" cy="115" rx="14" ry="9" fill="#cbe2ee" />
          {/* Ulsoor Lake */}
          <path
            d="M 720,210 C 735,200 750,215 745,230 C 735,240 720,230 720,210 Z"
            fill="#cbe2ee"
          />

          {/* Street Grid pattern */}
          <rect width="1000" height="550" fill="url(#grid-pattern)" />

          {/* Major Road Arteries (Yellow & White Base) */}
          <g strokeLinecap="round" strokeLinejoin="round">
            {/* Outer Ring Road East / North */}
            <path
              d="M 100,50 L 350,70 L 600,80 L 850,110 L 960,180"
              stroke="#ffffff"
              strokeWidth="11"
            />
            <path
              d="M 100,50 L 350,70 L 600,80 L 850,110 L 960,180"
              stroke="#fed7aa"
              strokeWidth="7"
            />

            {/* Tumkur Road / NH44 Corridor */}
            <path
              d="M 340,30 L 410,120 L 480,210 L 530,300 L 560,420 L 580,520"
              stroke="#ffffff"
              strokeWidth="12"
            />
            <path
              d="M 340,30 L 410,120 L 480,210 L 530,300 L 560,420 L 580,520"
              stroke="#ffedd5"
              strokeWidth="8"
            />

            {/* West-East Major Artery (Magadi / Mysore Road Connection) */}
            <path
              d="M 80,210 L 260,220 L 490,225 L 680,250 L 920,270"
              stroke="#ffffff"
              strokeWidth="11"
            />
            <path
              d="M 80,210 L 260,220 L 490,225 L 680,250 L 920,270"
              stroke="#fed7aa"
              strokeWidth="7"
            />

            {/* Secondary cross-streets */}
            <path
              d="M 220,110 L 250,440"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <path
              d="M 380,80 L 420,480"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <path
              d="M 620,60 L 650,480"
              stroke="#ffffff"
              strokeWidth="7"
            />
            <path
              d="M 780,100 L 790,460"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <path
              d="M 150,330 L 880,340"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <path
              d="M 180,430 L 840,430"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <path
              d="M 120,140 L 820,160"
              stroke="#ffffff"
              strokeWidth="5"
            />
          </g>

          {/* Traffic Condition Overlays (Live Traffic Lines: Green, Orange, Red) */}
          {showTrafficLayer && (
            <g strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
              {/* Green (Fast) segments */}
              <path d="M 140,55 L 290,65" stroke="#22c55e" strokeWidth="4.5" />
              <path d="M 620,83 L 780,98" stroke="#22c55e" strokeWidth="4.5" />
              <path d="M 820,103 L 930,160" stroke="#22c55e" strokeWidth="4.5" />
              <path d="M 355,50 L 390,95" stroke="#22c55e" strokeWidth="4" />
              <path d="M 120,215 L 230,220" stroke="#22c55e" strokeWidth="4.5" />
              <path d="M 570,440 L 578,505" stroke="#22c55e" strokeWidth="4" />
              <path d="M 625,120 L 635,210" stroke="#22c55e" strokeWidth="3.5" />
              <path d="M 230,300 L 245,410" stroke="#22c55e" strokeWidth="3.5" />
              <path d="M 785,150 L 788,270" stroke="#22c55e" strokeWidth="3.5" />
              <path d="M 810,310 L 870,390" stroke="#22c55e" strokeWidth="3.5" />

              {/* Orange (Moderate) segments */}
              <path d="M 392,100 L 450,175" stroke="#f59e0b" strokeWidth="4.5" />
              <path d="M 280,222 L 450,224" stroke="#f59e0b" strokeWidth="4.5" />
              <path d="M 545,340 L 560,410" stroke="#f59e0b" strokeWidth="4.5" />
              <path d="M 395,220 L 410,360" stroke="#f59e0b" strokeWidth="3.5" />
              <path d="M 640,320 L 648,430" stroke="#f59e0b" strokeWidth="3.5" />
              <path d="M 670,250 L 740,255" stroke="#f59e0b" strokeWidth="4" />
              <path d="M 450,345 L 610,345" stroke="#f59e0b" strokeWidth="3.5" />

              {/* Red (Heavy) segments - Bottlenecks like Majestic / Silk Board / Peenya */}
              <path d="M 452,180 L 478,212" stroke="#ef4444" strokeWidth="5" />
              <path d="M 505,250 L 528,295" stroke="#ef4444" strokeWidth="5" />
              <path d="M 740,255 L 790,260" stroke="#ef4444" strokeWidth="4.5" />
              <path d="M 495,350 L 525,400" stroke="#ef4444" strokeWidth="4.5" />
              <path d="M 788,275 L 792,340" stroke="#ef4444" strokeWidth="4.5" />
            </g>
          )}

          {/* NAMMA METRO & BMTC PUBLIC TRANSIT LINES */}
          {showTransitLayer && (
            <g id="public-transit-layer">
              {/* Namma Metro Green Line (North-South via Rajajinagar -> Majestic) */}
              <path
                d="M 485,80 L 485,235 L 490,270 L 505,310"
                fill="none"
                stroke="#15803d"
                strokeWidth="4"
                strokeDasharray="4 2"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Namma Metro Purple Line (East-West via Majestic -> Vijayanagar -> Mysore Rd) */}
              <path
                d="M 505,310 L 580,315 L 670,305 L 755,320 L 820,335"
                fill="none"
                stroke="#7e22ce"
                strokeWidth="4"
                strokeDasharray="4 2"
                strokeLinecap="round"
                opacity="0.9"
              />

              {/* BMTC Dedicated Priority Bus Line (Rajajinagar to Nagarbhavi via Chord Rd) */}
              <path
                d="M 485,235 L 450,245 L 460,285 L 530,295 L 620,275 L 720,295 L 792,336"
                fill="none"
                stroke="#0284c7"
                strokeWidth="3"
                strokeDasharray="3 3"
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* Majestic Interchange Station Node */}
              <g transform="translate(505, 310)" filter="url(#pin-shadow)">
                <circle cx="0" cy="0" r="6.5" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />
                <circle cx="0" cy="0" r="3.5" fill="#7e22ce" />
                <rect x="-36" y="8" width="72" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
                <text x="0" y="20" textAnchor="middle" fill="#334155" style={{ fontSize: '9px', fontWeight: 700 }}>
                  Majestic Metro
                </text>
              </g>

              {/* Metro Station Marker: Rajajinagar Station */}
              <circle cx="485" cy="235" r="4" fill="#ffffff" stroke="#15803d" strokeWidth="2" />
              {/* Metro Station Marker: Deepanjali Nagar / Attiguppe */}
              <circle cx="755" cy="320" r="4" fill="#ffffff" stroke="#7e22ce" strokeWidth="2" />
            </g>
          )}

          {/* Central City Label "Bengaluru" */}
          <text
            x="585"
            y="335"
            textAnchor="middle"
            className="font-bold fill-slate-800 tracking-wide select-none pointer-events-none"
            style={{ fontSize: '24px', letterSpacing: '0.02em', fill: '#1e293b' }}
          >
            Bengaluru
          </text>

          {/* Secondary Route (Tumkur road alternative - subtle dashed line) */}
          {secondaryRoute && secondaryPathD && (
            <g
              className="cursor-pointer transition-opacity hover:opacity-100"
              opacity="0.6"
              onClick={() => onSelectRoute && onSelectRoute(secondaryRoute.id)}
            >
              <path
                d={secondaryPathD}
                fill="none"
                stroke="#64748b"
                strokeWidth="5"
                strokeDasharray="6 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* ACTIVE ROUTE LINE (Vivid Blue Highway line matching reference) */}
          <g>
            {/* Soft blue outer glow */}
            <path
              d={activePathD}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
            />
            {/* Core prominent blue route line */}
            <path
              d={activePathD}
              fill="none"
              stroke="#1d64e8"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Animated vehicle / pulse traversing the route */}
            <circle r="4.5" fill="#ffffff" stroke="#1d64e8" strokeWidth="2.5">
              <animateMotion
                path={activePathD}
                dur="7s"
                repeatCount="indefinite"
                rotate="auto"
              />
            </circle>
          </g>

          {/* START PIN: Rajajinagar (Green Pin + White Label) */}
          <g transform={`translate(${startPoint[0]}, ${startPoint[1]})`}>
            {/* Green Map Pin */}
            <g transform="translate(0, -32)" filter="url(#pin-shadow)">
              {/* Pin Path */}
              <path
                d="M 0,-6 C -9,-6 -14,1 -14,9 C -14,19 0,34 0,34 C 0,34 14,19 14,9 C 14,1 9,-6 0,-6 Z"
                fill="#16a34a"
              />
              {/* Inner white circle */}
              <circle cx="0" cy="8" r="4.5" fill="#ffffff" />
              {/* Inner green center */}
              <circle cx="0" cy="8" r="2" fill="#16a34a" />
            </g>

            {/* White floating pill label "Rajajinagar" */}
            <g transform="translate(-48, 6)" filter="url(#badge-shadow)">
              <rect
                x="0"
                y="0"
                width="96"
                height="26"
                rx="6"
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="48"
                y="17"
                textAnchor="middle"
                className="font-bold fill-slate-900 select-none pointer-events-none"
                style={{ fontSize: '13px' }}
              >
                Rajajinagar
              </text>
            </g>
          </g>

          {/* DESTINATION PIN: Dr. Ambedkar Institute of Technology (Red Pin + White Label) */}
          <g transform={`translate(${endPoint[0]}, ${endPoint[1]})`}>
            {/* Red Map Pin */}
            <g transform="translate(0, -32)" filter="url(#pin-shadow)">
              <path
                d="M 0,-6 C -9,-6 -14,1 -14,9 C -14,19 0,34 0,34 C 0,34 14,19 14,9 C 14,1 9,-6 0,-6 Z"
                fill="#dc2626"
              />
              {/* Inner white circle */}
              <circle cx="0" cy="8" r="4.5" fill="#ffffff" />
              {/* Inner red center */}
              <circle cx="0" cy="8" r="2" fill="#dc2626" />
            </g>

            {/* White floating label "Dr. Ambedkar Institute of Technology" */}
            <g transform="translate(10, -18)" filter="url(#badge-shadow)">
              <rect
                x="0"
                y="0"
                width="142"
                height="38"
                rx="6"
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="10"
                y="16"
                className="font-bold fill-slate-900 select-none pointer-events-none"
                style={{ fontSize: '11.5px' }}
              >
                Dr. Ambedkar
              </text>
              <text
                x="10"
                y="30"
                className="font-bold fill-slate-900 select-none pointer-events-none"
                style={{ fontSize: '11.5px' }}
              >
                Institute of Technology
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* FLOATING TRAFFIC & TRANSIT LEGEND (Top-Right) */}
      <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-700 pointer-events-auto">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#16a34a] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Fast</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#f59e0b] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#ef4444] shrink-0" />
            <span className="text-slate-800 text-[11px] font-medium">Heavy</span>
          </div>
          {showTransitLayer && (
            <div className="pt-1 mt-0.5 border-t border-slate-100 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 border-b border-dashed border-[#7e22ce] shrink-0" />
                <span className="text-purple-800 text-[10px] font-medium">Metro Lines</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 border-b border-dashed border-[#0284c7] shrink-0" />
                <span className="text-sky-800 text-[10px] font-medium">BMTC Bus Route</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING ZOOM CONTROLS (Bottom-Right) */}
      <div className="absolute bottom-3.5 right-3.5 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden z-10 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom in"
          className="p-2 sm:p-2.5 text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center border-b border-slate-100"
        >
          <Plus className="w-4 h-4 font-bold" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom out"
          className="p-2 sm:p-2.5 text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center border-b border-slate-100"
        >
          <Minus className="w-4 h-4 font-bold" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset map view"
          className="p-2 sm:p-2.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center text-[10px]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layer Toggles (Bottom-Left) */}
      <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowTrafficLayer(!showTrafficLayer)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
            showTrafficLayer
              ? 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Traffic Overlay</span>
        </button>

        <button
          type="button"
          onClick={() => setShowTransitLayer(!showTransitLayer)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
            showTransitLayer
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
          <span className="hidden sm:inline">Metro & BMTC</span>
        </button>
      </div>
    </div>
  );
};
