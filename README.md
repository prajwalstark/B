# Pitwall — F1 race tracker

A mobile-first Formula 1 race tracker with a live track map, timing tower and a profile page for every driver on the 2026 grid.

## Features

- **Race weekend home** — opens on the real current race weekend from the 2026 calendar, with that circuit's live map,
  max-speed trap, race leader, top-5 tower, fastest lap and race-control feed. Pick any 2026 round to simulate it instead.
- **Live tracker** — every car moving on a circuit map; tap any car (or tower row) to track that driver. Shows the driver's
  current lap time, live delta to their personal best, speed, tyre compound/age, and highlights their current sector.
  Timing tower toggles between interval and gap-to-leader, with pit/DNF/finish badges and positions gained/lost.
  Playback at 1×/4×/16×/60×, pause, and "New race" for a fresh grid and strategies.
- **Drivers** — all 22 drivers with search, team filters, and live or team ordering.
- **Driver pages** — race-weekend points (sprint or qualifying + live race), live telemetry, the real 2026 championship position,
  career stats, profile, biography, season-by-season championship history chart and table, highlights and junior titles.
- **Standings** — the real 2026 drivers' and constructors' championships after the latest race (OpenF1), plus points
  from the simulated race in progress.
- **Race replay (real data)** — pick any completed 2025 or 2026 race and watch it back: real car positions on the
  real circuit, running order, gaps, tyres, pit stops, flags and race-control messages, at 1×/4×/16× with a lap scrubber.

## Where the data comes from

- **Real data — [OpenF1](https://openf1.org)** (free, unofficial): standings and race replays are fetched in the browser
  (`src/data/openf1.ts`, `src/sim/replay.ts`). Requests are throttled to the free tier's limits. While a Formula 1 session
  is live, OpenF1 only serves paid subscribers, so these views show a message until the session ends.
- **Circuits** — `src/data/circuits.json` holds the 2026 calendar and every circuit outline, traced from real car-position
  data for one clean race lap. Regenerate it with `NODE_USE_ENV_PROXY=1 node scripts/fetch-circuits.mjs` (plain
  `node scripts/fetch-circuits.mjs` without a proxy).
- **Simulated live race** — the tracker runs an in-browser model (`src/sim/raceEngine.ts`) on the real layout: a speed
  profile from the circuit's curvature, car/driver pace ordered like the real 2026 table, tyre wear, fuel, traffic,
  overtaking on straights, pit stops and retirements. Gaps and deltas use 200 mini-sectors per lap.
- **Driver careers** — `src/data/drivers.ts`, compiled through the end of the 2025 season; may contain small inaccuracies.

Helmet and car artwork are original illustrations — no team or series logos are used.

## Run it

```bash
npm install
npm run dev
```

Build for production with `npm run build` (outputs to `dist/`). `node scripts/build-artifact.mjs` builds a single
self-contained HTML page (React from cdnjs) in `dist-artifact/`; hosts that block outside requests will show the
simulated views only.
