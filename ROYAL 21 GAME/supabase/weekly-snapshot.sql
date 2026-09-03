-- =============================================================================
-- WEEKLY CHIP SNAPSHOT — frozen standings for the weekly friends podium
-- Run once in the Supabase SQL editor after setup.sql. Idempotent.
-- Run this BEFORE supabase/weekly-podium.sql.
-- =============================================================================

create table if not exists public.weekly_chip_snapshot (
  week_key    text   not null,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  chips       bigint not null,
  captured_at timestamptz not null default now(),
  primary key (week_key, user_id)
);

alter table public.weekly_chip_snapshot enable row level security;

-- Everyone signed in can read every row — the podium ranks a player against
-- their friends, so the client needs the friends' snapshot chips too.
drop policy if exists weekly_chip_snapshot_select on public.weekly_chip_snapshot;
create policy weekly_chip_snapshot_select on public.weekly_chip_snapshot
  for select to authenticated using (true);

-- Freeze the chip balances of the last completed ISO week. No cron in this
-- project, so every hub load / podium open calls this; the first caller after
-- the week rolls over writes the rows, everyone after is a no-op.
create or replace function public.capture_weekly_snapshot()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_week text := to_char(now() - interval '7 days', 'IYYY-"W"IW');
begin
  if exists (select 1 from public.weekly_chip_snapshot where week_key = v_week) then
    return;
  end if;

  insert into public.weekly_chip_snapshot (week_key, user_id, chips, captured_at)
  select v_week, id, chips, now()
  from public.profiles
  where not is_guest
  on conflict do nothing;
end;
$$;

grant execute on function public.capture_weekly_snapshot() to authenticated;
