import { Component, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './game/audio';
import { EVENTS } from './game/data';
import { PreviewScene } from './game/preview';
import { RaceConfig } from './game/race';
import { RaceResult, Summary, applyResult, eventUnlocked } from './game/progression';
import { getSave, updateSave, useSave } from './game/save';
import { RaceSetup, buildConfig } from './game/setup';
import { Garage } from './ui/Garage';
import { CareerMenu, EndlessMenu, MainMenu, QuickMenu, SettingsMenu, StatsMenu, VersusMenu } from './ui/Menus';
import { RaceView } from './ui/RaceView';
import { Btn, Panel } from './ui/common';

type Screen = 'main' | 'career' | 'quick' | 'endless' | 'versus' | 'garage' | 'settings' | 'stats' | 'race';

class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  componentDidCatch(e: unknown) { console.error(e); }
  render() {
    if (this.state.err) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-navy p-6 z-50"><Panel className="p-6 max-w-md text-center">
          <div className="font-display font-black text-3xl uppercase">Something went wrong</div>
          <div className="text-sm text-sky-200 my-3 break-words">{this.state.err}</div>
          <Btn onClick={() => { this.setState({ err: null }); this.props.onReset(); }}>Back to main menu</Btn></Panel></div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>('main');
  const [race, setRace] = useState<{ config: RaceConfig; setup: RaceSetup; key: number } | null>(null);
  const [preview, setPreview] = useState<PreviewScene | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef(0);

  // preview scene (menu background + garage)
  useEffect(() => {
    let p: PreviewScene | null = null;
    try { p = new PreviewScene(canvasRef.current!, getSave().equipped); setPreview(p); } catch (e) { console.error('Preview unavailable', e); }
    return () => { p?.dispose(); setPreview(null); };
  }, []);
  useEffect(() => { if (preview && screen !== 'garage') preview.setLook(save.equipped); }, [preview, save.equipped, screen]);
  useEffect(() => { preview?.setRunning(screen !== 'race'); }, [preview, screen]);

  // audio unlock + volumes + menu music
  useEffect(() => {
    const unlock = () => { audio.init(); audio.setVolumes(getSave().settings.sfx, getSave().settings.music); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { audio.setVolumes(save.settings.sfx, save.settings.music); }, [save.settings.sfx, save.settings.music]);
  useEffect(() => { if (screen !== 'race') audio.playMusic('menu', 0, 86); }, [screen]);

  const startRace = useCallback((setup: RaceSetup) => {
    const config = buildConfig(setup, getSave());
    keyRef.current++;
    setRace({ config, setup, key: keyRef.current });
    setScreen('race');
  }, []);

  const onResult = useCallback((r: RaceResult): Summary => {
    let sum: Summary | null = null;
    const ev = r.eventId ? EVENTS.find((e) => e.id === r.eventId) : undefined;
    updateSave((d) => { sum = applyResult(d, r, ev); });
    const s = sum as Summary | null;
    if (s?.levelUp) audio.play('levelup');
    return s as Summary;
  }, []);

  const toMenu = (s: Screen) => () => { audio.play('back'); setScreen(s); setRace(null); };
  const cont = () => {
    const m = race?.setup.mode;
    setScreen(m === 'career' ? 'career' : m === 'quick' ? 'quick' : m === 'endless' ? 'endless' : m === 'versus' ? 'versus' : 'main'); setRace(null);
  };
  let nextSetup: RaceSetup | null = null;
  if (race?.setup.mode === 'career') {
    const idx = EVENTS.findIndex((e) => e.id === (race.setup as { eventId: string }).eventId);
    const n = EVENTS[idx + 1];
    if (n && eventUnlocked(save, n)) nextSetup = { mode: 'career', eventId: n.id };
  }

  const dim = screen === 'main' ? 'bg-gradient-to-r from-navy/80 via-navy/25 to-transparent' : screen === 'garage' ? 'bg-gradient-to-t from-navy/50 to-transparent' : 'bg-navy/55';
  return (
    <div className="fixed inset-0 bg-navy text-frost overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: screen === 'race' ? 'none' : 'block' }} />
      {screen !== 'race' && <div className={`absolute inset-0 pointer-events-none transition-colors duration-500 ${dim}`} />}
      <Boundary onReset={() => { setScreen('main'); setRace(null); }}>
        {screen !== 'race' && (
          <div className="absolute inset-0 z-10" key={screen}>
            {screen === 'main' && <MainMenu go={(s) => setScreen(s as Screen)} onQuick={() => setScreen('quick')} />}
            {screen === 'career' && <CareerMenu onBack={toMenu('main')} onStart={startRace} />}
            {screen === 'quick' && <QuickMenu onBack={toMenu('main')} onStart={startRace} />}
            {screen === 'endless' && <EndlessMenu onBack={toMenu('main')} onStart={startRace} />}
            {screen === 'versus' && <VersusMenu onBack={toMenu('main')} onStart={startRace} />}
            {screen === 'garage' && <Garage preview={preview} onBack={toMenu('main')} />}
            {screen === 'settings' && <SettingsMenu onBack={toMenu('main')} />}
            {screen === 'stats' && <StatsMenu onBack={toMenu('main')} />}
          </div>
        )}
        {screen === 'race' && race && (
          <RaceView key={race.key} config={race.config} setup={race.setup} onResult={onResult}
            onContinue={cont} onRetry={() => startRace(race.setup)} onMenu={toMenu('main')}
            hasNext={!!nextSetup} onNext={() => nextSetup && startRace(nextSetup)} />
        )}
      </Boundary>
    </div>
  );
}
