import type { Input } from './sim';
import { clamp } from './util';

export interface TouchState { left: boolean; right: boolean; boost: boolean; brake: boolean }

const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight']);

class InputManager {
  keys = new Set<string>();
  touch: TouchState[] = [
    { left: false, right: false, boost: false, brake: false },
    { left: false, right: false, boost: false, brake: false },
  ];
  jumpFlag = [false, false];
  padPrev: boolean[][] = [[], []];
  versus = false;
  capture = false;
  attached = false;
  onPause: (() => void) | null = null;
  hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.reset);
  }
  reset = () => {
    this.keys.clear();
    for (const t of this.touch) { t.left = t.right = t.boost = t.brake = false; }
    this.jumpFlag = [false, false];
  };
  private kd = (e: KeyboardEvent) => {
    if (this.capture && GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat && this.onPause) this.onPause(); return; }
    if (e.repeat) return;
    this.keys.add(e.code);
    if (this.versus) {
      if (e.code === 'KeyW' || e.code === 'Space') this.jumpFlag[0] = true;
      if (e.code === 'ArrowUp') this.jumpFlag[1] = true;
    } else if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') this.jumpFlag[0] = true;
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  pressJump(slot: number) { this.jumpFlag[slot] = true; }

  private pad(slot: number): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected);
    if (!pads.length) return null;
    if (this.versus) return pads[slot] ?? null;
    return pads[0];
  }

  read(slot: number): Input {
    const k = this.keys, t = this.touch[slot];
    let l = false, r = false, boost = false, brake = false;
    if (this.versus) {
      if (slot === 0) { l = k.has('KeyA'); r = k.has('KeyD'); boost = k.has('ShiftLeft'); brake = k.has('KeyS'); }
      else { l = k.has('ArrowLeft'); r = k.has('ArrowRight'); boost = k.has('ShiftRight'); brake = k.has('ArrowDown'); }
    } else {
      l = k.has('KeyA') || k.has('ArrowLeft'); r = k.has('KeyD') || k.has('ArrowRight');
      boost = k.has('ShiftLeft') || k.has('ShiftRight'); brake = k.has('KeyS') || k.has('ArrowDown');
    }
    let steer = (r ? 1 : 0) - (l ? 1 : 0);
    steer += (t.right ? 1 : 0) - (t.left ? 1 : 0);
    boost = boost || t.boost; brake = brake || t.brake;
    let jump = this.jumpFlag[slot];
    this.jumpFlag[slot] = false;
    const gp = this.pad(slot);
    if (gp) {
      const ax = gp.axes[0] ?? 0;
      if (Math.abs(ax) > 0.15) steer += ax;
      if (gp.buttons[14]?.pressed) steer -= 1;
      if (gp.buttons[15]?.pressed) steer += 1;
      boost = boost || !!gp.buttons[7]?.pressed || !!gp.buttons[5]?.pressed || !!gp.buttons[2]?.pressed;
      brake = brake || !!gp.buttons[6]?.pressed || !!gp.buttons[4]?.pressed || !!gp.buttons[1]?.pressed;
      const jb = !!gp.buttons[0]?.pressed || !!gp.buttons[3]?.pressed;
      if (jb && !this.padPrev[slot][0]) jump = true;
      this.padPrev[slot][0] = jb;
      const st = !!gp.buttons[9]?.pressed;
      if (st && !this.padPrev[slot][9] && this.onPause) this.onPause();
      this.padPrev[slot][9] = st;
    }
    return { steer: clamp(steer, -1, 1), jump, boost, brake };
  }
}

export const input = new InputManager();
