-- Run after: setup.sql
--
-- Perfect Pairs / 21+3 side bets were solo-only: the reducer already computed
-- `seat.sideResults` for any seat (room included), but `claim_blackjack_payout`
-- never read it — a room player's side-bet win would show on screen and then
-- never actually land in their real chip balance. This redefines the RPC to
-- fold `sideResults` into the same settle payout as the main hand.
--
-- Safe to re-run. No new tables/columns — `sideResults` already rides inside
-- `rooms.state` (jsonb), same as `hands`.

create or replace function public.claim_blackjack_payout(p_room_id uuid, p_round integer)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  game_state jsonb;
  seat       jsonb;
  hand       jsonb;
  total_net  bigint := 0;
  side_net   bigint := 0;
  balance    bigint;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'not a member of this room';
  end if;

  if exists (select 1 from public.blackjack_payouts where room_id = p_room_id and round = p_round and user_id = auth.uid()) then
    select chips into balance from public.profiles where id = auth.uid();
    return balance;
  end if;

  select state into game_state from public.rooms where id = p_room_id;
  if game_state is null then raise exception 'no game state'; end if;
  if (game_state->>'phase') <> 'settled' then raise exception 'round not settled'; end if;
  if (game_state->>'round')::int <> p_round then raise exception 'round mismatch'; end if;

  select value into seat
  from jsonb_array_elements(game_state->'seats')
  where value->>'userId' = auth.uid()::text
  limit 1;
  if seat is null then return (select chips from public.profiles where id = auth.uid()); end if;

  for hand in select value from jsonb_array_elements(seat->'hands') loop
    total_net := total_net + coalesce((hand->>'payout')::bigint, 0) - coalesce((hand->>'bet')::bigint, 0);
    insert into public.blackjack_hands (room_id, round, user_id, hand_index, cards, bet, outcome, net)
    values (
      p_room_id, p_round, auth.uid(),
      coalesce((select count(*)::int from public.blackjack_hands where room_id = p_room_id and round = p_round and user_id = auth.uid()), 0),
      hand->'cards', coalesce((hand->>'bet')::bigint, 0),
      coalesce(hand->>'outcome', 'lose'),
      coalesce((hand->>'payout')::bigint, 0) - coalesce((hand->>'bet')::bigint, 0)
    )
    on conflict do nothing;
  end loop;

  -- Perfect Pairs / 21+3, resolved at deal time into `sideResults` (signed:
  -- win +amount*mult, loss -amount). Folded into the same settle payout as
  -- the main hand so a room player's side stake actually moves real chips —
  -- without this the client could compute a win but never get paid it.
  if seat ? 'sideResults' then
    select coalesce(sum((value)::bigint), 0) into side_net
    from jsonb_each_text(seat->'sideResults');
    total_net := total_net + side_net;
  end if;

  insert into public.blackjack_payouts (room_id, round, user_id, net)
  values (p_room_id, p_round, auth.uid(), total_net);

  update public.profiles
     set chips = greatest(0, chips + total_net), updated_at = now()
   where id = auth.uid()
  returning chips into balance;

  return balance;
end;
$$;
