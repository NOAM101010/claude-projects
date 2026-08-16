# Royal21 — Quick Reference Guide

## 🔥 Commands Cheat Sheet

### Development
```bash
npm run dev                 # Start dev server (localhost:5173)
npm run build              # Build for production (dist/)
npm run preview            # Preview production build locally
npm run test:all           # Run all 109 tests
npm run test:poker         # Poker tests only
npm run type-check         # TypeScript check (tsc --noEmit)
```

### Git & Deploy
```bash
git status                 # Check changes
git add .                  # Stage everything
git commit -m "message"    # Commit
git push origin main       # Push to GitHub
# → Auto-deploys on Vercel/Netlify (if connected)
```

---

## 🎮 File Locations by Task

### "I need to fix a game bug"

**Poker:** `src/games/poker/engine.ts` (400+ lines of rules)
**Blackjack:** `src/games/blackjack/engine.ts`
**Slots:** `src/games/slots/engine.ts`
**Roulette:** `src/games/roulette/engine.ts`

### "I need to change UI for a game"

**Poker UI:** `src/scenes/poker/PokerScene.tsx`
**Blackjack UI:** `src/scenes/blackjack/BlackjackScene.tsx`
**Roulette UI:** `src/scenes/roulette/RouletteScene.tsx`
**Slots UI:** `src/games/slots/SlotsScene.tsx`

### "I need to add a shop item"

1. **Define item:** `src/data/items.ts`
2. **Add to SQL:** `supabase/setup.sql` (INSERT into items)
3. **Handle equip:** `src/services/shopService.ts` (buy_item function)

### "I need to translate text"

1. **Find key:** Search `src/i18n/he.json`
2. **Add both languages:**
   ```json
   // he.json
   "poker.fold": "זריקה"
   
   // en.json
   "poker.fold": "Fold"
   ```
3. **Use in code:** `const { t } = useT(); t('poker.fold')`

### "I need to change colors/theme"

**Global colors:** `src/app/index.css` (CSS variables)
**Tailwind:** `tailwind.config.js`
**Game-specific:** Inline `style={{ color: 'var(--gold-hi)' }}`

### "I need to add sound"

**Audio manager:** `src/audio/AudioManager.ts`
**Add sound:**
```typescript
audio.register('newSound', synthesizeSound(...));
audio.play('newSound');
```
**Note:** All sounds are synthesized (Web Audio API), no MP3 files.

### "I need to change a database function"

**Gift sending:** `supabase/setup.sql` → `send_gift()` function
**Milestone rewards:** `supabase/setup.sql` → `claim_level_milestone()` function
**Weekly prizes:** `supabase/setup.sql` → `claim_weekly_prize()` function

### "I need to add a new store/state"

Create `src/stores/useMyStore.ts`:
```typescript
import { create } from 'zustand';

interface MyState {
  count: number;
  increment: () => void;
}

export const useMyStore = create<MyState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

---

## 🔍 Common Code Patterns

### "I need to fetch data from Supabase"

```typescript
import { supabase } from '@/services/supabase';

// Read
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);

// Write
const { error } = await supabase
  .from('table_name')
  .insert({ user_id: userId, value: 100 });

// Update
const { error } = await supabase
  .from('table_name')
  .update({ value: 200 })
  .eq('id', rowId);
```

### "I need to subscribe to realtime updates"

```typescript
const channel = supabase
  .channel('room_actions:ABC123')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'room_actions' },
    (payload) => console.log('New action:', payload.new)
  )
  .subscribe();

// Cleanup
return () => channel.unsubscribe();
```

### "I need to show a toast notification"

```typescript
import { useUI } from '@/stores/useUI';

const toast = useUI((s) => s.toast);

toast('Game started!', 'good', '🎮');
// Args: message, tone ('good'/'bad'/'neutral'), emoji
```

### "I need to validate user input"

```typescript
// Check if user is remote (not local guest)
import { isRemoteId } from '@/services/supabase';

if (!isRemoteId(userId)) {
  toast('Guests cannot do this', 'bad', '⚠');
  return;
}
```

### "I need to format numbers"

```typescript
import { fmt } from '@/lib/format';

fmt(1234567);        // → "1.2M"
fmt(50000);          // → "50K"
fmt(100);            // → "100"
fmt(1234.5);         // → "1,234.50"
```

### "I need to use translation with variables"

```typescript
const { t } = useT();

// Translation: "Raised by {amount}"
t('poker.raisingBy', { amount: fmt(500) })

// Result: "Raised by 500"
```

### "I need to animate something"

```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### "I need to check if device prefers reduced motion"

```typescript
import { useAnimationReduced } from '@/hooks/useAnimationReduced';

const reduceMotion = useAnimationReduced();

return reduceMotion ? <StaticView /> : <AnimatedView />;
```

---

## 🐛 Debugging Tips

### "Console logging in Zustand"

```typescript
// Add this to see all store updates
import { usePlayer } from '@/stores/usePlayer';

usePlayer.subscribe(
  (state) => console.log('Player state:', state),
  (state) => state // This runs on every update
);
```

### "Check what action was sent"

```typescript
// In browser DevTools → Network tab
// Filter by room_actions
// Click POST request → Payload → Shows action JSON
```

### "Check RLS denial"

```typescript
// Console will show:
// "Error: new row violates row-level security policy"
// 
// Solution: Verify profiles row exists for user
supabase.auth.getUser().then(({ data }) => console.log(data.user.id));
```

### "Check Realtime connection"

```typescript
// In browser console:
const conn = supabase.realtime;
console.log(conn.connState);  // Should be 'SUBSCRIBED'
```

### "Profile current user"

```typescript
// Console:
const { data } = await supabase.auth.getUser();
const userId = data.user.id;

// Then query in SQL:
// SELECT * FROM profiles WHERE id = 'userId'
```

---

## 📱 Responsive Breakpoints

```
Mobile:      320px - 767px   (Tailwind: < sm)
Tablet:      768px - 1023px  (Tailwind: md)
Desktop:     1024px+         (Tailwind: lg, xl)
```

**Usage in Tailwind:**
```jsx
<div className="text-lg md:text-xl lg:text-2xl">
  Text scales up on bigger screens
</div>
```

---

## 🎨 Design Tokens

### Colors (CSS Variables)
```css
--gold-hi:    #e3b23c (primary accent)
--jade-hi:    #2e9e6b (success/profit)
--crimson-hi: #dd4c54 (danger/loss)
--muted:      #999    (secondary text)
--dim:        #666    (tertiary text)
```

### Typography
```css
eyebrow:     10px, uppercase, letter-spacing
subtitle:    12px, semibold
body:        14px, normal
heading:     20-48px, bold
```

### Spacing
```
p-1:  4px
p-2:  8px
p-3:  12px
p-4:  16px
gap-2: 8px
```

---

## 🎯 Poker Engine Quick Reference

### Poker API (in `engine.ts`)

```typescript
// Create initial state
const state = createState(seed, sb, bb);

// Reduce an action (apply game logic)
const newState = reduce(state, action);

// Useful helpers
minRaiseTo(state, seat);  // Smallest legal raise
callCost(state, seat);    // Cost to call
canSeatAct(seat);         // Can player act now?

// Hand evaluation
const hand = bestHand([card1, card2, card3, ...]);
compareScore(hand1.score, hand2.score);  // -1, 0, +1

// Equity calculation
const equity = computeEquity(
  [{userId: 'A', hole: [card1, card2]}, ...],
  community,
  seed
);
// → {A: 0.45, B: 0.55, ...}  (win probabilities)
```

---

## 🎲 Random Number Generation

```typescript
import { mulberry32, shuffle } from '@/lib/random';

const rng = mulberry32(seed);
const randomNumber = rng();  // 0-1

// Shuffle array
const deck = shuffle(cards, mulberry32(seed));
```

**Important:** All RNG is seeded. Use same seed + same actions = same result.

---

## 🔐 Security Checklist (Before Shipping)

- [ ] No hardcoded API keys (use .env)
- [ ] All DB writes validated server-side (RLS)
- [ ] Chips never trusted from client
- [ ] Passwords never logged or stored locally
- [ ] Session tokens in secure storage
- [ ] No XSS vulnerabilities (React escapes by default)
- [ ] No SQL injection (Supabase parameterizes)
- [ ] Rate limiting on gift/action endpoints
- [ ] CORS configured correctly

---

## 📊 Query Performance

### If game is slow:

1. **Check network latency:** DevTools → Network → any request
2. **Check DB:** Go to Supabase dashboard → Database Stats
3. **Check Realtime queue:** If >20 events/sec, add rate limiting

### Add index to DB:

```sql
CREATE INDEX idx_profiles_level ON profiles(level);
-- Make queries faster for: SELECT * FROM profiles WHERE level > 10
```

---

## 🚨 Emergency Fixes

### "Database is broken"

```sql
-- Option 1: Re-run setup
-- SQL Editor → Copy-paste supabase/setup.sql → Run

-- Option 2: Reset single table
DELETE FROM room_actions WHERE room_id = 'broken-room-id';
DELETE FROM rooms WHERE id = 'broken-room-id';
```

### "User is stuck in game"

```sql
-- Clear their room seat
DELETE FROM room_seats WHERE user_id = 'stuck-user-id';

-- They can log in fresh now
```

### "Chat history is too large"

```sql
-- Delete old messages
DELETE FROM room_messages 
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 📖 Learn More

| Topic | File |
|-------|------|
| System design | `02_ARCHITECTURE.md` |
| Game rules | `src/games/{game}/engine.ts` |
| Database schema | `04_SUPABASE_SETUP.md` |
| UI components | `src/components/` (organized by type) |
| Game scenes | `src/scenes/` (one per game) |
| State management | `src/stores/use*.ts` (Zustand) |
| Services | `src/services/*.ts` (external APIs) |

---

End of Quick Reference. Print this out or bookmark it! 📌
