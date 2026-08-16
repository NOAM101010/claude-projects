-- =============================================================================
-- ROYAL 21 — Texas Hold'em table
--
-- Run AFTER setup.sql and upgrade.sql. Safe to re-run.
--
-- Poker reuses the exact same multiplayer wiring Blackjack already has —
-- `rooms.state` holds the authoritative hand, `room_actions` carries player
-- intents to the host, `room_messages` is the same table chat. Nothing new
-- to create there. The one thing that needs widening is the seat check: a
-- poker table seats up to 6, and `room_members.seat` was constrained to
-- Blackjack's 4.
-- =============================================================================

alter table public.room_members drop constraint if exists room_members_seat_check;
alter table public.room_members add constraint room_members_seat_check check (seat between 0 and 5);

-- Check it landed.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.room_members'::regclass and conname = 'room_members_seat_check';
