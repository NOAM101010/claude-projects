-- =============================================================================
-- ROYAL 21 — the admin role
--
-- Run AFTER setup.sql and upgrade.sql. Safe to re-run.
--
-- Admin is a server-side fact, never a client one. The app reads `is_admin`
-- off the profile row and draws a badge, but nothing it can do is trusted:
-- every admin power below is a SECURITY DEFINER function that re-checks the
-- caller against this column. Anyone can edit their own localStorage; nobody
-- can edit this table without being the admin already.
--
-- Still virtual chips only. Nothing here creates, buys or withdraws anything
-- of value — an admin's balance is a number in a game.
-- =============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_admin_idx on public.profiles (is_admin) where is_admin;

-- -----------------------------------------------------------------------------
-- Extends protect_chip_column() (setup.sql) now that is_admin exists: the
-- trigger already points at this function by name, so redefining the body is
-- enough. Without this, the widened `profiles_update_self` policy below (any
-- admin may write any row) would combine with the original chips-only trigger
-- to leave is_admin itself settable by a client that had already exploited
-- the old unrestricted-column bug once.
-- -----------------------------------------------------------------------------
create or replace function public.protect_chip_column()
returns trigger
language plpgsql
as $$
begin
  if new.chips is distinct from old.chips and current_user in ('authenticated', 'anon') then
    raise exception 'chips is not directly writable — use a chip RPC (adjust_chips, buy_item, etc.)';
  end if;
  if new.is_admin is distinct from old.is_admin and current_user in ('authenticated', 'anon') then
    raise exception 'is_admin is not directly writable';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Who is an admin. Change or extend this list; it is the only place that says.
-- -----------------------------------------------------------------------------
create or replace function public.admin_emails()
returns text[]
language sql
immutable
as $$ select array['noamshay1010@gmail.com']::text[] $$;

-- Flag the accounts that already exist.
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) = any (select lower(unnest(public.admin_emails())))
  and p.is_admin is distinct from true;

-- -----------------------------------------------------------------------------
-- …and any that sign up later. This replaces the trigger function from
-- setup.sql, keeping everything it did and adding the admin flag.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  starter text;
begin
  insert into public.profiles (id, username, tag, avatar, is_guest, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Player' || floor(random() * 9000 + 1000)::text),
    '#' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'),
    coalesce(new.raw_user_meta_data->'avatar', '{"skin":0,"hair":0,"shirt":"base"}'::jsonb),
    coalesce((new.raw_user_meta_data->>'is_guest')::boolean, new.email is null),
    lower(coalesce(new.email, '')) = any (select lower(unnest(public.admin_emails())))
  )
  on conflict (id) do update set is_admin = excluded.is_admin;

  insert into public.player_stats (user_id) values (new.id) on conflict do nothing;

  foreach starter in array array['cf_classic','bk_crimson','ch_classic','tb_green','dl_house','em_laugh','em_cool','em_angry','em_shake']
  loop
    insert into public.user_items (user_id, item_id)
    select new.id, starter where exists (select 1 from public.items where id = starter)
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- The check every admin power runs first.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- -----------------------------------------------------------------------------
-- Powers
-- -----------------------------------------------------------------------------

-- Set your own balance to anything. Capped at a bigint the UI can still format.
create or replace function public.admin_set_chips(p_chips bigint)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare balance bigint;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  update public.profiles
  set chips = greatest(0, least(p_chips, 999999999)), updated_at = now()
  where id = auth.uid()
  returning chips into balance;
  return balance;
end;
$$;

-- Grant the whole catalogue at once.
create or replace function public.admin_grant_all_items()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare granted integer;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  with inserted as (
    insert into public.user_items (user_id, item_id)
    select auth.uid(), i.id from public.items i
    on conflict do nothing
    returning 1
  )
  select count(*) into granted from inserted;
  return granted;
end;
$$;

-- Set your own level and xp, to see the game the way a veteran sees it.
create or replace function public.admin_set_level(p_level integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare result integer;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  update public.profiles
  set level = greatest(1, least(p_level, 999)), xp = 0, updated_at = now()
  where id = auth.uid()
  returning level into result;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Behind the scenes: one call that answers "what is actually going on".
--
-- This is the view that did not exist while the shop was failing silently —
-- whether the session is real, whether the profile row is writable, how many
-- rooms are live, who is online.
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select jsonb_build_object(
    'players',        (select count(*) from public.profiles),
    'guests',         (select count(*) from public.profiles where is_guest),
    'online',         (select count(*) from public.profiles where presence <> 'offline' and last_seen > now() - interval '5 minutes'),
    'unconfirmed',    (select count(*) from auth.users where email is not null and email_confirmed_at is null),
    'missingProfile', (select count(*) from auth.users u left join public.profiles p on p.id = u.id where p.id is null),
    'rooms',          (select count(*) from public.rooms),
    'liveRooms',      (select count(*) from public.rooms where updated_at > now() - interval '30 minutes'),
    'messages',       (select count(*) from public.room_messages),
    'itemsOwned',     (select count(*) from public.user_items),
    'catalogue',      (select count(*) from public.items),
    'chipsInPlay',    (select coalesce(sum(chips), 0) from public.profiles),
    'handsPlayed',    (select coalesce(sum(bj_hands), 0) from public.player_stats),
    'topPlayers',     (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
                         select username, tag, level, chips, presence
                         from public.profiles order by chips desc limit 8) t)
  ) into result;
  return result;
end;
$$;

-- Recent rooms, so an admin can see and reach a game that is misbehaving.
create or replace function public.admin_recent_rooms(p_limit integer default 12)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select r.code, r.game, r.created_at, r.updated_at,
           p.username as host,
           (select count(*) from public.room_members m where m.room_id = r.id) as members
    from public.rooms r
    left join public.profiles p on p.id = r.host_id
    order by r.updated_at desc
    limit greatest(1, least(p_limit, 50))
  ) t;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admins may read every stats row and settle anything; the existing policies
-- already allow reading profiles, so only the write side needs widening.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- =============================================================================
-- Check it landed.
-- =============================================================================
select u.email, p.username, p.is_admin, p.chips, p.level
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin;
