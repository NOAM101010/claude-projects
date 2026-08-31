-- =============================================================================
-- ROYAL 21 — Poker hole-card privacy
--
-- WHAT THIS DOES
-- `pokerService.publish` writes the full PokerState to `rooms.state`, which is
-- delivered to every client — so every opponent's `hole` cards sit in every
-- client's memory (open devtools = see everyone's cards). This migration adds
-- the server-side storage the fix needs:
--   * poker_hole        — one row per (room, player) with THAT player's real
--                         hole cards; RLS lets a player read only their own row.
--   * poker_hand_secret — the hand's RNG secret (seed/cursor/seats); RLS lets
--                         only the room host read it.
--   * set_poker_private — SECURITY DEFINER RPC the host calls each hand to stash
--                         both, before publishing a redacted `rooms.state`.
--
-- MUST BE RUN ON PRODUCTION (Supabase -> SQL Editor). Run AFTER setup.sql /
-- poker.sql. Idempotent — safe to re-run.
--
-- WITHOUT THIS the game keeps working exactly as today: the client redaction
-- gate is safe-by-default — if `set_poker_private` is missing the host just
-- publishes the full state unchanged (no regression). The redaction only turns
-- on once this migration exists (step 2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Per-player hole cards. Written only by set_poker_private (host, SECURITY
-- DEFINER). A player may read their own row and nothing else.
-- -----------------------------------------------------------------------------
create table if not exists public.poker_hole (
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  hand_number integer not null,
  cards       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Per-room hand RNG secret. Written only by set_poker_private. Readable only by
-- the current room host (so the host can restore engine state on reload).
-- -----------------------------------------------------------------------------
create table if not exists public.poker_hand_secret (
  room_id     uuid primary key references public.rooms(id) on delete cascade,
  hand_number integer not null,
  seed        bigint not null,
  "cursor"    integer not null,
  seats       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.poker_hole        enable row level security;
alter table public.poker_hand_secret enable row level security;

-- Reads only. No insert/update/delete policy — all writes go through the RPC.
drop policy if exists poker_hole_read on public.poker_hole;
create policy poker_hole_read on public.poker_hole for select
  using (user_id = auth.uid());

drop policy if exists poker_hand_secret_read on public.poker_hand_secret;
create policy poker_hand_secret_read on public.poker_hand_secret for select
  using (auth.uid() = (select host_id from public.rooms r where r.id = room_id));

-- -----------------------------------------------------------------------------
-- set_poker_private — the host stashes the hand's private data.
--   p_room    room id
--   p_hand    hand number these deals belong to
--   p_deals   jsonb array: [{ "userId": "<uuid>", "cards": [ <card>, <card> ] }]
--   p_seed    engine RNG seed
--   p_cursor  engine RNG cursor
-- Only the room's current host may call it.
-- -----------------------------------------------------------------------------
create or replace function public.set_poker_private(
  p_room   uuid,
  p_hand   integer,
  p_deals  jsonb,
  p_seed   bigint,
  p_cursor integer
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_deal jsonb;
begin
  if auth.uid() is null
     or auth.uid() <> (select host_id from public.rooms where id = p_room) then
    raise exception 'not host';
  end if;

  insert into public.poker_hand_secret (room_id, hand_number, seed, "cursor", seats, updated_at)
  values (p_room, p_hand, p_seed, p_cursor, coalesce(p_deals, '[]'::jsonb), now())
  on conflict (room_id) do update set
    hand_number = excluded.hand_number,
    seed        = excluded.seed,
    "cursor"    = excluded."cursor",
    seats       = excluded.seats,
    updated_at  = now();

  for v_deal in select * from jsonb_array_elements(coalesce(p_deals, '[]'::jsonb))
  loop
    insert into public.poker_hole (room_id, user_id, hand_number, cards, updated_at)
    values (p_room, (v_deal->>'userId')::uuid, p_hand, v_deal->'cards', now())
    on conflict (room_id, user_id) do update set
      hand_number = excluded.hand_number,
      cards       = excluded.cards,
      updated_at  = now();
  end loop;
end;
$$;

revoke all on function public.set_poker_private(uuid, integer, jsonb, bigint, integer) from public;
grant execute on function public.set_poker_private(uuid, integer, jsonb, bigint, integer) to authenticated;

-- =============================================================================
-- ROYAL 21 — Blackjack shoe / dealer-hole privacy
--
-- Same problem, smaller surface: `blackjackService.publish` writes the full
-- BjState to `rooms.state`, so `seed`/`cursor` (the whole shoe) and the dealer's
-- face-down hole card sit in every client's memory. Player hands are already
-- face-up to the table, so only these need hiding.
--
--   bj_hand_secret — one row per room: the current round's shoe secret + dealer
--                    hole. RLS lets only the room host read it (to rebuild engine
--                    state on reload / host handoff).
--   set_bj_private — SECURITY DEFINER RPC the host calls each publish to stash it
--                    before writing a redacted `rooms.state`.
--
-- Gated safe-by-default: without this migration `set_bj_private` is missing,
-- `bjPrivacyAvailable` latches false, and publish writes the full state unchanged.
-- =============================================================================

create table if not exists public.bj_hand_secret (
  room_id     uuid primary key references public.rooms(id) on delete cascade,
  round       integer not null,
  seed        bigint not null,
  "cursor"    integer not null,
  dealer_hole jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.bj_hand_secret enable row level security;

drop policy if exists bj_hand_secret_read on public.bj_hand_secret;
create policy bj_hand_secret_read on public.bj_hand_secret for select
  using (auth.uid() = (select host_id from public.rooms r where r.id = room_id));

-- set_bj_private — host stashes the round's shoe secret + dealer hole.
--   p_room    room id
--   p_round   round these belong to
--   p_seed    engine RNG seed
--   p_cursor  engine RNG cursor
--   p_hole    dealer's face-down card as jsonb, or null once revealed
create or replace function public.set_bj_private(
  p_room   uuid,
  p_round  integer,
  p_seed   bigint,
  p_cursor integer,
  p_hole   jsonb
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or auth.uid() <> (select host_id from public.rooms where id = p_room) then
    raise exception 'not host';
  end if;

  insert into public.bj_hand_secret (room_id, round, seed, "cursor", dealer_hole, updated_at)
  values (p_room, p_round, p_seed, p_cursor, p_hole, now())
  on conflict (room_id) do update set
    round       = excluded.round,
    seed        = excluded.seed,
    "cursor"    = excluded."cursor",
    dealer_hole = excluded.dealer_hole,
    updated_at  = now();
end;
$$;

revoke all on function public.set_bj_private(uuid, integer, bigint, integer, jsonb) from public;
grant execute on function public.set_bj_private(uuid, integer, bigint, integer, jsonb) to authenticated;
