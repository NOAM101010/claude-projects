# 📊 ROYAL 21 - Progress Tracker

**Last Updated:** 2026-08-16

---

## 🎯 Current Status

✅ **Full-featured casino ready for beta**
- Game loads successfully at localhost:4173
- Public tunnel: https://royal21game.loca.lt
- No console errors, TypeScript 0 errors, 210+ tests passing
- All 8 games work single-player AND multiplayer

---

## 📦 Complete Feature List

### 🎮 Games (8)
- ✅ Blackjack (solo + multiplayer)
- ✅ Poker Texas Hold'em (multiplayer, private tables)
- ✅ Poker Sit & Go tournaments
- ✅ Roulette (solo + multiplayer)
- ✅ Slots (5 themes, auto-play, JACKPOT)
- ✅ Coin Flip (solo + multiplayer + VIP High Stakes)
- ✅ High Card (solo + multiplayer + VIP High Stakes)
- ✅ Scratch Cards

### 🏆 Systems
- ✅ Progressive Jackpot (Slots + Poker Royal Flush)
- ✅ VIP Lounge (unlocked at Lv 5 + 150K chips)
- ✅ Private Poker Tables (color, blinds, password, timer)
- ✅ Daily Login Streak Rewards (7/14/30-day milestones)
- ✅ Friend Invite Bonus (500 chips both sides)
- ✅ Wallet Dashboard (daily stats + per-game breakdown)
- ✅ Shop: Deals tab with Daily Offers, Special Packs, Rare Rotation
- ✅ Night Mode (multi-game tournaments)
- ✅ Rate Limiting (10 game actions/sec)
- ✅ Bug Reporting (in Settings)
- ✅ Analytics tracking

### 🎨 Cosmetics
- 60+ shop items across 15 categories
- Cards, chips, tables, avatars, victory animations, dealer skins
- Coin skins with currency themes (₪, €, $, 💎, 👑)
- 5 slot themes (Classic, Fruit, Neon, Egypt, Galaxy)

---

## ⚠️ Important SQL to Run in Supabase

Run these in order via Supabase SQL Editor:

1. `supabase/setup.sql` (existing base schema)
2. `supabase/poker.sql`
3. `supabase/roulette.sql`
4. `supabase/miniGames.sql`
5. `supabase/telemetry.sql` (bug reports + analytics)
6. `supabase/referrals.sql` (friend invite bonuses)
7. `supabase/jackpot.sql` (progressive jackpot)
8. `supabase/privateTables.sql` (private table config)
9. `supabase/cleanup-test-users.sql` (optional; cleans test users)

---

## 🌐 URLs

- **💻 Local:** http://localhost:4173
- **📱 Public tunnel:** https://royal21game.loca.lt
- **Password (loca.lt):** 46.116.79.115

---

## ⚠️ Critical User Constraints

- **"אני לא רוצה שתשנה שום דבר שם אם אני לא מבקש"** - never change anything without explicit request
- **Music During Testing:** always mute in-game music before testing
- **URL Changes:** always send fresh URLs when server port changes
- **Language:** always respond in Hebrew
