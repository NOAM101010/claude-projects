# CITY EMPIRE — CHANGELOG

## [0.1.0] — 2026-08-24 — Foundation + Player
### Added
- Vite + React + TypeScript project scaffold (web 3D stack).
- Core services: config/tuning, tagged dev logging, keyboard + pointer-lock
  mouse input.
- Zustand stores: player economy (cash/bank), notifications, and a reusable
  interaction framework.
- Third-person player controller: WASD (camera-relative), sprint, jump +
  gravity, smooth mouse-orbit follow camera.
- Procedural animated player avatar with a walk cycle.
- Starter slice of the European District: road, sidewalks, windowed buildings
  (procedural facade textures), trees, street lights, benches.
- Two demo interactables (cafe "for sale", cash pickup) exercising the
  interaction + economy + feedback loop.
- Cinematic start screen + minimal HUD (cash, interaction prompt, toasts,
  controls hint).
- Project documentation set (MASTER pointer, CURRENT_PROGRESS, DECISIONS,
  CHANGELOG, TODO).

### Changed
- Engine target changed from Unreal Engine 5.8 to Web 3D (see DECISIONS D-001).

### Known Issues
- No world collision yet (player can pass through buildings).
- No save/load, day/night, NPCs, traffic, vehicles, phone, or real economy
  transactions yet — those are upcoming phases.
