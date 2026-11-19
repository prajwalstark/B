# Pitwall — F1 race tracker

A mobile-first Formula 1 race tracker with a live track map, timing tower and a profile page for every driver on the 2026 grid.

## Features

- **Race weekend home** — Grand Prix hero, live max-speed trap, race leader, top-5 tower, fastest lap and race-control feed.
- **Live tracker** — every car moving on a circuit map; tap any car (or tower row) to track that driver. Shows the driver's
  current lap time, live delta to their personal best, speed, tyre compound/age, and highlights their current sector.
  Timing tower toggles between interval and gap-to-leader, with pit/DNF/finish badges and positions gained/lost.
  Playback at 1×/4×/16×/60×, pause, and "New race" for a fresh grid and strategies.
- **Drivers** — all 22 drivers with search, team filters, and live or team ordering.
- **Driver pages** — race-weekend points (sprint + live race), live telemetry, career stats, profile, biography,
  season-by-season championship history chart and table, highlights and junior titles, plus that driver's race-control messages.

## How the "live" data works

There is no paid live-timing feed, so the race is produced by an in-browser model (`src/sim/raceEngine.ts`):
a speed profile derived from the circuit's curvature, team/driver pace, tyre compounds and degradation, fuel burn,
traffic and overtaking on straights, pit stops, and random retirements. Gaps and deltas are measured from 200 mini-sectors per lap,
just like real timing loops. The engine exposes a simple subscribe API, so it can be swapped for a real feed (e.g. OpenF1) later.

Driver career data in `src/data/drivers.ts` is compiled through the end of the 2025 season and may contain small inaccuracies.
The circuit map is a schematic layout. Helmet and car artwork are original illustrations — no team or series logos are used.

## Run it

```bash
npm install
npm run dev
```

Build for production with `npm run build` (outputs to `dist/`).
