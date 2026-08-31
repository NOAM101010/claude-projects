# CITY EMPIRE — CURRENT PROGRESS

> Living status file (MASTER §10). Update after every major system.

- **Current version:** 0.1.0
- **Current phase:** PHASE 0–1 (Foundation + Player) — DONE for the first milestone
- **Engine decision:** Web 3D (Three.js + React Three Fiber), NOT Unreal.
  See `DECISIONS.md` D-001 for why.
- **First milestone target (user-chosen):** Character + movement + basic interaction ✅

## Completed systems
- Project scaffold: Vite + React + TypeScript.
- Core layer: `config.ts` (tuning), `log.ts` (tagged dev logging), `input.ts`
  (keyboard + pointer-lock mouse service).
- State (Zustand): `usePlayerStore` (cash/bank + throttled position snapshot),
  `useNotifications` (toast feedback), `useInteractionStore` (one reusable
  interaction framework).
- Player: third-person controller (`Player.tsx`) with WASD relative to camera,
  sprint, jump + gravity over flat ground, smooth follow camera with mouse
  orbit; procedural animated avatar (`PlayerCharacter.tsx`) with a walk cycle.
- World: `StarterDistrict` — a compact European street (road, sidewalks,
  windowed buildings via procedural facade textures, trees, street lights,
  benches) + demo interactables (a "for sale" cafe, a cash pickup).
- Rendering: sky, warm key sun with shadows, hemisphere fill, fog, ACES tone
  mapping.
- UI: cinematic start screen (`App.tsx`) + minimal HUD (cash, interaction
  prompt, notifications, controls hint).

## Current system being developed
- Nothing in-flight; awaiting user direction for the next phase.

## Known bugs / limitations
- Collision is flat-ground only — the player can walk through buildings.
  Real world colliders come with the district phase.
- No save/load yet (Phase 4/Save).
- No day/night, NPCs, traffic, vehicles, phone, economy transactions yet.
- Business "purchase" is a placeholder notification, not the real flow.
- In the embedded/headless preview pane the R3F drawing buffer can stay at the
  default 300×150 because the pane never composites; in a real displayed
  browser it fills correctly. Not a code bug.

## Next recommended task
- Choose the next phase. Natural options: (a) world colliders so the player
  can't walk through buildings, (b) the Economy + Bank foundation, or
  (c) the first real Business purchase flow. Recommend (a) then (c).

## Important architectural notes
- Per-frame transforms live in refs; the store gets only low-frequency
  snapshots (perf, MASTER §49).
- UI never mutates gameplay (MASTER §8): HUD is display-only.
- All interactable objects register with the interaction store — no bespoke
  interaction code per object (MASTER §16).

## Files/classes changed (this milestone)
- `src/game/core/{config,log,input}.ts`
- `src/game/state/{usePlayerStore,useNotifications}.ts`
- `src/game/interaction/{useInteractionStore,Interactable}.tsx`
- `src/game/player/{Player,PlayerCharacter}.tsx`
- `src/game/world/{textures,props,StarterDistrict}.tsx`
- `src/game/GameCanvas.tsx`
- `src/ui/HUD.tsx`
- `src/App.tsx`, `src/main.tsx`, `src/styles/{global,menu}.css`
