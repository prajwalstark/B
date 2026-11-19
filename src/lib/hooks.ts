import { useEffect, useState, useSyncExternalStore } from 'react';
import { getEngine } from '../sim/raceEngine';

/** Re-renders ~15x per second with the live race engine. */
export function useRace() {
  const engine = getEngine();
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  return engine;
}

/** Re-renders on every animation frame (for smooth map motion). */
export function useFrame() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return getEngine();
}

export interface Route {
  /** Page name: home | live | drivers | driver */
  page: string;
  /** Driver id for `live-<id>` and `driver-<id>` */
  id: string | null;
}

// Routes are plain hash names (#live, #live-leclerc, #driver-ocon) so links survive any host.
function parse(): Route {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')) || 'home';
  const m = raw.match(/^(live|driver)-([a-z0-9-]+)$/);
  if (m) return { page: m[1], id: m[2] };
  if (raw === 'live' || raw === 'drivers') return { page: raw, id: null };
  return { page: 'home', id: null };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      const next = parse();
      setRoute((prev) => {
        if (prev.page !== next.page || (prev.page === 'driver' && prev.id !== next.id)) window.scrollTo({ top: 0 });
        return next;
      });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to;
}
