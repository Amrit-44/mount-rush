// Procedural low-poly skier with cosmetics and pose animation.
import * as THREE from 'three';
import { DEFAULT_LOOK, itemById } from './data';
import type { CharacterBuild, CharacterVisuals, FaceVariant, HairStyle, Look } from './data';
import { clamp, damp } from './util';

export type PoseMode = 'idle' | 'ski' | 'tuck' | 'air' | 'crash' | 'celebrate' | 'lose';
export interface Pose { mode: PoseMode; lean: number; speed01: number; crashP: number; t: number; squash: number; spin: number; boosted?: boolean; airTime?: number }

const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const cyl = (r0: number, r1: number, h: number, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg);

/** Deterministic RNG so rebuilt hair (messy/curly) looks identical every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared geometries (e.g. one sphere for all curly puffs). Never registered in disposables. */
const sharedGeos = new Map<string, THREE.BufferGeometry>();
function sharedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = sharedGeos.get(key) as T | undefined;
  if (!g) { g = make(); sharedGeos.set(key, g); }
  return g;
}

/**
 * Per-character face textures, lazy + module-level cached by skin/eye/face.
 * Cached textures are NEVER added to `disposables` (never disposed by clear()).
 *
 * UV note: the face plate is a SphereGeometry cap with flipY = false, so the
 * canvas is vertically flipped relative to the sphere: canvas top = chin,
 * canvas bottom = forehead. `fy(f)` maps face-space (0 = forehead, 1 = chin)
 * to canvas y accordingly.
 */
const faceTexCache = new Map<string, THREE.CanvasTexture>();
function faceTexture(skin: number, eyeColor: number, face: FaceVariant): THREE.CanvasTexture {
  const key = `${skin}-${eyeColor}-${face}`;
  const hit = faceTexCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  const skinCss = '#' + new THREE.Color(skin).getHexString();
  const eyeCss = '#' + new THREE.Color(eyeColor).getHexString();
  const dark = '#' + new THREE.Color(skin).multiplyScalar(0.72).getHexString();
  const fy = (f: number) => (1 - f) * 128;
  g.fillStyle = skinCss; g.fillRect(0, 0, 128, 128);
  // cheek shading: soft darker wash toward the sides + jaw
  const shade = g.createRadialGradient(64, 64, 20, 64, 64, 95);
  shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(120,50,20,0.22)');
  g.fillStyle = shade; g.fillRect(0, 0, 128, 128);
  if (face === 'round') { // rounder, rosier cheeks
    g.fillStyle = 'rgba(255,110,110,0.28)';
    g.beginPath(); g.ellipse(34, fy(0.62), 13, 9, 0, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(94, fy(0.62), 13, 9, 0, 0, 6.3); g.fill();
  }
  if (face === 'sharp') { // stronger jaw shading
    g.fillStyle = 'rgba(0,0,0,0.20)';
    g.beginPath(); g.moveTo(28, fy(0.55)); g.lineTo(100, fy(0.55)); g.lineTo(88, fy(1)); g.lineTo(40, fy(1)); g.closePath(); g.fill();
  }
  // brows
  g.fillStyle = '#2a1c12'; g.strokeStyle = '#2a1c12';
  for (const sx of [0, 1]) {
    const x0 = sx ? 76 : 30;
    g.save(); g.translate(x0 + 11, fy(0.2)); g.rotate(sx ? -0.12 : 0.12);
    g.fillRect(-11, -3, 22, 5); g.restore();
  }
  // eyes: white + iris (per-character eye colour) + pupil + glint
  for (const cx of [41, 87]) {
    const narrow = face === 'sharp' ? 0.7 : 1;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(cx, fy(0.35), 11, 7 * narrow, 0, 0, 6.3); g.fill();
    g.fillStyle = eyeCss;
    g.beginPath(); g.arc(cx, fy(0.35), 5, 0, 6.3); g.fill();
    g.fillStyle = '#14100c';
    g.beginPath(); g.arc(cx, fy(0.35), 2.4, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx - 1.6, fy(0.35) - 1.8, 1.4, 0, 6.3); g.fill();
  }
  // nose shading + nostrils (a small modelled cone adds the silhouette)
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(61, fy(0.58), 6, fy(0.42) - fy(0.58));
  g.fillStyle = dark;
  g.beginPath(); g.arc(58, fy(0.6), 2.2, 0, 6.3); g.fill();
  g.beginPath(); g.arc(70, fy(0.6), 2.2, 0, 6.3); g.fill();
  // mouth / lips
  if (face === 'bold') {
    g.fillStyle = '#8a2a30';
    g.beginPath(); g.ellipse(64, fy(0.8), 13, 4.5, 0, 0, 6.3); g.fill();
    g.fillStyle = '#5a1a20'; g.fillRect(53, fy(0.8) - 1, 22, 2);
  } else {
    g.strokeStyle = '#7a3a2a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(52, fy(0.8)); g.quadraticCurveTo(64, fy(0.8) + 5, 76, fy(0.8)); g.stroke();
  }
  if (face === 'freckles') { // deterministic dots across nose + cheeks
    const r = rng(0xf12ec5);
    g.fillStyle = 'rgba(120,60,20,0.55)';
    for (let i = 0; i < 26; i++) {
      const x = 38 + r() * 52, y = fy(0.52) + r() * (fy(0.68) - fy(0.52));
      g.beginPath(); g.arc(x, y, 1.3, 0, 6.3); g.fill();
    }
  }
  if (face === 'stubble') { // jaw stipple shading
    const r = rng(0x57ab1e);
    g.fillStyle = 'rgba(40,25,15,0.4)';
    for (let i = 0; i < 90; i++) {
      const x = 30 + r() * 68, y = fy(0.72) + r() * (fy(0.98) - fy(0.72));
      g.fillRect(x, y, 1.6, 1.6);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  faceTexCache.set(key, t);
  return t;
}

function skiTexture(color: number, kind: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(color);
  g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, 64, 256);
  const lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
  const acc = lum > 0.6 ? '#1a1c24' : '#ffffff';
  g.fillStyle = acc; g.strokeStyle = acc;
  switch (kind) {
    case 'stripes': g.fillRect(18, 0, 8, 256); g.fillRect(38, 0, 8, 256); break;
    case 'checker': for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 16, y * 16, 16, 16); break;
    case 'chevron': g.lineWidth = 8; for (let y = 10; y < 256; y += 36) { g.beginPath(); g.moveTo(8, y + 18); g.lineTo(32, y); g.lineTo(56, y + 18); g.stroke(); } break;
    case 'flame': g.fillStyle = '#ff9a1a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 256 - i * 30); g.lineTo(32, 256 - i * 30 - 70 - (i % 2) * 30); g.lineTo(64, 256 - i * 30); g.fill(); } g.fillStyle = '#ffe14a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10, 256 - i * 40); g.lineTo(32, 256 - i * 40 - 50); g.lineTo(54, 256 - i * 40); g.fill(); } break;
    case 'stars': for (let i = 0; i < 24; i++) { g.beginPath(); g.arc((i * 37) % 64, (i * 53) % 256, 2 + (i % 3), 0, 6.3); g.fill(); } break;
    case 'camo': for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse((i * 41) % 64, (i * 67) % 256, 14, 22, i, 0, 6.3); g.fill(); } break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function jacketTexture(jacket: number, accent: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  const accCss = '#' + new THREE.Color(accent).getHexString();
  g.fillStyle = '#' + new THREE.Color(jacket).getHexString(); g.fillRect(0, 0, 128, 128);
  g.fillStyle = accCss;
  g.fillRect(60, 0, 8, 128); // centre zip
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 128, 16); // shoulder highlight
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 112, 128, 16); // hem shade
  // pocket lines
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(12, 84, 26, 3); g.fillRect(90, 84, 26, 3);
  // seam stitching (dashed side seams)
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(20, 20); g.lineTo(20, 108); g.moveTo(108, 20); g.lineTo(108, 108); g.stroke(); g.setLineDash([]);
  // chest logo block
  g.fillStyle = accCss; g.fillRect(84, 26, 22, 14);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(88, 30, 14, 6);
  // cuff bands
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 100, 128, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class SkierModel {
  root = new THREE.Group();
  private lean = new THREE.Group(); private tumble = new THREE.Group(); private rig = new THREE.Group();
  private hips = new THREE.Group(); private torso = new THREE.Group(); private head = new THREE.Group();
  private legs: { thigh: THREE.Group; knee: THREE.Group; boot: THREE.Mesh }[] = [];
  private arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  private dyn: THREE.Group[] = [];
  private disposables: { dispose(): void }[] = [];
  private capePivot: THREE.Group | null = null; private scarfTail: THREE.Group | null = null; private tailPivot: THREE.Group | null = null;
  private skis: THREE.Group = new THREE.Group();
  private poles: THREE.Group[] = [];
  private look: Look;
  private charBuild: CharacterBuild = { height: 1, bulk: 1 };
  private charV: CharacterVisuals | undefined;
  /** Leg length (0.96 * height); the IK in update() is parameterised on this. */
  private legLen = 0.96;
  private hairRest: THREE.Group | null = null;
  private hairPivots: THREE.Group[] = [];
  // animated state
  private st = { crouch: 0.3, pitch: 0.3, armUp: -0.5, armOut: 0.2, elbow: 1, roll: 0, bob: 0 };
  private tumbleX = 0;

  constructor(look: Look = DEFAULT_LOOK, build: CharacterBuild = { height: 1, bulk: 1 }, char?: CharacterVisuals) {
    this.look = look; this.charBuild = build; this.charV = char;
    this.root.add(this.lean); this.lean.add(this.tumble); this.tumble.position.y = 0.9;
    this.tumble.add(this.rig); this.rig.position.y = -0.9;
    this.build();
  }

  setLook(look: Look, build?: CharacterBuild, char?: CharacterVisuals) {
    this.look = look;
    if (build) this.charBuild = build;
    if (char) this.charV = char;
    this.clear(); this.build();
  }
  private clear() {
    this.rig.clear(); this.skis = new THREE.Group(); this.legs = []; this.arms = []; this.poles = [];
    this.hips = new THREE.Group(); this.torso = new THREE.Group(); this.head = new THREE.Group();
    this.capePivot = this.scarfTail = this.tailPivot = null;
    this.hairRest = null; this.hairPivots = [];
    this.disposables.forEach((d) => d.dispose()); this.disposables = [];
  }
  private mat(c: number) { const m = lam(c); this.disposables.push(m); return m; }
  private geo<T extends THREE.BufferGeometry>(g: T): T { this.disposables.push(g); return g; }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const me = new THREE.Mesh(this.geo(g), m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
  }
  /** Mesh from a module-level shared geometry — the geometry is NOT registered in disposables. */
  private meshShared(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
  }

  private build() {
    const L = this.look;
    const ski = itemById(L.ski)?.d ?? { len: 1.7, w: 0.11 };
    const col = itemById(L.skiColor)?.d.color ?? 0xe83030;
    const design = itemById(L.skiDesign)?.d.kind ?? 'solid';
    // Jacket/pants split (falls back to the legacy outfit item during transition).
    const legacy = itemById((L as unknown as { outfit?: string }).outfit ?? '')?.d;
    const jk = itemById(L.jacket)?.d ?? legacy ?? { jacket: 0x2a62d6, pants: 0x1c2a4a, accent: 0xffffff, style: 'tech' };
    const pt = itemById(L.pants)?.d ?? { color: jk.pants ?? 0x1c2a4a, wide: false };
    const hm = itemById(L.helmet)?.d ?? { color: 0xffffff, style: 'classic' };
    const hw = itemById(L.headwear)?.d ?? { kind: 'none', color: 0xd64a4a };
    const hr = itemById(L.hair)?.d ?? { style: 'fade', color: 0x2a1c12 };
    const gg = itemById(L.goggles)?.d ?? { lens: 0xff9a2a, frame: 0x1a1c24 };
    const gs = itemById(L.glasses)?.d ?? { lens: 0, frame: 0 };
    const fa = itemById(L.faceAcc)?.d ?? { kind: 'none', color: 0x1a1c24 };
    const gl = itemById(L.gloves)?.d ?? { color: 0x1a1c24 };
    const bt = itemById(L.boots)?.d ?? { color: 0x24262e };
    const bk = itemById(L.back)?.d ?? { kind: 'none', color: 0x2f7be8 };
    const sp = itemById(L.special)?.d ?? { kind: 'none', color: 0xff4a3a };
    // Back/special split (falls back to the legacy accessory item during transition).
    const legacyAc = itemById((L as unknown as { accessory?: string }).accessory ?? '')?.d;
    const backD = bk.kind !== 'none' || !legacyAc ? bk : { kind: legacyAc.kind === 'backpack' || legacyAc.kind === 'cape' ? legacyAc.kind : 'none', color: legacyAc.color ?? 0x2f7be8 };
    const spD = sp.kind !== 'none' || !legacyAc ? sp : { kind: legacyAc.kind === 'scarf' || legacyAc.kind === 'antenna' || legacyAc.kind === 'tail' ? legacyAc.kind : 'none', color: legacyAc.color ?? 0xff4a3a };

    const h = this.charBuild.height, bulk = this.charBuild.bulk;
    this.legLen = 0.96 * h;
    const legSeg = 0.48 * h;
    const wide = pt.wide ? 1.15 : 1;

    // Character visuals: defaults when no character is selected.
    const ch = this.charV;
    const skinCol = ch?.skin ?? 0xf0c29a;
    const eyeCol = ch?.eyeColor ?? 0x3a2a1a;
    const faceVar: FaceVariant = ch?.face ?? 'soft';
    const hairCol = ch?.hairColor ?? hr.color ?? 0x2a1c12;

    const jacket = this.mat(jk.jacket), pants = this.mat(pt.color), accent = this.mat(jk.accent);
    const skin = this.mat(skinCol), bootM = this.mat(bt.color), gloveM = this.mat(gl.color);
    const tex = skiTexture(col, design); this.disposables.push(tex);
    const skiTop = new THREE.MeshLambertMaterial({ map: tex }); this.disposables.push(skiTop);
    const skiBase = this.mat(new THREE.Color(col).multiplyScalar(0.75).getHex());
    const poleM = this.mat(0x8a929e);

    // skis
    const len = ski.len, w = ski.w;
    for (const sx of [-0.17, 0.17]) {
      const g = new THREE.Group(); g.position.set(sx, 0.03, -0.12);
      const body = this.mesh(new THREE.BoxGeometry(w, 0.035, len), [skiBase, skiBase, skiTop, skiBase, skiBase, skiBase] as any, g);
      body.castShadow = true;
      const tip = this.mesh(new THREE.BoxGeometry(w, 0.03, 0.3), skiTop, g, 0, 0.05, -len / 2 - 0.1); tip.rotation.x = 0.4;
      this.skis.add(g);
    }
    this.rig.add(this.skis);

    // hips / legs
    this.rig.add(this.hips);
    for (const sx of [-0.17, 0.17]) {
      const thigh = new THREE.Group(); thigh.position.set(sx * 0.75, 0, 0); this.hips.add(thigh);
      this.mesh(cyl(0.085 * wide, 0.07 * wide, legSeg), pants, thigh, 0, -legSeg / 2, 0);
      const knee = new THREE.Group(); knee.position.y = -legSeg; thigh.add(knee);
      this.mesh(cyl(0.07 * wide, 0.06 * wide, legSeg), pants, knee, 0, -legSeg / 2, 0);
      const boot = this.mesh(new THREE.BoxGeometry(0.15, 0.19, 0.38), bootM, knee, 0, -0.53 * h, -0.06);
      boot.scale.x = bulk;
      this.legs.push({ thigh, knee, boot });
    }
    // torso (tapered, textured jacket)
    this.hips.add(this.torso);
    const hipsBox = this.mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), pants, this.hips, 0, 0.04, 0);
    hipsBox.scale.x = bulk;
    const jacketTex = jacketTexture(jk.jacket, jk.accent); this.disposables.push(jacketTex);
    const jacketM = new THREE.MeshLambertMaterial({ map: jacketTex }); this.disposables.push(jacketM);
    const torsoM = this.mesh(cyl(0.21, 0.17, 0.5, 10), jacketM, this.torso, 0, 0.3, 0);
    torsoM.scale.set(bulk, 1, 0.62 * bulk);
    this.mesh(new THREE.BoxGeometry(0.36, 0.08, 0.23), accent, this.torso, 0, 0.12, 0);
    this.mesh(new THREE.BoxGeometry(0.16, 0.34, 0.01), accent, this.torso, 0, 0.35, -0.125);
    // jacket layering by style
    if (jk.style === 'puffer') {
      for (const y of [0.16, 0.3, 0.44]) {
        const ring = this.mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 14), jacket, this.torso, 0, y, 0);
        ring.rotation.x = Math.PI / 2; ring.scale.set(1, 0.62, 1);
      }
    } else if (jk.style === 'hoodie') {
      const hood = this.mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 12), jacket, this.torso, 0, 0.56, 0.05);
      hood.rotation.x = 0.5;
    } else if (jk.style === 'race') {
      const stripeCol = new THREE.Color(jk.accent).multiplyScalar(0.55).getHex();
      this.mesh(new THREE.BoxGeometry(0.07, 0.42, 0.015), this.mat(stripeCol), this.torso, 0, 0.3, -0.132);
    }
    // head
    this.head.position.set(0, 0.7, 0); this.torso.add(this.head);
    this.mesh(new THREE.SphereGeometry(0.15, 12, 10), skin, this.head, 0, 0.05, 0);
    this.mesh(cyl(0.06, 0.07, 0.1), skin, this.torso, 0, 0.58, 0);
    this.buildFace(skin, skinCol, eyeCol, faceVar);
    const helmetStyle = hm.style ?? 'classic';
    if (helmetStyle !== 'none') {
      this.buildHelmet(hm);
    } else {
      // No hard helmet: hair + headwear show.
      this.buildHair(hr.style ?? 'fade', hairCol);
      const hwKind = hw.kind ?? 'none';
      if (hwKind === 'beanie' && this.hairRest) this.hairRest.visible = false; // fringe only under a beanie
      if (hwKind !== 'none') this.buildHeadwear(hwKind, hw.color ?? 0xd64a4a);
    }
    this.buildFacewear(gg, gs);
    this.buildFaceAcc(fa);
    // arms
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.26 * bulk, 0.5, 0); this.torso.add(sh);
      this.mesh(cyl(0.065, 0.055, 0.3), jacket, sh, 0, -0.15, 0);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      this.mesh(cyl(0.055, 0.05, 0.3), jacket, el, 0, -0.15, 0);
      this.mesh(new THREE.SphereGeometry(0.075, 8, 6), gloveM, el, 0, -0.32, 0);
      const pole = new THREE.Group(); pole.position.set(0, -0.32, 0); el.add(pole);
      this.mesh(cyl(0.012, 0.012, 1.25, 5), poleM, pole, 0, -0.5, 0);
      this.mesh(new THREE.TorusGeometry(0.06, 0.01, 4, 8), poleM, pole, 0, -1.05, 0).rotation.x = Math.PI / 2;
      pole.rotation.x = -0.55;
      this.poles.push(pole);
      this.arms.push({ sh, el });
    }
    this.buildAccessory(backD);
    this.buildAccessory(spD);
    this.rig.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** Face: textured spherical-cap plate + modelled nose, ears, brow ridges. */
  private buildFace(skin: THREE.Material, skinCol: number, eyeCol: number, faceVar: FaceVariant) {
    const tex = faceTexture(skinCol, eyeCol, faceVar); // cached texture: NOT added to disposables
    const faceM = new THREE.MeshLambertMaterial({ map: tex }); this.disposables.push(faceM);
    // Cap facing -z (phi 3π/2), forehead θ≈1.05 to chin θ≈2.10.
    this.mesh(new THREE.SphereGeometry(0.152, 14, 8, Math.PI * 1.5 - 0.55, 1.1, 1.05, 1.05), faceM, this.head, 0, 0.05, 0);
    const nose = this.mesh(new THREE.ConeGeometry(0.022, 0.06, 6), skin, this.head, 0, 0.03, -0.155);
    nose.rotation.x = -Math.PI / 2;
    for (const sx of [-1, 1]) this.meshShared(sharedGeo('ear', () => new THREE.SphereGeometry(0.035, 8, 6)), skin, this.head, sx * 0.148, 0.05, 0);
    const browM = this.mat(new THREE.Color(skinCol).multiplyScalar(0.82).getHex());
    for (const sx of [-1, 1]) {
      const b = this.mesh(new THREE.BoxGeometry(0.055, 0.012, 0.02), browM, this.head, sx * 0.05, 0.115, -0.135);
      b.rotation.z = -sx * 0.1;
    }
  }

  /** 8 hair geometry variants. Root lives under the head; `fringe` (front hairline)
   *  + `rest` subgroups so a beanie can show the fringe only. Long/pony/braid tails
   *  hang from flutter pivots animated in update(). */
  private buildHair(style: HairStyle, color: number) {
    const root = new THREE.Group(); this.head.add(root);
    const fringe = new THREE.Group(); const rest = new THREE.Group();
    root.add(fringe); root.add(rest);
    this.hairRest = rest;
    const m = this.mat(color);
    // Front hairline cap, shared by every style.
    const fr = this.mesh(new THREE.SphereGeometry(0.158, 12, 6, Math.PI * 1.5 - 0.8, 1.6, 0.55, 0.75), m, fringe, 0, 0.05, 0);
    fr.scale.set(1, 0.9, 1);
    const puffGeo = sharedGeo('puff', () => new THREE.SphereGeometry(0.05, 8, 6));
    const capGeo = sharedGeo('hairCap', () => new THREE.SphereGeometry(0.162, 12, 8, 0, Math.PI * 2, 0, 1.35));
    switch (style) {
      case 'fade': {
        const cap = this.meshShared(capGeo, m, rest, 0, 0.06, 0); cap.scale.set(1, 0.72, 1); break;
      }
      case 'crop': {
        const bump = sharedGeo('bump', () => new THREE.SphereGeometry(0.07, 8, 6));
        for (const [x, y, z] of [[0, 0.19, -0.02], [-0.07, 0.16, 0.02], [0.07, 0.16, 0.02], [-0.04, 0.15, -0.07], [0.04, 0.15, -0.07]] as const)
          this.meshShared(bump, m, rest, x, y, z);
        break;
      }
      case 'curly': {
        const r = rng(0xc0121);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + r() * 0.5;
          this.meshShared(puffGeo, m, rest, Math.cos(a) * 0.1, 0.16 + r() * 0.05, Math.sin(a) * 0.09 - 0.01);
        }
        break;
      }
      case 'long': {
        const cap = this.meshShared(capGeo, m, rest, 0, 0.06, 0); cap.scale.set(1, 0.72, 1);
        const p = new THREE.Group(); p.position.set(0, 0.18, 0.06); rest.add(p); this.hairPivots.push(p);
        const fall = this.meshShared(sharedGeo('longFall', () => new THREE.SphereGeometry(0.13, 10, 8)), m, p, 0, -0.18, 0.03);
        fall.scale.set(0.9, 1.6, 0.5); break;
      }
      case 'wavy': {
        const ring = sharedGeo('wavyRing', () => new THREE.TorusGeometry(0.15, 0.028, 6, 14));
        [0.12, 0.06, 0.0].forEach((y, i) => {
          const t = this.meshShared(ring, m, rest, 0, y, 0.01);
          t.rotation.x = Math.PI / 2; t.scale.setScalar(1 - i * 0.06);
        });
        break;
      }
      case 'messy': {
        const cone = sharedGeo('messyCone', () => new THREE.ConeGeometry(0.035, 0.09, 5));
        const r = rng(0x9e551);
        for (let i = 0; i < 7; i++) {
          const a = r() * Math.PI * 2, rad = 0.05 + r() * 0.07;
          const spike = this.meshShared(cone, m, rest, Math.cos(a) * rad, 0.18 + r() * 0.04, Math.sin(a) * rad);
          spike.rotation.set((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2);
        }
        break;
      }
      case 'braid': {
        const cap = this.meshShared(capGeo, m, rest, 0, 0.06, 0); cap.scale.set(1, 0.72, 1);
        const p = new THREE.Group(); p.position.set(0, 0.16, 0.08); rest.add(p); this.hairPivots.push(p);
        const link = sharedGeo('braidLink', () => new THREE.TorusGeometry(0.045, 0.02, 6, 10));
        for (let i = 0; i < 5; i++) {
          const t = this.meshShared(link, m, p, 0, -0.05 * i, 0.02 * i);
          t.rotation.x = Math.PI / 2;
        }
        break;
      }
      case 'pony': {
        const cap = this.meshShared(capGeo, m, rest, 0, 0.06, 0); cap.scale.set(1, 0.72, 1);
        const p = new THREE.Group(); p.position.set(0, 0.2, 0.08); rest.add(p); this.hairPivots.push(p);
        const tail = this.mesh(cyl(0.045, 0.03, 0.3, 8), m, p, 0, -0.16, 0.02);
        tail.rotation.x = 0.25; break;
      }
      default: {
        const cap = this.meshShared(capGeo, m, rest, 0, 0.06, 0); cap.scale.set(1, 0.72, 1); break;
      }
    }
  }

  /** Headwear renders ONLY when the helmet style is 'none' (caller enforces). */
  private buildHeadwear(kind: string, color: number) {
    const m = this.mat(color);
    switch (kind) {
      case 'beanie': {
        const dome = this.mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, 1.5), m, this.head, 0, 0.06, 0);
        dome.scale.set(1, 0.85, 1);
        this.mesh(new THREE.SphereGeometry(0.05, 8, 6), this.mat(0xffffff), this.head, 0, 0.24, 0); break;
      }
      case 'cap': {
        this.mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 12), m, this.head, 0, 0.19, 0);
        this.mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), m, this.head, 0, 0.17, -0.2); break;
      }
      case 'bandana': {
        const band = this.mesh(new THREE.TorusGeometry(0.158, 0.032, 6, 14), m, this.head, 0, 0.12, 0);
        band.rotation.x = Math.PI / 2;
        this.mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), m, this.head, 0, 0.12, 0.16); break;
      }
      case 'phones': {
        this.mesh(new THREE.TorusGeometry(0.175, 0.018, 6, 16), m, this.head, 0, 0.06, 0);
        for (const sx of [-1, 1]) {
          const cup = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), m, this.head, sx * 0.17, 0.05, 0);
          cup.rotation.z = Math.PI / 2;
        }
        break;
      }
    }
  }

  /** Goggles render first; glasses only when goggles are 'gg_none' (mutually exclusive).
   *  'gg_none' renders no frame/lens/strap at all. */
  private buildFacewear(gg: any, gs: any) {
    if (this.look.goggles !== 'gg_none') {
      const lens = this.mat(gg.lens); (lens as THREE.MeshLambertMaterial).emissive = new THREE.Color(gg.lens).multiplyScalar(0.25);
      const frame = this.mat(gg.frame);
      this.mesh(new THREE.BoxGeometry(0.3, 0.1, 0.07), frame, this.head, 0, 0.07, -0.145);
      this.mesh(new THREE.BoxGeometry(0.28, 0.09, 0.08), lens, this.head, 0, 0.07, -0.15);
      this.mesh(new THREE.TorusGeometry(0.163, 0.018, 5, 14), frame, this.head, 0, 0.075, 0).rotation.x = Math.PI / 2;
      return;
    }
    if (this.look.glasses !== 'gs_none') {
      const lens = this.mat(gs.lens); (lens as THREE.MeshLambertMaterial).emissive = new THREE.Color(gs.lens).multiplyScalar(0.2);
      const frame = this.mat(gs.frame);
      for (const sx of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.075, 0.06, 0.015), lens, this.head, sx * 0.055, 0.07, -0.155);
      this.mesh(new THREE.BoxGeometry(0.03, 0.012, 0.015), frame, this.head, 0, 0.075, -0.155);
    }
  }

  /** Face accessories sit below the goggle line and never cover the eyes. */
  private buildFaceAcc(fa: any) {
    const kind = fa.kind ?? 'none';
    if (kind === 'mask') {
      this.mesh(new THREE.BoxGeometry(0.22, 0.09, 0.06), this.mat(fa.color ?? 0x1a1c24), this.head, 0, -0.03, -0.125);
    } else if (kind === 'warmer') {
      const ring = this.mesh(new THREE.TorusGeometry(0.115, 0.04, 6, 12), this.mat(fa.color ?? 0x2f7be8), this.torso, 0, 0.58, 0);
      ring.rotation.x = Math.PI / 2;
    } else if (kind === 'paint') {
      for (const sx of [-1, 1]) {
        const s = this.mesh(new THREE.BoxGeometry(0.014, 0.07, 0.008), this.mat(fa.color ?? 0xd62a2a), this.head, sx * 0.055, 0.0, -0.148);
        s.rotation.z = -sx * 0.45;
      }
    }
  }

  private buildHelmet(hm: any) {
    const hmM = new THREE.MeshStandardMaterial({ color: hm.color, roughness: 0.35, metalness: 0.05 }); this.disposables.push(hmM);
    const dome = this.mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hmM, this.head, 0, 0.07, 0.0);
    dome.scale.set(1, 1, 1.05);
    this.mesh(new THREE.BoxGeometry(0.3, 0.025, 0.14), hmM, this.head, 0, 0.16, -0.17); // visor peak
    switch (hm.style) {
      case 'racer': this.mesh(new THREE.BoxGeometry(0.06, 0.04, 0.34), this.mat(0xe83030), this.head, 0, 0.245, 0); break;
      case 'fin': { const f = this.mesh(new THREE.ConeGeometry(0.1, 0.3, 4), hmM, this.head, 0, 0.36, 0.06); f.scale.set(0.25, 1, 1.4); f.rotation.x = 0.3; break; }
      case 'ears': for (const sx of [-1, 1]) { const e = this.mesh(new THREE.ConeGeometry(0.07, 0.15, 4), hmM, this.head, sx * 0.1, 0.3, 0); e.rotation.z = -sx * 0.25; this.mesh(new THREE.ConeGeometry(0.04, 0.09, 4), this.mat(0xffc0e0), this.head, sx * 0.1, 0.29, -0.02).rotation.z = -sx * 0.25; } break;
      case 'horns': for (const sx of [-1, 1]) { const h = this.mesh(new THREE.ConeGeometry(0.045, 0.3, 6), this.mat(0xeee6d0), this.head, sx * 0.19, 0.22, 0); h.rotation.z = -sx * 0.9; } break;
      default: for (const sx of [-1, 1]) this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), this.mat(0x30343e), this.head, sx * 0.165, 0.03, 0).rotation.z = Math.PI / 2;
    }
  }

  private buildAccessory(ac: any) {
    switch (ac.kind) {
      case 'scarf': {
        const m = this.mat(ac.color);
        this.mesh(new THREE.TorusGeometry(0.11, 0.045, 6, 12), m, this.torso, 0, 0.58, 0).rotation.x = Math.PI / 2;
        const p = new THREE.Group(); p.position.set(0.06, 0.56, 0.1); this.torso.add(p);
        this.mesh(new THREE.BoxGeometry(0.07, 0.02, 0.5), m, p, 0, 0, 0.25); this.scarfTail = p; break;
      }
      case 'backpack': {
        this.mesh(new THREE.BoxGeometry(0.32, 0.4, 0.16), this.mat(ac.color), this.torso, 0, 0.3, 0.2);
        this.mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), this.mat(0xffffff), this.torso, 0, 0.2, 0.29); break;
      }
      case 'antenna': {
        this.mesh(cyl(0.01, 0.01, 0.3, 4), this.mat(0x30343e), this.head, 0, 0.35, 0);
        this.mesh(new THREE.SphereGeometry(0.04, 8, 6), this.mat(ac.color), this.head, 0, 0.51, 0); break;
      }
      case 'tail': {
        const p = new THREE.Group(); p.position.set(0, 0.0, 0.14); this.hips.add(p);
        const t = this.mesh(new THREE.ConeGeometry(0.09, 0.5, 8), this.mat(ac.color), p, 0, 0.0, 0.22); t.rotation.x = Math.PI / 2 + 0.2;
        this.mesh(new THREE.SphereGeometry(0.07, 8, 6), this.mat(0xffffff), p, 0, 0.05, 0.5); this.tailPivot = p; break;
      }
      case 'cape': {
        const p = new THREE.Group(); p.position.set(0, 0.52, 0.13); this.torso.add(p);
        const m = new THREE.MeshLambertMaterial({ color: ac.color, side: THREE.DoubleSide }); this.disposables.push(m);
        this.mesh(new THREE.PlaneGeometry(0.42, 0.85), m, p, 0, -0.4, 0);
        this.capePivot = p; break;
      }
    }
  }

  /** Update pose each frame. */
  update(p: Pose, dt: number) {
    const s = this.st, sp = p.speed01;
    let crouch = 0.3, pitch = 0.3, armUp = -0.5, armOut = 0.2, elbow = 1.0, roll = 0;
    const wob = Math.sin(p.t * 9) * 0.03;
    switch (p.mode) {
      case 'idle': crouch = 0.14 + Math.sin(p.t * 1.6) * 0.02; pitch = 0.12; armUp = -0.25; armOut = 0.28; elbow = 0.6; break;
      case 'ski': crouch = 0.34 + 0.22 * sp + p.squash * 0.35 + wob; pitch = 0.3 + 0.4 * sp; armUp = -0.55 - 0.3 * sp; armOut = 0.28; elbow = 1.0 + 0.4 * sp; roll = p.lean; break;
      case 'tuck': crouch = 0.92 + p.squash * 0.1; pitch = 1.05; armUp = 0.65; armOut = 0.12; elbow = 1.7; roll = p.lean * 0.8; break;
      case 'air': { const takeoff = p.airTime !== undefined ? Math.max(0, 1 - p.airTime / 0.15) : 0; crouch = (p.boosted ? 0.95 : 0.88) - takeoff * 0.3; pitch = 0.38; armUp = -0.35; armOut = (p.boosted ? 1.35 : 1.15) + Math.sin(p.t * 12) * 0.06; elbow = p.boosted ? 0.15 : 0.3; roll = p.lean * 0.5; break; }
      case 'crash': crouch = 0.6 + Math.sin(p.t * 17) * 0.3; pitch = 0.6; armUp = Math.sin(p.t * 15) * 1.4; armOut = 1.0 + Math.sin(p.t * 19) * 0.5; elbow = 0.8 + Math.sin(p.t * 13) * 0.5; break;
      case 'celebrate': crouch = 0.22 + Math.abs(Math.sin(p.t * 6)) * 0.12; pitch = 0.0; armUp = -2.9; armOut = 0.45 + Math.sin(p.t * 8) * 0.15; elbow = 0.25; break;
      case 'lose': crouch = 0.5; pitch = 0.6; armUp = 0.2; armOut = 0.1; elbow = 0.5; break;
    }
    const k = p.mode === 'crash' ? 18 : 12;
    s.crouch = damp(s.crouch, crouch, k, dt); s.pitch = damp(s.pitch, pitch, k, dt);
    s.armUp = damp(s.armUp, armUp, k, dt); s.armOut = damp(s.armOut, armOut, k, dt);
    s.elbow = damp(s.elbow, elbow, k, dt); s.roll = damp(s.roll, roll, 10, dt);

    // legs: symmetric 2-bone with vertical reach H (leg length parameterised by build height)
    const H = this.legLen - s.crouch * 0.34, a = Math.acos(clamp(H / this.legLen, -1, 1));
    this.hips.position.y = 0.2 + H;
    for (const l of this.legs) { l.thigh.rotation.x = a; l.knee.rotation.x = -2 * a; l.boot.rotation.x = a; }
    this.torso.rotation.x = -s.pitch;
    this.head.rotation.x = s.pitch * 0.75 - 0.15;
    // idle head-look (extra to the pitch line above)
    if (p.mode === 'idle') this.head.rotation.y = Math.sin(p.t * 0.7) * 0.25;
    else this.head.rotation.y = damp(this.head.rotation.y, 0, 8, dt);
    const sg = [-1, 1];
    this.arms.forEach((ar, i) => {
      ar.sh.rotation.x = s.armUp; ar.sh.rotation.z = sg[i] * s.armOut;
      ar.el.rotation.x = -s.elbow * (p.mode === 'celebrate' ? 0.3 : 0.8);
    });
    const poleBack = p.mode === 'celebrate' ? -0.2 : p.mode === 'tuck' ? -1.0 : -0.7 - 0.2 * sp;
    for (const pl of this.poles) pl.rotation.x = damp(pl.rotation.x, poleBack, 8, dt);

    // whole-body orientation
    this.lean.rotation.z = -s.roll * 0.55;
    this.lean.rotation.y = p.spin;
    if (p.mode === 'crash') this.tumbleX += (10 * (1 - p.crashP * 0.75)) * dt;
    else this.tumbleX = damp(this.tumbleX, Math.round(this.tumbleX / (Math.PI * 2)) * Math.PI * 2, 12, dt);
    this.tumble.rotation.x = -this.tumbleX;
    this.tumble.rotation.z = p.mode === 'crash' ? Math.sin(p.t * 6) * 0.5 * (1 - p.crashP) : 0;
    if (p.mode === 'crash') this.rig.position.y = -0.9 + 0.0;

    const flutter = 0.15 + sp * 0.9;
    if (this.capePivot) this.capePivot.rotation.x = flutter * (0.85 + 0.15 * Math.sin(p.t * 22)) + (p.mode === 'tuck' ? 0.4 : 0);
    if (this.scarfTail) { this.scarfTail.rotation.x = -0.3 + flutter * 0.4 * Math.sin(p.t * 18) * 0.3; this.scarfTail.rotation.y = Math.sin(p.t * 15) * 0.2 * sp; }
    if (this.tailPivot) this.tailPivot.rotation.x = -0.1 + flutter * 0.3 + Math.sin(p.t * 10) * 0.08;
    // hair flutter (long / pony / braid pivots, same spring pattern as cape/scarf)
    for (let i = 0; i < this.hairPivots.length; i++) {
      const pv = this.hairPivots[i];
      pv.rotation.x = flutter * (0.4 + 0.12 * Math.sin(p.t * 16 + i * 1.7)) + (p.mode === 'air' ? 0.35 : 0);
      pv.rotation.z = Math.sin(p.t * 11 + i * 2.1) * 0.06 * (0.3 + sp);
    }
    void this.dyn;
  }

  setVisible(v: boolean) { this.root.visible = v; }
  dispose() { this.clear(); }
}
