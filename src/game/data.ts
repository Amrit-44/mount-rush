// Static game data: environments, courses, career events, opponents, cosmetics.

export type EnvId = 'forest' | 'peak' | 'valley';
export type SectionType =
  | 'cruise' | 'curves' | 'forest' | 'logs' | 'jumps' | 'narrow'
  | 'rocks' | 'ice' | 'deep' | 'bridge' | 'split' | 'sprint';

export interface EnvDef {
  id: EnvId; name: string; desc: string;
  skyTop: number; skyHorizon: number; fog: number; fogDensity: number;
  sun: number; sunInt: number; hemiSky: number; hemiGround: number; hemiInt: number;
  sunDir: [number, number, number];
  snow: number; piste: number; off: number; rock: number; mountain: number;
  leaf: number; baseHw: number; baseSlope: number;
  wallK: number; wallMax: number; noiseAmp: number; treeDensity: number; rocky: number;
  weights: Record<SectionType, number>;
  bpm: number; root: number;
  accent: string;
}

export const ENVS: Record<EnvId, EnvDef> = {
  forest: {
    id: 'forest', name: 'Alpine Forest', desc: 'Dense pines, fallen logs and winding narrow passages.',
    skyTop: 0x4f93e0, skyHorizon: 0xe3f1ff, fog: 0xd3e6f7, fogDensity: 0.0021,
    sun: 0xfff1d6, sunInt: 2.3, hemiSky: 0xbfdcff, hemiGround: 0x5d7088, hemiInt: 1.05,
    sunDir: [0.5, 0.75, 0.35], snow: 0.55, piste: 0xf6faff, off: 0xd0deec, rock: 0x7b8594, mountain: 0x8aa0bd,
    leaf: 0x2f6b4d, baseHw: 9.6, baseSlope: 0.165, wallK: 0.55, wallMax: 30, noiseAmp: 5, treeDensity: 1.0, rocky: 0.35,
    weights: { cruise: 2, curves: 2, forest: 4, logs: 2.5, jumps: 1.2, narrow: 2, rocks: 1, ice: 0.5, deep: 1, bridge: 0.3, split: 0.8, sprint: 0.8 },
    bpm: 132, root: 0, accent: '#5fd39a',
  },
  peak: {
    id: 'peak', name: 'Frozen Peak', desc: 'High altitude, steep drops, huge jumps and icy ridges.',
    skyTop: 0x1f5fc4, skyHorizon: 0xc4e2ff, fog: 0xb9d6f0, fogDensity: 0.0019,
    sun: 0xf4f8ff, sunInt: 2.6, hemiSky: 0x9ec6f5, hemiGround: 0x4b5a70, hemiInt: 1.0,
    sunDir: [-0.45, 0.8, 0.3], snow: 0.8, piste: 0xf2f8ff, off: 0xc2d3e6, rock: 0x6c7684, mountain: 0x7c93b3,
    leaf: 0x3a6a5a, baseHw: 8.2, baseSlope: 0.235, wallK: 1.3, wallMax: 80, noiseAmp: 9, treeDensity: 0.26, rocky: 0.85,
    weights: { cruise: 1, curves: 2, forest: 0.4, logs: 0.4, jumps: 3.2, narrow: 3, rocks: 2, ice: 2.2, deep: 0.5, bridge: 1.6, split: 1, sprint: 2 },
    bpm: 144, root: -2, accent: '#7cc4ff',
  },
  valley: {
    id: 'valley', name: 'Extreme Snow Valley', desc: 'Wide sweeping runs, sharp curves, bridges and risky shortcuts.',
    skyTop: 0x5d78d4, skyHorizon: 0xffdcb8, fog: 0xf0dccb, fogDensity: 0.0019,
    sun: 0xffc98a, sunInt: 2.5, hemiSky: 0xd7d4ff, hemiGround: 0x7a6a7c, hemiInt: 1.05,
    sunDir: [0.7, 0.45, -0.3], snow: 0.7, piste: 0xfffaf6, off: 0xdccfd6, rock: 0x8a7a80, mountain: 0xa497ba,
    leaf: 0x3c6a58, baseHw: 13, baseSlope: 0.185, wallK: 0.3, wallMax: 26, noiseAmp: 4, treeDensity: 0.42, rocky: 0.5,
    weights: { cruise: 2, curves: 3, forest: 0.7, logs: 0.6, jumps: 3, narrow: 0.6, rocks: 1, ice: 1, deep: 2, bridge: 2, split: 3, sprint: 2 },
    bpm: 138, root: 3, accent: '#ffb36b',
  },
};

export interface CourseDef {
  id: string; env: EnvId; name: string; length: number; seed: number;
  curve: number; density: number; blurb: string;
}

export const COURSES: CourseDef[] = [
  { id: 'f1', env: 'forest', name: 'Pine Ridge', length: 2400, seed: 1101, curve: 0.45, density: 0.35, blurb: 'A friendly warm-up through the pines.' },
  { id: 'f2', env: 'forest', name: 'Whispering Woods', length: 2800, seed: 2207, curve: 0.6, density: 0.5, blurb: 'Tighter trees and plenty of logs.' },
  { id: 'f3', env: 'forest', name: 'Timberline Run', length: 3200, seed: 3319, curve: 0.75, density: 0.68, blurb: 'Long, technical and unforgiving.' },
  { id: 'p1', env: 'peak', name: 'Icicle Pass', length: 2600, seed: 4421, curve: 0.5, density: 0.5, blurb: 'Your first taste of high altitude.' },
  { id: 'p2', env: 'peak', name: 'Summit Drop', length: 3000, seed: 5527, curve: 0.65, density: 0.62, blurb: 'Giant kickers and razor-thin ridges.' },
  { id: 'p3', env: 'peak', name: 'Dead Man\'s Ridge', length: 3400, seed: 6637, curve: 0.8, density: 0.8, blurb: 'The most dangerous descent on the mountain.' },
  { id: 'v1', env: 'valley', name: 'Powder Basin', length: 2600, seed: 7741, curve: 0.55, density: 0.45, blurb: 'Wide open carving with hidden shortcuts.' },
  { id: 'v2', env: 'valley', name: 'Glacier Canyon', length: 3000, seed: 8853, curve: 0.7, density: 0.6, blurb: 'Bridges, canyons and sharp bends.' },
  { id: 'v3', env: 'valley', name: 'Avalanche Alley', length: 3400, seed: 9967, curve: 0.9, density: 0.78, blurb: 'Everything at full speed. Good luck.' },
];
export const courseById = (id: string) => COURSES.find((c) => c.id === id) ?? COURSES[0];

// ---------- Opponents ----------
export interface Look {
  ski: string; skiColor: string; skiDesign: string; outfit: string;
  helmet: string; goggles: string; gloves: string; accessory: string;
}
export const DEFAULT_LOOK: Look = {
  ski: 'ski_basic', skiColor: 'sc_red', skiDesign: 'sd_solid', outfit: 'of_blue',
  helmet: 'hm_classic', goggles: 'gg_orange', gloves: 'gl_black', accessory: 'ac_none',
};

export interface OpponentDef {
  id: string; name: string; tag: string; skill: number; aggr: number; caution: number; jump: number; boost: number;
  look: Look; color: string;
}
export const OPPONENTS: OpponentDef[] = [
  { id: 'frost', name: 'Frost', tag: 'Balanced', skill: 0.62, aggr: 0.5, caution: 0.5, jump: 0.5, boost: 0.5, color: '#6fb6ff',
    look: { ski: 'ski_pro', skiColor: 'sc_blue', skiDesign: 'sd_stripes', outfit: 'of_arctic', helmet: 'hm_racer', goggles: 'gg_mirror', gloves: 'gl_white', accessory: 'ac_none' } },
  { id: 'blaze', name: 'Blaze', tag: 'Aggressive', skill: 0.7, aggr: 0.92, caution: 0.2, jump: 0.7, boost: 0.8, color: '#ff6a3d',
    look: { ski: 'ski_carbon', skiColor: 'sc_orange', skiDesign: 'sd_flame', outfit: 'of_red', helmet: 'hm_fin', goggles: 'gg_orange', gloves: 'gl_red', accessory: 'ac_scarf' } },
  { id: 'mika', name: 'Mika', tag: 'Cautious', skill: 0.58, aggr: 0.2, caution: 0.9, jump: 0.3, boost: 0.35, color: '#5fd39a',
    look: { ski: 'ski_basic', skiColor: 'sc_green', skiDesign: 'sd_chevron', outfit: 'of_forest', helmet: 'hm_beanie', goggles: 'gg_green', gloves: 'gl_black', accessory: 'ac_backpack' } },
  { id: 'viktor', name: 'Viktor', tag: 'Precision Pro', skill: 0.88, aggr: 0.6, caution: 0.35, jump: 0.6, boost: 0.65, color: '#c9b6ff',
    look: { ski: 'ski_aurora', skiColor: 'sc_purple', skiDesign: 'sd_stars', outfit: 'of_black', helmet: 'hm_racer', goggles: 'gg_blue', gloves: 'gl_black', accessory: 'ac_none' } },
  { id: 'luna', name: 'Luna', tag: 'Air Specialist', skill: 0.72, aggr: 0.45, caution: 0.45, jump: 0.95, boost: 0.55, color: '#ff8fd0',
    look: { ski: 'ski_pro', skiColor: 'sc_pink', skiDesign: 'sd_checker', outfit: 'of_pink', helmet: 'hm_ears', goggles: 'gg_pink', gloves: 'gl_white', accessory: 'ac_tail' } },
  { id: 'rex', name: 'Rex', tag: 'Reckless', skill: 0.6, aggr: 1.0, caution: 0.05, jump: 0.8, boost: 0.95, color: '#ffd23d',
    look: { ski: 'ski_carbon', skiColor: 'sc_gold', skiDesign: 'sd_camo', outfit: 'of_sunset', helmet: 'hm_horns', goggles: 'gg_gold', gloves: 'gl_gold', accessory: 'ac_cape' } },
];

// ---------- Cosmetics ----------
export type Cat = 'ski' | 'skiColor' | 'skiDesign' | 'outfit' | 'helmet' | 'goggles' | 'gloves' | 'accessory';
export const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: 'ski', label: 'Skis', icon: '⛷️' },
  { id: 'skiColor', label: 'Ski Color', icon: '🎨' },
  { id: 'skiDesign', label: 'Ski Design', icon: '✨' },
  { id: 'outfit', label: 'Outfit', icon: '🧥' },
  { id: 'helmet', label: 'Helmet', icon: '🪖' },
  { id: 'goggles', label: 'Goggles', icon: '🥽' },
  { id: 'gloves', label: 'Gloves', icon: '🧤' },
  { id: 'accessory', label: 'Extras', icon: '🧣' },
];

export type Unlock =
  | { t: 'free' }
  | { t: 'coins' }
  | { t: 'event'; e: number; m: number }
  | { t: 'level'; l: number };

export interface Item {
  id: string; cat: Cat; name: string; price: number; unlock: Unlock;
  d: Record<string, any>;
}

const F: Unlock = { t: 'free' };
const C: Unlock = { t: 'coins' };
const it = (id: string, cat: Cat, name: string, price: number, unlock: Unlock, d: Record<string, any> = {}): Item => ({ id, cat, name, price, unlock, d });

export const ITEMS: Item[] = [
  // Skis (stats are small multipliers)
  it('ski_basic', 'ski', 'Starter Skis', 0, F, { len: 1.7, w: 0.11, top: 1.0, grip: 1.0, boost: 1.0 }),
  it('ski_pro', 'ski', 'Slalom Pro', 350, C, { len: 1.65, w: 0.105, top: 1.01, grip: 1.1, boost: 1.0 }),
  it('ski_carbon', 'ski', 'Carbon Racer', 0, { t: 'event', e: 4, m: 1 }, { len: 1.75, w: 0.1, top: 1.035, grip: 1.04, boost: 1.0 }),
  it('ski_powder', 'ski', 'Powder King', 700, C, { len: 1.85, w: 0.16, top: 1.02, grip: 1.0, boost: 1.18 }),
  it('ski_aurora', 'ski', 'Aurora X', 0, { t: 'level', l: 12 }, { len: 1.78, w: 0.11, top: 1.05, grip: 1.1, boost: 1.1 }),
  it('ski_comet', 'ski', 'Golden Comet', 0, { t: 'event', e: 20, m: 3 }, { len: 1.8, w: 0.115, top: 1.065, grip: 1.12, boost: 1.22 }),
  // Colors
  it('sc_red', 'skiColor', 'Racing Red', 0, F, { color: 0xe83030 }),
  it('sc_blue', 'skiColor', 'Glacier Blue', 0, F, { color: 0x2f7be8 }),
  it('sc_orange', 'skiColor', 'Blaze Orange', 60, C, { color: 0xff7a1a }),
  it('sc_green', 'skiColor', 'Pine Green', 60, C, { color: 0x24a85f }),
  it('sc_black', 'skiColor', 'Stealth Black', 120, C, { color: 0x1b1d24 }),
  it('sc_white', 'skiColor', 'Snow White', 120, C, { color: 0xf2f4f8 }),
  it('sc_purple', 'skiColor', 'Royal Purple', 150, C, { color: 0x7b3ae0 }),
  it('sc_pink', 'skiColor', 'Hot Pink', 150, C, { color: 0xff4fa8 }),
  it('sc_cyan', 'skiColor', 'Ice Cyan', 0, { t: 'level', l: 4 }, { color: 0x25d6e8 }),
  it('sc_gold', 'skiColor', 'Pure Gold', 500, C, { color: 0xf0b820 }),
  // Designs
  it('sd_solid', 'skiDesign', 'Solid', 0, F, { kind: 'solid' }),
  it('sd_stripes', 'skiDesign', 'Racing Stripes', 0, F, { kind: 'stripes' }),
  it('sd_checker', 'skiDesign', 'Checker', 120, C, { kind: 'checker' }),
  it('sd_chevron', 'skiDesign', 'Chevron', 150, C, { kind: 'chevron' }),
  it('sd_flame', 'skiDesign', 'Inferno', 250, C, { kind: 'flame' }),
  it('sd_stars', 'skiDesign', 'Starfield', 0, { t: 'level', l: 7 }, { kind: 'stars' }),
  it('sd_camo', 'skiDesign', 'Arctic Camo', 0, { t: 'event', e: 2, m: 1 }, { kind: 'camo' }),
  // Outfits
  it('of_blue', 'outfit', 'Alpine Blue', 0, F, { jacket: 0x2a62d6, pants: 0x1c2a4a, accent: 0xffffff }),
  it('of_red', 'outfit', 'Team Red', 0, F, { jacket: 0xd62a2a, pants: 0x2a2a34, accent: 0xffffff }),
  it('of_forest', 'outfit', 'Forest Ranger', 220, C, { jacket: 0x2f8a55, pants: 0x3a3a2a, accent: 0xf0d36a }),
  it('of_pink', 'outfit', 'Neon Pink', 300, C, { jacket: 0xff4fa8, pants: 0x2a1c4a, accent: 0x7ff0ff }),
  it('of_arctic', 'outfit', 'Arctic Camo', 0, { t: 'event', e: 5, m: 1 }, { jacket: 0xdfe8f2, pants: 0x8aa0b8, accent: 0x2f7be8 }),
  it('of_black', 'outfit', 'Midnight Black', 500, C, { jacket: 0x1a1c24, pants: 0x101218, accent: 0x7cc4ff }),
  it('of_sunset', 'outfit', 'Sunset Rider', 0, { t: 'event', e: 11, m: 2 }, { jacket: 0xff7a3a, pants: 0x5a2a5a, accent: 0xffd23d }),
  it('of_gold', 'outfit', 'Champion Gold', 0, { t: 'event', e: 20, m: 3 }, { jacket: 0xf0b820, pants: 0x1a1c24, accent: 0xffffff }),
  // Helmets
  it('hm_classic', 'helmet', 'Classic', 0, F, { color: 0xf2f4f8, style: 'classic' }),
  it('hm_racer', 'helmet', 'Racer', 150, C, { color: 0x20242e, style: 'racer' }),
  it('hm_beanie', 'helmet', 'Wool Beanie', 200, C, { color: 0xd64a4a, style: 'beanie' }),
  it('hm_fin', 'helmet', 'Shark Fin', 350, C, { color: 0x2f7be8, style: 'fin' }),
  it('hm_ears', 'helmet', 'Cat Ears', 400, C, { color: 0xff8fd0, style: 'ears' }),
  it('hm_horns', 'helmet', 'Viking', 0, { t: 'event', e: 6, m: 1 }, { color: 0xb8b0a0, style: 'horns' }),
  it('hm_gold', 'helmet', 'Golden Racer', 0, { t: 'level', l: 15 }, { color: 0xf0b820, style: 'racer' }),
  // Goggles
  it('gg_orange', 'goggles', 'Sunset Lens', 0, F, { lens: 0xff9a2a, frame: 0x1a1c24 }),
  it('gg_blue', 'goggles', 'Ice Lens', 80, C, { lens: 0x3aa0ff, frame: 0x1a1c24 }),
  it('gg_mirror', 'goggles', 'Mirror Silver', 150, C, { lens: 0xd8e4f0, frame: 0x303642 }),
  it('gg_green', 'goggles', 'Emerald', 150, C, { lens: 0x30d080, frame: 0x1a1c24 }),
  it('gg_pink', 'goggles', 'Candy', 250, C, { lens: 0xff6fb8, frame: 0xffffff }),
  it('gg_gold', 'goggles', 'Gold Mirror', 450, C, { lens: 0xf5c63a, frame: 0x303642 }),
  // Gloves
  it('gl_black', 'gloves', 'Black', 0, F, { color: 0x1a1c24 }),
  it('gl_red', 'gloves', 'Red', 60, C, { color: 0xd62a2a }),
  it('gl_white', 'gloves', 'White', 100, C, { color: 0xf2f4f8 }),
  it('gl_blue', 'gloves', 'Blue', 60, C, { color: 0x2f7be8 }),
  it('gl_gold', 'gloves', 'Gold', 400, C, { color: 0xf0b820 }),
  // Accessories
  it('ac_none', 'accessory', 'None', 0, F, { kind: 'none' }),
  it('ac_scarf', 'accessory', 'Racing Scarf', 150, C, { kind: 'scarf', color: 0xff4a3a }),
  it('ac_backpack', 'accessory', 'Backpack', 300, C, { kind: 'backpack', color: 0x2f7be8 }),
  it('ac_antenna', 'accessory', 'Lucky Antenna', 200, C, { kind: 'antenna', color: 0x5fe08a }),
  it('ac_tail', 'accessory', 'Fox Tail', 450, C, { kind: 'tail', color: 0xff8a2a }),
  it('ac_cape', 'accessory', 'Hero Cape', 650, C, { kind: 'cape', color: 0xd62a2a }),
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const itemsOf = (cat: Cat) => ITEMS.filter((i) => i.cat === cat);

export function skiStats(look: Look) {
  const s = itemById(look.ski)?.d ?? {};
  return { top: s.top ?? 1, grip: s.grip ?? 1, boost: s.boost ?? 1 };
}

// ---------- Career ----------
export type Objective =
  | { kind: 'position'; gold: number; silver: number; bronze: number }
  | { kind: 'time'; gold: number; silver: number; bronze: number } // seconds
  | { kind: 'clean'; gold: number; silver: number; bronze: number } // max crashes
  | { kind: 'coins'; gold: number; silver: number; bronze: number }
  | { kind: 'mistakes'; gold: number; silver: number; bronze: number }; // max mistakes

export interface CareerEvent {
  id: string; index: number; name: string; course: string; diff: number; objective: Objective;
  reward: number; xp: number; gate: number; chapter: number; extraCoins?: boolean;
}

const avg = (courseId: string, g: number, s: number, b: number): Objective => {
  const L = courseById(courseId).length;
  return { kind: 'time', gold: Math.round(L / g), silver: Math.round(L / s), bronze: Math.round(L / b) };
};
const pos = (gold = 1, silver = 3, bronze = 5): Objective => ({ kind: 'position', gold, silver, bronze });

const RAW: [string, string, number, Objective, number][] = [
  ['First Tracks', 'f1', 0.08, pos(1, 3, 5), 0],
  ['Coin Rush', 'f1', 0.14, { kind: 'coins', gold: 100, silver: 65, bronze: 35 }, 0],
  ['Clean Run', 'f2', 0.2, { kind: 'clean', gold: 0, silver: 1, bronze: 3 }, 0],
  ['Beat the Clock', 'f2', 0.24, avg('f2', 31, 28.5, 25.5), 0],
  ['Woodland Cup', 'f2', 0.3, pos(1, 3, 5), 0],
  ['Timber Trial', 'f3', 0.34, { kind: 'mistakes', gold: 2, silver: 5, bronze: 9 }, 0],
  ['Forest Champion', 'f3', 0.42, pos(1, 2, 4), 0],
  ['Icicle Intro', 'p1', 0.42, pos(1, 3, 5), 8],
  ['Frozen Coins', 'p1', 0.46, { kind: 'coins', gold: 105, silver: 70, bronze: 40 }, 0],
  ['Ice Time', 'p1', 0.5, avg('p1', 37, 34, 30), 0],
  ['Summit Clean', 'p2', 0.54, { kind: 'clean', gold: 0, silver: 1, bronze: 3 }, 0],
  ['Knife Edge Cup', 'p2', 0.6, pos(1, 3, 4), 0],
  ['Peak Precision', 'p2', 0.64, { kind: 'mistakes', gold: 3, silver: 6, bronze: 10 }, 0],
  ['Peak Champion', 'p3', 0.72, pos(1, 2, 4), 0],
  ['Valley Dash', 'v1', 0.6, pos(1, 3, 4), 22],
  ['Powder Hunt', 'v1', 0.66, { kind: 'coins', gold: 130, silver: 90, bronze: 50 }, 0],
  ['Canyon Clock', 'v2', 0.7, avg('v2', 35, 32, 28), 0],
  ['Bridge Run', 'v2', 0.76, { kind: 'clean', gold: 0, silver: 1, bronze: 2 }, 0],
  ['Shortcut Showdown', 'v2', 0.82, pos(1, 2, 4), 0],
  ['Avalanche Alley', 'v3', 0.88, { kind: 'mistakes', gold: 4, silver: 7, bronze: 11 }, 0],
  ['Grand Finale', 'v3', 1.0, pos(1, 2, 3), 40],
];
export const EVENTS: CareerEvent[] = RAW.map(([name, course, diff, objective, gate], i) => ({
  id: `e${i}`, index: i, name, course, diff, objective, gate,
  reward: 140 + i * 35, xp: 60 + i * 12, chapter: i < 7 ? 0 : i < 14 ? 1 : 2,
  extraCoins: objective.kind === 'coins',
}));
export const CHAPTERS = ['Alpine Forest Cup', 'Frozen Peak Series', 'Snow Valley Championship'];

export function objectiveText(o: Objective): string {
  switch (o.kind) {
    case 'position': return o.gold === 1 ? 'Win the race' : `Finish in the top ${o.gold}`;
    case 'time': return 'Beat the target time';
    case 'clean': return 'Finish with as few crashes as possible';
    case 'coins': return 'Collect as many coins as you can';
    case 'mistakes': return 'Finish with limited mistakes (hits & crashes)';
  }
}
export function objectiveTargets(o: Objective): [string, string, string] {
  const f = (v: number) => {
    switch (o.kind) {
      case 'position': return v === 1 ? '1st' : `Top ${v}`;
      case 'time': return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
      case 'clean': return v === 0 ? 'No crashes' : `≤ ${v} crash${v > 1 ? 'es' : ''}`;
      case 'coins': return `${v} coins`;
      case 'mistakes': return `≤ ${v} mistakes`;
    }
  };
  return [f(o.gold), f(o.silver), f(o.bronze)];
}

// ---------- Progression ----------
export function xpForLevel(l: number) { return Math.round(110 + (l - 1) * 70 + Math.pow(l - 1, 1.5) * 12); }
export function levelFromXp(xp: number) {
  let level = 1; let rem = Math.max(0, xp);
  while (level < 99 && rem >= xpForLevel(level)) { rem -= xpForLevel(level); level++; }
  return { level, into: rem, need: xpForLevel(level) };
}
