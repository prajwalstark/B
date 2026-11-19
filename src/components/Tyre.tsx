import { COMPOUNDS, type Compound } from '../sim/raceEngine';

export function Tyre({ compound, size = 20 }: { compound: Compound; size?: number }) {
  const c = COMPOUNDS[compound];
  return (
    <span className="tyre" title={`${compound.toLowerCase()} tyre`} style={{ color: c.color, width: size, height: size }}>
      <span>{c.short}</span>
    </span>
  );
}
