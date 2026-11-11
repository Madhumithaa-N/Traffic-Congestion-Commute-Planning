import React from 'react';

interface HeaderProps {
  isLive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isLive = true }) => {
  return (
    <header className="bg-[#0b1728] border-b border-slate-800/80 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 flex items-center justify-between shadow-md">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div className="relative flex items-center justify-center shrink-0">
          {/* Custom SmartRoute Pin Logo matching reference */}
          <svg
            className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-sm"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Map pin base */}
            <path
              d="M22 2C13.7157 2 7 8.71573 7 17C7 26.5 22 41 22 41C22 41 37 26.5 37 17C37 8.71573 30.2843 2 22 2Z"
              fill="#1d64e8"
            />
            {/* Inner pin shadow / depth */}
            <path
              d="M22 4C14.8203 4 9 9.8203 9 17C9 25 21 37.8 22 38.9C23 37.8 35 25 35 17C35 9.8203 29.1797 4 22 4Z"
              fill="url(#blue-gradient)"
            />
            {/* Inner white winding road loop */}
            <path
              d="M15 20C15 15.5 18 12.5 22 12.5C26 12.5 29 15.5 29 19C29 23 23 22 21 25C19.5 27.2 24.5 28.5 26.5 28.5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="22" cy="18" r="3" fill="white" />
            <circle cx="22" cy="18" r="1.5" fill="#1d64e8" />
            <defs>
              <linearGradient id="blue-gradient" x1="9" y1="4" x2="35" y2="39" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight flex items-center gap-1.5 font-sans">
            SmartRoute AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-normal leading-none mt-1">
            Your intelligent commute planner
          </p>
        </div>
      </div>

      {/* Live status badge */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 bg-[#16a34a] text-white text-xs sm:text-sm font-semibold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-sm select-none">
          <span className="relative flex h-2 w-2">
            {isLive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span>Live</span>
        </div>
      </div>
    </header>
  );
};
