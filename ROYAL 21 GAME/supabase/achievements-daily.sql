-- =============================================================================
-- Server-authoritative achievements + daily bonus.
--
-- Before this, both lived only in localStorage. Clearing browser data — OR
-- signing in from a different device — reset the "already claimed" list, so
-- the same achievement rewards could be pocketed again and again. Same for
-- the daily gift.
--
-- Move both to the profiles row + gate their claim behind an atomic RPC that
-- refuses a second grant. Safe to re-run.
-- =============================================================================

-- Columns ------------------------------------------------------------------
alter table public.profiles
  add column if not exists achievements text[] not null default '{}',
  add column if not exists daily_last_claim date,
  add column if not exists daily_streak integer not null default 0;


-- claim_achievement --------------------------------------------------------
-- Atomically grant an achievement + its chip reward if the user hasn't
-- already earned it. Returns the new chip balance on success, null when
-- the achievement was already claimed (no chips granted, no error raised —
-- the client treats null as "nothing to do").
create or replace function public.claim_achievement(
  p_achievement_id text,
  p_reward bigint
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance bigint;
begin
  if p_reward < 0 then raise exception 'reward must be non-negative'; end if;

  update public.profiles
     set achievements = array_append(achievements, p_achievement_id),
         chips = greatest(0, chips + p_reward)
   where id = auth.uid()
     and not (achievements @> array[p_achievement_id])
  returning chips into new_balance;

  return new_balance; -- null when the row was already claimed
end;
$$;

grant execute on function public.claim_achievement(text, bigint) to authenticated;


-- claim_daily_bonus --------------------------------------------------------
-- Atomically grant the daily bonus if today hasn't been claimed. Returns
-- jsonb: { granted: boolean, chips: bigint, day: int, comeback: boolean,
--         new_balance: bigint }. Client trusts this over any local mirror.
--
-- Streak logic mirrors the client's nextStreakDay: consecutive day advances
-- it, missing a day (or more) resets to 1, missing 3+ days flags comeback.
create or replace function public.claim_daily_bonus(
  p_streak_reward bigint,
  p_comeback_bonus bigint,
  p_comeback_threshold integer default 3
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  today_ date := (now() at time zone 'utc')::date;
  last_ date;
  prev_streak integer;
  next_day integer;
  is_comeback boolean;
  total bigint;
  new_balance bigint;
begin
  if p_streak_reward < 0 then raise exception 'reward must be non-negative'; end if;

  select daily_last_claim, coalesce(daily_streak, 0)
    into last_, prev_streak
    from public.profiles
   where id = auth.uid();

  if last_ = today_ then
    -- Already claimed today. Return the state so the UI can update.
    select chips into new_balance from public.profiles where id = auth.uid();
    return jsonb_build_object(
      'granted', false,
      'chips', 0,
      'day', prev_streak,
      'comeback', false,
      'new_balance', new_balance
    );
  end if;

  next_day := case
    when last_ is null then 1
    when last_ = today_ - interval '1 day' then prev_streak + 1
    else 1
  end;

  is_comeback := last_ is not null and (today_ - last_) >= p_comeback_threshold;
  total := p_streak_reward + case when is_comeback then p_comeback_bonus else 0::bigint end;

  update public.profiles
     set chips = greatest(0, chips + total),
         daily_last_claim = today_,
         daily_streak = next_day
   where id = auth.uid()
  returning chips into new_balance;

  return jsonb_build_object(
    'granted', true,
    'chips', total,
    'day', next_day,
    'comeback', is_comeback,
    'new_balance', new_balance
  );
end;
$$;

grant execute on function public.claim_daily_bonus(bigint, bigint, integer) to authenticated;


-- fetch_achievements + fetch_daily_state -----------------------------------
-- Two tiny read helpers so hydrate can adopt the server's canonical state.
create or replace function public.fetch_achievements()
returns text[]
language sql
security definer set search_path = public
as $$
  select coalesce(achievements, '{}'::text[]) from public.profiles where id = auth.uid()
$$;

grant execute on function public.fetch_achievements() to authenticated;

create or replace function public.fetch_daily_state()
returns jsonb
language sql
security definer set search_path = public
as $$
  select jsonb_build_object(
    'lastClaim', daily_last_claim,
    'day', coalesce(daily_streak, 0)
  )
  from public.profiles where id = auth.uid()
$$;

grant execute on function public.fetch_daily_state() to authenticated;
