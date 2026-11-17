// Procedural low-poly skier with cosmetics and pose animation.
import * as THREE from 'three';
import { DEFAULT_LOOK, Look, itemById } from './data';
import { clamp, damp } from './util';

export type PoseMode = 'idle' | 'ski' | 'tuck' | 'air' | 'crash' | 'celebrate' | 'lose';
export interface Pose { mode: PoseMode; lean: number; speed01: number; crashP: number; t: number; squash: number; spin: number }

const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const cyl = (r0: number, r1: number, h: number, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg);

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
  // animated state
  private st = { crouch: 0.3, pitch: 0.3, armUp: -0.5, armOut: 0.2, elbow: 1, roll: 0, bob: 0 };
  private tumbleX = 0;

  constructor(look: Look = DEFAULT_LOOK) {
    this.look = look;
    this.root.add(this.lean); this.lean.add(this.tumble); this.tumble.position.y = 0.9;
    this.tumble.add(this.rig); this.rig.position.y = -0.9;
    this.build();
  }

  setLook(look: Look) {
    this.look = look;
    this.clear(); this.build();
  }
  private clear() {
    this.rig.clear(); this.skis = new THREE.Group(); this.legs = []; this.arms = []; this.poles = [];
    this.hips = new THREE.Group(); this.torso = new THREE.Group(); this.head = new THREE.Group();
    this.capePivot = this.scarfTail = this.tailPivot = null;
    this.disposables.forEach((d) => d.dispose()); this.disposables = [];
  }
  private mat(c: number) { const m = lam(c); this.disposables.push(m); return m; }
  private geo<T extends THREE.BufferGeometry>(g: T): T { this.disposables.push(g); return g; }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const me = new THREE.Mesh(this.geo(g), m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
  }

  private build() {
    const L = this.look;
    const ski = itemById(L.ski)?.d ?? { len: 1.7, w: 0.11 };
    const col = itemById(L.skiColor)?.d.color ?? 0xe83030;
    const design = itemById(L.skiDesign)?.d.kind ?? 'solid';
    const of = itemById(L.outfit)?.d ?? { jacket: 0x2a62d6, pants: 0x1c2a4a, accent: 0xffffff };
    const hm = itemById(L.helmet)?.d ?? { color: 0xffffff, style: 'classic' };
    const gg = itemById(L.goggles)?.d ?? { lens: 0xff9a2a, frame: 0x1a1c24 };
    const gl = itemById(L.gloves)?.d ?? { color: 0x1a1c24 };
    const ac = itemById(L.accessory)?.d ?? { kind: 'none' };

    const jacket = this.mat(of.jacket), pants = this.mat(of.pants), accent = this.mat(of.accent);
    const skin = this.mat(0xf0c29a), bootM = this.mat(0x24262e), gloveM = this.mat(gl.color);
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
      this.mesh(cyl(0.085, 0.07, 0.45), pants, thigh, 0, -0.225, 0);
      const knee = new THREE.Group(); knee.position.y = -0.45; thigh.add(knee);
      this.mesh(cyl(0.07, 0.06, 0.45), pants, knee, 0, -0.225, 0);
      const boot = this.mesh(new THREE.BoxGeometry(0.13, 0.17, 0.34), bootM, knee, 0, -0.5, -0.05);
      this.legs.push({ thigh, knee, boot });
    }
    // torso
    this.hips.add(this.torso);
    this.mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), pants, this.hips, 0, 0.04, 0);
    this.mesh(new THREE.BoxGeometry(0.4, 0.5, 0.24), jacket, this.torso, 0, 0.3, 0);
    this.mesh(new THREE.BoxGeometry(0.41, 0.08, 0.25), accent, this.torso, 0, 0.12, 0);
    this.mesh(new THREE.BoxGeometry(0.16, 0.34, 0.01), accent, this.torso, 0, 0.35, -0.125);
    // head
    this.head.position.set(0, 0.7, 0); this.torso.add(this.head);
    this.mesh(new THREE.SphereGeometry(0.15, 12, 10), skin, this.head, 0, 0.05, 0);
    this.mesh(cyl(0.06, 0.07, 0.1), skin, this.torso, 0, 0.58, 0);
    this.buildHelmet(hm, gg);
    // arms
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.26, 0.5, 0); this.torso.add(sh);
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
    this.buildAccessory(ac);
    this.rig.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  private buildHelmet(hm: any, gg: any) {
    const hmM = this.mat(hm.color);
    const dome = this.mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hmM, this.head, 0, 0.07, 0.0);
    dome.scale.set(1, 1, 1.05);
    const lens = this.mat(gg.lens); (lens as THREE.MeshLambertMaterial).emissive = new THREE.Color(gg.lens).multiplyScalar(0.25);
    const frame = this.mat(gg.frame);
    this.mesh(new THREE.BoxGeometry(0.3, 0.1, 0.07), frame, this.head, 0, 0.07, -0.145);
    this.mesh(new THREE.BoxGeometry(0.25, 0.07, 0.075), lens, this.head, 0, 0.07, -0.15);
    this.mesh(new THREE.TorusGeometry(0.163, 0.018, 5, 14), frame, this.head, 0, 0.075, 0).rotation.x = Math.PI / 2;
    switch (hm.style) {
      case 'racer': this.mesh(new THREE.BoxGeometry(0.06, 0.04, 0.34), this.mat(0xe83030), this.head, 0, 0.245, 0); break;
      case 'fin': { const f = this.mesh(new THREE.ConeGeometry(0.1, 0.3, 4), hmM, this.head, 0, 0.36, 0.06); f.scale.set(0.25, 1, 1.4); f.rotation.x = 0.3; break; }
      case 'ears': for (const sx of [-1, 1]) { const e = this.mesh(new THREE.ConeGeometry(0.07, 0.15, 4), hmM, this.head, sx * 0.1, 0.3, 0); e.rotation.z = -sx * 0.25; this.mesh(new THREE.ConeGeometry(0.04, 0.09, 4), this.mat(0xffc0e0), this.head, sx * 0.1, 0.29, -0.02).rotation.z = -sx * 0.25; } break;
      case 'horns': for (const sx of [-1, 1]) { const h = this.mesh(new THREE.ConeGeometry(0.045, 0.3, 6), this.mat(0xeee6d0), this.head, sx * 0.19, 0.22, 0); h.rotation.z = -sx * 0.9; } break;
      case 'beanie': this.mesh(new THREE.SphereGeometry(0.06, 8, 6), this.mat(0xffffff), this.head, 0, 0.28, 0); break;
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
      case 'tuck': crouch = 0.85 + p.squash * 0.1; pitch = 1.05; armUp = 0.65; armOut = 0.12; elbow = 1.7; roll = p.lean * 0.8; break;
      case 'air': crouch = 0.88; pitch = 0.38; armUp = -0.35; armOut = 1.15 + Math.sin(p.t * 12) * 0.06; elbow = 0.3; roll = p.lean * 0.5; break;
      case 'crash': crouch = 0.6 + Math.sin(p.t * 17) * 0.3; pitch = 0.6; armUp = Math.sin(p.t * 15) * 1.4; armOut = 1.0 + Math.sin(p.t * 19) * 0.5; elbow = 0.8 + Math.sin(p.t * 13) * 0.5; break;
      case 'celebrate': crouch = 0.22 + Math.abs(Math.sin(p.t * 6)) * 0.12; pitch = 0.0; armUp = -2.9; armOut = 0.45 + Math.sin(p.t * 8) * 0.15; elbow = 0.25; break;
      case 'lose': crouch = 0.5; pitch = 0.6; armUp = 0.2; armOut = 0.1; elbow = 0.5; break;
    }
    const k = p.mode === 'crash' ? 18 : 12;
    s.crouch = damp(s.crouch, crouch, k, dt); s.pitch = damp(s.pitch, pitch, k, dt);
    s.armUp = damp(s.armUp, armUp, k, dt); s.armOut = damp(s.armOut, armOut, k, dt);
    s.elbow = damp(s.elbow, elbow, k, dt); s.roll = damp(s.roll, roll, 10, dt);

    // legs: symmetric 2-bone with vertical reach H
    const H = 0.9 - s.crouch * 0.34, a = Math.acos(clamp(H / 0.9, -1, 1));
    this.hips.position.y = 0.2 + H;
    for (const l of this.legs) { l.thigh.rotation.x = a; l.knee.rotation.x = -2 * a; l.boot.rotation.x = a; }
    this.torso.rotation.x = -s.pitch;
    this.head.rotation.x = s.pitch * 0.75 - 0.15;
    const sg = [-1, 1];
    this.arms.forEach((ar, i) => {
      ar.sh.rotation.x = s.armUp; ar.sh.rotation.z = sg[i] * s.armOut;
      ar.el.rotation.x = -s.elbow * (p.mode === 'celebrate' ? 0.3 : 0.8);
    });
    const poleBack = p.mode === 'celebrate' ? -0.2 : p.mode === 'tuck' ? -0.2 : -0.7 - 0.2 * sp;
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
    void this.dyn;
  }

  setVisible(v: boolean) { this.root.visible = v; }
  dispose() { this.clear(); }
}
