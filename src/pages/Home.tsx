import { useEffect, useRef } from 'react';
import { CALENDAR, heroName, weekendStatus } from '../data/track';
import { DRIVER_BY_ID } from '../data/drivers';
import { navigate, useRace } from '../lib/hooks';
import { Topbar } from '../components/Topbar';
import { CarArt } from '../components/CarArt';
import { CarGlyph, ArrowRight } from '../components/Icons';
import { Avatar, Flag } from '../components/Avatar';
import { Feed } from '../components/Feed';
import { TrackMap } from '../components/TrackMap';
import { formatLap } from '../sim/raceEngine';
import { Tyre } from '../components/Tyre';
import { hex, rosterDriver, useStandings } from '../data/openf1';

function raceDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function Home() {
  const engine = useRace();
  const C = engine.circuit;
  const lead = engine.order[0];
  const max = engine.maxSpeed;
  const maxDriver = max ? DRIVER_BY_ID[max.driverId] : null;
  const [whole, dec] = (max ? max.kmh : 0).toFixed(1).split('.');
  const wk = weekendStatus(C);
  const status = engine.finished ? 'Simulated race finished' : engine.t < 0 ? 'Lights out in ' + Math.ceil(-engine.t) : `Live simulation · Lap ${engine.leaderLap()}/${engine.laps}`;
  const fl = engine.fastest;
  const standings = useStandings();

  // keep the selected round in view in the picker
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pickerRef.current?.querySelector('.chip.active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [C.id]);

  return (
    <>
      <Topbar title={C.grandPrix} current="home" />
      <section className="hero">
        <div className="hero__backdrop" />
        <div style={{ position: 'relative' }}>
          <div className="hero__meta">
            <span>Round {C.round}</span>
            <span className="sep">·</span>
            <Flag country={C.country} size={13} />
            <span>{C.location}</span>
            <span className="sep">·</span>
            <span>{raceDay(C.raceDate)}</span>
            {wk === 'this-weekend' && <span className="wk-badge">This weekend</span>}
          </div>
          <h1 className="hero__title">{heroName(C)}</h1>
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
                  Top speed of the race — <a href={`#driver-${maxDriver.id}`}>{maxDriver.firstName} {maxDriver.lastName}</a>
                </>
              ) : (
                'Speed trap opens when the lights go out'
              )}
            </div>
          </div>

          <a href={`#live-${lead.driver.id}`} className="card leader-card">
            <Avatar driver={lead.driver} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">{engine.finished ? 'Race winner' : 'Race leader'}</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 4 }}>
                <Flag country={lead.driver.country} size={18} /> {lead.driver.firstName} {lead.driver.lastName}
              </div>
            </div>
            <ArrowRight />
          </a>

          <div className="card mini-tower">
            {engine.order.slice(0, 5).map((c) => (
              <a key={c.driver.id} className="mini-row" href={`#driver-${c.driver.id}`}>
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
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card circuit-card">
            <div className="circuit-card__head">
              <div>
                <div className="eyebrow">Circuit</div>
                <div className="circuit-card__name">{C.circuit}</div>
              </div>
              <a className="ctrl" href={`#live-${lead.driver.id}`}>
                Track live <ArrowRight size={14} />
              </a>
            </div>
            <div className="circuit-card__map" onClick={() => navigate(`live-${lead.driver.id}`)}>
              <TrackMap selected={null} onSelect={(id) => navigate(`live-${id}`)} labels="top" top={3} />
            </div>
            <div className="facts tnum">
              <div>
                <b>{C.lengthKm.toFixed(3)}</b>
                <span>km lap</span>
              </div>
              <div>
                <b>{C.laps}</b>
                <span>laps</span>
              </div>
              <div>
                <b>{(C.lengthKm * C.laps).toFixed(1)}</b>
                <span>km race</span>
              </div>
              <div>
                <b className="purple">{formatLap(fl?.time)}</b>
                <span>{fl ? `Fastest · ${DRIVER_BY_ID[fl.driverId].code}` : 'Fastest lap'}</span>
              </div>
            </div>
            <div className="card__foot" style={{ fontSize: 13, color: 'var(--muted)' }}>
              {C.sprint ? 'Sprint weekend · ' : ''}Outline traced from real car-position data
            </div>
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">2026 race weekends</h2>
        <div className="chips rounds" ref={pickerRef} role="group" aria-label="Choose a Grand Prix to simulate">
          {CALENDAR.map((r) => {
            const st = weekendStatus(r);
            return (
              <button key={r.id} className={`chip ${r.id === C.id ? 'active' : ''}`} onClick={() => engine.setCircuit(r.id)} title={r.grandPrix}>
                <span className="tnum" style={{ opacity: 0.6 }}>
                  R{r.round}
                </span>
                <Flag country={r.country} size={13} />
                {heroName(r)}
                {st === 'this-weekend' && <span className="live-dot" style={{ width: 6, height: 6 }} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">
          Championship · real 2026 data <a href="#standings">Full standings →</a>
        </h2>
        {standings.loading && <div className="card empty">Loading standings from OpenF1…</div>}
        {standings.error && <div className="card empty">{standings.error}</div>}
        {standings.data && (
          <a className="card mini-tower" href="#standings">
            {standings.data.drivers.slice(0, 3).map((d) => {
              const rd = rosterDriver(d.driver_number);
              return (
                <span key={d.driver_number} className="mini-row">
                  <span className="tnum" style={{ fontWeight: 600 }}>
                    P{d.position_current}
                  </span>
                  <span className="teambar" style={{ background: hex(d.info?.team_colour) }} />
                  <span>{rd ? `${rd.firstName} ${rd.lastName}` : d.info?.full_name ?? `#${d.driver_number}`}</span>
                  <span className="tnum" style={{ fontWeight: 600 }}>
                    {d.points_current} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>pts</span>
                  </span>
                </span>
              );
            })}
            <span className="card__foot" style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>
              After round {standings.data.round} · {standings.data.session.location}
            </span>
          </a>
        )}
        <a href="#replay" className="btn" style={{ marginTop: 12 }}>
          Replay a real race <ArrowRight />
        </a>
      </section>

      <section className="section">
        <h2 className="section__title">
          Race control <a href="#live">Full timing →</a>
        </h2>
        <Feed engine={engine} limit={6} />
      </section>
      <p className="note">
        The race on this page is simulated at the real {C.circuit} circuit. Championship standings and race replays use real timing data from OpenF1.
      </p>
    </>
  );
}
