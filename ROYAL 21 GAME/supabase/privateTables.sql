-- =============================================================================
-- PRIVATE POKER TABLES — customizable settings per room
-- Run once in Supabase SQL editor after setup.sql + jackpot.sql.
-- =============================================================================
--
-- Adds a `config` jsonb column to rooms so any game can carry a bag of custom
-- settings alongside its state. For a private poker table, config carries:
--
--   {
--     "tableColor": "green" | "red" | "blue" | "gold",
--     "smallBlind": 5, "bigBlind": 10,
--     "maxSeats": 6,
--     "actionSeconds": 20,
--     "passwordHash": "..." | null,
--     "isVip": false
--   }
--
-- Only the host writes config, and only at creation time — no policy needed
-- for updates because clients never patch it after that.
-- =============================================================================

alter table public.rooms
  add column if not exists config jsonb;

create index if not exists rooms_vip_idx on public.rooms ((config->>'isVip')) where config->>'isVip' = 'true';

-- =============================================================================
-- verify_room_password(room_id, password_attempt) — returns true if it matches
-- =============================================================================
create or replace function public.verify_room_password(p_room_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select config->>'passwordHash'
    into v_hash
    from public.rooms
    where id = p_room_id;
  -- No password set = anyone can enter
  if v_hash is null or v_hash = '' then return true; end if;
  -- Trivial hash comparison (client SHA-256'd it); constant-time not needed
  -- because the hash is not a secret — this is virtual-chip party protection,
  -- not banking.
  return v_hash = p_password;
end;
$$;

revoke all on function public.verify_room_password(uuid, text) from public;
grant execute on function public.verify_room_password(uuid, text) to authenticated;
