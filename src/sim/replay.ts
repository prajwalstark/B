/**
 * Replays a real race from OpenF1 timing data: car positions on track, running order,
 * gaps, laps, tyres, pit stops and race-control messages, on a scrubbable timeline.
 */
import {
  friendlyError,
  of1,
  type DriverInfo,
  type IntervalRow,
  type Lap,
  type LocationRow,
  type Pit,
  type PositionRow,
  type RaceControl,
  type Session,
  type SessionResult,
  type Stint,
} from '../data/openf1';

const WINDOW_MS = 90_000;

export const parseT = (iso: string) => Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));

export interface ReplayCar {
  num: number;
  info: DriverInfo;
  color: string;
  position: number;
  x: number | null;
  y: number | null;
  lap: number;
  lastLap: number | null;
  bestLap: number | null;
  compound: string | null;
  tyreAge: number;
  stops: number;
  inPit: boolean;
  out: boolean;
  finished: boolean;
  gap: string;
  interval: string;
}

type Listener = () => void;

function lowerBound<T>(arr: T[], t: number, key: (v: T) => number) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(arr[mid]) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1; // index of last element with key <= t
}

function fmtGap(v: number | string | null | undefined) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.replace(/^\+?/, '+');
  return `+${v.toFixed(3)}`;
}

export class Replay {
  session: Session;
  status: 'loading' | 'ready' | 'error' = 'loading';
  error: string | null = null;
  progress = 0;

  drivers: DriverInfo[] = [];
  outline: [number, number][] = [];
  t0 = 0;
  tEnd = 0;
  t = 0;
  speed = 4;
  playing = true;
  buffering = false;
  totalLaps = 0;
  leaderLap = 0;
  cars: ReplayCar[] = [];
  messages: RaceControl[] = [];
  version = 0;

  private laps = new Map<number, Lap[]>();
  private lapStarts: { t: number; lap: number }[] = [];
  private positions = new Map<number, { t: number; p: number }[]>();
  private stints = new Map<number, Stint[]>();
  private pits = new Map<number, { t: number; dur: number; lap: number }[]>();
  private intervals = new Map<number, { t: number; gap: IntervalRow['gap_to_leader']; int: IntervalRow['interval'] }[]>();
  private results = new Map<number, SessionResult>();
  private allMessages: (RaceControl & { t: number })[] = [];
  private loc = new Map<number, { t: number; x: number; y: number }[]>();
  private windows = new Map<number, 'loading' | 'done'>();
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private lastEmit = 0;
  private disposed = false;

  constructor(session: Session) {
    this.session = session;
    this.load();
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
  }

  private async load() {
    const k = this.session.session_key;
    try {
      const step = () => {
        this.progress++;
        this.emit();
      };
      const [drivers, laps, positions, stints, pits, results, rc] = await Promise.all([
        of1<DriverInfo>(`/drivers?session_key=${k}`).finally(step),
        of1<Lap>(`/laps?session_key=${k}`).finally(step),
        of1<PositionRow>(`/position?session_key=${k}`).finally(step),
        of1<Stint>(`/stints?session_key=${k}`).finally(step),
        of1<Pit>(`/pit?session_key=${k}`).finally(step),
        of1<SessionResult>(`/session_result?session_key=${k}`).finally(step),
        of1<RaceControl>(`/race_control?session_key=${k}`).finally(step),
      ]);
      if (this.disposed) return;
      if (!drivers.length || !laps.length) throw new Error('OpenF1 has no timing data for this race yet.');
      this.drivers = drivers;

      for (const l of laps) {
        if (!this.laps.has(l.driver_number)) this.laps.set(l.driver_number, []);
        this.laps.get(l.driver_number)!.push(l);
      }
      this.laps.forEach((ls) => ls.sort((a, b) => a.lap_number - b.lap_number));
      const starts = laps.filter((l) => l.date_start).map((l) => ({ t: parseT(l.date_start!), lap: l.lap_number }));
      // leader lap timeline = first car to start each lap
      const firstByLap = new Map<number, number>();
      starts.forEach((s) => firstByLap.set(s.lap, Math.min(firstByLap.get(s.lap) ?? Infinity, s.t)));
      this.lapStarts = [...firstByLap.entries()].map(([lap, t]) => ({ lap, t })).sort((a, b) => a.t - b.t);
      this.totalLaps = Math.max(...results.map((r) => r.number_of_laps ?? 0), ...laps.map((l) => l.lap_number));

      positions.forEach((p) => {
        if (!this.positions.has(p.driver_number)) this.positions.set(p.driver_number, []);
        this.positions.get(p.driver_number)!.push({ t: parseT(p.date), p: p.position });
      });
      this.positions.forEach((a) => a.sort((x, y) => x.t - y.t));
      stints.forEach((s) => {
        if (!this.stints.has(s.driver_number)) this.stints.set(s.driver_number, []);
        this.stints.get(s.driver_number)!.push(s);
      });
      pits.forEach((p) => {
        if (!this.pits.has(p.driver_number)) this.pits.set(p.driver_number, []);
        this.pits.get(p.driver_number)!.push({ t: parseT(p.date), dur: p.lane_duration ?? p.pit_duration ?? 22, lap: p.lap_number });
      });
      results.forEach((r) => this.results.set(r.driver_number, r));
      this.allMessages = rc.map((m) => ({ ...m, t: parseT(m.date) })).sort((a, b) => a.t - b.t);

      this.t0 = (this.lapStarts[0]?.t ?? parseT(this.session.date_start)) - 8000;
      const winner = results.find((r) => r.position === 1);
      const wl = winner ? this.laps.get(winner.driver_number) : undefined;
      const lastLap = wl?.[wl.length - 1];
      this.tEnd = lastLap?.date_start ? parseT(lastLap.date_start) + (lastLap.lap_duration ?? 100) * 1000 + 45_000 : parseT(this.session.date_end);
      this.t = this.t0;

      // Track outline from the winner's fastest clean lap
      await this.loadOutline(winner?.driver_number ?? drivers[0].driver_number);
      step();
      // Gaps (one larger request, loaded in the background)
      of1<IntervalRow>(`/intervals?session_key=${k}`).then((rows) => {
        rows.forEach((r) => {
          if (!this.intervals.has(r.driver_number)) this.intervals.set(r.driver_number, []);
          this.intervals.get(r.driver_number)!.push({ t: parseT(r.date), gap: r.gap_to_leader, int: r.interval });
        });
        this.intervals.forEach((a) => a.sort((x, y) => x.t - y.t));
      }, () => undefined);

      await this.ensureWindows(this.t);
      if (this.disposed) return;
      this.status = 'ready';
      this.compute();
      this.emit();
      this.startLoop();
    } catch (e) {
      if (this.disposed) return;
      this.status = 'error';
      this.error = friendlyError(e);
      this.emit();
    }
  }

  private async loadOutline(driver: number) {
    const ls = (this.laps.get(driver) ?? []).filter((l) => l.lap_number > 2 && l.lap_duration && !l.is_pit_out_lap && l.date_start);
    const candidates = [...ls].sort((a, b) => (a.lap_duration ?? 0) - (b.lap_duration ?? 0)).slice(0, 3);
    for (const lap of candidates) {
      const from = new Date(parseT(lap.date_start!)).toISOString();
      const to = new Date(parseT(lap.date_start!) + (lap.lap_duration ?? 90) * 1000).toISOString();
      const pts = await of1<LocationRow>(`/location?session_key=${this.session.session_key}&driver_number=${driver}&date>${encodeURIComponent(from)}&date<${encodeURIComponent(to)}`);
      const xy = pts.filter((p) => p.x || p.y).map((p) => [p.x, p.y] as [number, number]);
      if (xy.length > 120) {
        this.outline = xy;
        return;
      }
    }
    throw new Error('Could not trace the circuit for this race.');
  }

  private async ensureWindows(t: number) {
    const idx = Math.floor((t - this.t0) / WINDOW_MS);
    const need = [idx, idx + 1].filter((i) => i >= 0 && this.t0 + i * WINDOW_MS < this.tEnd);
    await Promise.all(need.map((i) => this.loadWindow(i)));
    // prefetch one more without waiting
    if (this.t0 + (idx + 2) * WINDOW_MS < this.tEnd) this.loadWindow(idx + 2);
    // drop windows far behind to bound memory
    const cutoff = this.t0 + (idx - 2) * WINDOW_MS;
    if (idx > 3)
      this.loc.forEach((arr, k) => {
        const i = lowerBound(arr, cutoff, (v) => v.t);
        if (i > 0) this.loc.set(k, arr.slice(i));
      });
  }

  private async loadWindow(i: number) {
    if (this.windows.has(i)) return;
    this.windows.set(i, 'loading');
    const from = new Date(this.t0 + i * WINDOW_MS).toISOString();
    const to = new Date(this.t0 + (i + 1) * WINDOW_MS).toISOString();
    try {
      const rows = await of1<LocationRow>(`/location?session_key=${this.session.session_key}&date>${encodeURIComponent(from)}&date<${encodeURIComponent(to)}`, {
        cacheIt: false,
      });
      for (const r of rows) {
        if (!r.x && !r.y) continue;
        if (!this.loc.has(r.driver_number)) this.loc.set(r.driver_number, []);
        this.loc.get(r.driver_number)!.push({ t: parseT(r.date), x: r.x, y: r.y });
      }
      this.loc.forEach((a) => a.sort((x, y) => x.t - y.t));
      this.windows.set(i, 'done');
    } catch {
      this.windows.delete(i);
    }
  }

  private windowReady(t: number) {
    return this.windows.get(Math.floor((t - this.t0) / WINDOW_MS)) === 'done';
  }

  private startLoop() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(200, now - this.last);
      this.last = now;
      if (this.playing && this.t < this.tEnd) {
        const next = this.t + dt * this.speed;
        if (this.windowReady(next)) {
          this.t = next;
          this.buffering = false;
        } else {
          this.buffering = true;
        }
        this.ensureWindows(this.t);
      }
      this.compute();
      this.version++;
      if (now - this.lastEmit > 100) {
        this.lastEmit = now;
        this.listeners.forEach((l) => l());
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ controls */

  togglePlay() {
    if (this.t >= this.tEnd) this.t = this.t0;
    this.playing = !this.playing;
    this.emit();
  }
  setSpeed(s: number) {
    this.speed = s;
    this.emit();
  }
  seekLap(lap: number) {
    const s = this.lapStarts.find((l) => l.lap === lap);
    this.t = s ? s.t - 2000 : this.t0;
    this.ensureWindows(this.t);
    this.compute();
    this.emit();
  }

  /* ------------------------------------------------------------ state at t */

  private compute() {
    const t = this.t;
    const li = lowerBound(this.lapStarts, t, (v) => v.t);
    this.leaderLap = li >= 0 ? this.lapStarts[li].lap : 0;

    this.cars = this.drivers.map((d) => {
      const n = d.driver_number;
      const pos = this.positions.get(n) ?? [];
      const pi = lowerBound(pos, t, (v) => v.t);
      const position = pi >= 0 ? pos[pi].p : pos[0]?.p ?? 99;

      const ls = this.laps.get(n) ?? [];
      let lap = 0;
      let lastLap: number | null = null;
      let bestLap: number | null = null;
      for (const l of ls) {
        if (!l.date_start || parseT(l.date_start) > t) break;
        lap = l.lap_number;
        const prev = ls.find((x) => x.lap_number === l.lap_number - 1);
        if (prev?.lap_duration) {
          lastLap = prev.lap_duration;
          if (bestLap === null || prev.lap_duration < bestLap) bestLap = prev.lap_duration;
        }
      }

      const st = (this.stints.get(n) ?? []).find((s) => lap >= s.lap_start && lap <= (s.lap_end ?? 999));
      const pitRows = this.pits.get(n) ?? [];
      const inPit = pitRows.some((p) => t >= p.t && t <= p.t + p.dur * 1000);
      const stops = pitRows.filter((p) => p.t <= t).length;

      const res = this.results.get(n);
      const lastLapRow = ls[ls.length - 1];
      const lastSeen = lastLapRow?.date_start ? parseT(lastLapRow.date_start) + (lastLapRow.lap_duration ?? 120) * 1000 : 0;
      const out = !!res && (res.dnf || res.dns || res.dsq) && t > lastSeen;
      const finished = !!res && !out && lap >= res.number_of_laps && t > lastSeen;

      // position on track (interpolated)
      const loc = this.loc.get(n) ?? [];
      const k = lowerBound(loc, t, (v) => v.t);
      let x: number | null = null;
      let y: number | null = null;
      if (k >= 0) {
        const a = loc[k];
        const b = loc[k + 1];
        if (b && b.t - a.t < 2000) {
          const f = (t - a.t) / (b.t - a.t);
          x = a.x + (b.x - a.x) * f;
          y = a.y + (b.y - a.y) * f;
        } else if (t - a.t < 4000) {
          x = a.x;
          y = a.y;
        }
      }

      const iv = this.intervals.get(n) ?? [];
      const ii = lowerBound(iv, t, (v) => v.t);
      const gap = ii >= 0 ? fmtGap(iv[ii].gap) : '—';
      const interval = ii >= 0 ? fmtGap(iv[ii].int) : '—';

      return {
        num: n,
        info: d,
        color: d.team_colour ? `#${d.team_colour}` : '#888',
        position,
        x,
        y,
        lap,
        lastLap,
        bestLap,
        compound: st?.compound ?? null,
        tyreAge: st ? Math.max(0, lap - st.lap_start) : 0,
        stops,
        inPit,
        out,
        finished,
        gap,
        interval,
      };
    });
    this.cars.sort((a, b) => Number(a.out) - Number(b.out) || a.position - b.position);

    const mi = lowerBound(this.allMessages, t, (v) => v.t);
    this.messages = mi >= 0 ? this.allMessages.slice(Math.max(0, mi - 7), mi + 1).reverse() : [];
  }

  /** Current flag from race control (green, yellow, red, safety car…). */
  trackStatus(): { label: string; tone: 'green' | 'yellow' | 'red' | 'sc' } {
    const mi = lowerBound(this.allMessages, this.t, (v) => v.t);
    for (let i = mi; i >= 0; i--) {
      const m = this.allMessages[i];
      if (m.category === 'SafetyCar') {
        if (/ENDING|IN THIS LAP|WITHDRAWN/i.test(m.message)) return { label: 'Green flag', tone: 'green' };
        return { label: /VIRTUAL/i.test(m.message) ? 'Virtual safety car' : 'Safety car', tone: 'sc' };
      }
      if (m.flag === 'RED') return { label: 'Red flag', tone: 'red' };
      if ((m.flag === 'GREEN' || m.flag === 'CLEAR') && m.scope === 'Track') return { label: 'Green flag', tone: 'green' };
      if (m.flag === 'CHEQUERED') return { label: 'Chequered flag', tone: 'green' };
    }
    return { label: 'Green flag', tone: 'green' };
  }
}
