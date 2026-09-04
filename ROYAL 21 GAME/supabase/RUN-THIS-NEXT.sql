-- =============================================================================
-- ROYAL 21 — שלב O — VIP rework  (כל 3 החלקים בקובץ אחד)
--
-- הרץ פעם אחת ב-Supabase → SQL Editor. Select All → Paste → Run. Idempotent.
-- דרישה מוקדמת שכבר רצה: setup.sql, weekly-snapshot.sql.
--
-- חלק 1 — items.vip_tier + seed 14 פריטי VIP (לא נקנים; בעלות נגזרת מהרמה).
-- חלק 2 — app-config.sql מלא (re-run) — מוסיף vip_daily / vip_cashback_pct / vip_stipend.
-- חלק 3 — vip.sql — עמודות cooldown ב-profiles + claim_vip_daily/cashback/stipend + fetch_vip_state.
-- =============================================================================

alter table public.items add column if not exists vip_tier int;

insert into public.items (id, category, name, rarity, price, icon, payload, vip_tier) values
  -- frames
  ('fr_vip_bronze',   'frames',    '{"he":"מסגרת VIP ברונזה","en":"VIP Bronze Frame"}'::jsonb,   'epic',      0, '🥉', '{"frame":"fr-vip-bronze"}'::jsonb,     1),
  ('fr_vip_silver',   'frames',    '{"he":"מסגרת VIP כסף","en":"VIP Silver Frame"}'::jsonb,      'legendary', 0, '🥈', '{"frame":"fr-vip-silver"}'::jsonb,     2),
  ('fr_vip_gold',     'frames',    '{"he":"מסגרת VIP זהב","en":"VIP Gold Frame"}'::jsonb,        'legendary', 0, '🥇', '{"frame":"fr-vip-gold"}'::jsonb,       3),
  ('fr_vip_diamond',  'frames',    '{"he":"מסגרת VIP יהלום","en":"VIP Diamond Frame"}'::jsonb,   'mythic',    0, '💎', '{"frame":"fr-vip-diamond"}'::jsonb,    4),
  -- titles
  ('ttl_vip_bronze',  'title',     '{"he":"VIP ברונזה","en":"VIP Bronze"}'::jsonb,               'epic',      0, '🥉', '{"title":"ttl-vip-bronze"}'::jsonb,    1),
  ('ttl_vip_silver',  'title',     '{"he":"VIP כסף","en":"VIP Silver"}'::jsonb,                  'legendary', 0, '🥈', '{"title":"ttl-vip-silver"}'::jsonb,    2),
  ('ttl_vip_gold',    'title',     '{"he":"VIP זהב","en":"VIP Gold"}'::jsonb,                    'legendary', 0, '🥇', '{"title":"ttl-vip-gold"}'::jsonb,      3),
  ('ttl_vip_diamond', 'title',     '{"he":"VIP יהלום","en":"VIP Diamond"}'::jsonb,               'mythic',    0, '💎', '{"title":"ttl-vip-diamond"}'::jsonb,   4),
  -- name colours
  ('nc_vip_bronze',   'nameColor', '{"he":"שם VIP ברונזה","en":"VIP Bronze Name"}'::jsonb,       'epic',      0, '🥉', '{"nameColor":"#cd8b5e"}'::jsonb,       1),
  ('nc_vip_silver',   'nameColor', '{"he":"שם VIP כסף","en":"VIP Silver Name"}'::jsonb,          'legendary', 0, '🥈', '{"nameColor":"#cfd8e3"}'::jsonb,       2),
  ('nc_vip_gold',     'nameColor', '{"he":"שם VIP זהב","en":"VIP Gold Name"}'::jsonb,            'legendary', 0, '🥇', '{"nameColor":"#f4cf6b"}'::jsonb,       3),
  ('nc_vip_diamond',  'nameColor', '{"he":"שם VIP יהלום","en":"VIP Diamond Name"}'::jsonb,       'mythic',    0, '💎', '{"nameColor":"#8fe3f0"}'::jsonb,       4),
  -- Diamond-only legendary table + victory
  ('tb_vip_diamond',  'tables',    '{"he":"שולחן VIP יהלום","en":"VIP Diamond Table"}'::jsonb,   'mythic',    0, '💎', '{"table":"tb-vip-diamond"}'::jsonb,    4),
  ('vc_vip_diamond',  'victory',   '{"he":"ניצחון VIP יהלום","en":"VIP Diamond Victory"}'::jsonb,'mythic',    0, '💎', '{"victory":"vc-vip-diamond"}'::jsonb,  4)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload,
  vip_tier = excluded.vip_tier;

-- ============================ סוף — הכל רץ ✓ ================================

-- #############################################################################
-- ## חלק 2/3 — app-config.sql (re-run, idempotent — מוסיף vip_daily/cashback/stipend)
-- #############################################################################

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

-- #############################################################################
-- ## חלק 3/3 — vip.sql (עמודות cooldown + RPCs של VIP)
-- #############################################################################

-- =============================================================================
-- ROYAL 21 — STAGE O — VIP club (level-only tiers + perk claims)
--
-- Run once in the Supabase SQL editor. Select All → Paste → Run. Idempotent.
-- Prerequisites already run: setup.sql, app-config.sql, weekly-snapshot.sql.
--
-- What this does:
--   1. profiles — three cooldown columns for the VIP claims.
--   2. vip_tier_of(level) — mirrors vipTier() in src/data/vip.ts
--      (0 none · 1 Bronze L5 · 2 Silver L12 · 3 Gold L22 · 4 Diamond L35).
--   3. claim_vip_daily()    — tier daily bonus, 24h cooldown.
--   4. claim_vip_cashback() — % of this week's net loss vs the weekly snapshot,
--                             Silver+ only, weekly cooldown.
--   5. claim_vip_stipend()  — flat weekly stipend, Gold+ only, weekly cooldown.
--   6. fetch_vip_state()    — the three readiness flags for the lounge UI.
--
-- Every RPC is `security definer`, re-derives the tier from profiles.level
-- (never trusts the client), credits with `update ... returning chips`, and
-- drops a 'reward' notification carrying `new_balance` (STAGE J pattern).
--
-- Amounts come from app_config (vip_daily / vip_cashback_pct / vip_stipend,
-- each a jsonb object keyed by tier "1".."4"); with no config row the hard-coded
-- fallbacks below match VIP_TIER_PERKS in src/data/vip.ts exactly.
-- =============================================================================

alter table public.profiles add column if not exists vip_daily_claimed_at    timestamptz;
alter table public.profiles add column if not exists vip_cashback_claimed_week text;
alter table public.profiles add column if not exists vip_stipend_claimed_week  text;

-- --- 2. tier ladder --------------------------------------------------------
create or replace function public.vip_tier_of(p_level integer)
returns integer
language sql
immutable
as $$
  select case
    when p_level >= 35 then 4
    when p_level >= 22 then 3
    when p_level >= 12 then 2
    when p_level >= 5  then 1
    else 0
  end;
$$;

-- exception-safe numeric field of an object-valued config key ({"1": 0.03, ...})
create or replace function public.config_numeric_from_obj(p_key text, p_field text, p_fallback numeric)
returns numeric
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
  return f::text::numeric;
exception when others then
  return p_fallback;
end;
$$;
grant execute on function public.config_numeric_from_obj(text, text, numeric) to authenticated;

-- --- 3. claim_vip_daily() -------------------------------------------------
create or replace function public.claim_vip_daily()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_level    integer;
  v_tier     integer;
  v_last     timestamptz;
  v_amount   bigint;
  v_balance  bigint;
begin
  select level, vip_daily_claimed_at into v_level, v_last
  from public.profiles where id = auth.uid() for update;

  v_tier := public.vip_tier_of(coalesce(v_level, 1));
  if v_tier < 1 then raise exception 'not vip'; end if;

  if v_last is not null and v_last > now() - interval '24 hours' then
    return jsonb_build_object('granted', false, 'reason', 'cooldown', 'amount', 0,
      'new_balance', (select chips from public.profiles where id = auth.uid()),
      'next_at', v_last + interval '24 hours');
  end if;

  v_amount := public.config_num_from_obj('vip_daily', v_tier::text,
                case v_tier when 1 then 10000 when 2 then 20000 when 3 then 40000 else 80000 end);

  update public.profiles
     set chips = chips + v_amount, vip_daily_claimed_at = now(), updated_at = now()
   where id = auth.uid()
  returning chips into v_balance;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (auth.uid(), 'reward', 'vip_daily', null,
    jsonb_build_object('amount', v_amount, 'tier', v_tier, 'new_balance', v_balance));

  return jsonb_build_object('granted', true, 'reason', 'ok', 'amount', v_amount,
    'new_balance', v_balance, 'next_at', now() + interval '24 hours');
end;
$$;
grant execute on function public.claim_vip_daily() to authenticated;

-- --- 4. claim_vip_cashback() --------------------------------------------
-- Uses the frozen weekly_chip_snapshot of the CURRENT week's start (the row
-- capture_weekly_snapshot() wrote keyed to the week that just ended). Cashback =
-- floor(max(0, start_chips - current_chips) * pct[tier]). Silver+ only.
create or replace function public.claim_vip_cashback()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_level     integer;
  v_tier      integer;
  v_week      text := to_char(now(), 'IYYY-"W"IW');
  v_snap_week text := to_char(now() - interval '7 days', 'IYYY-"W"IW');
  v_claimed   text;
  v_start     bigint;
  v_current   bigint;
  v_pct       numeric;
  v_amount    bigint;
  v_balance   bigint;
begin
  select level, vip_cashback_claimed_week, chips
    into v_level, v_claimed, v_current
  from public.profiles where id = auth.uid() for update;

  v_tier := public.vip_tier_of(coalesce(v_level, 1));
  if v_tier < 1 then raise exception 'not vip'; end if;

  v_pct := public.config_numeric_from_obj('vip_cashback_pct', v_tier::text,
             case v_tier when 2 then 0.03 when 3 then 0.05 when 4 then 0.10 else 0 end);
  if v_pct <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'nothing', 'amount', 0, 'new_balance', v_current);
  end if;

  if v_claimed is not null and v_claimed = v_week then
    return jsonb_build_object('granted', false, 'reason', 'cooldown', 'amount', 0, 'new_balance', v_current);
  end if;

  select chips into v_start
  from public.weekly_chip_snapshot
  where week_key = v_snap_week and user_id = auth.uid();

  if v_start is null then
    -- No baseline snapshot yet this week. Don't burn the weekly cooldown —
    -- the player can retry once capture_weekly_snapshot has run.
    return jsonb_build_object('granted', false, 'reason', 'no_snapshot', 'amount', 0, 'new_balance', v_current);
  end if;

  v_amount := floor(greatest(0, v_start - v_current) * v_pct);
  if v_amount <= 0 then
    update public.profiles set vip_cashback_claimed_week = v_week where id = auth.uid();
    return jsonb_build_object('granted', false, 'reason', 'nothing', 'amount', 0, 'new_balance', v_current);
  end if;

  update public.profiles
     set chips = chips + v_amount, vip_cashback_claimed_week = v_week, updated_at = now()
   where id = auth.uid()
  returning chips into v_balance;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (auth.uid(), 'reward', 'vip_cashback', null,
    jsonb_build_object('amount', v_amount, 'tier', v_tier, 'new_balance', v_balance));

  return jsonb_build_object('granted', true, 'reason', 'ok', 'amount', v_amount, 'new_balance', v_balance);
end;
$$;
grant execute on function public.claim_vip_cashback() to authenticated;

-- --- 5. claim_vip_stipend() --------------------------------------------
create or replace function public.claim_vip_stipend()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_level   integer;
  v_tier    integer;
  v_week    text := to_char(now(), 'IYYY-"W"IW');
  v_claimed text;
  v_amount  bigint;
  v_current bigint;
  v_balance bigint;
begin
  select level, vip_stipend_claimed_week, chips
    into v_level, v_claimed, v_current
  from public.profiles where id = auth.uid() for update;

  v_tier := public.vip_tier_of(coalesce(v_level, 1));
  if v_tier < 3 then
    return jsonb_build_object('granted', false, 'reason', 'nothing', 'amount', 0, 'new_balance', v_current);
  end if;

  if v_claimed is not null and v_claimed = v_week then
    return jsonb_build_object('granted', false, 'reason', 'cooldown', 'amount', 0, 'new_balance', v_current);
  end if;

  v_amount := public.config_num_from_obj('vip_stipend', v_tier::text,
                case v_tier when 3 then 25000 else 75000 end);

  update public.profiles
     set chips = chips + v_amount, vip_stipend_claimed_week = v_week, updated_at = now()
   where id = auth.uid()
  returning chips into v_balance;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (auth.uid(), 'reward', 'vip_stipend', null,
    jsonb_build_object('amount', v_amount, 'tier', v_tier, 'new_balance', v_balance));

  return jsonb_build_object('granted', true, 'reason', 'ok', 'amount', v_amount, 'new_balance', v_balance);
end;
$$;
grant execute on function public.claim_vip_stipend() to authenticated;

-- --- 6. fetch_vip_state() ---------------------------------------------
create or replace function public.fetch_vip_state()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_level    integer;
  v_tier     integer;
  v_daily    timestamptz;
  v_cashback text;
  v_stipend  text;
  v_week     text := to_char(now(), 'IYYY-"W"IW');
begin
  select level, vip_daily_claimed_at, vip_cashback_claimed_week, vip_stipend_claimed_week
    into v_level, v_daily, v_cashback, v_stipend
  from public.profiles where id = auth.uid();

  v_tier := public.vip_tier_of(coalesce(v_level, 1));

  return jsonb_build_object(
    'tier', v_tier,
    'daily_ready',    (v_daily is null or v_daily <= now() - interval '24 hours'),
    'daily_next_at',  case when v_daily is null then null else v_daily + interval '24 hours' end,
    'cashback_ready', (v_cashback is null or v_cashback <> v_week),
    'stipend_ready',  (v_stipend is null or v_stipend <> v_week)
  );
end;
$$;
grant execute on function public.fetch_vip_state() to authenticated;

-- ============================ סוף — הכל רץ ✓ ================================
