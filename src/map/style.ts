// Custom MapLibre style over OpenFreeMap's OpenMapTiles vector tiles.
// Muted, near-monochrome base so buses and line colours carry the colour.
// No sprite sheet (no POI icons) and two font stacks → fewer requests.
import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';

const C = {
  bg: '#ECEEEA',
  park: '#DCE7D5',
  wood: '#D3E2CC',
  water: '#C6D7E3',
  road: '#FFFFFF',
  roadCase: '#DCDFD9',
  major: '#FFFFFF',
  majorCase: '#D2D5CE',
  motorway: '#F5EED8',
  motorwayCase: '#E0D6B8',
  path: '#D4D7D0',
  rail: '#CDD0C9',
  building: '#E4E6E1',
  buildingTop: '#EDEFEA',
  label: '#7A8089',
  labelStrong: '#4E545C',
  halo: '#F5F6F3',
};

const zw = (pairs: [number, number][]): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  ...pairs.flat(),
];

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

const roadFilter = (classes: string[]): ExpressionSpecification => [
  'all',
  ['match', ['get', 'class'], classes, true, false],
  ['!=', ['get', 'brunnel'], 'tunnel'],
];

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap · OpenFreeMap' },
  },
  sky: {
    'sky-color': '#DDE5EA',
    'horizon-color': '#EEF1EE',
    'fog-color': '#ECEEEA',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.85,
  },
  light: { anchor: 'viewport', color: '#FFFFFF', intensity: 0.18, position: [1.4, 200, 35] },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': C.bg } },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': C.park, 'fill-opacity': 0.8 },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'grass'], true, false],
      paint: { 'fill-color': ['match', ['get', 'class'], 'wood', C.wood, C.park], 'fill-opacity': 0.6 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': C.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: { 'line-color': C.water, 'line-width': zw([[12, 0.5], [18, 4]]) },
    },
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 15,
      filter: roadFilter(['path', 'track']),
      paint: { 'line-color': C.path, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(['rail', 'transit']),
      paint: { 'line-color': C.rail, 'line-width': zw([[12, 0.6], [18, 2.5]]), 'line-dasharray': [3, 2] },
    },
    // casings
    {
      id: 'road-minor-case',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 14,
      filter: roadFilter(['minor', 'service']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.roadCase, 'line-width': zw([[14, 2], [18, 15]]) },
    },
    {
      id: 'road-major-case',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(['tertiary', 'secondary', 'primary', 'trunk']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.majorCase, 'line-width': zw([[10, 1.2], [14, 5], [18, 26]]) },
    },
    {
      id: 'road-motorway-case',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(['motorway']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.motorwayCase, 'line-width': zw([[8, 1.5], [14, 7], [18, 30]]) },
    },
    // fills
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12.5,
      filter: roadFilter(['minor', 'service']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.road, 'line-width': zw([[12.5, 0.5], [14, 1.2], [18, 13]]) },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(['tertiary', 'secondary', 'primary', 'trunk']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.major, 'line-width': zw([[10, 0.6], [14, 3.6], [18, 23]]) },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(['motorway']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.motorway, 'line-width': zw([[8, 0.8], [14, 5], [18, 27]]) },
    },
    // routes, stations and buses are inserted here at runtime (before "building")
    {
      id: 'building',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, C.building, 40, C.buildingTop],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, ['get', 'render_height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, ['get', 'render_min_height']],
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14.5,
      filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk', 'minor'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': FONT,
        'text-size': zw([[14.5, 10.5], [18, 13]]),
        'text-max-angle': 30,
        'text-padding': 8,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'water-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': '#6E8799', 'text-halo-color': C.halo, 'text-halo-width': 1 },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter', 'village', 'town'], true, false],
      layout: {
        'text-field': NAME,
        'text-font': FONT_BOLD,
        'text-size': ['match', ['get', 'class'], ['suburb', 'town'], 13, 11.5],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
        'text-padding': 12,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'city-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 13,
      filter: ['==', ['get', 'class'], 'city'],
      layout: { 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': 16 },
      paint: { 'text-color': C.labelStrong, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    },
  ],
};
