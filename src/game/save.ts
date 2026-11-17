import { useSyncExternalStore } from 'react';
import { DEFAULT_LOOK, ITEMS, Look, itemById } from './data';

export type Quality = 'low' | 'medium' | 'high';
export interface Settings {
  quality: Quality; resScale: number; sfx: number; music: number; camSens: number;
  shadows: boolean; particles: boolean; showFps: boolean; speedFx: boolean;
}
export interface Stats {
  races: number; wins: number; podiums: number; crashes: number; coinsCollected: number;
  distance: number; playTime: number; topSpeed: number; jumps: number; endlessRuns: number; coinsSpent: number;
}
export interface SaveData {
  v: 1; coins: number; xp: number;
  medals: Record<string, number>;
  bestTimes: Record<string, number>;
  owned: string[]; equipped: Look; settings: Settings; stats: Stats;
  endlessBest: { distance: number; score: number };
}

// NOTE: keep the original storage key — renaming it would wipe every existing
// player's career, coins and unlocks. Display branding is "Mount Rush";
// only this key stays as-is.
const KEY = 'powder-rush-save-v1';

export const defaultSettings = (): Settings => ({
  quality: 'medium', resScale: 1, sfx: 0.8, music: 0.5, camSens: 1,
  shadows: true, particles: true, showFps: false, speedFx: true,
});
const defaultStats = (): Stats => ({
  races: 0, wins: 0, podiums: 0, crashes: 0, coinsCollected: 0, distance: 0, playTime: 0,
  topSpeed: 0, jumps: 0, endlessRuns: 0, coinsSpent: 0,
});

export function defaultSave(): SaveData {
  return {
    v: 1, coins: 100, xp: 0, medals: {}, bestTimes: {},
    owned: ITEMS.filter((i) => i.unlock.t === 'free').map((i) => i.id),
    equipped: { ...DEFAULT_LOOK }, settings: defaultSettings(), stats: defaultStats(),
    endlessBest: { distance: 0, score: 0 },
  };
}

const num = (v: unknown, d: number, min = 0, max = 1e12) =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function validate(raw: any): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  try {
    d.coins = Math.floor(num(raw.coins, d.coins));
    d.xp = Math.floor(num(raw.xp, 0));
    if (raw.medals && typeof raw.medals === 'object')
      for (const k of Object.keys(raw.medals)) d.medals[k] = Math.round(num(raw.medals[k], 0, 0, 3));
    if (raw.bestTimes && typeof raw.bestTimes === 'object')
      for (const k of Object.keys(raw.bestTimes)) { const t = num(raw.bestTimes[k], 0); if (t > 5) d.bestTimes[k] = t; }
    if (Array.isArray(raw.owned))
      for (const id of raw.owned) if (typeof id === 'string' && itemById(id) && !d.owned.includes(id)) d.owned.push(id);
    if (raw.equipped && typeof raw.equipped === 'object') {
      for (const k of Object.keys(d.equipped) as (keyof Look)[]) {
        const id = raw.equipped[k];
        const item = typeof id === 'string' ? itemById(id) : undefined;
        if (item && item.cat === k && d.owned.includes(id)) d.equipped[k] = id;
      }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      const s = raw.settings, ds = d.settings;
      if (['low', 'medium', 'high'].includes(s.quality)) ds.quality = s.quality;
      ds.resScale = num(s.resScale, ds.resScale, 0.5, 1);
      ds.sfx = num(s.sfx, ds.sfx, 0, 1); ds.music = num(s.music, ds.music, 0, 1);
      ds.camSens = num(s.camSens, ds.camSens, 0.4, 1.6);
      for (const k of ['shadows', 'particles', 'showFps', 'speedFx'] as const) if (typeof s[k] === 'boolean') ds[k] = s[k];
    }
    if (raw.stats && typeof raw.stats === 'object')
      for (const k of Object.keys(d.stats) as (keyof Stats)[]) d.stats[k] = num(raw.stats[k], 0);
    if (raw.endlessBest) {
      d.endlessBest.distance = num(raw.endlessBest.distance, 0);
      d.endlessBest.score = num(raw.endlessBest.score, 0);
    }
  } catch {
    return defaultSave();
  }
  return d;
}

function load(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return defaultSave();
    return validate(JSON.parse(s));
  } catch {
    return defaultSave();
  }
}

let current: SaveData = load();
const listeners = new Set<() => void>();
let pending = false;

function persist() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  });
}

export const getSave = () => current;
export function updateSave(fn: (d: SaveData) => void) {
  const next: SaveData = JSON.parse(JSON.stringify(current));
  fn(next);
  current = next;
  persist();
  listeners.forEach((l) => l());
}
export function resetSave() {
  current = defaultSave();
  persist();
  listeners.forEach((l) => l());
}
export function useSave(): SaveData {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => current,
  );
}
