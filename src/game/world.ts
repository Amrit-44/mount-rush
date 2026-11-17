// Builds renderable track chunks (terrain, fences, instanced props, signs, ramps...) lazily around the racers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EnvDef } from './data';
import { Coin, DS, SignDef, Track } from './track';
import { clamp, mulberry32, smoothstep } from './util';

export interface Quality {
  shadows: boolean; shadowSize: number; pixelCap: number; viewDist: number; decorMul: number;
  particles: number; antialias: boolean; trails: boolean; snow: number;
}
export const QUALITY: Record<string, Quality> = {
  low: { shadows: false, shadowSize: 512, pixelCap: 1, viewDist: 340, decorMul: 0.5, particles: 0.4, antialias: false, trails: false, snow: 0.4 },
  medium: { shadows: true, shadowSize: 1024, pixelCap: 1.5, viewDist: 500, decorMul: 0.8, particles: 0.75, antialias: true, trails: true, snow: 0.75 },
  high: { shadows: true, shadowSize: 2048, pixelCap: 2, viewDist: 680, decorMul: 1, particles: 1, antialias: true, trails: true, snow: 1 },
};

export const CHUNK = 100;
const OUTER = [0.35, 1.0, 1.8, 2.8, 4, 5.6, 7.6, 10, 13.5, 18, 24, 32, 42];
const NIN = 13;
const NCOL = NIN + OUTER.length * 2;

const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

function colorGeo(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number, i: number) => THREE.Color) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const col = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function signTexture(kind: string, label?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = kind === 'dist' ? 128 : 256;
  const g = c.getContext('2d')!;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (kind === 'dist') {
    g.fillStyle = '#12306b'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116);
    g.fillStyle = '#fff'; g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label ?? '', 128, 68);
    return t;
  }
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(10, 10, 236, 236);
  g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineCap = 'round'; g.lineJoin = 'round';
  switch (kind) {
    case 'curveL': case 'curveR': {
      const dir = kind === 'curveR' ? 1 : -1; g.lineWidth = 30;
      for (const o of [-45, 35]) { g.beginPath(); g.moveTo(128 - dir * 40 + o * dir, 40); g.lineTo(128 + dir * 40 + o * dir, 128); g.lineTo(128 - dir * 40 + o * dir, 216); g.stroke(); }
      break;
    }
    case 'jump': g.beginPath(); g.moveTo(30, 200); g.lineTo(226, 200); g.lineTo(226, 90); g.closePath(); g.fill(); g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.fillText('JUMP', 120, 70); break;
    case 'narrow': g.lineWidth = 24; g.beginPath(); g.moveTo(40, 70); g.lineTo(100, 128); g.lineTo(40, 186); g.moveTo(216, 70); g.lineTo(156, 128); g.lineTo(216, 186); g.stroke(); g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('NARROW', 128, 240); break;
    case 'ice': g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❄', 128, 110); g.font = 'bold 56px Arial'; g.fillText('ICE', 128, 205); break;
    case 'bridge': g.lineWidth = 18; g.beginPath(); g.moveTo(30, 150); g.quadraticCurveTo(128, 60, 226, 150); g.moveTo(30, 175); g.lineTo(226, 175); g.stroke(); g.font = 'bold 46px Arial'; g.textAlign = 'center'; g.fillText('BRIDGE', 128, 225); break;
    case 'deep': g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DEEP', 128, 90); g.fillText('SNOW', 128, 160); break;
    default: g.font = 'bold 56px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label ?? '!', 128, 128);
  }
  return t;
}

function bannerTexture(text: string, finish: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = finish ? '#ffffff' : '#e83030'; g.fillRect(0, 0, 512, 128);
  if (finish) { for (let y = 0; y < 128; y += 16) for (let x = 0; x < 512; x += 16) if (((x + y) / 16) % 2 === 0) { g.fillStyle = '#111'; g.fillRect(x, y, 16, 16); } g.fillStyle = '#12306b'; g.fillRect(0, 32, 512, 64); }
  g.fillStyle = '#fff'; g.font = 'bold 74px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface Chunk { group: THREE.Group; owned: THREE.BufferGeometry[]; coinMesh?: THREE.InstancedMesh; coins: Coin[]; coinY: number[]; coinIdx: Map<Coin, number> }

export class World {
  scene: THREE.Scene; track: Track; env: EnvDef; q: Quality;
  chunks = new Map<number, Chunk>();
  pine!: THREE.BufferGeometry; rock!: THREE.BufferGeometry; bush!: THREE.BufferGeometry; log!: THREE.BufferGeometry;
  coinGeo!: THREE.BufferGeometry; poleGeo!: THREE.BufferGeometry;
  matV: THREE.MeshLambertMaterial; matTerrain: THREE.MeshLambertMaterial; matRock: THREE.MeshLambertMaterial;
  matCoin: THREE.MeshLambertMaterial; matFence: THREE.MeshLambertMaterial; matIce: THREE.MeshPhongMaterial;
  matBoost: THREE.MeshBasicMaterial; matRamp: THREE.MeshLambertMaterial; matWood: THREE.MeshLambertMaterial; matDeep: THREE.MeshLambertMaterial;
  signTex = new Map<string, THREE.CanvasTexture>(); signMats = new Map<string, THREE.MeshBasicMaterial>();
  sharedGeos: THREE.BufferGeometry[] = []; boostTex: THREE.CanvasTexture; bannerTex: THREE.CanvasTexture[] = [];
  dummy = new THREE.Object3D(); buildQueue: number[] = [];
  signPost = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5);
  signPostMat = new THREE.MeshLambertMaterial({ color: 0x4a4f5a });
  planeGeo = new THREE.PlaneGeometry(1, 1);

  constructor(scene: THREE.Scene, track: Track, q: Quality) {
    this.scene = scene; this.track = track; this.env = track.env; this.q = q;
    this.matV = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matTerrain = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matRock = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.matCoin = new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x7a5600 });
    this.matFence = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.matIce = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 140, specular: 0x99ccff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.matRamp = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.matWood = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.matDeep = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 128;
    const g = bc.getContext('2d')!; g.fillStyle = '#16264f'; g.fillRect(0, 0, 64, 128);
    g.strokeStyle = '#ffc21a'; g.lineWidth = 9; g.lineJoin = 'miter';
    for (let y = 8; y < 128; y += 34) { g.beginPath(); g.moveTo(8, y + 22); g.lineTo(32, y); g.lineTo(56, y + 22); g.stroke(); }
    this.boostTex = new THREE.CanvasTexture(bc); this.boostTex.colorSpace = THREE.SRGBColorSpace;
    this.matBoost = new THREE.MeshBasicMaterial({ map: this.boostTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.buildProps();
  }

  private buildProps() {
    const env = this.env;
    const leaf = new THREE.Color(env.leaf), snow = new THREE.Color(0xf3f9ff), bark = new THREE.Color(0x5a3d28);
    // pine
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.28, 0.42, 2.6, 6); trunk.translate(0, 1.3, 0);
    parts.push(colorGeo(trunk, () => bark));
    const cones: [number, number, number][] = [[1.95, 3.4, 2.4], [1.55, 3.0, 4.3], [1.1, 2.6, 6.2], [0.6, 1.8, 7.9]];
    for (const [r, h, y0] of cones) {
      const c = new THREE.ConeGeometry(r, h, 7, 1); c.translate(0, y0 + h / 2, 0);
      parts.push(colorGeo(c, (_x, y) => { const f = (y - y0) / h; const k = smoothstep(0.15, 0.85, f) * 0.85; return leaf.clone().lerp(snow, k); }));
    }
    this.pine = mergeGeometries(parts)!; parts.forEach((p) => p.dispose());
    // rock
    const mkRock = (detail: number) => {
      const ico = new THREE.IcosahedronGeometry(1, detail);
      const p = ico.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 0.78 + hash(Math.round(x * 20), Math.round(y * 20) + Math.round(z * 20)) * 0.4;
        p.setXYZ(i, x * n * 1.1, Math.max(y * n * 0.8, -0.35), z * n);
      }
      const ng = ico.index ? ico.toNonIndexed() : ico; ng.computeVertexNormals();
      const rc = new THREE.Color(env.rock), sn = new THREE.Color(0xf4f9ff);
      const nrm = ng.attributes.normal;
      colorGeo(ng, (_x, _y, _z, i) => rc.clone().lerp(sn, smoothstep(0.35, 0.7, nrm.getY(i)) * 0.9));
      return ng;
    };
    this.rock = mkRock(1);
    // bush
    const b = new THREE.IcosahedronGeometry(1, 1);
    b.scale(1, 0.7, 1); b.translate(0, 0.25, 0);
    const bc = new THREE.Color(0x2c6a45), bs = new THREE.Color(0xeaf4ff);
    this.bush = colorGeo(b.index ? b.toNonIndexed() : b, (x, y) => bc.clone().lerp(bs, smoothstep(0.3, 0.9, y) * 0.8 + hash(x * 9, y * 9) * 0.1));
    // log (axis along x, length 1)
    const lg = new THREE.CylinderGeometry(0.38, 0.38, 1, 8); lg.rotateZ(Math.PI / 2); lg.translate(0, 0.38, 0);
    const wood = new THREE.Color(0x6b4a2e), top = new THREE.Color(0xf3f9ff);
    const lgn = lg.toNonIndexed(); lg.dispose(); lgn.computeVertexNormals();
    this.log = colorGeo(lgn, (_x, y) => (y > 0.55 ? wood.clone().lerp(top, 0.85) : wood));
    // coin
    this.coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 14); this.coinGeo.rotateX(Math.PI / 2);
    // pole with flag
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5); pole.translate(0, 1.3, 0);
    const flag = new THREE.PlaneGeometry(0.9, 0.55); flag.translate(0.45, 2.3, 0);
    const flag2 = flag.clone(); flag2.rotateY(Math.PI);
    this.poleGeo = mergeGeometries([colorGeo(pole, () => new THREE.Color(0xffffff)), colorGeo(flag, () => new THREE.Color(0xffffff)), colorGeo(flag2, () => new THREE.Color(0xffffff))])!;
    this.sharedGeos.push(this.pine, this.rock, this.bush, this.log, this.coinGeo, this.poleGeo);
  }

  private signMat(s: SignDef) {
    const key = s.kind + (s.kind === 'dist' || s.kind === 'steep' ? s.label : '');
    let m = this.signMats.get(key);
    if (!m) {
      const tex = signTexture(s.kind, s.label); this.signTex.set(key, tex);
      m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); this.signMats.set(key, m);
    }
    return m;
  }

  // ---------- chunk building ----------
  private buildChunk(ci: number): Chunk | null {
    const T = this.track, env = this.env;
    const s0 = ci * CHUNK, s1 = s0 + CHUNK;
    T.ensure(s1 + 20);
    if (s0 > T.maxS) return null;
    const group = new THREE.Group(); const owned: THREE.BufferGeometry[] = [];
    const own = <G extends THREE.BufferGeometry>(g: G) => { owned.push(g); return g; };
    const nRows = Math.min(CHUNK / DS, Math.floor((T.maxS - s0) / DS)) + 1;
    const piste = new THREE.Color(env.piste), off = new THREE.Color(env.off), rockC = new THREE.Color(env.rock), edgeBlue = new THREE.Color(0x8ec9ff), bankC = new THREE.Color(0xeef6ff);

    // --- terrain ---
    const nv = nRows * NCOL;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const tmp = new THREE.Color();
    for (let r = 0; r < nRows; r++) {
      const s = s0 + r * DS;
      const q = T.query(s); const hw = q.hw, qx = q.x, qz = q.z, tx = q.tx, tz = q.tz;
      for (let c = 0; c < NCOL; c++) {
        let d: number, isPiste = false, t = 0, o = 0;
        if (c < OUTER.length) { o = OUTER[OUTER.length - 1 - c]; d = -(hw + o); }
        else if (c < OUTER.length + NIN) { t = -1 + ((c - OUTER.length) * 2) / (NIN - 1); d = t * hw; isPiste = true; }
        else { o = OUTER[c - OUTER.length - NIN]; d = hw + o; }
        const y = T.terrainH(s, d);
        const hs = (T.terrainH(s + 1, d) - T.terrainH(s - 1, d)) / 2;
        const hd = (T.terrainH(s, d + 1) - T.terrainH(s, d - 1)) / 2;
        let nx = hd * tz - tx * hs, ny = 1, nz = -(tz * hs + tx * hd);
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const i = r * NCOL + c;
        pos[i * 3] = qx - tz * d; pos[i * 3 + 1] = y; pos[i * 3 + 2] = qz + tx * d;
        nor[i * 3] = nx; nor[i * 3 + 1] = ny; nor[i * 3 + 2] = nz;
        const hn = hash(s * 0.37, d * 0.53);
        if (isPiste) {
          tmp.copy(piste).multiplyScalar(0.97 + hn * 0.05 - Math.abs(t) * 0.03);
          tmp.lerp(edgeBlue, smoothstep(0.65, 1.0, Math.abs(t)) * 0.75);
          // groomed corduroy: alternate 0.5 m bands + two ski-groove lines
          if (Math.floor(Math.abs(d) / 0.5) % 2 === 0) tmp.multiplyScalar(0.96);
          if (Math.abs(Math.abs(t) - 0.15) < 0.04) tmp.multiplyScalar(0.94);
        } else {
          const rockiness = smoothstep(0.6, 0.88, 1 - ny) * (env.rocky + 0.25);
          tmp.copy(off).multiplyScalar(0.82 + hn * 0.16);
          tmp.lerp(edgeBlue, 0.1);
          tmp.lerp(rockC, clamp(rockiness, 0, 1));
          if (o < 3.5) tmp.lerp(bankC, 0.7 * (1 - o / 3.5));
        }
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
    }
    const idx: number[] = [];
    for (let r = 0; r < nRows - 1; r++) for (let c = 0; c < NCOL - 1; c++) {
      const a = r * NCOL + c, b = a + 1, cc = a + NCOL, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    const tg = own(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setIndex(idx);
    tg.computeBoundingSphere();
    const tm = new THREE.Mesh(tg, this.matTerrain); tm.receiveShadow = true; group.add(tm);

    // --- fences ---
    {
      const fp: number[] = [], fc: number[] = [], fi: number[] = [];
      const orange = new THREE.Color(0xff6a1f), white = new THREE.Color(0xdbe9fb), wood = new THREE.Color(0x7a5230), wood2 = new THREE.Color(0x5e3d22);
      const bridged = (s: number) => T.bridges.some((b) => s >= b.s0 - 6 && s <= b.s1 + 6);
      for (const side of [-1, 1]) {
        for (let r = 0; r < nRows - 1; r++) {
          const sa = s0 + r * DS, sb = sa + DS;
          const br = bridged(sa);
          const h = br ? 1.15 : 1.0, e = br ? 0.15 : 0.55;
          const base = fp.length / 3;
          for (const s of [sa, sb]) {
            const hw = T.query(s).hw; const d = side * (hw + e);
            const y = br ? T.baseH(s, side * hw) + 0.05 : T.terrainH(s, d) - 0.05;
            const x = T.wx(s, d), z = T.wz(s, d);
            fp.push(x, y, z, x, y + h, z);
          }
          const cA = br ? (Math.floor(sa / 4) % 2 ? wood : wood2) : (Math.floor(sa / 8) % 2 ? orange : white);
          for (let k = 0; k < 4; k++) fc.push(cA.r * (k % 2 ? 1 : 0.85), cA.g * (k % 2 ? 1 : 0.85), cA.b * (k % 2 ? 1 : 0.85));
          fi.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
      }
      const fg = own(new THREE.BufferGeometry());
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fg.setIndex(fi);
      fg.computeVertexNormals(); fg.computeBoundingSphere();
      const fm = new THREE.Mesh(fg, this.matFence); fm.castShadow = false; group.add(fm);
    }

    // --- instanced props ---
    const mats: Record<string, THREE.Matrix4[]> = { pine: [], rock: [], bush: [], log: [], pole: [] };
    const cols: Record<string, THREE.Color[]> = { pine: [], rock: [], bush: [], log: [], pole: [] };
    const place = (kind: string, x: number, y: number, z: number, rot: number, sx: number, sy: number, sz: number, color: THREE.Color) => {
      const d = this.dummy; d.position.set(x, y, z); d.rotation.set(0, rot, 0); d.scale.set(sx, sy, sz); d.updateMatrix();
      mats[kind].push(d.matrix.clone()); cols[kind].push(color);
    };
    const dmul = this.q.decorMul;
    const i0 = T.obstacles.length ? T.lbObs(s0) : 0;
    for (let i = i0; i < T.obstacles.length; i++) {
      const o = T.obstacles[i];
      if (o.s >= s1) break;
      const y = T.baseH(o.s, o.d), x = T.wx(o.s, o.d), z = T.wz(o.s, o.d);
      const v = 0.85 + hash(o.s, o.d) * 0.3;
      switch (o.kind) {
        case 'pine': place('pine', x, y - 0.1, z, o.rot, o.sc, o.sc, o.sc, new THREE.Color(v, v, v)); break;
        case 'rock': place('rock', x, y, z, o.rot, o.sc * 1.05, o.sc * 1.2, o.sc * 1.05, new THREE.Color(v, v, v)); break;
        case 'smallRock': place('rock', x, y, z, o.rot, o.sc * 1.1, o.sc * 1.1, o.sc * 1.1, new THREE.Color(v, v, v)); break;
        case 'bush': place('bush', x, y - 0.05, z, o.rot, o.sc, o.sc, o.sc, new THREE.Color(v * 0.9, v, v * 0.9)); break;
        case 'log': { const q = T.query(o.s); place('log', x, y - 0.1, z, -q.th + Math.PI / 2 * 0 + Math.PI, o.w, 1, 1, new THREE.Color(1, 1, 1)); break; }
      }
    }
    const rnd = mulberry32(ci * 7919 + 13);
    for (let i = T.decor.length ? this.lbDecor(s0) : 0; i < T.decor.length; i++) {
      const o = T.decor[i];
      if (o.s >= s1) break;
      if (rnd() > dmul) continue;
      const y = T.terrainH(o.s, o.d), x = T.wx(o.s, o.d), z = T.wz(o.s, o.d);
      const v = 0.8 + o.col * 0.35;
      if (o.kind === 'pine') place('pine', x, y - 0.2, z, o.rot, o.sc, o.sc * (0.9 + o.col * 0.3), o.sc, new THREE.Color(v * 0.95, v, v * 0.95));
      else if (o.kind === 'rock') place('rock', x, y - 0.2 * o.sc, z, o.rot, o.sc * 1.2, o.sc * (0.8 + o.col * 0.8), o.sc, new THREE.Color(v, v, v * 1.02));
      else place('bush', x, y - 0.05, z, o.rot, o.sc, o.sc, o.sc, new THREE.Color(v * 0.9, v, v * 0.9));
    }
    // poles
    {
      let k = 0;
      for (let s = Math.ceil(s0 / 16) * 16; s < s1 && s <= T.maxS; s += 16, k++) {
        const hw = T.query(s).hw;
        for (const side of [-1, 1]) {
          const d = side * (hw + 0.15);
          place('pole', T.wx(s, d), T.terrainH(s, d) - 0.05, T.wz(s, d), -T.query(s).th, 1, 1, 1, new THREE.Color(((Math.floor(s / 16) + (side > 0 ? 1 : 0)) % 2) ? 0xff3b30 : 0x2a7bff));
        }
      }
    }
    const geos: Record<string, THREE.BufferGeometry> = { pine: this.pine, rock: this.rock, bush: this.bush, log: this.log, pole: this.poleGeo };
    for (const k of Object.keys(mats)) {
      const n = mats[k].length; if (!n) continue;
      const im = new THREE.InstancedMesh(geos[k], k === 'rock' ? this.matRock : this.matV, n);
      for (let i = 0; i < n; i++) { im.setMatrixAt(i, mats[k][i]); im.setColorAt(i, cols[k][i]); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = this.q.shadows && k !== 'pole'; im.receiveShadow = k === 'rock' || k === 'log';
      group.add(im);
    }

    // --- ramps ---
    for (const rp of T.ramps) {
      if (rp.s + rp.len * 1.3 < s0 || rp.s >= s1) continue;
      const rows: number[] = [];
      for (let u = 0; u <= 1.25 + 1e-6; u += 0.8 / rp.len) rows.push(rp.s + u * rp.len);
      const cs: number[] = [rp.d0 - 0.2, rp.d0 + 1.0];
      const n = Math.max(1, Math.round((rp.d1 - rp.d0 - 2) / 2));
      for (let i = 1; i <= n; i++) cs.push(rp.d0 + 1.0 + ((rp.d1 - rp.d0 - 2) * i) / n);
      cs.push(rp.d1 + 0.2);
      cs.sort((a, b) => a - b);
      const gg = this.gridGeo(rows, cs, (s, d) => T.rampH(s, d) + T.baseH(s, d) + 0.04, (s, d) => {
        const u = (s - rp.s) / rp.len;
        const edge = Math.abs(d - rp.d0) < 1.3 || Math.abs(d - rp.d1) < 1.3;
        if (u > 0.9 && u <= 1.0) return new THREE.Color(0xff7a1a);
        if (edge) return new THREE.Color(0xff7a1a);
        return (Math.floor(u * rp.len / 1.6) % 2) ? new THREE.Color(0xe3f0ff) : new THREE.Color(0xb8d6f5);
      });
      own(gg); const m = new THREE.Mesh(gg, this.matRamp); m.receiveShadow = true; m.castShadow = true; group.add(m);
    }
    // --- zones ---
    for (const z of T.zones) {
      if (z.s1 < s0 || z.s0 >= s1) continue;
      const rows: number[] = []; const a = Math.max(z.s0, s0 - 0.01), b = Math.min(z.s1, s1);
      const steps = Math.max(2, Math.round((b - a) / 1.5));
      for (let i = 0; i <= steps; i++) rows.push(a + ((b - a) * i) / steps);
      const cs: number[] = []; const nd = Math.max(2, Math.round((z.d1 - z.d0) / 1.6));
      for (let i = 0; i <= nd; i++) cs.push(z.d0 + ((z.d1 - z.d0) * i) / nd);
      let g: THREE.BufferGeometry, mat: THREE.Material;
      if (z.type === 'ice') {
        g = this.gridGeo(rows, cs, (s, d) => T.rampH(s, d) + T.baseH(s, d) + 0.05, (s, d) => new THREE.Color(0x8fd8ff).multiplyScalar(0.92 + hash(s * 0.2, d * 0.2) * 0.14));
        mat = this.matIce;
      } else if (z.type === 'deep') {
        g = this.gridGeo(rows, cs, (s, d) => {
          const f = smoothstep(z.s0, z.s0 + 3, s) * smoothstep(z.s1, z.s1 - 3, s) * smoothstep(z.d0 - 0.01, z.d0 + 1.5, d) * smoothstep(z.d1 + 0.01, z.d1 - 1.5, d);
          return T.rampH(s, d) + T.baseH(s, d) + 0.04 + f * (0.22 + 0.14 * Math.sin(s * 1.3) * Math.cos(d * 1.1));
        }, (s, d) => { const v = 0.93 + 0.07 * Math.sin(s * 1.3) * Math.cos(d * 1.1); return new THREE.Color(v, v, 1); });
        mat = this.matDeep;
      } else {
        g = this.gridGeo(rows, cs, (s, d) => T.rampH(s, d) + T.baseH(s, d) + 0.06, () => new THREE.Color(1, 1, 1), true);
        mat = this.matBoost;
      }
      own(g); const m = new THREE.Mesh(g, mat); group.add(m);
    }
    // --- bridges ---
    for (const br of T.bridges) {
      if (br.s1 < s0 || br.s0 >= s1) continue;
      const a = Math.max(br.s0, s0), b = Math.min(br.s1, s1);
      const bp: number[] = [], bc: number[] = [], bi: number[] = [];
      const pl1 = new THREE.Color(0x8e6238), pl2 = new THREE.Color(0x76502e);
      for (let s = a; s < b - 0.01; s += 1.2) {
        const sb = Math.min(s + 1.2, b);
        const base = bp.length / 3;
        for (const ss of [s, sb]) { const hw = T.query(ss).hw; for (const sd of [-1, 1]) { const d = sd * (hw + 0.1); bp.push(T.wx(ss, d), T.baseH(ss, d) + 0.07, T.wz(ss, d)); } }
        const cc = Math.floor(s / 1.2) % 2 ? pl1 : pl2;
        for (let k = 0; k < 4; k++) bc.push(cc.r, cc.g, cc.b);
        bi.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
      const bg = own(new THREE.BufferGeometry());
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); bg.setIndex(bi); bg.computeVertexNormals();
      group.add(new THREE.Mesh(bg, this.matWood));
    }
    // --- signs ---
    for (const sg of T.signs) {
      if (sg.s < s0 || sg.s >= s1) continue;
      const q = T.query(sg.s);
      const x = T.wx(sg.s, sg.d), z = T.wz(sg.s, sg.d), y = T.terrainH(sg.s, sg.d);
      const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = Math.atan2(-q.tx, -q.tz);
      const post = new THREE.Mesh(this.signPost, this.signPostMat); post.position.y = 1.3; grp.add(post);
      const big = sg.kind === 'curveL' || sg.kind === 'curveR';
      const board = new THREE.Mesh(this.planeGeo, this.signMat(sg));
      const wide = sg.kind === 'dist';
      board.scale.set(wide ? 3.4 : big ? 2.6 : 2.0, wide ? 1.7 : big ? 2.6 : 2.0, 1);
      board.position.set(0, wide ? 3.3 : 2.9 + (big ? 0.3 : 0), 0.05); grp.add(board);
      group.add(grp);
    }
    // --- gates ---
    if (s0 <= 26 && 26 < s1) group.add(this.gate(26, 'START', false));
    if (!T.endless && T.finishS >= s0 && T.finishS < s1) { group.add(this.gate(T.finishS, 'FINISH', true)); group.add(this.crowd(T.finishS)); }

    // --- coins ---
    const coins: Coin[] = [], coinY: number[] = []; const coinIdx = new Map<Coin, number>();
    let coinMesh: THREE.InstancedMesh | undefined;
    for (let i = T.lbCoin(s0); i < T.coins.length; i++) { const c = T.coins[i]; if (c.s >= s1) break; coins.push(c); }
    if (coins.length) {
      coinMesh = new THREE.InstancedMesh(this.coinGeo, this.matCoin, coins.length);
      coins.forEach((c, i) => { coinY.push(T.groundH(c.s, c.d) + c.y); coinIdx.set(c, i); if (c.taken) this.hideCoin(coinMesh!, i); else this.setCoin(coinMesh!, c, coinY[i], 0, i); });
      coinMesh.frustumCulled = false; group.add(coinMesh);
    }
    this.scene.add(group);
    return { group, owned, coinMesh, coins, coinY, coinIdx };
  }

  private lbDecor(s: number) {
    const arr = this.track.decor; let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < s) lo = m + 1; else hi = m; }
    return lo;
  }

  private gridGeo(rows: number[], cs: number[], hf: (s: number, d: number) => number, cf: (s: number, d: number) => THREE.Color, uv = false) {
    const T = this.track; const nr = rows.length, nc = cs.length;
    const p = new Float32Array(nr * nc * 3), c = new Float32Array(nr * nc * 3), u = new Float32Array(nr * nc * 2);
    for (let r = 0; r < nr; r++) for (let k = 0; k < nc; k++) {
      const i = r * nc + k, s = rows[r], d = cs[k];
      p[i * 3] = T.wx(s, d); p[i * 3 + 1] = hf(s, d); p[i * 3 + 2] = T.wz(s, d);
      const col = cf(s, d); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      u[i * 2] = k / (nc - 1); u[i * 2 + 1] = uv ? -(s - rows[0]) / 3.4 : 0;
    }
    const idx: number[] = [];
    for (let r = 0; r < nr - 1; r++) for (let k = 0; k < nc - 1; k++) { const a = r * nc + k, b = a + 1, cc = a + nc, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  private gate(s: number, text: string, finish: boolean) {
    const T = this.track, q = T.query(s), hw = q.hw + 1.2;
    const g = new THREE.Group();
    const y = T.baseH(s, 0);
    g.position.set(q.x, y, q.z); g.rotation.y = Math.atan2(-q.tx, -q.tz);
    const mat = new THREE.MeshLambertMaterial({ color: finish ? 0x1a2a55 : 0xdd2a2a });
    const h = 12;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), mat); p.position.set(sx * hw, h / 2 - 0.3, 0); p.castShadow = true; g.add(p); }
    const tex = bannerTexture(text, finish); this.bannerTex.push(tex);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 2.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    ban.position.set(0, h - 1.2, 0); g.add(ban);
    // ground line
    const lc = document.createElement('canvas'); lc.width = 256; lc.height = 32; const lg = lc.getContext('2d')!;
    for (let x = 0; x < 256; x += 16) for (let yy = 0; yy < 32; yy += 16) { lg.fillStyle = ((x + yy) / 16) % 2 ? '#111' : '#fff'; lg.fillRect(x, yy, 16, 16); }
    const lt = new THREE.CanvasTexture(lc); this.bannerTex.push(lt);
    if (finish) {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(q.hw * 2, 2), new THREE.MeshBasicMaterial({ map: lt, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      ln.rotation.x = -Math.PI / 2; ln.position.y = 0.06; g.add(ln);
    } else {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(q.hw * 2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3030, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      ln.rotation.x = -Math.PI / 2; ln.position.y = 0.06; g.add(ln);
    }
    return g;
  }

  private crowd(s: number) {
    const T = this.track; const g = new THREE.Group();
    const body = new THREE.BoxGeometry(0.55, 1.1, 0.4), head = new THREE.SphereGeometry(0.22, 6, 5);
    const n = 70; const bm = new THREE.InstancedMesh(body, this.matV, n), hm = new THREE.InstancedMesh(head, this.matV, n);
    const rnd = mulberry32(5), d = this.dummy;
    const palette = [0xff4a3a, 0x2a7bff, 0xffd23d, 0x34c77b, 0xff7ac8, 0xffffff, 0xff9a2a];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, ss = s - 50 + rnd() * 90;
      const dd = side * (T.query(ss).hw + 3 + rnd() * 6);
      const x = T.wx(ss, dd), z = T.wz(ss, dd), y = T.terrainH(ss, dd);
      d.position.set(x, y + 0.55, z); d.rotation.set(0, rnd() * 6, 0); d.scale.set(1, 1, 1); d.updateMatrix(); bm.setMatrixAt(i, d.matrix);
      d.position.set(x, y + 1.35, z); d.updateMatrix(); hm.setMatrixAt(i, d.matrix);
      bm.setColorAt(i, new THREE.Color(palette[Math.floor(rnd() * palette.length)])); hm.setColorAt(i, new THREE.Color(0xf0c29a));
    }
    bm.frustumCulled = false; hm.frustumCulled = false; g.add(bm, hm);
    return g;
  }

  private setCoin(m: THREE.InstancedMesh, c: Coin, y: number, t: number, i: number) {
    const T = this.track, d = this.dummy;
    const q = T.query(c.s);
    d.position.set(T.wx(c.s, c.d), y, T.wz(c.s, c.d));
    d.rotation.set(0, -q.th + t * 3 + c.s, 0); d.scale.set(1, 1, 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
  }
  private hideCoin(m: THREE.InstancedMesh, i: number) {
    const d = this.dummy; d.position.set(0, -9999, 0); d.scale.set(0, 0, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.instanceMatrix.needsUpdate = true;
  }
  takeCoin(c: Coin) {
    for (const ch of this.chunks.values()) {
      const i = ch.coinIdx.get(c);
      if (i !== undefined && ch.coinMesh) { this.hideCoin(ch.coinMesh, i); return; }
    }
  }
  animateCoins(time: number, sNear: number) {
    const ci = Math.floor(sNear / CHUNK);
    for (let k = ci; k <= ci + 1; k++) {
      const ch = this.chunks.get(k); if (!ch || !ch.coinMesh) continue;
      for (let i = 0; i < ch.coins.length; i++) {
        const c = ch.coins[i];
        if (c.taken || c.s < sNear - 10 || c.s > sNear + 160) continue;
        this.setCoin(ch.coinMesh, c, ch.coinY[i] + Math.sin(time * 3 + c.s) * 0.1, time, i);
      }
      ch.coinMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Keep chunks in [sMin - behind, sMax + viewDist] alive. Returns true if the chunk set is complete. */
  update(sMin: number, sMax: number, maxBuilds = 1): boolean {
    const behind = 120, ahead = this.q.viewDist;
    const c0 = Math.max(0, Math.floor((sMin - behind) / CHUNK)), c1 = Math.floor((sMax + ahead) / CHUNK);
    for (const [k, ch] of this.chunks) {
      if (k < c0 - 1 || k > c1 + 1) { this.disposeChunk(ch); this.chunks.delete(k); }
    }
    let built = 0, missing = false;
    const order: number[] = [];
    for (let k = Math.floor(sMin / CHUNK); k <= c1; k++) order.push(k);
    for (let k = Math.floor(sMin / CHUNK) - 1; k >= c0; k--) order.push(k);
    for (const k of order) {
      if (this.chunks.has(k) || k < 0) continue;
      if (built >= maxBuilds) { missing = true; continue; }
      const ch = this.buildChunk(k); built++;
      if (ch) this.chunks.set(k, ch);
    }
    // visibility toggling beyond view distance
    for (const [k, ch] of this.chunks) ch.group.visible = k >= c0 && k <= c1;
    return !missing;
  }

  private disposeChunk(ch: Chunk) {
    this.scene.remove(ch.group);
    ch.owned.forEach((g) => g.dispose());
    ch.group.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const m = o as THREE.Mesh;
      // Geometries created ad-hoc by gate()/crowd() are not in `owned`; free
      // them here, but never the geometries shared across chunks.
      if (m.isMesh && m.geometry && !this.sharedGeos.includes(m.geometry) && m.geometry !== this.signPost && m.geometry !== this.planeGeo) m.geometry.dispose();
    });
  }

  dispose() {
    for (const ch of this.chunks.values()) this.disposeChunk(ch);
    this.chunks.clear();
    this.sharedGeos.forEach((g) => g.dispose());
    [this.matV, this.matTerrain, this.matRock, this.matCoin, this.matFence, this.matIce, this.matBoost, this.matRamp, this.matWood, this.matDeep, this.signPostMat].forEach((m) => m.dispose());
    this.signMats.forEach((m) => m.dispose()); this.signTex.forEach((t) => t.dispose());
    this.bannerTex.forEach((t) => t.dispose()); this.boostTex.dispose();
    this.signPost.dispose(); this.planeGeo.dispose();
  }
}
