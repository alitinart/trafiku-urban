// Builds src/data/network.json from OpenStreetMap route relations.
//
// OSM relations for Prishtina's lines exist but their way members are not
// reliably ordered, so we:
//   1. sample points along each relation's ways (they sit on the right carriageway),
//   2. order them as an open path between the two farthest points,
//   3. route through them with OSRM so the geometry follows real roads,
//   4. snap real OSM bus stops onto that geometry.
//
// Usage: node scripts/build-network.mjs [--refresh]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, 'scripts/cache');
const OUT = path.join(ROOT, 'src/data/network.json');
const UA = 'trafiku-urban-build/1.0';

// mode: pair = two OSM relations (one per direction) · loop = one relation that circles
// back · outback = one relation, the return trip retraces it.
// Colours: one hue family per base number, distinct shade per variant.
const LINES = [
  { id: '1', color: '#E5484D', relations: [10120831, 10120832], termini: ['St. Hekurudhor', 'Royal Mall'] },
  { id: '1A', color: '#A8262D', relations: [10118965, 10118966], termini: ['Stacioni i Autobusëve', 'Aeroporti'] },
  { id: '2', color: '#F2711C', relations: [10121377, 10121378], termini: ['Obiliq', 'Fakulteti Teknik'] },
  { id: '3', color: '#2F6FEB', relations: [11153998, 11153999], termini: ['Rrethi i Matit', 'Bardhosh'] },
  { id: '3A', color: '#5FA8F5', relations: [10166778, 10166779], termini: ['Çeshmja në Mat', 'Kodra e Trimave'] },
  { id: '3B', color: '#1D3F9E', relations: [10187116, 10187117], termini: ['Bërnicë e Ulët', 'Rrethi i Matit'] },
  { id: '3C', color: '#0F9F8F', relations: [11160426, 11160462], termini: ['Sinidoll', 'Bregu i Diellit'] },
  { id: '4', color: '#E8A30C', relations: [10120492, 10120493], termini: ['Parku i Gërmisë', 'Xhamia në Mat'] },
  { id: '6', color: '#2F9E44', relations: [10248144, 10248145], termini: ['Arbëria', 'Lagjja e Spitalit'] },
  { id: '6A', color: '#8CC63F', relations: [10248142, 10248143], termini: ['Tregu i Gjelbër', 'Shkabaj'] },
  { id: '7', color: '#6B3FA0', relations: [10247949, 10247950], termini: ['Kolovica', '7 Marsi'] },
  { id: '7A', color: '#B58BE0', relations: [10247951, 10247952], termini: ['Vreshtat', 'Rrethi i Flamurit'] },
  { id: '7B', color: '#45237A', relations: [19397163], mode: 'outback', termini: ['Zona Industriale', 'Makovc'] },
  { id: '7C', color: '#8E4EC6', relations: [11160278], mode: 'loop', termini: ['Kalabri', 'Qendër'] },
  { id: '8', color: '#C2338C', relations: [10227750, 10227751], termini: ['Arkivi i Kosovës', 'Grashticë'] },
  { id: '10', color: '#7A5230', relations: [10248181], mode: 'outback', termini: ['Hajvali', 'Qendër'] },
  { id: '10C', color: '#A65A2E', relations: [18634744], mode: 'loop', termini: ['Prishtina Mall', 'Qendër'] },
  { id: '15', color: '#0891B2', relations: [11153452, 11153453], termini: ['Keçekollë', 'Xhamia e Llapit'] },
  { id: '19', color: '#4B5768', relations: [18704771], mode: 'outback', termini: ['Rrethi i Flamurit', 'Kishnicë'] },
];

// ---------- geo helpers ----------
const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
function dist(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// local planar projection around Prishtina, metres
const LAT0 = 42.66;
const kx = 111320 * Math.cos(rad(LAT0));
const ky = 110540;
const toXY = (p) => [p[0] * kx, p[1] * ky];

/** project point p onto polyline; returns {d (along), off (perp dist), pt} */
function projectOnLine(line, cum, p) {
  const P = toXY(p);
  let best = { off: Infinity };
  for (let i = 1; i < line.length; i++) {
    const A = toXY(line[i - 1]);
    const B = toXY(line[i]);
    const vx = B[0] - A[0], vy = B[1] - A[1];
    const len2 = vx * vx + vy * vy || 1e-9;
    let t = ((P[0] - A[0]) * vx + (P[1] - A[1]) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const X = A[0] + t * vx, Y = A[1] + t * vy;
    const off = Math.hypot(P[0] - X, P[1] - Y);
    if (off < best.off) {
      best = {
        off,
        d: cum[i - 1] + t * (cum[i] - cum[i - 1]),
        pt: [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])],
      };
    }
  }
  return best;
}
function cumulative(line) {
  const c = [0];
  for (let i = 1; i < line.length; i++) c.push(c[i - 1] + dist(line[i - 1], line[i]));
  return c;
}

// ---------- data fetch ----------
async function overpass(query, file) {
  const f = path.join(CACHE, file);
  if (fs.existsSync(f) && !process.argv.includes('--refresh')) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  const json = await res.json();
  fs.writeFileSync(f, JSON.stringify(json));
  return json;
}

function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

async function osrmRoute(points, key, useBearings = true) {
  const f = path.join(CACHE, `osrm-${key}${useBearings ? '' : '-nb'}.json`);
  if (fs.existsSync(f) && !process.argv.includes('--refresh')) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const coords = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  const radiuses = points.map(() => '45').join(';');
  // bearings make each waypoint snap to the carriageway going our way → no U-turn detours
  const bearings = points
    .map((p, i) => `${i < points.length - 1 ? bearing(p, points[i + 1]) : bearing(points[i - 1], p)},90`)
    .join(';');
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=true` +
    `&radiuses=${radiuses}` +
    (useBearings ? `&bearings=${bearings}` : '');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  await new Promise((r) => setTimeout(r, 1100)); // be polite to the demo server
  if (json.code !== 'Ok') {
    if (useBearings) return osrmRoute(points, key, false);
    throw new Error(`OSRM ${key}: ${json.code} ${json.message}`);
  }
  fs.writeFileSync(f, JSON.stringify(json));
  return json;
}

/** Route through points, pruning waypoints that cause big detours. */
async function routeClean(points, key) {
  let pts = points.slice();
  for (let iter = 0; iter < 25; iter++) {
    const r = await osrmRoute(pts, `${key}-${iter}`);
    const legs = r.routes[0].legs;
    let worst = -1;
    let wr = 0;
    legs.forEach((l, i) => {
      const straight = dist(pts[i], pts[i + 1]);
      const excess = l.distance - straight * 1.4;
      if (excess > 800 && excess > wr) {
        wr = excess;
        worst = i;
      }
    });
    if (worst < 0 || pts.length <= 3) return r;
    const idx = worst + 1 < pts.length - 1 ? worst + 1 : worst;
    if (idx <= 0) return r;
    pts.splice(idx, 1);
  }
  return osrmRoute(pts, `${key}-final`);
}

// ---------- path ordering ----------
function orderOpenPath(pts, start) {
  // nearest-neighbour from start, then 2-opt with fixed first point
  const rest = pts.filter((p) => p !== start);
  const out = [start];
  while (rest.length) {
    const last = out[out.length - 1];
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => {
      const d = dist(last, p);
      if (d < bd) { bd = d; bi = i; }
    });
    out.push(rest.splice(bi, 1)[0]);
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < out.length - 2; i++) {
      for (let k = i + 1; k < out.length - 1; k++) {
        const a = out[i - 1], b = out[i], c = out[k], d = out[k + 1];
        if (dist(a, c) + dist(b, d) < dist(a, b) + dist(c, d) - 1) {
          out.splice(i, k - i + 1, ...out.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return out;
}

function samplePoints(relation, nodes, ways, step) {
  const pts = [];
  for (const m of relation.members) {
    if (m.type !== 'way' || m.role === 'platform') continue;
    const w = ways.get(m.ref);
    if (!w) continue;
    const coords = w.nodes.map((id) => nodes.get(id)).filter(Boolean).map((n) => [n.lon, n.lat]);
    let acc = step; // always take the first vertex of each way
    for (let i = 0; i < coords.length; i++) {
      if (i > 0) acc += dist(coords[i - 1], coords[i]);
      if (acc >= step) { pts.push(coords[i]); acc = 0; }
    }
  }
  // dedupe points closer than step/2
  const out = [];
  for (const p of pts) if (!out.some((q) => dist(p, q) < step / 2)) out.push(p);
  return out;
}

/** Remove "spurs": the path runs out and comes straight back on itself. */
function removeSpurs(line) {
  let changed = true;
  let l = line.slice();
  while (changed) {
    changed = false;
    for (let i = 1; i < l.length - 1; i++) {
      // find j>i where the path returns within 8 m of l[i-1] after a short excursion
      for (let j = i + 1; j < Math.min(l.length, i + 80); j++) {
        if (dist(l[i - 1], l[j]) < 8) {
          let excursion = 0;
          for (let k = i; k <= j; k++) excursion += dist(l[k - 1], l[k]);
          if (excursion < 700 && excursion > 20) {
            l.splice(i, j - i);
            changed = true;
          }
          break;
        }
      }
      if (changed) break;
    }
  }
  // drop consecutive duplicates
  return l.filter((p, i) => i === 0 || dist(p, l[i - 1]) > 0.5);
}

/** Douglas–Peucker in metres; keeps payload small without visible change. */
function simplify(line, tol) {
  const xy = line.map(toXY);
  const keep = new Uint8Array(line.length);
  const mid = line.length >> 1; // closed loops start and end on the same point
  keep[0] = keep[mid] = keep[line.length - 1] = 1;
  const stack = [[0, mid], [mid, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const vx = bx - ax, vy = by - ay, len = Math.hypot(vx, vy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((xy[i][0] - ax) * vy - (xy[i][1] - ay) * vx) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return line.filter((_, i) => keep[i]);
}

// ---------- main ----------
const lineIds = LINES.flatMap((l) => l.relations).join(',');
const osm = await overpass(`[out:json][timeout:120];rel(id:${lineIds});out body;>;out body qt;`, 'osm-routes.json');
const allStops = await overpass(
  '[out:json][timeout:90];node(42.52,20.95,42.78,21.36)["highway"="bus_stop"];out body;',
  'osm-stops.json',
);

const nodes = new Map();
const ways = new Map();
const rels = new Map();
for (const e of osm.elements) {
  if (e.type === 'node') nodes.set(e.id, e);
  if (e.type === 'way') ways.set(e.id, e);
  if (e.type === 'relation') rels.set(e.id, e);
}
const stopNodes = allStops.elements.filter((e) => e.tags?.name);

const stations = new Map(); // osm id -> station
const outLines = [];

for (const L of LINES) {
  const legs = [];
  let prevEnd = null;
  const mode = L.mode ?? 'pair';
  for (const relId of L.relations) {
    const rel = rels.get(relId);
    const pts = samplePoints(rel, nodes, ways, 350);
    let start;
    if (mode === 'loop') {
      // begin at the relation's first stop
      const first = rel.members.find((m) => m.type === 'node' && nodes.get(m.ref));
      const f = first ? [nodes.get(first.ref).lon, nodes.get(first.ref).lat] : pts[0];
      start = pts.reduce((m, p) => (dist(p, f) < dist(m, f) ? p : m));
    } else {
      // the two farthest-apart points are the termini; chain directions end-to-start
      let a = pts[0], b = pts[0], bd = -1;
      for (const p of pts) for (const q of pts) { const d = dist(p, q); if (d > bd) { bd = d; a = p; b = q; } }
      start = prevEnd ? (dist(prevEnd, a) < dist(prevEnd, b) ? a : b) : a;
    }
    const ordered = orderOpenPath(pts, start);
    prevEnd = ordered[ordered.length - 1];
    legs.push({ relId, ordered });
  }
  if (mode === 'outback') legs.push({ relId: `${L.relations[0]}r`, ordered: [...legs[0].ordered].reverse() });

  let full = [];
  for (const { relId, ordered } of legs) {
    // OSRM caps waypoints; chunk with overlap
    const chunk = 60;
    for (let i = 0; i < ordered.length - 1; i += chunk - 1) {
      const part = ordered.slice(i, i + chunk);
      const r = await routeClean(part, `${relId}-${i}`);
      if (process.env.DEBUG) {
        let straight = 0;
        for (let k = 1; k < part.length; k++) straight += dist(part[k - 1], part[k]);
        const legs = r.routes[0].legs.map((l) => Math.round(l.distance)).filter((x) => x > 1500);
        console.log(`  ${relId}[${i}] pts ${part.length} straight ${(straight / 1000).toFixed(1)}km routed ${(r.routes[0].distance / 1000).toFixed(1)}km long legs ${legs.join(',')}`);
      }
      const g = removeSpurs(r.routes[0].geometry.coordinates);
      full.push(...(full.length ? g.slice(1) : g));
    }
  }
  // close the loop back to the start
  {
    const r = await osrmRoute([full[full.length - 1], full[0]], `${L.id}-close`);
    full.push(...r.routes[0].geometry.coordinates.slice(1));
  }
  full = simplify(full.filter((p, i) => i === 0 || dist(p, full[i - 1]) > 0.5), 1.2).map((p) => [+p[0].toFixed(5), +p[1].toFixed(5)]);
  const cum = cumulative(full);
  const length = cum[cum.length - 1];

  // snap stops: OSM stops within 25 m of the path. Prefer the relation's own stops,
  // then any other named stop on the road.
  const relStopIds = new Set(
    L.relations.flatMap((id) => rels.get(id).members.filter((m) => m.type === 'node').map((m) => m.ref)),
  );
  const candidates = stopNodes
    .map((n) => ({ n, own: relStopIds.has(n.id), proj: projectOnLine(full, cum, [n.lon, n.lat]) }))
    .filter((c) => c.proj.off < (c.own ? 30 : 18))
    .sort((x, y) => x.proj.d - y.proj.d);

  const stops = [];
  for (const c of candidates) {
    // keep stops at least 220 m apart along the route
    const prev = stops[stops.length - 1];
    if (prev && c.proj.d - prev.d < 220) {
      if (c.own && !prev.own) stops[stops.length - 1] = { ...c, d: c.proj.d };
      continue;
    }
    stops.push({ ...c, d: c.proj.d });
  }
  for (const s of stops) {
    const id = `s${s.n.id}`;
    if (!stations.has(id)) {
      stations.set(id, {
        id,
        name: s.n.tags.name.replace(/\s+/g, ' ').trim(),
        lon: +s.proj.pt[0].toFixed(6),
        lat: +s.proj.pt[1].toFixed(6),
        lines: [],
      });
    }
    stations.get(id).lines.push(L.id);
  }
  outLines.push({
    id: L.id,
    termini: L.termini,
    loop: mode === 'loop',
    color: L.color,
    length: Math.round(length),
    path: full,
    stops: stops.map((s) => ({ station: `s${s.n.id}`, d: Math.round(s.d) })),
  });
  console.log(`line ${L.id}: ${(length / 1000).toFixed(1)} km, ${full.length} pts, ${stops.length} stops`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({
    source: 'OpenStreetMap contributors (ODbL), routed with OSRM',
    lines: outLines,
    stations: [...stations.values()],
  }),
);
console.log(`stations: ${stations.size} → ${path.relative(ROOT, OUT)}`);
