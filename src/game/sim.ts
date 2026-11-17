// Skier physics + AI controller. Pure logic, no rendering. Works in track space (s, d).
import { Track } from './track';
import { clamp, damp, lerp, mulberry32 } from './util';

export interface Input { steer: number; jump: boolean; boost: boolean; brake: boolean }
export type EvType = 'jump' | 'land' | 'hardland' | 'perfect' | 'crash' | 'hit' | 'bump' | 'barrier' | 'coin' | 'pad' | 'trick' | 'bush' | 'finish' | 'boostOn' | 'recover';
export interface SimEvent { t: EvType; v: number }

export const G = 21;
const TWO_PI = Math.PI * 2;

export class SkierSim {
  s = 0; d = 0; y = 0; vy = 0; v = 0; phi = 0; psi = 0; steerSm = 0;
  grounded = true; coyote = 0; jumpBuf = 0; airTime = 0; spin = 0; spinV = 0;
  boost = 60; padT = 0; crashT = 0; invuln = 0; hitCd = 0; barrierCd = 0; startT = 0;
  state: 'grid' | 'racing' | 'finished' = 'grid';
  time = 0; finishTime: number | null = null;
  coins = 0; crashes = 0; mistakes = 0; topSpeed = 0; dist = 0; jumps = 0;
  boosting = false; bushT = 0; surface = 0; // bit flags: 1 ice, 2 deep
  gY = 0; landT = 0; lastPad: unknown = null; lastLanding = 0; lastJumpBoost = false;
  events: SimEvent[] = [];
  topMul = 1; gripMul = 1; boostMul = 1;
  crashDur = 1.9;

  place(s: number, d: number, T: Track) {
    this.s = s; this.d = d; this.y = T.groundH(s, d); this.gY = this.y; this.vy = 0; this.v = 0;
    this.phi = 0; this.psi = 0; this.state = 'grid'; this.grounded = true;
  }
  begin() { this.state = 'racing'; this.v = 3.5; this.startT = 2.8; }
  private ev(t: EvType, v = 0) { this.events.push({ t, v }); }

  lastCause = '';
  private crash(T: Track, power = 1, cause = '') {
    this.lastCause = cause;
    this.crashT = this.crashDur; this.crashes++; this.mistakes++;
    this.v *= 0.35 * (power > 1 ? 0.7 : 1);
    this.vy = Math.max(this.vy, 4.5); this.grounded = false; this.airTime = 0;
    this.boosting = false; this.padT = 0;
    this.ev('crash', this.v);
    void T;
  }

  update(dt: number, inp: Input, T: Track, human: boolean) {
    this.events.length = 0;
    if (this.state === 'grid') { this.y = T.groundH(this.s, this.d); this.gY = this.y; return; }
    T.ensure(this.s + 600);
    this.time += this.state === 'racing' ? dt : 0;
    let { steer, jump, boost, brake } = inp;
    const finished = this.state === 'finished';
    if (finished) { steer = clamp(-this.d * 0.1 - this.phi * 1.0, -1, 1); brake = true; boost = false; jump = false; }
    if (this.crashT > 0) { steer = 0; boost = false; brake = false; jump = false; }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    if (this.barrierCd > 0) this.barrierCd -= dt;
    if (this.landT > 0) this.landT -= dt;
    this.startT = Math.max(0, this.startT - dt);

    const q = T.query(this.s);
    const hw = q.hw, kap = q.k, slope = q.slope;
    const zf = T.zoneFlags(this.s, this.d);
    this.surface = zf;
    const ice = (zf & 1) !== 0, deep = (zf & 2) !== 0;

    // --- steering ---
    const sRate = Math.abs(steer) > Math.abs(this.steerSm) && steer * this.steerSm >= 0 ? 7.5 : 12;
    this.steerSm += clamp(steer - this.steerSm, -sRate * dt, sRate * dt);
    const v = this.v;
    const maxAng = lerp(0.62, 0.34, clamp((v - 8) / 38, 0, 1)) * (brake ? 1.18 : 1);
    if (this.grounded) {
      const grip = 4.3 * this.gripMul * (ice ? 0.3 : 1) * (deep ? 0.75 : 1) * (brake ? 1.15 : 1);
      this.psi = this.steerSm * maxAng;
      this.phi += (grip * (this.psi - this.phi) - v * kap) * dt;
      this.spin *= Math.exp(-6 * dt); this.spinV = 0;
    } else {
      this.psi = this.steerSm * 0.32;
      this.phi += (1.3 * (this.psi - this.phi) - v * kap) * dt;
      const target = Math.abs(this.steerSm) > 0.6 ? this.steerSm * 7.2 : 0;
      this.spinV += clamp(target - this.spinV, -30 * dt, 30 * dt);
      this.spin += this.spinV * dt;
    }
    this.phi = clamp(this.phi, -1.25, 1.25);

    // --- boost ---
    const wantBoost = boost && this.boost > 0.5 && this.crashT <= 0;
    if (wantBoost && !this.boosting) this.ev('boostOn');
    this.boosting = wantBoost;
    if (this.boosting && this.padT <= 0) this.boost = Math.max(0, this.boost - 26 * dt);
    else if (!this.boosting && this.grounded) this.boost = Math.min(100, this.boost + 2.5 * dt);
    this.padT = Math.max(0, this.padT - dt);

    // --- longitudinal ---
    let a = 2.4 + 22 * slope;
    if (this.boosting) a += 11 * this.boostMul;
    if (this.padT > 0) a += 12;
    if (this.startT > 0) a += 4.5;
    const k = 0.0062 * (ice ? 0.78 : 1) * (deep ? 2.7 : 1) / (this.topMul * this.topMul);
    const sinP = Math.sin(this.phi);
    if (this.grounded) {
      this.v += (a - k * v * v - 0.25) * dt;
      this.v *= 1 - 0.85 * sinP * sinP * dt;
      if (brake) this.v -= 21 * dt;
      if (deep) this.v -= 2.5 * dt;
    } else {
      this.v -= 0.5 * k * v * v * dt;
      if (this.boosting) this.v += 5 * dt;
    }
    if (this.crashT > 0) this.v *= Math.exp(-1.6 * dt);
    if (finished) this.v -= 12 * dt;
    if (this.bushT > 0) { this.v *= Math.exp(-3.2 * dt); this.bushT -= dt; }
    this.v = Math.max(0, this.v);
    if (this.v > this.topSpeed) this.topSpeed = this.v;

    // --- move ---
    const oldS = this.s, oldD = this.d;
    this.s += this.v * Math.cos(this.phi) * dt;
    this.d += this.v * Math.sin(this.phi) * dt;
    this.dist += this.v * dt;
    const maxS = T.maxS - 4;
    if (this.s > maxS) { this.s = maxS; this.v = 0; }

    // --- barrier ---
    const lim = hw - 0.3;
    if (Math.abs(this.d) > lim) {
      const sg = this.d > 0 ? 1 : -1;
      this.d = sg * lim;
      const lat = this.v * Math.sin(this.phi) * sg;
      if (lat > 0) {
        if (lat > 15 && this.crashT <= 0 && this.invuln <= 0) { this.crash(T, 1, 'barrier'); this.ev('barrier', lat); }
        else if (lat > 7) {
          if (this.barrierCd <= 0) { this.mistakes += 1; this.barrierCd = 1; this.ev('barrier', lat); }
          this.v *= 1 - 0.12 * Math.min(1, lat / 12);
          this.phi = -sg * Math.abs(this.phi) * 0.35;
        } else {
          this.v *= 1 - 0.5 * dt;
          this.phi = Math.abs(this.phi) * 0.3 * -sg;
        }
      }
    }

    // --- vertical ---
    let gNew = T.groundH(this.s, this.d);
    if (this.grounded && gNew - this.y > 0.55) {
      // ran into the side of a ramp
      this.s = oldS + (this.s - oldS) * 0.5; this.d = oldD; this.phi *= -0.3; this.v *= 0.92;
      gNew = T.groundH(this.s, this.d);
      this.ev('bump', 0.5);
    }
    const gV = (gNew - this.gY) / dt;
    if (jump) this.jumpBuf = 0.14; else this.jumpBuf -= dt;
    this.coyote = this.grounded ? 0.1 : this.coyote - dt;
    if (this.crashT <= 0 && this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = clamp(this.grounded ? gV : this.vy, -9, 14) + 8.2 + (this.boosting ? 4.5 : 0);
      this.grounded = false; this.jumpBuf = 0; this.coyote = 0; this.airTime = 0; this.spin = 0; this.spinV = 0;
      this.lastJumpBoost = this.boosting;
      this.jumps++; this.ev('jump', this.boosting ? 2 : 1);
    } else if (this.grounded) {
      if (gV - this.vy < -(G * dt + 0.3) && gNew < this.y - 0.001) { this.grounded = false; this.airTime = 0; this.spin = 0; this.spinV = 0; }
      else { this.y = gNew; this.vy = clamp(gV, -35, 14); }
    }
    if (!this.grounded) {
      this.vy -= G * dt; this.y += this.vy * dt; this.airTime += dt;
      if (this.y <= gNew) this.land(gV, gNew, T);
    }
    this.gY = gNew;

    // --- zones ---
    const pad = T.padAt(this.s, this.d);
    if (pad && pad !== this.lastPad) {
      this.lastPad = pad; this.padT = 1.3; this.boost = Math.min(100, this.boost + 18); this.v += 3; this.ev('pad');
    } else if (!pad) this.lastPad = null;

    // --- obstacles ---
    if (this.invuln <= 0 && this.crashT <= 0) this.collide(T, gNew);

    // --- coins ---
    if (human) {
      for (let i = T.lbCoin(this.s - 2.5); i < T.coins.length; i++) {
        const c = T.coins[i];
        if (c.s > this.s + 2.5) break;
        if (c.taken) continue;
        if (Math.abs(c.s - this.s) < 1.7 && Math.abs(c.d - this.d) < 1.7 && Math.abs(this.y - (T.groundH(c.s, c.d) + c.y)) < 2.2) {
          c.taken = true; this.coins++; this.boost = Math.min(100, this.boost + 2); this.ev('coin', i);
        }
      }
    }

    // --- crash timer / recovery ---
    if (this.crashT > 0) {
      this.crashT -= dt;
      if (this.crashT <= 0) {
        this.v = Math.max(this.v, 7); this.phi = 0; this.psi = 0; this.steerSm = 0; this.invuln = 2.4;
        this.d = T.freeSpot(this.s, this.d);
        this.ev('recover');
      }
    }

    // --- finish ---
    if (this.state === 'racing' && !T.endless && this.s >= T.finishS) {
      const over = (this.s - T.finishS) / Math.max(this.v, 1);
      this.finishTime = this.time - over; this.state = 'finished'; this.ev('finish');
    }
  }

  private land(gV: number, gNew: number, T: Track) {
    const imp = this.vy - gV;
    this.y = gNew; this.vy = gV; this.grounded = true; this.landT = 0.45;
    const air = this.airTime;
    if (this.crashT > 0) { this.ev('land', 0.5); return; }
    if (imp < -34 && this.invuln <= 0) { this.crash(T, 1.2, 'land'); return; }
    if (imp < -16) { this.v *= 0.9; this.ev('hardland', -imp); }
    else {
      this.ev('land', -imp);
      if (imp > -5 && air > 0.5) { this.boost = Math.min(100, this.boost + 10); this.ev('perfect', air); }
    }
    if (air > 0.6) this.boost = Math.min(100, this.boost + air * 8);
    if (Math.abs(this.spin) > 1.2) {
      const n = Math.round(this.spin / TWO_PI);
      const err = Math.abs(this.spin - n * TWO_PI);
      if (n !== 0 && err < 0.95) { this.boost = Math.min(100, this.boost + 24 * Math.abs(n)); this.ev('trick', Math.abs(n)); this.spin = 0; }
      else if (err > 1.5) { this.v *= 0.82; this.mistakes++; this.ev('hit', 0.4); this.spin = Math.round(this.spin / TWO_PI) * TWO_PI; }
    }
    this.lastLanding = imp;
  }

  private collide(T: Track, gNew: number) {
    const h = this.y - gNew;
    const pr = 0.5;
    const obs = T.obstacles;
    for (let i = T.lbObs(this.s - 3.8); i < obs.length; i++) {
      const o = obs[i];
      if (o.s > this.s + 3.8) break;
      if (o.kind === 'log') {
        if (Math.abs(o.s - this.s) < 0.55 + 0.25 && this.d > o.d - o.w / 2 - 0.3 && this.d < o.d + o.w / 2 + 0.3 && h < o.h) {
          if (this.v > 15) { this.crash(T, 1, 'log'); return; }
          this.v *= 0.5; this.s = o.s - 0.9; this.mistakes++; this.ev('hit', 0.8); this.invuln = 0.6; return;
        }
        continue;
      }
      const dx = this.d - o.d, ds = this.s - o.s;
      const rr = o.r + pr;
      const dist2 = dx * dx + ds * ds;
      if (dist2 >= rr * rr) continue;
      if (h >= o.h) continue;
      const dist = Math.sqrt(dist2) || 0.01;
      const push = () => { this.d = o.d + (dx / dist) * rr * 1.02; this.s = o.s + (ds / dist) * rr * 1.02; };
      switch (o.kind) {
        case 'pine':
          if (this.v > 13) { this.crash(T, 1, 'pine'); push(); return; }
          this.v *= 0.4; this.mistakes++; push(); this.ev('hit', 1); this.invuln = 0.5; return;
        case 'rock':
          if (this.v > 9) { this.crash(T, 1, 'rock'); push(); return; }
          this.v *= 0.45; this.mistakes++; push(); this.ev('hit', 1); this.invuln = 0.5; return;
        case 'smallRock':
          if (this.hitCd <= 0) {
            this.v *= 0.8; this.vy += 3.6; this.grounded = false; this.mistakes++; this.hitCd = 0.5; this.ev('bump', 1);
          }
          break;
        case 'bush':
          if (this.bushT <= 0) this.ev('bush');
          this.bushT = 0.12; break;
      }
    }
  }
}

// ================= AI =================
export interface Personality { skill: number; aggr: number; caution: number; jump: number; boost: number }

export class AIDriver {
  dT = 0; timer = 0; mistakeT = 0; mistakeOff = 0; noise = 0; boostOn = false; best = 0; bestCost = 0;
  rng: () => number; p: Personality; skill: number; jumpCd = 0;
  private obs: { s: number; d: number; r: number; log: boolean; w: number }[] = [];

  constructor(p: Personality, skill: number, seed: number) {
    this.p = p; this.skill = skill; this.rng = mulberry32(seed);
  }

  control(sim: SkierSim, T: Track, others: SkierSim[], dt: number): Input {
    const out: Input = { steer: 0, jump: false, boost: false, brake: false };
    if (sim.state === 'grid') return out;
    const { skill, p } = this;
    const rng = this.rng;
    const q = T.query(sim.s);
    const hw = q.hw, s = sim.s, d = sim.d, v = sim.v;
    const lim = Math.max(1.5, hw - 1.5);
    this.jumpCd -= dt;

    // mistakes
    if (this.mistakeT > 0) this.mistakeT -= dt;
    else if (sim.crashT <= 0 && rng() < ((1 - skill) * 0.07 + 0.008) * dt) {
      this.mistakeT = 0.4 + rng() * 0.5; this.mistakeOff = (rng() < 0.5 ? -1 : 1) * hw * (0.3 + rng() * 0.4);
    }
    this.noise += (-this.noise * 2 * dt) + (rng() - 0.5) * 2 * 3 * dt * (1 - skill);

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.05 + (1 - skill) * 0.06;
      const Ls = 16 + v * 1.45 * (0.6 + 0.4 * skill) * (1 + p.caution * 0.15);
      // gather obstacles in lookahead
      const obs = this.obs; obs.length = 0;
      for (let i = T.lbObs(s - 1); i < T.obstacles.length; i++) {
        const o = T.obstacles[i];
        if (o.s > s + Ls) break;
        obs.push({ s: o.s, d: o.d, r: o.r, log: o.kind === 'log', w: o.w });
      }
      const kA = T.query(Math.min(s + Ls * 0.6, T.maxS)).k;
      const corr = T.corridorAt(Math.min(s + Ls * 0.5, T.maxS));
      const dLine = clamp(kA * hw * 45, -hw * 0.6, hw * 0.6);
      const lineW = 0.2 * (0.4 + skill) * (1.1 - p.aggr * 0.3);
      const step = Math.max(0.7, (2 * lim) / 22);
      let best = Infinity, bd = d;
      const marg = 1.0 + p.caution * 0.8 + (1 - skill) * 0.4;
      const vlat = Math.max(v, 9) * 0.3 * (0.6 + 0.4 * skill);
      for (let dc = -lim; dc <= lim + 0.01; dc += step) {
        let cost = (corr === null ? 0 : 0.2 * Math.abs(dc - corr)) + 2.5 * Math.pow(Math.abs(dc) / hw, 4) + Math.abs(dc - dLine) * lineW + Math.abs(dc - d) * 0.07 + Math.abs(dc - this.dT) * 0.05;
        for (let i = 0; i < obs.length; i++) {
          const o = obs[i];
          const fr = 1 - clamp((o.s - s) / Ls, 0, 1) * 0.5;
          const tt = Math.max(0, o.s - s) / Math.max(v, 9);
          const reach = vlat * tt;
          const pos = d + clamp(dc - d, -reach, reach);
          if (o.log) {
            if (pos > o.d - o.w / 2 - 0.6 && pos < o.d + o.w / 2 + 0.6) cost += (p.jump > 0.25 ? 7 : 50) * fr;
          } else {
            const gap = Math.abs(pos - o.d) - (o.r + marg);
            if (gap < 0) cost += 60 * fr; else if (gap < 1.3) cost += (1.3 - gap) * 6 * fr;
          }
        }
        // zones & ramps
        for (let i = T.zones.length > 0 ? 0 : 0, n = T.zones.length; i < n; i++) {
          const z = T.zones[i];
          if (z.s1 < s) continue;
          if (z.s0 > s + Ls) break;
          if (dc >= z.d0 && dc <= z.d1) {
            if (z.type === 'ice') cost += 7 * (0.3 + p.caution);
            else if (z.type === 'deep') cost += 13;
            else cost -= 7 * (0.4 + p.aggr);
          }
        }
        for (let i = 0; i < T.ramps.length; i++) {
          const r = T.ramps[i];
          if (r.s + r.len < s) continue;
          if (r.s > s + Ls) break;
          if (dc >= r.d0 - 0.5 && dc <= r.d1 + 0.5) cost += p.jump > 0.55 ? -6 * p.jump : 5 + (1 - p.jump) * 8;
        }
        // other skiers ahead
        for (const o of others) {
          if (o === sim || o.state === 'grid') continue;
          const ds = o.s - s;
          if (ds > -1.5 && ds < 16 && Math.abs(dc - o.d) < 1.8) cost += (12 + (1 - p.aggr) * 14) * (1 - ds / 20) * (o.crashT > 0 ? 3 : 1);
        }
        if (cost < best) { best = cost; bd = dc; }
      }
      if (best > 28) { const cf = T.corridorAt(Math.min(s + Ls * 0.35, T.maxS)); if (cf !== null) bd = clamp(cf, -lim, lim); }
      this.best = bd; this.bestCost = best;
    }
    let target = this.best;
    if (this.mistakeT > 0) target = clamp(d + this.mistakeOff, -lim, lim);
    this.dT = damp(this.dT, target, 7, dt);

    // steering controller
    const vv = Math.max(v, 6);
    const err = this.dT - d;
    const vdDes = clamp(err * 1.7, -0.62 * vv, 0.62 * vv);
    const phiDes = Math.asin(clamp(vdDes / vv, -0.92, 0.92));
    const grip = 4.3 * sim.gripMul * (sim.surface & 1 ? 0.3 : 1);
    const maxAng = lerp(0.62, 0.34, clamp((v - 8) / 38, 0, 1));
    const psiDes = phiDes + (v * q.k) / grip;
    out.steer = clamp(psiDes / maxAng + this.noise * 0.12, -1, 1);

    // jumping over logs
    if (sim.grounded && this.jumpCd <= 0) {
      for (let i = T.lbObs(s); i < T.obstacles.length; i++) {
        const o = T.obstacles[i];
        const dist = o.s - s;
        if (dist > v * 0.6 + 4) break;
        if (o.kind !== 'log') continue;
        if (d > o.d - o.w / 2 - 0.4 && d < o.d + o.w / 2 + 0.4) {
          const jit = 1 + (rng() - 0.5) * (1 - skill) * 0.7;
          if (dist < v * 0.4 * jit && dist > v * 0.2 * jit) { out.jump = true; this.jumpCd = 0.9; break; }
        }
      }
    }
    // braking
    const kAhead = Math.abs(T.query(Math.min(s + 40, T.maxS)).k);
    if (this.bestCost > 55 && v > 17 + skill * 6) out.brake = true;
    if (kAhead > 0.0105 && v > 36 + skill * 8 + p.aggr * 6 && p.caution > 0.4) out.brake = true;
    if (Math.abs(err) > hw * 0.9 && v > 22) out.brake = true;

    // boost
    const straight = Math.abs(q.k) < 0.008 && this.bestCost < 25 && Math.abs(sim.phi) < 0.2;
    if (!this.boostOn && sim.boost > 100 - 70 * p.boost && straight && sim.grounded) this.boostOn = true;
    if (this.boostOn && (sim.boost < 8 || !straight)) this.boostOn = false;
    out.boost = this.boostOn;
    return out;
  }
}
