-- =============================================================================
-- REFERRAL BONUS — 500 -> 5,000 for both sides
-- Run once in the Supabase SQL editor (after referrals.sql). Idempotent.
-- Mirrors REFERRAL_BONUS in src/data/economy.ts.
-- =============================================================================

-- New referrals record 5,000. Existing rows keep whatever they were paid.
alter table public.referrals alter column bonus_chips set default 5000;

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

  -- Anti-abuse: referee account must be < 24h old.
  if exists (
    select 1 from auth.users
    where id = v_referee_id
      and created_at < now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'account-too-old');
  end if;

  insert into public.referrals (referrer_id, referee_id, bonus_chips)
    values (p_referrer_id, v_referee_id, v_bonus);

  update public.profiles set chips = chips + v_bonus where id = v_referee_id;
  update public.profiles set chips = chips + v_bonus where id = p_referrer_id;

  return jsonb_build_object(
    'ok', true,
    'bonus_chips', v_bonus,
    'referrer_id', p_referrer_id
  );
end;
$$;

revoke all on function public.claim_referral(uuid) from public;
grant execute on function public.claim_referral(uuid) to authenticated;
