/**
 * Schematic circuit geometry + a physics-ish speed profile derived from curvature.
 * The layout is a stylised schematic, not a survey-accurate map.
 */

export interface TrackSample {
  x: number;
  y: number;
  /** Fraction of the lap 0..1 */
  f: number;
  /** Target speed in m/s at this point for a reference car. */
  v: number;
}

export interface Circuit {
  name: string;
  grandPrix: string;
  city: string;
  country: string;
  lengthKm: number;
  laps: number;
  referenceLap: number; // seconds
  viewBox: [number, number];
  path: string;
  samples: TrackSample[];
  /** Fractions where sector 1/2 end. */
  sectors: [number, number];
  turns: { f: number; label: string }[];
}

// Control points (clockwise in screen space) – a stylised take on a compact, flowing layout.
const CONTROL: [number, number][] = [
  [258, 70], // start/finish line on the top straight heading right
  [300, 66],
  [326, 84],
  [318, 118],
  [286, 132],
  [276, 160],
  [298, 196],
  [308, 236],
  [282, 262],
  [246, 252],
  [222, 226],
  [194, 214],
  [174, 236],
  [188, 272],
  [226, 300],
  [262, 326],
  [270, 368],
  [250, 404],
  [208, 412],
  [176, 388],
  [150, 352],
  [122, 334],
  [92, 352],
  [76, 392],
  [58, 420],
  [32, 410],
  [30, 370],
  [48, 320],
  [74, 270],
  [96, 222],
  [118, 176],
  [128, 136],
  [112, 104],
  [128, 78],
  [170, 70],
  [214, 70],
];

function catmullRom(points: [number, number][], segments = 24): [number, number][] {
  const out: [number, number][] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  return out;
}

function buildCircuit(): Circuit {
  const lengthKm = 4.309;
  const laps = 71;
  const referenceLap = 72.4;
  const dense = catmullRom(CONTROL, 30);

  // cumulative length in px
  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const totalPx = cum[dense.length];
  const mPerPx = (lengthKm * 1000) / totalPx;

  // Resample uniformly by distance
  const N = 600;
  const pts: [number, number][] = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const d = (i / N) * totalPx;
    while (cum[j + 1] < d) j++;
    const t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = dense[j];
    const b = dense[(j + 1) % dense.length];
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  // Curvature → corner speed limit
  const ds = (lengthKm * 1000) / N;
  const latG = 2.4 * 9.81;
  const vMax = 89; // ~335 km/h after scaling
  const radii: number[] = [];
  const K = 4; // look-around for smoother curvature
  for (let i = 0; i < N; i++) {
    const a = pts[(i - K + N) % N];
    const b = pts[i];
    const c = pts[(i + K) % N];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    const R = area < 1e-6 ? 1e9 : (ab * bc * ca) / (4 * area);
    radii.push(R * mPerPx);
  }
  const v = radii.map((R) => Math.min(vMax, Math.sqrt(latG * R)));

  // Accel/brake passes (run twice around the loop so wraparound converges)
  const accel = 9; // m/s^2 (traction-limited average)
  const brake = 30; // m/s^2 (~4-5g peak, averaged)
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

  // Scale profile so the reference car laps in referenceLap seconds
  let lapT = 0;
  for (let i = 0; i < N; i++) lapT += ds / v[i];
  const scale = lapT / referenceLap;
  const samples: TrackSample[] = pts.map((p, i) => ({ x: p[0], y: p[1], f: i / N, v: v[i] * scale }));

  const path = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';

  // Find turn apexes (local speed minima)
  const turns: { f: number; label: string }[] = [];
  for (let i = 0; i < N; i++) {
    const vi = samples[i].v;
    let isMin = vi < 70;
    for (let k = -12; k <= 12 && isMin; k++) if (k && samples[(i + k + N) % N].v < vi) isMin = false;
    if (isMin && !turns.some((t) => Math.abs(t.f - i / N) < 0.02)) turns.push({ f: i / N, label: `T${turns.length + 1}` });
  }

  return {
    name: 'Autódromo José Carlos Pace',
    grandPrix: 'São Paulo Grand Prix',
    city: 'Interlagos, São Paulo',
    country: 'BR',
    lengthKm,
    laps,
    referenceLap,
    viewBox: [360, 470],
    path,
    samples,
    sectors: [0.33, 0.68],
    turns,
  };
}

export const CIRCUIT = buildCircuit();

export function sampleAt(f: number): TrackSample {
  const s = CIRCUIT.samples;
  const N = s.length;
  const x = (((f % 1) + 1) % 1) * N;
  const i = Math.floor(x);
  const t = x - i;
  const a = s[i % N];
  const b = s[(i + 1) % N];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, f, v: a.v + (b.v - a.v) * t };
}
