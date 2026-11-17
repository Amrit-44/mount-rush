// Race engine: owns renderer, scene, simulation loop, cameras, FX, audio hooks and HUD state.
import * as THREE from 'three';
import { CourseDef, ENVS, Look } from './data';
import { audio } from './audio';
import { input } from './input';
import { PlayerOutcome, RaceResult } from './progression';
import { Settings } from './save';
import { Sky, Snowfall, Sprays, Trail } from './scenery';
import { AIDriver, Input, Personality, SkierSim } from './sim';
import { PoseMode, SkierModel } from './skierModel';
import { Track } from './track';
import { QUALITY, World } from './world';
import { clamp, damp, lerp } from './util';

export interface RacerCfg {
  name: string; look: Look; human: boolean; slot: number; color: string;
  personality?: Personality; skill?: number; top?: number; grip?: number; boost?: number;
}
export interface RaceConfig {
  mode: 'career' | 'quick' | 'endless' | 'versus';
  course: CourseDef; racers: RacerCfg[]; settings: Settings; eventId?: string; coinMul?: number;
}
export interface PlayerHud {
  slot: number; name: string; speed: number; speed01: number; boost: number; position: number; total: number;
  coins: number; progress: number; distance: number; crashes: number; finished: boolean; time: number;
  lives: number; multiplier: number; score: number; boosting: boolean; airborne: boolean; crashed: boolean; finalPos: number;
}
export interface HudState {
  phase: 'countdown' | 'racing' | 'finished'; countdown: number; go: boolean; time: number; players: PlayerHud[];
  racers: { name: string; color: string; progress: number; human: boolean; slot: number; position: number }[];
  toasts: { id: number; slot: number; text: string; kind: string }[]; fps: number; paused: boolean;
  length: number; mode: string; timeout: number | null; envName: string; courseName: string; best: number;
}
export interface RaceCallbacks { onHud: (h: HudState) => void; onEnd: (r: RaceResult) => void }

interface Racer {
  cfg: RacerCfg; sim: SkierSim; ai: AIDriver | null; model: SkierModel; trail: Trail | null;
  place: number; sprayAcc: number; pitch: number; poseT: number; finishClock: number | null; lastMistakes: number;
  grid: number; lives: number; cleanDist: number; mult: number; score: number; lastDist: number; nextLifeAt: number; dead: boolean; deadClock: number;
}

class CamRig {
  cam = new THREE.PerspectiveCamera(64, 1, 0.3, 3400);
  s = 0; d = 0; y = 0; ls = 0; ld = 0; ly = 0; fov = 64; shake = 0; roll = 0; init = false; offs = 0; fovPunch = 0;
  update(r: Racer, T: Track, dt: number, sens: number, time: number) {
    const sim = r.sim, v = sim.v;
    const front = r.finishClock !== null && r.finishClock > 1.2 && sim.state === 'finished';
    const back = front ? -8.5 : 4.2 + v * 0.03;
    const tS = sim.s - back;
    if (!this.init) { this.s = tS; this.d = sim.d * 0.8; this.y = sim.y + 3; this.ls = sim.s + 8; this.ld = sim.d; this.ly = sim.y; this.init = true; }
    this.s = damp(this.s, tS, front ? 2.2 : 10, dt);
    this.d = damp(this.d, sim.d * 0.8, 5, dt);
    const gC = T.groundH(this.s, this.d);
    const hOff = 2.45 + v * 0.01 + (front ? -0.6 : 0);
    const tY = (sim.grounded ? gC : lerp(gC, sim.y, 0.7)) + hOff;
    this.y = damp(this.y, tY, sim.grounded ? 8 : 4, dt);
    this.y = Math.max(this.y, gC + 1.4);
    const q = T.query(this.s);
    const px = q.x - q.tz * this.d, pz = q.z + q.tx * this.d;
    this.ls = damp(this.ls, front ? sim.s : sim.s + 9 + v * 0.1, 11, dt);
    this.ld = damp(this.ld, sim.d * 0.92, 6, dt);
    const gl = T.groundH(this.ls, this.ld);
    const tLy = front ? sim.y + 1.1 : lerp(gl, sim.y, 0.55) + 1.0;
    this.ly = damp(this.ly, tLy, 8, dt);
    const ql = T.query(this.ls);
    const lx = ql.x - ql.tz * this.ld, lz = ql.z + ql.tx * this.ld;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * 0.12;
    this.cam.position.set(px + Math.sin(time * 61) * sh, this.y + Math.sin(time * 53) * sh, pz + Math.cos(time * 47) * sh);
    this.fovPunch = Math.max(0, this.fovPunch - dt * 2);
    const tFov = 62 + clamp(v / 62, 0, 1.3) * 20 + (sim.boosting || sim.padT > 0 ? 6 : 0) + this.fovPunch * 5;
    this.fov = damp(this.fov, tFov, 3.5, dt);
    this.cam.fov = this.fov;
    const tRoll = -sim.steerSm * 0.05 * sens * clamp(v / 30, 0.3, 1.1);
    this.roll = damp(this.roll, tRoll, 5, dt);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(lx, this.ly, lz);
    this.cam.rotateZ(this.roll);
    this.cam.updateProjectionMatrix();
  }
}

export class Race {
  canvas: HTMLCanvasElement; cfg: RaceConfig; cb: RaceCallbacks;
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); track: Track; world: World; sky: Sky;
  sun: THREE.DirectionalLight; sunDir: THREE.Vector3;
  racers: Racer[] = []; locals: { r: Racer; rig: CamRig; snow: Snowfall; wind: number }[] = [];
  sprays: Sprays; q = QUALITY.medium;
  phase: 'countdown' | 'racing' | 'finished' = 'countdown'; clock = 0; raceTime = 0; countT = -3.2; lastCount = 4; goT = 0;
  paused = false; disposed = false; ended = false; raf = 0; last = 0; acc = 0; hudT = 0; time = 0;
  toasts: { id: number; slot: number; text: string; kind: string; t: number }[] = []; toastId = 1;
  fps = 60; fpsAcc = 0; fpsN = 0; dynScale = 1; dynT = 0; baseRatio = 1; endClock = 0; versusTimeout: number | null = null;
  sens = 1; maxSpeed = 0; viewW = 1; viewH = 1; resizeObs: ResizeObserver | null = null;
  endless: boolean;

  constructor(canvas: HTMLCanvasElement, cfg: RaceConfig, cb: RaceCallbacks) {
    this.canvas = canvas; this.cfg = cfg; this.cb = cb;
    const st = cfg.settings;
    this.q = { ...QUALITY[st.quality] };
    if (!st.shadows) this.q.shadows = false;
    if (!st.particles) this.q.particles = 0.0001;
    this.sens = st.camSens;
    this.endless = cfg.mode === 'endless';
    const env = ENVS[cfg.course.env];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.antialias, powerPreference: 'high-performance' });
    this.baseRatio = Math.min(window.devicePixelRatio || 1, this.q.pixelCap) * st.resScale;
    this.renderer.setPixelRatio(this.baseRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.q.shadows; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(env.fog);
    this.scene.fog = new THREE.FogExp2(env.fog, env.fogDensity);
    this.scene.add(new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemiInt));
    this.sunDir = new THREE.Vector3(...env.sunDir).normalize();
    this.sun = new THREE.DirectionalLight(env.sun, env.sunInt);
    this.sun.castShadow = this.q.shadows;
    this.sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    const sc = this.sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.35;
    this.scene.add(this.sun, this.sun.target);
    // cool fill/rim light from opposite the sun so shaded slope faces are not black (no shadows)
    const rim = new THREE.DirectionalLight(0xbfd9ff, 0.55);
    rim.position.set(-this.sunDir.x * 80, 40, -this.sunDir.z * 80);
    this.scene.add(rim);
    this.sky = new Sky(env); this.scene.add(this.sky.group);

    this.track = new Track({
      envId: cfg.course.env, seed: cfg.course.seed + (this.endless ? Math.floor(Math.random() * 100000) : 0), length: cfg.course.length,
      curve: cfg.course.curve, density: cfg.course.density, endless: this.endless, coinMul: cfg.coinMul,
    });
    this.track.ensure(this.endless ? 900 : 600);
    this.world = new World(this.scene, this.track, this.q);
    this.sprays = new Sprays(Math.round(900 * this.q.particles) + 50);
    this.scene.add(this.sprays.points);

    // racers + grid
    const humans = cfg.racers.filter((r) => r.human);
    const prefer = this.endless ? [1] : humans.length > 1 ? [0, 2] : [1];
    const used = new Set<number>(); let nextFree = 0;
    cfg.racers.forEach((rc) => {
      let g: number;
      if (rc.human) { g = prefer[rc.slot] ?? prefer[0]; if (used.has(g)) g = -1; } else g = -1;
      if (g < 0) { while (used.has(nextFree)) nextFree++; g = nextFree; }
      used.add(g);
      const sim = new SkierSim();
      sim.topMul = rc.top ?? 1; sim.gripMul = rc.grip ?? 1; sim.boostMul = rc.boost ?? 1;
      const row = Math.floor(g / 3), col = g % 3;
      sim.place(this.endless ? 12 : 10 - row * 4.2, (col - 1) * 3.5 * (this.endless ? 0 : 1), this.track);
      const model = new SkierModel(rc.look); model.root.rotation.order = 'YXZ'; this.scene.add(model.root);
      const ai = rc.human ? null : new AIDriver(rc.personality!, rc.skill ?? 0.6, 1000 + g * 17 + cfg.course.seed);
      const trail = rc.human && this.q.trails ? new Trail(0x9db6d4) : null; if (trail) this.scene.add(trail.mesh);
      this.racers.push({ cfg: rc, sim, ai, model, trail, place: 1, sprayAcc: 0, pitch: 0, poseT: Math.random() * 10, finishClock: null, lastMistakes: 0, grid: g,
        lives: 3, cleanDist: 0, mult: 1, score: 0, lastDist: 0, nextLifeAt: 2000, dead: false, deadClock: 0 });
    });
    for (const r of this.racers) if (r.cfg.human) {
      const rig = new CamRig(); const wind = env.id === 'peak' ? 7 : 2;
      const snow = new Snowfall(Math.round(900 * this.q.snow * env.snow) + 60, wind);
      this.scene.add(snow.points); this.locals.push({ r, rig, snow, wind });
    }
    this.locals.sort((a, b) => a.r.cfg.slot - b.r.cfg.slot);

    input.versus = cfg.mode === 'versus'; input.capture = true; input.reset();
    input.attach();
    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(canvas);
    window.addEventListener('resize', this.onResize);
    // build initial chunks
    for (const l of this.locals) this.world.update(l.r.sim.s, l.r.sim.s, 99);
    for (const l of this.locals) { l.rig.update(l.r, this.track, 0.016, this.sens, 0); }
    this.syncVisuals(0.016, true);
    audio.init(); audio.playMusic('race', env.root, env.bpm);
  }

  private onResize = () => this.resize();
  resize() {
    const w = Math.max(2, this.canvas.clientWidth), h = Math.max(2, this.canvas.clientHeight);
    this.viewW = w; this.viewH = h;
    this.renderer.setSize(w, h, false);
  }
  applySettings(s: Settings) {
    this.sens = s.camSens; audio.setVolumes(s.sfx, s.music);
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      try { this.frame(now); } catch (e) { console.error(e); }
    };
    this.raf = requestAnimationFrame(loop);
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) audio.silenceLoops();
    this.last = performance.now();
    this.emitHud(true);
  }

  private toast(slot: number, text: string, kind = 'info') {
    this.toasts.push({ id: this.toastId++, slot, text, kind, t: this.time });
    if (this.toasts.length > 8) this.toasts.shift();
  }

  // ---------------- frame ----------------
  private frame(now: number) {
    let dt = (now - this.last) / 1000; this.last = now;
    dt = clamp(dt, 0, 0.05);
    this.time += this.paused ? 0 : dt;
    // fps + dynamic resolution
    if (dt > 0) { this.fpsAcc += dt; this.fpsN++; }
    if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; this.dynT++;
      if (!this.paused && this.dynT >= 2) { this.dynT = 0;
        if (this.fps < 28 && this.dynScale > 0.55) { this.dynScale -= 0.12; this.renderer.setPixelRatio(this.baseRatio * this.dynScale); }
        else if (this.fps > 56 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.06); this.renderer.setPixelRatio(this.baseRatio * this.dynScale); }
      } }
    if (!this.paused) {
      this.advance(dt);
      this.syncVisuals(dt, false);
    }
    this.render();
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.06; this.emitHud(false); }
  }

  private advance(dt: number) {
    const T = this.track;
    // countdown
    if (this.phase === 'countdown') {
      this.countT += dt;
      const shown = clamp(Math.ceil(-this.countT), 0, 3);
      if (this.countT < 0 && shown !== this.lastCount) { this.lastCount = shown; if (shown > 0) audio.play('beep'); }
      if (this.countT >= 0) {
        this.phase = 'racing'; this.goT = 0; audio.play('go');
        for (const r of this.racers) r.sim.begin();
      }
    } else this.goT += dt;
    if (this.phase !== 'countdown' && !this.ended) this.raceTime += dt;

    // inputs
    const inputs = new Map<Racer, Input>();
    const sims = this.racers.map((r) => r.sim);
    const stepDt = 1 / 90;
    this.acc += dt;
    let steps = 0, first = true;
    const humanInputs = new Map<Racer, Input>();
    for (const r of this.racers) if (r.cfg.human) humanInputs.set(r, input.read(r.cfg.slot));
    while (this.acc >= stepDt && steps < 8) {
      this.acc -= stepDt; steps++;
      for (const r of this.racers) {
        let inp: Input;
        if (r.cfg.human) { const h = humanInputs.get(r)!; inp = { ...h, jump: h.jump && first }; if (this.endless && r.dead) inp = { steer: 0, jump: false, boost: false, brake: true }; }
        else inp = r.ai!.control(r.sim, T, sims, stepDt);
        inputs.set(r, inp);
        r.sim.update(stepDt, inp, T, r.cfg.human);
        if (r.sim.events.length) this.handleEvents(r);
        if (r.sim.v > this.maxSpeed && r.cfg.human) this.maxSpeed = r.sim.v;
      }
      first = false;
      this.collideRacers(stepDt);
      if (this.endless) this.endlessStep(stepDt);
    }
    if (steps >= 8) this.acc = 0;
    this.updateRanks();
    this.checkEnd(dt);
  }

  private collideRacers(dt: number) {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i].sim, b = rs[j].sim;
      if (a.state === 'grid' || b.state === 'grid') continue;
      const ds = a.s - b.s, dd = a.d - b.d;
      if (Math.abs(ds) < 1.7 && Math.abs(dd) < 1.0) {
        const push = (1.0 - Math.abs(dd)) * 0.5 + 0.02;
        const sg = dd >= 0 ? 1 : -1;
        const hwA = this.track.query(a.s).hw - 0.4;
        a.d = clamp(a.d + sg * push, -hwA, hwA); b.d = clamp(b.d - sg * push, -hwA, hwA);
        const rear = ds < 0 ? a : b; rear.v *= 1 - 0.8 * dt;
      }
    }
  }

  private endlessStep(dt: number) {
    const r = this.racers[0], s = r.sim;
    if (r.dead) return;
    const dd = s.dist - r.lastDist; r.lastDist = s.dist;
    if (s.mistakes > r.lastMistakes) { r.lastMistakes = s.mistakes; r.cleanDist = 0; r.mult = 1; }
    else if (s.state === 'racing') { r.cleanDist += dd; r.mult = Math.min(8, 1 + Math.floor(r.cleanDist / 400)); }
    r.score += dd * r.mult * (s.boosting ? 1.5 : 1);
    // difficulty ramps speed
    s.topMul = (r.cfg.top ?? 1) * (1 + 0.14 * Math.min(1, s.s / 9000));
    if (s.s > r.nextLifeAt && r.lives < 3) { r.lives++; this.toast(0, '+1 LIFE', 'good'); audio.play('levelup'); }
    if (s.s > r.nextLifeAt) r.nextLifeAt = s.s + 2000;
    void dt;
  }

  private handleEvents(r: Racer) {
    const sim = r.sim, human = r.cfg.human, slot = r.cfg.slot;
    const pos = new THREE.Vector3();
    const q = this.track.query(sim.s);
    pos.set(q.x - q.tz * sim.d, sim.y, q.z + q.tx * sim.d);
    for (const e of sim.events) {
      const heavy = human;
      switch (e.t) {
        case 'jump': if (heavy) audio.play('jump'); this.burst(pos, 8, 3, 0.4, [1, 1, 1]); break;
        case 'land': if (heavy) audio.play('land', e.v); this.burst(pos, Math.min(30, 6 + e.v * 1.5), 5, 0.5, [1, 1, 1]); if (human) this.locals.forEach((l) => { if (l.r === r) l.rig.shake = Math.max(l.rig.shake, clamp(e.v / 14, 0, 0.7)); }); break;
        case 'hardland': if (heavy) { audio.play('hardland'); this.toast(slot, 'HARD LANDING', 'bad'); } this.burst(pos, 40, 8, 0.6, [1, 1, 1]); this.locals.forEach((l) => { if (l.r === r) l.rig.shake = 1; }); break;
        case 'perfect': if (human) { this.toast(slot, 'PERFECT LANDING +BOOST', 'good'); } break;
        case 'trick': if (human) { audio.play('trick'); this.toast(slot, `TRICK x${e.v}  +BOOST`, 'good'); this.burst(pos, 30, 7, 0.5, [1, 0.9, 0.3]); } break;
        case 'crash': if (human) { audio.play('crash'); this.toast(slot, 'CRASH!', 'bad'); this.locals.forEach((l) => { if (l.r === r) l.rig.shake = 1; }); if (this.endless) this.endlessCrash(r); } else if (this.nearHuman(r, 60)) audio.play('hit', 0.5); this.burst(pos, 50, 9, 0.7, [1, 1, 1]); break;
        case 'hit': if (human) { audio.play('hit'); this.toast(slot, 'OUCH!', 'bad'); this.locals.forEach((l) => { if (l.r === r) l.rig.shake = Math.max(l.rig.shake, 0.6); }); } this.burst(pos, 24, 6, 0.5, [1, 1, 1]); break;
        case 'bump': if (human) audio.play('bump'); this.burst(pos, 10, 4, 0.4, [1, 1, 1]); break;
        case 'bush': if (human) audio.play('bush'); this.burst(pos, 14, 4, 0.5, [0.9, 1, 0.95]); break;
        case 'barrier': if (human) { audio.play('barrier'); this.toast(slot, 'BARRIER HIT', 'bad'); } this.burst(pos, 20, 6, 0.5, [1, 0.6, 0.3]); break;
        case 'coin': if (human) { audio.play('coin'); const c = this.track.coins[e.v]; if (c) this.world.takeCoin(c); this.burst(pos, 4, 3, 0.25, [1, 0.85, 0.2]); } break;
        case 'pad': if (human) { audio.play('pad'); this.toast(slot, 'BOOST PAD!', 'good'); } this.burst(pos, 26, 8, 0.4, [0.4, 0.9, 1]); break;
        case 'boostOn': if (human) audio.play('boost'); this.burst(pos, 26, 7, 0.5, [0.55, 0.9, 1]); if (human) this.locals.forEach((l) => { if (l.r === r) { l.rig.shake = Math.max(l.rig.shake, 0.35); l.rig.fovPunch = 1; } }); break;
        case 'recover': if (human) audio.play('recover'); break;
        case 'finish':
          r.finishClock = 0;
          if (human) { audio.play('finish'); this.toast(slot, 'FINISH!', 'good'); this.confetti(pos); }
          break;
      }
    }
  }
  private nearHuman(r: Racer, dist: number) { return this.locals.some((l) => Math.abs(l.r.sim.s - r.sim.s) < dist); }

  private endlessCrash(r: Racer) {
    r.lives--;
    if (r.lives <= 0) { r.dead = true; r.deadClock = 0; }
  }

  private updateRanks() {
    const rs = [...this.racers];
    const key = (r: Racer) => (r.sim.state === 'finished' ? 1e7 - (r.sim.finishTime ?? 0) : r.sim.s);
    rs.sort((a, b) => key(b) - key(a));
    rs.forEach((r, i) => (r.place = i + 1));
  }

  private checkEnd(dt: number) {
    if (this.ended) return;
    for (const r of this.racers) if (r.finishClock !== null) r.finishClock += dt;
    const humans = this.racers.filter((r) => r.cfg.human);
    if (this.endless) {
      const r = humans[0];
      if (r.dead) { r.deadClock += dt; if (r.deadClock > 2.2) this.finishRace(); }
      return;
    }
    const done = humans.filter((r) => r.sim.state === 'finished');
    if (this.cfg.mode === 'versus') {
      if (done.length === humans.length) { if (done.every((r) => (r.finishClock ?? 0) > 2.4)) this.finishRace(); this.versusTimeout = null; }
      else if (done.length > 0) {
        const first = Math.max(...done.map((r) => r.finishClock ?? 0));
        this.versusTimeout = Math.max(0, 25 - first);
        if (first > 25) this.finishRace();
      }
    } else {
      if (done.length === humans.length && done.every((r) => (r.finishClock ?? 0) > 2.6)) this.finishRace();
    }
    if (this.raceTime > 420) this.finishRace();
    if (done.length > 0 && this.phase === 'racing') this.phase = 'finished';
  }

  private finishRace() {
    if (this.ended) return;
    this.ended = true; this.phase = 'finished';
    audio.silenceLoops();
    const humans = this.racers.filter((r) => r.cfg.human);
    const total = this.racers.length;
    const ordered = [...this.racers].sort((a, b) => {
      const fa = a.sim.state === 'finished', fb = b.sim.state === 'finished';
      if (fa && fb) return (a.sim.finishTime ?? 0) - (b.sim.finishTime ?? 0);
      if (fa) return -1; if (fb) return 1;
      return b.sim.s - a.sim.s;
    });
    ordered.forEach((r, i) => (r.place = i + 1));
    const players: PlayerOutcome[] = humans.map((r) => ({
      slot: r.cfg.slot, position: r.place, total, time: r.sim.finishTime, finished: this.endless ? true : r.sim.state === 'finished',
      coins: r.sim.coins, crashes: r.sim.crashes, mistakes: r.sim.mistakes, topSpeed: r.sim.topSpeed, distance: r.sim.dist, jumps: r.sim.jumps,
    }));
    const res: RaceResult = {
      mode: this.cfg.mode, courseId: this.cfg.course.id, eventId: this.cfg.eventId, players, duration: this.raceTime,
      standings: ordered.map((r) => ({ name: r.cfg.name, time: r.sim.finishTime, human: r.cfg.human, slot: r.cfg.slot, color: r.cfg.color, position: r.place })),
    };
    if (this.cfg.mode === 'versus') {
      const fin = humans.filter((r) => r.sim.state === 'finished').sort((a, b) => (a.sim.finishTime ?? 0) - (b.sim.finishTime ?? 0));
      res.winnerSlot = fin.length ? fin[0].cfg.slot : (humans.sort((a, b) => b.sim.s - a.sim.s)[0]?.cfg.slot ?? 0);
    }
    if (this.endless) {
      const r = humans[0];
      res.endless = { distance: r.sim.s - 12, score: Math.round(r.score + r.sim.coins * 10), coins: r.sim.coins, maxSpeed: r.sim.topSpeed };
      res.players[0].distance = r.sim.s - 12;
    }
    const best = humans.find((r) => r.place === Math.min(...humans.map((h) => h.place)))!;
    const winSound = this.endless ? true : this.cfg.mode === 'versus' ? true : best.place <= 3;
    audio.play(winSound ? 'win' : 'lose');
    this.emitHud(true);
    this.cb.onEnd(res);
  }

  // ---------------- visuals ----------------
  private syncVisuals(dt: number, snap: boolean) {
    const T = this.track;
    let minS = Infinity, maxS = -Infinity;
    for (const l of this.locals) { minS = Math.min(minS, l.r.sim.s); maxS = Math.max(maxS, l.r.sim.s); }
    this.world.update(minS, maxS, snap ? 99 : 2);
    this.world.animateCoins(this.time, minS);
    const sprayPx = this.viewH / (2 * Math.tan((64 * Math.PI) / 360));
    for (const r of this.racers) {
      const sim = r.sim, q = T.query(sim.s);
      const near = this.locals.some((l) => Math.abs(l.r.sim.s - sim.s) < 110);
      r.model.root.visible = near;
      if (!near) continue;
      const px = q.x - q.tz * sim.d, pz = q.z + q.tx * sim.d;
      const th = q.th + sim.phi * 0.9 + sim.psi * 0.1;
      // pitch from ground gradient / flight path
      const g = (T.groundH(sim.s + 1.4, sim.d) - T.groundH(sim.s - 1.4, sim.d)) / 2.8;
      const tp = sim.grounded ? -Math.atan(g) : -Math.atan2(sim.vy, Math.max(sim.v, 5)) * 0.8;
      r.pitch = damp(r.pitch, tp, sim.grounded ? 14 : 5, dt);
      r.model.root.position.set(px, sim.y, pz);
      r.model.root.rotation.set(r.pitch, -th, 0);
      r.poseT += dt;
      let mode: PoseMode = 'ski';
      const fin = sim.state === 'finished';
      if (sim.state === 'grid') mode = 'idle';
      else if (sim.crashT > 0) mode = 'crash';
      else if (fin && sim.v < 5) mode = r.place <= 3 ? 'celebrate' : 'lose';
      else if (!sim.grounded) mode = 'air';
      else if (sim.boosting || sim.padT > 0) mode = 'tuck';
      r.model.update({ mode, lean: sim.steerSm, speed01: clamp(sim.v / 45, 0, 1.2), crashP: sim.crashT > 0 ? 1 - sim.crashT / sim.crashDur : 1, t: r.poseT, squash: sim.landT > 0 ? sim.landT / 0.45 : 0, spin: sim.spin }, dt);
      // invulnerability blink
      r.model.root.visible = near && !(sim.invuln > 0 && sim.crashT <= 0 && Math.floor(this.time * 14) % 2 === 0 && sim.invuln < 1.8);
      if (r.trail) { const c = Math.cos(th), s2 = Math.sin(th); r.trail.setBoost(sim.boosting || sim.padT > 0); r.trail.add(px, sim.y, pz, c, s2, sim.grounded && sim.state !== 'grid'); }
      if (!this.paused && sim.state !== 'grid') this.emitSpray(r, dt, px, pz, th);
    }
    this.sprays.update(this.paused ? 0 : dt, sprayPx);
    // local cams + audio
    for (const l of this.locals) l.rig.update(l.r, T, dt, this.sens, this.time);
    const p0 = this.locals[0];
    if (p0 && !this.paused) {
      const s = p0.r.sim;
      audio.updateSki(s.v / 42, s.grounded && s.crashT <= 0, (s.surface & 1) !== 0, s.boosting, s.state !== 'grid' && !this.ended);
    }
  }

  private emitSpray(r: Racer, dt: number, px: number, pz: number, th: number) {
    const sim = r.sim; if (!sim.grounded || sim.v < 5 || sim.crashT > 0) return;
    const near = this.locals.some((l) => Math.abs(l.r.sim.s - sim.s) < 60);
    if (!near) return;
    const slide = Math.abs(Math.sin(sim.phi)) * sim.v;
    const rate = (sim.v * 0.55 + slide * 2.2 + (sim.boosting ? 40 : 0)) * this.q.particles * (r.cfg.human ? 1 : 0.5);
    r.sprayAcc += rate * dt;
    const fx = Math.sin(th), fz = -Math.cos(th), rx = Math.cos(th), rz = Math.sin(th);
    const ice = (sim.surface & 1) !== 0, boost = sim.boosting || sim.padT > 0;
    let n = 0;
    while (r.sprayAcc >= 1 && n < 6) {
      r.sprayAcc -= 1; n++;
      const side = Math.random() < 0.5 ? -1 : 1, sl = Math.sign(Math.sin(sim.phi)) || side;
      const col: [number, number, number] = boost ? [0.55, 0.9, 1] : ice ? [0.8, 0.95, 1] : [1, 1, 1];
      this.sprays.emit(
        px - fx * 0.7 + rx * 0.3 * side, sim.y + 0.12, pz - fz * 0.7 + rz * 0.3 * side,
        -fx * sim.v * 0.12 + rx * ((Math.random() - 0.5) * 2.5 - sl * slide * 0.25), 0.8 + Math.random() * 2.2 + slide * 0.1, -fz * sim.v * 0.12 + rz * ((Math.random() - 0.5) * 2.5 - sl * slide * 0.25),
        0.35 + Math.random() * 0.4, 0.5 + Math.random() * 0.5, col[0], col[1], col[2]);
    }
    r.sprayAcc = Math.min(r.sprayAcc, 3);
  }

  private burst(p: THREE.Vector3, n: number, speed: number, size: number, c: [number, number, number]) {
    if (!this.nearAny(p)) return;
    const k = Math.round(n * this.q.particles);
    for (let i = 0; i < k; i++) {
      const a = Math.random() * 6.283, u = Math.random();
      this.sprays.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * speed * u, 1 + Math.random() * speed * 0.8, Math.sin(a) * speed * u, size * (0.8 + Math.random() * 0.8), 0.6 + Math.random() * 0.6, c[0], c[1], c[2]);
    }
  }
  private nearAny(p: THREE.Vector3) { return this.locals.some((l) => l.rig.cam.position.distanceToSquared(p) < 150 * 150); }
  private confetti(p: THREE.Vector3) {
    const cols: [number, number, number][] = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.85, 0.2], [0.4, 1, 0.5], [1, 0.5, 0.9]];
    for (let i = 0; i < 140 * Math.min(1, this.q.particles + 0.2); i++) {
      const a = Math.random() * 6.283, c = cols[i % cols.length];
      this.sprays.emit(p.x, p.y + 1, p.z, Math.cos(a) * 6 * Math.random(), 5 + Math.random() * 9, Math.sin(a) * 6 * Math.random(), 0.45, 1.6 + Math.random(), c[0], c[1], c[2]);
    }
  }

  private render() {
    const r = this.renderer, n = this.locals.length, W = this.viewW, H = this.viewH;
    const pr = r.getPixelRatio();
    r.setScissorTest(n > 1);
    const horizontal = W >= H;
    this.locals.forEach((l, i) => {
      let x = 0, y = 0, w = W, h = H;
      if (n > 1) { if (horizontal) { w = W / 2; x = i * w; } else { h = H / 2; y = (1 - i) * h; } }
      r.setViewport(x, y, w, h); if (n > 1) r.setScissor(x, y, w, h);
      l.rig.cam.aspect = w / h; l.rig.cam.updateProjectionMatrix();
      const sim = l.r.sim, cp = l.rig.cam.position;
      const q = this.track.query(sim.s);
      const ppx = q.x - q.tz * sim.d, ppz = q.z + q.tx * sim.d;
      this.sun.target.position.set(ppx, sim.y, ppz);
      this.sun.position.set(ppx + this.sunDir.x * 120, sim.y + this.sunDir.y * 120, ppz + this.sunDir.z * 120);
      this.sun.target.updateMatrixWorld();
      this.sky.follow(l.rig.cam);
      l.snow.setCamera(l.rig.cam, this.time, h * pr);
      // snowfall streaks with speed: base wind up to ~2.5x at top speed, +0.5x on boost
      l.snow.setWind(l.wind * (1 + clamp(sim.v / 45, 0, 1.5) + (sim.boosting || sim.padT > 0 ? 0.5 : 0)));
      void cp;
      r.render(this.scene, l.rig.cam);
    });
  }

  // ---------------- HUD ----------------
  emitHud(force: boolean) {
    void force;
    const total = this.racers.length, len = this.track.length;
    const players: PlayerHud[] = this.locals.map(({ r }) => {
      const s = r.sim;
      return {
        slot: r.cfg.slot, name: r.cfg.name, speed: Math.round(s.v * 3.6), speed01: clamp(s.v / 50, 0, 1.2), boost: s.boost, position: r.place, total,
        coins: s.coins, progress: this.endless ? 0 : clamp(s.s / len, 0, 1), distance: Math.max(0, s.s - (this.endless ? 12 : 0)), crashes: s.crashes,
        finished: s.state === 'finished', time: s.state === 'finished' ? (s.finishTime ?? s.time) : s.time, lives: r.lives, multiplier: r.mult,
        score: Math.round(r.score + s.coins * 10), boosting: s.boosting || s.padT > 0, airborne: !s.grounded, crashed: s.crashT > 0, finalPos: r.place,
      };
    });
    const racers = this.racers.map((r) => ({ name: r.cfg.name, color: r.cfg.color, progress: this.endless ? 0 : clamp(r.sim.s / len, 0, 1), human: r.cfg.human, slot: r.cfg.slot, position: r.place }));
    const toasts = this.toasts.filter((t) => this.time - t.t < 1.8).map(({ id, slot, text, kind }) => ({ id, slot, text, kind }));
    const hud: HudState = {
      phase: this.phase, countdown: clamp(Math.ceil(-this.countT), 0, 3), go: this.phase !== 'countdown' && this.goT < 0.9, time: this.raceTime,
      players, racers, toasts, fps: Math.round(this.fps), paused: this.paused, length: len, mode: this.cfg.mode, timeout: this.versusTimeout,
      envName: ENVS[this.cfg.course.env].name, courseName: this.cfg.course.name, best: 0,
    };
    this.cb.onHud(hud);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect(); window.removeEventListener('resize', this.onResize);
    input.capture = false; input.reset();
    audio.silenceLoops();
    for (const r of this.racers) { r.model.dispose(); r.trail?.dispose(); }
    for (const l of this.locals) l.snow.dispose();
    this.sprays.dispose(); this.world.dispose(); this.sky.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
