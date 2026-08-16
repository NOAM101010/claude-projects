# Royal21 — Supabase Setup Guide

## 🔧 Prerequisites

- Supabase account (free tier is fine)
- Project created and API keys available
- `.env` file with:
  ```
  VITE_SUPABASE_URL=https://xxxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc...
  ```

---

## 📋 Step-by-Step Setup

### Step 1: Initialize Database Schema

**File:** `supabase/setup.sql`

**What it does:**
- Creates all tables (profiles, rooms, items, achievements, etc.)
- Enables Row-Level Security (RLS) on every table
- Creates 21 shop items (card faces, slots themes, room decor)
- Creates functions: `send_gift()`, `claim_level_milestone()`, `claim_weekly_prize()`

**How to run:**
1. Go to **Supabase Dashboard** → Your Project
2. **SQL Editor** → Click **+ New Query**
3. Copy-paste entire `supabase/setup.sql`
4. Click **Run** (should complete in <5 seconds)
5. Check: Go to **Table Editor** → should see `profiles`, `rooms`, `items` tables

**Safe to run again:** YES (idempotent — uses `CREATE TABLE IF NOT EXISTS`)

**Dependencies:** None (first step)

---

### Step 2: Upgrade Database (Chat + Presence)

**File:** `supabase/upgrade.sql`

**What it does:**
- Creates `room_messages` table (chat history)
- Creates `room_viewers` table (who's spectating)
- Adds columns to `profiles` (for new features)
- Migrates existing profiles if they were created before these columns

**How to run:**
1. **SQL Editor** → **+ New Query**
2. Copy-paste `supabase/upgrade.sql`
3. Click **Run**

**Safe to run again:** YES

**Dependencies:** Must run AFTER Step 1 (setup.sql)

---

### Step 3: Expand Poker Seats (6-Player Tables)

**File:** `supabase/poker.sql`

**What it does:**
- Changes `MAX_SEATS` constraint from 4 to 6
- Updates any existing `room_seats` constraints

**How to run:**
1. **SQL Editor** → **+ New Query**
2. Copy-paste `supabase/poker.sql`
3. Click **Run**

**Safe to run again:** YES

**Dependencies:** Must run AFTER Step 1

**Only needed if:** You want to support 6-player Poker tables (optional for single-player Blackjack)

---

### Step 4: Grant Admin Role (Optional)

**File:** `supabase/admin.sql`

**What it does:**
- Makes a specific email address an admin
- Grants access to `/admin` page (if you build it)

**How to run:**
1. Edit `admin.sql` and change email:
   ```sql
   UPDATE auth.users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
2. **SQL Editor** → **+ New Query**
3. Copy-paste the edited SQL
4. Click **Run**

**Optional:** Only if you plan to use admin dashboard

---

### Step 5: Fix Stuck Email Confirmations

**File:** `supabase/confirm-existing-emails.sql`

**What it does:**
- Marks old accounts as email-confirmed
- Lets users who were stuck log in

**How to run:**
1. **SQL Editor** → **+ New Query**
2. Copy-paste `supabase/confirm-existing-emails.sql`
3. Click **Run**

**Only needed if:** Users report "Please confirm your email" after signup

---

### Step 6: Enable Anonymous Sign-Ins

**CRITICAL:** Must do this for multiplayer to work.

1. Go to **Authentication** (left sidebar)
2. Click **Providers**
3. Find **Anonymous**
4. Toggle **Enable Anonymous Sign-Ins** ✅
5. Save

**Why:** Friends can't join games without it. Local guests need anonymous auth.

---

### Step 7: Configure Email Templates (Password Reset)

**For password reset to work:**

1. Go to **Authentication** → **Email Templates**
2. Find **Reset Password**
3. Click **Edit** (if disabled)
4. Enable it
5. Ensure `{{ .RedirectTo }}` points to `<your-domain>/login`
6. Set SMTP settings (Gmail, SendGrid, etc.)

**Alternative:** Use Supabase's default SMTP (limited, but works for testing)

**Test:**
1. Log in to app
2. Settings → "Change Password" → "Email me a reset link"
3. Check email inbox
4. Click link → Should land on `/login` with reset form

---

### Step 8: Add Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   http://localhost:5173/*
   http://localhost:3000/*
   https://your-production-domain.com/*
   ```
3. Save

**Why:** Supabase auth needs to know which URLs are safe to redirect back to.

---

## ✅ Verification Checklist

After all steps, verify:

- [ ] **Step 1:** `profiles` table exists with 10+ columns
- [ ] **Step 2:** `room_messages` table exists
- [ ] **Step 3:** `room_seats` allows 6 players (optional)
- [ ] **Step 4:** Admin email granted (optional)
- [ ] **Step 5:** No "confirm email" blocking (if needed)
- [ ] **Step 6:** Anonymous sign-ins enabled (toggle ON)
- [ ] **Step 7:** Password reset template configured
- [ ] **Step 8:** Localhost URLs in redirect list

**Final Test:**
```bash
npm run dev
# Open http://localhost:5173
# Click "Create User" (anonymous)
# Should land on /hub
# If 403 → RLS issue (re-run setup.sql)
# If can't join game → anonymous not enabled (check Step 6)
```

---

## 🗂️ Table Structure (Key Fields)

### profiles
```
id (UUID)                    — User ID from Auth
email (text)                 — Email address
username (text)              — Display name
chips (bigint)               — Current chip balance
level (int)                  — 1-100
xp (int)                     — Experience points (0-1000 per level)
stats (jsonb)                — {wins, losses, pokerChipsWon, ...}
equipped (jsonb)             — {cardFace, cardBack, coinFlipCoin, slotTheme}
owned_items (jsonb)          — List of item IDs owned
owned_decor (jsonb)          — Owned room decor
active_decor (jsonb)         — Active decor (max 4)
room_theme (text)            — Background gradient
last_milestone_claimed_at    — Timestamp (for VIP milestone rewards)
weekly_prize_claimed_at      — Timestamp (for weekly leaderboard prize)
```

### rooms
```
id (UUID)                    — Room ID
code (text, unique)          — 6-char code (e.g., "ABC123")
host_id (UUID)               — User ID of host
game_type (text)             — 'blackjack', 'poker', 'sng', 'roulette'
state (jsonb)                — Full game engine state (engine.ts PokerState)
config (jsonb)               — {stakes, password, isVip, ...}
created_at (timestamp)       — When created
ended_at (timestamp)         — When finished (NULL if ongoing)
```

### room_seats
```
room_id (UUID)               — Foreign key to rooms.id
user_id (UUID)               — Foreign key to profiles.id
seat_number (int)            — 0-5 (or 0-3 for smaller tables)
stack (bigint)               — Current chips in hand
```

### room_actions
```
id (bigserial)               — Auto-increment
room_id (UUID)               — Which room
user_id (UUID)               — Who acted
action (jsonb)               — {type: 'call', amount: 500, ...}
created_at (timestamp)       — When action happened
```

### items
```
id (text, unique)            — 'cardFace_classic', 'slotTheme_gold', etc
name (text)                  — Display name
category (text)              — 'cardFace', 'slotTheme', 'roomBg', etc
price (int)                  — Chip cost
rarity (text)                — 'common', 'rare', 'epic', 'legendary'
description (text)           — What it looks like
data (jsonb)                 — Item-specific config
```

### friendships
```
user1_id (UUID)              — Who sent request
user2_id (UUID)              — Who received
status (text)                — 'pending', 'accepted', 'blocked'
created_at (timestamp)
```

### chip_gifts
```
sender_id (UUID)
receiver_id (UUID)
amount (int)
sent_at (timestamp)
```

### room_messages
```
id (UUID)
room_id (UUID)
user_id (UUID)
text (text)
created_at (timestamp)
(Old messages auto-deleted, max 30 per room)
```

---

## 🔐 Row-Level Security (RLS) Overview

**After setup.sql, each table has RLS enabled.**

### profiles (Public Read, Owner Write)
```sql
-- Everyone can read (for public profile display)
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);

-- Only owner can update own row
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
```

### rooms (Everyone Read, Host Manage)
```sql
CREATE POLICY "rooms_read" ON rooms FOR SELECT USING (true);

-- Only host can update or delete
CREATE POLICY "rooms_manage" ON rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (auth.uid() = host_id);
```

### room_actions (Everyone Read, Self Insert)
```sql
CREATE POLICY "actions_read" ON room_actions FOR SELECT USING (true);

-- Only the actor can insert their own action
CREATE POLICY "actions_insert" ON room_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### friendships (Own Data Only)
```sql
CREATE POLICY "friendships_own" ON friendships FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "friendships_manage" ON friendships FOR INSERT/UPDATE
USING (auth.uid() = user1_id);
```

**Key:** RLS prevents unauthorized access at DB level. No hacks from browser console will let you access another user's chips.

---

## 🐛 Common Setup Issues & Fixes

### Issue: "403 Forbidden" on first login

**Cause:** RLS policies preventing `profiles` read

**Fix:**
```bash
# Re-run setup.sql (may have partially failed)
# Check: SQL Editor → Table Editor → profiles table exists
# Check: RLS is enabled (lock icon visible)
```

### Issue: Can't create account (500 error)

**Cause:** Anonymous sign-ins not enabled

**Fix:**
1. Go to **Authentication** → **Providers** → **Anonymous**
2. Toggle ON
3. Retry signup

### Issue: "Confirm your email" stuck

**Cause:** Email confirmations require valid SMTP

**Fix (Development only):**
1. Go to **Authentication** → **Policies**
2. Disable "Confirm email before sign in"
3. Re-run `confirm-existing-emails.sql`

### Issue: Friend can't join game (4xx error)

**Cause:** Redirect URLs not whitelisted

**Fix:**
1. Go to **Authentication** → **URL Configuration**
2. Add friend's machine URL (if different)
3. Verify Anonymous is enabled

### Issue: Chat messages not appearing

**Cause:** `room_messages` table not created

**Fix:**
1. Re-run `upgrade.sql`
2. Check: Table Editor → `room_messages` exists
3. Verify RLS allows read/write for authenticated users

---

## 🚀 Database Backups

**Supabase Backups:**
- Free tier: Daily automatic backups (7-day retention)
- Pro tier: Hourly backups (30-day retention)

**Manual Export:**
1. **Database** → **Backups**
2. Click **Create backup**
3. Download as `.tar.gz`

**Restore:**
1. Contact Supabase support
2. Provide backup file + restore point

---

## 📊 Database Monitoring

**Check database size:**
1. Go to **Settings** → **Database Usage**
2. View storage used (free tier: 500MB)
3. If close to limit, delete old rooms/messages

**Check query performance:**
1. **Database** → **Postgres Stats**
2. View slow queries (if any)
3. Consider adding indexes for frequently-queried columns

---

## 🔄 Migrations & Schema Changes

If you need to modify schema later:

1. **Create migration file:** `supabase/migrations/TIMESTAMP_description.sql`
2. **Write SQL:** `ALTER TABLE ... ADD COLUMN ...`
3. **Run:** Supabase SQL Editor → Run
4. **Version control:** Commit migration to git

Example:
```sql
-- migrations/2026-08-16_add_vip_level.sql
ALTER TABLE profiles ADD COLUMN vip_level INT DEFAULT 0;
COMMENT ON COLUMN profiles.vip_level IS 'VIP tier (0, 1, 2, 3)';
```

---

## 📞 Support

- **Supabase Docs:** https://supabase.com/docs
- **SQL Reference:** https://supabase.com/docs/reference/sql/
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security

---

End of Supabase Setup Guide.
