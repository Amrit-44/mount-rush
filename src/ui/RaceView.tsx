import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import { EVENTS, itemById, levelFromXp, objectiveTargets } from '../game/data';
import { input } from '../game/input';
import { RaceResult, Summary } from '../game/progression';
import { HudState, PlayerHud, Race, RaceConfig } from '../game/race';
import { useSave } from '../game/save';
import { RaceSetup } from '../game/setup';
import { clamp, fmtDist, fmtTime } from '../game/util';
import { Btn, Coin, Medal, Panel, sfx } from './common';
import { SettingsPanel } from './Menus';

// ---------------- touch controls ----------------
function TB({ label, onDown, onUp, size, className = '', style }: { label: ReactNode; onDown: () => void; onUp: () => void; size: number; className?: string; style?: React.CSSProperties }) {
  const [on, setOn] = useState(false);
  const down = (e: React.PointerEvent) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } setOn(true); onDown(); };
  const up = () => { setOn(false); onUp(); };
  return (
    <div className={`touch-btn select-none ${on ? 'on' : ''} ${className}`} style={{ width: size, height: size, fontSize: size * 0.28, ...style }}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e) => e.preventDefault()}>{label}</div>
  );
}
function TouchPad({ slot, compact, tint }: { slot: number; compact: boolean; tint?: string }) {
  const t = input.touch[slot];
  const big = compact ? 62 : 84, mid = compact ? 58 : 72;
  const st = tint ? { borderColor: tint } : undefined;
  return (
    <>
      <div className="flex gap-3 items-end">
        <TB label="◀" size={big} style={st} onDown={() => (t.left = true)} onUp={() => (t.left = false)} />
        <TB label="▶" size={big} style={st} onDown={() => (t.right = true)} onUp={() => (t.right = false)} />
      </div>
      <div className="flex gap-2 items-end">
        <TB label="BRAKE" size={mid} style={{ fontSize: compact ? 10 : 13 }} onDown={() => (t.brake = true)} onUp={() => (t.brake = false)} />
        <TB label="BOOST" size={mid} style={{ fontSize: compact ? 11 : 13, ...st }} className="!bg-orange-500/40" onDown={() => (t.boost = true)} onUp={() => (t.boost = false)} />
        <TB label="JUMP" size={big + 8} style={{ fontSize: compact ? 13 : 17, ...st }} className="!bg-sky-500/40" onDown={() => input.pressJump(slot)} onUp={() => undefined} />
      </div>
    </>
  );
}

// ---------------- HUD pieces ----------------
const ord = (n: number) => (n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH');

function Speedo({ p, small }: { p: PlayerHud; small?: boolean }) {
  const R = 44, C = 2 * Math.PI * R, f = clamp(p.speed01 / 1.2, 0, 1);
  const sz = small ? 104 : 140;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: sz, height: sz }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-[225deg]">
          <circle cx="50" cy="50" r={R} fill="rgba(6,16,40,.55)" stroke="rgba(160,210,255,.25)" strokeWidth="7" strokeDasharray={`${C * 0.75} ${C}`} strokeLinecap="round" />
          <circle cx="50" cy="50" r={R} fill="none" stroke={p.boosting ? '#ff9a2a' : '#6fd0ff'} strokeWidth="7" strokeDasharray={`${C * 0.75 * f} ${C}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${p.boosting ? '#ff8a1a' : '#4db8ff'})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display font-black italic leading-none" style={{ fontSize: small ? 32 : 44 }}>{p.speed}</div>
          <div className="text-[10px] tracking-widest text-sky-200/80 font-bold">KM/H</div>
        </div>
      </div>
      <div className="-mt-2 w-28 sm:w-36 h-3 rounded-full bg-navy/70 border border-sky-300/30 overflow-hidden">
        <div className={`h-full ${p.boosting ? 'bg-gradient-to-r from-orange-400 to-yellow-300 shine-bar' : 'bg-gradient-to-r from-sky-400 to-cyan-200'}`} style={{ width: `${clamp(p.boost, 0, 100)}%` }} />
      </div>
      <div className="text-[10px] font-bold tracking-widest text-sky-200/80">BOOST</div>
    </div>
  );
}

function PosBadge({ p, label }: { p: PlayerHud; label?: string }) {
  return (
    <div className="glass rounded-xl px-3 py-1.5 flex items-baseline gap-1">
      <span className={`font-display font-black italic leading-none text-4xl sm:text-5xl ${p.position === 1 ? 'text-amber-300' : 'text-white'}`}>{p.position}</span>
      <span className="font-display font-extrabold text-lg text-sky-200">{ord(p.position)}</span>
      <span className="text-xs text-sky-300/80 ml-1 font-bold">/ {p.total}</span>
      {label && <span className="ml-2 text-xs font-bold text-sky-100">{label}</span>}
    </div>
  );
}

function Toasts({ hud, slot }: { hud: HudState; slot: number }) {
  const list = hud.toasts.filter((t) => t.slot === slot).slice(-2);
  return (
    <div className="absolute left-0 right-0 top-[24%] flex flex-col items-center gap-1 pointer-events-none">
      {list.map((t) => (
        <div key={t.id} className={`toast font-display font-black italic uppercase text-2xl sm:text-4xl px-4 ${t.kind === 'bad' ? 'text-red-300' : t.kind === 'good' ? 'text-amber-200' : 'text-white'}`} style={{ textShadow: '0 3px 12px rgba(0,0,0,.6)' }}>{t.text}</div>
      ))}
    </div>
  );
}

function RaceBar({ hud }: { hud: HudState }) {
  return (
    <div className="w-[min(46vw,340px)]">
      <div className="relative h-3 rounded-full bg-navy/70 border border-sky-300/30">
        <div className="absolute right-[-2px] top-[-4px] w-2 h-5 rounded-sm" style={{ background: 'repeating-linear-gradient(0deg,#fff 0 4px,#111 4px 8px)' }} />
        {[...hud.racers].sort((a, b) => Number(a.human) - Number(b.human)).map((r, i) => (
          <div key={i} className="absolute top-1/2 rounded-full border-2 border-white transition-[left] duration-100"
            style={{ left: `${r.progress * 100}%`, width: r.human ? 16 : 11, height: r.human ? 16 : 11, background: r.color, transform: 'translate(-50%,-50%)', zIndex: r.human ? 5 : 1, boxShadow: r.human ? '0 0 10px #fff' : 'none' }} />
        ))}
      </div>
    </div>
  );
}

function Hud({ hud, settings, versus, horizontal, touch }: { hud: HudState; settings: { showFps: boolean; speedFx: boolean }; versus: boolean; horizontal: boolean; touch: boolean }) {
  const endless = hud.mode === 'endless';
  const p0 = hud.players[0];
  const fxOp = settings.speedFx ? clamp((p0.speed01 - 0.55) * 1.5, 0, 0.55) + (p0.boosting ? 0.25 : 0) : 0;
  const board = [...hud.racers].sort((a, b) => a.position - b.position);
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {fxOp > 0.02 && !versus && <div className="speed-fx" style={{ opacity: clamp(fxOp, 0, 0.8) }} />}
      {fxOp > 0.02 && !versus && <div className="speed-fx-streaks" style={{ opacity: clamp(fxOp * 0.8, 0, 0.6), animationDuration: `${clamp(2.2 - p0.speed01 * 1.5, 0.7, 2.2)}s` }} />}
      {hud.players.some((p) => p.crashed) && !versus && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 40%, rgba(255,40,40,.35))' }} />}
      {/* timer */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
        <div className="glass rounded-xl px-4 py-1 font-mono font-bold text-2xl sm:text-3xl tabular-nums">{fmtTime(hud.time)}</div>
        {!endless && !versus && <RaceBar hud={hud} />}
        {versus && !endless && <RaceBar hud={hud} />}
        {hud.timeout !== null && <div className="glass rounded-lg px-3 py-0.5 text-amber-200 font-display font-extrabold tracking-wider">FINISH IN {Math.ceil(hud.timeout)}s</div>}
        {settings.showFps && <div className="text-[11px] font-mono text-sky-200/80">{hud.fps} FPS</div>}
      </div>

      {!versus && (
        <>
          <div className="absolute top-2 left-2 sm:left-4 flex flex-col gap-2">
            {!endless && <PosBadge p={p0} />}
            {endless && (
              <div className="glass rounded-xl px-3 py-2">
                <div className="font-display font-black text-3xl leading-none">{fmtDist(p0.distance)}</div>
                <div className="text-xs text-sky-200">SCORE <b className="text-white text-base">{p0.score.toLocaleString()}</b> · <b className="text-amber-300">×{p0.multiplier}</b></div>
                <div className="text-lg tracking-widest">{[0, 1, 2].map((i) => <span key={i} className={i < p0.lives ? 'text-red-400' : 'text-slate-600'}>♥</span>)}</div>
              </div>
            )}
            {!endless && (
              <div className="hidden md:flex glass rounded-xl p-2 flex-col gap-0.5 min-w-[150px]">
                {board.map((r) => (
                  <div key={r.name + r.slot} className={`flex items-center gap-2 text-sm px-2 py-0.5 rounded ${r.human ? 'bg-sky-400/30 font-extrabold' : ''}`}>
                    <span className="w-4 text-sky-200 font-display font-black">{r.position}</span><span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="absolute top-2 right-14 sm:right-20 glass rounded-xl px-3 py-1.5"><Coin n={p0.coins} className="text-amber-200 text-2xl" /></div>
          <div className={`absolute ${touch ? 'right-3 top-16' : 'right-4 bottom-3'}`}><Speedo p={p0} small={touch || (typeof window !== 'undefined' && window.innerHeight < 620)} /></div>
          <Toasts hud={hud} slot={0} />
        </>
      )}

      {versus && hud.players.map((p, i) => {
        const style: React.CSSProperties = horizontal ? { left: `${i * 50}%`, width: '50%', top: 0, bottom: 0 } : { top: `${i * 50}%`, height: '50%', left: 0, right: 0 };
        const col = i === 0 ? '#4db3ff' : '#ff8a3d';
        return (
          <div key={i} className="absolute" style={style}>
            <div className="absolute top-14 left-2 flex flex-col gap-1">
              <div className="rounded-lg px-2 py-0.5 font-display font-black italic uppercase text-lg" style={{ background: col, color: '#04122c' }}>{p.name}</div>
              <PosBadge p={p} />
            </div>
            <div className="absolute top-14 right-2 glass rounded-xl px-2 py-1"><Coin n={p.coins} className="text-amber-200 text-lg" /></div>
            {p.finished && <div className="absolute inset-x-0 top-[38%] text-center font-display font-black italic text-4xl text-amber-200 pop" style={{ textShadow: '0 3px 12px #000a' }}>FINISHED · {fmtTime(p.time)}</div>}
            <div className="absolute bottom-1 right-1"><Speedo p={p} small /></div>
            <Toasts hud={hud} slot={p.slot} />
          </div>
        );
      })}
      {versus && <div className="absolute bg-white/80" style={horizontal ? { left: '50%', top: 0, bottom: 0, width: 3, marginLeft: -1.5 } : { top: '50%', left: 0, right: 0, height: 3, marginTop: -1.5 }} />}

      {hud.phase === 'countdown' && hud.countdown > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div key={hud.countdown} className="count-pop font-display font-black italic text-[22vmin] leading-none text-white" style={{ textShadow: '0 8px 40px rgba(30,120,255,.8)' }}>{hud.countdown}</div>
        </div>
      )}
      {hud.phase === 'countdown' && (
        <div className="absolute top-[30%] inset-x-0 text-center text-sm text-sky-100/90 hidden sm:block" style={{ textShadow: '0 2px 8px #000' }}>
          {touch ? (versus ? 'P1 left pad · P2 right pad — steer, JUMP, BOOST, BRAKE' : '◀ ▶ steer · JUMP logs · BOOST on pads · spin in the air for tricks') : (versus ? 'P1: A/D · W jump · Shift boost    |    P2: ←/→ · ↑ jump · R-Shift boost' : 'A/D or ←/→ steer · SPACE jump · SHIFT boost · S brake · ESC pause')}
          <div className="text-xs mt-1 text-sky-200/70">Hit boost pads · jump logs · spin in the air for trick boosts</div>
        </div>
      )}
      {hud.go && <div className="absolute inset-0 flex items-center justify-center"><div className="count-pop font-display font-black italic text-[20vmin] text-emerald-300" style={{ textShadow: '0 8px 40px rgba(40,255,140,.7)' }}>GO!</div></div>}
    </div>
  );
}

// ---------------- results ----------------
function Results({ res, sum, setup, next, onContinue, onRetry, onMenu, onNext }: {
  res: RaceResult; sum: Summary | null; setup: RaceSetup; next: boolean; onContinue: () => void; onRetry: () => void; onMenu: () => void; onNext: () => void;
}) {
  const save = useSave();
  const p0 = res.players[0];
  const ev = setup.mode === 'career' ? EVENTS.find((e) => e.id === setup.eventId) : undefined;
  const lv = levelFromXp(save.xp);
  let headline = '', sub = '';
  if (res.mode === 'endless') { headline = sum?.bestDistance ? 'NEW RECORD!' : 'RUN OVER'; sub = `${Math.round(res.endless?.distance ?? 0)} m`; }
  else if (res.mode === 'versus') { headline = `PLAYER ${(res.winnerSlot ?? 0) + 1} WINS!`; sub = 'Great race!'; }
  else { headline = p0.position === 1 ? 'VICTORY!' : p0.position <= 3 ? 'PODIUM!' : 'FINISHED'; sub = p0.finished ? `${p0.position}${ord(p0.position).toLowerCase()} place · ${fmtTime(p0.time)}` : 'Did not finish'; }
  return (
    <div className="absolute inset-0 z-20 bg-navy/70 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center p-3">
      <Panel className="w-full max-w-3xl p-5 sm:p-7 pop my-auto">
        <div className="text-center">
          <div className="font-display font-black italic uppercase text-5xl sm:text-7xl logo-text leading-none">{headline}</div>
          <div className="text-sky-200 mt-1 text-lg">{sub}</div>
          {ev && sum && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <Medal m={sum.medal} size={56} />
              <div className="font-display font-extrabold text-2xl uppercase">{sum.label}{sum.newMedal ? ' · NEW!' : ''}</div>
              <div className="text-xs text-sky-200/80">{ev.name} — Gold: {objectiveTargets(ev.objective)[0]} · Silver: {objectiveTargets(ev.objective)[1]} · Bronze: {objectiveTargets(ev.objective)[2]}</div>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div className="glass-light rounded-xl p-3">
            <div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">{res.mode === 'endless' ? 'RUN STATS' : 'STANDINGS'}</div>
            {res.mode === 'endless' ? (
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Distance</span><b>{fmtDist(res.endless?.distance ?? 0)}</b></div>
                <div className="flex justify-between"><span>Score</span><b>{(res.endless?.score ?? 0).toLocaleString()}</b></div>
                <div className="flex justify-between"><span>Coins</span><b>{p0.coins}</b></div>
                <div className="flex justify-between"><span>Top speed</span><b>{Math.round(p0.topSpeed * 3.6)} km/h</b></div>
                <div className="flex justify-between"><span>Best distance</span><b>{fmtDist(save.endlessBest.distance)}</b></div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {res.standings.map((s) => (
                  <div key={s.name} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${s.human ? 'bg-sky-400/25 font-bold' : ''}`}>
                    <span className="w-5 font-display font-black text-sky-200">{s.position}</span><span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}</span><span className="font-mono text-xs">{s.time ? fmtTime(s.time) : 'DNF'}</span>
                  </div>
                ))}
              </div>
            )}
            {res.mode !== 'endless' && (
              <div className="grid grid-cols-3 gap-1 text-center mt-3 text-xs">
                {res.players.map((p) => <div key={p.slot} className="bg-navy/50 rounded-lg p-1.5 col-span-3 sm:col-span-1"><div className="text-sky-300/80">{res.players.length > 1 ? `P${p.slot + 1} ` : ''}Coins / Crashes</div><b>{p.coins} / {p.crashes}</b></div>)}
              </div>
            )}
          </div>
          <div className="glass-light rounded-xl p-3">
            <div className="text-xs font-bold tracking-widest text-sky-300/80 mb-1">REWARDS</div>
            {sum ? (
              <div className="text-sm space-y-1">
                {sum.coinsRace > 0 && <div className="flex justify-between"><span>{res.mode === 'endless' ? 'Distance reward' : 'Race reward'}</span><Coin n={sum.coinsRace} className="text-amber-200" /></div>}
                <div className="flex justify-between"><span>Coins collected</span><Coin n={sum.coinsCollected} className="text-amber-200" /></div>
                {sum.coinsBonus > 0 && <div className="flex justify-between"><span>Bonuses</span><Coin n={sum.coinsBonus} className="text-amber-200" /></div>}
                <div className="flex justify-between border-t border-sky-300/20 pt-1 font-bold text-base"><span>Total</span><Coin n={sum.coinsTotal} className="text-amber-300" /></div>
                <div className="flex justify-between"><span>XP earned</span><b className="text-cyan-200">+{sum.xp} XP</b></div>
                <div className="text-xs text-sky-200/70">Level {lv.level} · {lv.into}/{lv.need} XP</div>
                {sum.pb && <div className="text-emerald-300 font-bold">★ New personal best time!</div>}
                {sum.bestDistance && <div className="text-emerald-300 font-bold">★ New longest distance!</div>}
                {sum.levelUp && <div className="text-amber-300 font-display font-black text-xl pop">LEVEL UP! → {sum.levelUp} (+50 coins)</div>}
                {sum.unlocked.length > 0 && <div className="text-sky-100">🔓 Unlocked: {sum.unlocked.map((id) => itemById(id)?.name).join(', ')}</div>}
              </div>
            ) : <div className="text-sm text-sky-200/70">Calculating…</div>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {next && <Btn big variant="hot" onClick={onNext}>Next event ▶</Btn>}
          <Btn big variant="primary" onClick={onContinue}>Continue</Btn>
          <Btn big variant="ghost" onClick={onRetry}>Retry</Btn>
          <Btn big variant="ghost" sound="back" onClick={onMenu}>Main menu</Btn>
        </div>
      </Panel>
    </div>
  );
}

// ---------------- race view ----------------
export function RaceView({ config, setup, onResult, onContinue, onRetry, onMenu, onNext, hasNext }: {
  config: RaceConfig; setup: RaceSetup; onResult: (r: RaceResult) => Summary; onContinue: () => void; onRetry: () => void; onMenu: () => void; onNext: () => void; hasNext: boolean;
}) {
  const save = useSave();
  const holder = useRef<HTMLDivElement>(null);
  const raceRef = useRef<Race | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: RaceResult; s: Summary | null } | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const pausedRef = useRef(false); const resRef = useRef(false);
  const onResultRef = useRef(onResult); onResultRef.current = onResult;
  const versus = config.mode === 'versus';
  const touch = input.hasTouch || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);

  const setPause = useCallback((p: boolean) => {
    if (resRef.current || !raceRef.current) return;
    pausedRef.current = p; setPaused(p); if (!p) setShowSettings(false);
    raceRef.current.setPaused(p); sfx(p ? 'click' : 'back');
  }, []);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
    holder.current!.appendChild(canvas);
    let race: Race | null = null;
    try {
      race = new Race(canvas, config, {
        onHud: setHud,
        onEnd: (r) => { resRef.current = true; let s: Summary | null = null; try { s = onResultRef.current(r); } catch (e) { console.error(e); } setRes({ r, s }); },
      });
      raceRef.current = race; race.start();
    } catch (e) {
      console.error(e); setError(e instanceof Error ? e.message : String(e));
    }
    input.onPause = () => { if (!resRef.current) setPause(!pausedRef.current); };
    const vis = () => { if (document.hidden && !pausedRef.current && !resRef.current) setPause(true); };
    const rs = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    const watchdog = setTimeout(() => { if (!raceRef.current) setError('The game failed to start (WebGL unavailable?).'); }, 6000);
    return () => {
      clearTimeout(watchdog); document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs);
      input.onPause = null; race?.dispose(); raceRef.current = null; canvas.remove();
    };
  }, [config, setPause]);

  useEffect(() => { raceRef.current?.applySettings(save.settings); }, [save.settings]);
  const horizontal = size.w >= size.h;

  return (
    <div className="absolute inset-0 bg-navy overflow-hidden" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      <div ref={holder} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy p-6"><Panel className="p-6 max-w-md text-center">
          <div className="font-display font-black text-3xl uppercase">Couldn't start the race</div>
          <div className="text-sm text-sky-200 my-3 break-words">{error}</div><Btn onClick={onMenu}>Back to menu</Btn></Panel></div>
      )}
      {!hud && !error && <div className="absolute inset-0 flex items-center justify-center font-display font-black italic text-3xl uppercase text-sky-200 animate-pulse">Preparing the slope…</div>}
      {hud && !res && <Hud hud={hud} settings={save.settings} versus={versus} horizontal={horizontal} touch={touch} />}
      {hud && !res && (
        <button className="absolute top-2 right-2 sm:right-4 z-10 w-11 h-11 rounded-xl glass font-display font-black text-xl" onClick={() => setPause(true)} aria-label="Pause">❚❚</button>
      )}
      {touch && hud && !res && !paused && (
        versus ? (
          <>
            <div className="absolute bottom-3 left-3 flex flex-col gap-2 items-start"><TouchPad slot={0} compact tint="#4db3ff" /></div>
            <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end"><TouchPad slot={1} compact tint="#ff8a3d" /></div>
          </>
        ) : (
          <>
            <div className="absolute bottom-4 left-4 flex gap-3"><TB label="◀" size={92} onDown={() => (input.touch[0].left = true)} onUp={() => (input.touch[0].left = false)} /><TB label="▶" size={92} onDown={() => (input.touch[0].right = true)} onUp={() => (input.touch[0].right = false)} /></div>
            <div className="absolute bottom-4 right-4 flex gap-3 items-end">
              <div className="flex flex-col gap-2"><TB label="BOOST" size={70} style={{ fontSize: 13 }} className="!bg-orange-500/40" onDown={() => (input.touch[0].boost = true)} onUp={() => (input.touch[0].boost = false)} />
                <TB label="BRAKE" size={64} style={{ fontSize: 12 }} onDown={() => (input.touch[0].brake = true)} onUp={() => (input.touch[0].brake = false)} /></div>
              <TB label="JUMP" size={104} style={{ fontSize: 20 }} className="!bg-sky-500/40" onDown={() => input.pressJump(0)} onUp={() => undefined} />
            </div>
          </>
        )
      )}
      {paused && !res && (
        <div className="absolute inset-0 z-30 bg-navy/75 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <Panel className="p-6 w-full max-w-lg pop my-auto">
            <div className="font-display font-black italic uppercase text-5xl logo-text text-center mb-4">Paused</div>
            {!showSettings ? (
              <div className="flex flex-col gap-2.5">
                <Btn big variant="primary" sound="back" onClick={() => setPause(false)}>▶ Resume</Btn>
                <Btn big variant="ghost" onClick={onRetry}>↻ Restart</Btn>
                <Btn big variant="ghost" onClick={() => setShowSettings(true)}>⚙ Settings</Btn>
                <Btn big variant="danger" sound="back" onClick={onMenu}>⌂ Return to menu</Btn>
              </div>
            ) : (
              <div><SettingsPanel compact onChange={() => undefined} /><div className="mt-4"><Btn variant="primary" className="w-full" sound="back" onClick={() => setShowSettings(false)}>Done</Btn></div></div>
            )}
          </Panel>
        </div>
      )}
      {res && <Results res={res.r} sum={res.s} setup={setup} next={hasNext} onContinue={onContinue} onRetry={onRetry} onMenu={onMenu} onNext={onNext} />}
    </div>
  );
}

export { audio };
