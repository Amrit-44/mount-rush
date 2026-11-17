# Powder Rush — Downhill Ski Racing

A complete 3D browser ski racing game (React + Three.js + Tailwind). All art, models and audio are procedural — no external assets.

## Run locally
```
npm install
npm run dev        # development server
npm run build      # production build -> dist/index.html (single self-contained file)
npm run preview    # serve the production build
```
Optional headless AI/physics check: `npx tsx scripts/simtest.ts f1,p1,v1 0.5`

## Modes
- **Play** – quick race vs 5 AI rivals (Easy/Normal/Hard) on any unlocked course.
- **Career** – 21 events across 9 courses in 3 chapters (position, time, coins, crash-free, limited-mistakes objectives; bronze/silver/gold; unlocks tracks, cosmetics, coins, XP).
- **Endless** – procedurally generated mountain, 3 lives, score multiplier, rising difficulty, saved personal bests.
- **Two Players** – local split-screen (P1: A/D, W, L-Shift, S · P2: arrows, R-Shift) + gamepads, optional 3 AI rivals.
- **Garage** – 3D skier preview; ~50 cosmetics (skis with stats, colours, designs, outfits, helmets, goggles, gloves, extras); coin purchases, career/level unlocks, equip/unequip.

## Controls
A/D or ←/→ steer · Space/W jump (steer in the air to spin for trick boost) · Shift boost · S/↓ brake · Esc/P pause. Touch buttons appear on touch devices. Gamepad: stick, A jump, RT boost, LT brake, Start pause.

## Architecture (src/game)
`track.ts` procedural track + queries · `sim.ts` skier physics + AI · `world.ts` chunked terrain/instanced props · `race.ts` loop/cameras/FX/HUD state · `skierModel.ts` · `preview.ts` menu/garage scene · `audio.ts` synthesized music/SFX · `save.ts` validated localStorage · `progression.ts` rewards · UI in `src/ui`.
