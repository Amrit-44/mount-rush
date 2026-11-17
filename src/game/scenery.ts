import * as THREE from 'three';
import { EnvDef } from './data';
import { mulberry32, smoothstep } from './util';

export class Sky {
  group = new THREE.Group();
  private disposables: { dispose(): void }[] = [];
  constructor(env: EnvDef) {
    const sunDir = new THREE.Vector3(...env.sunDir).normalize();
    const geo = new THREE.SphereGeometry(2800, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(env.skyTop) }, hor: { value: new THREE.Color(env.skyHorizon) },
        low: { value: new THREE.Color(env.fog) }, sun: { value: sunDir }, sunCol: { value: new THREE.Color(env.sun) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 low; uniform vec3 sun; uniform vec3 sunCol;
        void main(){ float h = vP.y; vec3 c = mix(hor, top, pow(clamp(h,0.0,1.0), 0.5));
          c = mix(c, low, smoothstep(0.02,-0.12,h));
          float sd = max(dot(normalize(vP), sun), 0.0);
          c += sunCol * (pow(sd, 900.0)*1.6 + pow(sd, 40.0)*0.35 + pow(sd, 6.0)*0.12);
          gl_FragColor = vec4(c,1.0); }`,
    });
    const dome = new THREE.Mesh(geo, mat); dome.renderOrder = -10; dome.frustumCulled = false;
    this.group.add(dome); this.disposables.push(geo, mat);

    // mountains
    const rnd = mulberry32(99);
    const fogC = new THREE.Color(env.fog), mt = new THREE.Color(env.mountain), snow = new THREE.Color(0xffffff);
    const mm = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }); this.disposables.push(mm);
    const ring = (n: number, r0: number, r1: number, h0: number, h1: number, haze: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3, r = r0 + rnd() * (r1 - r0), h = h0 + rnd() * (h1 - h0);
        const g = new THREE.ConeGeometry(h * (0.55 + rnd() * 0.4), h, 6 + Math.floor(rnd() * 3), 4, true);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y < h / 2 - 1) { p.setX(k, p.getX(k) * (0.85 + rnd() * 0.3)); p.setZ(k, p.getZ(k) * (0.85 + rnd() * 0.3)); } }
        const cols = new Float32Array(p.count * 3);
        for (let k = 0; k < p.count; k++) {
          const f = (p.getY(k) + h / 2) / h;
          const c = mt.clone().multiplyScalar(0.75 + 0.25 * f).lerp(snow, smoothstep(0.38, 0.62, f)).lerp(fogC, haze);
          cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const m = new THREE.Mesh(g, mm); m.position.set(Math.cos(a) * r, h / 2 - 140, Math.sin(a) * r); m.frustumCulled = false;
        this.group.add(m); this.disposables.push(g);
      }
    };
    ring(22, 1900, 2300, 700, 1200, 0.55); ring(18, 1350, 1700, 380, 700, 0.38); ring(14, 950, 1200, 180, 360, 0.22);

    // clouds
    const cc = document.createElement('canvas'); cc.width = cc.height = 128;
    const g = cc.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const ct = new THREE.CanvasTexture(cc); this.disposables.push(ct);
    const cm = new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true, opacity: 0.85, color: new THREE.Color(env.skyHorizon).lerp(new THREE.Color(0xffffff), 0.6) });
    this.disposables.push(cm);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 1200 + rnd() * 1300;
      const s = new THREE.Sprite(cm); s.position.set(Math.cos(a) * r, 220 + rnd() * 380, Math.sin(a) * r);
      s.scale.set(500 + rnd() * 700, 120 + rnd() * 150, 1); this.group.add(s);
    }
  }
  follow(cam: THREE.Camera) { this.group.position.copy(cam.position); }
  dispose() { this.disposables.forEach((d) => d.dispose()); }
}

const PT_VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uPx; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
 gl_PointSize = clamp(aSize*uPx/max(-mv.z,0.1), 0.0, 90.0); vA = aAlpha; vC = aColor; }`;
const PT_FRAG = `varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vC, vA*(1.0-d*1.6)); }`;

export class Snowfall {
  points: THREE.Points; mat: THREE.ShaderMaterial; geo: THREE.BufferGeometry;
  constructor(count: number, wind: number) {
    this.geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3), s = new Float32Array(count);
    for (let i = 0; i < count; i++) { p[i * 3] = Math.random(); p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.random(); s[i] = Math.random(); }
    this.geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.geo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: new THREE.Vector3(70, 40, 70) }, uPx: { value: 500 }, uWind: { value: new THREE.Vector2(wind, wind * 0.4) } },
      vertexShader: `attribute float aSeed; uniform vec3 uCam; uniform float uTime; uniform vec3 uBox; uniform float uPx; uniform vec2 uWind; varying float vA;
        void main(){ vec3 p = position*uBox; p.y -= uTime*(2.5+aSeed*3.0); p.x += uTime*uWind.x + sin(uTime*0.9+aSeed*30.0)*0.7; p.z += uTime*uWind.y;
          vec3 rel = mod(p - uCam + uBox*0.5, uBox) - uBox*0.5; vec4 mv = viewMatrix*vec4(uCam+rel,1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp((0.05+aSeed*0.08)*uPx/max(-mv.z,0.1), 1.0, 14.0);
          vA = 0.85*smoothstep(35.0, 20.0, length(rel.xz)) * smoothstep(20.0, 14.0, abs(rel.y)); }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(1.0,1.0,1.0,vA*(1.0-d*1.8)); }',
    });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  setCamera(cam: THREE.PerspectiveCamera, time: number, viewH: number) {
    this.mat.uniforms.uCam.value.copy(cam.position); this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uPx.value = viewH / (2 * Math.tan((cam.fov * Math.PI) / 360));
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class Sprays {
  points: THREE.Points; geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial;
  n: number; pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array;
  vel: Float32Array; life: Float32Array; maxLife: Float32Array; base: Float32Array; head = 0;
  constructor(n: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.maxLife = new Float32Array(n).fill(1); this.base = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 500 } }, vertexShader: PT_VERT, fragmentShader: PT_FRAG });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 4;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, r = 1, g = 1, b = 1) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i] = size; this.size[i] = size; this.life[i] = life; this.maxLife[i] = life;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  update(dt: number, px: number) {
    const drag = Math.exp(-1.8 * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 6 * dt; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = f * 0.85; this.size[i] = this.base[i] * (1.6 - f * 0.6);
    }
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    this.mat.uniforms.uPx.value = px;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

/** Ribbon trail left in the snow by one skier. */
export class Trail {
  mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial;
  pts: { x: number; y: number; z: number; rx: number; rz: number; gap: boolean }[] = [];
  max = 60; pendingGap = true; lastX = 1e9; lastZ = 1e9;
  pa: Float32Array; ca: Float32Array; ia: Uint16Array;
  constructor(public tint: number) {
    const nv = this.max * 4;
    this.pa = new Float32Array(nv * 3); this.ca = new Float32Array(nv * 3); this.ia = new Uint16Array(this.max * 12);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pa, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.ca, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(new THREE.BufferAttribute(this.ia, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
  }
  reset() { this.pts.length = 0; this.pendingGap = true; this.geo.setDrawRange(0, 0); }
  add(x: number, y: number, z: number, rx: number, rz: number, grounded: boolean) {
    if (!grounded) { this.pendingGap = true; return; }
    if (Math.hypot(x - this.lastX, z - this.lastZ) < 1.3) return;
    this.lastX = x; this.lastZ = z;
    this.pts.push({ x, y, z, rx, rz, gap: this.pendingGap }); this.pendingGap = false;
    if (this.pts.length > this.max) this.pts.shift();
    this.rebuild();
  }
  private rebuild() {
    const n = this.pts.length, tint = new (THREE as any).Color(this.tint);
    let ii = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i], age = 1 - i / n; // 0 = newest
      const f = Math.min(1, age * 1.15);
      const r = 0.93 + (tint.r - 0.93) * (1 - f) * 0.9, g = 0.96 + (tint.g - 0.96) * (1 - f) * 0.9, b = 1 + (tint.b - 1) * (1 - f) * 0.9;
      let k = 0;
      for (const off of [-0.34, -0.2, 0.2, 0.34]) {
        const v = i * 4 + k++;
        this.pa[v * 3] = p.x + p.rx * off; this.pa[v * 3 + 1] = p.y + 0.05; this.pa[v * 3 + 2] = p.z + p.rz * off;
        this.ca[v * 3] = r; this.ca[v * 3 + 1] = g; this.ca[v * 3 + 2] = b;
      }
      if (i > 0 && !p.gap) {
        const a = (i - 1) * 4, c = i * 4;
        for (const o of [0, 2]) { this.ia[ii++] = a + o; this.ia[ii++] = c + o; this.ia[ii++] = a + o + 1; this.ia[ii++] = a + o + 1; this.ia[ii++] = c + o; this.ia[ii++] = c + o + 1; }
      }
    }
    this.geo.setDrawRange(0, ii);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.geo.index!.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
