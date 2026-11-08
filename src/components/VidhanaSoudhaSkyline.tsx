import React from 'react';

/**
 * Detailed SVG silhouette of Bengaluru's iconic Vidhana Soudha & city skyline
 * as featured in the reference image recommendation banner.
 */
export const VidhanaSoudhaSkyline: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative pointer-events-none select-none opacity-40 md:opacity-60 ${className}`}>
      <svg
        viewBox="0 0 340 85"
        className="w-full h-auto max-h-20 text-emerald-800"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft background skyline silhouette */}
        <path
          d="M 10,80 L 10,65 L 20,65 L 20,55 L 28,55 L 28,70 L 35,70 L 35,50 L 45,50 L 45,80 Z"
          opacity="0.25"
        />
        <path
          d="M 50,80 L 50,58 L 62,58 L 62,80 Z"
          opacity="0.3"
        />
        <path
          d="M 275,80 L 275,52 L 288,52 L 288,80 Z"
          opacity="0.3"
        />
        <path
          d="M 295,80 L 295,62 L 305,62 L 305,55 L 315,55 L 315,80 Z"
          opacity="0.25"
        />
        <path
          d="M 320,80 L 320,68 L 335,68 L 335,80 Z"
          opacity="0.2"
        />

        {/* Trees / greenery clusters */}
        <circle cx="70" cy="72" r="7" opacity="0.35" />
        <circle cx="78" cy="74" r="5" opacity="0.4" />
        <circle cx="265" cy="73" r="6" opacity="0.35" />
        <circle cx="258" cy="75" r="5" opacity="0.4" />

        {/* Vidhana Soudha Main Building Structure */}
        {/* Base ground line */}
        <rect x="0" y="80" width="340" height="3" rx="1.5" opacity="0.5" />

        {/* Left Wing */}
        <rect x="85" y="60" width="45" height="20" rx="1" opacity="0.4" />
        {/* Left wing mini dome / chhatri */}
        <path d="M 90,60 L 90,52 Q 95,47 100,52 L 100,60 Z" opacity="0.5" />
        <rect x="94" y="44" width="2" height="4" opacity="0.6" />
        <circle cx="95" cy="43" r="1.5" opacity="0.7" />

        {/* Left wing windows */}
        <rect x="90" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="98" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="106" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="114" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="122" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />

        {/* Intermediate Left Pillar Block */}
        <rect x="133" y="52" width="18" height="28" rx="1" opacity="0.45" />
        <path d="M 135,52 L 135,46 Q 142,42 149,46 L 149,52 Z" opacity="0.5" />
        <rect x="141" y="39" width="2" height="4" opacity="0.6" />
        <circle cx="142" cy="38" r="1.5" opacity="0.7" />

        {/* Central Grand Portico & Staircase */}
        <path d="M 153,80 L 157,68 L 193,68 L 197,80 Z" opacity="0.5" />
        <rect x="156" y="44" width="38" height="24" opacity="0.55" />
        
        {/* Neoclassical columns */}
        <line x1="160" y1="48" x2="160" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="165" y1="48" x2="165" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="170" y1="48" x2="170" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="175" y1="48" x2="175" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="180" y1="48" x2="180" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="185" y1="48" x2="185" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="190" y1="48" x2="190" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />

        {/* Central Pediment / Entablature */}
        <polygon points="154,44 175,34 196,44" opacity="0.6" />

        {/* Grand Central Dome */}
        <rect x="163" y="32" width="24" height="4" opacity="0.6" />
        {/* Main Dome curve */}
        <path
          d="M 162,32 C 162,18 171,12 175,10 C 179,12 188,18 188,32 Z"
          opacity="0.65"
        />
        {/* Dome ribs */}
        <path
          d="M 175,10 L 175,32 M 168,16 Q 170,24 170,32 M 182,16 Q 180,24 180,32"
          stroke="#ecfdf5"
          strokeWidth="0.8"
          fill="none"
          opacity="0.8"
        />
        {/* Finial / Ashoka Lions Capital spire */}
        <line x1="175" y1="10" x2="175" y2="3" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <circle cx="175" cy="2" r="1.8" opacity="0.9" />

        {/* Intermediate Right Pillar Block */}
        <rect x="199" y="52" width="18" height="28" rx="1" opacity="0.45" />
        <path d="M 201,52 L 201,46 Q 208,42 215,46 L 215,52 Z" opacity="0.5" />
        <rect x="207" y="39" width="2" height="4" opacity="0.6" />
        <circle cx="208" cy="38" r="1.5" opacity="0.7" />

        {/* Right Wing */}
        <rect x="220" y="60" width="45" height="20" rx="1" opacity="0.4" />
        {/* Right wing mini dome / chhatri */}
        <path d="M 250,60 L 250,52 Q 255,47 260,52 L 260,60 Z" opacity="0.5" />
        <rect x="254" y="44" width="2" height="4" opacity="0.6" />
        <circle cx="255" cy="43" r="1.5" opacity="0.7" />

        {/* Right wing windows */}
        <rect x="224" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="232" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="240" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="248" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
        <rect x="256" y="65" width="4" height="6" rx="1" fill="#ecfdf5" opacity="0.9" />
      </svg>
    </div>
  );
};
