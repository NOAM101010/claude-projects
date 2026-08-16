# Royal21 — Known Issues & Fixes

## 🔴 Critical Issues

### None Currently Known

All critical systems (Auth, Realtime, Game Engines) are working correctly.

---

## 🟡 Important Issues to Fix

### 1. Roulette Betting Timer ⚠️ MEDIUM PRIORITY

**Issue:**
- When table host clicks "New Spin", the wheel spins immediately
- Other players might still be placing bets
- Bets placed after spin starts are rejected (race condition)

**Current Behavior:**
- No timer shown
- Players must manually place bets quickly
- Possible lost bets if bet is placed while wheel is spinning

**Fix Required:**
```typescript
// In RouletteScene.tsx, add countdown timer before spin
const [bettingTimeLeft, setBettingTimeLeft] = useState(10);

useEffect(() => {
  if (!bettingAllowed) return;
  const interval = setInterval(() => {
    setBettingTimeLeft(t => {
      if (t <= 1) {
        // Auto-spin when time runs out
        onSpin();
        return 10;
      }
      return t - 1;
    });
  }, 1000);
  return () => clearInterval(interval);
}, [bettingAllowed]);

// UI: Show timer "Place bets in: 7s"
// If count reaches 0, auto-spin for all players
```

**Verification:**
- Open 2 browser windows with Roulette
- Player A hosts table
- Player B tries to place bet while Player A spins
- Bet should be rejected, not hang

**Effort:** ~1 hour (add timer logic + UI)

---

### 2. Night/Tournament Mode Flow 🎮 HIGH PRIORITY

**Issue #1: Return to Tournament Closes Game**
- Player plays a Blackjack hand in a tournament series
- Hand finishes
- Clicking "Back to Tournament" navigates away and doesn't auto-resume
- Player must manually open tournament again

**Current Behavior:**
```
Hub → Tournament Series (Night) → Blackjack Hand → "Back" → Hub
                                                     (lost tournament context!)
```

**Expected Behavior:**
```
Hub → Tournament Series → Blackjack Hand → "Back" → Tournament Series (resume)
                                                     (no click to re-enter)
```

**Fix Required:**
- Store tournament room code in Zustand store
- "Back" button navigates to `/night/{roomCode}` instead of `/hub`
- UI logic to auto-scroll to next game when hand finishes

**Effort:** ~2 hours

---

**Issue #2: 1v1 UI Not Special**
- When 2 players play head-to-head game (Coin Flip, High Card), display is generic
- Should show "Player A vs Player B" prominently with live score

**Current UI:**
```
Regular table with 2 seats, normal action bar
```

**Expected UI:**
```
Large centered display: "Alice VS Bob"
          [Score: 3-2]
      
Left side: Alice's hand    Right side: Bob's hand
Live odds/equity in middle
```

**Fix Required:**
- Detect 2-player games (toAct seating = 2 occupied)
- Switch to special 1v1 layout (Tailwind grid or absolute positioning)
- Show large names + score + live odds

**Effort:** ~3 hours

---

### 3. Leaderboard Points Not Updating? ⚠️ UNCLEAR

**Issue:**
- Leaderboard shows total chips, but unclear if new game results update the leaderboard
- May need verification

**How to Test:**
1. Open leaderboard
2. Play a poker hand, win 500 chips
3. Refresh leaderboard
4. Check if your position improved

**If Broken:**
- Check `updateLeaderboard()` is called after game finish
- Verify RLS allows read of leaderboard
- Check Realtime subscription to leaderboard view

**Current Flow:**
```typescript
// In usePokerRoom, after game finishes:
const mine = state.lastResult.find(r => r.userId === profile.id);
addChips(mine.net);  // Updates local store
// → usePlayer.addChips() triggers profile subscription update
// → Leaderboard view should auto-update (Supabase RLS)
```

**Verification:** Check DevTools Network tab → `profiles` table updates

**Effort:** ~30 minutes (if issue exists)

---

## 🟠 Nice-to-Have Improvements

### 1. Roulette Dual-Machine Sync Test

**Issue:** 
- Document mentions checking sync on 2 machines simultaneously
- Never formally tested

**Why It Matters:**
- Ensures Host-Authoritative pattern works with network latency

**Test Plan:**
```
1. Machine A (host):  localhost:5173
2. Machine B (guest): Same network, join via code
3. A places bet, spins
4. B should see wheel spin at same time (within 500ms)
5. Verify payout shown on both machines identically
```

**Effort:** ~1 hour (manual testing)

---

### 2. Auto-Play Slots

**Issue:** 
- Slots require clicking spin for each round
- Should have "Run 25 spins" button

**Why It Matters:**
- Quality-of-life improvement
- Players expect it

**Implementation:**
```typescript
const [autoSpins, setAutoSpins] = useState(0);

async function runAutoPlay(count: number) {
  setAutoSpins(count);
  for (let i = 0; i < count; i++) {
    await spinOnce();
    await new Promise(resolve => setTimeout(resolve, 800)); // Delay between spins
    setAutoSpins(count - i - 1);
  }
}

// UI: Input box "Run _ spins" + Start button
// During auto-play: show "25 spins remaining..."
```

**Effort:** ~1.5 hours

---

### 3. Night Mode Special Ladder

**Issue:**
- Tournament mode doesn't have a separate leaderboard during the series
- Final results not displayed as "Tournament Winner"

**Why It Matters:**
- Tournament feels less special
- No climax

**Implementation:**
```typescript
// Add to room.config:
// { tourName: "Tuesday Night", prizePool: 5000, ... }

// After tournament ends:
// 1. Show "Champion: Alice" prominently
// 2. List final rankings
// 3. Add special badge to Alice's profile temporarily
// 4. Auto-archive tournament after 24h
```

**Effort:** ~2.5 hours

---

## 🟢 Verified & Working

- ✅ **Blackjack Multiplayer** — Sync fixed 2026-08-16
- ✅ **Poker Engine** — All tests passing (15/15)
- ✅ **Sit & Go Tournaments** — Blind escalation + eliminations working
- ✅ **All-In Equity Display** — Showing correct % and updating
- ✅ **Betting System** — Pot fractions + slider + input all working
- ✅ **Roulette Security** — Bets validated server-side
- ✅ **Chat Realtime** — Messages appear instantly
- ✅ **Gifts System** — Rate limiting enforced (500/day)
- ✅ **VIP Discounts** — Applied correctly in shop
- ✅ **Login Streaks** — Calculating correctly
- ✅ **TypeScript** — `tsc --noEmit` clean
- ✅ **i18n** — Hebrew + English both complete
- ✅ **Dark Mode** — Working on all scenes
- ✅ **Responsive** — Mobile to Desktop
- ✅ **Audio** — Synthesized, no errors
- ✅ **Achievements** — All 27 displayable

---

## 🔍 How to Investigate Issues

### For Multiplayer Sync Problems

1. **Open DevTools (F12)**
2. **Network tab** → Filter by "room_actions" or "rooms"
3. **Look for POST requests** when you take action
4. **Check response** — should be 200 with new state
5. **If 4xx or 5xx** → Auth or RLS issue

### For Chips Not Updating

1. **Open browser console**
2. **Type:** `JSON.parse(localStorage.getItem('sb-YOUR-ID-auth-token')).user.id`
3. **Should return your UUID**
4. **Go to Supabase dashboard** → `profiles` table
5. **Search for your ID** → Check `chips` column
6. If DB ≠ App, run `profileService.syncProfile()`

### For RLS Denials (403)

1. **Console**: Check for "Error: new row violates row-level security policy"
2. **Cause**: Usually because `profiles` row missing
3. **Fix**: Run `supabase/setup.sql` again (idempotent)

### For Realtime Lag

1. **Time the action:**
   - Click "Call" button
   - Note exact time
   - Check when opponent sees it
   - Should be <500ms
2. **If >500ms:**
   - Measure network latency (ping)
   - Check if host is overloaded (running multiple games)
   - Check Supabase dashboard for error logs

---

## 📋 Testing Checklist (Before Shipping)

- [ ] Run `npm run test:all` — all 109 tests pass
- [ ] `npm run build` — no build errors
- [ ] `npm run preview` — UI renders at localhost:5173
- [ ] Open `/hub` — all game cards visible
- [ ] Log in → profile loads
- [ ] Open shop → can buy cosmetic
- [ ] Send gift to friend → real-time notification appears
- [ ] Create poker room → 2nd device can join
- [ ] Play poker hand → all-in shows equity %, reveals delay 2+ seconds
- [ ] Slots spin → payout correct
- [ ] Roulette spin → bets validated, payout correct
- [ ] Sit & Go final hand → winner crowned, chips awarded
- [ ] Dark mode toggle → UI readable
- [ ] Switch language to Hebrew → RTL works, no text overflow
- [ ] Mobile view (375px) → buttons clickable, no horizontal scroll
- [ ] Sound button mute → audio stops
- [ ] Logout → session clears, redirect to login
- [ ] Refresh page → session restores automatically
- [ ] Open multiple tabs → presence shows correctly
- [ ] Close one tab → presence updates (remove spectator)

---

## 📞 Common Questions

### Q: Why does Poker take 30 seconds to start after I click "Start Hand"?

**A:** It doesn't. If it does:
1. Check network latency (DevTools → Network → any request)
2. Check if you're host (you should be to start hand)
3. Check Supabase status dashboard
4. Try refreshing page

### Q: Can I rig the Poker outcome?

**A:** No. Outcome is seeded + deterministic.
- Your client cannot override
- Host calculates from seed + actions
- Actions are immutable in Supabase (inserted, never updated)

### Q: Why am I stuck in a spectator mode?

**A:** You likely closed the tab while game was running.
- Delete localStorage entry: `localStorage.removeItem('sb-YOUR-ID-auth-token')`
- Log in again
- Join table fresh

### Q: Why are my chips still the old amount after a game?

**A:** May be a sync lag.
1. Refresh page (F5)
2. If still wrong, report with:
   - Game type (poker/blackjack/slots)
   - Final hand result (won/lost/amount)
   - Your user ID (from console)

### Q: Can I play 3 players in Sit & Go?

**A:** Yes, up to 6 total players. Minimum 2 to start.

### Q: What if host disconnects during Poker?

**A:** 
1. Next player in seat order becomes new host
2. They take over engine (may take 3-5 seconds)
3. Game resumes from current state
4. No chips are lost

### Q: Is there a bot difficulty setting?

**A:** No bots. All players are human. Max 6 real players.

---

## 🆘 Escalation Path

**For bugs you can't fix:**

1. Check this document (03_KNOWN_ISSUES.md)
2. Check architecture (02_ARCHITECTURE.md)
3. Check feature status (01_FEATURES_STATUS.md)
4. Search Supabase dashboard for error logs
5. Check browser console (F12) for errors
6. If still stuck, open issue with:
   - Game type
   - Exact steps to reproduce
   - Screenshot or video
   - Browser console error (if any)
   - Your user ID + timestamp

---

End of Known Issues. See HANDOFF.md for historical fixes.
