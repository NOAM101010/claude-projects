-- =============================================================================
-- LOGIN STREAK — bigger rewards + server-authoritative amount
-- Run once in the Supabase SQL editor. Idempotent (create or replace).
--
-- Before: claim_daily_bonus trusted the client's `p_streak_reward` for the
-- amount. Now the server computes it from the streak day itself; the parameter
-- is kept only for signature/back-compat (still validated >= 0) and ignored for
-- the payout. Ladder must match STREAK_REWARD() in src/data/economy.ts.
--
--   day  1-3  :    500        day 8-13  :  1,500       day 15-29 :  2,000
--   day  4-6  :  1,000        day 14    : 15,000       day 30    : 50,000
--   day  7    :  5,000                                 day 30+   :  2,500
--
-- Reset window stays UTC (unchanged).
--
-- The ladder amounts now come from app_config.streak_rewards (jsonb object,
-- keys "1-3" / "4-6" / "7" / "8-13" / "14" / "15-29" / "30" / "31+"), each with
-- the hard-coded fallback below. Run supabase/app-config.sql first; with no
-- config row the payout is byte-for-byte identical to before.
-- =============================================================================

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
  v_reward bigint;
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

  -- Server-side ladder — the client's p_streak_reward is no longer trusted.
  -- config_num_from_obj is exception-safe: a malformed streak_rewards row falls
  -- straight through to the hard-coded amount instead of aborting the RPC.
  v_reward := case
    when next_day = 30  then public.config_num_from_obj('streak_rewards', '30',    50000)
    when next_day = 14  then public.config_num_from_obj('streak_rewards', '14',    15000)
    when next_day = 7   then public.config_num_from_obj('streak_rewards', '7',     5000)
    when next_day <= 3  then public.config_num_from_obj('streak_rewards', '1-3',   500)
    when next_day <= 6  then public.config_num_from_obj('streak_rewards', '4-6',   1000)
    when next_day <= 13 then public.config_num_from_obj('streak_rewards', '8-13',  1500)
    when next_day <= 29 then public.config_num_from_obj('streak_rewards', '15-29', 2000)
    else                     public.config_num_from_obj('streak_rewards', '31+',   2500)
  end;

  is_comeback := last_ is not null and (today_ - last_) >= p_comeback_threshold;
  total := v_reward + case when is_comeback then p_comeback_bonus else 0::bigint end;

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
