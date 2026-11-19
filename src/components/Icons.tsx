type P = { size?: number };

export const BackIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const MenuIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M5 6h14M5 12h14M9 18h10" />
  </svg>
);

export const CloseIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const PlayIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </svg>
);

export const PauseIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="4" width="5" height="16" rx="1" />
    <rect x="14" y="4" width="5" height="16" rx="1" />
  </svg>
);

export const RestartIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const ChevronIcon = ({ size = 20, up = false }: P & { up?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'none' : 'rotate(180deg)', transition: 'transform .2s' }}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);

export const ArrowRight = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Triangle = ({ up, size = 10 }: P & { up: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: 'inline-block' }}>
    <path d={up ? 'M5 1 9.5 9h-9z' : 'M5 9 .5 1h9z'} fill={up ? 'var(--green)' : 'var(--red-2)'} />
  </svg>
);

/** Top-down open-wheel car glyph used as a small icon. */
export const CarGlyph = ({ size = 46 }: P) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 50 30" fill="currentColor">
    <rect x="2" y="3" width="9" height="8" rx="1.5" />
    <rect x="2" y="19" width="9" height="8" rx="1.5" />
    <rect x="34" y="2" width="10" height="9" rx="1.5" />
    <rect x="34" y="19" width="10" height="9" rx="1.5" />
    <path d="M0 12.5h3v5H0zM46 9h4v12h-4z" />
    <path d="M6 13.5 20 12l6-2.5h10l5 3v5l-5 3H26l-6-2.5-14-1.5z" />
    <circle cx="27" cy="15" r="2.2" fill="#222" />
  </svg>
);
