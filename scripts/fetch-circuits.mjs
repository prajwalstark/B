// Builds src/data/circuits.json from OpenF1 (https://openf1.org):
// the 2026 calendar, sprint weekends, race length, a typical race lap time,
// sector split, and a real circuit outline traced from one clean race lap.
//
//   NODE_USE_ENV_PROXY=1 node scripts/fetch-circuits.mjs
import { writeFileSync } from 'node:fs';

const API = 'https://api.openf1.org/v1';
const YEAR = 2026;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let last = 0;
async function get(path) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = 700 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(API + path);
    if (res.status === 404) return [];
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }
  throw new Error('gave up ' + path);
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const ISO3_TO_2 = {
  AUS: 'AU', CHN: 'CN', JPN: 'JP', BRN: 'BH', KSA: 'SA', SAU: 'SA', USA: 'US', CAN: 'CA', MON: 'MC', MCO: 'MC', ESP: 'ES', AUT: 'AT',
  GBR: 'GB', BEL: 'BE', HUN: 'HU', NED: 'NL', NLD: 'NL', ITA: 'IT', AZE: 'AZ', SGP: 'SG', MEX: 'MX', BRA: 'BR', QAT: 'QA', UAE: 'AE', ARE: 'AE', MAS: 'MY', MYS: 'MY',
};

// Official lap lengths (km). The traced lap cuts corners between samples, so it reads slightly short.
const OFFICIAL_KM = {
  Melbourne: 5.278, Shanghai: 5.451, Suzuka: 5.807, Sakhir: 5.412, Jeddah: 6.174, Miami: 5.412, Montreal: 4.361, 'Monte Carlo': 3.337,
  Catalunya: 4.657, Spielberg: 4.318, Silverstone: 5.891, 'Spa-Francorchamps': 7.004, Hungaroring: 4.381, Zandvoort: 4.259, Monza: 5.793,
  Baku: 6.003, Singapore: 4.94, Austin: 5.513, 'Mexico City': 4.304, Interlagos: 4.309, 'Las Vegas': 6.201, Lusail: 5.419, 'Yas Marina Circuit': 5.281,
};

function checkTrace(xy) {
  if (xy.length < 150) return null;
  const seg = [];
  for (let k = 1; k < xy.length; k++) seg.push(Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]));
  const med = median(seg);
  const max = Math.max(...seg);
  if (max > Math.max(med * 4, 600)) return null; // dropout in the data (decimetres)
  const closing = Math.hypot(xy[0][0] - xy.at(-1)[0], xy[0][1] - xy.at(-1)[1]);
  if (closing > Math.max(med * 4, 600)) return null; // lap did not close
  return seg.reduce((a, b) => a + b, 0);
}

async function traceSession(session) {
  const results = await get(`/session_result?session_key=${session.session_key}`);
  const winner = results.find((r) => r.position === 1);
  if (!winner) return null;
  const laps = (await get(`/laps?session_key=${session.session_key}&driver_number=${winner.driver_number}`)).sort((a, b) => a.lap_number - b.lap_number);
  const timed = laps.filter((l) => l.lap_number > 2 && l.lap_duration && !l.is_pit_out_lap && laps.some((n) => n.lap_number === l.lap_number + 1));
  if (!timed.length) return null;
  const byPace = [...timed].sort((a, b) => a.lap_duration - b.lap_duration);
  const fastest = byPace.slice(0, Math.max(3, Math.floor(byPace.length * 0.4))).map((l) => l.lap_duration);
  for (const lap of byPace.slice(0, 10)) {
    const next = laps.find((l) => l.lap_number === lap.lap_number + 1);
    const pts = await get(
      `/location?session_key=${session.session_key}&driver_number=${winner.driver_number}&date>${encodeURIComponent(lap.date_start)}&date<${encodeURIComponent(next.date_start)}`,
    );
    const xy = pts.filter((p) => p.x || p.y).map((p) => [p.x, p.y]);
    const perimeter = checkTrace(xy);
    if (!perimeter) continue;
    const s1 = lap.duration_sector_1 ?? lap.lap_duration / 3;
    const s2 = lap.duration_sector_2 ?? lap.lap_duration / 3;
    return {
      laps: winner.number_of_laps,
      referenceLap: Math.round(median(fastest) * 1000) / 1000,
      sectorTimes: [s1, s2].map((s) => Math.round((s / lap.lap_duration) * 1000) / 1000),
      xy,
      perimeter,
    };
  }
  return null;
}

const meetings = (await get(`/meetings?year=${YEAR}`)).filter((m) => !/test/i.test(m.meeting_name));
const races = await get(`/sessions?year=${YEAR}&session_name=Race`);
const sprints = await get(`/sessions?year=${YEAR}&session_name=Sprint`);
const prevRaces = await get(`/sessions?year=${YEAR - 1}&session_name=Race`);
const sprintMeetings = new Set(sprints.map((s) => s.meeting_key));

const out = [];
const sorted = races.filter((r) => !r.is_cancelled).sort((a, b) => a.date_start.localeCompare(b.date_start));
for (const [i, race] of sorted.entries()) {
  const meeting = meetings.find((m) => m.meeting_key === race.meeting_key);
  let traced = null;
  if (new Date(race.date_end) < new Date()) traced = await traceSession(race).catch(() => null);
  if (!traced) {
    const prev = prevRaces.find((p) => p.circuit_key === race.circuit_key);
    if (prev) traced = await traceSession(prev).catch(() => null);
  }
  if (!traced) {
    console.warn('skipping', race.circuit_short_name);
    continue;
  }
  const xy = traced.xy;
  const perimeter = traced.perimeter;
  out.push({
    id: race.circuit_short_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    round: i + 1,
    grandPrix: meeting?.meeting_name ?? `${race.country_name} Grand Prix`,
    circuit: race.circuit_short_name,
    location: race.location,
    country: ISO3_TO_2[race.country_code] ?? race.country_code.slice(0, 2),
    countryName: race.country_name,
    raceDate: race.date_start,
    sprint: sprintMeetings.has(race.meeting_key),
    laps: traced.laps,
    referenceLap: traced.referenceLap,
    sectors: [traced.sectorTimes[0], Math.round((traced.sectorTimes[0] + traced.sectorTimes[1]) * 1000) / 1000],
    // OpenF1 coordinates are decimetres
    lengthKm: OFFICIAL_KM[race.circuit_short_name] ?? Math.round((perimeter / 10) * 1.02) / 1000,
    points: xy.map(([x, y]) => [Math.round(x / 10), Math.round(y / 10)]),
  });
  console.log(`R${i + 1} ${race.circuit_short_name}: ${xy.length} pts, ${(perimeter / 10000).toFixed(3)} km, ${traced.laps} laps, ref ${traced.referenceLap}s`);
}

writeFileSync('src/data/circuits.json', JSON.stringify(out));
console.log('wrote', out.length, 'circuits');
