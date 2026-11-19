import { useState } from 'react';
import { CIRCUIT } from '../data/track';
import { navigate, useRace } from '../lib/hooks';
import { Topbar } from '../components/Topbar';
import { TrackMap } from '../components/TrackMap';
import { Tower } from '../components/Tower';
import { Feed } from '../components/Feed';
import { Controls } from '../components/Controls';
import { Helmet } from '../components/Helmet';
import { Flag } from '../components/Avatar';
import { Triangle } from '../components/Icons';
import { splitLap, signed } from '../lib/format';
import { Tyre } from '../components/Tyre';

export function Live({ focus }: { focus: string | null }) {
  const engine = useRace();
  const [labels, setLabels] = useState<'top' | 'all' | 'none'>('top');
  const selected = focus && engine.carById(focus) ? focus : engine.order[0].driver.id;
  const car = engine.carById(selected)!;
  const select = (id: string) => navigate(`/live?d=${id}`);

  const lapShown = car.status === 'FIN' || car.status === 'OUT' ? car.lastLap : car.status === 'GRID' ? 0 : car.currentLap;
  const [main, ms] = splitLap(lapShown);
  const delta = car.delta;
  const lapNo = car.status === 'GRID' ? 0 : Math.min(engine.laps, engine.completedLaps(car) + 1);

  return (
    <>
      <Topbar title="Race tracker" back="/" current="/live" />
      <div className="live">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="focusbar">
            <span className="focusbar__name">
              <Flag country={car.driver.country} size={18} />
              <b style={{ color: car.color }}>{car.driver.number}</b>
              <span>{car.driver.lastName}</span>
            </span>
            <span className="focusbar__stat tnum">P{car.position}</span>
            <span className="focusbar__stat tnum">{Math.round(car.speed * 3.6)} km/h</span>
            <span className={`focusbar__stat tnum ${delta === null ? '' : delta <= 0 ? 'up' : 'down'}`}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: delta === null ? 'var(--dim)' : delta <= 0 ? 'var(--green)' : 'var(--red-2)',
                  display: 'inline-block',
                }}
              />
              {delta === null ? '—' : signed(delta)}
            </span>
          </div>

          <div className="mapwrap">
            <TrackMap selected={selected} onSelect={select} labels={labels} />
          </div>

          <div className="lapcard">
            <div className="lapcard__body">
              <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c8cbcf' }}>
                Current lap time {delta !== null && <Triangle up={delta <= 0} />}
                <span style={{ marginLeft: 'auto', marginRight: '40%', color: 'var(--muted)' }} className="tnum">
                  LAP {lapNo}/{engine.laps}
                </span>
              </div>
              <div className="bigstat" style={{ marginTop: 10 }}>
                {main}
                <span className="soft">{ms}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }} className="tnum">
                <span>
                  Last <b style={{ color: 'var(--text)', fontWeight: 500 }}>{splitLap(car.lastLap).join('')}</b>
                </span>
                <span>
                  Best <b className={engine.fastest?.driverId === car.driver.id ? 'purple' : ''} style={{ fontWeight: 500, color: engine.fastest?.driverId === car.driver.id ? undefined : 'var(--text)' }}>{car.bestLap ? splitLap(car.bestLap).join('') : '—'}</b>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Tyre compound={car.compound} size={16} /> {car.tyreAge} laps
                </span>
              </div>
            </div>
            <Helmet driver={car.driver} className="lapcard__art" />
            <a className="lapcard__foot" href={`#/driver/${car.driver.id}`}>
              <Flag country={car.driver.country} size={18} />
              {car.driver.firstName} {car.driver.lastName}
              <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 13 }}>Profile →</span>
            </a>
          </div>
        </div>

        <div className="live__side" style={{ display: 'grid', gap: 12 }}>
          <Controls engine={engine} />
          <div className="chips" role="group" aria-label="Map labels">
            {(['top', 'all', 'none'] as const).map((l) => (
              <button key={l} className={`chip ${labels === l ? 'active' : ''}`} onClick={() => setLabels(l)}>
                {l === 'top' ? 'Labels: top 5' : l === 'all' ? 'Labels: all' : 'Labels: off'}
              </button>
            ))}
            <span className="chip">
              {engine.paused ? '⏸ Paused' : engine.finished ? '🏁 Finished' : <><span className="live-dot" /> Lap {engine.leaderLap()}/{engine.laps}</>}
            </span>
          </div>
          <Tower engine={engine} selected={selected} onSelect={select} />
          <h2 className="section__title" style={{ marginTop: 8, marginBottom: 0 }}>
            Race control
          </h2>
          <Feed engine={engine} limit={8} />
        </div>
      </div>
      <p className="note">
        {CIRCUIT.name} · schematic layout. Timing is produced by an in-browser race model (tyre wear, fuel, traffic, pit stops, retirements) — tap
        any car on the map or row in the tower to track that driver.
      </p>
    </>
  );
}
