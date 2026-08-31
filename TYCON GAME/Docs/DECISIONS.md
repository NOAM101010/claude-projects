# CITY EMPIRE — DECISIONS

> Major architecture / gameplay decisions (MASTER §10, §70).

## D-001 — Engine: Web 3D (Three.js + R3F) instead of Unreal Engine 5.8
**Date:** 2026-08-24
**Decision:** Build CITY EMPIRE as a browser-based 3D game using Three.js +
React Three Fiber + Zustand, rather than Unreal Engine 5.8 / C++ as the MASTER
document originally specified.

**Why:**
- The target machine has **no Unreal Engine installed** (only Epic Launcher +
  Fortnite), and no confirmed UE-ready toolchain.
- Building an open-world 3D Unreal game is ~90% visual editor + 3D-art work
  (meshes, environments, animations) that cannot be produced through code
  files alone, and is a multi-year studio effort.
- The user's existing toolchain and shipped projects are web (React/TS). Web 3D
  lets us build the whole thing end-to-end in code and play in a browser
  immediately.
- The user explicitly chose the "Web 3D" path when presented the trade-offs.

**Consequence:** MASTER phases/systems are honored in spirit and mapped onto web
equivalents (e.g. UMG → React HUD, Data Assets → TS data modules, SaveGame →
localStorage/IndexedDB with a versioned schema). The MASTER's engineering
principles (modularity, data-driven, one interaction system, economy service,
save versioning, no UI-owned gameplay) are all still followed.

## D-002 — Visual style: procedural low-poly, built in code
**Date:** 2026-08-24
**Decision:** Generate world/character geometry and facade textures
procedurally in code; do not download external 3D assets by default.
**Why:** Keeps the project self-contained, avoids asset-licensing/policy issues,
and gives a clean, consistent look. If the user later approves specific assets,
they can be integrated. The user asked for "as realistic as is not too
complicated"; procedural + good lighting is the pragmatic middle.

## D-003 — Per-frame state stays in refs
**Date:** 2026-08-24
**Decision:** Authoritative player transform lives in refs and is applied
directly to the Three object each frame; only low-frequency snapshots go to the
Zustand store. **Why:** Avoids React re-renders 60×/sec (MASTER §49 perf).
