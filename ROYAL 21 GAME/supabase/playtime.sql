-- =============================================================================
-- PLAYTIME — lifetime seconds each player has spent in the game (foreground)
-- Run once in the Supabase SQL editor AFTER setup.sql.
-- Idempotent — safe to re-run.
--
-- The client counts foreground seconds (paused while the tab is hidden) and
-- flushes them every 60s via add_playtime(). The RPC clamps each call to an
-- hour so a tampered client can't inflate the number without end.
-- =============================================================================

alter table public.profiles
  add column if not exists playtime_seconds bigint not null default 0;

-- --- add_playtime(p_seconds) — accumulate onto the caller's own row --------
create or replace function public.add_playtime(p_seconds integer)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_add   integer := greatest(0, least(coalesce(p_seconds, 0), 3600));
  v_total bigint;
begin
  if v_add = 0 then
    select playtime_seconds into v_total from public.profiles where id = auth.uid();
    return coalesce(v_total, 0);
  end if;

  update public.profiles
  set playtime_seconds = playtime_seconds + v_add,
      updated_at = now()
  where id = auth.uid()
  returning playtime_seconds into v_total;

  return coalesce(v_total, 0);
end;
$$;

revoke all on function public.add_playtime(integer) from public;
grant execute on function public.add_playtime(integer) to authenticated;
