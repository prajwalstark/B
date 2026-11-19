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
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      const next = parse();
      setRoute((prev) => {
        if (prev.path.join('/') !== next.path.join('/')) window.scrollTo({ top: 0 });
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
