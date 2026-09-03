-- =============================================================================
-- WEEKLY PODIUM — claim_weekly_prize pays #1 / #2 / #3 (STAGE 4)
-- Run once in the Supabase SQL editor after setup.sql. Idempotent.
-- Mirrors WEEKLY_PODIUM in src/data/economy.ts ([5000, 2500, 1000]).
-- =============================================================================

create or replace function public.claim_weekly_prize()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  my_chips     bigint;
  friend_count integer;
  ahead_count  integer;   -- friends strictly richer than me
  my_rank      integer;
  last_claim   timestamptz;
  prize        bigint;
  balance      bigint;
  podium       bigint[] := array[5000, 2500, 1000];
begin
  select chips, weekly_prize_claimed_at into my_chips, last_claim
  from public.profiles where id = auth.uid() for update;

  if last_claim is not null and last_claim > now() - interval '7 days' then
    return jsonb_build_object('claimed', false, 'reason', 'too_soon');
  end if;

  select count(*),
         count(*) filter (where p.chips > my_chips)
    into friend_count, ahead_count
  from public.friendships f join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid();

  if friend_count = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'no_friends');
  end if;

  my_rank := ahead_count + 1;
  if my_rank > 3 then
    return jsonb_build_object('claimed', false, 'reason', 'off_podium');
  end if;

  prize := podium[my_rank];

  update public.profiles set chips = chips + prize, weekly_prize_claimed_at = now(), updated_at = now()
  where id = auth.uid()
  returning chips into balance;

  return jsonb_build_object('claimed', true, 'chips', prize, 'rank', my_rank, 'balance', balance);
end;
$$;
