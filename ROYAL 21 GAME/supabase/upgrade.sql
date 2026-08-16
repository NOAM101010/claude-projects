-- =============================================================================
-- ROYAL 21 — upgrade 002: room chat, spectators, onboarding
--
-- Run this AFTER setup.sql, in: Supabase Dashboard -> SQL Editor -> New query.
-- Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE
-- for policies. It never drops a table and never deletes a row.
--
-- Virtual chips only. No real-money balance is introduced here either.
-- =============================================================================

-- =============================================================================
-- 1. ROOM CHAT
--    Persisted rather than broadcast-only, so a player who joins mid-evening
--    can read what they walked in on.
-- =============================================================================
create table if not exists public.room_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_idx
  on public.room_messages (room_id, created_at desc);

alter table public.room_messages enable row level security;

-- You may read a room's chat only if you are in that room.
drop policy if exists room_messages_read on public.room_messages;
create policy room_messages_read on public.room_messages for select
  using (exists (
    select 1 from public.room_members m
    where m.room_id = room_messages.room_id and m.user_id = auth.uid()
  ));

-- You may only ever speak as yourself, and only in a room you have joined.
drop policy if exists room_messages_insert on public.room_messages;
create policy room_messages_insert on public.room_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.room_members m
      where m.room_id = room_messages.room_id and m.user_id = auth.uid()
    )
  );

-- Authors can retract their own line. Nobody can edit one.
drop policy if exists room_messages_delete on public.room_messages;
create policy room_messages_delete on public.room_messages for delete
  using (auth.uid() = user_id);

/*
 * A light brake on flooding: at most 12 messages per player per 10 seconds.
 * Enforced in the database because the client is not trustworthy — a room is
 * only fun until one person can scroll everyone else off the screen.
 */
create or replace function public.room_messages_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    select count(*) from public.room_messages
    where user_id = new.user_id and created_at > now() - interval '10 seconds'
  ) >= 12 then
    raise exception 'slow down';
  end if;
  return new;
end;
$$;

drop trigger if exists room_messages_throttle on public.room_messages;
create trigger room_messages_throttle
before insert on public.room_messages
for each row execute function public.room_messages_rate_limit();

-- =============================================================================
-- 2. SPECTATORS
--    A seat is optional. Someone who arrives mid-hand watches, and is dealt in
--    when the next round opens.
-- =============================================================================
alter table public.room_members
  add column if not exists is_spectator boolean not null default false;

create index if not exists room_members_spectator_idx
  on public.room_members (room_id, is_spectator);

/*
 * The four-seat cap counts players only. Spectators are unlimited, so the
 * capacity trigger from setup.sql has to learn the difference — without this,
 * the fifth person to open the invite link is refused at the door instead of
 * being seated in the gallery.
 */
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_spectator, false) = false
     and (
       select count(*) from public.room_members
       where room_id = new.room_id and coalesce(is_spectator, false) = false
     ) >= 4
  then
    raise exception 'room is full';
  end if;
  return new;
end;
$$;

drop trigger if exists room_capacity on public.room_members;
create trigger room_capacity
before insert on public.room_members
for each row execute function public.enforce_room_capacity();

-- Members may promote themselves out of the gallery when a seat frees up.
drop policy if exists members_update_self on public.room_members;
create policy members_update_self on public.room_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 3. ONBOARDING
--    Remembers that a player has been walked through the room, so the tour
--    does not reintroduce itself on every device.
-- =============================================================================
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- =============================================================================
-- 3b. BACKFILL: accounts created before setup.sql installed the trigger
--
--     handle_new_user() only fires on INSERT into auth.users. Anyone who signed
--     up before setup.sql was run therefore has a login but no `profiles` row,
--     and every RLS policy keyed on `auth.uid() = user_id` refuses their writes:
--     stats and rooms answer 403, and buy_item answers 409 because user_items
--     has no profile to reference. This gives those accounts their row.
-- =============================================================================
insert into public.profiles (id, username, tag, avatar, is_guest)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email, 'Player'), '@', 1)),
  '#' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'),
  coalesce(u.raw_user_meta_data->'avatar', '{"skin":0,"hair":0,"shirt":"base"}'::jsonb),
  u.email is null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.player_stats (user_id)
select p.id from public.profiles p
left join public.player_stats s on s.user_id = p.id
where s.user_id is null
on conflict do nothing;

-- Starter cosmetics for anyone who missed them with the trigger.
insert into public.user_items (user_id, item_id)
select p.id, i.id
from public.profiles p
cross join (values ('cf_classic'),('bk_crimson'),('ch_classic'),('tb_green'),('dl_house')) as i(id)
where exists (select 1 from public.items where items.id = i.id)
on conflict do nothing;

-- =============================================================================
-- 4. REALTIME
--    Chat has to arrive without a refresh.
-- =============================================================================
do $$
declare tbl text;
begin
  foreach tbl in array array['room_messages']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =============================================================================
-- Done. Verify in Table Editor: `room_messages` exists, `room_members` has an
-- `is_spectator` column, and `profiles` has `onboarded_at`.
-- =============================================================================
