-- =============================================================================
-- DAILY / WEEKLY MISSIONS
-- Run once in the Supabase SQL editor. Idempotent.
--
--   • profiles.mission_claims jsonb  — { "<periodKey>:<missionId>": true }
--       periodKey = the UTC date (YYYY-MM-DD) for daily missions + the all-3
--       bonus, or the week bucket number for the weekly mission.
--   • claim_mission(mission_id, reward, period_key) — atomic grant, keyed on
--       that composite key, so opening two devices the same day only pays once.
--       Returns jsonb { granted, new_balance }; new_balance is always the
--       authoritative balance so the client can delta-correct its optimistic
--       grant even on the already-claimed no-op.
--
-- Reward is validated against a cap (app_config.max_mission_reward, fallback
-- 20,000 = MAX_MISSION_REWARD). The virtual "all_done" mission ignores the
-- client-supplied reward entirely and pays app_config.mission_all_done_bonus
-- (fallback 5,000 = MISSION_ALL_DONE_BONUS). Run supabase/app-config.sql first;
-- with no config rows the behaviour is identical to before.
-- Old keys (> 8 days / > 2 weeks) are pruned opportunistically on each claim.
-- =============================================================================

alter table public.profiles
  add column if not exists mission_claims jsonb not null default '{}'::jsonb;

create or replace function public.claim_mission(
  p_mission_id text,
  p_reward bigint,
  p_period_key text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_key text := p_period_key || ':' || p_mission_id;
  v_claims jsonb;
  v_cleaned jsonb := '{}'::jsonb;
  v_pair record;
  v_period text;
  v_today date := (now() at time zone 'utc')::date;
  v_week bigint := floor(extract(epoch from now()) / 86400 / 7);
  v_cap bigint := public.config_num('max_mission_reward', 20000);
  v_reward bigint := p_reward;
  new_balance bigint;
begin
  if p_mission_id is null or p_mission_id = '' or p_period_key is null or p_period_key = '' then
    raise exception 'mission id / period key required';
  end if;

  -- The "finished all 3" bonus is server-priced — the client reward is ignored.
  if p_mission_id = 'all_done' then
    v_reward := public.config_num('mission_all_done_bonus', 5000);
  end if;

  if v_reward < 0 or v_reward > v_cap then
    raise exception 'mission reward out of range';
  end if;

  select mission_claims into v_claims from public.profiles where id = auth.uid();
  v_claims := coalesce(v_claims, '{}'::jsonb);

  if v_claims ? v_key then
    select chips into new_balance from public.profiles where id = auth.uid();
    return jsonb_build_object('granted', false, 'new_balance', new_balance);
  end if;

  -- Opportunistic prune of stale keys.
  for v_pair in select key, value from jsonb_each(v_claims)
  loop
    v_period := split_part(v_pair.key, ':', 1);
    if v_period ~ '^\d{4}-\d{2}-\d{2}$' then
      if v_period::date >= v_today - 8 then
        v_cleaned := v_cleaned || jsonb_build_object(v_pair.key, v_pair.value);
      end if;
    elsif v_period ~ '^\d+$' then
      if v_period::bigint >= v_week - 2 then
        v_cleaned := v_cleaned || jsonb_build_object(v_pair.key, v_pair.value);
      end if;
    else
      v_cleaned := v_cleaned || jsonb_build_object(v_pair.key, v_pair.value);
    end if;
  end loop;

  update public.profiles
     set chips = greatest(0, chips + v_reward),
         mission_claims = v_cleaned || jsonb_build_object(v_key, true),
         updated_at = now()
   where id = auth.uid()
  returning chips into new_balance;

  return jsonb_build_object('granted', true, 'new_balance', new_balance);
end;
$$;

revoke all on function public.claim_mission(text, bigint, text) from public;
grant execute on function public.claim_mission(text, bigint, text) to authenticated;
