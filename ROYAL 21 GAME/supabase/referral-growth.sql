-- =============================================================================
-- REFERRAL GROWTH — staged referral rewards (STAGE 4)
-- Run once in the Supabase SQL editor after referrals.sql + referral-bonus-5k.sql.
-- Idempotent. Mirrors REFERRAL_* constants in src/data/economy.ts.
-- =============================================================================

-- Per-referral flag: has the level-5 "stage 2" bonus been paid for this pair?
alter table public.referrals add column if not exists stage2_claimed boolean not null default false;

-- Per-referrer tier progress (0..3). How many tier rewards they've collected.
alter table public.profiles add column if not exists referrer_tier int not null default 0;

-- -----------------------------------------------------------------------------
-- claim_referral(referrer_id) — extend the anti-abuse window 24h -> 72h.
-- (Full redefinition; keeps the 5,000 bonus from referral-bonus-5k.sql.)
-- -----------------------------------------------------------------------------
create or replace function public.claim_referral(p_referrer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referee_id uuid := auth.uid();
  v_bonus int := 5000;
  v_existing int;
begin
  if v_referee_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not-signed-in');
  end if;

  if v_referee_id = p_referrer_id then
    return jsonb_build_object('ok', false, 'reason', 'self-referral');
  end if;

  if not exists (select 1 from public.profiles where id = p_referrer_id) then
    return jsonb_build_object('ok', false, 'reason', 'invalid-referrer');
  end if;

  select 1 into v_existing from public.referrals where referee_id = v_referee_id;
  if found then
    return jsonb_build_object('ok', false, 'reason', 'already-claimed');
  end if;

  -- Anti-abuse: referee account must be < 72h old.
  if exists (
    select 1 from auth.users
    where id = v_referee_id
      and created_at < now() - interval '72 hours'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'account-too-old');
  end if;

  insert into public.referrals (referrer_id, referee_id, bonus_chips)
    values (p_referrer_id, v_referee_id, v_bonus);

  update public.profiles set chips = chips + v_bonus where id = v_referee_id;
  update public.profiles set chips = chips + v_bonus where id = p_referrer_id;

  return jsonb_build_object('ok', true, 'bonus_chips', v_bonus, 'referrer_id', p_referrer_id);
end;
$$;

revoke all on function public.claim_referral(uuid) from public;
grant execute on function public.claim_referral(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- claim_referral_stage2() — the referee calls this. Once they reach level 5,
-- both sides get a second bonus (REFERRAL_STAGE2_BONUS = 10,000). Atomic,
-- idempotent (stage2_claimed guard).
-- -----------------------------------------------------------------------------
create or replace function public.claim_referral_stage2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referee_id uuid := auth.uid();
  v_bonus int := 10000;
  v_level int;
  v_ref   public.referrals%rowtype;
begin
  if v_referee_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not-signed-in');
  end if;

  select * into v_ref from public.referrals where referee_id = v_referee_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no-referral');
  end if;
  if v_ref.stage2_claimed then
    return jsonb_build_object('ok', false, 'reason', 'already-claimed');
  end if;

  select level into v_level from public.profiles where id = v_referee_id;
  if coalesce(v_level, 1) < 5 then
    return jsonb_build_object('ok', false, 'reason', 'level-too-low');
  end if;

  update public.referrals set stage2_claimed = true where id = v_ref.id;
  update public.profiles set chips = chips + v_bonus where id = v_referee_id;
  update public.profiles set chips = chips + v_bonus where id = v_ref.referrer_id;

  return jsonb_build_object('ok', true, 'bonus_chips', v_bonus);
end;
$$;

revoke all on function public.claim_referral_stage2() from public;
grant execute on function public.claim_referral_stage2() to authenticated;

-- -----------------------------------------------------------------------------
-- claim_referrer_tier() — the referrer calls this. Pays out the next unclaimed
-- tier reward if their completed-referral count has reached it.
-- Tiers (after 1st / 2nd / 3rd friend): 3,000 / 7,000 / 15,000. Max 3.
-- -----------------------------------------------------------------------------
create or replace function public.claim_referrer_tier()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_tier  int;
  v_count int;
  v_reward int;
  v_rewards int[] := array[3000, 7000, 15000];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not-signed-in');
  end if;

  select referrer_tier into v_tier from public.profiles where id = v_uid for update;
  v_tier := coalesce(v_tier, 0);
  if v_tier >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'maxed');
  end if;

  select count(*) into v_count from public.referrals where referrer_id = v_uid;
  -- need at least (v_tier + 1) completed referrals to unlock tier index v_tier
  if v_count < v_tier + 1 then
    return jsonb_build_object('ok', false, 'reason', 'not-yet');
  end if;

  v_reward := v_rewards[v_tier + 1];
  update public.profiles
     set chips = chips + v_reward, referrer_tier = v_tier + 1
   where id = v_uid;

  return jsonb_build_object('ok', true, 'bonus_chips', v_reward, 'tier', v_tier + 1);
end;
$$;

revoke all on function public.claim_referrer_tier() from public;
grant execute on function public.claim_referrer_tier() to authenticated;
