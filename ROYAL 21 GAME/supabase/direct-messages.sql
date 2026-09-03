-- =============================================================================
-- ROYAL 21 — Direct messages (Stage F): 1:1 friend chat
--
-- Run AFTER setup.sql / upgrade.sql, in Supabase Dashboard -> SQL Editor.
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE for policies.
-- Never drops a table, never deletes a row.
--
-- Virtual chips only — nothing money-related here.
-- =============================================================================

-- --- 1. Table --------------------------------------------------------------
create table if not exists public.direct_messages (
  id           bigserial primary key,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 240),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists direct_messages_thread_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_unread_idx
  on public.direct_messages (recipient_id, read_at);

alter table public.direct_messages enable row level security;
alter table public.direct_messages replica identity full;

-- --- 2. RLS ---------------------------------------------------------------
-- Read: either end of the conversation.
drop policy if exists direct_messages_read on public.direct_messages;
create policy direct_messages_read on public.direct_messages for select
  using (auth.uid() in (sender_id, recipient_id));

-- Insert: only as yourself, only to a confirmed friend, and only if neither
-- side has blocked the other.
drop policy if exists direct_messages_insert on public.direct_messages;
create policy direct_messages_insert on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = recipient_id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked_id = recipient_id)
         or (b.user_id = recipient_id and b.blocked_id = auth.uid())
    )
  );

-- Update: only the recipient, only to stamp read_at.
drop policy if exists direct_messages_mark_read on public.direct_messages;
create policy direct_messages_mark_read on public.direct_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- No delete policy — messages are not retractable.

-- --- 3. Flood brake -----------------------------------------------------
-- At most 15 messages per sender per 60s — mirrors the client rate limiter.
create or replace function public.direct_messages_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    select count(*) from public.direct_messages
    where sender_id = new.sender_id and created_at > now() - interval '60 seconds'
  ) >= 15 then
    raise exception 'slow down';
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_throttle on public.direct_messages;
create trigger direct_messages_throttle
  before insert on public.direct_messages
  for each row execute function public.direct_messages_rate_limit();

-- --- 4. mark_dm_read(p_other) ------------------------------------------
create or replace function public.mark_dm_read(p_other uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.direct_messages
  set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null
$$;

revoke all on function public.mark_dm_read(uuid) from public;
grant execute on function public.mark_dm_read(uuid) to authenticated;

-- --- 5. Realtime -------------------------------------------------------
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.direct_messages';
  exception when duplicate_object then null;
  end;
end $$;

-- ============================ done — verify in Table Editor ================
-- `direct_messages` exists, RLS on, and it is in the supabase_realtime publication.
