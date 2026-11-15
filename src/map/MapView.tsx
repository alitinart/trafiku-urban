import { useEffect, useRef } from 'react';
import type { Map as MLMap, ExpressionSpecification } from 'maplibre-gl';

export type Pad = { top: number; bottom: number; left: number; right: number };
import { lines, lineById, stationById, stations } from '../data/network';
import { busById, busState, nowSeconds } from '../sim/simulation';
import type { BusLayer } from './busLayer';
import type { Selection } from '../state';

export const PRISHTINA: [number, number] = [21.1625, 42.6605];

interface Props {
  selection: Selection;
  follow: boolean;
  padding: Pad;
  onPick(sel: Selection): void;
  onUserPan(): void;
  onReady(): void;
}

const routesGeoJSON = {
  type: 'FeatureCollection' as const,
  features: lines.map((l) => ({
    type: 'Feature' as const,
    properties: { line: l.id, color: l.color },
    geometry: { type: 'LineString' as const, coordinates: l.path },
  })),
};
const stationsGeoJSON = {
  type: 'FeatureCollection' as const,
  features: stations.map((s) => ({
    type: 'Feature' as const,
    properties: { id: s.id, name: s.name },
    geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
  })),
};

export default function MapView({ selection, follow, padding, onPick, onUserPan, onReady }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const busRef = useRef<BusLayer | null>(null);
  const cb = useRef({ onPick, onUserPan, onReady });
  cb.current = { onPick, onUserPan, onReady };
  const padRef = useRef(padding);
  padRef.current = padding;
  const readyRef = useRef(false);

  // ---- create map (maplibre is code-split so the shell paints first) ----
  useEffect(() => {
    let disposed = false;
    (async () => {
      const [maplibre, { mapStyle }] = await Promise.all([import('maplibre-gl'), import('./style')]);
      if (disposed || !el.current) return;
      await ensureWorker(maplibre);
      if (disposed || !el.current) return;
      const map = new maplibre.Map({
        container: el.current,
        style: mapStyle,
        center: PRISHTINA,
        zoom: 12.6,
        pitch: 20,
        bearing: 0,
        minZoom: 11,
        maxZoom: 18.5,
        maxPitch: 70,
        // keep the camera on Prishtina: fewer tiles, less data
        maxBounds: [
          [20.92, 42.5],
          [21.42, 42.8],
        ],
        attributionControl: { compact: true },
        fadeDuration: 180,
        maxTileCacheSize: 400,
        canvasContextAttributes: { antialias: true, powerPreference: 'high-performance' },
      });
      mapRef.current = map;
      map.on('error', (e) => console.warn('[map]', e.error?.message ?? e));
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __map: MLMap }).__map = map;

      map.on('load', async () => {
        map.addSource('routes', { type: 'geojson', data: routesGeoJSON, tolerance: 0.2 });
        map.addSource('stations', { type: 'geojson', data: stationsGeoJSON });
        map.addLayer(
          {
            id: 'route-casing',
            type: 'line',
            source: 'routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 3, 14, 6.5, 18, 15],
              'line-opacity': 0.9,
            },
          },
          'building',
        );
        map.addLayer(
          {
            id: 'route-line',
            type: 'line',
            source: 'routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 1.4, 14, 3.5, 18, 9],
              'line-opacity': 0.85,
              'line-opacity-transition': { duration: 260 },
              'line-width-transition': { duration: 260 },
            },
          },
          'building',
        );
        map.addLayer({
          id: 'station-hit',
          type: 'circle',
          source: 'stations',
          minzoom: 13,
          paint: { 'circle-radius': 18, 'circle-opacity': 0, 'circle-stroke-width': 0 },
        });
        // stops: dots at city zoom, upright pins with a bus glyph up close
        map.addImage('stop', stopIcon('#15171A', '#FFFFFF'), { pixelRatio: 3 });
        map.addImage('stop-selected', stopIcon('#B8F23A', '#15171A'), { pixelRatio: 3 });
        map.addLayer({
          id: 'station',
          type: 'circle',
          source: 'stations',
          minzoom: 12.5,
          maxzoom: 15.2,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 1.8, 15, 4],
            'circle-color': '#FFFFFF',
            'circle-stroke-color': '#15171A',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12.5, 1, 15, 2],
            'circle-pitch-alignment': 'map',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.2, 1, 14.8, 1, 15.2, 0],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.2, 1, 14.8, 1, 15.2, 0],
          },
        });
        map.addLayer({
          id: 'station-icon',
          type: 'symbol',
          source: 'stations',
          minzoom: 14.8,
          layout: {
            'icon-image': 'stop',
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 14.8, 0.6, 17, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-pitch-alignment': 'viewport',
            'icon-rotation-alignment': 'viewport',
          },
          paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.8, 0, 15.2, 1] },
        });
        map.addLayer({
          id: 'station-selected',
          type: 'symbol',
          source: 'stations',
          filter: ['==', ['get', 'id'], ''],
          layout: {
            'icon-image': 'stop-selected',
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 17, 1.25],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-pitch-alignment': 'viewport',
          },
        });
        map.addLayer({
          id: 'station-label',
          type: 'symbol',
          source: 'stations',
          minzoom: 15.6,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 0.4],
            'text-max-width': 9,
            'text-optional': true,
          },
          paint: { 'text-color': '#464B53', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 },
        });

        // staging: a quick dolly-in from flat overview to the tilted 3D city
        map.easeTo({ zoom: 14.2, pitch: 56, bearing: -18, duration: 2200, easing: easeInOut, padding: padRef.current });
        readyRef.current = true;
        cb.current.onReady();

        const { createBusLayer } = await import('./busLayer');
        if (disposed) return;
        const layer = createBusLayer(map);
        map.addLayer(layer, 'road-label');
        busRef.current = layer;
      });

      map.on('click', (e) => {
        const bus = busRef.current?.pick(e.point.x, e.point.y);
        if (bus) return cb.current.onPick({ kind: 'bus', id: bus });
        const { x, y } = e.point;
        // pins stand above their point, so the hit box extends below the tap
        const hit = map.queryRenderedFeatures(
          [
            [x - 8, y - 6],
            [x + 8, y + 26],
          ],
          { layers: ['station-hit'] },
        );
        if (hit.length) return cb.current.onPick({ kind: 'station', id: hit[0].properties.id as string });
        const route = map.queryRenderedFeatures(
          [
            [x - 8, y - 8],
            [x + 8, y + 8],
          ],
          { layers: ['route-line'] },
        );
        if (route.length) return cb.current.onPick({ kind: 'line', id: route[0].properties.line as string });
        cb.current.onPick(null);
      });
      map.on('mousemove', (e) => {
        const hot =
          !!busRef.current?.pick(e.point.x, e.point.y) ||
          map.queryRenderedFeatures(e.point, { layers: ['station-hit', 'route-line'] }).length > 0;
        map.getCanvas().style.cursor = hot ? 'pointer' : '';
      });
      map.on('dragstart', () => cb.current.onUserPan());
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- react to selection: staging + focus ----
  const selKey = selection ? `${selection.kind}:${selection.id}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const bus = busRef.current;
    let focus: string[] | null = null;

    if (selection?.kind === 'station') {
      const s = stationById.get(selection.id)!;
      focus = s.lines;
      map.flyTo({
        center: [s.lon, s.lat],
        zoom: Math.max(map.getZoom(), 16),
        pitch: 55,
        duration: 1100,
        curve: 1.3,
        padding: padRef.current,
        essential: true,
      });
    } else if (selection?.kind === 'bus') {
      const def = busById.get(selection.id)!;
      focus = [def.line];
      const st = busState(def, nowSeconds() + 1.1); // aim where the bus will be when we land
      map.flyTo({
        center: st.p,
        zoom: Math.max(map.getZoom(), 16.2),
        pitch: 60,
        duration: 1100,
        curve: 1.3,
        padding: padRef.current,
        essential: true,
      });
    } else if (selection?.kind === 'line') {
      const l = lineById.get(selection.id)!;
      focus = [l.id];
      let [w, s, e, n] = [180, 90, -180, -90];
      for (const [x, y] of l.path) {
        w = Math.min(w, x);
        e = Math.max(e, x);
        s = Math.min(s, y);
        n = Math.max(n, y);
      }
      const p = padRef.current;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        {
          padding: { top: p.top + 40, bottom: p.bottom + 40, left: p.left + 40, right: p.right + 40 },
          pitch: 40,
          duration: 1100,
          essential: true,
        },
      );
    }

    const opacity: ExpressionSpecification | number = focus
      ? ['match', ['get', 'line'], focus, 0.95, 0.12]
      : 0.85;
    const width: ExpressionSpecification = [
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      11,
      focus ? ['match', ['get', 'line'], focus, 2.6, 1.2] : 1.4,
      14,
      focus ? ['match', ['get', 'line'], focus, 5.5, 2.5] : 3.5,
      18,
      focus ? ['match', ['get', 'line'], focus, 13, 6] : 9,
    ];
    map.setPaintProperty('route-line', 'line-opacity', opacity);
    map.setPaintProperty('route-line', 'line-width', width);
    map.setPaintProperty('route-casing', 'line-opacity', focus ? ['match', ['get', 'line'], focus, 1, 0.25] : 0.9);
    map.setFilter('station-selected', ['==', ['get', 'id'], selection?.kind === 'station' ? selection.id : '']);
    bus?.setSelected(selection?.kind === 'bus' ? selection.id : null);
    bus?.setFocusLine(selection?.kind === 'bus' || selection?.kind === 'line' ? focus![0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  // ---- follow the selected bus like a ride-hailing car ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || selection?.kind !== 'bus') return;
    let raf = 0;
    let started = false;
    const id = selection.id;
    const start = () => {
      started = true;
      const tick = () => {
        const p = busRef.current?.position(id);
        if (p && !map.isZooming() && !map.isRotating()) {
          const c = map.getCenter();
          // critically damped chase so the camera trails slightly (follow-through)
          map.jumpTo({ center: [c.lng + (p[0] - c.lng) * 0.12, c.lat + (p[1] - c.lat) * 0.12] });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const t = window.setTimeout(start, 1150); // after the fly-in lands
    return () => {
      clearTimeout(t);
      if (started) cancelAnimationFrame(raf);
    };
  }, [follow, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keep content clear of the sheet / side panel ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.easeTo({ padding, duration: 320, easing: easeOut });
  }, [padding.top, padding.bottom, padding.left, padding.right]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map" aria-label="Map of Prishtina with live buses" role="application" />;
}

let workerReady: Promise<void> | null = null;
/** MapLibre v6 finds its worker via import.meta.url, which Metro lacks. */
function ensureWorker(maplibre: typeof import('maplibre-gl')) {
  workerReady ??= (async () => {
    if (process.env.EXPO_DOM_HOST_OS) {
      // native WebView: spawn from an embedded copy
      const { default: code } = await import('./workerSource.generated');
      maplibre.setWorkerUrl(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    } else {
      maplibre.setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.href).href);
    }
  })();
  return workerReady;
}

/** Bus-stop pin: rounded square with a bus glyph and a short tail. Drawn at 3×. */
function stopIcon(fill: string, glyph: string) {
  const k = 3;
  const w = 30 * k;
  const h = 36 * k;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.scale(k, k);
  // tail
  g.fillStyle = fill;
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(11, 26);
  g.lineTo(15, 33);
  g.lineTo(19, 26);
  g.closePath();
  g.fill();
  g.stroke();
  // body
  g.beginPath();
  g.roundRect(3, 2, 24, 24, 7);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(11.5, 25);
  g.lineTo(18.5, 25);
  g.lineTo(15, 31);
  g.closePath();
  g.fill();
  // bus glyph
  g.fillStyle = glyph;
  g.beginPath();
  g.roundRect(9, 7, 12, 13, 3);
  g.fill();
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(10.6, 9, 8.8, 4.6, 1.2);
  g.fill();
  g.beginPath();
  g.arc(11.9, 17.2, 1, 0, Math.PI * 2);
  g.arc(18.1, 17.2, 1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = glyph;
  g.fillRect(10, 20, 2.4, 2);
  g.fillRect(17.6, 20, 2.4, 2);
  return g.getImageData(0, 0, w, h);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
