import type { RaceEngine } from '../sim/raceEngine';
import { PauseIcon, PlayIcon, RestartIcon } from './Icons';

const SPEEDS = [1, 4, 16, 60];

export function Controls({ engine }: { engine: RaceEngine }) {
  return (
    <div className="controls">
      <button className="ctrl" onClick={() => engine.togglePause()} aria-label={engine.paused ? 'Play' : 'Pause'}>
        {engine.paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      {SPEEDS.map((s) => (
        <button key={s} className={`ctrl tnum ${engine.speed === s ? 'active' : ''}`} onClick={() => engine.setSpeed(s)}>
          {s}×
        </button>
      ))}
      <span className="grow" />
      <button className="ctrl" onClick={() => engine.reset()} aria-label="Restart race weekend" title="New race (new grid & strategies)">
        <RestartIcon /> New race
      </button>
    </div>
  );
}
