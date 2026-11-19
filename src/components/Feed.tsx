import type { RaceEngine } from '../sim/raceEngine';

export function Feed({ engine, limit = 6, driverId }: { engine: RaceEngine; limit?: number; driverId?: string }) {
  const items = engine.events.filter((e) => !driverId || e.driverId === driverId).slice(0, limit);
  if (!items.length) return <div className="card" style={{ padding: 18, color: 'var(--muted)', fontSize: 14 }}>No messages yet.</div>;
  return (
    <div className="card feed" aria-live="polite">
      {items.map((e) => (
        <div className="feed__item" key={e.id}>
          <span className="feed__lap tnum">LAP {e.lap}</span>
          <span>
            <span className={`tag tag--${e.kind}`}>{e.kind === 'FASTEST' ? 'FL' : e.kind}</span>
            {e.text}
          </span>
        </div>
      ))}
    </div>
  );
}
