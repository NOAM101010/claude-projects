-- =============================================================================
-- ROYAL 21 — FULL RESET. Everyone starts over.
--
-- KEEPS:  • the accounts themselves (profiles — you can all sign back in)
--         • the block list (safety — silently un-blocking people is not worth it)
--         • the shop catalogue, jackpot config, RLS, functions
--
-- WIPES:  • all chips / xp / level / cosmetics → fresh start (5,000 chips, lvl 1,
--           the 12 starter items)
--         • all stats, achievements, event trophies, daily streak, milestones,
--           mission progress + claims, weekly-prize cooldown, referrer tier
--         • all friendships, referral records, chip-gift history, rivalries,
--           pending friend requests
--         • every room + all game history (blackjack / poker / sng / baccarat)
--         • all notifications, bug reports, analytics events
--         • the progressive jackpot pools → back to seed
--
-- ADMIN (profiles.is_admin = true) is left COMPLETELY untouched: chips, level,
-- items, stats, trophies, everything.
--
-- Run in Supabase → SQL Editor. One transaction — all-or-nothing. Safe to re-run.
-- =============================================================================

-- Make sure every column this script writes exists, even if a migration that
-- added it hasn't been run yet. No-op once those migrations have run.
alter table public.profiles
  add column if not exists achievements    text[]  not null default '{}',
  add column if not exists daily_last_claim date,
  add column if not exists daily_streak     integer not null default 0,
  add column if not exists mission_claims   jsonb   not null default '{}'::jsonb,
  add column if not exists referrer_tier    integer not null default 0,
  add column if not exists last_milestone_claimed  integer not null default 0,
  add column if not exists weekly_prize_claimed_at timestamptz,
  add column if not exists ever_vip                boolean default false;

begin;

-- --- 0. Preview -----------------------------------------------------------------
do $$
declare n_reset int; n_admin int;
begin
  select count(*) into n_reset from public.profiles where not is_admin;
  select count(*) into n_admin from public.profiles where is_admin;
  raise notice 'Resetting % non-admin profile(s). Preserving % admin profile(s).', n_reset, n_admin;
end $$;

-- --- 1. Profiles → fresh start (non-admin only) -------------------------------
update public.profiles p set
  chips                   = 5000,
  xp                      = 0,
  level                   = 1,
  last_milestone_claimed  = 0,
  weekly_prize_claimed_at = null,
  ever_vip                = false,
  achievements            = '{}',
  daily_last_claim        = null,
  daily_streak            = 0,
  mission_claims          = '{}'::jsonb,
  referrer_tier           = 0,
  equipped                = '{"cardFace":"cf-classic","cardBack":"bk-crimson","chipSkin":"ck-classic","table":"tb-green","frame":null,"victory":null,"dealerSkin":"dl-house","coinSkin":"cn-classic","currencySkin":null,"slotsTheme":"sl-classic","roomBackground":"rb-default","roomDecor":[]}'::jsonb,
  favorite_game           = null,
  current_game            = null,
  presence                = 'offline',
  updated_at              = now()
where not p.is_admin;

-- --- 2. Player stats → zero (non-admin only) ---------------------------------
delete from public.player_stats
where user_id in (select id from public.profiles where not is_admin);

insert into public.player_stats (user_id)
select id from public.profiles where not is_admin
on conflict (user_id) do nothing;

-- --- 3. Inventory → only the 12 starter cosmetics (non-admin only) ----------
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

-- --- 4. Old achievements table → clear (non-admin only) --------------------
delete from public.user_achievements
where user_id in (select id from public.profiles where not is_admin);

-- --- 5. Social progress (everyone) — blocks are deliberately NOT here ------
truncate table
  public.friendships,
  public.referrals,
  public.chip_gifts,
  public.rivalries,
  public.friend_requests
restart identity cascade;

-- --- 6. Rooms + all game history (everyone) -------------------------------
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

-- --- 7. Notifications + bug reports + analytics (everyone) ----------------
truncate table
  public.notifications,
  public.bug_reports,
  public.analytics_events
restart identity;

-- --- 8. Progressive jackpots → back to seed -------------------------------
update public.jackpots set
  pool            = seed_amount,
  last_won_at     = null,
  last_won_by     = null,
  last_won_amount = 0,
  updated_at      = now();

truncate table public.jackpot_wins restart identity;

-- --- 9. Final count -------------------------------------------------------------
do $$
begin
  raise notice 'Done. Non-admin profiles now at 5000 chips / level 1: %.',
    (select count(*) from public.profiles where not is_admin and chips = 5000 and level = 1);
end $$;

commit;
