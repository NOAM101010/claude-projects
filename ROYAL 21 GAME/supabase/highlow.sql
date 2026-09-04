-- =============================================================================
-- HIGH / LOW SURVIVAL — multiplayer party table, up to 8 players.
-- Run once in the Supabase SQL editor, after setup.sql + roulette.sql + miniGames.sql.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1. room_members.seat was capped at 0-5 (6 seats) by roulette.sql / poker.sql.
--    High / Low seats up to 8, so widen the check to 0-7.
alter table public.room_members drop constraint if exists room_members_seat_check;
alter table public.room_members add constraint room_members_seat_check check (seat between 0 and 7);

-- 2. Per-game capacity: add 'highlow' at 8. Keeps every existing branch intact.
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
    when room_game = 'highlow' then 8
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

-- The `room_capacity` trigger created in setup.sql already points at this
-- function by name, so replacing the body is enough.
