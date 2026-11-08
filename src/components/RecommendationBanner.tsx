import React from 'react';
import { Check } from 'lucide-react';
import { VidhanaSoudhaSkyline } from './VidhanaSoudhaSkyline';

interface RecommendationBannerProps {
  recommendedService: string;
  recommendationReason: string;
  onBookClick?: () => void;
}

export const RecommendationBanner: React.FC<RecommendationBannerProps> = ({
  recommendedService,
  recommendationReason,
  onBookClick,
}) => {
  return (
    <div className="mt-6 relative overflow-hidden bg-[#ebf8f2] border border-[#cbeee0] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
      {/* Left content: Check icon + Recommendation text */}
      <div className="flex items-center gap-3.5 sm:gap-4 z-10 relative">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#16a34a] text-white flex items-center justify-center shrink-0 shadow-xs">
          <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.8]" />
        </div>

        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
            Recommended: {recommendedService}
          </h3>
          <p className="text-slate-600 text-xs sm:text-sm font-normal mt-0.5">
            {recommendationReason}
          </p>
        </div>
      </div>

      {/* Right content: Vidhana Soudha & Bengaluru City Skyline Illustration */}
      <div className="absolute right-0 bottom-0 top-0 w-64 sm:w-80 md:w-96 flex items-end justify-end pointer-events-none overflow-hidden pr-2">
        <VidhanaSoudhaSkyline className="w-full h-full flex items-end justify-end" />
      </div>

      {/* Optional action pill on hover/focus if clicked */}
      {onBookClick && (
        <button
          type="button"
          onClick={onBookClick}
          className="hidden lg:flex items-center gap-1.5 z-10 bg-white/80 hover:bg-white text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-300/60 shadow-xs transition-colors cursor-pointer"
        >
          <span>View Ride Details</span>
        </button>
      )}
    </div>
  );
};
