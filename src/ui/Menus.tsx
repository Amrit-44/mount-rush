import { ReactNode, useMemo, useState } from 'react';
import { audio } from '../game/audio';
import { CHAPTERS, COURSES, CourseDef, ENVS, EVENTS, EnvId, CareerEvent, courseById, levelFromXp, objectiveTargets, objectiveText } from '../game/data';
import { courseUnlocked, envUnlocked, eventLockReason, eventUnlocked, medalPoints } from '../game/progression';
import { Quality, SaveData, resetSave, updateSave, useSave } from '../game/save';
import { Difficulty, RaceSetup, opponentsFor } from '../game/setup';
import { Track } from '../game/track';
import { fmtDist, fmtTime } from '../game/util';
import { Btn, Coin, Header, Medal, MenuBtn, Panel, Segmented, Slider, Stars, Toggle, XpBar, sfx } from './common';

const ENV_ICON: Record<EnvId, string> = { forest: '🌲', peak: '🏔️', valley: '❄️' };

// ---------------- track preview ----------------
const previewCache = new Map<string, { pts: [number, number][]; prof: [number, number][]; marks: { x: number; z: number; t: string }[]; len: number }>();
function getPreview(c: CourseDef) {
  let p = previewCache.get(c.id);
  if (p) return p;
  const T = new Track({ envId: c.env, seed: c.seed, length: c.length, curve: c.curve, density: c.density });
  T.ensure(c.length + 100);
  const pts: [number, number][] = [], prof: [number, number][] = [];
  for (let s = 0; s <= c.length; s += 12) { const q = T.query(s); pts.push([q.x, q.z]); prof.push([s, q.y]); }
  const marks: { x: number; z: number; t: string }[] = [];
  for (const r of T.ramps) if (r.s < c.length) { const q = T.query(r.s); marks.push({ x: q.x, z: q.z, t: 'ramp' }); }
  for (const b of T.bridges) { const q = T.query((b.s0 + b.s1) / 2); marks.push({ x: q.x, z: q.z, t: 'bridge' }); }
  p = { pts, prof, marks, len: c.length };
  previewCache.set(c.id, p);
  return p;
}
export function TrackPreview({ course, compact = false }: { course: CourseDef; compact?: boolean }) {
  const p = useMemo(() => getPreview(course), [course]);
  const [minX, maxX, minZ, maxZ] = useMemo(() => {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const [x, z] of p.pts) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); }
    return [a, b, c, d];
  }, [p]);
  const W = 120, H = compact ? 130 : 170, pad = 12;
  const sc = Math.min((W - pad * 2) / Math.max(10, maxX - minX), (H - pad * 2) / Math.max(10, maxZ - minZ));
  const tx = (x: number) => pad + (x - minX) * sc + (W - pad * 2 - (maxX - minX) * sc) / 2;
  const tz = (z: number) => pad + (z - minZ) * sc + (H - pad * 2 - (maxZ - minZ) * sc) / 2;
  const path = p.pts.map(([x, z], i) => `${i ? 'L' : 'M'}${tx(x).toFixed(1)},${tz(z).toFixed(1)}`).join(' ');
  const ys = p.prof.map((q) => q[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const prof = p.prof.map(([s, y], i) => `${i ? 'L' : 'M'}${((s / p.len) * 200).toFixed(1)},${(30 - ((y - y0) / (y1 - y0 + 1)) * 28).toFixed(1)}`).join(' ');
  const env = ENVS[course.env];
  return (
    <div className="flex gap-2 items-stretch">
      <svg viewBox={`0 0 ${W} ${H}`} className="rounded-xl bg-navy/60 border border-sky-300/20" style={{ width: compact ? 90 : 120, flexShrink: 0 }}>
        <path d={path} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="6" strokeLinecap="round" />
        <path d={path} fill="none" stroke={env.accent} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#fff" strokeWidth="1" strokeOpacity=".7" strokeLinecap="round" strokeDasharray="1 3" />
        {p.marks.map((m, i) => <circle key={i} cx={tx(m.x)} cy={tz(m.z)} r="2.4" fill={m.t === 'ramp' ? '#ff8a2a' : '#c08a52'} stroke="#000" strokeWidth=".5" />)}
        <circle cx={tx(p.pts[0][0])} cy={tz(p.pts[0][1])} r="3.6" fill="#44e08a" stroke="#fff" strokeWidth="1" />
        <circle cx={tx(p.pts[p.pts.length - 1][0])} cy={tz(p.pts[p.pts.length - 1][1])} r="3.6" fill="#fff" stroke="#111" strokeWidth="1.4" />
      </svg>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <svg viewBox="0 0 200 32" className="w-full rounded-lg bg-navy/60 border border-sky-300/20" preserveAspectRatio="none"><path d={prof} fill="none" stroke={env.accent} strokeWidth="1.8" /></svg>
        <div className="text-xs text-sky-200/80 leading-snug mt-1">
          <div>Length <b className="text-white">{(course.length / 1000).toFixed(1)} km</b></div>
          <div>Drop <b className="text-white">{Math.round(y1 - y0)} m</b></div>
          <div className="text-[10px] mt-1 opacity-70">🟢 start · ⚪ finish · 🟠 jumps · 🟤 bridges</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- main menu ----------------
export function MainMenu({ go, onQuick }: { go: (s: string) => void; onQuick: () => void }) {
  const save = useSave();
  const lv = levelFromXp(save.xp);
  return (
    <div className="h-full flex flex-col screen-in overflow-y-auto relative">
      <div className="menu-aurora" />
      <div className="flex justify-end items-start gap-3 p-3 sm:p-5 relative z-10">
        <div className="glass rounded-xl px-4 py-2 w-56">
          <div className="flex justify-between items-baseline"><span className="font-display font-black text-xl">LVL {lv.level}</span><Coin n={save.coins} className="text-amber-200" /></div>
          <XpBar into={lv.into} need={lv.need} />
          <div className="text-[10px] text-sky-200/70 mt-1 text-right">{lv.into} / {lv.need} XP</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 sm:px-12 pb-8 max-w-xl relative z-10">
        <div className="mb-6">
          <div className="font-display font-black italic uppercase text-6xl sm:text-8xl leading-[0.85] logo-text">Mount<br />Rush</div>
          <div className="font-display font-extrabold tracking-[0.35em] text-sky-200 text-sm sm:text-base mt-2">DOWNHILL SKI RACING</div>
        </div>
        <div className="flex flex-col gap-2.5">
          <MenuBtn icon="⛷️" sub="Quick race vs 5 rivals" onClick={onQuick} delay={0}>Play</MenuBtn>
          <MenuBtn icon="🏆" sub={`${Object.values(save.medals).filter(Boolean).length}/${EVENTS.length} events completed`} onClick={() => go('career')} delay={60}>Career</MenuBtn>
          <MenuBtn icon="♾️" sub={`Best ${fmtDist(save.endlessBest.distance)}`} onClick={() => go('endless')} delay={120}>Endless</MenuBtn>
          <MenuBtn icon="👥" sub="Local split-screen" onClick={() => go('versus')} delay={180}>Two Players</MenuBtn>
          <MenuBtn icon="🎿" sub="Characters, outfits & more" onClick={() => go('garage')} delay={240}>Store</MenuBtn>
          <div className="grid grid-cols-2 gap-2.5">
            <MenuBtn icon="⚙️" onClick={() => go('settings')} delay={300}>Settings</MenuBtn>
            <MenuBtn icon="📊" onClick={() => go('stats')} delay={360}>Stats</MenuBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- career ----------------
function EventDetail({ ev, onClose, onStart }: { ev: CareerEvent; onClose: () => void; onStart: (s: RaceSetup) => void }) {
  const save = useSave();
  const course = courseById(ev.course), env = ENVS[course.env];
  const unlocked = eventUnlocked(save, ev);
  const tg = objectiveTargets(ev.objective);
  const medal = save.medals[ev.id] ?? 0;
  const opps = useMemo(() => opponentsFor({ mode: 'career', eventId: ev.id }), [ev.id]);
  return (
    <div className="fixed inset-0 z-30 bg-navy/80 p-3 flex items-end sm:items-center justify-center lg:static lg:bg-transparent lg:p-0 lg:block lg:h-full" onClick={onClose}>
      <Panel className="w-full max-w-lg lg:max-w-none max-h-full lg:h-full overflow-y-auto p-5 screen-in" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold tracking-widest text-sky-300/80">EVENT {ev.index + 1} · {CHAPTERS[ev.chapter].toUpperCase()}</div>
              <h3 className="font-display font-black italic uppercase text-3xl leading-none mt-1">{ev.name}</h3>
              <div className="text-sm mt-1" style={{ color: env.accent }}>{ENV_ICON[course.env]} {course.name} · {env.name}</div>
            </div>
            <button className="lg:hidden text-2xl px-2" onClick={onClose}>✕</button>
          </div>
          <div className="mt-4"><TrackPreview course={course} /></div>
          <div className="mt-4 glass-light rounded-xl p-3">
            <div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">OBJECTIVE</div>
            <div className="font-semibold">{objectiveText(ev.objective)}</div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[3, 2, 1].map((m, i) => (
                <div key={m} className={`rounded-lg py-2 ${medal >= m ? 'bg-sky-400/25 border border-sky-300/60' : 'bg-navy/50 border border-sky-300/15'}`}>
                  <Medal m={m} size={26} /><div className="text-xs font-bold mt-1">{tg[i]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div className="glass-light rounded-xl p-3"><div className="text-xs text-sky-300/80 font-bold tracking-widest">DIFFICULTY</div><Stars n={Math.max(1, Math.round(ev.diff * 5))} /></div>
            <div className="glass-light rounded-xl p-3"><div className="text-xs text-sky-300/80 font-bold tracking-widest">REWARD</div><Coin n={ev.reward} className="text-amber-200" /> <span className="text-xs text-sky-200/70">up to ×2</span></div>
          </div>
          <div className="mt-3 glass-light rounded-xl p-3 text-sm">
            <div className="text-xs text-sky-300/80 font-bold tracking-widest mb-1">RIVALS</div>
            <div className="flex flex-wrap gap-1.5">{opps.map((n) => <span key={n} className="px-2 py-0.5 rounded-full bg-navy/60 border border-sky-300/20 text-xs font-semibold">{n}</span>)}</div>
          </div>
          {save.bestTimes[course.id] && <div className="mt-3 text-sm text-sky-200">Best time on this course: <b className="text-white">{fmtTime(save.bestTimes[course.id])}</b></div>}
          <div className="mt-4">
            {unlocked
              ? <Btn big variant="hot" className="w-full" onClick={() => onStart({ mode: 'career', eventId: ev.id })}>{medal ? 'Race again' : 'Start event'}</Btn>
              : <div className="text-center text-amber-200 font-semibold bg-navy/60 rounded-xl py-3 border border-amber-300/30">🔒 {eventLockReason(save, ev)}</div>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function CareerMenu({ onBack, onStart }: { onBack: () => void; onStart: (s: RaceSetup) => void }) {
  const save = useSave();
  const firstOpen = Math.max(0, EVENTS.findIndex((e) => !(save.medals[e.id] ?? 0)));
  const [chapter, setChapter] = useState(Math.min(2, EVENTS[Math.max(0, firstOpen)]?.chapter ?? 0));
  const [sel, setSel] = useState<string | null>(null);
  const pts = medalPoints(save);
  const list = EVENTS.filter((e) => e.chapter === chapter);
  const selEv = EVENTS.find((e) => e.id === sel);
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Career" onBack={onBack} sub={`${pts} / ${EVENTS.length * 3} medal points`} right={<Coin n={save.coins} className="text-amber-200 text-xl" />} />
      <div className="px-3 sm:px-6 flex gap-2 overflow-x-auto pb-2 shrink-0">
        {CHAPTERS.map((c, i) => {
          const open = i === 0 || eventUnlocked(save, EVENTS[i * 7]);
          return (
            <button key={c} onClick={() => { sfx(open ? 'click' : 'deny'); if (open) setChapter(i); }}
              className={`shrink-0 px-4 py-2 rounded-xl font-display font-extrabold uppercase tracking-wider text-sm border transition-all ${chapter === i ? 'bg-sky-400 text-navy border-sky-200' : 'bg-navy2/50 border-sky-300/20 text-sky-100'} ${open ? '' : 'opacity-50'}`}>
              {open ? ENV_ICON[(['forest', 'peak', 'valley'] as EnvId[])[i]] : '🔒'} {c}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 flex gap-4 px-3 sm:px-6 pb-4">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((e) => {
              const un = eventUnlocked(save, e), m = save.medals[e.id] ?? 0, course = courseById(e.course);
              return (
                <button key={e.id} onMouseEnter={() => sfx('hover')} onClick={() => { sfx(un ? 'click' : 'deny'); setSel(e.id); }}
                  className={`glass rounded-2xl p-4 text-left transition-all hover:-translate-y-1 relative overflow-hidden ${sel === e.id ? 'ring-2 ring-sky-300' : ''} ${un ? '' : 'opacity-70'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 flex items-center justify-center font-display font-black text-xl text-navy shrink-0">{e.index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-extrabold uppercase text-xl leading-none truncate">{e.name}</div>
                      <div className="text-xs text-sky-200/70 truncate mt-1">{ENV_ICON[course.env]} {course.name}</div>
                    </div>
                    {un ? <Medal m={m} size={32} /> : <span className="text-2xl">🔒</span>}
                  </div>
                  <div className="mt-3 text-xs text-sky-100/90 flex items-center justify-between gap-2">
                    <span className="truncate">{objectiveText(e.objective)}</span>
                    <Stars n={Math.max(1, Math.round(e.diff * 5))} />
                  </div>
                  {!un && <div className="mt-2 text-[11px] text-amber-200/90">{eventLockReason(save, e)}</div>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hidden lg:block w-[400px] shrink-0 min-h-0">
          {selEv ? <EventDetail key={selEv.id} ev={selEv} onClose={() => setSel(null)} onStart={onStart} />
            : <Panel className="h-full flex items-center justify-center text-sky-200/60 font-display text-2xl uppercase tracking-widest">Select an event</Panel>}
        </div>
      </div>
      {selEv && <div className="lg:hidden"><EventDetail key={selEv.id} ev={selEv} onClose={() => setSel(null)} onStart={onStart} /></div>}
    </div>
  );
}

// ---------------- course picker ----------------
function CoursePicker({ save, value, onChange }: { save: SaveData; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {COURSES.map((c) => {
        const un = courseUnlocked(save, c.id), env = ENVS[c.env];
        return (
          <button key={c.id} onMouseEnter={() => sfx('hover')} onClick={() => { sfx(un ? 'click' : 'deny'); if (un) onChange(c.id); }}
            className={`glass rounded-2xl p-3 text-left transition-all ${value === c.id ? 'ring-2 ring-sky-300 -translate-y-0.5' : ''} ${un ? 'hover:-translate-y-1' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <div className="font-display font-extrabold uppercase text-xl leading-none">{c.name}</div>
              <span>{un ? ENV_ICON[c.env] : '🔒'}</span>
            </div>
            <div className="text-xs mb-2" style={{ color: env.accent }}>{env.name}</div>
            {un ? <TrackPreview course={c} compact /> : <div className="text-xs text-amber-200/90 py-6">Unlock by progressing in Career</div>}
            {un && save.bestTimes[c.id] && <div className="text-xs mt-2 text-sky-100">Best <b>{fmtTime(save.bestTimes[c.id])}</b></div>}
          </button>
        );
      })}
    </div>
  );
}

export function QuickMenu({ onBack, onStart }: { onBack: () => void; onStart: (s: RaceSetup) => void }) {
  const save = useSave();
  const [course, setCourse] = useState('f1');
  const [diff, setDiff] = useState<Difficulty>('normal');
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Quick Race" sub="Pick a mountain and race five rivals" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-4"><CoursePicker save={save} value={course} onChange={setCourse} /></div>
      <div className="glass px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between shrink-0">
        <div className="w-full sm:w-80"><div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">AI DIFFICULTY</div>
          <Segmented options={[{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }]} value={diff} onChange={setDiff} /></div>
        <Btn big variant="hot" onClick={() => onStart({ mode: 'quick', courseId: course, diff })}>Race! ⛷️</Btn>
      </div>
    </div>
  );
}

export function EndlessMenu({ onBack, onStart }: { onBack: () => void; onStart: (s: RaceSetup) => void }) {
  const save = useSave();
  const [env, setEnv] = useState<EnvId>('forest');
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Endless Downhill" sub="No finish line. Survive. Go further." onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(ENVS) as EnvId[]).map((id) => {
            const e = ENVS[id], un = envUnlocked(save, id);
            return (
              <button key={id} onClick={() => { sfx(un ? 'click' : 'deny'); if (un) setEnv(id); }}
                className={`glass rounded-2xl p-5 text-left transition-all ${env === id ? 'ring-2 ring-sky-300 -translate-y-1' : ''} ${un ? 'hover:-translate-y-1' : 'opacity-50'}`}>
                <div className="text-4xl">{un ? ENV_ICON[id] : '🔒'}</div>
                <div className="font-display font-black italic uppercase text-2xl mt-2">{e.name}</div>
                <div className="text-sm text-sky-100/80 mt-1">{un ? e.desc : 'Unlock by reaching this chapter in Career.'}</div>
              </button>
            );
          })}
        </div>
        <Panel className="mt-4 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div><div className="text-xs font-bold tracking-widest text-sky-300/80">BEST DISTANCE</div><div className="font-display font-black text-3xl">{fmtDist(save.endlessBest.distance)}</div></div>
          <div><div className="text-xs font-bold tracking-widest text-sky-300/80">BEST SCORE</div><div className="font-display font-black text-3xl">{save.endlessBest.score.toLocaleString()}</div></div>
          <div className="col-span-2 text-sm text-sky-100/90 text-left">
            <b>How it works:</b> 3 lives ♥ — every crash costs one. Earn +1 life every 2 km. Stay clean to build your score multiplier (up to ×8). Jump, boost and collect coins. The mountain gets faster and denser the further you go.
          </div>
        </Panel>
      </div>
      <div className="glass px-4 sm:px-6 py-3 flex justify-end shrink-0"><Btn big variant="hot" onClick={() => onStart({ mode: 'endless', env })}>Start run ♾️</Btn></div>
    </div>
  );
}

export function VersusMenu({ onBack, onStart }: { onBack: () => void; onStart: (s: RaceSetup) => void }) {
  const save = useSave();
  const [course, setCourse] = useState('f1');
  const [ai, setAi] = useState(true);
  const Key = ({ k }: { k: string }) => <kbd className="px-2 py-0.5 rounded bg-navy/80 border border-sky-300/40 font-mono text-xs mr-1">{k}</kbd>;
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Two Players" sub="Local split-screen race on one device" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-4">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <Panel className="p-4"><div className="font-display font-black text-2xl text-sky-300 mb-2">PLAYER 1</div>
            <div className="text-sm space-y-1.5"><div><Key k="A" /><Key k="D" /> steer</div><div><Key k="W" /> jump · <Key k="Left Shift" /> boost · <Key k="S" /> brake</div><div className="text-sky-200/70 text-xs">Gamepad 1 also works</div></div></Panel>
          <Panel className="p-4"><div className="font-display font-black text-2xl text-orange-300 mb-2">PLAYER 2</div>
            <div className="text-sm space-y-1.5"><div><Key k="←" /><Key k="→" /> steer</div><div><Key k="↑" /> jump · <Key k="Right Shift" /> boost · <Key k="↓" /> brake</div><div className="text-sky-200/70 text-xs">Gamepad 2 also works · touch buttons appear on touch screens</div></div></Panel>
        </div>
        <CoursePicker save={save} value={course} onChange={setCourse} />
      </div>
      <div className="glass px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between shrink-0">
        <div className="w-full sm:w-72"><div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">AI RACERS</div>
          <Segmented options={[{ id: 'off', label: 'None' }, { id: 'on', label: '3 Rivals' }]} value={ai ? 'on' : 'off'} onChange={(v) => setAi(v === 'on')} /></div>
        <Btn big variant="hot" onClick={() => onStart({ mode: 'versus', courseId: course, ai })}>Start race 👥</Btn>
      </div>
    </div>
  );
}

// ---------------- stats ----------------
export function StatsMenu({ onBack }: { onBack: () => void }) {
  const save = useSave(); const st = save.stats; const lv = levelFromXp(save.xp);
  const [confirm, setConfirm] = useState(false);
  const Card = ({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) => (
    <div className="glass rounded-xl p-4"><div className="text-xs font-bold tracking-widest text-sky-300/80">{k}</div><div className="font-display font-black text-3xl leading-tight">{v}</div>{sub && <div className="text-xs text-sky-200/60">{sub}</div>}</div>
  );
  const hrs = st.playTime / 3600;
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Statistics" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-6">
        <Panel className="p-5 mb-3"><div className="flex items-baseline justify-between"><span className="font-display font-black text-3xl">LEVEL {lv.level}</span><span className="text-sm text-sky-200">{lv.into}/{lv.need} XP</span></div><div className="mt-2"><XpBar into={lv.into} need={lv.need} /></div></Panel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card k="RACES" v={st.races} /><Card k="WINS" v={st.wins} /><Card k="PODIUMS" v={st.podiums} /><Card k="CRASHES" v={st.crashes} />
          <Card k="COINS COLLECTED" v={st.coinsCollected.toLocaleString()} /><Card k="DISTANCE SKIED" v={`${(st.distance / 1000).toFixed(1)} km`} />
          <Card k="TOP SPEED" v={`${Math.round(st.topSpeed * 3.6)} km/h`} /><Card k="JUMPS" v={st.jumps} />
          <Card k="LONGEST ENDLESS" v={fmtDist(save.endlessBest.distance)} /><Card k="BEST ENDLESS SCORE" v={save.endlessBest.score.toLocaleString()} />
          <Card k="PLAY TIME" v={hrs >= 1 ? `${hrs.toFixed(1)} h` : `${Math.round(st.playTime / 60)} min`} /><Card k="CAREER MEDALS" v={`${medalPoints(save)} pts`} sub={`${Object.values(save.medals).filter((m) => m === 3).length} gold`} />
        </div>
        <Panel title="Best times" className="mt-4 pb-3">
          <div className="px-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 mt-2">
            {COURSES.map((c) => <div key={c.id} className="flex justify-between text-sm border-b border-sky-300/10 py-1.5"><span>{ENV_ICON[c.env]} {c.name}</span><b className="font-mono">{fmtTime(save.bestTimes[c.id])}</b></div>)}
          </div>
        </Panel>
        <div className="mt-5 text-center">
          {!confirm ? <Btn variant="ghost" onClick={() => setConfirm(true)}>Reset all progress</Btn>
            : <div className="inline-flex flex-wrap gap-2 items-center glass rounded-xl p-3"><span className="text-sm">Erase ALL progress, coins and unlocks?</span><Btn variant="danger" onClick={() => { resetSave(); setConfirm(false); }}>Yes, reset</Btn><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn></div>}
        </div>
      </div>
    </div>
  );
}

// ---------------- settings ----------------
export function SettingsPanel({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const save = useSave(); const s = save.settings;
  const set = (p: Partial<typeof s>) => {
    updateSave((d) => { Object.assign(d.settings, p); });
    const n = { ...s, ...p }; audio.setVolumes(n.sfx, n.music); onChange?.();
  };
  const fs = () => {
    try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); } catch { /* unsupported */ }
  };
  return (
    <div className={`grid gap-5 ${compact ? '' : 'md:grid-cols-2'}`}>
      <div className="space-y-4">
        <div><div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">GRAPHICS QUALITY <span className="normal-case font-normal">(applies next race)</span></div>
          <Segmented<Quality> options={[{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }]} value={s.quality} onChange={(q) => set({ quality: q })} /></div>
        <Slider label="Resolution scale" min={0.5} max={1} step={0.05} value={s.resScale} onChange={(v) => set({ resScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Sound effects volume" min={0} max={1} step={0.05} value={s.sfx} onChange={(v) => { set({ sfx: v }); }} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Music volume" min={0} max={1} step={0.05} value={s.music} onChange={(v) => set({ music: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Camera sensitivity" min={0.4} max={1.6} step={0.1} value={s.camSens} onChange={(v) => set({ camSens: v })} fmt={(v) => `${v.toFixed(1)}×`} />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-bold tracking-widest text-sky-300/80">PERFORMANCE</div>
        <Toggle label="Shadows" hint="Turn off for a big FPS gain" value={s.shadows} onChange={(v) => set({ shadows: v })} />
        <Toggle label="Particles & snow" value={s.particles} onChange={(v) => set({ particles: v })} />
        <Toggle label="Speed lines" value={s.speedFx} onChange={(v) => set({ speedFx: v })} />
        <Toggle label="Show FPS" value={s.showFps} onChange={(v) => set({ showFps: v })} />
        <div className="pt-2"><Btn variant="ghost" onClick={fs}>⛶ Toggle fullscreen</Btn></div>
        {!compact && (
          <div className="pt-3 text-sm text-sky-100/90">
            <div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">CONTROLS</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <b>A / ← &nbsp;D / →</b><span>Steer</span><b>Space / W</b><span>Jump (spin in air for tricks!)</span><b>Shift</b><span>Boost</span><b>S / ↓</b><span>Brake</span><b>Esc / P</b><span>Pause</span>
              <b>Gamepad</b><span>Stick steer · A jump · RT boost · LT brake · Start pause</span><b>Touch</b><span>On-screen buttons</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export function SettingsMenu({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Settings" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-6"><Panel className="p-5 sm:p-7 max-w-4xl mx-auto"><SettingsPanel /></Panel></div>
    </div>
  );
}
