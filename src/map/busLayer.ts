// three.js custom layer: low-poly, lit 3D buses rendered inside MapLibre's GL context.
// Loaded lazily after the base map is on screen.
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MLMap } from 'maplibre-gl';
import { lines } from '../data/network';
import { buses, busState, nowSeconds, type BusDef } from '../sim/simulation';

const ORIGIN = MercatorCoordinate.fromLngLat([21.163, 42.66], 0);
const UNIT = ORIGIN.meterInMercatorCoordinateUnits();

function part(geo: BufferGeometry, color: string, x: number, y: number, z: number) {
  geo.translate(x, y, z);
  const c = new Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  geo.deleteAttribute('uv');
  return geo;
}

/** 12 m city bus. x = forward, y = left, z = up. */
function busGeometry(lineColor: string) {
  const wheel = () => {
    const g = new CylinderGeometry(0.52, 0.52, 0.36, 14);
    return g;
  };
  const parts = [
    part(new BoxGeometry(11.7, 2.4, 0.5), '#2A2D31', 0, 0, 0.62), // chassis skirt
    part(new BoxGeometry(12, 2.55, 0.95), '#F3F4F0', 0, 0, 1.3), // lower body
    part(new BoxGeometry(12.04, 2.59, 0.24), lineColor, 0, 0, 1.62), // livery stripe
    part(new BoxGeometry(11.8, 2.5, 1.06), '#1F242B', 0, 0, 2.27), // glass band
    part(new BoxGeometry(0.5, 2.55, 1.06), '#F3F4F0', -2.2, 0, 2.27), // pillar
    part(new BoxGeometry(0.5, 2.55, 1.06), '#F3F4F0', 2.4, 0, 2.27), // pillar
    part(new BoxGeometry(12, 2.55, 0.3), lineColor, 0, 0, 2.94), // roof in line colour
    part(new BoxGeometry(3.4, 1.7, 0.36), '#DADCD6', -2.2, 0, 3.26), // AC unit
    part(new BoxGeometry(1.4, 1.5, 0.2), '#E7E8E4', 3.6, 0, 3.18), // roof hatch
    part(new BoxGeometry(0.08, 1.7, 0.32), '#FFB020', 6.0, 0, 2.62), // LED destination sign
    part(new BoxGeometry(0.1, 0.5, 0.22), '#FFF6D8', 6.01, 0.88, 1.0), // headlights
    part(new BoxGeometry(0.1, 0.5, 0.22), '#FFF6D8', 6.01, -0.88, 1.0),
    part(new BoxGeometry(0.1, 0.42, 0.3), '#E5484D', -6.01, 0.95, 1.1), // tail lights
    part(new BoxGeometry(0.1, 0.42, 0.3), '#E5484D', -6.01, -0.95, 1.1),
    part(wheel(), '#18191B', 3.9, 1.12, 0.52),
    part(wheel(), '#18191B', 3.9, -1.12, 0.52),
    part(wheel(), '#18191B', -3.6, 1.12, 0.52),
    part(wheel(), '#18191B', -3.6, -1.12, 0.52),
  ];
  return mergeGeometries(parts)!;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(21,23,26,0.9)';
  g.beginPath();
  g.roundRect(14, 12, 100, 24, 10);
  g.fill();
  return new CanvasTexture(c);
}

interface BusObj {
  def: BusDef;
  id: string;
  line: string;
  /** index within its line's InstancedMesh */
  slot: number;
  x: number;
  y: number;
  heading: number;
  lngLat: [number, number];
}

export interface BusLayer extends CustomLayerInterface {
  setSelected(id: string | null): void;
  setFocusLine(id: string | null): void;
  pick(x: number, y: number): string | null;
  position(id: string): [number, number] | null;
}

export function createBusLayer(map: MLMap): BusLayer {
  let renderer: WebGLRenderer;
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const world = new Group();
  world.scale.set(1, -1, 1); // local (east, north, up) → mercator (east, south, up)
  scene.add(world);

  const hemi = new HemisphereLight('#ffffff', '#c9cdc6', 2.6);
  hemi.position.set(0, 0, 1);
  scene.add(hemi);
  const sun = new DirectionalLight('#ffffff', 2.0);
  sun.position.set(-0.35, 0.9, 1.6);
  scene.add(sun);

  const shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.32, depthWrite: false, side: DoubleSide });
  const shadowGeo = new PlaneGeometry(14.5, 5.4);
  const ringMat = new MeshBasicMaterial({ color: '#B8F23A', transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  const ringGeo = new RingGeometry(9, 10.6, 56);
  const ringInnerMat = new MeshBasicMaterial({ color: '#B8F23A', transparent: true, opacity: 0.25, depthWrite: false, depthTest: false });
  const ringInnerGeo = new RingGeometry(0, 9, 56);

  // One InstancedMesh per line (one draw call per line) + one for all shadows.
  const mats = new Map<string, MeshStandardMaterial>();
  const meshes = new Map<string, InstancedMesh>();
  const geos = new Map<string, BufferGeometry>();
  for (const l of lines) {
    const count = buses.filter((b) => b.line === l.id).length;
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, transparent: true });
    const geo = busGeometry(l.color);
    geos.set(l.id, geo);
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mats.set(l.id, mat);
    meshes.set(l.id, mesh);
    world.add(mesh);
  }
  const shadows = new InstancedMesh(shadowGeo, shadowMat, buses.length);
  shadows.frustumCulled = false;
  shadows.renderOrder = -1;
  world.add(shadows);

  const slots = new Map<string, number>();
  const objs: BusObj[] = buses.map((b) => {
    const slot = slots.get(b.line) ?? 0;
    slots.set(b.line, slot + 1);
    return { def: b, id: b.id, line: b.line, slot, x: 0, y: 0, heading: 0, lngLat: [0, 0] };
  });
  const dummy = new Object3D();

  // The selected bus is drawn again in a second pass after clearing depth, so it
  // stays visible through underpasses and behind buildings (staging the focus).
  const focusScene = new Scene();
  const focusWorld = new Group();
  focusWorld.scale.set(1, -1, 1);
  focusScene.add(focusWorld, hemi.clone(), sun.clone());
  const focusMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  const focusMesh = new Mesh(geos.get(lines[0].id)!, focusMat);
  focusMesh.frustumCulled = false;
  focusWorld.add(focusMesh);
  const hidden = new Matrix4().makeScale(0, 0, 0);

  const ring = new Group();
  ring.add(new Mesh(ringInnerGeo, ringInnerMat), new Mesh(ringGeo, ringMat));
  ring.traverse((o) => {
    o.frustumCulled = false;
    o.renderOrder = -2;
    if ((o as Mesh).material) ((o as Mesh).material as MeshBasicMaterial).side = DoubleSide;
  });
  ring.visible = false;
  world.add(ring);

  let selected: string | null = null;
  let selectedAt = 0;
  let focusLine: string | null = null;
  let lastT = performance.now();
  let scale = 1;

  const L = new Matrix4().makeTranslation(ORIGIN.x, ORIGIN.y, ORIGIN.z).scale(new Vector3(UNIT, UNIT, UNIT));
  const M = new Matrix4();

  const layer: BusLayer = {
    id: 'buses',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_m, gl) {
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      const tNow = performance.now();
      const dt = Math.min(0.1, (tNow - lastT) / 1000);
      lastT = tNow;
      const now = nowSeconds();
      // Keep buses readable at city zoom (Uber-style): grow as the map zooms out.
      const z = map.getZoom();
      const target = Math.min(13, Math.max(1.6, 2 ** (17.6 - z)));
      scale += (target - scale) * Math.min(1, dt * 10);

      objs.forEach((o, i) => {
        const st = busState(o.def, now);
        o.lngLat = st.p;
        const mc = MercatorCoordinate.fromLngLat(st.p, 0);
        o.x = (mc.x - ORIGIN.x) / UNIT;
        o.y = -(mc.y - ORIGIN.y) / UNIT;
        // ease heading toward target: turns trace arcs instead of snapping
        let dh = st.heading - o.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        o.heading += dh * Math.min(1, dt * 8);

        let sx = scale;
        let sz = scale;
        if (o.id === selected) {
          // squash → stretch → settle (anticipation + follow-through)
          const t = (tNow - selectedAt) / 1000;
          const e = Math.exp(-t * 5.5);
          const wob = 0.28 * e * Math.cos(t * 17);
          const pop = 1.35 - 0.35 * e;
          sx = scale * pop * (1 + wob * 0.45);
          sz = scale * pop * (1 - wob);
          ring.visible = true;
          ring.position.set(o.x, o.y, 0.2);
          const pulse = (tNow / 1000) % 1.6;
          const rs = scale * pop * (0.9 + 0.12 * Math.sin(pulse * Math.PI * 1.25));
          ring.scale.set(rs, rs, 1);
        }
        dummy.position.set(o.x, o.y, 0);
        dummy.rotation.set(0, 0, o.heading);
        dummy.scale.set(sx, sx, sz);
        dummy.updateMatrix();
        if (o.id === selected) {
          focusMesh.geometry = geos.get(o.line)!;
          focusMesh.position.copy(dummy.position);
          focusMesh.rotation.copy(dummy.rotation);
          focusMesh.scale.copy(dummy.scale);
          meshes.get(o.line)!.setMatrixAt(o.slot, hidden);
        } else {
          meshes.get(o.line)!.setMatrixAt(o.slot, dummy.matrix);
        }
        // shadow: offset away from the sun, scaled with the bus
        dummy.position.set(o.x + 0.6 * sx, o.y - 0.5 * sx, 0.12);
        dummy.scale.set(sx, sx, 1);
        dummy.updateMatrix();
        shadows.setMatrixAt(i, dummy.matrix);
      });
      for (const m of meshes.values()) m.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      if (!selected) ring.visible = false;

      for (const [id, m] of mats) {
        const target = focusLine && focusLine !== id ? 0.22 : 1;
        m.opacity += (target - m.opacity) * Math.min(1, dt * 9);
        m.depthWrite = m.opacity > 0.9;
      }

      M.fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(L);
      camera.projectionMatrix.copy(M);
      renderer.resetState();
      renderer.render(scene, camera);
      if (selected) {
        renderer.clearDepth();
        renderer.render(focusScene, camera);
      }
      map.triggerRepaint();
    },
    setSelected(id) {
      if (id !== selected) selectedAt = performance.now();
      selected = id;
      map.triggerRepaint();
    },
    setFocusLine(id) {
      focusLine = id;
    },
    pick(x, y) {
      // generous hit area: at least 30 px, or the bus's on-screen half-length
      const px = map.getZoom();
      const radius = Math.max(30, (12 * scale) / (156543 * Math.cos((42.66 * Math.PI) / 180) / 2 ** px) / 2);
      let best: string | null = null;
      let bd = radius;
      for (const o of objs) {
        if (focusLine && o.line !== focusLine) continue;
        const p = map.project(o.lngLat);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
          bd = d;
          best = o.id;
        }
      }
      return best;
    },
    position(id) {
      return objs.find((o) => o.id === id)?.lngLat ?? null;
    },
  };
  return layer;
}
