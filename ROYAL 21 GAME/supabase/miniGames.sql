-- =============================================================================
-- COIN FLIP + HIGH CARD — multiplayer, up to 5 players, same wiring as Roulette.
-- Run once in the Supabase SQL editor, after setup.sql and roulette.sql.
-- =============================================================================

-- room_members.seat is already 0-5 from roulette.sql/poker.sql — nothing to
-- widen there. What's missing is these two games in the per-game capacity
-- table inside enforce_room_capacity(), which still defaults them to 4.
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
declare
  room_game text;
  seat_limit int;
begin
  select game into room_game from public.rooms where id = new.room_id;
  seat_limit := case
    when room_game in ('poker', 'sng') then 6
    when room_game in ('roulette', 'coinflip', 'highcard') then 5
    else 4
  end;
  if (select count(*) from public.room_members where room_id = new.room_id) >= seat_limit then
    raise exception 'room is full';
  end if;
  return new;
end;
$$;

-- Trigger already exists (created in setup.sql) and points at the function
-- above by name, so replacing the function body is enough — no need to
-- re-create the trigger itself.
