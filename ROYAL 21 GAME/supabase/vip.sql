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
