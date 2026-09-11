# Swing Trader (TRAIDING) — Progress

**Last updated:** 2026-09-11 (round 18 — Wall removed, Discord scans grouped by setup, real PWA icon)

## Current status
Live on Vercel at `https://claude-projects-delta.vercel.app` (Vercel project `claude-projects`, Production Branch = `trading`, Root Directory = `TRAIDING/swing-trader`, DB = Neon Postgres). This was a marathon session (17 rounds) that fixed severe animation-driven lag, merged the home page and dashboard into one "command center," shipped a performance/journal page, price alerts with auto-close-on-stop, a voice morning brief, a 2D "climbing wall" visualization of open positions, and a fully working two-way Discord slash-command bot. Everything below is shipped, pushed, and build-clean; live verification happened progressively with the user via screenshots since local dev has no working DB.

## What's done

### Performance (was the #1 complaint — animations were freezing the whole site)
- Cursor crosshair + dashboard backdrop: rAF loops now idle out when the pointer is still, restart on movement. `dpr` capped at 1.5.
- Removed `backdrop-filter: blur` from `.glass` (kept only for the top nav via `.glass-blur`), removed `mix-blend-mode` from the grain layer, `transition: all` → explicit properties everywhere.
- `color-scheme: dark` + dark `<option>` styling — fixed native `<select>` dropdowns rendering white-on-white (analysis setup picker, scanner profile switcher, etc.).
- Hard rule enforced project-wide since: no `filter`/`blur`/`backdrop-filter`/`mix-blend-mode`, animate only `transform`/`opacity`, gate everything under `prefers-reduced-motion`, stop rendering when `document.hidden`.

### Home page = Command Center (merged)
- `/` now **is** the full dashboard (greeting + market indices incl. TA-125 + sector heatmap + the full command-center sections). `/dashboard` route just redirects to `/`. Nav item "לוח בקרה" removed.
- Holographic account card replaced with a clean titanium `AccountPanel` (total equity = account size + open P&L, free cash, exposure %).
- Free cash is now **auto-computed** (account size − open-position cost) instead of a manually-typed number that went stale; the old field is now an optional override.
- Moved from the journal into the command center (info that belongs to "right now," not the historical record): losing-streak warning, rolling win-rate trend, "best day of week to enter."
- Visual language: charcoal/titanium metal (`--metal-1/2/edge/hi` tokens, amber `--warn-2` for money figures only, green/red for market). `.btn-metal` nav buttons. A `LiquidButton` (heavier SVG filter) used *only* on the single "run scanner" CTA.

### Performance/Journal split
- New **`/reports`** page, labeled **"ביצועים"** in the nav — monthly P&L calendar (graded green/red tiles), month navigator, "month stats" panel, weekly summaries.
- Journal keeps the deep historical record (full trade table, all-time stats, equity curve, by-ticker/by-setup, Alpha vs SPY, R-multiple, commissions, best/worst trade).

### News feed (partially built, Hebrew summary still undecided)
- `src/lib/news.ts`: Yahoo per-ticker RSS (no key needed) + Finnhub market/company news + earnings calendar (key sent via `X-Finnhub-Token` header, not query string). Module-level cache (15 min) with a pending-promise guard against duplicate concurrent fetches.
- `/api/news` + a filterable news panel (positions/watchlist/market) on the command center.
- Daily Discord `#עדכונים` digest of relevant headlines (piggybacks on the existing 01:00 summary cron).
- Earnings badge ("📅 רווחים בעוד Xd") on both the positions table and scanner rows (red if ≤3 days).
- **User has a Finnhub key configured.** User does NOT want raw English headlines long-term — wants a short Hebrew AI-written summary like they used to have. This needs an Anthropic API key (~$1/month with Haiku) and the user has **not yet decided** to add one — do not build this until they say go.

### Price alerts + auto-close on stop
- New `PriceAlert` Prisma model + hand-written migration. `/api/alerts` (CRUD) + `/api/alerts/check` (client polls every 60s, backs off to 5min when nothing active, pauses when tab hidden).
- Alerts trigger push + Discord `#עדכונים`, shown as a toast on-site. Atomic `updateMany` guards prevent double-firing.
- **Stop price now acts as an automatic exit**: `runStopCheck()` in `src/lib/alerts.ts` — when an open position's live price reaches its `stopPrice`, the trade is auto-closed (`sellPrice = stopPrice`, `sellDate = now`), notifying via push + Discord. Setting `auto_close_on_stop` (default ON); when OFF, it fully skips (no spam) — the dashboard's "close to stop" heat indicator is the fallback. Hint text shown under the stop field in the journal form.
- Manual "מזומן פנוי" field, "free cash" computation, and everything downstream (dashboard, journal, reports) reads live from the DB, so closes propagate automatically.

### Voice morning brief
- `src/lib/morning-brief.ts` builds a natural Hebrew sentence (rule-based, no AI) covering market regime, open positions, any close-to-stop warning, open P&L, yesterday's scan count. `/api/morning-brief` + a "🔊 סיכום בוקר" button using the browser's `speechSynthesis` (he-IL), with a stop button and text fallback.

### "The Wall" (הקיר) — settled on 2D after trying 3D
- Concept: every open position is a climber on a shared wall; height = % gain from entry (all climbers share the 0% line); a rope runs down to an anchor at the stop price; the "protected margin" between climber and anchor is shaded green/red; crossing a whole 1% or an R-multiple line (R1/R2/R3) triggers a small "flag plant" moment; when a position auto-closes at its stop, the climber falls off the wall; zero open positions = the wall is locked.
- **Tried real 3D first** (React Three Fiber + Three.js) — user sent 3 GLB models (compressed a 62MB+49MB pair of mountains down to ~770KB total with gltf-transform/meshopt; the 73KB mannequin climber). The static mannequin looked bad (standing, not climbing) and the user asked to abandon 3D entirely.
- **Reverted to the 2D SVG/CSS version** (`src/components/wall/climb-wall.tsx` + `wall.css`), then polished hard: multi-layer procedurally-textured rock face with ~46 deterministic climbing holds, a climbing-pose silhouette with a chalk cloud and soft green/red halo (no `filter`), a catenary rope + carabiner anchor instead of a straight line, amber glowing 0% line, locked state with an SVG lock + bars + chains. All three/`@react-three/*`/`@gltf-transform` dependencies and GLB files were removed again.
- **Do not revisit 3D for this feature unless the user explicitly asks again** — it was tried and rejected once already.

### Discord bot — two-way, LIVE and configured
- HTTP Interactions (serverless, no gateway/websocket): `src/app/api/discord/interactions/route.ts` verifies the ed25519 signature (`await verifyKey(...)`, `.trim()`'d env values), handles PING, and for data-needing commands responds DEFERRED then edits the message via `after()` + a PATCH to Discord's webhook-edit endpoint.
- Commands (all in Hebrew): `/מחיר <symbol>`, `/פוזיציות`, `/סריקה`, `/ביצועים`, `/התראה <symbol> <מחיר> <מעל|מתחת>` (creates a PriceAlert), `/עזרה`.
- `/api/discord/register` (POST) registers the commands — accepts either a `CRON_SECRET` bearer token or a same-origin request, so there's a one-click **"רשום פקודות"** button in Settings (no curl needed).
- A `GET` on `/api/discord/interactions` returns a boolean env-var diagnostic (no secret values) — useful if the bot ever stops responding, to check `DISCORD_PUBLIC_KEY`/`DISCORD_APP_ID`/`DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID` are actually loaded on the live deployment.
- **User has fully completed setup**: Vercel env vars (`DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`) are all set, Interactions Endpoint URL saved successfully, bot invited to their server (`applications.commands` scope), commands registered via the Settings button, and confirmed working live (`/עזרה` tested successfully). Because `DISCORD_GUILD_ID` is set, commands register instantly to that one server rather than globally (~1hr).

## Round 18 (2026-09-11) — Wall removed, setup-grouped Discord scans, real PWA icon
- **The Wall is gone.** Deleted `src/components/wall/` and `src/app/wall/` entirely, removed the nav entry and the one dashboard link into it. User explicitly asked to drop it — do not rebuild without them asking again (same rule that already applied to the 3D attempt).
- **Discord scan messages now group by setup** instead of a flat top-N. New `src/lib/setup-grouping.ts` (`groupTopBySetup`/`flattenGrouped`) picks up to 2 results per setup (of the 7 in `src/lib/setups.ts`), skips empty setups, caps total ~14. Applied to both the 13:00 morning cron (`scanner/cron/route.ts`, Discord embed only — push notification stays a flat short list) and the "סריקה היום" field in the 01:00 daily summary (`summary/run/route.ts`).
- **Real PWA icon added.** There were previously **no icon files at all** — `manifest.json` pointed at `/icon-192.png`/`/icon-512.png` that didn't exist, which is why the phone showed a generic "S". New design: 3 ascending green candlesticks with amber borders on the app's charcoal bg (`src/lib/icon-design.tsx`, shared by `src/app/icon.tsx` + `apple-icon.tsx` via `next/og`, plus real static PNGs in `public/` generated once via `scripts/generate-icons.ts` — Android's maskable manifest icon needs an actual static file, not just a Next metadata route). Re-run `npx tsx scripts/generate-icons.ts` if `icon-design.tsx` changes.
- **Manifest `shortcuts` added** (long-press quick actions on the home-screen icon) → Scanner, Journal, Reports, Watchlist. This is the practical PWA equivalent of a home-screen "widget" — true OS widgets aren't available to a PWA on iOS or Android without a separate native app.
- Pushed as commit `46b7b0e` to `trading`.
- **Not done yet, needs a decision**: what Discord's role should be now that push notifications reach the phone directly (see conversation — user wants ideas, hasn't picked a direction). Also didn't change what triggers push notifications (audited only, see below) — no changes made there this round.
- **Current push-notification inventory** (as of this round, unchanged): scanner run results (top picks), price alert triggered, auto-close-on-stop. That's it — no push for the daily/weekly Discord summary, news, or non-stop alert-touch events.

## What's left / next steps
1. **Hebrew news summary** — user wants a short AI-written Hebrew digest instead of raw English headlines. Blocked on the user deciding whether to add an Anthropic API key (~$1/month, Haiku). Ask before building.
2. **Ephemeral Discord replies** — offered to make bot responses private (only the invoking user sees them, via the `flags: 64` response flag) instead of visible to the whole channel. User hadn't answered yet when the session ended — ask/confirm before building.
3. **Multi-portfolio / profile switcher** — swap the "SWING" identity on the home screen for other trading styles (long-term, day-trading, high-risk), each with its own portfolio, account size, and trades. Explicitly deferred by the user to "the very end" — do not start without them asking. Would need a `Portfolio` model and scoping every `Trade`/`Setting`/`ScannerProfile` to it.
4. **Idea backlog, not yet built** (offered during brainstorming, none chosen yet beyond what's above): ⌘K command palette, "trade plan" generator from analyze (user explicitly said no to this one), "what happened overnight" pre-market scan digest, mistake-tagging on closed trades, concentration/sector-exposure warning, personal "trading rulebook" checked against every scan/analysis, personal weekly performance heatmap by day/hour, "no-trade mode" that locks the buy form, time-stop reminders, year-end tax-report export, a single "trading fitness" score, a digital-twin plan-adherence tracker, a market-regime-flip alert, a ₪-after-tax/commission "real profit" figure, a practice/backtest simulator, trade-replay (day-by-day chart playback of a closed trade), "setup readiness" progress bars on the watchlist, additional Discord commands (`/נתח`, `/סגור`, `/מעקב`, `/חדשות`, interactive buttons).
5. Sanity-check the 5 built-in scanner profiles' confidence/grade calibration against real scans (carried over from an earlier round, never revisited).

## Key decisions & context
- **Stack**: Next.js 16 + TypeScript + Tailwind v4 + Prisma 6 + Postgres (Neon, Frankfurt) + yahoo-finance2 + web-push + Discord webhooks/bot. Deployed on Vercel, Production Branch `trading`, Root Directory `TRAIDING/swing-trader`.
- **Local dev has no working database** (`.env` has a placeholder `DATABASE_URL_UNPOOLED`) — `next dev` on port 3000 will show a Prisma initialization error for any DB-backed page. This is expected; all verification this session happened by pushing to `trading` and checking the live deploy, often via the user's screenshots. A Windows Startup shortcut that used to auto-launch the broken local server on every boot was deleted (2026-09-09) — it no longer opens itself.
- **Manager workflow used throughout**: main session delegates to `builder` (blocking) for implementation, `designer` for visual passes, `reviewer` for money/security/perf-sensitive diffs (price alerts, auto-close, Discord signature verification, the 3D wall's memory management). This produced ~17 separate commits (`4b83921` through `dd9d036`+`acfe78e`), each verified with `npx tsc --noEmit && npm run build` before pushing.
- **Scoring engine** (from an earlier session, still the architecture): `src/lib/scoring.ts` is the single source of truth for scan/analysis scoring — `ScoringWeights` + `scoreSignals()`, two calibration modes (`"analysis"` clamped 0-100, `"scanner"` on an open scale normalized via `SCANNER_GRADE_CUTOFFS`). Never add scoring logic anywhere else.
- **Money-mutating code gets extra scrutiny**: every feature that writes to `Trade`/`PriceAlert` (auto-close-on-stop, price alerts, the Discord `/התראה` command) went through an explicit reviewer pass for atomicity (`updateMany` + count check to prevent double-fires) before shipping.
- Secrets policy: Discord bot credentials live in Vercel **environment variables**, not the Settings-page DB (unlike the Finnhub key and Discord webhook URLs, which are stored in the `Setting` table in clear text — acceptable because this is a single-user app with no auth, sitting behind Vercel's own Deployment Protection).

## Known issues / open questions
- The 2D Wall redesign has not been explicitly re-confirmed as "good" by the user after the last polish pass (round 15) — they moved on to the Discord bot before giving final visual feedback. Worth asking next time the topic of the Wall comes up.
- `after()`-based Discord follow-up delivery isn't 100% guaranteed by Next.js/Vercel — in rare cases a deferred command could appear stuck on "thinking" if the function is recycled mid-flight. Not yet seen in practice.
- Hebrew slash-command names work fine in practice (confirmed live), so no need to fall back to English names.
- No test suite exists in this project — verification is always `tsc` + `next build` + (when possible) live checks. `npm run lint` currently reports ~80 pre-existing `no-explicit-any` warnings unrelated to this session's work; `next build` doesn't run lint, so this hasn't blocked anything.
