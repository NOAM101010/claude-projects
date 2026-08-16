-- =============================================================================
-- CLEANUP: Remove anonymous test users leftover from multiplayer testing
-- Safe to re-run. Only touches profiles matching test-pattern usernames.
-- Run once in Supabase SQL Editor.
-- =============================================================================

-- Delete profiles first (rooms/room_members cascade from the auth.users delete)
delete from public.profiles
 where username like 'TestUser%'
    or username like 'TestGuest%'
    or username like 'TestHost'
    or username like 'TestPlayer%'
    or username like 'HcPlayer%'
    or username like 'PlayerA'
    or username like 'PlayerB'
    or username like 'PlayerC'
    or username like 'PlayerD'
    or (username ~ '^Player\d{4}$' and is_guest = true);

-- Delete the auth entries for those anonymous users
delete from auth.users
 where is_anonymous = true
   and created_at < now() - interval '1 hour';

-- Delete stale rooms with no members
delete from public.rooms
 where id not in (select room_id from public.room_members)
   and created_at < now() - interval '1 hour';
