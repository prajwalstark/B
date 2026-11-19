import { useMemo } from 'react';
import { CIRCUIT, sampleAt } from '../data/track';
import { useFrame } from '../lib/hooks';
import type { Car } from '../sim/raceEngine';

function normalAt(f: number): [number, number] {
  const a = sampleAt(f - 0.002);
  const b = sampleAt(f + 0.002);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

// Centroid used to push labels / dots outward from the circuit.
const CENTER = (() => {
  const s = CIRCUIT.samples;
  return [s.reduce((a, p) => a + p.x, 0) / s.length, s.reduce((a, p) => a + p.y, 0) / s.length];
})();

function outward(f: number): [number, number] {
  const p = sampleAt(f);
  const [nx, ny] = normalAt(f);
  const dot = (p.x - CENTER[0]) * nx + (p.y - CENTER[1]) * ny;
  return dot >= 0 ? [nx, ny] : [-nx, -ny];
}

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
  labels?: 'top' | 'all' | 'none';
}

export function TrackMap({ selected, onSelect, labels = 'top' }: Props) {
  const engine = useFrame();
  const [w, h] = CIRCUIT.viewBox;

  const turnDots = useMemo(
    () =>
      CIRCUIT.turns.map((t) => {
        const p = sampleAt(t.f);
        const [nx, ny] = outward(t.f);
        return { x: p.x + nx * 18, y: p.y + ny * 18, label: t.label };
      }),
    [],
  );

  const startLine = useMemo(() => {
    const p = sampleAt(0);
    const [nx, ny] = normalAt(0);
    return { p, nx, ny };
  }, []);

  const pitPos = useMemo(() => {
    const p = sampleAt(0.995);
    const [nx, ny] = outward(0.995);
    return { x: p.x - nx * 13, y: p.y - ny * 13 };
  }, []);

  const sel = selected ? engine.carById(selected) : null;
  const selFrac = sel ? engine.lapFraction(sel) : 0;
  const sectorBounds = [0, CIRCUIT.sectors[0], CIRCUIT.sectors[1], 1];
  const curSector = sel ? sel.sector : 0;

  const order = engine.order;
  const showLabel = (c: Car) => labels === 'all' || (labels === 'top' && c.position <= 5) || c.driver.id === selected;

  const placed = order.map((c, idx) => {
    if (c.status === 'PIT') return { c, x: pitPos.x - idx * 0.6, y: pitPos.y, f: 0 };
    if (c.status === 'GRID' || c.dist < 0) {
      const f = c.dist / (CIRCUIT.lengthKm * 1000);
      const p = sampleAt(f);
      const [nx, ny] = normalAt(f);
      const side = c.grid % 2 === 0 ? 4 : -4;
      return { c, x: p.x + nx * side, y: p.y + ny * side, f };
    }
    const f = engine.lapFraction(c);
    const p = sampleAt(f);
    return { c, x: p.x, y: p.y, f };
  });

  return (
    <svg className="map" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${CIRCUIT.name} live map`}>
      <defs>
        <filter id="carShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.6" />
        </filter>
        <pattern id="checker" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#fff" />
          <rect width="2" height="2" fill="#111" />
          <rect x="2" y="2" width="2" height="2" fill="#111" />
        </pattern>
      </defs>

      {/* decorative dots */}
      {turnDots.map((d) => (
        <g key={d.label}>
          <circle cx={d.x} cy={d.y} r={2.4} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
          <circle cx={d.x} cy={d.y} r={0.9} fill="rgba(255,255,255,.7)" />
        </g>
      ))}

      {/* track */}
      <path d={CIRCUIT.path} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="13" strokeLinejoin="round" />
      <path d={CIRCUIT.path} fill="none" stroke="#f3f3f3" strokeWidth="5.5" strokeLinejoin="round" />
      <path d={CIRCUIT.path} fill="none" stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeLinejoin="round" />

      {/* selected driver's current sector + trail */}
      {sel && sel.status === 'RUN' && sel.dist > 0 && (
        <>
          <path
            d={CIRCUIT.path}
            pathLength={1000}
            fill="none"
            stroke="var(--red)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={`${(selFrac - sectorBounds[curSector - 1]) * 1000} 1000`}
            strokeDashoffset={-sectorBounds[curSector - 1] * 1000}
            opacity="0.95"
          />
        </>
      )}

      {/* start / finish */}
      <line
        x1={startLine.p.x + startLine.nx * 7}
        y1={startLine.p.y + startLine.ny * 7}
        x2={startLine.p.x - startLine.nx * 7}
        y2={startLine.p.y - startLine.ny * 7}
        stroke="url(#checker)"
        strokeWidth="4"
      />
      <text x={pitPos.x - 26} y={pitPos.y + 16} fontSize="7" fill="rgba(255,255,255,.5)" letterSpacing="1">
        PIT
      </text>

      {/* cars (back-to-front so the leader is drawn on top) */}
      {[...placed].reverse().map(({ c, x, y }) => {
        const isSel = c.driver.id === selected;
        const out = c.status === 'OUT';
        return (
          <g
            key={c.driver.id}
            className="car"
            transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`}
            onClick={() => onSelect(c.driver.id)}
            opacity={out ? 0.35 : 1}
            filter="url(#carShadow)"
          >
            <circle r={isSel ? 7.5 : 5.2} fill={out ? '#777' : c.color} stroke={isSel ? '#fff' : '#111'} strokeWidth={isSel ? 2 : 1.2} />
            {isSel && <circle r={12} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />}
            <circle r={14} fill="transparent" />
          </g>
        );
      })}

      {/* labels — placed outward from the track, nudged further out to avoid overlaps */}
      {(() => {
        const boxes: { x: number; y: number }[] = [];
        const bw = 30;
        const bh = 24;
        const items = placed.filter(({ c }) => showLabel(c) && c.status !== 'OUT');
        // place selected first so it gets the best spot
        items.sort((a, b) => Number(b.c.driver.id === selected) - Number(a.c.driver.id === selected));
        return items.map(({ c, x, y, f }) => {
          const [nx, ny] = c.status === 'RUN' || c.status === 'FIN' ? outward(f) : [0, -1];
          let dist = 26;
          let lx = x + nx * dist;
          let ly = y + ny * dist;
          for (let k = 0; k < 8 && boxes.some((b) => Math.abs(b.x - lx) < bw + 2 && Math.abs(b.y - ly) < bh + 2); k++) {
            dist += 14;
            // alternate sideways along the track direction as well as outward
            const side = (k % 2 === 0 ? 1 : -1) * (bw / 2 + 4) * Math.ceil((k + 1) / 2) * 0.5;
            lx = x + nx * dist + ny * side;
            ly = y + ny * dist - nx * side;
          }
          lx = Math.min(w - bw / 2 - 2, Math.max(bw / 2 + 2, lx));
          ly = Math.min(h - bh / 2 - 2, Math.max(bh / 2 + 2, ly));
          boxes.push({ x: lx, y: ly });
          const isSel = c.driver.id === selected;
          return (
            <g key={'l' + c.driver.id} onClick={() => onSelect(c.driver.id)} style={{ cursor: 'pointer' }}>
              <line x1={x} y1={y} x2={lx} y2={ly} stroke="rgba(255,255,255,.5)" strokeWidth="0.8" />
              <g transform={`translate(${(lx - bw / 2).toFixed(1)},${(ly - bh / 2).toFixed(1)})`}>
                <rect width={bw} height={bh} rx="2" fill={isSel ? '#e10600' : 'rgba(70,74,80,.94)'} stroke="rgba(255,255,255,.15)" strokeWidth="0.6" />
                <rect width={bw} height="3" rx="1" fill={c.color} />
                <text x={bw / 2} y="12.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" letterSpacing="0.3">
                  {c.driver.code}
                </text>
                <text x={bw / 2} y="20.5" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,.85)">
                  {c.status === 'PIT' ? 'PIT' : `P${c.position}`}
                </text>
              </g>
            </g>
          );
        });
      })()}
    </svg>
  );
}
