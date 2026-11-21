/**
 * Minimal client for the free OpenF1 API (https://openf1.org) — real timing data.
 * Requests are queued (≤ ~3/s, as the free tier asks) and cached in memory.
 */
import { useEffect, useState } from 'react';
import { DRIVERS, type Driver } from './drivers';

export const OPENF1 = 'https://api.openf1.org/v1';

export interface Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  circuit_short_name: string;
  country_name: string;
  country_code: string;
  location: string;
  year: number;
  is_cancelled?: boolean;
}
export interface DriverInfo {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
}
export interface ChampDriver {
  driver_number: number;
  position_start: number | null;
  position_current: number;
  points_start: number | null;
  points_current: number;
}
export interface ChampTeam {
  team_name: string;
  position_start: number | null;
  position_current: number;
  points_start: number | null;
  points_current: number;
}
export interface Lap {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}
export interface PositionRow {
  date: string;
  driver_number: number;
  position: number;
}
export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string;
}
export interface RaceControl {
  date: string;
  lap_number: number | null;
  category: string;
  flag: string | null;
  scope?: string | null;
  message: string;
  driver_number: number | null;
}
export interface Pit {
  date: string;
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  lane_duration?: number | null;
  stop_duration?: number | null;
}
export interface IntervalRow {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}
export interface LocationRow {
  date: string;
  driver_number: number;
  x: number;
  y: number;
}
export interface SessionResult {
  driver_number: number;
  position: number | null;
  number_of_laps: number;
  points: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

/* ------------------------------------------------------------ request queue */

let lastRequest = 0;
let chain: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<unknown>>();

async function rawFetch<T>(path: string, attempt = 0): Promise<T[]> {
  const gap = 360 - (Date.now() - lastRequest);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  lastRequest = Date.now();
  const res = await fetch(OPENF1 + path);
  if (res.status === 404) return [];
  if (res.status === 401 || res.status === 403) {
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(/live/i.test(detail) ? 'LIVE_LOCK' : `OpenF1 refused the request (${res.status}).`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return rawFetch<T>(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`OpenF1 answered ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? (body as T[]) : [];
}

/** Queued, cached GET. `path` starts with the endpoint, e.g. `/drivers?session_key=1`. */
export function of1<T>(path: string, { cacheIt = true } = {}): Promise<T[]> {
  if (cacheIt && cache.has(path)) return cache.get(path) as Promise<T[]>;
  const p = chain.then(() => rawFetch<T>(path));
  chain = p.catch(() => undefined);
  if (cacheIt) {
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'LIVE_LOCK')
    return 'A Formula 1 session is live right now, and OpenF1 only serves its data to paid subscribers until it ends. Real standings and replays will load again after the session — usually within an hour or two.';
  if (/Failed to fetch|NetworkError|Load failed|blocked/i.test(msg))
    return 'Could not load real data from OpenF1 (api.openf1.org). Two common reasons: a Formula 1 session is live right now (OpenF1 limits free access until it ends — try again afterwards), or this page cannot reach outside sites (the claude.ai preview blocks them — open the full app at prajwalstark.github.io/B instead).';
  return msg;
}

/* ------------------------------------------------------------ helpers */

export function hex(c: string | null | undefined, fallback = '#888') {
  if (!c) return fallback;
  return c.startsWith('#') ? c : `#${c}`;
}

export function rosterDriver(num: number): Driver | null {
  return DRIVERS.find((d) => d.number === num) ?? null;
}

const TEAM_IDS: Record<string, string> = {
  McLaren: 'mclaren',
  Mercedes: 'mercedes',
  Ferrari: 'ferrari',
  'Red Bull Racing': 'redbull',
  Williams: 'williams',
  'Aston Martin': 'astonmartin',
  'Racing Bulls': 'racingbulls',
  'Haas F1 Team': 'haas',
  Alpine: 'alpine',
  Audi: 'audi',
  Cadillac: 'cadillac',
};
export const teamIdFor = (name: string) => TEAM_IDS[name] ?? null;

export async function raceSessions(year: number): Promise<Session[]> {
  const list = await of1<Session>(`/sessions?year=${year}&session_name=Race`);
  const now = Date.now();
  return list
    .filter((s) => !s.is_cancelled && new Date(s.date_end).getTime() < now)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
}

export interface Standings {
  session: Session;
  round: number;
  drivers: (ChampDriver & { info: DriverInfo | null })[];
  teams: ChampTeam[];
}

/** Championship tables after the most recent completed race of `year`. */
export async function latestStandings(year = new Date().getFullYear()): Promise<Standings | null> {
  let races = await raceSessions(year);
  if (!races.length) races = await raceSessions(year - 1);
  if (!races.length) return null;
  // Walk back until a race has championship data (it is published shortly after the flag).
  for (let i = races.length - 1; i >= Math.max(0, races.length - 3); i--) {
    const s = races[i];
    const [drivers, teams] = await Promise.all([
      of1<ChampDriver>(`/championship_drivers?session_key=${s.session_key}`),
      of1<ChampTeam>(`/championship_teams?session_key=${s.session_key}`),
    ]);
    if (!drivers.length) continue;
    // Names: drivers who raced this season (stand-ins included)
    const infos = new Map<number, DriverInfo>();
    for (const r of races.slice(Math.max(0, i - 6), i + 1).reverse()) {
      const list = await of1<DriverInfo>(`/drivers?session_key=${r.session_key}`);
      list.forEach((d) => infos.has(d.driver_number) || infos.set(d.driver_number, d));
      if (drivers.every((d) => infos.has(d.driver_number))) break;
    }
    return {
      session: s,
      round: i + 1,
      drivers: drivers.sort((a, b) => a.position_current - b.position_current).map((d) => ({ ...d, info: infos.get(d.driver_number) ?? null })),
      teams: teams.sort((a, b) => a.position_current - b.position_current),
    };
  }
  return null;
}

/* ------------------------------------------------------------ react hook */

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState({ data: null, error: friendlyError(e), loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

let standingsPromise: Promise<Standings | null> | null = null;
export function useStandings() {
  return useAsync(() => {
    if (!standingsPromise) {
      standingsPromise = latestStandings();
      standingsPromise.catch(() => (standingsPromise = null));
    }
    return standingsPromise;
  }, []);
}
