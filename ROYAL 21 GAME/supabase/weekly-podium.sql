-- =============================================================================
-- WEEKLY PODIUM — claim_weekly_prize pays #1 / #2 / #3 among friends (STAGE D)
-- Run once in the Supabase SQL editor, AFTER supabase/weekly-snapshot.sql.
-- Idempotent. Mirrors WEEKLY_PODIUM in src/data/economy.ts ([5000, 2500, 1000]).
--
-- Ranking now uses the frozen weekly_chip_snapshot of the last completed ISO
-- week (not live balances), so the standings can't be gamed after the week ends.
-- The RPC credits immediately and drops a 'podium_prize' notification as a
-- receipt — no separate claim step, nothing can get stuck.
-- =============================================================================

alter table public.profiles
  add column if not exists weekly_prize_claimed_week text;

create or replace function public.claim_weekly_prize()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_week      text := to_char(now() - interval '7 days', 'IYYY-"W"IW');
  claimed_wk  text;
  my_chips    bigint;
  snap_count  integer;
  ahead_count integer;
  my_rank     integer;
  prize       bigint;
  balance     bigint;
  -- Live payouts from app_config.weekly_podium ([#1,#2,#3]); config_bigint_array
  -- falls back to this array on a missing / malformed key. Run app-config.sql first.
  podium      bigint[] := public.config_bigint_array('weekly_podium', array[5000, 2500, 1000]);
begin
  select weekly_prize_claimed_week into claimed_wk
  from public.profiles where id = auth.uid() for update;

  if claimed_wk is not null and claimed_wk = v_week then
    return jsonb_build_object('claimed', false, 'reason', 'already');
  end if;

  select count(*) into snap_count
  from public.weekly_chip_snapshot where week_key = v_week;

  if snap_count = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'no_snapshot');
  end if;

  select chips into my_chips
  from public.weekly_chip_snapshot
  where week_key = v_week and user_id = auth.uid();

  if my_chips is null then
    -- No snapshot row for the caller (joined after capture) — mark done so we
    -- don't re-check every open, and bail.
    update public.profiles set weekly_prize_claimed_week = v_week where id = auth.uid();
    return jsonb_build_object('claimed', false, 'reason', 'no_snapshot');
  end if;

  -- Friends (+ myself) from the snapshot who were strictly richer than me.
  select count(*) into ahead_count
  from public.weekly_chip_snapshot s
  where s.week_key = v_week
    and s.chips > my_chips
    and s.user_id in (
      select friend_id from public.friendships where user_id = auth.uid()
    );

  my_rank := ahead_count + 1;

  if my_rank > 3 then
    update public.profiles set weekly_prize_claimed_week = v_week where id = auth.uid();
    return jsonb_build_object('claimed', false, 'reason', 'off_podium');
  end if;

  prize := podium[my_rank];

  update public.profiles
    set chips = chips + prize,
        weekly_prize_claimed_week = v_week,
        weekly_prize_claimed_at = now(),
        updated_at = now()
  where id = auth.uid()
  returning chips into balance;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    auth.uid(), 'podium_prize', 'weekly_podium_won', null,
    jsonb_build_object('amount', prize, 'rank', my_rank, 'week', v_week, 'claimed', true)
  );

  return jsonb_build_object('claimed', true, 'chips', prize, 'rank', my_rank, 'balance', balance);
end;
$$;

grant execute on function public.claim_weekly_prize() to authenticated;
