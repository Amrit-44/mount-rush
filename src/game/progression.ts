import { CareerEvent, EVENTS, ITEMS, Objective, levelFromXp } from './data';
import { SaveData } from './save';

export interface PlayerOutcome {
  slot: number; position: number; total: number; time: number | null; finished: boolean;
  coins: number; crashes: number; mistakes: number; topSpeed: number; distance: number; jumps: number;
}
export interface RaceResult {
  mode: 'career' | 'quick' | 'endless' | 'versus';
  courseId: string; eventId?: string;
  players: PlayerOutcome[];
  standings: { name: string; time: number | null; human: boolean; slot: number; color: string; position: number }[];
  endless?: { distance: number; score: number; coins: number; maxSpeed: number };
  winnerSlot?: number;
  duration: number;
}
export interface Summary {
  medal: number; newMedal: boolean; coinsRace: number; coinsCollected: number; coinsBonus: number; coinsTotal: number;
  xp: number; levelUp: number | null; pb: boolean; unlocked: string[]; bestDistance: boolean; label: string;
}

export function medalFor(o: Objective, p: PlayerOutcome): number {
  if (!p.finished) return 0;
  let v: number;
  const better = (g: number, s: number, b: number, val: number, lowerIsBetter: boolean) => {
    if (lowerIsBetter) return val <= g ? 3 : val <= s ? 2 : val <= b ? 1 : 0;
    return val >= g ? 3 : val >= s ? 2 : val >= b ? 1 : 0;
  };
  switch (o.kind) {
    case 'position': v = better(o.gold, o.silver, o.bronze, p.position, true); break;
    case 'time': v = better(o.gold, o.silver, o.bronze, p.time ?? 9999, true); break;
    case 'clean': v = better(o.gold, o.silver, o.bronze, p.crashes, true); break;
    case 'coins': v = better(o.gold, o.silver, o.bronze, p.coins, false); break;
    case 'mistakes': v = better(o.gold, o.silver, o.bronze, p.mistakes, true); break;
  }
  // Non-position events still require a reasonable finish (top 5 of 6)
  if (o.kind !== 'position' && p.position > 5) v = Math.min(v, 1);
  return v;
}

export const medalPoints = (s: SaveData) => Object.values(s.medals).reduce((a, b) => a + b, 0);

export function eventUnlocked(s: SaveData, e: CareerEvent): boolean {
  if (e.index === 0) return true;
  const prev = EVENTS[e.index - 1];
  return (s.medals[prev.id] ?? 0) > 0 && medalPoints(s) >= e.gate;
}
export function eventLockReason(s: SaveData, e: CareerEvent): string {
  const prev = EVENTS[e.index - 1];
  if (prev && !(s.medals[prev.id] ?? 0)) return `Complete "${prev.name}" first`;
  if (medalPoints(s) < e.gate) return `Need ${e.gate} medal points (you have ${medalPoints(s)})`;
  return '';
}
export const courseUnlocked = (s: SaveData, courseId: string) =>
  EVENTS.some((e) => e.course === courseId && eventUnlocked(s, e));
export const envUnlocked = (s: SaveData, env: string) =>
  env === 'forest' || (env === 'peak' && eventUnlocked(s, EVENTS[7])) || (env === 'valley' && eventUnlocked(s, EVENTS[14]));

export function itemUnlockMet(s: SaveData, id: string): boolean {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) return false;
  const u = it.unlock;
  if (u.t === 'free') return true;
  if (u.t === 'level') return levelFromXp(s.xp).level >= u.l;
  if (u.t === 'event') return (s.medals[EVENTS[u.e].id] ?? 0) >= u.m;
  return false;
}
export function unlockText(id: string): string {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) return '';
  const u = it.unlock;
  if (u.t === 'level') return `Reach level ${u.l}`;
  if (u.t === 'event') return `${['', 'Bronze', 'Silver', 'Gold'][u.m]}+ in "${EVENTS[u.e].name}"`;
  if (u.t === 'coins') return `${it.price} coins`;
  return 'Free';
}

/** Grants non-purchasable items whose unlock conditions are met. Returns newly unlocked ids. */
export function syncUnlocks(s: SaveData): string[] {
  const out: string[] = [];
  for (const it of ITEMS) {
    if (it.unlock.t !== 'coins' && !s.owned.includes(it.id) && itemUnlockMet(s, it.id)) { s.owned.push(it.id); out.push(it.id); }
  }
  return out;
}

export function applyResult(s: SaveData, r: RaceResult, eventLookup?: CareerEvent): Summary {
  const sum: Summary = {
    medal: 0, newMedal: false, coinsRace: 0, coinsCollected: 0, coinsBonus: 0, coinsTotal: 0,
    xp: 0, levelUp: null, pb: false, unlocked: [], bestDistance: false, label: '',
  };
  const oldLevel = levelFromXp(s.xp).level;
  const st = s.stats;
  const hum = r.players;
  st.playTime += r.duration;
  for (const p of hum) {
    st.crashes += p.crashes; st.coinsCollected += p.coins; st.distance += p.distance;
    st.topSpeed = Math.max(st.topSpeed, p.topSpeed); st.jumps += p.jumps;
  }
  const p0 = hum[0];

  if (r.mode === 'endless' && r.endless) {
    st.endlessRuns++;
    const e = r.endless;
    sum.coinsCollected = e.coins;
    sum.coinsRace = Math.floor(e.distance / 40);
    const milestones = Math.floor(e.distance / 1000);
    sum.coinsBonus = milestones * 40;
    if (e.distance > s.endlessBest.distance) { sum.bestDistance = true; sum.coinsBonus += 50; s.endlessBest.distance = e.distance; }
    if (e.score > s.endlessBest.score) s.endlessBest.score = e.score;
    sum.xp = Math.floor(e.distance / 25) + e.coins;
    sum.label = `${Math.round(e.distance)} m`;
  } else if (r.mode === 'versus') {
    st.races++;
    sum.coinsCollected = p0.coins;
    sum.coinsRace = p0.finished ? 40 : 10;
    sum.xp = 30 + p0.coins;
    if (r.winnerSlot === 0) { st.wins++; sum.coinsBonus = 40; sum.xp += 30; }
  } else {
    st.races++;
    if (p0.finished && p0.position === 1) st.wins++;
    if (p0.finished && p0.position <= 3) st.podiums++;
    sum.coinsCollected = p0.coins;
    const posReward = p0.finished ? [0, 120, 80, 50, 30, 20, 10][Math.min(6, p0.position)] ?? 10 : 0;
    sum.coinsRace = posReward;
    sum.xp = (p0.finished ? 40 : 10) + Math.max(0, 7 - p0.position) * 12 + p0.coins;
    if (p0.finished && p0.time) {
      const prev = s.bestTimes[r.courseId];
      if (!prev || p0.time < prev) {
        if (prev) { sum.pb = true; sum.coinsBonus += 30; }
        s.bestTimes[r.courseId] = p0.time;
        if (!prev) sum.pb = true;
      }
    }
    if (r.mode === 'career' && eventLookup) {
      const m = medalFor(eventLookup.objective, p0);
      sum.medal = m;
      const old = s.medals[eventLookup.id] ?? 0;
      if (m > old) {
        sum.newMedal = true;
        s.medals[eventLookup.id] = m;
        const first = old === 0;
        const mult = [0, 1, 1.5, 2][m];
        const gained = first ? eventLookup.reward * mult : eventLookup.reward * ([0, 1, 1.5, 2][m] - [0, 1, 1.5, 2][old]) * 0.8;
        sum.coinsBonus += Math.round(gained);
        sum.xp += Math.round(eventLookup.xp * ([0, 1, 1.5, 2][m] - (first ? 0 : [0, 1, 1.5, 2][old]) * 0.6));
      } else if (m > 0) {
        sum.coinsBonus += Math.round(eventLookup.reward * 0.2);
        sum.xp += Math.round(eventLookup.xp * 0.25);
      }
      sum.label = ['Not completed', 'Bronze', 'Silver', 'Gold'][m];
    }
  }
  sum.coinsTotal = sum.coinsRace + sum.coinsCollected + sum.coinsBonus;
  s.coins += sum.coinsTotal;
  s.xp += sum.xp;
  const nl = levelFromXp(s.xp).level;
  if (nl > oldLevel) { sum.levelUp = nl; s.coins += 50 * (nl - oldLevel); }
  sum.unlocked = syncUnlocks(s);
  return sum;
}
