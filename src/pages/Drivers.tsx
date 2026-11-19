import { useMemo, useState } from 'react';
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { useRace } from '../lib/hooks';
import { Topbar } from '../components/Topbar';
import { Helmet } from '../components/Helmet';
import { Flag } from '../components/Avatar';

export function Drivers() {
  const engine = useRace();
  const [q, setQ] = useState('');
  const [team, setTeam] = useState<string | null>(null);
  const [sort, setSort] = useState<'live' | 'team'>('live');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const teamOrder = Object.keys(TEAMS);
    return DRIVERS.filter(
      (d) =>
        (!team || d.teamId === team) &&
        (!query || `${d.firstName} ${d.lastName} ${d.code} ${d.nationality} ${TEAMS[d.teamId].name} ${d.number}`.toLowerCase().includes(query)),
    ).sort((a, b) =>
      sort === 'team'
        ? teamOrder.indexOf(a.teamId) - teamOrder.indexOf(b.teamId)
        : (engine.carById(a.id)?.position ?? 99) - (engine.carById(b.id)?.position ?? 99),
    );
    // re-sorting on every engine tick is intentional for live order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, team, sort, engine.version]);

  return (
    <>
      <Topbar title="Drivers" back="home" current="drivers" />
      <div className="drivers-head">
        <div className="eyebrow">2026 grid · 11 teams</div>
        <h1>The Grid</h1>
        <input className="search" placeholder="Search driver, team, nationality or number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drivers" />
        <div className="chips">
          <button className={`chip ${sort === 'live' ? 'active' : ''}`} onClick={() => setSort('live')}>
            Live order
          </button>
          <button className={`chip ${sort === 'team' ? 'active' : ''}`} onClick={() => setSort('team')}>
            By team
          </button>
          <span style={{ width: 1, background: 'var(--line-2)', flex: 'none' }} />
          <button className={`chip ${!team ? 'active' : ''}`} onClick={() => setTeam(null)}>
            All teams
          </button>
          {Object.values(TEAMS).map((t) => (
            <button key={t.id} className={`chip ${team === t.id ? 'active' : ''}`} onClick={() => setTeam(team === t.id ? null : t.id)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="driver-grid">
        {list.map((d) => {
          const t = TEAMS[d.teamId];
          const car = engine.carById(d.id);
          return (
            <a key={d.id} className="dcard" href={`#driver-${d.id}`}>
              <div
                className="dcard__glow"
                style={{ background: `radial-gradient(120% 90% at 85% 60%, ${t.color}55 0%, rgba(0,0,0,0) 60%), linear-gradient(160deg, #34373c 0%, #1d1f22 70%)` }}
              />
              <div className="dcard__num">{d.number}</div>
              {car && (
                <div className="dcard__pos tnum">
                  {car.status === 'OUT' ? 'DNF' : car.status === 'PIT' ? 'In pits' : `P${car.position}`}
                  {car.status !== 'OUT' && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                </div>
              )}
              <Helmet driver={d} className="dcard__helmet" />
              <div className="dcard__info">
                <div className="dcard__first">{d.firstName}</div>
                <div className="dcard__last">{d.lastName}</div>
                <div className="dcard__team">
                  <Flag country={d.country} size={14} />
                  <span className="teambar" style={{ background: t.color, height: 12, width: 3 }} />
                  {t.name}
                </div>
              </div>
            </a>
          );
        })}
        {!list.length && <p style={{ color: 'var(--muted)' }}>No drivers match “{q}”.</p>}
      </div>
    </>
  );
}
