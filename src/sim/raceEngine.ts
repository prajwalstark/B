import { CIRCUIT, sampleAt } from '../data/track';
import { DRIVERS, type Driver } from '../data/drivers';
import { TEAMS } from '../data/teams';

export type Compound = 'SOFT' | 'MEDIUM' | 'HARD';
export type CarStatus = 'GRID' | 'RUN' | 'PIT' | 'OUT' | 'FIN';

export const COMPOUNDS: Record<Compound, { offset: number; deg: number; color: string; short: string }> = {
  SOFT: { offset: -0.75, deg: 0.075, color: '#FF3B3B', short: 'S' },
  MEDIUM: { offset: 0, deg: 0.042, color: '#FFD23F', short: 'M' },
  HARD: { offset: 0.55, deg: 0.024, color: '#F2F2F2', short: 'H' },
};

export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

const MARKERS = 200; // mini-sectors per lap used for live gaps & deltas
const LAP_M = CIRCUIT.lengthKm * 1000;
const MARK_M = LAP_M / MARKERS;
const MIN_GAP_M = 7;
const PIT_SPEED = 22;

export interface Car {
  driver: Driver;
  color: string;
  grid: number;
  dist: number;
  speed: number; // m/s
  topSpeed: number;
  status: CarStatus;
  compound: Compound;
  tyreAge: number;
  stops: number;
  pitPlan: { lap: number; to: Compound }[];
  pitTimer: number;
  launchAt: number;
  dnfAt: number | null; // race distance in metres at which the car retires
  lapStart: number;
  lapTarget: number;
  currentLap: number; // seconds into current lap
  lastLap: number | null;
  bestLap: number | null;
  lapTimes: number[];
  curMarks: Float64Array;
  bestMarks: Float64Array | null;
  lastMarker: number;
  gap: number; // to leader, seconds
  interval: number; // to car ahead, seconds
  delta: number | null; // live delta vs personal best at same point
  position: number;
  finishedAt: number | null;
  passingUntil: number;
  sector: 1 | 2 | 3;
  sectorTimes: [number | null, number | null, number | null];
  bestSectors: [number | null, number | null, number | null];
  sectorStart: number;
}

export interface RaceEvent {
  id: number;
  t: number;
  lap: number;
  kind: 'OVERTAKE' | 'PIT' | 'FASTEST' | 'DNF' | 'START' | 'FINISH' | 'INFO';
  text: string;
  driverId?: string;
}

export interface SprintResult {
  driverId: string;
  pos: number;
  points: number;
  grid: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Listener = () => void;

export class RaceEngine {
  laps = CIRCUIT.laps;
  t = 0; // race seconds since lights out (negative during countdown)
  speed = 1;
  paused = false;
  cars: Car[] = [];
  order: Car[] = [];
  events: RaceEvent[] = [];
  sprint: SprintResult[] = [];
  fastest: { driverId: string; time: number; lap: number } | null = null;
  maxSpeed: { driverId: string; kmh: number } | null = null;
  finished = false;
  seed: number;
  version = 0;

  private rng: () => number;
  private firstCross: Float64Array;
  private listeners = new Set<Listener>();
  private raf = 0;
  private lastFrame = 0;
  private lastEmit = 0;
  private eventId = 0;

  constructor(seed = Date.now() % 100000) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.firstCross = new Float64Array((this.laps + 3) * MARKERS).fill(NaN);
    this.setup();
  }

  /** Re-run the weekend with a new random seed (new grid, strategies & incidents). */
  reset(seed = Math.floor(Math.random() * 100000)) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.firstCross.fill(NaN);
    this.events = [];
    this.fastest = null;
    this.maxSpeed = null;
    this.finished = false;
    this.paused = false;
    this.setup();
    this.emit();
  }

  /* ---------------------------------------------------------------- setup */

  private basePace(d: Driver) {
    return TEAMS[d.teamId].carPace * d.skill;
  }

  private setup() {
    const r = this.rng;
    // Qualifying: pace + noise
    const quali = DRIVERS.map((d) => ({ d, q: this.basePace(d) + (r() - 0.5) * 0.004 })).sort((a, b) => a.q - b.q);

    // Sprint (already happened on Saturday) – deterministic from the seed
    const sprintGrid = DRIVERS.map((d) => ({ d, q: this.basePace(d) + (r() - 0.5) * 0.005 })).sort((a, b) => a.q - b.q);
    this.sprint = sprintGrid
      .map((s, i) => ({ d: s.d, grid: i + 1, score: s.q + (r() - 0.5) * 0.004 }))
      .sort((a, b) => a.score - b.score)
      .map((s, i) => ({ driverId: s.d.id, pos: i + 1, grid: s.grid, points: SPRINT_POINTS[i] ?? 0 }));

    this.cars = quali.map(({ d }, i) => {
      const grid = i + 1;
      const twoStop = r() < 0.35;
      const startOnSoft = grid > 10 ? r() < 0.4 : r() < 0.25;
      const start: Compound = startOnSoft ? 'SOFT' : grid > 14 && r() < 0.4 ? 'HARD' : 'MEDIUM';
      const pitPlan = twoStop
        ? [
            { lap: 18 + Math.floor(r() * 8), to: 'MEDIUM' as Compound },
            { lap: 44 + Math.floor(r() * 8), to: (r() < 0.5 ? 'SOFT' : 'MEDIUM') as Compound },
          ]
        : [{ lap: (start === 'SOFT' ? 20 : start === 'HARD' ? 38 : 28) + Math.floor(r() * 9), to: (start === 'HARD' ? 'MEDIUM' : 'HARD') as Compound }];
      const dnf = r() < 0.045 ? (2 + r() * (this.laps - 4)) * LAP_M : null;
      const car: Car = {
        driver: d,
        color: TEAMS[d.teamId].color,
        grid,
        // two-by-two staggered grid behind the line
        dist: -(6 + i * 8),
        speed: 0,
        topSpeed: 0,
        status: 'GRID',
        compound: start,
        tyreAge: 0,
        stops: 0,
        pitPlan,
        pitTimer: 0,
        launchAt: 0,
        dnfAt: dnf,
        lapStart: 0,
        lapTarget: 0,
        currentLap: 0,
        lastLap: null,
        bestLap: null,
        lapTimes: [],
        curMarks: new Float64Array(MARKERS).fill(NaN),
        bestMarks: null,
        lastMarker: -1,
        gap: 0,
        interval: 0,
        delta: null,
        position: grid,
        finishedAt: null,
        passingUntil: 0,
        sector: 1,
        sectorTimes: [null, null, null],
        bestSectors: [null, null, null],
        sectorStart: 0,
      };
      car.lapTarget = this.targetLap(car, 0);
      return car;
    });
    this.order = [...this.cars];
    this.t = -5; // five red lights
    this.push('INFO', `Formation lap complete — ${this.cars[0].driver.lastName} on pole`, this.cars[0].driver.id);
  }

  private targetLap(car: Car, completed: number) {
    const c = COMPOUNDS[car.compound];
    const fuel = 0.032 * (this.laps - completed);
    const noise = (this.rng() - 0.5) * 0.45;
    return CIRCUIT.referenceLap * this.basePace(car.driver) + c.offset + c.deg * Math.pow(car.tyreAge, 1.25) + fuel + noise;
  }

  /* ------------------------------------------------------------- loop api */

  start() {
    if (this.raf) return;
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      if (!this.paused && !this.finished) this.advance(dt * this.speed);
      this.version++;
      if (now - this.lastEmit > 66) {
        this.lastEmit = now;
        this.listeners.forEach((l) => l());
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getVersion = () => this.version;

  setSpeed(s: number) {
    this.speed = s;
    this.emit();
  }

  togglePause() {
    this.paused = !this.paused;
    this.emit();
  }

  /** Jump the simulation forward by `seconds` of race time. */
  skip(seconds: number) {
    const step = 0.05;
    for (let s = 0; s < seconds && !this.finished; s += step) this.step(step);
    this.emit();
  }

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /* ------------------------------------------------------------ simulation */

  private advance(simDt: number) {
    const step = 0.05;
    let rem = simDt;
    while (rem > 1e-6 && !this.finished) {
      const h = Math.min(step, rem);
      this.step(h);
      rem -= h;
    }
  }

  leaderLap() {
    const lead = this.order[0];
    return Math.max(1, Math.min(this.laps, Math.floor(Math.max(0, lead.dist) / LAP_M) + 1));
  }

  private push(kind: RaceEvent['kind'], text: string, driverId?: string) {
    this.events.unshift({ id: ++this.eventId, t: this.t, lap: this.cars.length ? this.leaderLap() : 1, kind, text, driverId });
    if (this.events.length > 60) this.events.pop();
  }

  private step(h: number) {
    const prevT = this.t;
    this.t += h;
    if (this.t < 0) return;
    if (prevT < 0) {
      this.cars.forEach((c) => {
        c.status = 'RUN';
        c.launchAt = 0;
        c.lapStart = 0;
        c.sectorStart = 0;
      });
      this.push('START', 'Lights out and away we go!');
    }

    const sorted = this.order;

    for (let idx = 0; idx < sorted.length; idx++) {
      const car = sorted[idx];
      if (car.status === 'OUT' || car.status === 'FIN') {
        car.speed = 0;
        continue;
      }
      if (car.status === 'PIT') {
        car.pitTimer -= h;
        car.speed = 0;
        if (car.pitTimer <= 0) {
          car.status = 'RUN';
          car.launchAt = this.t;
          car.speed = PIT_SPEED;
        }
        continue;
      }

      const frac = ((car.dist % LAP_M) + LAP_M) % LAP_M / LAP_M;
      const s = sampleAt(frac);
      let v = s.v * (CIRCUIT.referenceLap / car.lapTarget);
      // standing start / pit exit launch
      const sinceLaunch = this.t - car.launchAt;
      if (sinceLaunch < 8) v = Math.min(v, (car.launchAt === 0 ? 0 : PIT_SPEED) + 12.5 * sinceLaunch);

      let next = car.dist + v * h;

      // Traffic: car physically ahead on the same lap
      const ahead = this.carAhead(idx);
      if (ahead && next > ahead.dist - MIN_GAP_M) {
        const straight = s.v > 72;
        const faster = car.lapTarget < ahead.lapTarget - 0.04;
        if (this.t < car.passingUntil) {
          // committed to the move — carry on
        } else if (straight && faster && this.rng() < h * (1.4 + (ahead.lapTarget - car.lapTarget) * 3)) {
          car.passingUntil = this.t + 4;
        } else {
          next = Math.max(car.dist, ahead.dist - MIN_GAP_M);
          v = (next - car.dist) / h;
        }
      }

      car.speed = v;
      const kmh = v * 3.6;
      if (kmh > car.topSpeed) car.topSpeed = kmh;
      if (!this.maxSpeed || kmh > this.maxSpeed.kmh) this.maxSpeed = { driverId: car.driver.id, kmh };

      // DNF
      if (car.dnfAt !== null && next >= car.dnfAt) {
        car.dist = car.dnfAt;
        car.status = 'OUT';
        car.speed = 0;
        const reasons = ['hydraulics', 'power unit', 'gearbox', 'collision damage', 'brakes'];
        this.push('DNF', `${car.driver.lastName} retires — ${reasons[Math.floor(this.rng() * reasons.length)]}`, car.driver.id);
        continue;
      }

      const prevLapIdx = Math.floor(car.dist / LAP_M);
      const from = car.dist;
      this.crossMarkers(car, from, next, prevT, h);
      car.dist = next;
      const lapIdx = Math.floor(car.dist / LAP_M);

      // sectors
      const f2 = ((car.dist % LAP_M) + LAP_M) % LAP_M / LAP_M;
      const newSector: 1 | 2 | 3 = f2 < CIRCUIT.sectors[0] ? 1 : f2 < CIRCUIT.sectors[1] ? 2 : 3;
      if (car.dist > 0 && newSector !== car.sector) {
        const si = car.sector - 1;
        const st = this.t - car.sectorStart;
        if (newSector === car.sector + 1 || (car.sector === 3 && newSector === 1)) {
          car.sectorTimes[si] = st;
          if (car.bestSectors[si] === null || st < (car.bestSectors[si] as number)) car.bestSectors[si] = st;
        }
        car.sectorStart = this.t;
        car.sector = newSector;
        if (newSector === 1) car.sectorTimes = [null, null, car.sectorTimes[2]];
      }

      car.currentLap = this.t - car.lapStart;

      if (lapIdx > prevLapIdx && prevLapIdx >= 0) {
        const tc = prevT + h * Math.min(1, Math.max(0, (lapIdx * LAP_M - from) / (next - from || 1)));
        this.completeLap(car, lapIdx, this.cars.some((c) => c.status === 'FIN'), tc);
      }
    }

    this.reorder();
  }

  private carAhead(idx: number): Car | null {
    const car = this.order[idx];
    for (let j = idx - 1; j >= 0; j--) {
      const o = this.order[j];
      if (o.status !== 'RUN') continue;
      const d = o.dist - car.dist;
      if (d > 0 && d < 40) return o;
      if (d >= 40) return null;
    }
    return null;
  }

  private crossMarkers(car: Car, from: number, to: number, t0: number, h: number) {
    if (to < 0) return;
    const g1 = Math.min(Math.floor(to / MARK_M), this.firstCross.length - 1);
    for (let g = car.lastMarker + 1; g <= g1; g++) {
      const md = g * MARK_M;
      const frac = to === from ? 1 : (md - from) / (to - from);
      const tc = t0 + h * Math.min(1, Math.max(0, frac));
      if (Number.isNaN(this.firstCross[g])) this.firstCross[g] = tc;
      car.gap = tc - this.firstCross[g];
      const m = g % MARKERS;
      car.curMarks[m] = tc - car.lapStart;
      if (car.bestMarks && m > 0) car.delta = car.curMarks[m] - car.bestMarks[m];
      car.lastMarker = g;
    }
  }

  private completeLap(car: Car, lapIdx: number, winnerDone: boolean, tc: number) {
    const lapTime = tc - car.lapStart;
    car.lastLap = lapTime;
    car.lapTimes.push(lapTime);
    if (car.bestLap === null || lapTime < car.bestLap) {
      car.bestLap = lapTime;
      car.bestMarks = Float64Array.from(car.curMarks);
      if (lapIdx > 1 && (!this.fastest || lapTime < this.fastest.time)) {
        this.fastest = { driverId: car.driver.id, time: lapTime, lap: lapIdx };
        this.push('FASTEST', `Fastest lap: ${car.driver.lastName} ${formatLap(lapTime)}`, car.driver.id);
      }
    }
    car.lapStart = tc;
    car.curMarks.fill(NaN);
    car.delta = 0;
    car.tyreAge++;

    // Chequered flag
    if (lapIdx >= this.laps || winnerDone) {
      car.status = 'FIN';
      car.finishedAt = tc;
      car.speed = 0;
      if (!winnerDone) this.push('FINISH', `${car.driver.firstName} ${car.driver.lastName} wins the ${CIRCUIT.grandPrix}!`, car.driver.id);
      if (this.cars.every((c) => c.status === 'FIN' || c.status === 'OUT')) {
        this.finished = true;
        this.push('INFO', 'Chequered flag — race classified');
      }
      return;
    }

    // Pit stop?
    const plan = car.pitPlan[car.stops];
    if (plan && lapIdx >= plan.lap && lapIdx < this.laps - 2) {
      car.status = 'PIT';
      const slow = this.rng() < 0.06;
      car.pitTimer = 20.5 + this.rng() * 1.6 + (slow ? 4 + this.rng() * 4 : 0);
      car.compound = plan.to;
      car.tyreAge = 0;
      car.stops++;
      this.push('PIT', `${car.driver.lastName} pits — ${plan.to.toLowerCase()} tyres${slow ? ' (slow stop)' : ''}`, car.driver.id);
    }
    car.lapTarget = this.targetLap(car, lapIdx);
  }

  private reorder() {
    const prev = new Map(this.order.map((c, i) => [c, i]));
    const rank = (c: Car) => (c.status === 'OUT' ? 1 : 0);
    this.order = [...this.cars].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.status === 'FIN' && b.status === 'FIN') return (a.finishedAt as number) - (b.finishedAt as number);
      return b.dist - a.dist;
    });
    this.order.forEach((c, i) => {
      c.position = i + 1;
      const was = prev.get(c);
      if (was !== undefined && i < was && this.t > 25 && c.status === 'RUN' && i < 12) {
        const passed = this.order[i + 1];
        if (passed && passed.status === 'RUN' && passed.dist - c.dist > -30) {
          this.push('OVERTAKE', `${c.driver.lastName} passes ${passed.driver.lastName} for P${i + 1}`, c.driver.id);
        }
      }
    });
    this.order.forEach((c, i) => {
      if (i === 0) {
        c.gap = 0;
        c.interval = 0;
        return;
      }
      c.interval = Math.max(0, c.gap - this.order[i - 1].gap);
    });
  }

  /* -------------------------------------------------------------- helpers */

  lapsDown(car: Car) {
    const lead = this.order[0];
    return Math.max(0, Math.floor((lead.dist - car.dist) / LAP_M));
  }

  carById(id: string) {
    return this.cars.find((c) => c.driver.id === id) ?? null;
  }

  lapFraction(car: Car) {
    return (((car.dist % LAP_M) + LAP_M) % LAP_M) / LAP_M;
  }

  completedLaps(car: Car) {
    return Math.max(0, Math.floor(car.dist / LAP_M));
  }

  racePoints(car: Car) {
    if (car.status === 'OUT') return 0;
    return RACE_POINTS[car.position - 1] ?? 0;
  }

  sprintFor(id: string) {
    return this.sprint.find((s) => s.driverId === id) ?? null;
  }
}

export function formatLap(t: number | null | undefined) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function formatGap(t: number) {
  if (!Number.isFinite(t)) return '—';
  return `+${t.toFixed(3)}`;
}

let engine: RaceEngine | null = null;
export function getEngine() {
  if (!engine) {
    engine = new RaceEngine();
    engine.start();
  }
  return engine;
}
