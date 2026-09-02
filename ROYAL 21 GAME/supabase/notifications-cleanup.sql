-- =============================================================================
-- NOTIFICATIONS HYGIENE — owner-only DELETE + realtime DELETE payloads
-- Run once in the Supabase SQL editor. Idempotent.
--
-- Why: room invites (kind='invite') were never cleaned up when the room closed
-- or the inviter left. There was no DELETE policy at all, so the client could
-- not drop a dead invite. This adds:
--   1. an owner-only DELETE RLS policy
--   2. REPLICA IDENTITY FULL so realtime DELETE events carry `user_id`
--      (needed for the client's `filter: user_id=eq.<id>` on the DELETE stream)
-- =============================================================================

-- Realtime DELETE events only include the primary key unless the row's full
-- old image is published. FULL is cheap here (tiny table, low churn).
alter table public.notifications replica identity full;

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (auth.uid() = user_id);
