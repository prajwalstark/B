import { useState } from 'react';
import { DRIVER_BY_ID, age, type Driver } from '../data/drivers';
import { HISTORIC_TEAM_COLORS, TEAMS } from '../data/teams';
import { useRace } from '../lib/hooks';
import { Topbar } from '../components/Topbar';
import { Helmet } from '../components/Helmet';
import { Flag } from '../components/Avatar';
import { ChevronIcon, Triangle, ArrowRight } from '../components/Icons';
import { Tyre } from '../components/Tyre';
import { Feed } from '../components/Feed';
import { formatLap } from '../sim/raceEngine';
import { formatDate, ordinal } from '../lib/format';
import { useStandings } from '../data/openf1';

function HistoryChart({ driver }: { driver: Driver }) {
  const seasons = driver.seasons;
  if (!seasons.length)
    return (
      <div className="history" style={{ color: 'var(--muted)', fontSize: 14, padding: 18 }}>
        2026 is {driver.firstName}’s rookie season — no previous championship history.
      </div>
    );
  const maxPos = Math.max(10, ...seasons.map((s) => s.pos ?? 0));
  const dense = seasons.length > 12;
  const bw = dense ? 14 : 22;
  const gap = dense ? 6 : 8;
  const H = 150;
  const W = Math.max(300, seasons.length * (bw + gap) + gap);
  return (
    <div className="history">
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ minWidth: Math.min(W, seasons.length * 18) }} role="img" aria-label="Championship finishing position by season">
          {[1, 5, 10].map((p) => {
            const y = 14 + ((p - 1) / maxPos) * H;
            return (
              <g key={p}>
                <line x1="0" x2={W} y1={y} y2={y} stroke="rgba(255,255,255,.07)" />
              </g>
            );
          })}
          {seasons.map((s, i) => {
            const x = gap + i * (bw + gap);
            const pos = s.pos ?? maxPos;
            const h = Math.max(6, ((maxPos + 1 - pos) / maxPos) * H);
            const color = HISTORIC_TEAM_COLORS[s.team] ?? '#888';
            return (
              <g key={s.year}>
                <title>{`${s.year} · ${s.team} · ${ordinal(pos)}${s.wins ? ` · ${s.wins} wins` : ''}`}</title>
                <rect x={x} y={14 + H - h} width={bw} height={h} rx="2" fill={color} opacity={s.pos === 1 ? 1 : 0.85} />
                {s.pos === 1 && <text x={x + bw / 2} y={14 + H - h + 14} textAnchor="middle" fontSize="11">🏆</text>}
                <text x={x + bw / 2} y={14 + H - h - 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="600">
                  {s.pos ?? '–'}
                </text>
                <text x={x + bw / 2} y={H + 30} textAnchor="middle" fontSize="9.5" fill="#8d9198">
                  ’{String(s.year).slice(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="seasons">
        {[...seasons].reverse().map((s) => (
          <div className="season tnum" key={s.year}>
            <span>{s.year}</span>
            <span className="teambar" style={{ background: HISTORIC_TEAM_COLORS[s.team] ?? '#888' }} />
            <span>{s.team}</span>
            <span className="season__pos">{s.pos ? ordinal(s.pos) : '—'}</span>
            <span className="season__wins">{s.wins ? `${s.wins}W` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Season2026({ number }: { number: number }) {
  const { data, error, loading } = useStandings();
  const row = data?.drivers.find((d) => d.driver_number === number);
  return (
    <section className="section">
      <h2 className="section__title">
        2026 championship · real data <a href="#standings">Standings →</a>
      </h2>
      {loading && <div className="card empty">Loading from OpenF1…</div>}
      {error && <div className="card empty">{error}</div>}
      {data && !row && <div className="card empty">No 2026 championship entry for this driver yet.</div>}
      {data && row && (
        <div className="telemetry">
          <div className="stat">
            <div className="stat__v tnum">P{row.position_current}</div>
            <div className="stat__k">Championship</div>
          </div>
          <div className="stat">
            <div className="stat__v tnum">{row.points_current}</div>
            <div className="stat__k">Points</div>
          </div>
          <div className="stat">
            <div className={`stat__v tnum ${row.points_start !== null && row.points_current > row.points_start ? 'up' : ''}`}>
              {row.points_start === null ? '—' : `+${row.points_current - row.points_start}`}
            </div>
            <div className="stat__k">At {data.session.location}</div>
          </div>
        </div>
      )}
    </section>
  );
}

export function DriverDetail({ id }: { id: string }) {
  const engine = useRace();
  const [open, setOpen] = useState(true);
  const driver = DRIVER_BY_ID[id];
  if (!driver)
    return (
      <>
        <Topbar title="Back to drivers" back="drivers" current="drivers" />
        <p className="note">Driver not found.</p>
      </>
    );
  const team = TEAMS[driver.teamId];
  const car = engine.carById(id)!;
  const sprint = engine.sprintFor(id);
  const racePts = engine.racePoints(car);
  const total = (sprint?.points ?? 0) + racePts;
  const gained = car.grid - car.position;
  const c = driver.career;
  const isSprint = engine.circuit.sprint;
  const winRate = c.starts ? ((c.wins / c.starts) * 100).toFixed(1) : '0.0';
  const podRate = c.starts ? ((c.podiums / c.starts) * 100).toFixed(1) : '0.0';

  return (
    <>
      <Topbar title="Back to drivers" back="drivers" current="drivers" />
      <div className="dlayout">
        <div className="dlayout__left">
          <div className="dhero">
            <div
              className="dhero__bg"
              style={{
                background: `radial-gradient(80% 60% at 50% 55%, ${team.color}66 0%, rgba(0,0,0,0) 70%), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 2px, transparent 2px 38px), linear-gradient(180deg, #50555c 0%, #2b2e33 55%, #1d1f22 100%)`,
              }}
            />
            <div className="dhero__num">{driver.number}</div>
            <Helmet driver={driver} className="dhero__helmet" />
          </div>
          <div className="dpanel">
            <div className="dpanel__head">
              <Flag country={driver.country} size={30} />
              <h1 className="dpanel__name">
                {driver.firstName} {driver.lastName}
              </h1>
              <button className="iconbtn" style={{ background: 'transparent', border: 0 }} aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
                <ChevronIcon up={open} />
              </button>
            </div>
            <div className="collapse" style={{ maxHeight: open ? 600 : 0 }}>
              <div style={{ padding: '10px 20px 20px' }}>
                <div className="eyebrow">Race weekend points · {engine.circuit.circuit} (simulated)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
                  <div className="points-big">
                    {total} <span className="soft">PTS</span>
                  </div>
                  {car.status === 'RUN' && gained !== 0 && <Triangle up={gained > 0} size={14} />}
                </div>
                <div style={{ marginTop: 18 }}>
                  {isSprint ? (
                    <div className="prow tnum" style={{ color: 'var(--green)' }}>
                      <span className="prow__label">Sprint</span>
                      <span>P{sprint?.pos}</span>
                      <span>+{sprint?.points ?? 0} PTS</span>
                    </div>
                  ) : (
                    <div className="prow tnum" style={{ color: 'var(--green)' }}>
                      <span className="prow__label">Qualifying</span>
                      <span>P{car.grid}</span>
                      <span>Grid</span>
                    </div>
                  )}
                  <div className="prow tnum" style={{ color: car.status === 'OUT' ? 'var(--red-2)' : '#d8dadd' }}>
                    <span className="prow__label">
                      Race {car.status === 'RUN' || car.status === 'PIT' ? <span className="live-dot" style={{ marginLeft: 6, width: 6, height: 6 }} /> : null}
                    </span>
                    <span>{car.status === 'OUT' ? 'DNF' : `P${car.position}`}</span>
                    <span>+{racePts} PTS</span>
                  </div>
                </div>
                <a className="btn" href={`#live-${driver.id}`} style={{ marginTop: 18 }}>
                  Track live on the map <ArrowRight />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div>
          <section className="section">
            <h2 className="section__title">
              Live telemetry
              <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }} className="tnum">
                Started P{car.grid}
              </span>
            </h2>
            <div className="telemetry">
              <div className="stat">
                <div className="stat__v tnum">{car.status === 'OUT' ? 'DNF' : `P${car.position}`}</div>
                <div className="stat__k">Position</div>
              </div>
              <div className="stat">
                <div className="stat__v tnum">{car.position === 1 ? '—' : `+${car.gap.toFixed(1)}s`}</div>
                <div className="stat__k">Gap to leader</div>
              </div>
              <div className="stat">
                <div className="stat__v tnum">{Math.round(car.speed * 3.6)}</div>
                <div className="stat__k">Speed km/h</div>
              </div>
              <div className="stat">
                <div className="stat__v tnum">{formatLap(car.lastLap)}</div>
                <div className="stat__k">Last lap</div>
              </div>
              <div className="stat">
                <div className={`stat__v tnum ${engine.fastest?.driverId === id ? 'purple' : ''}`}>{formatLap(car.bestLap)}</div>
                <div className="stat__k">Best lap</div>
              </div>
              <div className="stat">
                <div className="stat__v tnum" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tyre compound={car.compound} size={22} /> {car.tyreAge}
                </div>
                <div className="stat__k">
                  Tyre age · {car.stops} stop{car.stops === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </section>

          <Season2026 number={driver.number} />

          <section className="section">
            <h2 className="section__title">Career · through 2025</h2>
            <div className="stats-grid">
              {[
                [c.titles, 'World titles'],
                [c.wins, 'Wins'],
                [c.podiums, 'Podiums'],
                [c.poles, 'Pole positions'],
                [c.starts, 'Race starts'],
                [`${winRate}%`, 'Win rate'],
              ].map(([v, k]) => (
                <div className="stat" key={k as string}>
                  <div className="stat__v">{v}</div>
                  <div className="stat__k">{k}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section__title">Profile</h2>
            <div className="kv">
              {[
                ['Team', team.fullName],
                ['Car number', `#${driver.number}`],
                ['Nationality', driver.nationality],
                ['Date of birth', `${formatDate(driver.dob)} (age ${age(driver.dob)})`],
                ['Place of birth', driver.birthplace],
                ['F1 debut', driver.debut],
                ['Podium rate', `${podRate}%`],
                ['Power unit', team.powerUnit],
              ].map(([k, v]) => (
                <div className="kv__row" key={k}>
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section__title">Biography</h2>
            <p className="bio">{driver.bio}</p>
          </section>

          <section className="section">
            <h2 className="section__title">
              Championship history <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>{driver.seasons.length} seasons</span>
            </h2>
            <HistoryChart driver={driver} />
          </section>

          <section className="section">
            <h2 className="section__title">Career highlights</h2>
            <ul className="list">
              {driver.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2 className="section__title">Titles & junior career</h2>
            <ul className="list">
              {driver.junior.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2 className="section__title">Race control · {driver.lastName}</h2>
            <Feed engine={engine} driverId={driver.id} limit={6} />
          </section>
        </div>
      </div>
      <p className="note">
        Career statistics and season history are compiled through the end of the 2025 season and may contain small inaccuracies. Race weekend
        points and telemetry come from the in-app race simulation; the 2026 championship figures are real data from OpenF1. Helmet artwork is an original illustration in team colours.
      </p>
    </>
  );
}
