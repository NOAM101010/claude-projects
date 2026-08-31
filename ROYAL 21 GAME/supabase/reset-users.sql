-- =============================================================================
-- ROYAL 21 — reset every NON-ADMIN player to a fresh start.
--
-- Admin accounts (profiles.is_admin = true — i.e. the emails in admin_emails())
-- are left COMPLETELY untouched: their chips, level, items, stats, everything.
--
-- Everyone else keeps their login (they can sign back in) but loses all
-- progress: chips → 5,000, level → 1, XP → 0, cosmetics → the 12 starters,
-- achievements / daily streak / milestones / stats → zero.
--
-- Also wiped (for everyone, admin included — these are session logs, not the
-- admin's account): all rooms + game history, all notifications, all bug
-- reports, all analytics events.
--
-- NOT touched: friendships, friend requests, blocks, gifts, referrals,
-- rivalries, the jackpot pools, the shop catalog, RLS, functions.
--
-- Run in Supabase → SQL Editor. Wrapped in a transaction: all-or-nothing.
-- Safe to re-run. Re-running just re-flattens everyone again.
-- =============================================================================

-- Make sure the achievements/daily columns exist even if achievements-daily.sql
-- hasn't been run yet (this block is a no-op once it has).
alter table public.profiles
  add column if not exists achievements    text[] not null default '{}',
  add column if not exists daily_last_claim date,
  add column if not exists daily_streak     integer not null default 0;

begin;

-- --- 0. Preview -------------------------------------------------------------
do $$
declare
  n_reset int;
  n_admin int;
begin
  select count(*) into n_reset from public.profiles where not is_admin;
  select count(*) into n_admin from public.profiles where is_admin;
  raise notice 'Resetting % non-admin profile(s). Preserving % admin profile(s).', n_reset, n_admin;
end $$;

-- --- 1. Profiles → fresh start (non-admin only) ---------------------------
update public.profiles p set
  chips                   = 5000,
  xp                      = 0,
  level                   = 1,
  last_milestone_claimed  = 0,
  weekly_prize_claimed_at = null,
  equipped                = '{"cardFace":"cf-classic","cardBack":"bk-crimson","chipSkin":"ck-classic","table":"tb-green","frame":null,"victory":null,"dealerSkin":"dl-house"}'::jsonb,
  favorite_game           = null,
  current_game            = null,
  presence                = 'offline',
  achievements            = '{}',
  daily_last_claim        = null,
  daily_streak            = 0,
  updated_at              = now()
where not p.is_admin;

-- --- 2. Player stats → zero (non-admin only) -----------------------------
delete from public.player_stats
where user_id in (select id from public.profiles where not is_admin);

insert into public.player_stats (user_id)
select id from public.profiles where not is_admin
on conflict (user_id) do nothing;

-- --- 3. Inventory → only the 12 starter cosmetics (non-admin only) -------
delete from public.user_items
where user_id in (select id from public.profiles where not is_admin);

insert into public.user_items (user_id, item_id)
select p.id, s.item_id
from public.profiles p
cross join (values
  ('cf_classic'),('bk_crimson'),('ch_classic'),('tb_green'),
  ('dl_house'),('em_laugh'),('em_cool'),('em_angry'),('em_shake'),
  ('cn_classic'),('sl_classic'),('rb_default')
) as s(item_id)
where not p.is_admin
  and exists (select 1 from public.items i where i.id = s.item_id)
on conflict do nothing;

-- --- 4. Old achievements table → clear (non-admin only) -----------------
delete from public.user_achievements
where user_id in (select id from public.profiles where not is_admin);

-- --- 5. Rooms + game history → wipe everything -------------------------
truncate table
  public.room_actions,
  public.room_messages,
  public.room_members,
  public.rooms,
  public.game_players,
  public.game_sessions,
  public.blackjack_hands,
  public.blackjack_payouts,
  public.poker_hole,
  public.poker_hand_secret,
  public.bj_hand_secret
restart identity cascade;

-- --- 6. Notifications + bug reports + analytics → wipe -----------------
truncate table
  public.notifications,
  public.bug_reports,
  public.analytics_events
restart identity;

-- --- 7. Final count ---------------------------------------------------------
do $$
begin
  raise notice 'Done. non-admin profiles now at 5000 chips / level 1: %',
    (select count(*) from public.profiles where not is_admin and chips = 5000 and level = 1);
end $$;

commit;
