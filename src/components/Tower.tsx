import { useState } from 'react';
import type { RaceEngine } from '../sim/raceEngine';
import { formatLap } from '../sim/raceEngine';
import { Tyre } from './Tyre';

export function Tower({ engine, selected, onSelect }: { engine: RaceEngine; selected: string | null; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<'int' | 'leader'>('int');
  const fastestId = engine.fastest?.driverId;
  return (
    <div className="tower" role="table" aria-label="Live timing">
      <div className="tower__head" role="row">
        <span>Pos</span>
        <span />
        <span>Driver</span>
        <button style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }} onClick={() => setMode(mode === 'int' ? 'leader' : 'int')}>
          {mode === 'int' ? 'Interval ⇄' : 'Leader ⇄'}
        </button>
        <span />
        <span className="tower__last">Last lap</span>
      </div>
      {engine.order.map((c) => {
        const down = engine.lapsDown(c);
        let gap: string;
        if (c.status === 'OUT') gap = 'DNF';
        else if (c.position === 1) gap = c.status === 'FIN' ? 'WINNER' : c.status === 'GRID' ? 'POLE' : 'LEADER';
        else if (c.status === 'GRID') gap = '—';
        else if (down > 0 && c.status !== 'FIN') gap = `+${down} LAP${down > 1 ? 'S' : ''}`;
        else gap = `+${(mode === 'int' ? c.interval : c.gap).toFixed(3)}`;
        const gained = c.grid - c.position;
        return (
          <div
            key={c.driver.id}
            role="row"
            className={`tower__row ${c.driver.id === selected ? 'sel' : ''} ${c.status === 'OUT' ? 'out' : ''}`}
            onClick={() => onSelect(c.driver.id)}
          >
            <span className="tower__pos tnum">{c.position}</span>
            <span className="teambar" style={{ background: c.color }} />
            <span className="tower__driver">
              <b>{c.driver.code}</b>
              {c.status === 'PIT' && <span className="badge badge--pit">PIT</span>}
              {c.status === 'OUT' && <span className="badge badge--out">OUT</span>}
              {c.status === 'FIN' && <span className="badge badge--fin">🏁</span>}
              {c.status === 'RUN' && gained !== 0 && engine.t > 5 && (
                <small className={gained > 0 ? 'up' : 'down'}>
                  {gained > 0 ? '▲' : '▼'}
                  {Math.abs(gained)}
                </small>
              )}
            </span>
            <span className="tower__gap tnum">{gap}</span>
            <span>
              <Tyre compound={c.compound} />
            </span>
            <span className={`tower__last tnum ${c.driver.id === fastestId ? 'purple' : ''}`}>{formatLap(c.lastLap)}</span>
          </div>
        );
      })}
    </div>
  );
}
