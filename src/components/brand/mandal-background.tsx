import React from 'react';
import mandalMaster from '@/assets/visual-world/mandal-master.jpg';
import mandalMobile from '@/assets/visual-world/mandal-mobile.jpg';

interface MandalBackgroundProps {
  className?: string;
}

export const MandalBackground: React.FC<MandalBackgroundProps> = ({
  className = '',
}) => {
  return (
    <div
      className={'absolute inset-0 pointer-events-none overflow-hidden bg-[#06151c] ' + className}
      aria-hidden="true"
    >
      {/* Desktop Master Visual-World Artwork (1440x900 full bleed) */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: `url("${mandalMaster}")`,
        }}
      />

      {/* Mobile Master Visual-World Artwork (390x844 responsive portrait) */}
      <div
        className="block md:hidden absolute inset-0 bg-cover bg-top transition-opacity duration-700"
        style={{
          backgroundImage: `url("${mandalMobile}")`,
        }}
      />

      {/* Desktop Localized Readability Gradients (Preserves mandal structure, artisan figures & fabric canopy while ensuring UI contrast) */}
      <div
        className="hidden md:block absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 75% at 82% 55%, rgba(5, 17, 23, 0.72) 0%, rgba(5, 17, 23, 0.25) 60%, transparent 100%), linear-gradient(to top, rgba(5, 17, 23, 0.65) 0%, transparent 25%), linear-gradient(to bottom, rgba(5, 17, 23, 0.55) 0%, transparent 15%)',
        }}
      />

      {/* Mobile Localized Readability Gradients (Ensures top bar, 2x2 grid and CTA clarity while keeping artwork atmosphere) */}
      <div
        className="block md:hidden absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(5, 17, 23, 0.75) 0%, rgba(5, 17, 23, 0.25) 45%, rgba(5, 17, 23, 0.90) 100%)',
        }}
      />
    </div>
  );
};
