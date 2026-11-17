// Menu background + garage showroom (one persistent WebGL scene).
import * as THREE from 'three';
import { ENVS, Look } from './data';
import { Sky, Snowfall, Sprays } from './scenery';
import { SkierModel } from './skierModel';
import { damp } from './util';

export type PreviewMode = 'menu' | 'garage';
export type Focus = 'all' | 'head' | 'body' | 'hands' | 'skis';
const FOCUS: Record<Focus, { y: number; dist: number; x: number }> = {
  all: { y: 0.95, dist: 5.0, x: 0 }, head: { y: 1.75, dist: 2.5, x: 0 }, body: { y: 1.25, dist: 3.4, x: 0 },
  hands: { y: 1.1, dist: 2.8, x: 0.15 }, skis: { y: 0.2, dist: 2.9, x: 0 },
};

export class PreviewScene {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  sky: Sky; model: SkierModel; slope = new THREE.Group(); sprays: Sprays; snow: Snowfall;
  trees: THREE.InstancedMesh; treeData: { x: number; z: number; s: number }[] = [];
  platform: THREE.Mesh; raf = 0; disposed = false; last = 0; time = 0; running = true;
  mode: PreviewMode = 'menu'; focus: Focus = 'all'; speed = 14; yawOff = 0; dragging = false; auto = 0;
  camY = 1; camD = 6; camX = 0; shift = 0; acc = 0; viewW = 1; viewH = 1; fx = 0; fy = 0; dummy = new THREE.Object3D();
  private disposables: { dispose(): void }[] = [];

  constructor(public canvas: HTMLCanvasElement, look: Look) {
    const env = ENVS.valley;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(env.fog);
    this.scene.fog = new THREE.FogExp2(env.fog, 0.0035);
    this.scene.add(new THREE.HemisphereLight(env.hemiSky, env.hemiGround, 1.1));
    const sun = new THREE.DirectionalLight(0xffd2a0, 2.6); sun.position.set(-6, 7, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0x9ec6ff, 0.8); rim.position.set(5, 3, -6); this.scene.add(rim);
    this.sky = new Sky({ ...env, sunDir: [-0.6, 0.35, 0.7] }); this.scene.add(this.sky.group);

    this.scene.add(this.slope); this.slope.rotation.x = 0.2;
    // ground
    const gg = new THREE.PlaneGeometry(260, 420, 52, 84); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, -150);
    const p = gg.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), ax = Math.abs(x);
      const y = ax > 7 ? (ax - 7) * 0.12 + Math.sin(x * 0.2 + z * 0.1) * 0.8 * Math.min(1, (ax - 7) / 12) : 0;
      p.setY(i, y - 0.02);
      const v = 0.93 + Math.sin(x * 0.3) * Math.cos(z * 0.2) * 0.03 - Math.min(0.12, ax * 0.003);
      col[i * 3] = v * 0.97; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = Math.min(1, v * 1.04);
    }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals();
    const gm = new THREE.MeshLambertMaterial({ vertexColors: true }); const ground = new THREE.Mesh(gg, gm); ground.receiveShadow = true; this.slope.add(ground);
    this.disposables.push(gg, gm);
    // ski tracks
    const tm = new THREE.MeshBasicMaterial({ color: 0xb4c8e2 }); const tg = new THREE.PlaneGeometry(0.07, 60); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.012, -30);
    for (const x of [-0.17, 0.17]) { const m = new THREE.Mesh(tg, tm); m.position.x = x; this.slope.add(m); }
    this.disposables.push(tm, tg);
    // trees
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6); trunk.translate(0, 1.2, 0); parts.push(trunk);
    for (const [r, h, y] of [[1.9, 3.3, 2.2], [1.4, 2.8, 4.0], [0.95, 2.4, 5.7]]) { const c = new THREE.ConeGeometry(r, h, 7); c.translate(0, y + h / 2, 0); parts.push(c); }
    const tgeo = new THREE.BufferGeometry();
    const merged = this.mergeColored(parts); tgeo.copy(merged); merged.dispose(); parts.forEach((q) => q.dispose());
    const tmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const N = 150; this.trees = new THREE.InstancedMesh(tgeo, tmat, N); this.trees.castShadow = false;
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      this.treeData.push({ x: side * (9 + Math.random() * 40), z: -Math.random() * 170 + 10, s: 0.8 + Math.random() * 1.2 });
      this.trees.setColorAt(i, new THREE.Color().setHSL(0.4, 0.25, 0.7 + Math.random() * 0.3));
    }
    this.slope.add(this.trees); this.disposables.push(tgeo, tmat);
    // mounts for platform
    const pm = new THREE.MeshLambertMaterial({ color: 0x14264d }); const pg = new THREE.CylinderGeometry(1.5, 1.6, 0.14, 40);
    this.platform = new THREE.Mesh(pg, pm); this.platform.position.y = -0.05; this.platform.receiveShadow = true; this.platform.visible = false; this.slope.add(this.platform);
    const rg = new THREE.TorusGeometry(1.52, 0.03, 8, 60); rg.rotateX(Math.PI / 2); const rm = new THREE.MeshBasicMaterial({ color: 0x7cc8ff });
    const ring = new THREE.Mesh(rg, rm); ring.position.y = 0.03; this.platform.add(ring); this.disposables.push(pm, pg, rg, rm);

    this.model = new SkierModel(look); this.model.root.rotation.order = 'YXZ'; this.slope.add(this.model.root);
    this.sprays = new Sprays(260); this.scene.add(this.sprays.points);
    this.snow = new Snowfall(500, 3); this.scene.add(this.snow.points);
    window.addEventListener('resize', this.onResize); this.resize();
    this.last = performance.now();
    const loop = (t: number) => { if (this.disposed) return; this.raf = requestAnimationFrame(loop); if (this.running) this.frame(t); };
    this.raf = requestAnimationFrame(loop);
  }
  private mergeColored(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = [];
    const bark = new THREE.Color(0x5a3d28), leaf = new THREE.Color(0x2f6b4d), snow = new THREE.Color(0xf3f9ff);
    parts.forEach((g, gi) => {
      const base = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
      let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < p.count; i++) { ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
        const c = gi === 0 ? bark : leaf.clone().lerp(snow, ((p.getY(i) - ymin) / (ymax - ymin)) * 0.85); col.push(c.r, c.g, c.b);
      }
      const ix = g.index!; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); m.setIndex(idx);
    return m;
  }

  setLook(look: Look) { this.model.setLook(look); }
  setMode(m: PreviewMode, shift = 0) { this.mode = m; this.platform.visible = m === 'garage'; this.shift = shift; this.applyOffset(); }
  setFocus(f: Focus) { this.focus = f; }
  setRunning(r: boolean) { this.running = r; if (r) this.last = performance.now(); }
  drag(dx: number) { if (!Number.isFinite(dx)) return; this.yawOff += dx * 0.012; }
  private onResize = () => this.resize();
  resize() {
    const w = Math.max(2, this.canvas.clientWidth), h = Math.max(2, this.canvas.clientHeight);
    this.viewW = w; this.viewH = h; this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.applyOffset();
  }
  private applyOffset() {
    const w = this.viewW, h = this.viewH;
    const portrait = h > w;
    this.fx = portrait ? 0 : this.shift; this.fy = portrait && this.mode === 'garage' ? 0.16 : 0;
    this.cam.setViewOffset(w, h, this.fx * w, this.fy * h, w, h); this.cam.updateProjectionMatrix();
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    const garage = this.mode === 'garage';
    this.speed = damp(this.speed, garage ? 0 : 14, 3, dt);
    for (let i = 0; i < this.treeData.length; i++) {
      const t = this.treeData[i]; t.z -= this.speed * dt; if (t.z < -170) t.z += 180;
      const d = this.dummy; d.position.set(t.x, 0, t.z); d.scale.setScalar(t.s); d.rotation.y = i; d.updateMatrix(); this.trees.setMatrixAt(i, d.matrix);
    }
    this.trees.instanceMatrix.needsUpdate = true;
    // skier
    const m = this.model;
    const portrait = this.viewH > this.viewW;
    if (garage) { if (!this.dragging) this.auto += dt * 0.35; m.root.rotation.set(0, Math.PI * 0.85 + this.auto + this.yawOff, 0); m.root.position.set(0, 0.07, 0); }
    else { m.root.rotation.set(0, Math.PI - 0.15, 0); m.root.position.set(0, 0, 0); }
    const lean = Math.sin(this.time * 0.9) * 0.6;
    const tuck = !garage && Math.sin(this.time * 0.35) > 0.55;
    m.update({ mode: garage ? 'idle' : tuck ? 'tuck' : 'ski', lean: garage ? 0 : lean, speed01: garage ? 0 : 0.85, crashP: 0, t: this.time, squash: 0, spin: 0 }, dt);
    if (!garage) { m.root.rotation.z = 0; m.root.rotation.y = Math.PI - 0.15 - lean * 0.12; }
    // spray
    if (!garage && this.speed > 5) {
      for (let i = 0; i < 3; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const wp = new THREE.Vector3(side * 0.3, 0.1, -0.5 - Math.random() * 0.4).applyMatrix4(this.slope.matrixWorld);
        const dv = new THREE.Vector3(side * (0.5 + Math.random() * 2) - lean * 2, 0.8 + Math.random() * 1.8, -4 - Math.random() * 3).transformDirection(this.slope.matrixWorld).multiplyScalar(4);
        this.sprays.emit(wp.x, wp.y, wp.z, dv.x, dv.y, dv.z, 0.3 + Math.random() * 0.3, 0.7 + Math.random() * 0.5);
      }
    }
    this.sprays.update(dt, this.viewH / (2 * Math.tan((42 * Math.PI) / 360)));
    // camera
    const f = FOCUS[garage ? this.focus : 'all'];
    const menuDist = portrait ? 8.2 : 6.6;
    const tD = garage ? f.dist * (portrait ? 1.35 : 1) : menuDist, tY = garage ? f.y : 1.05, tX = garage ? f.x : 0;
    this.camD = damp(this.camD, tD, 4, dt); this.camY = damp(this.camY, tY, 4, dt); this.camX = damp(this.camX, tX, 4, dt);
    const ang = garage ? 0.28 : 0.55 + Math.sin(this.time * 0.18) * 0.16;
    const tilt = this.slope.rotation.x;
    const local = new THREE.Vector3(Math.sin(ang) * this.camD, this.camY + (garage ? 0.25 : 0.35), Math.cos(ang) * this.camD);
    this.cam.position.copy(local.applyEuler(new THREE.Euler(tilt, 0, 0)));
    const look = new THREE.Vector3(this.camX, this.camY, 0).applyEuler(new THREE.Euler(tilt, 0, 0));
    this.cam.lookAt(look);
    this.sky.follow(this.cam);
    this.snow.setCamera(this.cam, this.time, this.viewH * this.renderer.getPixelRatio());
    this.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize);
    this.model.dispose(); this.sprays.dispose(); this.snow.dispose(); this.sky.dispose(); this.trees.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
