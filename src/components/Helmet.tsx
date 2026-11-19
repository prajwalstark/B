import { useId } from 'react';
import type { Driver } from '../data/drivers';
import { TEAMS } from '../data/teams';

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/** Original stylised race-helmet illustration in the driver's team livery. */
export function Helmet({ driver, className }: { driver: Driver; className?: string }) {
  const id = useId().replace(/:/g, '');
  const team = TEAMS[driver.teamId];
  const c = team.color;
  const a = team.accent;
  return (
    <svg className={className} viewBox="0 0 240 200" role="img" aria-label={`${driver.firstName} ${driver.lastName} helmet`}>
      <defs>
        <linearGradient id={`shell${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={shade(c, 60)} />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={shade(c, -90)} />
        </linearGradient>
        <linearGradient id={`visor${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b4a5e" />
          <stop offset="0.35" stopColor="#0d1117" />
          <stop offset="0.7" stopColor="#1c2230" />
          <stop offset="1" stopColor="#05070a" />
        </linearGradient>
        <radialGradient id={`gloss${id}`} cx="0.45" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`clip${id}`}>
          <path d="M30 128C26 70 70 26 132 24c58-2 94 36 92 88l-2 38c-1 16-12 26-28 26H86c-26 0-52-16-56-48Z" />
        </clipPath>
      </defs>
      <ellipse cx="128" cy="188" rx="96" ry="8" fill="#000" opacity="0.35" />
      <path d="M30 128C26 70 70 26 132 24c58-2 94 36 92 88l-2 38c-1 16-12 26-28 26H86c-26 0-52-16-56-48Z" fill={`url(#shell${id})`} />
      <g clipPath={`url(#clip${id})`}>
        <path d="M40 66C86 20 180 18 232 74l-6 16C178 42 100 40 52 84Z" fill={a} opacity="0.95" />
        <path d="M24 150c60 4 140 2 210-14v60H24Z" fill="#0b0c0e" opacity="0.85" />
        <path d="M24 146c60 4 140 2 210-14v4c-70 16-150 18-210 14Z" fill={a} />
        <rect x="0" y="0" width="240" height="200" fill={`url(#gloss${id})`} />
      </g>
      <path d="M34 106c6-30 34-46 70-48l50 2c14 1 18 14 10 24l-24 26c-6 7-14 10-24 10l-80 2c-3-4-3-10-2-16Z" fill={`url(#visor${id})`} />
      <path d="M44 92c14-18 40-26 70-26" stroke="#9fc3ff" strokeOpacity="0.45" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M160 60c5 2 8 8 4 14" stroke="#000" strokeOpacity="0.5" strokeWidth="2" fill="none" />
      <text x="186" y="126" textAnchor="middle" fontFamily="Inter Tight, Arial" fontWeight="700" fontSize="38" fill="#fff" fillOpacity="0.92" letterSpacing="-2">
        {driver.number}
      </text>
    </svg>
  );
}
