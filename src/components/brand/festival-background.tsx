import React from 'react';
import neighbourhoodMaster from '@/assets/visual-world/neighbourhood-master.jpg';
import neighbourhoodMobile from '@/assets/visual-world/neighbourhood-mobile.jpg';

export type FestivalType = 'ganpati' | 'navratri' | 'other';

interface FestivalBackgroundProps {
  festival?: FestivalType;
  className?: string;
}

export const FestivalBackground: React.FC<FestivalBackgroundProps> = ({
  className = '',
}) => {
  return (
    <div
      className={'absolute inset-0 pointer-events-none overflow-hidden bg-[#071318] ' + className}
      aria-hidden="true"
    >
      {/* Desktop Master Visual-World Artwork (1440x900 full bleed) */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: `url("${neighbourhoodMaster}")`,
        }}
      />

      {/* Mobile Master Visual-World Artwork (390x844 responsive portrait) */}
      <div
        className="block md:hidden absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: `url("${neighbourhoodMobile}")`,
        }}
      />

      {/* Desktop Localized Readability Gradients (Preserves central vibrancy, terracotta buildings & street depth) */}
      <div
        className="hidden md:block absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 85% at 20% 50%, rgba(5, 17, 23, 0.72) 0%, rgba(5, 17, 23, 0.38) 50%, transparent 80%), radial-gradient(circle at 82% 48%, rgba(5, 17, 23, 0.35) 0%, rgba(5, 17, 23, 0.10) 60%, transparent 100%), linear-gradient(to top, rgba(5, 17, 23, 0.65) 0%, transparent 22%), linear-gradient(to bottom, rgba(5, 17, 23, 0.50) 0%, transparent 15%)',
        }}
      />

      {/* Mobile Localized Readability Gradients (Ensures header and card legibility while keeping streetscape alive) */}
      <div
        className="block md:hidden absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(5, 17, 23, 0.82) 0%, rgba(5, 17, 23, 0.35) 45%, rgba(5, 17, 23, 0.75) 100%)',
        }}
      />
    </div>
  );
};
