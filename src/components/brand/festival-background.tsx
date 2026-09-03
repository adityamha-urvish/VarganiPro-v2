import React from 'react';
import siddhivinayakBg from '@/assets/backgrounds/siddhivinayak_prabhadevi_bg.jpg';
import deviBg from '@/assets/backgrounds/devi_fest_bg.jpg';
import neutralBg from '@/assets/backgrounds/neutral_fest_bg.jpg';

export type FestivalType = 'ganpati' | 'navratri' | 'other';

interface FestivalBackgroundProps {
  festival?: FestivalType;
  className?: string;
}

export const FestivalBackground: React.FC<FestivalBackgroundProps> = ({
  festival = 'other',
  className = '',
}) => {
  const bgConfig = {
    ganpati: {
      image: siddhivinayakBg,
      position: 'center 38%',
      opacity: 'opacity-20',
      blur: 'blur-[1.5px]',
      gradient: 'radial-gradient(circle at 72% 48%, rgba(6, 21, 28, 0.40) 0%, rgba(6, 21, 28, 0.94) 75%)',
    },
    navratri: {
      image: deviBg,
      position: 'center 38%',
      opacity: 'opacity-20',
      blur: 'blur-[1.5px]',
      gradient: 'radial-gradient(circle at 72% 48%, rgba(6, 21, 28, 0.40) 0%, rgba(6, 21, 28, 0.94) 75%)',
    },
    other: {
      image: neutralBg,
      position: 'center 40%',
      opacity: 'opacity-20',
      blur: 'blur-[1.5px]',
      gradient: 'radial-gradient(circle at 72% 50%, rgba(6, 21, 28, 0.45) 0%, rgba(6, 21, 28, 0.94) 75%)',
    },
  }[festival];

  return (
    <div
      className={'absolute inset-0 pointer-events-none overflow-hidden bg-[#06151c] ' + className}
      aria-hidden="true"
    >
      {/* High-Resolution Photographic Sanctum Background Layer */}
      <div
        className={'absolute inset-0 bg-cover ' + bgConfig.opacity + ' ' + bgConfig.blur + ' transition-opacity duration-700'}
        style={{
          backgroundImage: `${bgConfig.gradient}, url("${bgConfig.image}")`,
          backgroundPosition: bgConfig.position,
        }}
      />

      {/* Atmospheric Dhoop / Incense Smoke Diffusion Layer */}
      <div className="smoke-layer" />

      {/* Deep Teal Atmospheric Radial Edge Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(6, 21, 28, 0.85) 100%)',
        }}
      />
    </div>
  );
};
