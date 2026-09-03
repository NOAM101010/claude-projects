-- =============================================================================
-- ROYAL 21 — SCHEMA REFERENCE
--
-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ REFERENCE ONLY. The source of truth is the LIVE database.                   │
-- │ This file was assembled by hand — if anything here disagrees with the DB,   │
-- │ the DB is right. For a reliable snapshot:                                    │
-- │     pg_dump --schema-only --no-owner "$SUPABASE_DB_URL" > schema.sql         │
-- │ (Supabase → Project Settings → Database → Connection string.)               │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- The full, runnable schema is the ordered concatenation of the migration
-- files listed in README.md §1. To rebuild a database, run those in order —
-- do NOT run this file. It exists so you can read the shape of the DB and the
-- CURRENT body of each re-defined function in one place (README.md §3 maps
-- every function to the file that owns its live definition).
--
-- Only `app_config` (added in app-config.sql, 2026-09) is reproduced in full
-- below, because it is new and has exactly one definition.
-- =============================================================================


-- --- app_config : live economy constants ------------------------------------
-- Live definition: supabase/app-config.sql   (authoritative)
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.app_config enable row level security;
-- select: authenticated only. no write policy — admin_set_config() (SECURITY DEFINER).
-- Seeded keys: gift_daily_limit, streak_rewards, weekly_podium,
--              mission_all_done_bonus, max_mission_reward, referrer_tiers.
-- Consumed by: send_gift, claim_daily_bonus, claim_weekly_prize, claim_mission
--              (each with the src/data/economy.ts constant as a hard fallback),
--              and src/hooks/useAppConfig.ts on the client.


-- --- Core tables (shape only — see setup.sql / upgrade.sql for the real DDL) -
--
--   profiles            id, username, tag, avatar, chips, xp, level,
--                       last_milestone_claimed, weekly_prize_claimed_at,
--                       weekly_prize_claimed_week, equipped, presence,
--                       current_game, favorite_game, is_guest, is_admin,
--                       ever_vip, daily_last_claim, daily_streak, achievements,
--                       mission_claims, referrer_tier, onboarded_at,
--                       playtime_seconds, last_seen, created_at, updated_at
--   player_stats        user_id + ~20 counters (games/wins/bj_hands/…)
--   friendships         (user_id, friend_id)              [bidirectional pair rows]
--   friend_requests     id, from_id, to_id, status
--   blocks              (user_id, blocked_id)
--   rivalries           (user_id, friend_id), games, my_wins, their_wins, by_game
--   chip_gifts          id, from_id, to_id, amount, message, created_at
--   referrals           id, referrer_id, referee_id, bonus_chips, stage2_claimed
--   rooms               id, code, game, host_id, state, config, created/updated_at
--   room_members        room_id, user_id, seat (0-5), is_spectator
--   room_actions        room_id, user_id, action payloads
--   room_messages       room_id, user_id, body, created_at
--   game_sessions /
--   game_players        historical results
--   blackjack_hands /
--   blackjack_payouts   per-round settle ledger (claim_blackjack_payout)
--   poker_hole /
--   poker_hand_secret /
--   bj_hand_secret      server-only hole cards (poker-privacy.sql)
--   items               shop catalogue (seeded from src/data/items.ts)
--   user_items          (user_id, item_id) ownership
--   achievements        catalogue: id, tier, trophy, kind ('stat'|'event'), goal
--   user_achievements   legacy per-user grants (superseded by profiles.achievements)
--   notifications       id, user_id, kind, actor_id, title, body, payload, read
--   user_settings       per-user client settings blob
--   jackpots /
--   jackpot_wins        progressive pools (slots / poker)
--   weekly_chip_snapshot  week_key, user_id, chips  (frozen weekly standings)
--   bug_reports         id (bigserial), user_id, description, url, screen_size,
--                       user_agent, browser_info, created_at, resolved_at,
--                       resolved_by, notes
--   analytics_events    id, user_id, event_name, properties, session_id
--
-- For the exact column types, checks, indexes, RLS policies and every function
-- body: read the migration files. README.md §3 says which file is canonical for
-- each of the functions that were re-defined.
