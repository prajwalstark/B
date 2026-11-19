import { CIRCUIT } from '../data/track';
import { DRIVER_BY_ID } from '../data/drivers';
import { useRace } from '../lib/hooks';
import { Topbar } from '../components/Topbar';
import { CarArt } from '../components/CarArt';
import { CarGlyph, ArrowRight } from '../components/Icons';
import { Avatar, Flag } from '../components/Avatar';
import { Feed } from '../components/Feed';
import { formatLap } from '../sim/raceEngine';
import { Tyre } from '../components/Tyre';

export function Home() {
  const engine = useRace();
  const lead = engine.order[0];
  const max = engine.maxSpeed;
  const maxDriver = max ? DRIVER_BY_ID[max.driverId] : null;
  const [whole, dec] = (max ? max.kmh : 0).toFixed(1).split('.');
  const status = engine.finished ? 'RACE FINISHED' : engine.t < 0 ? 'LIGHTS OUT IN ' + Math.ceil(-engine.t) : `LIVE — RACE · LAP ${engine.leaderLap()}/${engine.laps}`;
  const fl = engine.fastest;

  return (
    <>
      <Topbar title={`${CIRCUIT.grandPrix} 2026`} current="/" />
      <section className="hero">
        <div className="hero__backdrop" />
        <div style={{ position: 'relative' }}>
          <div className="hero__meta">
            <span>Round 21</span>
            <span className="sep">·</span>
            <Flag country="BR" size={13} />
            <span>{CIRCUIT.city}</span>
          </div>
          <h1 className="hero__title">Interlagos</h1>
          <div className="hero__status">
            {!engine.finished && <span className="live-dot" />} {status}
          </div>
        </div>
        <div className="hero__stage">
          <CarArt color={lead.color} />
        </div>
      </section>

      <div className="home-grid">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="speedcard">
              <div className="eyebrow">Max speed</div>
              <span className="speedcard__icon">
                <CarGlyph />
              </span>
              <div className="bigstat" style={{ marginTop: 14 }}>
                {whole}
                <span className="soft">.{dec}</span>
                <span className="unit">km/h</span>
              </div>
            </div>
            <div className="card__foot">
              {maxDriver ? (
                <>
                  Top speed of the race — <a href={`#/driver/${maxDriver.id}`}>{maxDriver.firstName} {maxDriver.lastName}</a>
                </>
              ) : (
                'Speed trap opens when the lights go out'
              )}
            </div>
          </div>

          <a href={`#/live?d=${lead.driver.id}`} className="card leader-card">
            <Avatar driver={lead.driver} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">{engine.finished ? 'Race winner' : 'Race leader'}</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 4 }}>
                <Flag country={lead.driver.country} size={18} /> {lead.driver.firstName} {lead.driver.lastName}
              </div>
            </div>
            <ArrowRight />
          </a>

          <a href="#/live" className="btn btn--red">
            Open live tracker <ArrowRight />
          </a>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card mini-tower">
            {engine.order.slice(0, 5).map((c) => (
              <a key={c.driver.id} className="mini-row" href={`#/driver/${c.driver.id}`}>
                <span className="tnum" style={{ fontWeight: 600 }}>
                  P{c.position}
                </span>
                <span className="teambar" style={{ background: c.color }} />
                <span>
                  {c.driver.firstName[0]}. {c.driver.lastName}
                </span>
                <span className="tnum" style={{ color: 'var(--muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {c.position === 1 ? 'Leader' : c.status === 'PIT' ? 'PIT' : `+${c.gap.toFixed(3)}`}
                  <Tyre compound={c.compound} size={18} />
                </span>
              </a>
            ))}
          </div>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)' }}>
            <div className="stat">
              <div className="stat__k" style={{ marginTop: 0, marginBottom: 8 }}>
                Fastest lap
              </div>
              <div className="stat__v purple tnum" style={{ fontSize: 26 }}>
                {formatLap(fl?.time)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{fl ? `${DRIVER_BY_ID[fl.driverId].lastName} · Lap ${fl.lap}` : 'Not set yet'}</div>
            </div>
            <div className="stat">
              <div className="stat__k" style={{ marginTop: 0, marginBottom: 8 }}>
                Circuit
              </div>
              <div className="stat__v tnum" style={{ fontSize: 26 }}>
                {CIRCUIT.lengthKm.toFixed(3)} <span style={{ fontSize: 14, color: 'var(--muted)' }}>km</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{CIRCUIT.laps} laps · Sprint weekend</div>
            </div>
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">
          Race control <a href="#/live">Full timing →</a>
        </h2>
        <Feed engine={engine} limit={6} />
      </section>
    </>
  );
}
