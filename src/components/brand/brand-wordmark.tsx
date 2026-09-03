import React from 'react';

interface BrandWordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeConfig = {
    sm: { va: 'text-2xl', pro: 'text-sm' },
    md: { va: 'text-3xl', pro: 'text-base' },
    lg: { va: 'text-5xl sm:text-6xl', pro: 'text-2xl sm:text-3xl' },
    hero: { va: 'text-6xl sm:text-7xl lg:text-8xl', pro: 'text-3xl sm:text-4xl lg:text-5xl' },
  }[size];

  return (
    <div className={'inline-flex items-baseline gap-2 sm:gap-3 ' + className}>
      <span
        className={'font-marathi-bold font-black tracking-tight text-white leading-none drop-shadow-md ' + sizeConfig.va}
      >
        वर्गणी
      </span>
      <span
        className={'font-pro-luxe font-black tracking-wider text-amber-400 leading-none drop-shadow-sm uppercase ' + sizeConfig.pro}
      >
        PRO
      </span>
    </div>
  );
};
