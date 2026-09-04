-- Run after: setup.sql (idempotent — safe to re-run)
--
-- Stage M: generic "pull everyone in" pointer + faster dead-host handoff.
--
-- 1) `rooms.active_game` — a room-level pointer (`{game, code, by}`), separate
--    from the blackjack engine's own `state` column, so ANY room (not just
--    ones shaped like a BjState) can tell its members "everyone go here now".
--    Fixes: opening a Blackjack/Duel room with a friend only navigated the
--    host in — the second player was stuck in the lobby with nothing pulling
--    them into `/blackjack/room/:code`.
--
-- 2) `reassign_room_host` window: 20s -> 15s. A dead host used to freeze a
--    room for up to ~25s before another member could take over; the client
--    poll (`watchHostLiveness`) also tightened 5s -> 2s (roomsService.ts).
--    (15s, not 10s: the host heartbeat runs every 8s — a 10s window left only
--    a ~2s margin, so ordinary jitter could wrongly declare a live host dead.)

alter table public.rooms add column if not exists active_game jsonb;

create or replace function public.reassign_room_host(p_room_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_host uuid := auth.uid();
  last_update timestamptz;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = new_host) then
    raise exception 'not a member of this room';
  end if;
  select updated_at into last_update from public.rooms where id = p_room_id;
  if last_update is null then raise exception 'room not found'; end if;
  if last_update > now() - interval '15 seconds' then
    raise exception 'room is still active';
  end if;
  update public.rooms set host_id = new_host where id = p_room_id;
  update public.room_members set is_host = (user_id = new_host) where room_id = p_room_id;
  return new_host;
end;
$$;
