-- =============================================================================
-- APP CONFIG — live economy constants, tunable from the admin panel
-- Run once in the Supabase SQL editor AFTER setup.sql + admin.sql.
-- Idempotent. Safe to re-run (seed is insert ... on conflict do nothing).
--
-- This table is the ONE place an admin can move an economy number without a
-- deploy. Every RPC that reads it also carries the hard-coded fallback from
-- src/data/economy.ts, so an empty table behaves exactly like before.
--
--   key                    value (jsonb)              mirrors economy.ts
--   ---------------------  ------------------------   ----------------------
--   gift_daily_limit       50000                     GIFT_DAILY_LIMIT
--   streak_rewards         {"1-3":500, ...}           STREAK_REWARD()
--   weekly_podium          [5000, 2500, 1000]         WEEKLY_PODIUM
--   mission_all_done_bonus 5000                       MISSION_ALL_DONE_BONUS
--   max_mission_reward     20000                      MAX_MISSION_REWARD
--   referrer_tiers         [3000, 7000, 15000]        REFERRER_TIERS
--   baccarat_banker_payout 0.95  (0..1)               DEFAULT_BANKER_PAYOUT
--   vip_daily              {"1":10000,...}            VIP_TIER_PERKS[].dailyBonus
--   vip_cashback_pct       {"2":0.03,...}             VIP_TIER_PERKS[].cashbackPct
--   vip_stipend            {"3":25000,"4":75000}      VIP_TIER_PERKS[].weeklyStipend
-- =============================================================================

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.app_config enable row level security;

-- Everyone signed in may read the config (the client mirrors it for display).
drop policy if exists "read app_config" on public.app_config;
create policy "read app_config" on public.app_config
  for select using (auth.role() = 'authenticated');

-- No insert / update / delete policy on purpose — writes go through
-- admin_set_config() (SECURITY DEFINER) only.

-- --- seed: current values from src/data/economy.ts --------------------------
insert into public.app_config (key, value) values
  ('gift_daily_limit',       to_jsonb(50000)),
  ('streak_rewards',         '{"1-3":500,"4-6":1000,"7":5000,"8-13":1500,"14":15000,"15-29":2000,"30":50000,"31+":2500}'::jsonb),
  ('weekly_podium',          '[5000,2500,1000]'::jsonb),
  ('mission_all_done_bonus', to_jsonb(5000)),
  ('max_mission_reward',     to_jsonb(20000)),
  ('referrer_tiers',         '[3000,7000,15000]'::jsonb),
  ('baccarat_banker_payout', to_jsonb(0.95)),
  ('vip_daily',              '{"1":10000,"2":20000,"3":40000,"4":80000}'::jsonb),
  ('vip_cashback_pct',       '{"1":0,"2":0.03,"3":0.05,"4":0.10}'::jsonb),
  ('vip_stipend',            '{"3":25000,"4":75000}'::jsonb)
on conflict (key) do nothing;

-- --- admin_set_config(key, value) -----------------------------------------
create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_elem  jsonb;
  v_field record;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if p_key is null or p_key = '' then raise exception 'key required'; end if;
  if p_value is null then raise exception 'value required'; end if;

  -- Per-key shape validation. Anything that would later blow up a cast in an
  -- economy RPC is rejected here, so a bad write can never reach the table.
  begin
    case p_key
      when 'gift_daily_limit', 'mission_all_done_bonus', 'max_mission_reward' then
        if jsonb_typeof(p_value) <> 'number' or (p_value::text::numeric) < 0 then
          raise exception 'bad';
        end if;

      when 'baccarat_banker_payout' then
        if jsonb_typeof(p_value) <> 'number'
           or (p_value::text::numeric) < 0 or (p_value::text::numeric) > 1 then
          raise exception 'bad';
        end if;

      when 'weekly_podium', 'referrer_tiers' then
        if jsonb_typeof(p_value) <> 'array' then raise exception 'bad'; end if;
        if p_key = 'weekly_podium' and jsonb_array_length(p_value) <> 3 then
          raise exception 'bad';
        end if;
        for v_elem in select * from jsonb_array_elements(p_value) loop
          if jsonb_typeof(v_elem) <> 'number' or (v_elem::text::numeric) < 0 then
            raise exception 'bad';
          end if;
        end loop;

      when 'streak_rewards', 'vip_daily', 'vip_cashback_pct', 'vip_stipend' then
        if jsonb_typeof(p_value) <> 'object' then raise exception 'bad'; end if;
        for v_field in select value as v from jsonb_each(p_value) loop
          if jsonb_typeof(v_field.v) <> 'number' or (v_field.v::text::numeric) < 0 then
            raise exception 'bad';
          end if;
        end loop;

      else
        raise exception 'unknown config key: %', p_key;
    end case;
  exception
    when others then
      if sqlerrm like 'unknown config key%' then raise; end if;
      raise exception 'invalid value for %', p_key;
  end;

  insert into public.app_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end;
$$;

revoke all on function public.admin_set_config(text, jsonb) from public;
grant execute on function public.admin_set_config(text, jsonb) to authenticated;

-- --- get_app_config() — the whole table as one object --------------------
-- Convenience for the client so it can hydrate in a single round trip.
-- (A plain `select key, value from app_config` works too — RLS allows it.)
create or replace function public.get_app_config()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_config
$$;

grant execute on function public.get_app_config() to authenticated;

-- --- exception-safe readers the economy RPCs use ------------------------
-- A malformed row (string where a number is expected, etc.) must NOT crash the
-- caller: a raw cast error in PostgreSQL aborts the statement *before* any
-- coalesce runs. These wrap every cast in a handler that falls back cleanly.

-- One scalar number by key.
create or replace function public.config_num(p_key text, p_fallback bigint)
returns bigint
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'number' then return p_fallback; end if;
  return v::text::bigint;
exception when others then
  return p_fallback;
end;
$$;

-- One field of an object-valued key ({"30": 50000, ...}).
create or replace function public.config_num_from_obj(p_key text, p_field text, p_fallback bigint)
returns bigint
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb; f jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'object' then return p_fallback; end if;
  f := v -> p_field;
  if f is null or jsonb_typeof(f) <> 'number' then return p_fallback; end if;
  return f::text::bigint;
exception when others then
  return p_fallback;
end;
$$;

-- An array-of-numbers key ([5000,2500,1000]) as a bigint[].
create or replace function public.config_bigint_array(p_key text, p_fallback bigint[])
returns bigint[]
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb; v_out bigint[] := '{}'; elem jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'array' then return p_fallback; end if;
  for elem in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(elem) <> 'number' then return p_fallback; end if;
    v_out := v_out || (elem::text::bigint);
  end loop;
  if array_length(v_out, 1) is null then return p_fallback; end if;
  return v_out;
exception when others then
  return p_fallback;
end;
$$;

grant execute on function public.config_num(text, bigint) to authenticated;
grant execute on function public.config_num_from_obj(text, text, bigint) to authenticated;
grant execute on function public.config_bigint_array(text, bigint[]) to authenticated;
