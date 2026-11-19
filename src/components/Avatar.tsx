import type { Driver } from '../data/drivers';
import { TEAMS } from '../data/teams';

export function Avatar({ driver, size = 36 }: { driver: Driver; size?: number }) {
  const t = TEAMS[driver.teamId];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: `linear-gradient(145deg, ${t.color} 0%, #15171a 120%)`,
        display: 'inline-grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size * 0.32,
        letterSpacing: '0.02em',
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,.5)',
        flex: 'none',
      }}
    >
      {driver.code}
    </span>
  );
}

export function Flag({ country, size = 18 }: { country: string; size?: number }) {
  const flag = country
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
  return (
    <span aria-label={country} role="img" style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}>
      {flag}
    </span>
  );
}
