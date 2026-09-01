# ROYAL 21 — Multiplayer flow rework (BJ duel, game night, roulette MP, poker, SnG)

> **For a fresh chat.** You are working on `C:\CLAUDE AI\ROYAL 21 GAME` (React 18 + TS + Vite + Supabase, RTL Hebrew casino game). `C:\CLAUDE AI\CLAUDE.md` loads automatically — you are the manager: delegate concrete tasks to the `builder` agent (blocking), use `reviewer` (haiku) only for money/auth/MP-sync or large diffs, `designer` only for real UI. Read `ROYAL 21 GAME/ROYAL 21 PROGRESS/progress.md` and the memory `royal21_bugfix_loop.md` first — nothing else. Dev server: `PORT=5199 npm run dev` (restart it + `rm -rf node_modules/.vite` if a change "isn't showing" — HMR misses in this repo; stale browser-console errors after a restart are cache, `tsc`/`vite build`/`test:all` are the authority). All work is committed straight to `main` (Vercel auto-deploys); commit message ends `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Context

The single-player game is done and shipped. The user ran a real 2-browser multiplayer test and the social-game MP layer is broken in many ways. Root themes:

1. **Points-based modes leak chip mechanics.** "BJ vs friends" (duel) and Game Night are meant to be *play for a buy-in pot / for points* — not chips per hand. The duel domain model (`src/games/blackjack/duel.ts`) is already points-based, but the blackjack *scene* still renders the full betting UI in duel, requires a per-hand bet to play, and moves chips client-side per hand in a way that races and leaks.
2. **The "ready / start" flow is wrong everywhere.** One player pressing "ready" seats them alone and a 15s timer deals without the others. There is no "wait for all players, start when all ready" barrier, and no auto-continue.
3. **Player-leave strands every social game.** Leaving mid-round/hand freezes the table, doesn't refund, doesn't update the other player's screen. Game Night has no ghost-cleanup at all.
4. **Roulette MP is severely broken.** The wheel doesn't spin for the non-host (regression from a recent `spinAt` sync commit), the manual spin button is disabled with 2 players, a joiner is a permanent spectator for the round, leave forfeits chips.
5. **Host-first / pre-reveal result leaks.** SnG shows the tournament winner + `bigWin` sound ~4-8s before the all-in board finishes running out. (Roulette's version of this was partly fixed but the fix caused #4.)

### Decisions already made with the user

| Topic | Decision |
|---|---|
| Duel money model | **buy-in → pot → winner, points only. NO per-hand betting UI in duel at all.** |
| Poker + SnG hand start | **auto-start like real poker** — ≥2 players with chips → next hand begins on its own, no "ready", no "start hand". |
| "BLACKJACK PAYS 3 TO 2" text | **remove from everywhere** (solo felt, hub table object). Keep the actual 3:2 payout math. |
| Double / Split buttons | **hide in duel only** (stay in solo + cash). |
| Roulette / coinflip / highcard MP round | **wait for all seated players "ready" → betting window opens → auto-advance.** A mid-round joiner spectates until the next round. |
| Player-leave (all social games) | **enough players remain → current round/hand aborts and a fresh one starts immediately; not enough → a "waiting for players" screen.** |
| Game Night game pick | **only the room host picks the next game, and the pick pulls every player in the room into that game.** Non-host cannot pick. Both-ready → start immediately. |

---

## STAGE 1 — Shared MP infrastructure (do this first)

Everything else builds on this. The goal: one reusable "all ready → start / auto-continue / survive a leave" model, applied per game in later stages.

### 1a. "All seated players ready" gate + auto-start

**Current (broken):** `src/scenes/blackjack/BlackjackScene.tsx:169-180` — the betting-window effect fires on `state.seats.some(s => s.ready)` (ANY seat), arms `state.deadline = now + 15000`, and the host dispatches `deal` when the countdown hits 0 regardless of whether other seats readied. `deal` reducer (`src/games/blackjack/engine.ts:257-279`) then makes any seat with `bet <= 0` a `spectator`.

**Target model** (blackjack duel + game-night blackjack + roulette + coinflip + highcard):
- The round/hand does **not** arm its deadline or deal until **every non-spectator seat has `ready === true`** (or the game-specific equivalent — roulette: every non-spectator seat; coinflip/highcard already use `stake > 0` as implicit-ready, keep that but also require all present).
- The moment the last player readies → start immediately (skip / zero-out the countdown).
- After a round settles → auto-open the next betting window (`openBetting`) and **auto-clear every `ready` flag** so players ready-up again for the next round. (Blackjack `openBetting` at `engine.ts:221-249` already exists; `nextHand()` at `BlackjackScene.tsx:451-456` currently needs a manual click — make the host auto-fire it after a short delay once `phase === 'settled'`, mirroring `SitAndGoScene.tsx:152-159`.)
- Reuse: the `ready` action + `BjSeat.ready` flag already exist (`engine.ts:73`, `:215-220`). Roulette/coinflip/highcard need an equivalent `ready` concept added to their seat types + a `ready` action in their engines (`src/games/{roulette,coinflip,highcard}/engine.ts`) — small, mirror blackjack's.

### 1b. Auto-start for poker + SnG

- **SnG already does it:** `src/scenes/poker/SitAndGoScene.tsx:152-159` — host auto-sends `startHand` 2200ms after `street === 'waiting'` when `alive.length >= 2` and not `revealing`. **Copy this into cash poker.**
- Cash poker today: `src/scenes/poker/PokerScene.tsx:310-316` only auto-starts when **every** seated player has toggled `ready`, and `startHand` (`src/games/poker/engine.ts:368`) resets `seat.ready = false` each hand → manual re-ready every hand.
- **Change:** in `PokerScene`, replace the "all ready" auto-start with the SnG pattern — host auto-sends `startHand` a couple seconds after `street === 'waiting'` when `seats.filter(s => !s.sittingOut && s.stack > 0).length >= 2` and not `revealing`. Remove the per-hand Ready requirement and the "waiting for ready" UI (`PokerScene.tsx:603-627`); keep only a "waiting for players" state (`< 2` eligible). Keep the manual host "start" button as a fallback but it should rarely be needed.
- `MIN_TO_START` is exported from `src/games/poker/types.ts` (`engine.ts:11`).

### 1c. Unified player-leave handling

**Current:** ghost-cleanup is per-scene. Blackjack has it (`BlackjackScene.tsx:151-159`: host diffs `state.seats` vs `members`, dispatches `{type:'leave'}` per missing user). Poker has it (`PokerScene.tsx:296-304`). **Roulette and Game Night do not.** No `pagehide`/unmount leave handler for roulette. A hard disconnect (no `pagehide`) leaves the seat until Supabase membership drops, then the host cleans up — up to ~30s of frozen table.

**Target:**
- Extract the host ghost-cleanup into a **shared hook** — e.g. `src/hooks/useGhostSeatCleanup.ts(isHost, state, members, send)` — and use it in every MP scene (blackjack, poker, SnG, roulette, coinflip, highcard, night).
- Add a `pagehide` + unmount best-effort `{type:'leave'}` to roulette / coinflip / highcard scenes (copy `BlackjackScene.tsx:138-144` + the `leaveCleanup` ref pattern at `:347-365`).
- **Each engine's `leave` reducer** must, after removing the seat:
  - **Enough players remain** (game-specific min: 2 for duel/roulette/poker/SnG, coinflip/highcard ≥2) and a round/hand is in progress → **abort the current round and reopen betting / go to `waiting`** (fresh start), rather than trying to limp the round to completion. Poker's `leave` already does the right thing for the uncontested case (`engine.ts:466-514` → `finishHand(uncontested)` when `contenders <= 1`); extend the "abort & restart" idea to roulette/coinflip/highcard/duel where a mid-round leave currently just filters the seat with no phase change (`roulette engine.ts:136-139`).
  - **Not enough players remain** → set the phase to a `waiting` / `betting`-with-no-deadline state and the scene shows a "waiting for players" panel (roulette `rooms.waitingForPlayers` / `poker.waitingRoom` i18n keys exist).
- **Refund on leave:** any optimistic `addChips(-stake)` this round must be refunded when the player leaves mid-round. Roulette's `handleClear` already tracks `roundOutlay` / `clearRefunded` refs (`RouletteScene.tsx:325-350`) — the `leaveCleanup` should refund `roundOutlay.current.amount - clearRefunded.current.amount` if `phase !== 'settled'`. Mirror in coinflip/highcard.

### 1d. Host-death freeze window

Leave as-is for now (`reassign_room_host` needs 20s stale, ~5-25s freeze). Note it in progress.md as a known limitation. A future improvement: shorten `HOST_HEARTBEAT_MS` / the reaper window, or have the promoted host abort+restart the round. **Not in scope for this pass** unless it's trivial once 1c lands.

**Stage 1 files:** `src/scenes/blackjack/BlackjackScene.tsx`, `src/scenes/poker/PokerScene.tsx`, `src/scenes/poker/SitAndGoScene.tsx`, `src/games/blackjack/engine.ts`, `src/games/poker/engine.ts`, `src/games/roulette/engine.ts`, `src/games/coinflip/engine.ts`, `src/games/highcard/engine.ts`, new `src/hooks/useGhostSeatCleanup.ts`, seat types in `src/games/*/types.ts`. Reviewer after (money + MP-sync + large).

---

## STAGE 2 — Roulette multiplayer (most broken — do right after Stage 1)

### 2a. Wheel doesn't spin for the non-host (regression)

`src/scenes/roulette/RouletteScene.tsx:141-157` — the spin-trigger effect:
```js
useEffect(() => {
  if (!state || state.phase !== 'settled' || state.winningNumber === null) return;
  if (spunRound.current === state.round) return;
  spunRound.current = state.round;                 // set synchronously, BEFORE the timeout fires
  const spinAt = state.spinAt ?? Date.now();
  const startDelay = mode === 'solo' ? 0 : Math.max(0, REVEAL_SYNC_MS - (Date.now() - spinAt));
  const timer = setTimeout(() => { setWheelSpinning(true); audio.play('coin'); }, startDelay);
  return () => clearTimeout(timer);
}, [state]);                                        // re-runs + clearTimeout on ANY state change
```
**Bug:** `spunRound.current` is consumed before the delayed `setWheelSpinning(true)` runs. The effect deps are `[state]` and the cleanup clears the timer — so any inbound state frame during `startDelay` (host re-publish, heartbeat, another player's presence/join write, a late realtime frame) cancels the pending timer, the effect re-runs, sees `spunRound.current === state.round`, and returns. `setWheelSpinning(true)` never fires and is never re-armed. The host doesn't hit it (one local `set({state})`, no inbound burst). Result: non-host's wheel never spins, `handleWheelSettled` never runs, `creditedRound` never advances, `pendingReveal` (`RouletteScene.tsx:100`) stays true forever so the number stays hidden; only the 6s safety-net (`:282-301`) credits chips.

**Fix:** decouple the guard from the schedule.
- Only set `spunRound.current = state.round` **inside** the `setTimeout` callback (right before `setWheelSpinning(true)`), not synchronously.
- Or (cleaner): drive the delay off a `spinScheduledFor` ref, and in the effect, if `spunRound.current !== state.round` and no timer is pending for this round, schedule one; don't `clearTimeout` on every re-render — only clear on unmount. Keep the guard check as `spunRound.current === state.round` so re-runs are cheap no-ops but the *first* schedule survives.
- **`spinAt` clock skew:** `spinAt` is `Date.now()` on the host (`engine.ts:212`). The non-host computes `REVEAL_SYNC_MS - (Date.now() - spinAt)` across two wall clocks → inflated / negative-clamped delay. Simplest robust fix: cap `startDelay` at `REVEAL_SYNC_MS` (`Math.min(REVEAL_SYNC_MS, Math.max(0, ...))`), OR stamp `spinAt` relative to when *this client* first saw the settled state (a ref set on first observation of `state.round` in `settled`) and delay from that. The cross-player reveal sync only needs to be *approximate*.

### 2b. Manual spin button disabled with 2 players

`RouletteScene.tsx:539-555` — spin button `disabled` includes `realPlayerCount > 1` in room mode, so with 2 real players the host can never press it; the round can only advance via the `armWindow → lockBets → spin` auto-timer chain (`:197-226`). With Stage 1's "all ready" gate, the flow should be: all ready → window arms (10s or configurable) → auto-lock → auto-spin. Keep a host "spin now" button **enabled** once all players are ready / the window is open (let the host short-circuit the countdown), and remove the `realPlayerCount > 1` disable.

### 2c. Joiner is a permanent spectator for the round

`src/games/roulette/engine.ts:132` — a `join` mid-non-betting-phase sets `seat.spectator = state.phase !== 'betting'`, only cleared on the next `openBetting` (`:177-183`). While spectator: `canBet` false (`RouletteScene.tsx:414`), `handleBet` early-returns (`:304`) — "whoever's at the table can't play". And while they're a spectator `realPlayerCount` stays 1 so `armWindow` bails (`:199`) → no betting window ever opens.
**Fix:** with Stage 1's model, a fresh join should land the player as a **non-spectator** waiting to press "ready" for the next round, and the next round's betting window only arms once all seated players (including them) are ready. A join that lands mid-active-round → spectate that round, become a full player for the next. Make sure `realPlayerCount` / the ready-gate counts a just-joined not-yet-ready player as "present, must ready" so the window waits for them.

### 2d. Leave mid-round forfeits staked chips

No `pagehide`/unmount leave handler for roulette (only the Back button at `RouletteScene.tsx:602`). Covered by Stage 1c — add the handler + refund `roundOutlay - clearRefunded` when leaving before `settled`.

**Stage 2 files:** `src/scenes/roulette/RouletteScene.tsx`, `src/scenes/roulette/RouletteWheel.tsx`, `src/games/roulette/engine.ts`, `src/games/roulette/types.ts`, `src/stores/useRouletteRoom.ts`. Live-verify with the user (2 browsers) after. Reviewer before that.

---

## STAGE 3 — Duel (BJ vs friends) + remove "3 TO 2" text + Double

### 3a. Rip the betting UI out of duel

There is no separate duel scene — `src/scenes/blackjack/BlackjackScene.tsx` renders solo / cash-room / duel; `duel = state?.duel` (`:70`). Currently in duel:
- `BetRail` renders (`BlackjackScene.tsx:607-625`) with no `duel` check — chip rail, Clear, Last-bet, All-in, a Ready/Deal button `disabled={!bet}` (`BetRail.tsx:87`), and the countdown line.
- `readyUp` (`BlackjackScene.tsx:430-435`) early-returns unless `mySeat.bet` — so you must place a bet to play.
- `deal` reducer (`engine.ts:262`) makes anyone with `bet <= 0` a spectator.

**Fix:**
- In duel mode, **do not render `BetRail`**. Replace it with a simple "מוכן" button that dispatches `{type:'ready'}` directly (no bet). The Stage 1 all-ready gate then deals when both press it.
- `deal` reducer / duel path: seat everyone who is `ready` (not `bet > 0`). Add a `duel`-aware branch or pass a flag so `deal` doesn't spectator-out ready players who have no bet.
- Duel hands need a nominal per-hand "stake" only for the points math (`pointsForHand` in `duel.ts` doesn't actually use the bet — verify; `BlackjackScene.tsx:195-198` computes `staked`/`net` from `hand.bet`). If the engine needs a non-zero bet to deal a hand, set a fixed internal bet (e.g. 1, or the buy-in / target) that never touches `addChips`. Cleanest: give duel hands `bet = 0` and make the engine deal-with-zero-bet valid in duel.

### 3b. Duel chip flow — make it robust

Current (all in `BlackjackScene.tsx`, all client-authoritative `addChips`, fragile):
- Buy-in debit: `paidDuelBuyIn` ref + effect `:299-308` — each client debits itself `addChips(-buyIn, {silent:true})`.
- Per-hand settlement **skipped** when `duel` truthy (`:210-226`) — **but this is a race**: if `state.duel` hasn't synced on a peer when a hand first settles (peers drop frames whose `version` isn't strictly greater — `useRoom.ts:131`), `inDuel` is false and that hand runs `addChips(payout)` + `claimPayout` = real chip leak.
- Pot payout: effect `:313-327` — `if (duel.winner === profile.id) addChips(potOf(duel.config, state.seats.length))`. Uses **live** `seats.length` → shrinks if someone left → winner underpaid. Leaver's buy-in is just gone.
- `refreshFromServer()` on unmount (`:363`) can clobber the optimistic duel balance.

**Fix (keep it client-side but correct — a server RPC for duel is out of scope):**
- Gate the per-hand settlement skip on **`state.duel !== undefined`** read from the *store's* `state` (not a stale closure) AND have the host stamp `duel` onto the very first published state so no peer ever settles a hand without it. Or: gate on `roomMode && !!room` + a `duelConfirmed` ref that flips true once `state.duel` is seen, and never run `addChips(payout)`/`claimPayout` after that even if a later frame momentarily lacks `duel`.
- **Fix `potOf`:** `src/games/blackjack/duel.ts:105` — `potOf` should use the seat count *at buy-in time* (store `duel.config.seats.length` or a `duel.pot` field set when the duel starts in `RoomScene.tsx:97-111`), not the live count. Pay the winner exactly `buyIn * originalPlayerCount`.
- **Leaver:** if a duel player leaves before the match resolves — either (a) the match ends immediately and the remaining player wins the pot (matches the "enough players remain → ... ; not enough → wait" rule: a 2-player duel with 1 leaver = not enough → the remaining player wins by forfeit and takes the pot), or (b) refund both buy-ins if the match is abandoned. Pick (a): remaining player wins the pot.
- **`duelWinner` tie handling:** `duel.ts:81-97` returns `null` on a tie → with one player gone the match never resolves. When `state.seats` drops below 2 in an unresolved duel, force-resolve to the remaining player.
- Don't let `refreshFromServer` on unmount overwrite a just-credited pot — the pot `addChips` should also `setChips`/persist so the server row is updated, or skip `refreshFromServer` when a duel just paid out this session.

### 3c. Duel ready flow / auto-continue

- Both players in the room press "מוכן" → first hand deals immediately (Stage 1 gate).
- After each hand settles → host auto-opens the next hand's ready prompt (auto-`openBetting`, clear `ready`), OR (simpler for duel) auto-deal the next hand after a short pause with no re-ready, until `duelWinner` is set. Confirm with progress notes which — leaning **auto-deal next hand, no re-ready** (it's a race to points, re-ready-ing every hand is friction).
- On `duelWinner` set → show the summary (`SessionSummary` / the pot moment), then back to the room.

### 3d. Remove "BLACKJACK PAYS 3 TO 2" + the rules line

Remove the text (not the payout math) from:
- `src/scenes/blackjack/BlackjackScene.tsx:508-516` — the hardcoded `BLACKJACK PAYS 3 TO 2` div + the `{t('blackjack.rules')}` line right under it. Delete both (all modes — solo, cash, duel).
- `src/scenes/hub/hubObjects.tsx:22` — `<text>BLACKJACK PAYS 3 TO 2</text>` in the hub table SVG. Remove.
- Leave `blackjack.rules` in i18n (harmless if unused) or delete it from he/en keeping parity. Lobby blurb `blurbBlackjack` and how-to-play `tablesBody` still mention 3:2 — the user didn't ask to touch those; leave them.
- **Keep** the payout math `bet + floor(bet * 1.5)` (`src/games/blackjack/engine.ts:139`).

### 3e. Hide Double / Split in duel

- `src/scenes/blackjack/ActionBar.tsx:31-36` — the fixed Hit/Stand/Double/Split grid, mounted whenever `phase === 'playing'` (`BlackjackScene.tsx:627-639`), not `duel`-aware.
- **Fix:** pass a `duel` (or `hideDoubleSplit`) prop to `ActionBar`; in duel render only Hit / Stand. Also make `canDouble`/`canSplit` duel-aware where the scene calls them (`BlackjackScene.tsx:632-633`) — in duel they shouldn't gate on `profile.chips` at all (the buy-in covers the match) — but since the buttons are hidden in duel this is moot; just don't crash.

**Stage 3 files:** `src/scenes/blackjack/BlackjackScene.tsx`, `src/scenes/blackjack/BetRail.tsx`, `src/scenes/blackjack/ActionBar.tsx`, `src/scenes/blackjack/SessionSummary.tsx`, `src/scenes/room/RoomScene.tsx` (stamp `duel.pot`/original seat count at start), `src/games/blackjack/duel.ts`, `src/games/blackjack/engine.ts`, `src/scenes/hub/hubObjects.tsx`, i18n. Reviewer after (money + MP).

---

## STAGE 4 — Game Night + SnG all-in reveal

### 4a. Game Night — host-only pick, pull everyone in

`src/scenes/night/NightScene.tsx`. A Night room is a blackjack room row (`game:'blackjack'`, `useRoom`). Scoreboard from `state.history` (`src/games/night/night.ts`).

**Current:** picker UI `:293-319` — every member can click. Click = `openMultiplayerGame(game.key)` (coinflip/highcard, `:73-89`) or plain `navigate(game.to(roomCode))` (blackjack/slots/scratch, `:302-306`) — only the clicker moves. Only coinflip/highcard sync a shared code via `setActiveMiniGame` (reducer `engine.ts:356-359`), and even then others must click to join.

**Fix:**
- Gate the picker so **only `isHost`** sees/uses it (mirror the "Wrap up the night" button which is already `isHost`-gated at `:367-378`). Non-host sees "waiting for the host to pick" / the scoreboard only.
- When the host picks a game: broadcast it — dispatch `{type:'setActiveGame', game, code}` (extend `activeMiniGame` to cover *all* games, or add a parallel `activeGame` field to `BjState`). Host also creates the sub-room where needed.
- **Every client** watches `state.activeGame` and **auto-navigates** into it when it changes (a `useEffect` in `NightScene` — `if (state.activeGame && state.activeGame.code) navigate(...)`). The sub-game scenes, on `?night=<code>` return, already route back to Night via `useNightReturn`.
- **Clear `activeGame`** when everyone has returned to Night, and when its host disappears (Stage 1c ghost-cleanup / a `watchHostLiveness`-style check) so a stale pointer doesn't send players into a dead room.
- Both-ready in the Night blackjack sub-table → Stage 1a gate handles it.

### 4b. Game Night — leave resilience

- Add the Stage 1c shared `useGhostSeatCleanup` to `NightScene` (it has none today).
- A leaver should drop off the scoreboard's "present" list (keep their history rows, or not — user said "if someone leaves something it doesn't show", implying they want it to update cleanly; simplest: keep scored history but mark the row "left").
- If the Night **host** leaves → `reassign_room_host` promotes someone; make sure the new host can pick games (they now pass `isHost`). Known ~5-25s freeze (Stage 1d).
- Clear `activeGame` / `activeMiniGame` if its creator leaves.

### 4c. SnG all-in showdown — winner shown before cards revealed

`src/scenes/poker/SitAndGoScene.tsx:173-194` — the tournament-settle effect fires on `tournament?.finished` flipping true, **not gated on `revealing`**. `usePokerReveal` (`src/games/poker/useReveal.ts`) animates the community/showdown client-side over `REVEAL_STEP_MS=2200` per card + `REVEAL_SHOWDOWN_DELAY_MS=1500`, so `tournament.finished` arrives on the same settled state the reveal has only just begun. The winner banner (`:408`) and hand-result banner (`:388`) *are* gated on `!revealing`; this effect isn't → the "ניצחת בטורניר" moment + `bigWin` sting land ~4-8s early.

**Fix:**
- Gate the `SitAndGoScene.tsx:173-194` effect on `!revealing` (add `revealing` to the deps and `if (!tournament?.finished || settledTournament.current || revealing) return;`).
- Same pattern in cash poker: `src/scenes/poker/PokerScene.tsx:229-261` plays `win`/`bigWin` + claims jackpot + records stats keyed on `state.street`/`handNumber`, **not** `revealing` — gate that on `!revealing` too so the win sound doesn't precede the river.
- Pure client-side (`usePokerReveal` runs per-client off `state`), so no cross-client desync to fix here — the problem is intra-client (moment before that client's own reveal).

**Stage 4 files:** `src/scenes/night/NightScene.tsx`, `src/games/blackjack/engine.ts` (activeGame field + reducer), `src/games/night/night.ts`, `src/scenes/poker/SitAndGoScene.tsx`, `src/scenes/poker/PokerScene.tsx`, i18n. Reviewer for the SnG/poker money-adjacent bits.

---

## Verification (per stage — run before committing that stage)

1. `npx tsc --noEmit` clean · `npx vite build` clean · `npm run test:all` green · i18n he/en key parity equal.
2. **Solo regression** (must never break): open `/blackjack/solo`, `/game/roulette/solo`, `/game/coinflip`, `/game/highcard` — bet/clear/deal/settle chips exact, wheel/flip/draw reveal normally. Poker/SnG single-flow still deals.
3. **2-session MP** (the main-session Claude can do a limited version — the Browser pane shares localStorage across tabs, so use sequential `localStorage['sb-ylhqwzokrfiwobfurkfx-auth-token']` swapping between two anon sessions created via `fetch(<supabase>/auth/v1/signup,{})`; the session-injection trick is in the memory file). Rooms persist server-side so you can create as A, swap to B, join by code, act as B, swap back. This covers non-host chip accounting and the ready-gate; it does NOT cover true simultaneous sync / the wheel spinning on both / host handoff.
4. **The user does the real 2-browser test** after each stage lands on `main` (`ROYAL 21 GAME/MP_VERIFICATION_GUIDE.md`). Wait for their go before starting the next stage if the current one touched money.
5. Specific checks: duel — no bet UI, both-ready deals immediately, points accrue, winner gets `buyIn × originalPlayers`, a leaver forfeits to the other. Roulette MP — wheel spins on BOTH screens, reveal lands together, spin works with 2 players, a joiner can bet next round, leave refunds the stake. Poker — next hand auto-starts, a mid-hand leaver doesn't strand the table. Night — only host picks, pick pulls everyone in. SnG — winner moment waits for the board to finish.

## Known limitations to note in progress.md (not in scope)

- Host-death freeze is still ~5-25s (`reassign_room_host` 20s stale window).
- Duel chip flow stays client-authoritative (no dedicated server RPC) — made correct but not tamper-proof.
- The Browser-pane test env can't do true simultaneous 2-player — the user is the real verifier.
