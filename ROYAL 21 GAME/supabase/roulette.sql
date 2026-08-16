-- =============================================================================
-- ROULETTE — run once in the Supabase SQL editor, after setup.sql.
-- Roulette tables seat up to 5 players; every other room type stays at 4.
-- =============================================================================

-- room_members.seat was capped at 0-3 (4 seats). Widen to fit the largest
-- table in play (poker's 6-max, seats 0-5) — narrower than that would reject
-- valid seat inserts for poker/sng regardless of what this script does below.
alter table public.room_members drop constraint if exists room_members_seat_check;
alter table public.room_members add constraint room_members_seat_check check (seat between 0 and 5);

-- Capacity is per-game: 6 for poker/sng, 5 for roulette, 4 for everything else.
-- (setup.sql hardcoded 4 for every game; poker.sql widened the seat check
-- above but never updated this function, so poker tables were still capped
-- at 4 members even after poker.sql ran. Fixed here since this is the only
-- place that rewrites the function body.)
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
    when room_game = 'roulette' then 5
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

-- =============================================================================
-- SEAT RACE FIX — two simultaneous joins could read the same "next free seat"
-- and both insert it, since nothing in the schema forbade it. NULL seats
-- (spectators, per upgrade.sql) stay unaffected: Postgres treats every NULL
-- as distinct for uniqueness, so this only guards actual seated players.
-- =============================================================================
alter table public.room_members drop constraint if exists room_members_seat_unique;
alter table public.room_members add constraint room_members_seat_unique unique (room_id, seat);
