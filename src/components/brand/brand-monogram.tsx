import React from 'react';

interface BrandMonogramProps {
  variant?: 'golden-arch' | 'sunlit-duo-tone';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const BrandMonogram: React.FC<BrandMonogramProps> = ({
  variant = 'golden-arch',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl p-0.5',
    md: 'w-11 h-11 rounded-2xl p-0.5',
    lg: 'w-14 h-14 rounded-2xl p-1',
    xl: 'w-20 h-20 rounded-3xl p-1.5',
  }[size];

  const innerRadius = {
    sm: 'rounded-[10px]',
    md: 'rounded-[14px]',
    lg: 'rounded-[16px]',
    xl: 'rounded-[22px]',
  }[size];

  const textSizes = {
    sm: { va: 'text-sm', p: 'text-[10px]' },
    md: { va: 'text-lg', p: 'text-xs' },
    lg: { va: 'text-2xl', p: 'text-sm' },
    xl: { va: 'text-4xl', p: 'text-xl' },
  }[size];

  if (variant === 'sunlit-duo-tone') {
    return (
      <div
        className={'inline-flex items-center justify-center shrink-0 bg-gradient-to-br from-[#ea580c] via-[#f59e0b] to-[#fbbf24] shadow-md ' + sizeClasses + ' ' + className}
        aria-label="VarganiPro Sunlit Duo-Tone Monogram"
      >
        <div
          className={'w-full h-full bg-[#fdfbf7] flex items-center justify-center gap-0.5 ' + innerRadius}
        >
          <span
            className={'font-marathi-bold font-black text-[#ea580c] leading-none ' + textSizes.va}
          >
            व
          </span>
          <span
            className={'font-pro-luxe font-black text-slate-900 leading-none ' + textSizes.p}
          >
            P
          </span>
        </div>
      </div>
    );
  }

  // Default: Golden Arch (Dark Context)
  return (
    <div
      className={'inline-flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 via-orange-500 to-teal-700 shadow-lg ' + sizeClasses + ' ' + className}
      aria-label="VarganiPro Golden Arch Monogram"
    >
      <div
        className={'w-full h-full bg-[#042f2e] flex items-center justify-center gap-0.5 ' + innerRadius}
      >
        <span
          className={'font-marathi-bold font-black text-amber-400 leading-none ' + textSizes.va}
        >
          व
        </span>
        <span
          className={'font-pro-luxe font-black text-white leading-none ' + textSizes.p}
        >
          P
        </span>
      </div>
    </div>
  );
};
