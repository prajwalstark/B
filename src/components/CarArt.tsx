/** Original stylised side-profile of a modern open-wheel race car, with motion streaks. */
export function CarArt({ color = '#e10600' }: { color?: string }) {
  return (
    <svg viewBox="0 0 640 260" className="carart" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f57" />
          <stop offset="0.5" stopColor="#1d2024" />
          <stop offset="1" stopColor="#0b0c0e" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#7a0300" />
        </linearGradient>
        <radialGradient id="rim" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#111" />
          <stop offset="0.8" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor="#111" />
        </radialGradient>
        <linearGradient id="streak" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* road glow */}
      <ellipse cx="330" cy="222" rx="300" ry="18" fill={color} opacity="0.35" filter="url(#glow)" />
      <ellipse cx="330" cy="220" rx="270" ry="10" fill="#000" opacity="0.6" />

      {/* streaks */}
      <g className="streaks">
        <rect x="380" y="92" width="260" height="2" fill="url(#streak)" />
        <rect x="430" y="132" width="210" height="1.5" fill="url(#streak)" />
        <rect x="350" y="176" width="290" height="2" fill="url(#streak)" />
        <rect x="470" y="60" width="170" height="1.5" fill="url(#streak)" />
        <rect x="410" y="206" width="230" height="1.5" fill="url(#streak)" />
      </g>

      {/* rear wing */}
      <path d="M538 70h62l4 22h-60z" fill="url(#body)" />
      <path d="M540 92h60v8h-58z" fill={color} />
      <path d="M592 62h12v118h-12z" fill="#15171a" />
      <path d="M560 100h8l4 64h-10z" fill="#0f1012" />

      {/* floor + body */}
      <path d="M40 184 120 176l60-10 70-14 70-6h70l60 6 60 12 50 18v16H40z" fill="#0d0e10" />
      <path
        d="M30 176c40-8 90-14 140-22l80-14c22-4 38-14 58-26 18-12 40-18 64-18h22c10-16 28-24 48-22l40 6c22 4 38 14 54 28l46 40c8 8 8 18-2 22l-30 10H60c-20 0-34-2-30-4z"
        fill="url(#body)"
      />
      {/* sidepod accent */}
      <path d="M250 168c40-22 90-34 150-34 50 0 92 10 128 30l-6 12c-36-16-76-24-122-24-56 0-104 10-144 28z" fill="url(#accent)" />
      <path d="M90 170c50-8 100-16 150-26l2 6c-50 12-100 20-150 26z" fill={color} opacity="0.9" />
      {/* airbox / halo */}
      <path d="M386 86c8-14 24-20 40-18l26 4c-12 2-20 10-24 22l-40 6z" fill="#2a2e34" />
      <path d="M300 118c14-22 40-34 74-34" stroke="#0b0c0e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx="350" cy="104" r="13" fill="#e7e7e7" />
      <path d="M338 102h22c2 4 0 8-4 9h-18z" fill="#111" />
      {/* nose + front wing */}
      <path d="M8 196h120l6 10H4z" fill="#15171a" />
      <path d="M10 188h110v6H10z" fill={color} />
      <path d="M2 176h14v32H2z" fill="#15171a" />

      {/* wheels */}
      <g>
        <circle cx="150" cy="182" r="44" fill="#0b0b0c" />
        <circle cx="150" cy="182" r="30" fill="url(#rim)" />
        <circle cx="150" cy="182" r="6" fill="#2b2b2b" />
        <circle cx="490" cy="178" r="50" fill="#0b0b0c" />
        <circle cx="490" cy="178" r="34" fill="url(#rim)" />
        <circle cx="490" cy="178" r="7" fill="#2b2b2b" />
      </g>
    </svg>
  );
}
