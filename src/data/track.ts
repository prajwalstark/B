/**
 * Circuit geometry + a physics-ish speed profile derived from curvature.
 *
 * Outlines are traced from real car-position data (OpenF1) for one clean race lap
 * per circuit — see scripts/fetch-circuits.mjs, which writes circuits.json.
 */
import RAW from './circuits.json';

export interface CircuitDef {
  id: string;
  round: number;
  grandPrix: string;
  circuit: string;
  location: string;
  country: string;
  countryName: string;
  raceDate: string;
  sprint: boolean;
  laps: number;
  referenceLap: number;
  sectors: [number, number];
  lengthKm: number;
  points: [number, number][];
}

export interface TrackSample {
  x: number;
  y: number;
  /** Fraction of the lap 0..1 */
  f: number;
  /** Target speed in m/s at this point for a reference car. */
  v: number;
}

export interface Circuit extends CircuitDef {
  viewBox: [number, number];
  path: string;
  samples: TrackSample[];
  turns: { f: number; label: string }[];
  topSpeedKmh: number;
}

export const CALENDAR = RAW as unknown as CircuitDef[];

const N = 600;

function smooth(pts: [number, number][], passes = 2): [number, number][] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const n = p.length;
    p = p.map((_, i) => {
      const a = p[(i - 1 + n) % n];
      const b = p[i];
      const c = p[(i + 1) % n];
      return [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4] as [number, number];
    });
  }
  return p;
}

function buildCircuit(def: CircuitDef): Circuit {
  // Real coordinates (metres, y up) → screen space (y down), fitted to ~380px on the long side + padding.
  const raw = smooth(def.points.map(([x, y]) => [x, -y] as [number, number]));
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const PAD = 34;
  const scale = 380 / Math.max(spanX, spanY);
  const viewBox: [number, number] = [Math.round(spanX * scale + PAD * 2), Math.round(spanY * scale + PAD * 2)];
  const scr = raw.map(([x, y]) => [(x - minX) * scale + PAD, (y - minY) * scale + PAD] as [number, number]);

  // cumulative length in px (closed loop)
  const cum: number[] = [0];
  for (let i = 1; i <= scr.length; i++) {
    const a = scr[i - 1];
    const b = scr[i % scr.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const totalPx = cum[scr.length];
  const mPerPx = (def.lengthKm * 1000) / totalPx;

  // Resample uniformly by distance
  const pts: [number, number][] = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const d = (i / N) * totalPx;
    while (cum[j + 1] < d) j++;
    const t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = scr[j];
    const b = scr[(j + 1) % scr.length];
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  // Curvature → corner speed limit
  const ds = (def.lengthKm * 1000) / N;
  const latG = 2.6 * 9.81;
  const vMax = 92;
  const K = 5;
  const v = pts.map((_, i) => {
    const a = pts[(i - K + N) % N];
    const b = pts[i];
    const c = pts[(i + K) % N];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    const R = area < 1e-6 ? 1e9 : ((ab * bc * ca) / (4 * area)) * mPerPx;
    return Math.min(vMax, Math.sqrt(latG * R));
  });

  // Accel/brake passes (twice round the loop so the wraparound converges)
  const accel = 9;
  const brake = 30;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 1; k <= N; k++) {
      const i = k % N;
      const prev = v[(i - 1 + N) % N];
      v[i] = Math.min(v[i], Math.sqrt(prev * prev + 2 * accel * ds));
    }
    for (let k = N - 1; k >= 0; k--) {
      const next = v[(k + 1) % N];
      v[k] = Math.min(v[k], Math.sqrt(next * next + 2 * brake * ds));
    }
  }

  // Scale the profile so the reference car laps in referenceLap seconds
  let lapT = 0;
  for (let i = 0; i < N; i++) lapT += ds / v[i];
  const k = lapT / def.referenceLap;
  const samples: TrackSample[] = pts.map((p, i) => ({ x: p[0], y: p[1], f: i / N, v: v[i] * k }));

  const path = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';

  // Corner apexes (local speed minima well below the top speed)
  const top = Math.max(...samples.map((s) => s.v));
  const turns: { f: number; label: string }[] = [];
  for (let i = 0; i < N; i++) {
    const vi = samples[i].v;
    let isMin = vi < top * 0.72;
    for (let o = -10; o <= 10 && isMin; o++) if (o && samples[(i + o + N) % N].v < vi) isMin = false;
    if (isMin && !turns.some((t) => Math.abs(t.f - i / N) < 0.015)) turns.push({ f: i / N, label: `T${turns.length + 1}` });
  }

  return { ...def, viewBox, path, samples, turns, topSpeedKmh: top * 3.6 };
}

const cache = new Map<string, Circuit>();
export function getCircuit(id: string): Circuit {
  const def = CALENDAR.find((d) => d.id === id) ?? CALENDAR[0];
  let c = cache.get(def.id);
  if (!c) {
    c = buildCircuit(def);
    cache.set(def.id, c);
  }
  return c;
}

/** The race weekend happening now (or next), by the real calendar. Falls back to the final round. */
export function currentRoundId(now = new Date()): string {
  const DAY = 86_400_000;
  const upcoming = CALENDAR.find((d) => new Date(d.raceDate).getTime() + DAY > now.getTime());
  return (upcoming ?? CALENDAR[CALENDAR.length - 1]).id;
}

export function weekendStatus(def: CircuitDef, now = new Date()): 'past' | 'this-weekend' | 'upcoming' {
  const race = new Date(def.raceDate).getTime();
  const t = now.getTime();
  if (t > race + 86_400_000) return 'past';
  if (race - t < 4 * 86_400_000) return 'this-weekend';
  return 'upcoming';
}

export function sampleAt(c: Circuit, f: number): TrackSample {
  const s = c.samples;
  const x = (((f % 1) + 1) % 1) * N;
  const i = Math.floor(x);
  const t = x - i;
  const a = s[i % N];
  const b = s[(i + 1) % N];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, f, v: a.v + (b.v - a.v) * t };
}

/** Short display name used as the big hero title. */
export function heroName(c: CircuitDef) {
  const map: Record<string, string> = {
    'Monte Carlo': 'Monaco',
    'Yas Marina Circuit': 'Yas Marina',
    'Spa-Francorchamps': 'Spa',
    Catalunya: 'Barcelona',
    Madring: 'Madrid',
  };
  return map[c.circuit] ?? c.circuit;
}
