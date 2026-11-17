import { CourseDef, DEFAULT_LOOK, EVENTS, EnvId, ENVS, Look, OPPONENTS, courseById, skiStats } from './data';
import { RaceConfig, RacerCfg } from './race';
import { SaveData } from './save';
import { clamp } from './util';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFF_VALUE: Record<Difficulty, number> = { easy: 0.2, normal: 0.5, hard: 0.85 };

export type RaceSetup =
  | { mode: 'career'; eventId: string }
  | { mode: 'quick'; courseId: string; diff: Difficulty }
  | { mode: 'endless'; env: EnvId }
  | { mode: 'versus'; courseId: string; ai: boolean };

export function endlessCourse(env: EnvId): CourseDef {
  return { id: `endless-${env}`, env, name: `Endless ${ENVS[env].name}`, length: Infinity, seed: 4242 + env.length * 31, curve: 0.65, density: 0.4, blurb: 'Ski forever.' };
}

function aiRacers(count: number, diff: number, rot: number): RacerCfg[] {
  const list = [...OPPONENTS];
  const out: RacerCfg[] = [];
  for (let i = 0; i < count; i++) {
    const o = list[(i + rot) % list.length];
    const skill = clamp(o.skill * 0.45 + diff * 0.55 + 0.1, 0.3, 0.97);
    out.push({
      name: o.name, look: o.look, human: false, slot: -1, color: o.color, skill,
      personality: { skill, aggr: o.aggr, caution: o.caution, jump: o.jump, boost: o.boost },
      top: 0.985 + diff * 0.04, grip: 1, boost: 1,
    });
  }
  return out;
}

function humanLook(look: Look, slot: number): Look {
  if (slot === 0) return look;
  return { ...look, outfit: look.outfit === 'of_red' ? 'of_blue' : 'of_red', skiColor: look.skiColor === 'sc_cyan' ? 'sc_orange' : 'sc_cyan' };
}

export function opponentsFor(setup: RaceSetup): string[] {
  if (setup.mode === 'career') {
    const e = EVENTS.find((x) => x.id === setup.eventId)!;
    return aiRacers(5, e.diff, e.index).map((a) => a.name);
  }
  return aiRacers(5, 0.5, 0).map((a) => a.name);
}

export function buildConfig(setup: RaceSetup, save: SaveData): RaceConfig {
  const look = { ...DEFAULT_LOOK, ...save.equipped };
  const st = skiStats(look);
  const human = (slot: number, name: string, color: string): RacerCfg => ({
    name, look: humanLook(look, slot), human: true, slot, color, top: st.top, grip: st.grip, boost: st.boost,
  });
  switch (setup.mode) {
    case 'career': {
      const e = EVENTS.find((x) => x.id === setup.eventId)!;
      return {
        mode: 'career', course: courseById(e.course), settings: save.settings, eventId: e.id, coinMul: e.extraCoins ? 1.7 : 1,
        racers: [human(0, 'You', '#4db3ff'), ...aiRacers(5, e.diff, e.index)],
      };
    }
    case 'quick':
      return { mode: 'quick', course: courseById(setup.courseId), settings: save.settings, racers: [human(0, 'You', '#4db3ff'), ...aiRacers(5, DIFF_VALUE[setup.diff], Math.floor(Math.random() * 6))] };
    case 'endless':
      return { mode: 'endless', course: endlessCourse(setup.env), settings: save.settings, racers: [human(0, 'You', '#4db3ff')] };
    case 'versus':
      return {
        mode: 'versus', course: courseById(setup.courseId), settings: save.settings,
        racers: [human(0, 'Player 1', '#4db3ff'), human(1, 'Player 2', '#ff8a3d'), ...(setup.ai ? aiRacers(3, 0.4, Math.floor(Math.random() * 6)) : [])],
      };
  }
}
