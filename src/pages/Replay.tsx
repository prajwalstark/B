import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Topbar } from '../components/Topbar';
import { Flag } from '../components/Avatar';
import { PauseIcon, PlayIcon } from '../components/Icons';
import { raceSessions, rosterDriver, useAsync, type Session } from '../data/openf1';
import { Replay, type ReplayCar } from '../sim/replay';
import { splitLap } from '../lib/format';
import { formatLap } from '../sim/raceEngine';

const TYRES: Record<string, { c: string; s: string }> = {
  SOFT: { c: '#FF3B3B', s: 'S' },
  MEDIUM: { c: '#FFD23F', s: 'M' },
  HARD: { c: '#F2F2F2', s: 'H' },
  INTERMEDIATE: { c: '#43B02A', s: 'I' },
  WET: { c: '#2F7FE0', s: 'W' },
};

function TyreBadge({ compound, size = 20 }: { compound: string | null; size?: number }) {
  const t = compound ? TYRES[compound] : null;
  if (!t) return <span className="tyre" style={{ color: 'var(--dim)', width: size, height: size }} />;
  return (
    <span className="tyre" title={compound!.toLowerCase()} style={{ color: t.c, width: size, height: size }}>
      <span>{t.s}</span>
    </span>
  );
}

const ISO3: Record<string, string> = {
  AUS: 'AU', CHN: 'CN', JPN: 'JP', BRN: 'BH', KSA: 'SA', USA: 'US', CAN: 'CA', MON: 'MC', ESP: 'ES', AUT: 'AT', GBR: 'GB', BEL: 'BE',
  HUN: 'HU', NED: 'NL', ITA: 'IT', AZE: 'AZ', SGP: 'SG', MEX: 'MX', BRA: 'BR', QAT: 'QA', UAE: 'AE', MAS: 'MY',
};

function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      set((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

function ReplayMap({ replay, selected, onSelect }: { replay: Replay; selected: number | null; onSelect: (n: number) => void }) {
  useTick(replay.status === 'ready');
  const geo = useMemo(() => {
    const pts = replay.outline.map(([x, y]) => [x, -y]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
    const PAD = 34;
    const s = 380 / span;
    const w = (Math.max(...xs) - minX) * s + PAD * 2;
    const h = (Math.max(...ys) - minY) * s + PAD * 2;
    const tx = (x: number, y: number): [number, number] => [(x - minX) * s + PAD, (-y - minY) * s + PAD];
    const path = 'M' + replay.outline.map(([x, y]) => tx(x, y).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
    const start = tx(...replay.outline[0]);
    return { w, h, tx, path, start };
  }, [replay.outline]);

  const cars = replay.cars.filter((c) => c.x !== null && !c.out);
  const labelled = cars.filter((c) => c.position <= 3 || c.num === selected);
  return (
    <svg className="map" viewBox={`0 0 ${geo.w.toFixed(0)} ${geo.h.toFixed(0)}`} role="img" aria-label={`${replay.session.circuit_short_name} replay map`}>
      <path d={geo.path} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="13" strokeLinejoin="round" />
      <path d={geo.path} fill="none" stroke="#f3f3f3" strokeWidth="5.5" strokeLinejoin="round" />
      <circle cx={geo.start[0]} cy={geo.start[1]} r="4" fill="none" stroke="#fff" strokeWidth="1.5" />
      {[...cars].reverse().map((c) => {
        const [x, y] = geo.tx(c.x!, c.y!);
        const sel = c.num === selected;
        return (
          <g key={c.num} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} onClick={() => onSelect(c.num)} style={{ cursor: 'pointer' }}>
            <circle r={sel ? 7.5 : 5.2} fill={c.color} stroke={sel ? '#fff' : '#111'} strokeWidth={sel ? 2 : 1.2} opacity={c.inPit ? 0.5 : 1} />
            <circle r="14" fill="transparent" />
          </g>
        );
      })}
      {labelled.map((c, i) => {
        const [x, y] = geo.tx(c.x!, c.y!);
        const lx = Math.min(geo.w - 18, Math.max(18, x + (x > geo.w / 2 ? -34 : 34)));
        const ly = Math.min(geo.h - 14, Math.max(14, y - 20 - i * 3));
        const sel = c.num === selected;
        return (
          <g key={'l' + c.num} onClick={() => onSelect(c.num)} style={{ cursor: 'pointer' }}>
            <line x1={x} y1={y} x2={lx} y2={ly} stroke="rgba(255,255,255,.5)" strokeWidth="0.8" />
            <g transform={`translate(${lx - 15},${ly - 12})`}>
              <rect width="30" height="24" rx="2" fill={sel ? '#e10600' : 'rgba(70,74,80,.94)'} />
              <rect width="30" height="3" rx="1" fill={c.color} />
              <text x="15" y="12.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">
                {c.info.name_acronym}
              </text>
              <text x="15" y="20.5" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,.85)">
                {c.inPit ? 'PIT' : `P${c.position}`}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function ReplayView({ session }: { session: Session }) {
  const replay = useMemo(() => new Replay(session), [session]);
  useEffect(() => () => replay.dispose(), [replay]);
  useSyncExternalStore(replay.subscribe, replay.getVersion);
  const [selected, setSelected] = useState<number | null>(null);
  const [gapMode, setGapMode] = useState<'int' | 'gap'>('int');

  if (replay.status === 'loading')
    return (
      <div className="card empty">
        Loading real timing data for the {session.location} race… ({replay.progress}/8)
      </div>
    );
  if (replay.status === 'error') return <div className="card empty">{replay.error}</div>;

  const sel: ReplayCar | undefined = replay.cars.find((c) => c.num === selected) ?? replay.cars[0];
  const flag = replay.trackStatus();
  const clock = Math.max(0, (replay.t - replay.t0) / 1000 - 8);
  const [cm, cs] = splitLap(clock);
  const done = replay.t >= replay.tEnd;
  const rd = sel ? rosterDriver(sel.num) : null;

  return (
    <div className="live">
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="focusbar">
          <span className="focusbar__name">
            <b style={{ color: sel?.color }}>{sel?.num}</b>
            <span>{sel?.info.last_name ?? sel?.info.full_name}</span>
          </span>
          <span className="focusbar__stat tnum">P{sel?.position}</span>
          <span className="focusbar__stat tnum">Lap {sel?.lap}</span>
          <span className={`flagpill flagpill--${flag.tone}`}>{flag.label}</span>
        </div>
        <div className="mapwrap">
          <ReplayMap replay={replay} selected={sel?.num ?? null} onSelect={setSelected} />
          {replay.buffering && <div className="buffering">Loading positions…</div>}
        </div>
        <div className="lapcard">
          <div className="lapcard__body">
            <div className="eyebrow" style={{ display: 'flex', gap: 8, color: '#c8cbcf' }}>
              Race time
              <span className="tnum" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
                LAP {Math.min(replay.leaderLap, replay.totalLaps)}/{replay.totalLaps}
              </span>
            </div>
            <div className="bigstat" style={{ marginTop: 10 }}>
              {cm}
              <span className="soft">{cs.slice(0, 2)}</span>
            </div>
            {sel && (
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }} className="tnum">
                <span>
                  {sel.info.name_acronym} last <b style={{ color: 'var(--text)', fontWeight: 500 }}>{formatLap(sel.lastLap)}</b>
                </span>
                <span>
                  Best <b style={{ color: 'var(--text)', fontWeight: 500 }}>{formatLap(sel.bestLap)}</b>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TyreBadge compound={sel.compound} size={16} /> {sel.tyreAge} laps · {sel.stops} stop{sel.stops === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
          {sel && (
            <a className="lapcard__foot" href={rd ? `#driver-${rd.id}` : undefined}>
              {rd && <Flag country={rd.country} size={18} />}
              {sel.info.full_name.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase())}
              <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 13 }}>{rd ? 'Profile →' : sel.info.team_name}</span>
            </a>
          )}
        </div>
      </div>

      <div className="live__side" style={{ display: 'grid', gap: 12 }}>
        <div className="controls">
          <button className="ctrl" onClick={() => replay.togglePlay()} aria-label={replay.playing && !done ? 'Pause' : 'Play'}>
            {replay.playing && !done ? <PauseIcon /> : <PlayIcon />}
          </button>
          {[1, 4, 16].map((s) => (
            <button key={s} className={`ctrl tnum ${replay.speed === s ? 'active' : ''}`} onClick={() => replay.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <label className="scrub">
          <span className="tnum">Jump to lap {Math.max(1, Math.min(replay.leaderLap, replay.totalLaps))}</span>
          <input
            id="replay-lap"
            type="range"
            min={1}
            max={replay.totalLaps}
            value={Math.max(1, Math.min(replay.leaderLap, replay.totalLaps))}
            onChange={(e) => replay.seekLap(Number(e.target.value))}
          />
        </label>
        <div className="tower" role="table" aria-label="Replay timing">
          <div className="tower__head" role="row">
            <span>Pos</span>
            <span />
            <span>Driver</span>
            <button style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }} onClick={() => setGapMode(gapMode === 'int' ? 'gap' : 'int')}>
              {gapMode === 'int' ? 'Interval ⇄' : 'Leader ⇄'}
            </button>
            <span />
            <span className="tower__last">Last lap</span>
          </div>
          {replay.cars.map((c) => (
            <div key={c.num} role="row" className={`tower__row ${c.num === sel?.num ? 'sel' : ''} ${c.out ? 'out' : ''}`} onClick={() => setSelected(c.num)}>
              <span className="tower__pos tnum">{c.position}</span>
              <span className="teambar" style={{ background: c.color }} />
              <span className="tower__driver">
                <b>{c.info.name_acronym}</b>
                {c.inPit && <span className="badge badge--pit">PIT</span>}
                {c.out && <span className="badge badge--out">OUT</span>}
                {c.finished && <span className="badge badge--fin">🏁</span>}
              </span>
              <span className="tower__gap tnum">{c.position === 1 ? 'LEADER' : gapMode === 'int' ? c.interval : c.gap}</span>
              <span>
                <TyreBadge compound={c.compound} />
              </span>
              <span className="tower__last tnum">{formatLap(c.lastLap)}</span>
            </div>
          ))}
        </div>
        <h2 className="section__title" style={{ marginTop: 8, marginBottom: 0 }}>
          Race control
        </h2>
        <div className="card feed">
          {replay.messages.length === 0 && <div className="feed__item">No messages yet.</div>}
          {replay.messages.map((m, i) => (
            <div className="feed__item" key={m.date + i}>
              <span className="feed__lap tnum">{m.lap_number ? `LAP ${m.lap_number}` : '—'}</span>
              <span>
                {m.flag && <span className={`tag tag--${m.flag === 'RED' ? 'DNF' : m.flag.includes('YELLOW') ? 'PIT' : 'OVERTAKE'}`}>{m.flag}</span>}
                {m.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReplayPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const races = useAsync(() => raceSessions(year), [year]);
  const [key, setKey] = useState<number | null>(null);
  const list = races.data ?? [];
  const session = list.find((s) => s.session_key === key) ?? list[list.length - 1];
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll only the picker row sideways (never the page) so the selected chip is centred
    const row = pickerRef.current;
    const el = row?.querySelector('.chip.active') as HTMLElement | null;
    if (row && el) row.scrollLeft = el.offsetLeft - row.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2;
  }, [session?.session_key]);

  return (
    <>
      <Topbar title="Race replay · real data" back="home" current="replay" />
      <div className="drivers-head">
        <div className="eyebrow">Real timing data · OpenF1</div>
        <h1>{session ? session.location : 'Race replay'}</h1>
        <div className="chips" style={{ marginBottom: 10 }}>
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
            <button
              key={y}
              className={`chip ${y === year ? 'active' : ''}`}
              onClick={() => {
                setYear(y);
                setKey(null);
              }}
            >
              {y}
            </button>
          ))}
        </div>
        {list.length > 0 && (
          <div className="chips rounds" role="group" aria-label="Choose a race" ref={pickerRef}>
            {list.map((s) => (
              <button key={s.session_key} className={`chip ${s.session_key === session?.session_key ? 'active' : ''}`} onClick={() => setKey(s.session_key)}>
                <Flag country={ISO3[s.country_code] ?? s.country_code.slice(0, 2)} size={13} />
                {s.location}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        {races.loading && <div className="section"><div className="card empty">Loading the race list from OpenF1…</div></div>}
        {races.error && <div className="section"><div className="card empty">{races.error}</div></div>}
        {!races.loading && !races.error && !session && <div className="section"><div className="card empty">No completed races found for {year}.</div></div>}
        {session && <ReplayView key={session.session_key} session={session} />}
      </div>
      <p className="note">
        Positions, timing, tyres and messages are real data from OpenF1 (openf1.org), an unofficial source; car positions arrive roughly four times a second and are
        smoothed between samples.
      </p>
    </>
  );
}
