import React from 'react';

/**
 * Official style vector logos for Bengaluru public transport:
 * - Namma Metro (BMRCL - Purple & Green Line branding)
 * - BMTC (Bengaluru Metropolitan Transport Corporation)
 * - BMTC Vajra (AC Volvo fleet)
 */

export const NammaMetroLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-[#581c87] via-[#6b21a8] to-[#14532d] p-1 flex items-center justify-center shrink-0 shadow-sm border border-purple-900/30 ${className}`}
      title="Namma Metro (BMRCL)"
    >
      <svg
        viewBox="0 0 48 48"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle badge */}
        <circle cx="24" cy="24" r="22" fill="#ffffff" />
        
        {/* Purple Line Ribbon Track */}
        <path
          d="M 10 32 C 14 18, 22 14, 38 14"
          stroke="#7e22ce"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Green Line Ribbon Track */}
        <path
          d="M 10 37 C 22 37, 30 30, 38 19"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Metro Train Front Silhouette */}
        <rect x="20" y="16" width="16" height="18" rx="4" fill="#1e1b4b" />
        {/* Windshield */}
        <rect x="22" y="18" width="12" height="6" rx="1.5" fill="#38bdf8" />
        {/* Headlights */}
        <circle cx="24" cy="30" r="1.5" fill="#facc15" />
        <circle cx="32" cy="30" r="1.5" fill="#facc15" />
        {/* Track crossing */}
        <line x1="16" y1="36" x2="40" y2="36" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const BMTCLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-xl overflow-hidden bg-[#002f6c] p-1 flex items-center justify-center shrink-0 shadow-sm border border-blue-900/40 ${className}`}
      title="Bengaluru Metropolitan Transport Corporation (BMTC)"
    >
      <svg
        viewBox="0 0 48 48"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Inner white shield */}
        <circle cx="24" cy="24" r="21" fill="#ffffff" />
        
        {/* Outer navy rim */}
        <circle cx="24" cy="24" r="19" stroke="#002f6c" strokeWidth="2" fill="none" />

        {/* Classic BMTC Bus Front */}
        <path
          d="M 13 14 C 13 11 17 10 24 10 C 31 10 35 11 35 14 L 35 32 C 35 34 33 35 31 35 L 17 35 C 15 35 13 34 13 32 Z"
          fill="#004085"
        />

        {/* Red bumper stripe */}
        <rect x="13" y="29" width="22" height="3" fill="#dc2626" />

        {/* Front destination board display */}
        <rect x="16" y="12" width="16" height="3.5" rx="1" fill="#fef08a" />
        <line x1="18" y1="13.7" x2="30" y2="13.7" stroke="#1e293b" strokeWidth="1" strokeLinecap="round" />

        {/* Windshield */}
        <path
          d="M 15 17 L 33 17 L 33 24 L 15 24 Z"
          fill="#e0f2fe"
        />
        {/* Center divider */}
        <line x1="24" y1="17" x2="24" y2="24" stroke="#004085" strokeWidth="1" />

        {/* Headlights */}
        <circle cx="16.5" cy="26.5" r="1.5" fill="#fef08a" />
        <circle cx="31.5" cy="26.5" r="1.5" fill="#fef08a" />

        {/* Wheels */}
        <rect x="15" y="34" width="4" height="4" rx="1" fill="#1e293b" />
        <rect x="29" y="34" width="4" height="4" rx="1" fill="#1e293b" />

        {/* Tiny "BMTC" inscription banner underneath */}
        <rect x="11" y="37" width="26" height="7" rx="2" fill="#002f6c" />
        <text
          x="24"
          y="42.5"
          textAnchor="middle"
          fill="#ffffff"
          style={{ fontSize: '5.5px', fontWeight: 900, letterSpacing: '0.6px', fontFamily: 'sans-serif' }}
        >
          BMTC
        </text>
      </svg>
    </div>
  );
};

export const BMTCVajraLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0c4a6e] p-1 flex items-center justify-center shrink-0 shadow-sm border border-sky-900/40 ${className}`}
      title="BMTC Vajra (AC Volvo Service)"
    >
      <svg
        viewBox="0 0 48 48"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Inner white shield */}
        <circle cx="24" cy="24" r="21" fill="#ffffff" />

        {/* AC Snowflake Emblem */}
        <circle cx="24" cy="20" r="13" fill="#e0f2fe" />

        {/* Sleek Low-floor Volvo Coach Front */}
        <path
          d="M 12 16 C 12 12 16 11 24 11 C 32 11 36 12 36 16 L 36 32 C 36 34 34 35 32 35 L 16 35 C 14 35 12 34 12 32 Z"
          fill="#0284c7"
        />

        {/* Continuous aerodynamic panoramic windshield */}
        <path
          d="M 14 14 L 34 14 L 34 23 L 14 23 Z"
          fill="#0f172a"
        />
        <path
          d="M 15 15 L 33 15 L 33 22 L 15 22 Z"
          fill="#38bdf8"
          opacity="0.85"
        />

        {/* Digital LED Route board */}
        <rect x="17" y="12" width="14" height="2" rx="0.5" fill="#f59e0b" />

        {/* Projector headlights */}
        <ellipse cx="15" cy="27" rx="2" ry="1.2" fill="#ffffff" />
        <ellipse cx="33" cy="27" rx="2" ry="1.2" fill="#ffffff" />

        {/* Vajra text bar */}
        <rect x="10" y="37" width="28" height="7" rx="2" fill="#0369a1" />
        <text
          x="24"
          y="42.5"
          textAnchor="middle"
          fill="#ffffff"
          style={{ fontSize: '5.5px', fontWeight: 900, letterSpacing: '0.8px', fontFamily: 'sans-serif' }}
        >
          VAJRA
        </text>
      </svg>
    </div>
  );
};
