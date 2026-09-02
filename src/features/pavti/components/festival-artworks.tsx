import {
  GANESH_ARTWORK_DATA_URL,
  DURGA_ARTWORK_DATA_URL,
} from "../assets/artwork-data";

export function GaneshaArtwork({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <img
      src={GANESH_ARTWORK_DATA_URL}
      alt="Lord Ganesha"
      className={`object-contain ${className}`}
    />
  );
}

export function DurgaArtwork({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <img
      src={DURGA_ARTWORK_DATA_URL}
      alt="Goddess Durga"
      className={`object-contain ${className}`}
    />
  );
}

export function NeutralMandalaArtwork({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mandala Crest">
      {/* Outer Rings */}
      <circle cx="50" cy="50" r="46" fill="#F0FDF4" stroke="#15803D" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="50" cy="50" r="40" stroke="#16A34A" strokeWidth="1" />
      <circle cx="50" cy="50" r="34" fill="#DCFCE7" fillOpacity="0.5" stroke="#15803D" strokeWidth="0.8" />

      {/* 8-Petal Rosette / Mandala */}
      <g stroke="#166534" strokeWidth="1.2" fill="#86EFAC" fillOpacity="0.6">
        <path d="M50 16C54 26 54 34 50 40C46 34 46 26 50 16Z" />
        <path d="M50 84C54 74 54 66 50 60C46 66 46 74 50 84Z" />
        <path d="M16 50C26 54 34 54 40 50C34 46 26 46 16 50Z" />
        <path d="M84 50C74 54 66 54 60 50C66 46 74 46 84 50Z" />
        
        {/* Diagonal Petals */}
        <path d="M26 26C36 32 42 38 43 43C38 42 32 36 26 26Z" />
        <path d="M74 74C64 68 58 62 57 57C62 58 68 64 74 74Z" />
        <path d="M26 74C32 64 38 58 43 57C42 62 36 68 26 74Z" />
        <path d="M74 26C68 36 62 42 57 43C58 38 64 32 74 26Z" />
      </g>

      {/* Central Star & Dot */}
      <circle cx="50" cy="50" r="8" fill="#15803D" stroke="#14532D" strokeWidth="1" />
      <circle cx="50" cy="50" r="4" fill="#FEF08A" />
      <circle cx="50" cy="50" r="1.5" fill="#14532D" />
    </svg>
  );
}

export function SaffronFlagArtwork({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 70" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bhagwa Dhwaj">
      {/* Flag Pole */}
      <path d="M12 6V66" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
      {/* Golden Kalash Finial on top */}
      <circle cx="12" cy="6" r="3" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />

      {/* Double-triangular Saffron Bhagwa Zenda */}
      <path d="M14 10L48 20L14 30L52 42L14 52V10Z" fill="url(#bhagwa-grad)" stroke="#C2410C" strokeWidth="1.2" />
      <path d="M14 14L42 22L14 30L46 42L14 48" stroke="#EA580C" strokeWidth="0.8" fill="none" />

      <defs>
        <linearGradient id="bhagwa-grad" x1="14" y1="10" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FB923C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CornerFiligree({ className = "w-8 h-8", color = "#7A0C0C" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 38V12C2 6.47715 6.47715 2 12 2H38" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M6 34V14C6 9.58172 9.58172 6 14 6H34" stroke="#C89D3C" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill={color} />
      <circle cx="24" cy="10" r="1.5" fill="#C89D3C" />
      <circle cx="10" cy="24" r="1.5" fill="#C89D3C" />
    </svg>
  );
}

export function MarigoldFlourish({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="12" fill="#F59E0B" />
      <circle cx="15" cy="15" r="9" fill="#EA580C" />
      <circle cx="15" cy="15" r="6" fill="#DC2626" />
      <circle cx="15" cy="15" r="3" fill="#FEF08A" />
    </svg>
  );
}
