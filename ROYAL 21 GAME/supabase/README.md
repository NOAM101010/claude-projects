# ROYAL 21 — `supabase/`

Flat folder of `.sql` files, run by hand in the Supabase SQL editor (there is no
migration runner). This README is the index: **run order**, **where each thing is
tuned**, and **which file holds the live definition** of every function that was
redefined more than once.

> Source of truth is the **live database**. These files are the history of how it
> got there. If a file and the DB disagree, the DB wins — `pg_dump` for a real
> snapshot.

---

## 1. Fresh database — run in this order

Each file's own header says "run after X"; this is the full dependency-sorted list.

| # | File | What it does | Depends on |
|---|------|--------------|-----------|
| 1 | `setup.sql` | Everything: all core tables (`profiles`, `player_stats`, `friendships`, `rooms`, `items`, `notifications`, …), RLS, core RPCs (`buy_item`, `send_gift`, `adjust_chips`, `claim_weekly_prize` v1, `claim_level_milestone`, `handle_new_user` v1, `protect_chip_column` v1, `enforce_room_capacity` v1), the `items` seed | — |
| 2 | `upgrade.sql` | Room chat (`room_messages`), spectators (`room_members.is_spectator`), `profiles.onboarded_at` + backfill | setup |
| 3 | `admin.sql` | `profiles.is_admin`, `admin_emails()`, `is_admin()`, self-service admin powers (`admin_set_chips`, `admin_grant_all_items`, `admin_set_level`), `admin_overview`, `admin_recent_rooms`, widened `profiles_update_self` policy. **Redefines** `protect_chip_column` (adds `is_admin` guard) + `handle_new_user` (adds admin flag) | setup, upgrade |
| 4 | `admin-live.sql` | `transfer_chips`, `admin_set_user_chips`, `admin_active_players` | admin |
| 5 | `telemetry.sql` | `bug_reports`, `analytics_events` + RLS | setup |
| 6 | `roulette.sql` | widen `room_members.seat` to 0–5. **Redefines** `enforce_room_capacity` (roulette = 5 seats) | setup |
| 7 | `poker.sql` | poker uses the existing room wiring; **redefines** `enforce_room_capacity` (poker/sng = 6) | setup, roulette |
| 8 | `miniGames.sql` | coinflip + highcard capacity; **redefines** `enforce_room_capacity` (adds those two) | setup, roulette |
| 9 | `privateTables.sql` | `rooms.config` jsonb for private poker settings | setup, jackpot |
| 10 | `jackpot.sql` | `jackpots`, `jackpot_wins`, progressive-pool RPCs | setup |
| 11 | `poker-privacy.sql` | `poker_hole`, `poker_hand_secret`, `bj_hand_secret` + redaction RPCs | poker |
| 12 | `premium-coins.sql` | make the 6 currency-skin coins real `items` rows + backfill | setup |
| 13 | `referrals.sql` | `referrals` table, `claim_referral` v1 (500), `referral_stats` view | setup |
| 14 | `referral-bonus-5k.sql` | `claim_referral` v2 (5,000) — *tweak, folded into #15* | referrals |
| 15 | `referral-growth.sql` | `referrals.stage2_claimed`, `profiles.referrer_tier`, `claim_referral` **v3 (live)**, `claim_referral_stage2`, `claim_referrer_tier` | referrals, referral-bonus-5k |
| 16 | `achievements-daily.sql` | `profiles.achievements / daily_last_claim / daily_streak`, `claim_achievement`, `claim_daily_bonus` **v1**, `fetch_achievements`, `fetch_daily_state` | setup |
| 17 | `streak-rewards-v2.sql` | `claim_daily_bonus` **v2 (live)** — server-computed ladder, now reads `app_config.streak_rewards` | achievements-daily, app-config |
| 18 | `gift-limit-50k.sql` | `send_gift` **(live)** — 50k/day, now reads `app_config.gift_daily_limit` | setup, app-config |
| 19 | `missions.sql` | `profiles.mission_claims`, `claim_mission` **(live)** — now reads `app_config.max_mission_reward` + `mission_all_done_bonus` | setup, app-config |
| 20 | `event-trophies.sql` | achievements catalogue gets `tier/trophy/kind`, ~10 `kind='event'` rows | setup |
| 21 | `weekly-snapshot.sql` | `weekly_chip_snapshot` + `capture_weekly_snapshot()` | setup |
| 22 | `weekly-podium.sql` | `profiles.weekly_prize_claimed_week`, `claim_weekly_prize` **v2 (live)** — ranks off the snapshot, now reads `app_config.weekly_podium` | weekly-snapshot, app-config |
| 23 | `notifications-cleanup.sql` | owner-only DELETE policy on `notifications` + realtime DELETE payloads | setup |
| 24 | **`app-config.sql`** | `app_config` table + `admin_set_config` / `get_app_config` / `config_num` | setup, admin |
| 25 | **`admin-tools.sql`** | player-support RPCs: `admin_find_player`, `admin_reset_player`, `admin_grant_item` / `admin_revoke_item`, `admin_set_level(uuid,int)`, `admin_list_bugs`, `admin_resolve_bug` | setup, admin, telemetry, playtime |
| 26 | **`playtime.sql`** | `profiles.playtime_seconds` + `add_playtime(int)` — lifetime foreground seconds, clamped 1h/call | setup |
| 27 | **`direct-messages.sql`** | `direct_messages` table + RLS (friends-only, block-aware) + `mark_dm_read(uuid)` + rate-limit trigger + realtime — 1:1 friend chat (Stage F) | setup |

`app-config.sql` and `admin-tools.sql` must come **after** `admin.sql`; put them
after the `#17–19` files so the economy RPCs pick up `config_num()`. Re-running
`streak-rewards-v2.sql` / `gift-limit-50k.sql` / `missions.sql` / `weekly-podium.sql`
after `app-config.sql` is harmless and gets you the config-aware bodies.

### Historical tweak files (already folded into a later definition)

- **`referral-bonus-5k.sql`** — the 5,000 bonus and 24h window it introduced are
  both present verbatim in `referral-growth.sql` (which then widens the window to
  72h). Kept only for a clean chronological re-run; skipping it and running
  `referral-growth.sql` gives the identical result.

### One-off operational scripts (NOT part of a fresh build)

| File | Purpose |
|------|---------|
| `reset-all.sql` | full wipe — everyone back to 5,000 / level 1, admins untouched |
| `reset-users.sql` | older/narrower version of the same |
| `cleanup-test-users.sql` | delete anonymous MP-test accounts |
| `confirm-existing-emails.sql` | release accounts stuck behind email confirmation |
| `weekly-snapshot.sql` `capture_weekly_snapshot()` | cron / on-open, freezes the week's standings |

---

## 2. Where do I change X?

| Want to change… | Edit here | Or tune live in |
|---|---|---|
| Daily chip-gift limit (50k) | `gift-limit-50k.sql` (`send_gift`) + `src/data/economy.ts` `GIFT_DAILY_LIMIT` | `app_config.gift_daily_limit` |
| Login-streak rewards ladder | `streak-rewards-v2.sql` (`claim_daily_bonus` CASE) + `economy.ts` `STREAK_REWARD()` | `app_config.streak_rewards` (jsonb: keys `1-3,4-6,7,8-13,14,15-29,30,31+`) |
| Weekly podium payouts ([5000,2500,1000]) | `weekly-podium.sql` (`claim_weekly_prize`) + `economy.ts` `WEEKLY_PODIUM` | `app_config.weekly_podium` (jsonb array of 3) |
| "Cleared all 3 missions" bonus (5,000) | `missions.sql` (`claim_mission`, `all_done` branch) + `economy.ts` `MISSION_ALL_DONE_BONUS` | `app_config.mission_all_done_bonus` |
| Mission reward hard cap (20,000) | `missions.sql` (`claim_mission`) + `economy.ts` `MAX_MISSION_REWARD` | `app_config.max_mission_reward` |
| Referral bonus (5,000, both sides) | `referral-growth.sql` (`claim_referral`) + `economy.ts` `REFERRAL_BONUS` | — (not yet config-wired) |
| Referral stage-2 bonus (10,000 @ level 5) | `referral-growth.sql` (`claim_referral_stage2`) + `economy.ts` `REFERRAL_STAGE2_*` | — |
| Referrer tier rewards ([3000,7000,15000]) | `referral-growth.sql` (`claim_referrer_tier`) + `economy.ts` `REFERRER_TIERS` | `app_config.referrer_tiers` (seed/display only — RPC still hard-coded) |
| Level-milestone rewards | `setup.sql` (`claim_level_milestone`) + `economy.ts` `milestoneReward()` | — |
| VIP tiers / shop discount | `economy.ts` `VIP_TIERS` + `buy_item` in `setup.sql` | — |
| Shop item prices | `src/data/economy.ts` `PRICE_BY_RARITY` + `items` seed in `setup.sql` + `src/data/items.ts` | — |
| Scratch-card odds / prizes | `src/data/economy.ts` `SCRATCH_TIERS` (client-authoritative) | — |
| Daily missions lineup | `src/data/missions.ts` `MISSIONS` / `WEEKLY_MISSIONS` | — |
| Achievements catalogue | `src/data/achievements.ts` + `event-trophies.sql` | — |
| Who is an admin | `admin.sql` `admin_emails()` | — |
| Room seat caps per game | `enforce_room_capacity()` — **live copy in `miniGames.sql`** | — |
| Friend chat (1:1 DMs) | `direct-messages.sql` (`direct_messages`, RLS, `mark_dm_read`) + `src/services/dmService.ts` | DM rate limit: trigger in `direct-messages.sql` + `src/lib/rateLimit.ts` `dm` |

The client mirror is `src/hooks/useAppConfig.ts` — reads `app_config` once per
session, falls back to the `economy.ts` constants when the table/key is missing
or the client is offline.

---

## 3. Live definition of every re-defined function

`create or replace` means the **last file run** wins. These are the current
production bodies:

| Function | Live definition | Also defined in (superseded) |
|---|---|---|
| `handle_new_user()` | `admin.sql` | `setup.sql` |
| `protect_chip_column()` | `admin.sql` | `setup.sql` |
| `enforce_room_capacity()` | `miniGames.sql` | `setup.sql`, `roulette.sql`, `poker.sql` |
| `claim_referral(uuid)` | `referral-growth.sql` | `referrals.sql`, `referral-bonus-5k.sql` |
| `claim_daily_bonus(bigint,bigint,int)` | `streak-rewards-v2.sql` | `achievements-daily.sql` |
| `claim_weekly_prize()` | `weekly-podium.sql` | `setup.sql` |
| `send_gift(uuid,bigint,text)` | `gift-limit-50k.sql` | `setup.sql` |
| `claim_mission(text,bigint,text)` | `missions.sql` | — (single def, but body changed by app-config wiring) |
| `admin_set_level` | two overloads coexist: `admin.sql` (`int`, self) + `admin-tools.sql` (`uuid,int`, target) | — |

Everything else is defined exactly once.

---

## 4. `SCHEMA.sql`

A hand-maintained reference of the current tables + latest function bodies.
**Reference only** — see the disclaimer at the top of that file. For anything
authoritative, `pg_dump` the live database.
