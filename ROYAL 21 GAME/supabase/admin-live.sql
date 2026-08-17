-- =============================================================================
-- Live admin console: extra RPCs for real-time monitoring + targeted actions.
-- Safe to re-run: everything is CREATE OR REPLACE.
--
-- Adds:
--   transfer_chips(target_tag, amount)   -- gift chips to a specific player
--   admin_set_user_chips(target_tag,n)   -- set a player's balance exactly
--   admin_active_players(limit)          -- live list: presence, current_game,
--                                           last_seen, chips — for the dashboard
-- =============================================================================

-- --- transfer_chips: add `amount` to the target's balance -------------------
create or replace function public.transfer_chips(target_tag text, amount bigint)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
  target_username text;
  new_balance bigint;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if amount <= 0 then raise exception 'amount must be positive'; end if;

  -- match by tag OR by exact username, since the admin UI accepts either
  select id, username into target_id, target_username
  from public.profiles
  where tag = target_tag or username = target_tag
  limit 1;

  if target_id is null then
    return jsonb_build_object('success', false, 'error', 'user not found');
  end if;

  update public.profiles
     set chips = greatest(0, chips + amount)
   where id = target_id
  returning chips into new_balance;

  return jsonb_build_object(
    'success', true,
    'username', target_username,
    'new_balance', new_balance
  );
end;
$$;

grant execute on function public.transfer_chips(text, bigint) to authenticated;


-- --- admin_set_user_chips: set exact balance for target --------------------
-- Handy when the admin wants "you have exactly X" instead of a delta.
create or replace function public.admin_set_user_chips(target_tag text, p_chips bigint)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
  target_username text;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if p_chips < 0 then raise exception 'chips must be non-negative'; end if;

  select id, username into target_id, target_username
  from public.profiles
  where tag = target_tag or username = target_tag
  limit 1;

  if target_id is null then
    return jsonb_build_object('success', false, 'error', 'user not found');
  end if;

  update public.profiles set chips = p_chips where id = target_id;

  return jsonb_build_object(
    'success', true,
    'username', target_username,
    'new_balance', p_chips
  );
end;
$$;

grant execute on function public.admin_set_user_chips(text, bigint) to authenticated;


-- --- admin_active_players: who's live right now ---------------------------
-- Anyone whose last_seen is inside the last 10 minutes; ordered by activity.
create or replace function public.admin_active_players(p_limit integer default 30)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select
      p.id,
      p.username,
      p.tag,
      p.level,
      p.chips,
      p.presence,
      p.current_game,
      p.last_seen,
      p.is_admin,
      p.is_guest
    from public.profiles p
    where p.last_seen > now() - interval '10 minutes'
       or p.presence <> 'offline'
    order by p.last_seen desc nulls last
    limit greatest(1, least(p_limit, 100))
  ) t;
  return result;
end;
$$;

grant execute on function public.admin_active_players(integer) to authenticated;
