import { useState } from 'react';
import { Topbar } from '../components/Topbar';
import { Flag } from '../components/Avatar';
import { useRace } from '../lib/hooks';
import { hex, rosterDriver, teamIdFor, useStandings } from '../data/openf1';
import { TEAMS } from '../data/teams';
import { DRIVER_BY_ID } from '../data/drivers';

type Tab = 'drivers' | 'teams';
type Source = 'season' | 'race';

function Move({ from, to }: { from: number | null; to: number }) {
  if (from === null || from === to) return <span className="move" />;
  const up = from > to;
  return (
    <span className={`move ${up ? 'up' : 'down'}`} title={`${up ? 'Up' : 'Down'} ${Math.abs(from - to)} this race`}>
      {up ? '▲' : '▼'}
      {Math.abs(from - to)}
    </span>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="pbar" aria-hidden="true">
      <span style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} />
    </span>
  );
}

function SeasonTables({ tab }: { tab: Tab }) {
  const { data, error, loading } = useStandings();
  if (loading) return <div className="card empty">Loading the 2026 championship from OpenF1…</div>;
  if (error) return <div className="card empty">{error}</div>;
  if (!data) return <div className="card empty">No championship data has been published yet.</div>;

  const caption = (
    <p className="table-caption">
      After round {data.round} — {data.session.location}, {new Date(data.session.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
      Arrows and “+pts” show the change at that race.
    </p>
  );

  if (tab === 'drivers') {
    const max = data.drivers[0]?.points_current ?? 0;
    return (
      <>
        {caption}
        <div className="standings card">
          {data.drivers.map((d) => {
            const rd = rosterDriver(d.driver_number);
            const name = rd ? `${rd.firstName} ${rd.lastName}` : d.info?.full_name.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()) ?? `#${d.driver_number}`;
            const color = hex(d.info?.team_colour);
            const gained = d.points_start === null ? null : d.points_current - d.points_start;
            const row = (
              <>
                <span className="st__pos tnum">{d.position_current}</span>
                <Move from={d.position_start} to={d.position_current} />
                <span className="teambar" style={{ background: color }} />
                <span className="st__name">
                  <b>
                    {rd && <Flag country={rd.country} size={14} />} {name}
                  </b>
                  <small>
                    {d.info?.team_name ?? '—'}
                    {!rd && ' · stand-in'}
                  </small>
                  <Bar value={d.points_current} max={max} color={color} />
                </span>
                <span className="st__pts tnum">
                  {d.points_current}
                  {gained ? <small className="up">+{gained}</small> : null}
                </span>
              </>
            );
            return rd ? (
              <a key={d.driver_number} className="st__row" href={`#driver-${rd.id}`}>
                {row}
              </a>
            ) : (
              <div key={d.driver_number} className="st__row">
                {row}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  const max = data.teams[0]?.points_current ?? 0;
  return (
    <>
      {caption}
      <div className="standings card">
        {data.teams.map((t) => {
          const id = teamIdFor(t.team_name);
          const color = id ? TEAMS[id].color : '#888';
          const gained = t.points_start === null ? null : t.points_current - t.points_start;
          return (
            <div key={t.team_name} className="st__row">
              <span className="st__pos tnum">{t.position_current}</span>
              <Move from={t.position_start} to={t.position_current} />
              <span className="teambar" style={{ background: color }} />
              <span className="st__name">
                <b>{id ? TEAMS[id].name : t.team_name}</b>
                <small>{id ? `${TEAMS[id].powerUnit} power` : ''}</small>
                <Bar value={t.points_current} max={max} color={color} />
              </span>
              <span className="st__pts tnum">
                {t.points_current}
                {gained ? <small className="up">+{gained}</small> : null}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function RaceTables({ tab }: { tab: Tab }) {
  const engine = useRace();
  const rows = engine.order.map((c) => {
    const sprint = engine.sprintFor(c.driver.id)?.points ?? 0;
    return { car: c, race: engine.racePoints(c), sprint, total: engine.racePoints(c) + sprint };
  });
  const caption = (
    <p className="table-caption">
      Points from the simulated {engine.circuit.grandPrix} as it stands now{engine.circuit.sprint ? ', including the sprint' : ''}.
    </p>
  );
  if (tab === 'drivers') {
    const sorted = [...rows].sort((a, b) => b.total - a.total || a.car.position - b.car.position);
    const max = sorted[0]?.total ?? 0;
    return (
      <>
        {caption}
        <div className="standings card">
          {sorted.map((r, i) => (
            <a key={r.car.driver.id} className="st__row" href={`#driver-${r.car.driver.id}`}>
              <span className="st__pos tnum">{i + 1}</span>
              <span className="move" />
              <span className="teambar" style={{ background: r.car.color }} />
              <span className="st__name">
                <b>
                  <Flag country={r.car.driver.country} size={14} /> {r.car.driver.firstName} {r.car.driver.lastName}
                </b>
                <small>
                  {TEAMS[r.car.driver.teamId].name} · {r.car.status === 'OUT' ? 'DNF' : `running P${r.car.position}`}
                </small>
                <Bar value={r.total} max={max} color={r.car.color} />
              </span>
              <span className="st__pts tnum">{r.total}</span>
            </a>
          ))}
        </div>
      </>
    );
  }
  const teams = Object.values(TEAMS)
    .map((t) => ({ t, pts: rows.filter((r) => r.car.driver.teamId === t.id).reduce((a, r) => a + r.total, 0) }))
    .sort((a, b) => b.pts - a.pts);
  const max = teams[0]?.pts ?? 0;
  return (
    <>
      {caption}
      <div className="standings card">
        {teams.map(({ t, pts }, i) => (
          <div key={t.id} className="st__row">
            <span className="st__pos tnum">{i + 1}</span>
            <span className="move" />
            <span className="teambar" style={{ background: t.color }} />
            <span className="st__name">
              <b>{t.name}</b>
              <small>
                {rows
                  .filter((r) => r.car.driver.teamId === t.id)
                  .map((r) => DRIVER_BY_ID[r.car.driver.id].code)
                  .join(' · ')}
              </small>
              <Bar value={pts} max={max} color={t.color} />
            </span>
            <span className="st__pts tnum">{pts}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function Standings() {
  const [tab, setTab] = useState<Tab>('drivers');
  const [source, setSource] = useState<Source>('season');
  return (
    <>
      <Topbar title="Standings" back="home" current="standings" />
      <div className="drivers-head">
        <div className="eyebrow">{source === 'season' ? 'Formula One World Championship · real data' : 'This race · simulation'}</div>
        <h1>Standings</h1>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className={`chip ${source === 'season' ? 'active' : ''}`} onClick={() => setSource('season')}>
            2026 season
          </button>
          <button className={`chip ${source === 'race' ? 'active' : ''}`} onClick={() => setSource('race')}>
            This race (simulated)
          </button>
        </div>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'drivers'} className={tab === 'drivers' ? 'on' : ''} onClick={() => setTab('drivers')}>
            Drivers
          </button>
          <button role="tab" aria-selected={tab === 'teams'} className={tab === 'teams' ? 'on' : ''} onClick={() => setTab('teams')}>
            Constructors
          </button>
        </div>
      </div>
      <section className="section" style={{ marginTop: 16 }}>
        {source === 'season' ? <SeasonTables tab={tab} /> : <RaceTables tab={tab} />}
      </section>
      <p className="note">Season standings come from OpenF1 (openf1.org), an unofficial source of Formula 1 timing data.</p>
    </>
  );
}
