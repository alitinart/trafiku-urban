import raw from './network.json';

export type LngLat = [number, number];

export interface Station {
  id: string;
  name: string;
  lon: number;
  lat: number;
  lines: string[];
}

export interface LineStop {
  station: string;
  d: number; // metres along the loop
}

export interface Line {
  id: string;
  /** base number, used to group variants (3, 3A, 3B, 3C → "3") */
  family: string;
  color: string;
  /** dark text on light line colours, light text otherwise */
  ink: string;
  length: number;
  path: LngLat[];
  cum: Float64Array;
  stops: LineStop[];
  /** metres along the loop where the bus turns around */
  turnD: number;
  termini: [string, string];
  loop: boolean;
}

const R = 6371000;
const rad = (x: number) => (x * Math.PI) / 180;
export function haversine(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Text colour with the higher WCAG contrast on this line colour. */
function badgeInk(hex: string) {
  const L = luminance(hex);
  const onWhite = 1.05 / (L + 0.05);
  const onInk = (L + 0.05) / (luminance('#15171A') + 0.05);
  return onInk > onWhite ? '#15171A' : '#FFFFFF';
}

export const stations: Station[] = raw.stations;
export const stationById = new Map(stations.map((s) => [s.id, s]));

export const lines: Line[] = raw.lines.map((l) => {
  const path = l.path as LngLat[];
  const cum = new Float64Array(path.length);
  for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + haversine(path[i - 1], path[i]);
  // scale stop distances to the client-side length so they line up exactly
  const k = cum[cum.length - 1] / l.length;
  let far = 0;
  let turnD = 0;
  path.forEach((p, i) => {
    const d = haversine(path[0], p);
    if (d > far) {
      far = d;
      turnD = cum[i];
    }
  });
  return {
    id: l.id,
    family: l.id.replace(/[A-Z]+$/, ''),
    color: l.color,
    ink: badgeInk(l.color),
    length: cum[cum.length - 1],
    path,
    cum,
    stops: l.stops.map((s) => ({ station: s.station, d: s.d * k })),
    turnD,
    termini: l.termini as [string, string],
    loop: l.loop,
  };
});
export const lineById = new Map(lines.map((l) => [l.id, l]));

/** Where a bus at distance d is heading. */
export function headsign(line: Line, d: number) {
  if (line.loop) return d < line.turnD ? line.termini[1] : line.termini[0];
  return d < line.turnD ? line.termini[1] : line.termini[0];
}

/** Point + heading (radians, CCW from east) at distance d along the loop. */
export function pointAt(line: Line, d: number): { p: LngLat } {
  const L = line.length;
  d = ((d % L) + L) % L;
  const { cum, path } = line;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1e-9;
  const t = (d - cum[lo]) / seg;
  const a = path[lo];
  const b = path[hi];
  const p: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { p };
}

const KX = Math.cos(rad(42.66));
/** Heading from a short chord around d, smooths over vertex kinks so turns read as arcs. */
export function headingAt(line: Line, d: number, span = 9) {
  const a = pointAt(line, d - span).p;
  const b = pointAt(line, d + span).p;
  return Math.atan2(b[1] - a[1], (b[0] - a[0]) * KX);
}

/** Lines grouped by base number, in natural order. */
export const lineFamilies: Line[][] = Object.values(
  lines.reduce<Record<string, Line[]>>((acc, l) => {
    (acc[l.family] ??= []).push(l);
    return acc;
  }, {}),
).sort((a, b) => Number(a[0].family) - Number(b[0].family));
