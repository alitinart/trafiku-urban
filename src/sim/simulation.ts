// Deterministic bus simulation.
// Every bus runs a fixed timetable around its line's loop: accelerate, cruise,
// brake into each stop, dwell, repeat. Time comes from the wall clock, so every
// visitor sees the same buses in the same places and nothing is fetched.
import { type Line, lines, headingAt, pointAt, headsign, type LngLat } from '../data/network';

const ACCEL = 1.0; // m/s²
// Frequent core lines run every ~7–10 min; suburban branches less often.
const HEADWAY: Record<string, number> = { '1': 420, '3': 540, '3C': 480, '4': 600, '7C': 450, '1A': 1500, '8': 1200, '10': 1080, '15': 1200, '19': 1200, '2': 900 };

function rng(seed: number) {
  // mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

interface Leg {
  d0: number; // start distance (at stop i)
  s: number; // length to next stop
  v: number; // cruise speed
  tDepart: number; // time leaving stop i (lap-relative)
  tArrive: number; // time arriving at stop i+1
  dwell: number; // dwell at stop i+1
}

export interface Timetable {
  line: Line;
  lap: number;
  legs: Leg[];
  /** lap-relative arrival time at stop index i */
  arrivals: number[];
}

function travelTime(s: number, v: number) {
  const dAcc = (v * v) / ACCEL; // accel + brake distance
  return s >= dAcc ? s / v + v / ACCEL : 2 * Math.sqrt(s / ACCEL);
}
function distanceAfter(t: number, s: number, v: number) {
  const dAcc = (v * v) / ACCEL;
  if (s < dAcc) {
    // triangular profile: slow in, slow out
    const T = 2 * Math.sqrt(s / ACCEL);
    const h = T / 2;
    return t <= h ? 0.5 * ACCEL * t * t : s - 0.5 * ACCEL * (T - t) ** 2;
  }
  const ta = v / ACCEL;
  const T = s / v + ta;
  if (t <= ta) return 0.5 * ACCEL * t * t;
  if (t >= T - ta) return s - 0.5 * ACCEL * (T - t) ** 2;
  return 0.5 * v * ta + v * (t - ta);
}

function buildTimetable(line: Line): Timetable {
  const r = rng(hash(line.id));
  const stops = line.stops;
  const legs: Leg[] = [];
  const arrivals: number[] = [];
  let t = 0; // lap starts the moment a bus leaves stop 0
  for (let i = 0; i < stops.length; i++) {
    const d0 = stops[i].d;
    const d1 = i + 1 < stops.length ? stops[i + 1].d : stops[0].d + line.length;
    const s = Math.max(1, d1 - d0);
    const v = 7.2 + r() * 3.2; // 26–38 km/h, varies with "traffic"
    const tt = travelTime(s, v);
    const dwell = 10 + r() * 16;
    legs.push({ d0, s, v, tDepart: t, tArrive: t + tt, dwell });
    t += tt;
    arrivals[(i + 1) % stops.length] = t;
    t += dwell;
  }
  return { line, lap: t, legs, arrivals };
}

export const timetables = new Map(lines.map((l) => [l.id, buildTimetable(l)]));

export interface BusDef {
  id: string;
  line: string;
  fleet: string;
  offset: number; // seconds into the lap at t = 0
}

export const buses: BusDef[] = lines.flatMap((l) => {
  const tt = timetables.get(l.id)!;
  const n = Math.min(9, Math.max(3, Math.round(tt.lap / (HEADWAY[l.id] ?? 660))));
  const r = rng(hash(l.id + 'fleet'));
  return Array.from({ length: n }, (_, k) => ({
    id: `${l.id}-${k + 1}`,
    line: l.id,
    fleet: String(100 + Math.floor(r() * 800)),
    offset: (k * tt.lap) / n,
  }));
});
export const busById = new Map(buses.map((b) => [b.id, b]));

export interface BusState {
  d: number;
  p: LngLat;
  heading: number;
  speed: number; // m/s
  /** index of stop the bus is at (dwelling) or heading to */
  nextStop: number;
  dwelling: boolean;
  headsign: string;
}

export function phaseOf(bus: BusDef, now: number) {
  const tt = timetables.get(bus.line)!;
  return (((now + bus.offset) % tt.lap) + tt.lap) % tt.lap;
}

export function busState(bus: BusDef, now: number): BusState {
  const tt = timetables.get(bus.line)!;
  const line = tt.line;
  const ph = phaseOf(bus, now);
  const legs = tt.legs;
  const n = legs.length;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].tDepart <= ph) lo = mid;
    else hi = mid - 1;
  }
  const leg = legs[lo];
  const nextStop = (lo + 1) % n;
  let d: number;
  let speed = 0;
  let dwelling = false;
  if (ph < leg.tArrive) {
    const dt = ph - leg.tDepart;
    d = leg.d0 + distanceAfter(dt, leg.s, leg.v);
    const e = 0.05;
    speed = (distanceAfter(dt + e, leg.s, leg.v) - distanceAfter(dt, leg.s, leg.v)) / e;
  } else {
    d = leg.d0 + leg.s;
    dwelling = true;
  }
  d = d % line.length;
  return {
    d,
    p: pointAt(line, d).p,
    heading: headingAt(line, d),
    speed,
    nextStop,
    dwelling,
    headsign: headsign(line, d),
  };
}

/** Seconds until `bus` arrives at stop index `si` (0 while it is standing there). */
export function etaToStop(bus: BusDef, si: number, now: number, state = busState(bus, now)) {
  const tt = timetables.get(bus.line)!;
  if (state.dwelling && state.nextStop === si) return 0;
  const ph = phaseOf(bus, now);
  return (((tt.arrivals[si] - ph) % tt.lap) + tt.lap) % tt.lap;
}

export interface Arrival {
  bus: BusDef;
  line: Line;
  eta: number;
  headsign: string;
}

/** Upcoming arrivals at a station across all lines, soonest first. */
export function arrivalsAt(stationId: string, now: number, limit = 6): Arrival[] {
  const out: Arrival[] = [];
  for (const tt of timetables.values()) {
    tt.line.stops.forEach((s, si) => {
      if (s.station !== stationId) return;
      for (const bus of buses) {
        if (bus.line !== tt.line.id) continue;
        const eta = etaToStop(bus, si, now);
        if (eta > 45 * 60) continue;
        out.push({ bus, line: tt.line, eta, headsign: headsign(tt.line, s.d + 1) });
      }
    });
  }
  return out.sort((a, b) => a.eta - b.eta).slice(0, limit);
}

/** Next k stops for a bus with ETAs. */
export function upcomingStops(bus: BusDef, now: number, k = 6) {
  const tt = timetables.get(bus.line)!;
  const st = busState(bus, now);
  const n = tt.line.stops.length;
  return Array.from({ length: Math.min(k, n) }, (_, j) => {
    const si = (st.nextStop + j) % n;
    return { si, station: tt.line.stops[si].station, eta: etaToStop(bus, si, now, st) };
  });
}

export const nowSeconds = () => Date.now() / 1000;
