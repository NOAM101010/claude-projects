# CITY EMPIRE

A browser-based **3D open-world life & business simulation**. Start with almost
nothing, walk and drive a living city, buy and manage businesses, and build your
empire.

> Full design spec: [`CITY_EMPIRE_MASTER_V1_0.md`](./CITY_EMPIRE_MASTER_V1_0.md).
> Progress & decisions: [`Docs/`](./Docs).

## Stack
Vite · React · TypeScript · Three.js · React Three Fiber · Zustand.
Visuals are generated procedurally in code (no external 3D assets).
See `Docs/DECISIONS.md` D-001 for why this is web 3D rather than Unreal.

## Run
```bash
npm install
npm run dev
```
Open the printed local URL and click **New Game**.

## Controls
`WASD` move · `Shift` sprint · `Space` jump · `Mouse` look · `E` interact.

## Status
`v0.1.0` — Foundation + Player. Third-person character, movement, follow camera,
a reusable interaction system, and a starter slice of the European District.
Next phases: world collision, economy/bank, real business purchase flow. See
[`Docs/CURRENT_PROGRESS.md`](./Docs/CURRENT_PROGRESS.md).
