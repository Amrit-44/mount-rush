// Procedural downhill track. Pure data + queries (no rendering). Track space: s = distance along centreline, d = lateral offset (+ = right).
import { ENVS, EnvDef, EnvId, SectionType } from './data';
import { approach, clamp, lerp, mulberry32, smoothstep } from './util';

export const DS = 2; // sample spacing (m)
export type ObsKind = 'pine' | 'rock' | 'smallRock' | 'bush' | 'log';
export interface Obstacle { kind: ObsKind; s: number; d: number; r: number; h: number; w: number; rot: number; sc: number }
export interface Decor { kind: 'pine' | 'rock' | 'bush'; s: number; d: number; sc: number; rot: number; col: number }
export interface Ramp { s: number; len: number; h: number; d0: number; d1: number }
export interface Zone { type: 'ice' | 'deep' | 'boost'; s: number; s0: number; s1: number; d0: number; d1: number }
export interface Coin { s: number; d: number; y: number; taken: boolean }
export type SignKind = 'jump' | 'narrow' | 'curveL' | 'curveR' | 'ice' | 'bridge' | 'dist' | 'steep' | 'deep';
export interface SignDef { kind: SignKind; s: number; d: number; label?: string }
export interface Bridge { s0: number; s1: number }
export interface TrackOpts { envId: EnvId; seed: number; length: number; curve: number; density: number; endless?: boolean; coinMul?: number }

export interface Q {
  s: number; x: number; y: number; z: number; tx: number; tz: number; th: number;
  hw: number; k: number; slope: number; bank: number; rough: number; canyon: number;
}

const MIN_LEN: Record<string, number> = { bridge: 210, split: 230, jumps: 180, narrow: 120 };
const CH = 2.7; // half width of the guaranteed-clear corridor

function lowerBound<T extends { s: number }>(arr: T[], s: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < s) lo = m + 1; else hi = m; }
  return lo;
}

export class Track {
  env: EnvDef; envId: EnvId; opts: TrackOpts; rng: () => number; endless: boolean;
  length: number; finishS: number; finishStart: number;
  X: number[] = []; Y: number[] = []; Z: number[] = []; TH: number[] = [];
  HW: number[] = []; K: number[] = []; SL: number[] = []; BK: number[] = []; RG: number[] = []; CN: number[] = [];
  n = 0; kappa = 0; theta = 0; x = 0; y = 800; z = 0; slope = 0.1; hw = 11; rough = 0; canyon = 0;
  genS = 0; done = false; lastType: string = ''; lastSign = 1;
  obstacles: Obstacle[] = []; decor: Decor[] = []; ramps: Ramp[] = []; zones: Zone[] = [];
  coins: Coin[] = []; signs: SignDef[] = []; bridges: Bridge[] = [];
  cor: { s: number; c: number }[] = []; cc = 0;
  q: Q = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: -1, th: 0, hw: 10, k: 0, slope: 0, bank: 0, rough: 0, canyon: 0 };
  sections = 0;

  constructor(opts: TrackOpts) {
    this.opts = opts; this.envId = opts.envId; this.env = ENVS[opts.envId];
    this.rng = mulberry32(opts.seed);
    this.endless = !!opts.endless;
    this.length = this.endless ? Infinity : opts.length;
    this.finishS = this.length;
    this.finishStart = this.length - 150;
    this.hw = this.env.baseHw + 2; this.slope = this.env.baseSlope * 0.8;
    this.storeSample();
    this.ensure(500);
  }

  get maxS() { return (this.n - 1) * DS; }

  private storeSample() {
    this.X.push(this.x); this.Y.push(this.y); this.Z.push(this.z); this.TH.push(this.theta);
    this.HW.push(this.hw); this.K.push(this.kappa); this.SL.push(this.slope);
    this.BK.push(clamp(-this.kappa * 9, -0.12, 0.12)); this.RG.push(this.rough); this.CN.push(this.canyon);
    this.n++;
  }
  private push(kT: number, slT: number, hwT: number, rgT: number, cnT: number) {
    this.kappa = approach(this.kappa, kT, 0.00035 * DS);
    this.theta += this.kappa * DS;
    this.x += Math.sin(this.theta) * DS; this.z -= Math.cos(this.theta) * DS;
    this.slope = approach(this.slope, slT, 0.0016 * DS);
    this.y -= this.slope * DS;
    this.hw = approach(this.hw, hwT, 0.09 * DS);
    this.rough = approach(this.rough, rgT, 0.01 * DS);
    this.canyon = approach(this.canyon, cnT, 0.22 * DS);
    this.storeSample();
  }

  ensure(sEnd: number) {
    while (!this.done && this.genS < sEnd) this.genSection();
  }

  // ---------- queries ----------
  query(s: number): Q {
    const q = this.q;
    const mx = (this.n - 1) * DS;
    if (s < 0) s = 0; else if (s > mx) s = mx;
    const f = s / DS; let i = Math.floor(f); if (i >= this.n - 1) i = this.n - 2;
    const t = f - i, j = i + 1;
    q.s = s;
    q.x = lerp(this.X[i], this.X[j], t); q.y = lerp(this.Y[i], this.Y[j], t); q.z = lerp(this.Z[i], this.Z[j], t);
    q.th = lerp(this.TH[i], this.TH[j], t); q.tx = Math.sin(q.th); q.tz = -Math.cos(q.th);
    q.hw = lerp(this.HW[i], this.HW[j], t); q.k = lerp(this.K[i], this.K[j], t); q.slope = lerp(this.SL[i], this.SL[j], t);
    q.bank = lerp(this.BK[i], this.BK[j], t); q.rough = lerp(this.RG[i], this.RG[j], t); q.canyon = lerp(this.CN[i], this.CN[j], t);
    return q;
  }
  private bump(s: number, d: number) { return 0.2 * Math.sin(s * 0.29 + d * 0.2) * Math.cos(d * 0.37 - s * 0.09); }

  rampH(s: number, d: number): number {
    const rs = this.ramps;
    if (!rs.length) return 0;
    let h = 0;
    for (let i = lowerBound(rs, s - 30); i < rs.length; i++) {
      const r = rs[i];
      if (r.s > s) break;
      const u = (s - r.s) / r.len;
      if (u < 0 || u > 1.25) continue;
      let f: number;
      if (u <= 1) f = (u < 0.12 ? (u * u) / 0.24 : u - 0.06) / 0.94;
      else f = Math.max(0, 1 - (u - 1) / 0.25);
      const w = smoothstep(r.d0 - 0.2, r.d0 + 1.0, d) * smoothstep(r.d1 + 0.2, r.d1 - 1.0, d);
      h = Math.max(h, f * r.h * w);
    }
    return h;
  }
  /** Surface height used by physics (includes ramps). */
  groundH(s: number, d: number): number {
    const q = this.query(s);
    return q.y + q.bank * d + q.rough * this.bump(s, d) + this.rampH(s, d);
  }
  /** Surface height without ramps (used for terrain mesh). */
  baseH(s: number, d: number): number {
    const q = this.query(s);
    return q.y + q.bank * d + q.rough * this.bump(s, d);
  }
  private nz(s: number, d: number) {
    return Math.sin(s * 0.021 + d * 0.05) * 0.5 + Math.sin(s * 0.047 - d * 0.031 + 1.7) * 0.3 + Math.sin(s * 0.0113 + d * 0.09 + 4) * 0.2;
  }
  terrainH(s: number, d: number): number {
    const q = this.query(s);
    const hw = q.hw, ad = Math.abs(d), sg = d < 0 ? -1 : 1;
    if (ad <= hw) return q.y + q.bank * d + q.rough * this.bump(s, d);
    const off = ad - hw, env = this.env;
    let h = q.y + q.bank * sg * hw + q.rough * this.bump(s, sg * hw);
    h += 0.95 * smoothstep(0, 0.7, off) * (1 - smoothstep(0.7, 3.2, off));
    if (q.canyon > 0.01) h -= q.canyon * smoothstep(0.2, 2.4, off) * (1 - smoothstep(2.4, 24, off));
    const w = Math.max(0, off - 4.5);
    h += Math.min(env.wallMax, env.wallK * Math.pow(w, 1.12));
    h += env.noiseAmp * smoothstep(2, 18, off) * this.nz(s, d);
    return h;
  }
  /** world position for track coords (y supplied by caller) */
  wx(s: number, d: number) { const q = this.query(s); return q.x - q.tz * d; }
  wz(s: number, d: number) { const q = this.query(s); return q.z + q.tx * d; }

  lbObs(s: number) { return lowerBound(this.obstacles, s); }
  lbCoin(s: number) { return lowerBound(this.coins, s); }

  zoneFlags(s: number, d: number): number {
    let f = 0;
    const zs = this.zones;
    for (let i = lowerBound(zs, s - 80); i < zs.length; i++) {
      const z = zs[i];
      if (z.s0 > s) break;
      if (s <= z.s1 && d >= z.d0 && d <= z.d1) f |= z.type === 'ice' ? 1 : z.type === 'deep' ? 2 : 4;
    }
    return f;
  }
  padAt(s: number, d: number): Zone | null {
    const zs = this.zones;
    for (let i = lowerBound(zs, s - 80); i < zs.length; i++) {
      const z = zs[i];
      if (z.s0 > s) break;
      if (z.type === 'boost' && s <= z.s1 && d >= z.d0 && d <= z.d1) return z;
    }
    return null;
  }
  corridorAt(s: number): number | null {
    const c = this.cor;
    if (!c.length) return null;
    for (let i = c.length - 1; i >= 0; i--) {
      if (c[i].s <= s) {
        const nx = c[i + 1];
        if (!nx) return s - c[i].s < 60 ? c[i].c : null;
        return lerp(c[i].c, nx.c, clamp((s - c[i].s) / Math.max(0.01, nx.s - c[i].s), 0, 1));
      }
      if (i === 0) return c[0].s - s < 60 ? c[0].c : null;
    }
    return null;
  }
  freeSpot(s: number, d: number): number {
    const hw = this.query(s).hw;
    const offs = [0, 2, -2, 4, -4, 6, -6, 8, -8];
    for (const o of offs) {
      const dd = clamp(d + o, -hw + 1.2, hw - 1.2);
      let ok = true;
      for (let i = this.lbObs(s - 6); i < this.obstacles.length; i++) {
        const ob = this.obstacles[i];
        if (ob.s > s + 6) break;
        if (ob.kind === 'log') { if (Math.abs(ob.s - s) < 1.5 && dd > ob.d - ob.w / 2 - 0.5 && dd < ob.d + ob.w / 2 + 0.5) ok = false; }
        else if (Math.hypot(ob.s - s, ob.d - dd) < ob.r + 1.6) ok = false;
        if (!ok) break;
      }
      if (ok) return dd;
    }
    return d;
  }

  // ---------- generation ----------
  private dens(s: number) {
    if (this.endless) return clamp(0.2 + 0.75 * Math.min(1, s / 7500), 0, 0.95);
    const prog = clamp(s / this.length, 0, 1);
    return clamp(this.opts.density * (0.75 + 0.45 * prog), 0.05, 0.95);
  }
  private pickType(): SectionType {
    const w = { ...this.env.weights };
    if (this.lastType in w) w[this.lastType as SectionType] *= 0.15;
    if (this.endless) { const p = Math.min(1, this.genS / 6000); w.jumps *= 1 + p; w.narrow *= 1 + p; w.curves *= 1 + p * 0.5; }
    let tot = 0; for (const k in w) tot += w[k as SectionType];
    let r = this.rng() * tot;
    for (const k in w) { r -= w[k as SectionType]; if (r <= 0) return k as SectionType; }
    return 'cruise';
  }
  private kSegments(type: string, nSamples: number, dens: number) {
    const rng = this.rng, segs: { n: number; k: number }[] = [];
    const cv = this.opts.curve;
    let left = nSamples;
    const gentle = ['jumps', 'narrow', 'bridge', 'split', 'ice', 'sprint', 'start', 'logs', 'deep'].includes(type);
    while (left > 0) {
      let n = Math.round((type === 'curves' ? 55 + rng() * 40 : 45 + rng() * 60) / DS);
      n = Math.min(n, left);
      let k = 0;
      if (type === 'bridge' || type === 'start' || type === 'split') k = 0;
      else if (type === 'curves') {
        const mag = lerp(0.0075, 0.0132, clamp(cv * (0.6 + dens * 0.6), 0, 1)) * (0.8 + rng() * 0.3);
        const sg = Math.abs(this.theta) > 0.9 ? -Math.sign(this.theta) : -this.lastSign;
        k = mag * sg; this.lastSign = sg;
      } else if (gentle) {
        k = rng() < 0.45 ? 0 : (rng() < 0.5 ? -1 : 1) * (0.002 + rng() * 0.003) * (0.5 + cv);
      } else {
        k = rng() < 0.3 ? 0 : (rng() < 0.5 ? -1 : 1) * (0.002 + rng() * 0.005) * (0.5 + cv);
        if (Math.abs(this.theta) > 0.9) k = -Math.sign(this.theta) * Math.abs(k || 0.004);
      }
      segs.push({ n, k }); left -= n;
    }
    return segs;
  }

  private genSection() {
    const rng = this.rng, env = this.env;
    const a = this.genS;
    const toFinish = this.endless ? Infinity : this.finishStart - a;
    if (toFinish <= 0) { this.genFinish(); return; }
    let type: SectionType | 'start' = a === 0 ? 'start' : this.pickType();
    let len = type === 'start' ? 120 : 150 + rng() * 120;
    if (type === 'bridge') len = 220; if (type === 'split') len = 240; if (type === 'jumps') len = 200 + rng() * 80;
    if (type === 'narrow') len = 140 + rng() * 80;
    if (toFinish < len + 70) {
      len = toFinish;
      if (type !== 'start' && len < (MIN_LEN[type] ?? 60)) type = 'cruise';
    }
    len = Math.max(DS * 10, Math.round(len / DS) * DS);
    const dens = this.dens(a);
    const prog = this.endless ? Math.min(1, a / 8000) : 0;

    const base = env.baseHw;
    let hwT = base, slT = env.baseSlope + (rng() - 0.5) * 0.05 + prog * 0.05, rgT = 0.25;
    switch (type) {
      case 'start': hwT = base + 2; slT = env.baseSlope * 0.9; rgT = 0; break;
      case 'cruise': hwT = base * (0.95 + rng() * 0.15); break;
      case 'curves': hwT = base * 1.05; break;
      case 'forest': hwT = base * 0.88; rgT = 0.5; break;
      case 'logs': hwT = base * 0.95; rgT = 0.3; break;
      case 'jumps': hwT = base * 1.0; slT = env.baseSlope * 0.62; rgT = 0; break;
      case 'narrow': hwT = Math.max(5.4, base * 0.6); slT = env.baseSlope + 0.02; break;
      case 'rocks': hwT = base * 0.95; rgT = 0.6; break;
      case 'ice': hwT = base * 1.0; slT = env.baseSlope - 0.01; break;
      case 'deep': hwT = base * 1.05; slT = env.baseSlope - 0.01; break;
      case 'bridge': hwT = 6.2; slT = env.baseSlope * 0.85; rgT = 0; break;
      case 'split': hwT = Math.min(base + 4, 16); slT = env.baseSlope * 0.9; rgT = 0.1; break;
      case 'sprint': hwT = base * 1.05; slT = env.baseSlope + 0.07; rgT = 0.05; break;
    }
    slT = clamp(slT, 0.07, 0.36);
    const nS = len / DS;
    const segs = this.kSegments(type, nS, dens);
    let si = 0, left = segs[0].n;
    for (let j = 0; j < nS; j++) {
      const ls = j * DS;
      const cnT = type === 'bridge' && ls > 20 && ls < len - 40 ? 14 : 0;
      this.push(segs[si].k, slT, hwT, rgT, cnT);
      if (--left <= 0 && si < segs.length - 1) { si++; left = segs[si].n; }
    }
    this.sections++;
    this.lastType = type;
    const b = a + len;
    this.genFeatures(type, a, b, dens);
    this.genS = (this.n - 1) * DS;
  }

  private genFinish() {
    const a = this.genS;
    const nS = Math.round(450 / DS);
    for (let j = 0; j < nS; j++) this.push(0, Math.min(0.14, this.env.baseSlope), Math.max(this.env.baseHw, 11), 0, 0);
    const b = a + 450;
    this.scenery(a, b, 0.7);
    this.markers(a, b);
    this.decor.sort((p, q) => p.s - q.s);
    // spectators near the finish are added in the world builder
    this.done = true;
    this.genS = (this.n - 1) * DS;
  }

  private markers(a: number, b: number) {
    if (this.endless) {
      for (let m = Math.ceil(a / 500) * 500; m < b; m += 500) if (m > 0) this.addSign('dist', m, 1, `${m} m`);
      return;
    }
    for (const rem of [1000, 500, 300, 200, 100]) {
      const s = this.length - rem;
      if (s >= a && s < b && s > 20) this.addSign('dist', s, 1, `${rem} m`);
    }
  }
  private addSign(kind: SignKind, s: number, side: number, label?: string) {
    const hw = this.query(s).hw;
    this.signs.push({ kind, s, d: side * (hw + 2.1), label });
  }

  private addCor(s: number, c: number) {
    const arr = this.cor;
    let i = arr.length;
    while (i > 0 && arr[i - 1].s > s) i--;
    arr.splice(i, 0, { s, c });
  }
  private corridorStep(s: number, sp: number, hw: number) {
    this.cc += (this.rng() - 0.5) * 2 * Math.min(0.3 * sp, hw * 0.6);
    const lim = Math.max(0, hw - 3.4);
    this.cc = clamp(this.cc, -lim, lim);
    this.addCor(s, this.cc);
  }
  private blocked(s: number, d: number, r: number): boolean {
    const c = this.corridorAt(s);
    return c !== null && Math.abs(d - c) < CH + r;
  }
  private addObs(list: Obstacle[], kind: ObsKind, s: number, d: number, extra?: Partial<Obstacle>) {
    const rng = this.rng;
    let o: Obstacle;
    switch (kind) {
      case 'pine': o = { kind, s, d, r: 0.7, h: 9, w: 0, rot: rng() * 6.28, sc: 0.9 + rng() * 0.7 }; break;
      case 'rock': { const r = 1.3 + rng() * 1.1; o = { kind, s, d, r, h: 2.6, w: 0, rot: rng() * 6.28, sc: r }; break; }
      case 'smallRock': { const r = 0.5 + rng() * 0.2; o = { kind, s, d, r, h: 0.55, w: 0, rot: rng() * 6.28, sc: r }; break; }
      case 'bush': { const r = 0.85 + rng() * 0.3; o = { kind, s, d, r, h: 0.9, w: 0, rot: rng() * 6.28, sc: r }; break; }
      default: o = { kind: 'log', s, d, r: 0.4, h: 0.85, w: 4, rot: 0, sc: 1 };
    }
    list.push(Object.assign(o, extra));
  }

  private pickKind(type: string): ObsKind {
    const r = this.rng();
    switch (type) {
      case 'forest': return r < 0.7 ? 'pine' : r < 0.82 ? 'bush' : r < 0.93 ? 'smallRock' : 'rock';
      case 'rocks': return r < 0.35 ? 'rock' : r < 0.7 ? 'smallRock' : 'bush';
      case 'narrow': return r < 0.5 ? 'rock' : r < 0.8 ? 'smallRock' : 'pine';
      case 'logs': return r < 0.4 ? 'bush' : r < 0.7 ? 'smallRock' : 'pine';
      default: return r < 0.35 ? 'pine' : r < 0.55 ? 'bush' : r < 0.8 ? 'smallRock' : 'rock';
    }
  }

  private rows(type: string, a: number, b: number, dens: number, skip: (s: number) => boolean, rate = 1) {
    const rng = this.rng;
    const out: Obstacle[] = [];
    let s = a + 6 + rng() * 10;
    while (s < b - 4) {
      const sp = lerp(21, 10.5, dens) * (0.8 + rng() * 0.5) / rate;
      const hw = this.query(s).hw;
      this.corridorStep(s, sp, hw);
      if (!skip(s)) {
        const n = 1 + Math.floor(rng() * (1.6 + dens * 4 * rate));
        const rowItems: Obstacle[] = [];
        for (let i = 0; i < n; i++) {
          const kind = this.pickKind(type);
          const tmp: Obstacle[] = []; this.addObs(tmp, kind, s + (rng() - 0.5) * 3, 0);
          const o = tmp[0];
          for (let t = 0; t < 5; t++) {
            const d = (rng() * 2 - 1) * (hw - o.r - 0.7);
            if (this.blocked(o.s, d, o.r)) continue;
            if (rowItems.some((p) => Math.hypot(p.s - o.s, p.d - d) < p.r + o.r + 1.8)) continue;
            o.d = d; rowItems.push(o); break;
          }
          if (o.d !== 0 || rowItems.includes(o)) { /* placed */ }
        }
        if (type === 'narrow' || (type === 'rocks' && rng() < 0.4)) {
          for (const sg of [-1, 1]) {
            const tmp: Obstacle[] = []; this.addObs(tmp, 'rock', s + (rng() - 0.5) * 2, 0);
            const o = tmp[0]; o.d = sg * (hw - 0.9 - o.r * 0.3);
            if (!this.blocked(o.s, o.d, o.r)) rowItems.push(o);
          }
        }
        if (type === 'logs' || (type === 'forest' && rng() < 0.18)) {
          if (rng() < 0.6 + dens * 0.2) {
            const c = this.cc;
            const full = dens > 0.5 && rng() < 0.4;
            const ls = s + 8;
            if (!skip(ls) && !rowItems.some((p) => Math.abs(p.s - ls) < 5)) {
              this.addSign('jump', ls - 45, 1); this.addSign('jump', ls - 45, -1);
              if (full) { const tmp: Obstacle[] = []; this.addObs(tmp, 'log', ls, 0, { d: 0, w: hw * 2 - 0.4 }); rowItems.push(tmp[0]); }
              else {
                const L = -hw + 0.2, R = hw - 0.2;
                const gapL = c - CH + 0.3, gapR = c + CH - 0.3;
                if (gapL - L > 2) { const tmp: Obstacle[] = []; this.addObs(tmp, 'log', ls, (L + gapL) / 2, { w: gapL - L }); rowItems.push(tmp[0]); }
                if (R - gapR > 2) { const tmp: Obstacle[] = []; this.addObs(tmp, 'log', ls, (gapR + R) / 2, { w: R - gapR }); rowItems.push(tmp[0]); }
              }
            }
          }
        }
        for (const o of rowItems) out.push(o);
      }
      s += sp;
    }
    return out;
  }

  private coinTrail(a: number, b: number, prob: number, skip: (s: number) => boolean) {
    const rng = this.rng, out: Coin[] = [];
    let s = a + 20;
    const mul = this.opts.coinMul ?? 1;
    while (s < b - 30) {
      if (rng() < prob * mul && !skip(s)) {
        const n = 5 + Math.floor(rng() * 5);
        const zig = rng() < 0.5 ? 1.1 : 0;
        for (let i = 0; i < n; i++) {
          const cs = s + i * 3.6;
          if (skip(cs)) continue;
          const c = this.corridorAt(cs);
          out.push({ s: cs, d: (c ?? 0) + Math.sin(i * 0.9) * zig, y: 0.9, taken: false });
        }
        s += n * 3.6 + 20;
      } else s += 24;
    }
    return out;
  }

  private genFeatures(type: string, a: number, b: number, dens: number) {
    const rng = this.rng, env = this.env;
    const obs: Obstacle[] = []; let coins: Coin[] = [];
    const ramps: Ramp[] = [], zones: Omit<Zone, 's'>[] = [];
    const hwAt = (s: number) => this.query(s).hw;
    const rampSkip = (s: number) => ramps.some((r) => s > r.s - 10 && s < r.s + r.len + 55);
    let sceneMul = 1;

    if (type === 'start') { sceneMul = 0.6; this.addCor(a, 0); this.addCor(b, 0); }
    else if (type === 'jumps') {
      const nR = 2 + (dens > 0.45 ? 1 : 0) + (rng() < 0.4 ? 1 : 0);
      let s = a + 45;
      for (let i = 0; i < nR && s < b - 70; i++) {
        const hw = hwAt(s);
        const len = this.envId === 'peak' ? 12 : 10;
        const h = this.envId === 'peak' ? 3.4 + rng() * 1.0 : this.envId === 'valley' ? 3.0 + rng() * 0.8 : 2.5 + rng() * 0.6;
        const full = rng() < 0.55;
        let d0 = -hw + 0.8, d1 = hw - 0.8;
        if (!full) { if (rng() < 0.5) d1 = hw * 0.1; else d0 = -hw * 0.1; }
        ramps.push({ s, len, h, d0, d1 });
        this.addSign('jump', s - 55, 1); this.addSign('jump', s - 55, -1);
        // air coins
        for (let k = 0; k < 6; k++) coins.push({ s: s + len + 4 + k * 3.4, d: (d0 + d1) / 2, y: 2.6 + Math.sin((k / 5) * Math.PI) * 1.4, taken: false });
        s += len + 70 + rng() * 40;
      }
      obs.push(...this.rows(type, a, b, dens * 0.6, rampSkip));
      this.ramps.push(...ramps);
      this.ramps.sort((p, q) => p.s - q.s);
    } else if (type === 'sprint') {
      obs.push(...this.rows(type, a, b, dens * 0.45, () => false));
      for (let s = a + 30; s < b - 60; s += 55 + rng() * 25) {
        const c = this.corridorAt(s + 3) ?? 0;
        zones.push({ type: 'boost', s0: s, s1: s + 7, d0: c - 2.2, d1: c + 2.2 });
      }
    } else if (type === 'ice') {
      this.addSign('ice', a + 25, 1);
      obs.push(...this.rows(type, a, b, dens * 0.55, () => false));
      for (let s = a + 55; s < b - 70; s += 85 + rng() * 25) {
        const hw = hwAt(s), len = 38 + rng() * 25, side = rng();
        zones.push({ type: 'ice', s0: s, s1: s + len, d0: side < 0.35 ? -hw : -hw * 0.1, d1: side < 0.35 ? hw * 0.1 : hw });
        if (side > 0.7) zones[zones.length - 1].d0 = -hw;
      }
    } else if (type === 'deep') {
      this.addSign('deep', a + 25, 1);
      obs.push(...this.rows(type, a, b, dens * 0.55, () => false));
      for (let s = a + 55; s < b - 70; s += 80 + rng() * 25) {
        const hw = hwAt(s), len = 30 + rng() * 25, left = rng() < 0.5;
        zones.push({ type: 'deep', s0: s, s1: s + len, d0: left ? -hw : -hw * 0.15, d1: left ? hw * 0.15 : hw });
      }
    } else if (type === 'bridge') {
      const s0 = a + 90, s1 = a + 160;
      this.bridges.push({ s0, s1 });
      this.addSign('bridge', a + 20, 1); this.addSign('bridge', a + 20, -1);
      this.addCor(a, 0); this.addCor(b, 0);
      this.addSign('narrow', a + 35, 1);
      for (let s = a + 25; s < a + 55; s += 28) obs.push(...this.rows('cruise', s, s + 20, 0.2, () => false));
      sceneMul = 0.15;
    } else if (type === 'split') {
      const hw = hwAt(a + 100);
      this.addCor(a, 0); this.addCor(b, 0);
      this.addSign('curveL', a + 20, 1, 'SPLIT'); 
      // island
      for (let s = a + 40; s < a + 170; s += 6 + rng() * 2) {
        const tmp: Obstacle[] = [];
        this.addObs(tmp, rng() < 0.55 ? 'rock' : 'pine', s, (rng() - 0.5) * 1.0);
        tmp[0].r = Math.min(tmp[0].r, 1.6); obs.push(tmp[0]);
      }
      const rs = a + 85;
      ramps.push({ s: rs, len: 10, h: 3.2, d0: -hw + 1.2, d1: -3.6 });
      this.ramps.push(...ramps);
      zones.push({ type: 'boost', s0: rs - 25, s1: rs - 18, d0: -hw * 0.65 - 2, d1: -hw * 0.65 + 2 });
      zones.push({ type: 'ice', s0: rs + 50, s1: rs + 78, d0: -hw, d1: -3 });
      zones.push({ type: 'deep', s0: a + 70, s1: a + 130, d0: 3.4, d1: hw });
      for (let s = a + 55; s < a + 160; s += 22 + rng() * 10) {
        const tmp: Obstacle[] = []; this.addObs(tmp, rng() < 0.5 ? 'bush' : 'smallRock', s, 4.5 + rng() * (hw - 8));
        obs.push(tmp[0]);
      }
      for (let k = 0; k < 7; k++) coins.push({ s: a + 80 + k * 4, d: 7 + (hw - 9) * 0.4, y: 0.9, taken: false });
      for (let k = 0; k < 6; k++) coins.push({ s: rs + 14 + k * 3.4, d: (-hw + 1.2 - 3.6) / 2, y: 2.4 + Math.sin((k / 5) * Math.PI) * 1.3, taken: false });
      this.addSign('jump', rs - 50, -1);
      obs.push(...this.rows('cruise', a + 175, b, dens * 0.5, () => false));
      this.ramps.sort((p, q) => p.s - q.s);
      sceneMul = 0.6;
    } else {
      const k = type === 'forest' ? 1.15 : type === 'rocks' ? 1.0 : type === 'narrow' ? 0.8 : type === 'cruise' ? 0.55 : type === 'curves' ? 0.6 : 0.9;
      if (type === 'narrow') this.addSign('narrow', a + 20, 1), this.addSign('narrow', a + 20, -1);
      obs.push(...this.rows(type, a, b, dens * k, () => false));
      if (type === 'forest') sceneMul = 1.6; if (type === 'narrow') sceneMul = 1.3; if (type === 'curves') sceneMul = 0.9;
      if (type === 'cruise' && rng() < 0.55) {
        const s = a + 60 + rng() * (b - a - 120);
        const c = this.corridorAt(s) ?? 0;
        zones.push({ type: 'boost', s0: s, s1: s + 7, d0: c - 2.2, d1: c + 2.2 });
      }
    }
    // coins
    if (!['bridge', 'start'].includes(type)) {
      coins = coins.concat(this.coinTrail(a, b, type === 'cruise' || type === 'sprint' ? 0.7 : 0.45, type === 'jumps' ? rampSkip : () => false));
    } else if (type === 'bridge') {
      for (let k = 0; k < 14; k++) coins.push({ s: a + 100 + k * 4, d: Math.sin(k * 0.6) * 1.4, y: 0.9, taken: false });
    }
    // curve warning signs
    {
      let run = 0;
      for (let s = a; s < b; s += DS) {
        const q = this.query(s);
        if (Math.abs(q.k) > 0.0072) {
          run += DS;
          if (run % 24 === 0 && run <= 120) this.addSign(q.k > 0 ? 'curveR' : 'curveL', s, q.k > 0 ? -1 : 1);
        } else run = 0;
        if (q.slope > 0.285 && Math.floor(s / DS) % 80 === 0) this.addSign('steep', s, 1, 'STEEP');
      }
    }
    this.markers(a, b);
    this.scenery(a, b, sceneMul);
    // guarantee: drop any solid obstacle that intrudes on the clear corridor
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (o.kind === 'log') continue;
      const c = this.corridorAt(o.s);
      if (c !== null && Math.abs(o.d - c) < CH * 0.92 + o.r) obs.splice(i, 1);
    }
    // append sorted
    obs.sort((p, q) => p.s - q.s); coins.sort((p, q) => p.s - q.s);
    this.obstacles.push(...obs); this.coins.push(...coins);
    zones.sort((p, q) => p.s0 - q.s0); this.zones.push(...zones.map((z) => ({ ...z, s: z.s0 })));
    this.signs.sort((p, q) => p.s - q.s);
    this.decor.sort((p, q) => p.s - q.s);
    this.cor.sort((p, q) => p.s - q.s);
    void env;
  }

  private scenery(a: number, b: number, mult: number) {
    const rng = this.rng, env = this.env;
    const count = (b - a) * env.treeDensity * mult * 0.9;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const s = a + rng() * (b - a);
        const hw = this.query(s).hw;
        const off = 2.4 + Math.pow(rng(), 1.5) * 42;
        const d = side * (hw + off);
        const r = rng();
        let kind: Decor['kind'] = 'pine', sc = 0.8 + rng() * 1.1;
        if (this.envId === 'peak') {
          if (r < 0.55) { kind = 'rock'; sc = 2 + rng() * 6 * smoothstep(3, 25, off); }
          else if (r < 0.62) kind = 'bush'; else sc *= 0.75;
        } else if (this.envId === 'valley') {
          if (r < 0.2) { kind = 'rock'; sc = 1.5 + rng() * 4; } else if (r < 0.38) { kind = 'bush'; sc = 0.9 + rng() * 0.8; }
        } else {
          if (r < 0.04) { kind = 'rock'; sc = 1.5 + rng() * 3; } else if (r < 0.1) { kind = 'bush'; sc = 0.9 + rng() * 0.8; }
        }
        this.decor.push({ kind, s, d, sc, rot: rng() * 6.28, col: rng() });
      }
    }
  }
}
