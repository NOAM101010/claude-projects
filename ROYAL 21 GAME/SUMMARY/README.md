# Royal21 — Comprehensive Project Summary

**Created:** 2026-08-16  
**Status:** Development Complete (Ready for Testing)  
**Next Phase:** Launch / Monitoring

---

## 📚 Documentation Structure

This folder contains everything a new developer needs to understand and continue the Royal21 project.

### 1. **00_EXECUTIVE_SUMMARY.md** ⭐ START HERE
- **What:** High-level overview of the entire project
- **For:** Stakeholders, PMs, quick context
- **Includes:** Feature status table, test results, tech stack
- **Read time:** 5 minutes

### 2. **01_FEATURES_STATUS.md**
- **What:** Detailed feature-by-feature breakdown
- **For:** Developers starting on specific features
- **Includes:** Status, file locations, known issues per game
- **Read time:** 15 minutes

### 3. **02_ARCHITECTURE.md**
- **What:** How the system is built and works together
- **For:** Developers understanding the big picture
- **Includes:** Data flow diagrams, database schema, security model
- **Read time:** 25 minutes

### 4. **03_KNOWN_ISSUES.md**
- **What:** Bugs to fix, improvements needed, testing checklist
- **For:** Developers assigned to specific tasks
- **Includes:** Issue descriptions, reproduction steps, fixes
- **Read time:** 10 minutes

### 4. **04_SUPABASE_SETUP.md**
- **What:** Step-by-step database setup guide
- **For:** DevOps, backend developers, local setup
- **Includes:** SQL scripts, configuration, troubleshooting
- **Read time:** 10 minutes

---

## 🎯 Quick Start (5 minutes)

### For Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up .env
echo "VITE_SUPABASE_URL=https://xxxxx.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=eyJhbGc..." >> .env

# 3. Run local server
npm run dev
# → http://localhost:5173

# 4. Run tests
npm run test:all
# → 109 tests should pass
```

### For Supabase Setup

Follow **04_SUPABASE_SETUP.md**:
1. Run `supabase/setup.sql`
2. Run `supabase/upgrade.sql`
3. Enable Anonymous sign-ins
4. Test login at localhost:5173

### First Game Session

1. Open `http://localhost:5173`
2. Click "Create User" (anonymous login)
3. Navigate to `/hub`
4. Click any game card
5. Interact with chat/friends/shop

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Lines of Code** | ~25,000 |
| **TypeScript** | 95% (full type safety) |
| **Components** | 40+ reusable |
| **Games** | 8 (Blackjack, Poker, Sit & Go, Slots, Roulette, High Card, Coin Flip, Scratch) |
| **Social Features** | 7 (Chat, Friends, Gifts, Leaderboard, Rivalries, Spectate, Presence) |
| **Achievements** | 27 |
| **Test Coverage** | 109 tests (engines + logic) |
| **Build Size** | ~350KB gzipped |
| **Database Tables** | 15 |
| **Supabase Functions** | 3 (send_gift, claim_milestone, claim_weekly) |

---

## 🔑 Key Principles

### 1. Host-Authoritative
- Only the host runs the game engine
- Prevents cheating (client can't override)
- Deterministic (same seed + actions = same outcome)

### 2. Realtime First
- All updates via Supabase Realtime
- <500ms latency for actions
- No polling, pure event-driven

### 3. Type-Safe
- Full TypeScript throughout
- No `any` types (build fails if found)
- Compile-time validation

### 4. Accessible
- Hebrew + English (RTL support)
- Dark mode native
- Responsive (mobile to desktop)
- Reduced motion respected

### 5. Secure
- Row-Level Security on all data
- Chips validated server-side
- No RNG on client
- Session tokens in secure storage

---

## 🚀 Deployment

### Build

```bash
npm run build
# → dist/ folder (static files, ready to deploy)

# Test build locally
npm run preview
```

### Host

Can deploy to any static host:
- **Vercel** (recommended, built by Vercel team)
- **Netlify** (excellent DX)
- **AWS Amplify** (native)
- **GitHub Pages** (free)

### Environment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as:
- Build-time env vars (for static hosting)
- Or runtime env in index.html `<script>` tag

---

## 🧪 Testing Strategy

### Unit Tests (109 total)
- **Engine tests:** Validate game rules (Blackjack, Poker, Roulette)
- **Payout tests:** Verify math is correct
- **Audio tests:** Ensure sound synthesis works
- **Social tests:** VIP, streaks, gifts

**Run all:** `npm run test:all`

**Individual:**
```bash
npm run test:engine
npm run test:poker
npm run test:slots
npm run test:roulette
npm run test:social
npm run test:audio
```

### Manual Testing
- See **03_KNOWN_ISSUES.md** → Testing Checklist
- ~20 steps covering all games + features

### No E2E Tests (Yet)
- Could add Playwright/Cypress later
- Currently all UI tested manually

---

## 📁 Important Files

### Configuration
- `package.json` — Dependencies + scripts
- `vite.config.ts` — Build configuration
- `tailwind.config.js` — Styling config
- `tsconfig.json` — TypeScript config
- `.env.example` — Environment variables template

### Core Logic
- `src/games/poker/engine.ts` — 400+ line game rules
- `src/games/blackjack/engine.ts` — Blackjack rules
- `src/services/supabase.ts` — Database client
- `src/stores/usePlayer.ts` — Player state management

### Database
- `supabase/setup.sql` — Schema initialization
- `supabase/upgrade.sql` — Feature additions
- `supabase/poker.sql` — Poker table expansion

### Translation
- `src/i18n/he.json` — Hebrew (עברית)
- `src/i18n/en.json` — English

---

## ⚡ Performance

### Load Time
- Initial page load: ~2 seconds (includes Supabase auth)
- Component render: ~100ms (React + Tailwind)
- Game state sync: <500ms (Realtime)

### Optimization
- Code splitting (Vite lazy-loads scenes)
- CSS variables (theme switching = no repaint)
- Zustand (fine-grained updates)
- Web Audio (no file downloads)

### Database
- Queries optimized with indexes
- RLS policies use user IDs (fast)
- Realtime channels limited to ~20 events/sec (plenty)

---

## 🆘 Troubleshooting

### "I see 403 Forbidden"
→ Read **04_SUPABASE_SETUP.md** → Verification Checklist

### "Chat messages don't appear"
→ Check `room_messages` table exists (run upgrade.sql)

### "Friend can't join game"
→ Verify Anonymous sign-ins enabled (Step 6 in Supabase setup)

### "Chips not updating after game"
→ Refresh page (F5) or check console for errors

### Tests failing
→ Ensure .env is set, then `npm run test:all`

For more issues, see **03_KNOWN_ISSUES.md** → Escalation Path

---

## 📞 Contact & Support

### For Code Questions
- Check **02_ARCHITECTURE.md** (how system works)
- Check **01_FEATURES_STATUS.md** (file locations)
- Search codebase: `grep -r "your-function-name" src/`

### For Bugs
- Reproduce the issue locally
- Check **03_KNOWN_ISSUES.md** (may be known)
- Open issue with steps + console errors
- Check Supabase dashboard for DB errors

### For Features
- Start with **01_FEATURES_STATUS.md** (what exists)
- Check **03_KNOWN_ISSUES.md** → Nice-to-Have Improvements
- Implement similar to existing game (e.g., copy Poker layout for new game)

---

## 🎓 Learning Path (For New Developers)

### Day 1: Context
- [ ] Read **00_EXECUTIVE_SUMMARY.md** (overview)
- [ ] Read **02_ARCHITECTURE.md** (system design)
- [ ] Run `npm run dev` and play a few games

### Day 2: Code Structure
- [ ] Explore `src/games/` (game engines)
- [ ] Explore `src/scenes/` (UI scenes)
- [ ] Trace Poker flow: Click "Play" → PokerScene.tsx → usePokerRoom → engine.ts

### Day 3: Adding a Feature
- [ ] Pick a task from **03_KNOWN_ISSUES.md** → Nice-to-Have
- [ ] Implement (using similar game as template)
- [ ] Run tests: `npm run test:all`
- [ ] Manual test on localhost

### Day 4: Deployment
- [ ] Build: `npm run build`
- [ ] Preview: `npm run preview`
- [ ] Deploy to Vercel/Netlify
- [ ] Test on production URL

---

## 📈 Metrics & Analytics (Future)

Not currently tracked, but should consider:
- Player retention (daily active users)
- Game popularity (which games played most)
- Average session length
- Revenue per VIP tier
- Crash/error rate (Sentry)
- Database query performance (Datadog)

---

## 🎯 Vision & Next Steps

### Now (Shipping Ready)
- ✅ All core games working
- ✅ Multiplayer sync rock solid
- ✅ Social features complete
- ✅ 109 tests passing
- ✅ TypeScript clean

### Next 3 Months
- [ ] Launch to beta (friends)
- [ ] Monitor performance + bugs
- [ ] Fix **03_KNOWN_ISSUES.md** items
- [ ] Gather feedback

### Next 6 Months
- [ ] Analytics dashboard
- [ ] Mobile app (Capacitor)
- [ ] AI opponents (optional bots)
- [ ] Advanced statistics
- [ ] Tournaments beyond Sit & Go

### Next Year
- [ ] Leaderboards by region/week/season
- [ ] Clans/teams
- [ ] Streaming integration (OBS)
- [ ] Mobile marketing campaign

---

## 📜 License & Credits

**Royal21** — Social Casino (Virtual Chips Only)

**Technology:**
- React 18 (UI)
- Vite (Build)
- Supabase (Backend)
- TypeScript (Type Safety)
- Tailwind CSS (Styling)
- Framer Motion (Animation)

**Created by:** [Your Name/Team]  
**Last Updated:** 2026-08-16  

---

## 🚀 You're Ready!

You now have:
1. ✅ Executive summary (00)
2. ✅ Feature breakdown (01)
3. ✅ Architecture guide (02)
4. ✅ Issue tracker (03)
5. ✅ Database setup (04)

**Next:** Pick a task and start coding! 🎮

Questions? See **02_ARCHITECTURE.md** or **03_KNOWN_ISSUES.md** → Escalation Path.

Good luck! 🚀✨
