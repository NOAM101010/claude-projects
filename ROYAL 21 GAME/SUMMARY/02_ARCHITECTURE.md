# Royal21 — Architecture Overview

## 🏗️ System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend (Vite)                       │
│  • Zustand for state management                                  │
│  • TypeScript for type safety                                    │
│  • Tailwind CSS for styling                                      │
│  • Framer Motion for animations                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │ REST API + Realtime WebSocket
┌────────────────────┴────────────────────────────────────────────┐
│                   Supabase Backend                               │
│  • PostgreSQL database                                           │
│  • Row-Level Security (RLS)                                      │
│  • Realtime subscriptions                                        │
│  • Authentication (Email + Anonymous)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Packages

```
node_modules/
├── react 18.x              — UI rendering
├── vite                    — Build tool
├── typescript              — Type checking
├── zustand                 — State management
├── framer-motion           — Animations
├── @supabase/supabase-js   — Database/Auth client
├── react-router-dom        — Routing
├── tailwindcss             — Styling
└── web-audio-api          — Sound synthesis (native)
```

---

## 🗂️ Project Structure

### `/src` Organization

```
src/
├── app/
│   ├── App.tsx             — Root component (MotionConfig, audio, presence)
│   ├── routes.tsx          — Route definitions
│   └── index.css           — Global styles
│
├── audio/
│   └── AudioManager.ts     — Web Audio API synthesizer + sound effects
│
├── components/
│   ├── layout/
│   │   ├── HUD.tsx         — Top info bar (chips, level, streak)
│   │   ├── SideNav.tsx     — Left menu (hub, shop, profile, settings)
│   │   ├── BackButton.tsx  — Back navigation
│   │   ├── SceneShell.tsx  — Page wrapper
│   │   └── ChipsPanel.tsx  — Chip display
│   │
│   ├── game/
│   │   ├── PlayingCard.tsx — Card sprite component
│   │   ├── Chip.tsx        — Chip visualizer
│   │   ├── PokerTable.tsx  — Pot display
│   │   └── PasswordPromptModal.tsx — VIP table gate
│   │
│   ├── social/
│   │   ├── ChatPanel.tsx   — Realtime chat UI
│   │   ├── FriendsPanel.tsx — Friends list + search
│   │   ├── GiftModal.tsx    — Send chips to friend
│   │   ├── InviteOverlay.tsx — Invite to game
│   │   └── Avatar.tsx      — Player profile picture + level
│   │
│   ├── ui/
│   │   ├── GameButton.tsx  — Main button component (forwardRef)
│   │   ├── GlassPanel.tsx  — Glassmorphic container
│   │   ├── Tooltip.tsx     — Info popup
│   │   ├── Modal.tsx       — Dialog
│   │   ├── Onboarding.tsx  — Tutorial overlay
│   │   ├── VipBadge.tsx    — VIP tier indicator
│   │   └── StreakBadge.tsx — Login streak display
│   │
│   ├── effects/
│   │   ├── LightPool.tsx   — Glow effect
│   │   ├── AmbientBackground.tsx — Floating chips/cards + mouse tracking light
│   │   ├── JackpotBanner.tsx — Progressive pot display
│   │   └── JackpotWin.tsx  — Jackpot win animation
│   │
│   └── layout/
│       └── Tabs.tsx        — Scrollable tab container (shop, friends, etc)
│
├── data/
│   ├── items.ts            — Shop items definition
│   ├── achievements.ts     — 27 achievements + descriptions
│   ├── economy.ts          — VIP tiers, RTP curves, gift limits
│   ├── slots.ts            — Slot machine payouts
│   ├── roomThemes.ts       — Room background gradients
│   └── vip.ts              — VIP eligibility checks
│
├── games/
│   ├── blackjack/
│   │   ├── engine.ts       — Blackjack game rules + payout logic
│   │   └── duel.ts         — Head-to-head scoring (best-of)
│   │
│   ├── poker/
│   │   ├── engine.ts       — 400+ lines: 4 streets, blinds, pots, showdown
│   │   ├── types.ts        — TypeScript interfaces
│   │   ├── equity.ts       — All-in win % calculation (Monte Carlo)
│   │   ├── handEval.ts     — 7-card best hand ranking
│   │   ├── useReveal.ts    — Theatrical runout animation
│   │   └── compare.ts      — Hand comparison logic
│   │
│   ├── highcard/
│   │   ├── HighCardScene.tsx
│   │   └── engine.ts       — War logic + deterministic outcomes
│   │
│   ├── coinflip/
│   │   ├── CoinFlipScene.tsx
│   │   └── engine.ts       — 50/50 + zero-sum
│   │
│   ├── slots/
│   │   ├── SlotsScene.tsx  — UI
│   │   └── engine.ts       — Payout table + RTP calculation
│   │
│   ├── scratch/
│   │   ├── ScratchScene.tsx
│   │   ├── ScratchCard.tsx — Canvas scratchoff mechanic
│   │   └── engine.ts       — Instant payouts
│   │
│   ├── roulette/
│   │   ├── engine.ts       — 37 pockets, odds, side pot logic
│   │   └── types.ts        — Bet types
│   │
│   └── night/
│       └── NightScene.tsx  — Tournament-style game series
│
├── scenes/
│   ├── intro/              — Onboarding 6-step wizard
│   ├── auth/               — Login/Register/Reset password
│   ├── hub/                — Main lobby (game cards, friends)
│   ├── lobby/              — Game lobby (choose stakes/buy-in)
│   ├── room/               — Blackjack table
│   ├── poker/
│   │   ├── PokerScene.tsx  — 6-seat cash game
│   │   └── SitAndGoScene.tsx — Tournament
│   ├── roulette/           — Roulette wheel + betting table
│   ├── profile/            — My Room (profile, achievements, cosmetics)
│   ├── settings/           — Game settings + sound/theme
│   ├── vip/                — VIP info + milestone progress
│   ├── shop/               — Buy cosmetics
│   ├── vault/              — Inventory management
│   └── admin/              — [Admin only] Server controls
│
├── services/
│   ├── supabase.ts         — Supabase client + auth + isRemoteId()
│   ├── authService.ts      — Login, signup, session restore
│   ├── profileService.ts   — Milestone rewards, leaderboard
│   ├── roomsService.ts     — Room creation, host permissions
│   ├── blackjackService.ts — Game hosting for Blackjack
│   ├── pokerService.ts     — Game hosting for Poker
│   ├── sngService.ts       — Tournament hosting
│   ├── rouletteService.ts  — Roulette hosting
│   ├── chatService.ts      — Message CRUD
│   ├── friendsService.ts   — Friend add/remove/search
│   ├── giftService.ts      — Send chips (with rate limit)
│   ├── shopService.ts      — Buy cosmetics (applies VIP discount)
│   ├── notificationService.ts — Game invites, friend requests
│   ├── presenceService.ts  — Online status, spectators
│   ├── localStore.ts       — localStorage persistence
│   ├── jackpotService.ts   — Progressive pot (Poker royal flush)
│   └── accountService.ts   — Account switching, device memory
│
├── stores/
│   ├── usePlayer.ts        — Profile, chips, level, stats, achievements, cosmetics
│   ├── useBlackjackRoom.ts — Game state for Blackjack
│   ├── usePokerRoom.ts     — Game state for Poker (6-seat cash)
│   ├── useSngRoom.ts       — Game state for Sit & Go
│   ├── useRouletteRoom.ts  — Game state for Roulette
│   ├── useSocial.ts        — Friends, leaderboard, rivalries, notifications
│   ├── useUI.ts            — Toasts, modals, loading state, theme
│   └── useSettings.ts      — Sound, language, animations
│
├── hooks/
│   ├── useT.ts             — i18n hook (t('key', vars))
│   ├── useInitialize.ts    — App startup sequence
│   ├── useAnimationReduced.ts — Motion preference
│   └── useLocalStorage.ts  — Sync with localStorage
│
├── lib/
│   ├── format.ts           — fmt(number) → "1.2M", "50K"
│   ├── random.ts           — Seeded random (mulberry32)
│   ├── time.ts             — Duration formatting
│   └── validators.ts       — Input validation
│
├── types/
│   └── index.ts            — Shared TypeScript definitions
│
└── i18n/
    ├── he.json             — Hebrew translations
    └── en.json             — English translations
```

---

## 🔄 Data Flow

### Authentication Flow

```
1. User lands on `/intro` (onboarding)
2. User chooses: Sign Up / Sign In / Continue as Guest
   ├─ Sign Up → authService.signUp(email, password)
   ├─ Sign In → authService.signIn(email, password)
   └─ Guest → authService.signUpAnonymous()
3. Supabase returns JWT session
4. Session stored in localStorage
5. usePlayer.initialize() fetches profile from `profiles` table
6. If new profile → create row with defaults (chips, level, xp)
7. RLS ensures user can only access their own data
8. Navigate to `/hub` (main lobby)
```

### Game Hosting Flow (Poker Example)

```
Player A (Host)                          Supabase                Player B (Guest)
│                                         │                       │
├─ Click "New Poker Table"                │                       │
├─ pokerService.createRoom()              │                       │
├─────────────────────────────────────────→ INSERT into rooms     │
│ (room.id, code, host_id, state)         │                       │
│ ← room created (code = "ABC123")        │                       │
│                                         │                       │
├─ usePokerRoom.create() → setup          │                       │
├─ Subscribe to room_actions channel      │                       │
├─ Start reducing engine on actions       │                       │
├─ Listen to room state updates           │                       │
│                                         │                       │
└─ Link: `/poker/ABC123`                  │ Player B clicks link  │
                                          │                       ├─ Redirect to `/poker/ABC123`
                                          │                       ├─ pokerService.joinRoom()
                                          │                       ├────────────────────────────→ INSERT into room_seats
                                          │                       │
                                          │                       ├─ usePokerRoom.joinByCode()
                                          │                       ├─ Subscribe to room_actions
                                          │ ← state broadcasted   ←─ Receive all past actions
                                          │   (every action)      ├─ Replay actions to catch up
                                          │                       │
Player A (still running engine)           │                       Player B (just watching)
├─ On action from B (e.g., call)          │                       │
├─ Validate locally (canSeatAct, stack)   │                       │
├─ Reduce engine: new state               │                       │
├─ Broadcast new state via POST           │                       │
│────────────────────────────────────────→ Update room.state      │
│                                         │────────────────────→ Realtime push to B
│                                         │                       ├─ Update displayCommunity
│                                         │                       ├─ Show bet, fade opponent
│                                         │                       └─ Display action log
│
All-in scenario:
├─ A or B goes all-in                     │                       │
├─ Host runs full runout engine.ts        │                       │
├─ Computes allInEquity (equity %)        │                       │
├─ Sets state.allInEquity                 │                       │
├─────────────────────────────────────────→ Broadcast with equity │
│                                         │────────────────────→ usePokerReveal hook
│                                         │                       ├─ Stage 1: Flop (2.2s delay)
│                                         │                       ├─ Show equity % for each player
│                                         │                       ├─ Stage 2: Turn (2.2s delay)
│                                         │                       ├─ Stage 3: River (2.2s delay)
│                                         │                       ├─ Stage 4: Showdown (1.5s delay)
│                                         │                       └─ Reveal hole cards + winner
```

### Realtime Sync Pattern

```
For all games (Poker, Blackjack, Roulette, etc):

1. Game state stored in `room.state` (JSON)
2. Host client runs engine locally
3. Every action → Broadcast to room_actions table
4. All clients subscribe to:
   - room.state (main game state)
   - room_actions (individual actions for replay)
5. Non-host clients replay all actions to stay in sync
6. If host disconnects → Next player becomes host + takes over engine

Advantages:
- Single source of truth (host)
- Deterministic (same seed + same actions = same state)
- Prevents cheating (host controls outcome)
- No RNG on client (seeded by host seed + hand number)

Disadvantages:
- Host must be responsive
- Host disconnection = brief pause while new host takes over
```

---

## 🗄️ Database Schema (Simplified)

```sql
-- Users & Auth (via Supabase Auth)
profiles
  ├── id (UUID, PK)
  ├── email
  ├── username
  ├── avatar (JSON)
  ├── chips (total)
  ├── level
  ├── xp
  ├── stats (JSON)
  ├── equipped (JSON)
  ├── owned_items (JSON)
  ├── owned_decor (JSON)
  ├── active_decor (JSON, max 4)
  ├── room_theme (string)
  ├── last_milestone_claimed (timestamp)
  └── weekly_prize_claimed_at (timestamp)

-- Friends & Social
friendships
  ├── id (UUID)
  ├── user1_id (user who sent request)
  ├── user2_id (user who received)
  └── status (pending/accepted/blocked)

rivalries
  ├── id (UUID)
  ├── user1_id
  ├── user2_id
  ├── game (blackjack/poker/roulette)
  ├── user1_wins
  ├── user1_losses
  ├── user1_chip_delta
  └── updated_at

chip_gifts
  ├── id (UUID)
  ├── sender_id
  ├── receiver_id
  ├── amount
  ├── sent_at (timestamp)

-- Game Rooms
rooms
  ├── id (UUID)
  ├── code (6-char, UQ)
  ├── host_id
  ├── game_type (blackjack/poker/sng/roulette)
  ├── state (JSON, game engine state)
  ├── config (JSON, stakes/buyIn/password/etc)
  ├── created_at
  └── ended_at (or NULL if ongoing)

room_seats
  ├── room_id
  ├── user_id
  ├── seat_number
  └── stack (current chips)

room_actions
  ├── id (serial)
  ├── room_id
  ├── user_id
  ├── action (JSON, e.g., {type: 'call', amount: 100})
  └── created_at

-- Chat
room_messages
  ├── id (UUID)
  ├── room_id
  ├── user_id
  ├── text
  ├── created_at
  └── (max 30 messages per room, old ones deleted)

-- Shop
items
  ├── id (string, PK)
  ├── name
  ├── category (cardFace/cardBack/coinFlipCoin/slotTheme/roomBg/roomDecor)
  ├── price (in chips)
  ├── rarity (common/rare/epic/legendary)
  └── data (JSON)

player_inventory
  ├── user_id
  ├── item_id
  └── owned_at (timestamp)

-- Leaderboard (computed from profiles.chips)
leaderboards (view, NOT TABLE)
  ├── Ranked by chips DESC
  ├── Updated in realtime (profiles subscription)
  └── Cache invalidated every 1 hour

-- Achievements
achievements (static table)
  ├── id (string)
  ├── title
  ├── description
  ├── unlock_condition (JSON)
  └── reward (chips)

player_achievements
  ├── user_id
  ├── achievement_id
  ├── unlocked_at (timestamp)

-- Notifications
notifications
  ├── id (UUID)
  ├── receiver_id
  ├── type (game_invite/friend_request/gift/etc)
  ├── data (JSON)
  ├── read_at (timestamp or NULL)
  └── created_at
```

---

## 🔐 Security & RLS

### Row-Level Security Policies

```
profiles:
  - Anyone can read public profile
  - Only owner can update own chips/level/etc

rooms:
  - Anyone can read room list
  - Only host can manage (delete, update state)
  - RLS doesn't block non-host from accessing, but they can't write

room_seats:
  - Anyone can read
  - Service role only can INSERT (via pokerService.joinRoom)

room_actions:
  - Anyone can read (for sync)
  - Only the actor (user_id) can insert own action

chip_gifts:
  - Receiver can read own gifts
  - Sender can read own gifts
  - Only service role can INSERT (via giftService.send)

friendships:
  - Both users can read their own friendships
  - Each can accept/reject their own requests

rivalries:
  - Both users can read their own records
  - Auto-updated after game finish (service role)
```

### Validation

- **Chips:** All transfers validated server-side (no client trust)
- **Actions:** Host runs engine, enforces game rules
- **Bets:** Roulette validates bet shape, amount ≤ stack
- **Authentication:** JWT required for all protected endpoints
- **Anonymous Users:** Limited access (no gift sending, no account switching)

---

## 🎲 Determinism & Seeding

All game randomness is **deterministic**:

```typescript
// Every game has a seed (based on room creation timestamp)
const seed = Math.floor(Date.now() / 1000);

// Seeded RNG (Mulberry32)
const rng = mulberry32(seed);

// For Poker:
const deck = buildDeck(seed);  // Always the same shuffled deck for same seed
const equity = computeEquity(..., seed);  // Same equity calculation for same seed

// Result: Given the same seed + same player actions, outcome is identical
// → No RNG on client, only replay of host's deterministic state
```

**Advantage:** No need to transmit card deals or random numbers. Only actions + seed are stored.

---

## 📡 Real-time Updates (Supabase Realtime)

### Subscription Channels

**Poker Example:**
- `rooms:ABC123` → Listen to room.state changes
- `room_actions:ABC123` → Listen to new player actions
- `presence:ABC123` → Who's online (spectators, players)

### Event Flow

```
1. Player takes action (e.g., raise to 500)
2. Host validates: can_act(), stack_sufficient()
3. Host broadcasts: { type: 'raise', userId: 'X', amount: 500 }
4. Supabase inserts to room_actions
5. Realtime push to all clients
6. Clients replay action: prevState + action → newState
7. Both host and clients show same result
```

### Rate Limiting

- Supabase Realtime: Max ~20 events/second per channel
- Most games well within this (poker action ~2-5/sec, roulette spin 1/sec)

---

## 🚀 Deployment & Performance

### Build Process

```bash
npm run build
# → dist/ folder (static files)
# → Ready for any static hosting (Vercel, Netlify, etc)
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Performance Optimizations

- Vite lazy-loads scene components (React.lazy)
- Zustand stores don't re-render unused state
- CSS variables for theme switching (no re-paint)
- Canvas for scratch cards (GPU accelerated)
- Web Audio for sound (no file downloads)
- Tailwind CSS (99% unused CSS tree-shaken)

### Caching

- **Service Workers:** Not implemented (client-side only)
- **IndexedDB:** Used for local game persistence (optional)
- **localStorage:** Session token + device account list

---

## 🧪 Testing Architecture

```
scripts/
├── engine.test.ts     → Blackjack engine (65 tests)
├── slots.test.ts      → Slot payout (20 tests)
├── audio.test.ts      → Audio synthesis (3 tests)
├── poker.test.ts      → Poker engine (15 tests)
├── roulette.test.ts   → Roulette outcomes (37 tests)
├── minigames.test.ts  → High Card, Coin Flip (9 tests)
└── social.test.ts     → VIP tiers, streaks, gifts (15 tests)

Run all: npm run test:all
Single: npm run test:poker
```

All tests are **unit tests** (no browser, fast execution).

---

## 🐛 Common Issues & Solutions

### 401 Unauthorized

**Cause:** Session expired or not set
**Fix:** 
1. Check localStorage for `sb-XXX-auth-token`
2. Run `authService.restore()`
3. If still fails, user needs to re-login

### 403 Forbidden (RLS)

**Cause:** RLS policy denied access
**Fix:**
1. Verify user's `profiles` row exists
2. Check if trying to access another user's data
3. Run `supabase/setup.sql` to refresh policies

### Realtime Sync Lag

**Cause:** Host slow, action queue backed up
**Fix:**
1. Check network latency (DevTools → Network)
2. Host takes ~200ms per action, max 20/sec
3. If >20/sec, Supabase rate-limits

### Chips Not Updating

**Cause:** Local state ≠ DB state
**Fix:**
1. Refresh page (`F5`)
2. Check if action succeeded (console warnings)
3. Verify `isRemoteId()` check in service

---

## 📚 Key Concepts

### Host-Authoritative
Only the host runs the game engine and calculates outcomes. Clients trust the host.
- Pro: Prevents cheating, single source of truth
- Con: Host disconnection impacts game

### Zero-Sum
In multiplayer games, total chips in = total chips out (no house cut).
Example: 3 players with [100, 200, 50] chips join poker → winner takes all 350.

### Seeded Determinism
Given seed + action sequence, outcome is always identical. Enables replaying actions without storing full game state.

### Equity Calculation
For all-in situations, compute each player's win probability given remaining unknown cards. Used for display only (doesn't affect actual outcome).

---

End of Architecture Document. See other files for more details.
