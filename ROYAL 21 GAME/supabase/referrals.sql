-- =============================================================================
-- REFERRAL SYSTEM — friend invite bonuses
-- Run once in the Supabase SQL editor after setup.sql.
-- =============================================================================

-- Track completed referrals (one row per successful invite)
create table if not exists public.referrals (
  id bigserial primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null references auth.users(id) on delete cascade,
  bonus_chips integer not null default 500 check (bonus_chips > 0),
  created_at  timestamptz not null default now(),
  -- one person can only be referred once, ever
  constraint referrals_referee_unique unique (referee_id),
  -- no self-referrals
  constraint referrals_not_self check (referrer_id <> referee_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Everyone signed in can read their own referrals (as either party)
drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- Only the RPC below writes to this table (SECURITY DEFINER), so no INSERT policy.

-- =============================================================================
-- claim_referral(referrer_id) — called by the newly-signed-in referee
-- =============================================================================
create or replace function public.claim_referral(p_referrer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referee_id uuid := auth.uid();
  v_bonus int := 500;
  v_existing int;
begin
  -- Must be signed in
  if v_referee_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not-signed-in');
  end if;

  -- Cannot refer yourself
  if v_referee_id = p_referrer_id then
    return jsonb_build_object('ok', false, 'reason', 'self-referral');
  end if;

  -- Referrer must exist
  if not exists (select 1 from public.profiles where id = p_referrer_id) then
    return jsonb_build_object('ok', false, 'reason', 'invalid-referrer');
  end if;

  -- One referral per referee, ever
  select 1 into v_existing from public.referrals where referee_id = v_referee_id;
  if found then
    return jsonb_build_object('ok', false, 'reason', 'already-claimed');
  end if;

  -- Referee must be a "new" account — created within the last 24 hours.
  -- This is the anti-abuse rail: an old account can't come back and claim
  -- a referral chip after months of play.
  if exists (
    select 1 from auth.users
    where id = v_referee_id
      and created_at < now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'account-too-old');
  end if;

  -- Record the referral, credit both sides
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

-- =============================================================================
-- Convenience view: count of referrals per user
-- =============================================================================
create or replace view public.referral_stats as
select
  referrer_id as user_id,
  count(*)::int as referred_count,
  coalesce(sum(bonus_chips), 0)::int as chips_earned
from public.referrals
group by referrer_id;

grant select on public.referral_stats to authenticated;
