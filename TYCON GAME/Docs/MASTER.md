# CITY EMPIRE — MASTER (pointer)

The full master build document lives at the project root:

➡️ **[`../CITY_EMPIRE_MASTER_V1_0.md`](../CITY_EMPIRE_MASTER_V1_0.md)**

That document is the source of truth for vision, systems, and phases. This
`Docs/` folder tracks how the actual implementation is progressing against it.

**Important deviation:** the engine is Web 3D (Three.js + React Three Fiber),
not Unreal Engine — see [`DECISIONS.md`](./DECISIONS.md) D-001. All of the
master's engineering principles still apply; only the runtime platform changed.

## How to resume in a future session (MASTER §59)
1. Read `../CITY_EMPIRE_MASTER_V1_0.md`.
2. Read `CURRENT_PROGRESS.md`, `CHANGELOG.md`, `DECISIONS.md`, `TODO.md`.
3. Inspect the actual code under `src/` — trust code over docs; compare both.
4. Continue one phase at a time; update these docs after each major system.

## Run it
```bash
npm install
npm run dev
```
Then open the printed local URL, click **New Game**.
