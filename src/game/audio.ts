// Procedural WebAudio: music sequencer + synthesized SFX. No external assets.
import { clamp } from './util';

type MusicKind = 'menu' | 'race';

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxG!: GainNode; musicG!: GainNode;
  sfxVol = 0.8; musicVol = 0.5;
  noiseBuf: AudioBuffer | null = null;
  ski: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  wind: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  musicKind: MusicKind | null = null; musicTimer: number | null = null;
  nextTime = 0; step = 0; bpm = 120; root = 0;
  enabledSki = false;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxG = ctx.createGain(); this.sfxG.gain.value = this.sfxVol; this.sfxG.connect(this.master);
      this.musicG = ctx.createGain(); this.musicG.gain.value = this.musicVol * 0.5; this.musicG.connect(this.master);
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; d[i] = w * 0.6 + b0 * 3; }
      this.noiseBuf = buf;
      this.ski = this.loop(900, 'bandpass', 1.2);
      this.wind = this.loop(500, 'lowpass', 0.7);
      if (this.musicKind) { const k = this.musicKind; this.musicKind = null; this.playMusic(k, this.root); }
    } catch { this.ctx = null; }
  }
  private loop(freq: number, type: BiquadFilterType, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filt); filt.connect(gain); gain.connect(this.sfxG); src.start();
    return { src, filt, gain };
  }
  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    this.sfxG.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.musicG.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
  }

  // ----- continuous skiing sound -----
  updateSki(speed01: number, grounded: boolean, ice: boolean, boosting: boolean, active: boolean) {
    if (!this.ctx || !this.ski || !this.wind) return;
    const t = this.ctx.currentTime;
    const sp = clamp(speed01, 0, 1.4);
    const g = active && grounded ? 0.05 + 0.34 * Math.min(1, sp) : 0;
    this.ski.gain.gain.setTargetAtTime(g * (ice ? 0.6 : 1), t, 0.06);
    this.ski.filt.frequency.setTargetAtTime((ice ? 2600 : 800) + 2300 * sp, t, 0.08);
    this.wind.gain.gain.setTargetAtTime(active ? 0.02 + 0.3 * sp * sp + (boosting ? 0.1 : 0) : 0, t, 0.1);
    this.wind.filt.frequency.setTargetAtTime(300 + 1400 * sp, t, 0.1);
  }
  silenceLoops() { this.updateSki(0, false, false, false, false); }

  // ----- SFX primitives -----
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, f0: number, f1: number, type: BiquadFilterType, vol: number, delay = 0, q = 1) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name: string, v = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(760, 520, 0.07, 'triangle', 0.25); break;
      case 'hover': this.tone(1300, 1200, 0.025, 'sine', 0.06); break;
      case 'back': this.tone(520, 340, 0.09, 'triangle', 0.22); break;
      case 'deny': this.tone(160, 120, 0.2, 'sawtooth', 0.18); break;
      case 'buy': [880, 1175, 1568].forEach((f, i) => this.tone(f, f, 0.12, 'sine', 0.22, i * 0.07)); break;
      case 'equip': this.tone(600, 900, 0.1, 'triangle', 0.22); break;
      case 'beep': this.tone(520, 520, 0.16, 'square', 0.18); break;
      case 'go': this.tone(1040, 1040, 0.5, 'square', 0.2); this.tone(1560, 1560, 0.5, 'triangle', 0.15); break;
      case 'jump': this.noise(0.22, 600, 2400, 'bandpass', 0.22, 0, 1.5); this.tone(260, 520, 0.14, 'triangle', 0.12); break;
      case 'land': { const s = clamp(v / 12, 0.2, 1); this.noise(0.18, 900, 160, 'lowpass', 0.35 * s); this.tone(110, 50, 0.18, 'sine', 0.35 * s); break; }
      case 'hardland': this.noise(0.3, 1000, 120, 'lowpass', 0.5); this.tone(90, 40, 0.3, 'sine', 0.5); break;
      case 'hit': this.noise(0.18, 1400, 200, 'bandpass', 0.4, 0, 0.8); this.tone(150, 60, 0.2, 'square', 0.22); break;
      case 'bump': this.noise(0.1, 900, 300, 'lowpass', 0.3); this.tone(180, 90, 0.1, 'triangle', 0.2); break;
      case 'bush': this.noise(0.25, 2600, 900, 'highpass', 0.2); break;
      case 'barrier': this.noise(0.22, 1800, 400, 'bandpass', 0.35); this.tone(120, 70, 0.15, 'triangle', 0.25); break;
      case 'crash': this.noise(0.6, 1800, 100, 'lowpass', 0.6); this.tone(130, 40, 0.5, 'sawtooth', 0.3); this.tone(70, 35, 0.6, 'sine', 0.4, 0.05); break;
      case 'coin': this.tone(1318, 1318, 0.07, 'sine', 0.2); this.tone(1760, 1760, 0.14, 'sine', 0.2, 0.06); break;
      case 'boost': this.noise(0.6, 400, 5000, 'highpass', 0.3); this.tone(180, 700, 0.5, 'sawtooth', 0.14); break;
      case 'pad': this.noise(0.45, 600, 6000, 'highpass', 0.3); this.tone(300, 900, 0.4, 'sawtooth', 0.18); this.tone(450, 1350, 0.4, 'triangle', 0.14); break;
      case 'trick': [988, 1319, 1760, 2093].forEach((f, i) => this.tone(f, f, 0.1, 'sine', 0.18, i * 0.05)); break;
      case 'recover': this.tone(400, 700, 0.15, 'triangle', 0.15); break;
      case 'finish': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.14, i * 0.1)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { this.tone(f, f, 0.28, 'square', 0.13, i * 0.13); this.tone(f / 2, f / 2, 0.28, 'triangle', 0.16, i * 0.13); }); break;
      case 'lose': [440, 392, 349, 294].forEach((f, i) => this.tone(f, f * 0.97, 0.3, 'triangle', 0.2, i * 0.18)); break;
      case 'levelup': [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.2, i * 0.08)); break;
    }
  }

  // ----- music sequencer -----
  playMusic(kind: MusicKind, root = 0, bpm?: number) {
    if (this.musicKind === kind && this.root === root && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicKind = kind; this.root = root;
    this.bpm = bpm ?? (kind === 'menu' ? 86 : 138);
    if (!this.ctx) return;
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 40);
  }
  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
  private schedule() {
    const ctx = this.ctx; if (!ctx || !this.musicKind) return;
    const spb = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.musicStep(this.step, this.nextTime);
      this.nextTime += spb; this.step++;
    }
  }
  private mnote(semi: number, oct = 0) { return 220 * Math.pow(2, (semi + this.root) / 12 + oct); }
  private mtone(f: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + dur + 0.05);
  }
  private mdrum(t: number, kind: 'kick' | 'hat' | 'snare') {
    const ctx = this.ctx!;
    if (kind === 'kick') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + 0.25);
    } else {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = ctx.createGain(); const d = kind === 'hat' ? 0.05 : 0.14;
      g.gain.setValueAtTime(kind === 'hat' ? 0.25 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f); f.connect(g); g.connect(this.musicG); s.start(t, Math.random()); s.stop(t + d + 0.02);
    }
  }
  private musicStep(n: number, t: number) {
    // minor progression: i - VI - III - VII
    const chords = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
    const bar = Math.floor(n / 16) % 4, st = n % 16;
    const ch = chords[bar];
    if (this.musicKind === 'menu') {
      if (st === 0) ch.forEach((c, i) => this.mtone(this.mnote(c, -1 + (i === 2 ? 0 : 0)), t, 60 / this.bpm * 4 * 0.95, 'triangle', 0.1, 900));
      if (st % 2 === 0) this.mtone(this.mnote(ch[(st / 2) % 3] , 1), t, 0.5, 'sine', 0.08 + (st % 4 === 0 ? 0.03 : 0));
      if (st === 8) this.mtone(this.mnote(ch[0], -2), t, 1.2, 'sine', 0.2);
      if (st === 0 || st === 8) this.mdrum(t, 'kick');
      if (st === 4 || st === 12) this.mdrum(t, 'hat');
      if (bar % 2 === 1 && st === 6) this.mtone(this.mnote(ch[2], 2), t, 0.8, 'sine', 0.05);
    } else {
      if (st % 4 === 0) this.mdrum(t, 'kick');
      if (st === 4 || st === 12) this.mdrum(t, 'snare');
      if (st % 2 === 1) this.mdrum(t, 'hat');
      // bass
      if (st % 2 === 0) this.mtone(this.mnote(ch[0], -2), t, 0.16, 'sawtooth', 0.16, 500);
      // pad
      if (st === 0) ch.forEach((c) => this.mtone(this.mnote(c, -1), t, 60 / this.bpm * 3.8, 'triangle', 0.045, 1200));
      // lead arp
      const pat = [0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2, 2, 1, 0, 1];
      if (st % 2 === 0 || bar % 2 === 1) this.mtone(this.mnote(ch[pat[st]], 1 + (st > 11 ? 1 : 0)), t, 0.14, 'square', 0.04, 3000);
    }
  }
}

export const audio = new AudioEngine();
