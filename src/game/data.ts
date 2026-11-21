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
    sun: 0xfff1d6, sunInt: 1.95, hemiSky: 0xbfdcff, hemiGround: 0x5d7088, hemiInt: 0.9,
    sunDir: [0.5, 0.75, 0.35], snow: 0.55, piste: 0xf6faff, off: 0xd0deec, rock: 0x7b8594, mountain: 0x8aa0bd,
    leaf: 0x2f6b4d, baseHw: 9.6, baseSlope: 0.165, wallK: 0.55, wallMax: 30, noiseAmp: 5, treeDensity: 1.0, rocky: 0.35,
    weights: { cruise: 2, curves: 2, forest: 4, logs: 2.5, jumps: 1.2, narrow: 2, rocks: 1, ice: 0.5, deep: 1, bridge: 0.3, split: 0.8, sprint: 0.8 },
    bpm: 132, root: 0, accent: '#5fd39a',
  },
  peak: {
    id: 'peak', name: 'Frozen Peak', desc: 'High altitude, steep drops, huge jumps and icy ridges.',
    skyTop: 0x1f5fc4, skyHorizon: 0xc4e2ff, fog: 0xb9d6f0, fogDensity: 0.0019,
    sun: 0xf4f8ff, sunInt: 2.2, hemiSky: 0x9ec6f5, hemiGround: 0x4b5a70, hemiInt: 0.85,
    sunDir: [-0.45, 0.8, 0.3], snow: 0.8, piste: 0xf2f8ff, off: 0xc2d3e6, rock: 0x6c7684, mountain: 0x7c93b3,
    leaf: 0x3a6a5a, baseHw: 8.2, baseSlope: 0.235, wallK: 1.3, wallMax: 80, noiseAmp: 9, treeDensity: 0.26, rocky: 0.85,
    weights: { cruise: 1, curves: 2, forest: 0.4, logs: 0.4, jumps: 3.2, narrow: 3, rocks: 2, ice: 2.2, deep: 0.5, bridge: 1.6, split: 1, sprint: 2 },
    bpm: 144, root: -2, accent: '#7cc4ff',
  },
  valley: {
    id: 'valley', name: 'Extreme Snow Valley', desc: 'Wide sweeping runs, sharp curves, bridges and risky shortcuts.',
    skyTop: 0x5d78d4, skyHorizon: 0xffdcb8, fog: 0xf0dccb, fogDensity: 0.0019,
    sun: 0xffc98a, sunInt: 2.1, hemiSky: 0xd7d4ff, hemiGround: 0x7a6a7c, hemiInt: 0.9,
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
  ski: string; skiColor: string; skiDesign: string;
  jacket: string; pants: string;
  helmet: string; headwear: string; hair: string;
  goggles: string; glasses: string; faceAcc: string;
  gloves: string; boots: string; back: string; special: string;
}
export const DEFAULT_LOOK: Look = {
  ski: 'ski_basic', skiColor: 'sc_red', skiDesign: 'sd_solid',
  jacket: 'jk_blue', pants: 'pt_navy',
  helmet: 'hm_classic', headwear: 'hw_none', hair: 'hr_fade',
  goggles: 'gg_orange', glasses: 'gs_none', faceAcc: 'fa_none',
  gloves: 'gl_black', boots: 'bt_black', back: 'bk_none', special: 'sp_none',
};

export interface OpponentDef {
  id: string; name: string; tag: string; skill: number; aggr: number; caution: number; jump: number; boost: number;
  look: Look; color: string;
}
export const OPPONENTS: OpponentDef[] = [
  { id: 'frost', name: 'Frost', tag: 'Balanced', skill: 0.62, aggr: 0.5, caution: 0.5, jump: 0.5, boost: 0.5, color: '#6fb6ff',
    look: { ski: 'ski_pro', skiColor: 'sc_blue', skiDesign: 'sd_stripes', jacket: 'jk_arctic', pants: 'pt_arctic', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_crop', goggles: 'gg_mirror', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_black', back: 'bk_none', special: 'sp_none' } },
  { id: 'blaze', name: 'Blaze', tag: 'Aggressive', skill: 0.7, aggr: 0.92, caution: 0.2, jump: 0.7, boost: 0.8, color: '#ff6a3d',
    look: { ski: 'ski_carbon', skiColor: 'sc_orange', skiDesign: 'sd_flame', jacket: 'jk_red', pants: 'pt_charcoal', helmet: 'hm_fin', headwear: 'hw_none', hair: 'hr_messy', goggles: 'gg_orange', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_red', boots: 'bt_red', back: 'bk_none', special: 'sp_scarf' } },
  { id: 'mika', name: 'Mika', tag: 'Cautious', skill: 0.58, aggr: 0.2, caution: 0.9, jump: 0.3, boost: 0.35, color: '#5fd39a',
    look: { ski: 'ski_basic', skiColor: 'sc_green', skiDesign: 'sd_chevron', jacket: 'jk_forest', pants: 'pt_forest', helmet: 'hm_none', headwear: 'hm_beanie', hair: 'hr_braid', goggles: 'gg_green', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_black', back: 'bk_backpack', special: 'sp_none' } },
  { id: 'viktor', name: 'Viktor', tag: 'Precision Pro', skill: 0.88, aggr: 0.6, caution: 0.35, jump: 0.6, boost: 0.65, color: '#c9b6ff',
    look: { ski: 'ski_aurora', skiColor: 'sc_purple', skiDesign: 'sd_stars', jacket: 'jk_black', pants: 'pt_black', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_fade', goggles: 'gg_blue', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_black', back: 'bk_none', special: 'sp_none' } },
  { id: 'luna', name: 'Luna', tag: 'Air Specialist', skill: 0.72, aggr: 0.45, caution: 0.45, jump: 0.95, boost: 0.55, color: '#ff8fd0',
    look: { ski: 'ski_pro', skiColor: 'sc_pink', skiDesign: 'sd_checker', jacket: 'jk_pink', pants: 'pt_pink', helmet: 'hm_ears', headwear: 'hw_none', hair: 'hr_long', goggles: 'gg_pink', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_tail' } },
  { id: 'rex', name: 'Rex', tag: 'Reckless', skill: 0.6, aggr: 1.0, caution: 0.05, jump: 0.8, boost: 0.95, color: '#ffd23d',
    look: { ski: 'ski_carbon', skiColor: 'sc_gold', skiDesign: 'sd_camo', jacket: 'jk_sunset', pants: 'pt_purple', helmet: 'hm_horns', headwear: 'hw_none', hair: 'hr_messy', goggles: 'gg_gold', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_gold', boots: 'bt_gold', back: 'bk_cape', special: 'sp_none' } },
];

// ---------- Cosmetics ----------
export type Cat = 'ski' | 'skiColor' | 'skiDesign' | 'jacket' | 'pants' | 'helmet' | 'headwear' | 'hair' | 'goggles' | 'glasses' | 'faceAcc' | 'gloves' | 'boots' | 'back' | 'special';

export type Unlock =
  | { t: 'free' }
  | { t: 'coins' }
  | { t: 'event'; e: number; m: number }
  | { t: 'level'; l: number };

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY_STYLE: Record<Rarity, { label: string; color: string; border: string; glow: string }> = {
  common:    { label: 'Common',    color: '#9fb0c8', border: '#5d708f', glow: 'rgba(159,176,200,0.25)' },
  uncommon:  { label: 'Uncommon',  color: '#5fd39a', border: '#2f8a55', glow: 'rgba(95,211,154,0.35)' },
  rare:      { label: 'Rare',      color: '#5aa8ff', border: '#2f7be8', glow: 'rgba(90,168,255,0.4)' },
  epic:      { label: 'Epic',      color: '#c07fff', border: '#7b3ae0', glow: 'rgba(192,127,255,0.45)' },
  legendary: { label: 'Legendary', color: '#ffc933', border: '#f0b820', glow: 'rgba(255,201,51,0.5)' },
  mythic:    { label: 'Mythic',    color: '#ff5a3c', border: '#ff2a1a', glow: 'rgba(255,90,60,0.55)' },
};

export interface Item {
  id: string; cat: Cat; name: string; price: number; unlock: Unlock;
  d: Record<string, any>; rarity?: Rarity;
}

const F: Unlock = { t: 'free' };
const C: Unlock = { t: 'coins' };
const it = (id: string, cat: Cat, name: string, price: number, unlock: Unlock, d: Record<string, any> = {}, rarity?: Rarity): Item => ({ id, cat, name, price, unlock, d, rarity });

export const ITEMS: Item[] = [
  // Skis (stats are small multipliers)
  it('ski_basic', 'ski', 'Starter Skis', 0, F, { len: 1.7, w: 0.11, top: 1.0, grip: 1.0, boost: 1.0 }, 'common'),
  it('ski_pro', 'ski', 'Slalom Pro', 350, C, { len: 1.65, w: 0.105, top: 1.01, grip: 1.1, boost: 1.0 }, 'uncommon'),
  it('ski_carbon', 'ski', 'Carbon Racer', 0, { t: 'event', e: 4, m: 1 }, { len: 1.75, w: 0.1, top: 1.035, grip: 1.04, boost: 1.0 }, 'common'),
  it('ski_powder', 'ski', 'Powder King', 700, C, { len: 1.85, w: 0.16, top: 1.02, grip: 1.0, boost: 1.18 }, 'epic'),
  it('ski_aurora', 'ski', 'Aurora X', 0, { t: 'level', l: 12 }, { len: 1.78, w: 0.11, top: 1.05, grip: 1.1, boost: 1.1 }, 'common'),
  it('ski_comet', 'ski', 'Golden Comet', 0, { t: 'event', e: 20, m: 3 }, { len: 1.8, w: 0.115, top: 1.065, grip: 1.12, boost: 1.22 }, 'legendary'),
  // Colors
  it('sc_red', 'skiColor', 'Racing Red', 0, F, { color: 0xe83030 }, 'common'),
  it('sc_blue', 'skiColor', 'Glacier Blue', 0, F, { color: 0x2f7be8 }, 'common'),
  it('sc_orange', 'skiColor', 'Blaze Orange', 60, C, { color: 0xff7a1a }, 'common'),
  it('sc_green', 'skiColor', 'Pine Green', 60, C, { color: 0x24a85f }, 'common'),
  it('sc_black', 'skiColor', 'Stealth Black', 120, C, { color: 0x1b1d24 }, 'common'),
  it('sc_white', 'skiColor', 'Snow White', 120, C, { color: 0xf2f4f8 }, 'common'),
  it('sc_purple', 'skiColor', 'Royal Purple', 150, C, { color: 0x7b3ae0 }, 'common'),
  it('sc_pink', 'skiColor', 'Hot Pink', 150, C, { color: 0xff4fa8 }, 'common'),
  it('sc_cyan', 'skiColor', 'Ice Cyan', 0, { t: 'level', l: 4 }, { color: 0x25d6e8 }, 'common'),
  it('sc_gold', 'skiColor', 'Pure Gold', 500, C, { color: 0xf0b820 }, 'rare'),
  // Designs
  it('sd_solid', 'skiDesign', 'Solid', 0, F, { kind: 'solid' }, 'common'),
  it('sd_stripes', 'skiDesign', 'Racing Stripes', 0, F, { kind: 'stripes' }, 'common'),
  it('sd_checker', 'skiDesign', 'Checker', 120, C, { kind: 'checker' }, 'common'),
  it('sd_chevron', 'skiDesign', 'Chevron', 150, C, { kind: 'chevron' }, 'common'),
  it('sd_flame', 'skiDesign', 'Inferno', 250, C, { kind: 'flame' }, 'uncommon'),
  it('sd_stars', 'skiDesign', 'Starfield', 0, { t: 'level', l: 7 }, { kind: 'stars' }, 'common'),
  it('sd_camo', 'skiDesign', 'Arctic Camo', 0, { t: 'event', e: 2, m: 1 }, { kind: 'camo' }, 'common'),
  // Jackets
  it('jk_blue', 'jacket', 'Alpine Blue Jacket', 0, F, { jacket: 0x2a62d6, accent: 0xffffff, style: 'tech' }, 'common'),
  it('jk_red', 'jacket', 'Team Red Jacket', 0, F, { jacket: 0xd62a2a, accent: 0xffffff, style: 'tech' }, 'common'),
  it('jk_forest', 'jacket', 'Forest Ranger Jacket', 220, C, { jacket: 0x2f8a55, accent: 0xf0d36a, style: 'tech' }, 'uncommon'),
  it('jk_pink', 'jacket', 'Neon Pink Jacket', 300, C, { jacket: 0xff4fa8, accent: 0x7ff0ff, style: 'tech' }, 'uncommon'),
  it('jk_arctic', 'jacket', 'Arctic Camo Jacket', 0, { t: 'event', e: 5, m: 1 }, { jacket: 0xdfe8f2, accent: 0x2f7be8, style: 'tech' }, 'common'),
  it('jk_black', 'jacket', 'Midnight Black Jacket', 500, C, { jacket: 0x1a1c24, accent: 0x7cc4ff, style: 'tech' }, 'rare'),
  it('jk_sunset', 'jacket', 'Sunset Rider Jacket', 0, { t: 'event', e: 11, m: 2 }, { jacket: 0xff7a3a, accent: 0xffd23d, style: 'tech' }, 'common'),
  it('jk_gold', 'jacket', 'Champion Gold Jacket', 0, { t: 'event', e: 20, m: 3 }, { jacket: 0xf0b820, accent: 0xffffff, style: 'tech' }, 'legendary'),
  it('jk_race', 'jacket', 'Aero Race Suit', 600, C, { jacket: 0x14264d, accent: 0xff2a2a, style: 'race' }, 'epic'),
  it('jk_frost', 'jacket', 'Frost Weave Jacket', 450, C, { jacket: 0x9fd8ff, accent: 0xffffff, style: 'tech' }, 'rare'),
  it('jk_puffer', 'jacket', 'Summit Puffer', 350, C, { jacket: 0x3a3a4a, accent: 0xffd23d, style: 'puffer' }, 'uncommon'),
  it('jk_hoodie', 'jacket', 'Street Hoodie', 400, C, { jacket: 0x8a2a5a, accent: 0xffffff, style: 'hoodie' }, 'rare'),
  it('jk_hoodie_neon', 'jacket', 'Neon Hoodie', 450, C, { jacket: 0x23232e, accent: 0x39ff88, style: 'hoodie' }, 'rare'),
  it('jk_teal', 'jacket', 'Endurance Teal Jacket', 300, C, { jacket: 0x0f8a7a, accent: 0xffffff, style: 'tech' }, 'uncommon'),
  it('jk_rust', 'jacket', 'Trail Rust Jacket', 250, C, { jacket: 0xa34a24, accent: 0xffd23d, style: 'tech' }, 'uncommon'),
  it('jk_violet', 'jacket', 'Voltage Race Suit', 500, C, { jacket: 0x2a1a4a, accent: 0xb07fff, style: 'race' }, 'rare'),
  // Pants
  it('pt_navy', 'pants', 'Navy Ski Pants', 0, F, { color: 0x1c2a4a }, 'common'),
  it('pt_charcoal', 'pants', 'Charcoal Pants', 0, F, { color: 0x2a2a34 }, 'common'),
  it('pt_forest', 'pants', 'Forest Pants', 150, C, { color: 0x3a3a2a }, 'common'),
  it('pt_pink', 'pants', 'Neon Pants', 200, C, { color: 0x2a1c4a }, 'uncommon'),
  it('pt_arctic', 'pants', 'Arctic Pants', 0, { t: 'event', e: 5, m: 1 }, { color: 0x8aa0b8 }, 'common'),
  it('pt_black', 'pants', 'Midnight Pants', 300, C, { color: 0x101218 }, 'uncommon'),
  it('pt_purple', 'pants', 'Sunset Pants', 0, { t: 'event', e: 11, m: 2 }, { color: 0x5a2a5a }, 'common'),
  it('pt_gold', 'pants', 'Champion Pants', 0, { t: 'event', e: 20, m: 3 }, { color: 0x1a1c24 }, 'legendary'),
  it('pt_white', 'pants', 'Snow White Pants', 200, C, { color: 0xf2f4f8 }, 'uncommon'),
  it('pt_baggy', 'pants', 'Baggy Street Pants', 250, C, { color: 0x23232e, wide: true }, 'uncommon'),
  // Helmets
  it('hm_classic', 'helmet', 'Classic', 0, F, { color: 0xf2f4f8, style: 'classic' }, 'common'),
  it('hm_racer', 'helmet', 'Racer', 150, C, { color: 0x20242e, style: 'racer' }, 'common'),
  it('hm_fin', 'helmet', 'Shark Fin', 350, C, { color: 0x2f7be8, style: 'fin' }, 'uncommon'),
  it('hm_ears', 'helmet', 'Cat Ears', 400, C, { color: 0xff8fd0, style: 'ears' }, 'rare'),
  it('hm_horns', 'helmet', 'Viking', 0, { t: 'event', e: 6, m: 1 }, { color: 0xb8b0a0, style: 'horns' }, 'common'),
  it('hm_gold', 'helmet', 'Golden Racer', 0, { t: 'level', l: 15 }, { color: 0xf0b820, style: 'racer' }, 'legendary'),
  it('hm_none', 'helmet', 'No Helmet', 0, F, { color: 0xffffff, style: 'none' }, 'common'),
  // Headwear
  it('hw_none', 'headwear', 'No Headwear', 0, F, { kind: 'none' }, 'common'),
  it('hm_beanie', 'headwear', 'Wool Beanie', 200, C, { kind: 'beanie', color: 0xd64a4a }, 'uncommon'),
  it('hw_cap', 'headwear', 'Sport Cap', 150, C, { kind: 'cap', color: 0x2f7be8 }, 'common'),
  it('hw_bandana', 'headwear', 'Racer Bandana', 120, C, { kind: 'bandana', color: 0xd62a2a }, 'common'),
  it('hw_phones', 'headwear', 'Studio Headphones', 300, C, { kind: 'phones', color: 0x1a1c24 }, 'uncommon'),
  // Hair
  it('hr_fade', 'hair', 'Short Fade', 0, F, { style: 'fade', color: 0x2a1c12 }, 'common'),
  it('hr_crop', 'hair', 'Textured Crop', 100, C, { style: 'crop', color: 0x1a1a1a }, 'common'),
  it('hr_curly', 'hair', 'Curly Top', 200, C, { style: 'curly', color: 0x3a2410 }, 'uncommon'),
  it('hr_long', 'hair', 'Long Flow', 250, C, { style: 'long', color: 0x6a4a2a }, 'uncommon'),
  it('hr_wavy', 'hair', 'Wavy Mid', 200, C, { style: 'wavy', color: 0x2a2a2a }, 'uncommon'),
  it('hr_messy', 'hair', 'Messy Bedhead', 150, C, { style: 'messy', color: 0x4a2a10 }, 'common'),
  it('hr_braid', 'hair', 'Braided', 300, C, { style: 'braid', color: 0x1a1a1a }, 'uncommon'),
  it('hr_pony', 'hair', 'Ponytail', 250, C, { style: 'pony', color: 0x2a1c12 }, 'uncommon'),
  it('hr_blonde', 'hair', 'Blonde Waves', 300, C, { style: 'wavy', color: 0xe8c860 }, 'uncommon'),
  it('hr_silver', 'hair', 'Silver Crop', 350, C, { style: 'crop', color: 0xc8ccd4 }, 'uncommon'),
  // Goggles
  it('gg_orange', 'goggles', 'Sunset Lens', 0, F, { lens: 0xff9a2a, frame: 0x1a1c24 }, 'common'),
  it('gg_blue', 'goggles', 'Ice Lens', 80, C, { lens: 0x3aa0ff, frame: 0x1a1c24 }, 'common'),
  it('gg_mirror', 'goggles', 'Mirror Silver', 150, C, { lens: 0xd8e4f0, frame: 0x303642 }, 'common'),
  it('gg_green', 'goggles', 'Emerald', 150, C, { lens: 0x30d080, frame: 0x1a1c24 }, 'common'),
  it('gg_pink', 'goggles', 'Candy', 250, C, { lens: 0xff6fb8, frame: 0xffffff }, 'uncommon'),
  it('gg_gold', 'goggles', 'Gold Mirror', 450, C, { lens: 0xf5c63a, frame: 0x303642 }, 'rare'),
  it('gg_none', 'goggles', 'No Goggles', 0, F, { lens: 0x000000, frame: 0x000000 }, 'common'),
  // Glasses
  it('gs_none', 'glasses', 'No Glasses', 0, F, { lens: 0, frame: 0 }, 'common'),
  it('gs_sun', 'glasses', 'Aviator Sunglasses', 150, C, { lens: 0x1a1c24, frame: 0xc8a860 }, 'common'),
  it('gs_sport', 'glasses', 'Sport Shades', 250, C, { lens: 0x3aa0ff, frame: 0x1a1c24 }, 'uncommon'),
  it('gs_round', 'glasses', 'Retro Rounds', 200, C, { lens: 0x8a5a2a, frame: 0xd64a4a }, 'uncommon'),
  // Face accessories
  it('fa_none', 'faceAcc', 'None', 0, F, { kind: 'none' }, 'common'),
  it('fa_mask', 'faceAcc', 'Face Mask', 180, C, { kind: 'mask', color: 0x1a1c24 }, 'common'),
  it('fa_warmer', 'faceAcc', 'Neck Warmer', 150, C, { kind: 'warmer', color: 0x2f7be8 }, 'common'),
  it('fa_paint', 'faceAcc', 'War Paint', 120, C, { kind: 'paint', color: 0xd62a2a }, 'common'),
  // Gloves
  it('gl_black', 'gloves', 'Black', 0, F, { color: 0x1a1c24 }, 'common'),
  it('gl_red', 'gloves', 'Red', 60, C, { color: 0xd62a2a }, 'common'),
  it('gl_white', 'gloves', 'White', 100, C, { color: 0xf2f4f8 }, 'common'),
  it('gl_blue', 'gloves', 'Blue', 60, C, { color: 0x2f7be8 }, 'common'),
  it('gl_gold', 'gloves', 'Gold', 400, C, { color: 0xf0b820 }, 'rare'),
  // Boots
  it('bt_black', 'boots', 'Stealth Boots', 0, F, { color: 0x24262e }, 'common'),
  it('bt_red', 'boots', 'Racing Boots', 100, C, { color: 0xd62a2a }, 'common'),
  it('bt_blue', 'boots', 'Glacier Boots', 100, C, { color: 0x2f7be8 }, 'common'),
  it('bt_white', 'boots', 'Snow Boots', 150, C, { color: 0xf2f4f8 }, 'common'),
  it('bt_gold', 'boots', 'Champion Boots', 400, C, { color: 0xf0b820 }, 'rare'),
  // Back
  it('bk_none', 'back', 'None', 0, F, { kind: 'none' }, 'common'),
  it('bk_backpack', 'back', 'Backpack', 300, C, { kind: 'backpack', color: 0x2f7be8 }, 'uncommon'),
  it('bk_cape', 'back', 'Hero Cape', 650, C, { kind: 'cape', color: 0xd62a2a }, 'epic'),
  // Special
  it('sp_none', 'special', 'None', 0, F, { kind: 'none' }, 'common'),
  it('sp_scarf', 'special', 'Racing Scarf', 150, C, { kind: 'scarf', color: 0xff4a3a }, 'common'),
  it('sp_antenna', 'special', 'Lucky Antenna', 200, C, { kind: 'antenna', color: 0x5fe08a }, 'uncommon'),
  it('sp_tail', 'special', 'Fox Tail', 450, C, { kind: 'tail', color: 0xff8a2a }, 'rare'),
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const itemsOf = (cat: Cat) => ITEMS.filter((i) => i.cat === cat);

export function skiStats(look: Look) {
  const s = itemById(look.ski)?.d ?? {};
  return { top: s.top ?? 1, grip: s.grip ?? 1, boost: s.boost ?? 1 };
}

// ---------- Characters ----------
export type FaceVariant = 'sharp' | 'round' | 'freckles' | 'stubble' | 'soft' | 'bold';
export type HairStyle = 'fade' | 'crop' | 'curly' | 'long' | 'wavy' | 'messy' | 'braid' | 'pony';
export interface CharacterMods { top?: number; grip?: number; steer?: number; accel?: number; boostRegen?: number; boostDrain?: number; crashDur?: number; air?: number; }
export interface CharacterBuild { height: number; bulk: number; }
export interface CharacterVisuals { skin: number; eyeColor: number; face: FaceVariant; hairColor: number; }
export interface CharacterDef {
  id: string; name: string; title: string; desc: string; rarity: Rarity; price: number;
  skin: number; eyeColor: number; face: FaceVariant;
  hair: HairStyle; hairColor: number; headwear: string;
  defaultLook: Look; build: CharacterBuild; mods: CharacterMods;
}
export const CHARACTERS: CharacterDef[] = [
  { id: 'rookie', name: 'Alex "Rookie" Hart', title: 'The Starter', desc: 'Fresh boots, big dreams. The balanced default every rider starts with.', rarity: 'common', price: 0,
    skin: 0xf0c29a, eyeColor: 0x3a2a1a, face: 'soft', hair: 'fade', hairColor: 0x2a1c12, headwear: 'hw_none', build: { height: 1, bulk: 1 }, mods: {},
    defaultLook: { ...DEFAULT_LOOK } },
  { id: 'marcus', name: 'Marcus Vale', title: 'The Professional', desc: 'Aero race suit, precision lines, zero wasted motion.', rarity: 'rare', price: 1500,
    skin: 0xf0c29a, eyeColor: 0x2a4a6a, face: 'sharp', hair: 'crop', hairColor: 0x1a1a1a, headwear: 'hw_none', build: { height: 1.02, bulk: 1.0 }, mods: { grip: 1.05 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_blue', skiDesign: 'sd_stripes', jacket: 'jk_race', pants: 'pt_navy', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_crop', goggles: 'gg_mirror', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_black', back: 'bk_none', special: 'sp_none' } },
  { id: 'kira', name: 'Kira Swift', title: 'The Speedster', desc: 'Streamlined, feather-light, always a tenth ahead.', rarity: 'uncommon', price: 900,
    skin: 0xf2c9a8, eyeColor: 0x1a8a7a, face: 'soft', hair: 'pony', hairColor: 0x1a1a1a, headwear: 'hw_none', build: { height: 0.96, bulk: 0.92 }, mods: { top: 1.03, accel: 1.02 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_cyan', skiDesign: 'sd_chevron', jacket: 'jk_frost', pants: 'pt_white', helmet: 'hm_fin', headwear: 'hw_none', hair: 'hr_pony', goggles: 'gg_blue', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_none' } },
  { id: 'jax', name: 'Jax Moreno', title: 'The Freestyler', desc: 'Oversized hoodie, loud colours, bigger air than anyone.', rarity: 'epic', price: 2000,
    skin: 0xc98a5a, eyeColor: 0x3a2a1a, face: 'round', hair: 'curly', hairColor: 0x1a1a1a, headwear: 'hm_beanie', build: { height: 1.0, bulk: 1.12 }, mods: { air: 1.05 },
    defaultLook: { ski: 'ski_powder', skiColor: 'sc_pink', skiDesign: 'sd_stars', jacket: 'jk_hoodie', pants: 'pt_baggy', helmet: 'hm_none', headwear: 'hm_beanie', hair: 'hr_curly', goggles: 'gg_none', glasses: 'gs_sun', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_red', back: 'bk_backpack', special: 'sp_none' } },
  { id: 'nadia', name: 'Nadia Frost', title: 'The Survivor', desc: 'Rugged shell, packed bag, walks away from every crash.', rarity: 'uncommon', price: 1100,
    skin: 0xe8b88a, eyeColor: 0x4a6a3a, face: 'freckles', hair: 'braid', hairColor: 0x3a2410, headwear: 'hw_none', build: { height: 1.03, bulk: 1.06 }, mods: { crashDur: 0.92 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_green', skiDesign: 'sd_camo', jacket: 'jk_forest', pants: 'pt_forest', helmet: 'hm_classic', headwear: 'hw_none', hair: 'hr_braid', goggles: 'gg_green', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_black', back: 'bk_backpack', special: 'sp_scarf' } },
  { id: 'ren', name: 'Ren Takahashi', title: 'The Booster', desc: 'Futuristic suit, glowing accents, boost always ready.', rarity: 'rare', price: 1700,
    skin: 0xf0c8a0, eyeColor: 0x7b3ae0, face: 'sharp', hair: 'crop', hairColor: 0x1a1a1a, headwear: 'hw_none', build: { height: 0.98, bulk: 0.98 }, mods: { boostRegen: 1.06 },
    defaultLook: { ski: 'ski_aurora', skiColor: 'sc_purple', skiDesign: 'sd_checker', jacket: 'jk_violet', pants: 'pt_black', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_crop', goggles: 'gg_mirror', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_black', back: 'bk_none', special: 'sp_antenna' } },
  { id: 'elena', name: 'Elena Rossi', title: 'The Endurance Athlete', desc: 'Teal endurance kit, long ponytail, never runs dry.', rarity: 'rare', price: 1300,
    skin: 0xf0c29a, eyeColor: 0x2a6a5a, face: 'soft', hair: 'pony', hairColor: 0x6a4a2a, headwear: 'hw_none', build: { height: 0.97, bulk: 0.94 }, mods: { boostDrain: 0.952 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_blue', skiDesign: 'sd_stripes', jacket: 'jk_teal', pants: 'pt_navy', helmet: 'hm_none', headwear: 'hw_none', hair: 'hr_pony', goggles: 'gg_blue', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_none' } },
  { id: 'vera', name: 'Vera Lindqvist', title: 'The Technician', desc: 'Clean white steel, surgical turns, perfect lines.', rarity: 'uncommon', price: 800,
    skin: 0xf6d0b0, eyeColor: 0x3a6a9a, face: 'sharp', hair: 'fade', hairColor: 0xe8c860, headwear: 'hw_none', build: { height: 1.01, bulk: 0.96 }, mods: { steer: 1.05 },
    defaultLook: { ski: 'ski_carbon', skiColor: 'sc_white', skiDesign: 'sd_solid', jacket: 'jk_frost', pants: 'pt_white', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_fade', goggles: 'gg_mirror', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_none' } },
  { id: 'sam', name: 'Sam Carter', title: 'The All-Rounder', desc: 'Solid everywhere, flashy nowhere. The reliable pick.', rarity: 'common', price: 500,
    skin: 0xd8a06a, eyeColor: 0x2a2a2a, face: 'bold', hair: 'crop', hairColor: 0x1a1a1a, headwear: 'hw_none', build: { height: 1.0, bulk: 1.02 }, mods: { top: 1.02, grip: 1.02, boostRegen: 1.02 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_red', skiDesign: 'sd_stripes', jacket: 'jk_red', pants: 'pt_charcoal', helmet: 'hm_classic', headwear: 'hw_none', hair: 'hr_crop', goggles: 'gg_orange', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_red', boots: 'bt_black', back: 'bk_none', special: 'sp_none' } },
  { id: 'tomas', name: 'Tomas Berg', title: 'The Adventurer', desc: 'Rust shell, messy hair, backpack full of trail mix.', rarity: 'common', price: 700,
    skin: 0xe0a878, eyeColor: 0x5a3a1a, face: 'stubble', hair: 'messy', hairColor: 0x4a2a10, headwear: 'hm_beanie', build: { height: 1.05, bulk: 1.1 }, mods: { grip: 1.03, crashDur: 0.96 },
    defaultLook: { ski: 'ski_powder', skiColor: 'sc_orange', skiDesign: 'sd_camo', jacket: 'jk_rust', pants: 'pt_forest', helmet: 'hm_none', headwear: 'hm_beanie', hair: 'hr_messy', goggles: 'gg_orange', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_black', boots: 'bt_black', back: 'bk_backpack', special: 'sp_scarf' } },
  { id: 'zoe', name: 'Zoe Laurent', title: 'The Competitor', desc: 'Team red, race bib energy, wins on pure hunger.', rarity: 'epic', price: 1800,
    skin: 0xf2c9a8, eyeColor: 0x2a4a6a, face: 'soft', hair: 'pony', hairColor: 0x3a2410, headwear: 'hw_bandana', build: { height: 0.98, bulk: 0.96 }, mods: { top: 1.02, boostRegen: 1.04 },
    defaultLook: { ski: 'ski_pro', skiColor: 'sc_red', skiDesign: 'sd_chevron', jacket: 'jk_race', pants: 'pt_charcoal', helmet: 'hm_none', headwear: 'hw_bandana', hair: 'hr_pony', goggles: 'gg_blue', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_none' } },
  { id: 'anya', name: 'Anya Volkov', title: 'The Ice Specialist', desc: 'Frost-pattern kit, crystal lenses, ice in her veins.', rarity: 'legendary', price: 2600,
    skin: 0xf6d8c0, eyeColor: 0x2a8ab0, face: 'round', hair: 'long', hairColor: 0xe8c860, headwear: 'hw_none', build: { height: 0.99, bulk: 0.95 }, mods: { grip: 1.03, air: 1.03 },
    defaultLook: { ski: 'ski_aurora', skiColor: 'sc_cyan', skiDesign: 'sd_stars', jacket: 'jk_frost', pants: 'pt_arctic', helmet: 'hm_racer', headwear: 'hw_none', hair: 'hr_long', goggles: 'gg_mirror', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_white', boots: 'bt_white', back: 'bk_none', special: 'sp_none' } },
  { id: 'kai', name: 'Kai Tanaka', title: 'The Legend', desc: 'Gold and black, hero cape, the one everyone chases.', rarity: 'mythic', price: 3500,
    skin: 0xe8b88a, eyeColor: 0x1a1a1a, face: 'bold', hair: 'fade', hairColor: 0x1a1a1a, headwear: 'hw_none', build: { height: 1.04, bulk: 1.04 }, mods: { top: 1.02, grip: 1.02, boostRegen: 1.02, boostDrain: 0.98 },
    defaultLook: { ski: 'ski_comet', skiColor: 'sc_gold', skiDesign: 'sd_stars', jacket: 'jk_gold', pants: 'pt_black', helmet: 'hm_gold', headwear: 'hw_none', hair: 'hr_fade', goggles: 'gg_gold', glasses: 'gs_none', faceAcc: 'fa_none', gloves: 'gl_gold', boots: 'bt_gold', back: 'bk_cape', special: 'sp_none' } },
];
export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id);
export function characterMods(id: string): CharacterMods { return characterById(id)?.mods ?? {}; }
export function charVisualsOf(c: CharacterDef | undefined): { build: CharacterBuild; char: CharacterVisuals } {
  const d = c ?? CHARACTERS[0];
  return { build: d.build, char: { skin: d.skin, eyeColor: d.eyeColor, face: d.face, hairColor: d.hairColor } };
}
/** Selected character's default look + stored per-character overrides. */
export function resolveCharLook(c: CharacterDef, overrides?: Partial<Look>): Look {
  return { ...c.defaultLook, ...(overrides ?? {}) };
}
export function modsText(m: CharacterMods): string {
  const parts: string[] = [];
  if (m.top) parts.push(`Speed +${Math.round((m.top - 1) * 100)}%`);
  if (m.grip) parts.push(`Handling +${Math.round((m.grip - 1) * 100)}%`);
  if (m.steer) parts.push(`Steering +${Math.round((m.steer - 1) * 100)}%`);
  if (m.accel) parts.push(`Acceleration +${Math.round((m.accel - 1) * 100)}%`);
  if (m.boostRegen) parts.push(`Boost regen +${Math.round((m.boostRegen - 1) * 100)}%`);
  if (m.boostDrain) parts.push(`Boost lasts +${Math.round((1 - m.boostDrain) * 100)}%`);
  if (m.crashDur) parts.push(`Crash recovery ${Math.round((1 - m.crashDur) * 100)}% faster`);
  if (m.air) parts.push(`Aerial control +${Math.round((m.air - 1) * 100)}%`);
  return parts.length ? parts.join(' · ') : 'Balanced — no passive bonus';
}

// ---------- Migration maps (old outfit/accessory ids -> new slots) ----------
export const OUTFIT_SPLIT: Record<string, { jacket: string; pants: string }> = {
  of_blue: { jacket: 'jk_blue', pants: 'pt_navy' }, of_red: { jacket: 'jk_red', pants: 'pt_charcoal' },
  of_forest: { jacket: 'jk_forest', pants: 'pt_forest' }, of_pink: { jacket: 'jk_pink', pants: 'pt_pink' },
  of_arctic: { jacket: 'jk_arctic', pants: 'pt_arctic' }, of_black: { jacket: 'jk_black', pants: 'pt_black' },
  of_sunset: { jacket: 'jk_sunset', pants: 'pt_purple' }, of_gold: { jacket: 'jk_gold', pants: 'pt_gold' },
};
export const ACCESSORY_SPLIT: Record<string, { back: string; special: string }> = {
  ac_none: { back: 'bk_none', special: 'sp_none' }, ac_scarf: { back: 'bk_none', special: 'sp_scarf' },
  ac_backpack: { back: 'bk_backpack', special: 'sp_none' }, ac_antenna: { back: 'bk_none', special: 'sp_antenna' },
  ac_tail: { back: 'bk_none', special: 'sp_tail' }, ac_cape: { back: 'bk_cape', special: 'sp_none' },
};

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
