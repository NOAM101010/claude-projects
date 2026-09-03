-- =============================================================================
-- ADMIN TOOLS — player-support powers for the admin panel
-- Run once in the Supabase SQL editor AFTER setup.sql + admin.sql + telemetry.sql
-- (+ app-config.sql + playtime.sql — admin_find_player returns playtime_seconds).
-- Idempotent — everything is create or replace.
--
-- Every function re-checks public.is_admin() before it touches a row, exactly
-- like the powers in admin.sql / admin-live.sql. Virtual chips only.
-- =============================================================================

-- --- admin_find_player(q) — one full row, matched by tag or username -------
create or replace function public.admin_find_player(q text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if q is null or length(trim(q)) = 0 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select
      p.id, p.username, p.tag, p.level, p.xp, p.chips,
      p.presence, p.current_game, p.last_seen, p.is_admin, p.is_guest,
      p.created_at, p.ever_vip, p.daily_streak, p.onboarded_at, p.playtime_seconds,
      (select count(*) from public.user_items ui where ui.user_id = p.id)   as item_count,
      (select count(*) from public.friendships f where f.user_id = p.id)    as friend_count,
      (select count(*) from public.referrals r where r.referrer_id = p.id)  as referral_count
    from public.profiles p
    where p.tag ilike '%' || trim(q) || '%'
       or p.username ilike '%' || trim(q) || '%'
    order by p.last_seen desc nulls last
    limit 12
  ) t;
  return result;
end;
$$;

grant execute on function public.admin_find_player(text) to authenticated;

-- --- admin_reset_player(target_id) — one player back to a fresh start ------
-- Mirrors reset-all.sql for a single row. Refuses to touch an admin.
create or replace function public.admin_reset_player(target_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v_is_admin boolean;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if target_id is null then raise exception 'target required'; end if;

  select is_admin into v_is_admin from public.profiles where id = target_id;
  if v_is_admin is null then raise exception 'unknown player'; end if;
  if v_is_admin then raise exception 'refusing to reset an admin'; end if;

  update public.profiles set
    chips = 5000, xp = 0, level = 1,
    last_milestone_claimed = 0,
    weekly_prize_claimed_at = null,
    weekly_prize_claimed_week = null,
    ever_vip = false,
    achievements = '{}',
    daily_last_claim = null,
    daily_streak = 0,
    mission_claims = '{}'::jsonb,
    referrer_tier = 0,
    equipped = '{"cardFace":"cf-classic","cardBack":"bk-crimson","chipSkin":"ck-classic","table":"tb-green","frame":null,"victory":null,"dealerSkin":"dl-house","coinSkin":"cn-classic","currencySkin":null,"slotsTheme":"sl-classic","roomBackground":"rb-default","roomDecor":[]}'::jsonb,
    favorite_game = null,
    current_game = null,
    updated_at = now()
  where id = target_id;

  delete from public.player_stats where user_id = target_id;
  insert into public.player_stats (user_id) values (target_id) on conflict do nothing;

  delete from public.user_items where user_id = target_id;
  insert into public.user_items (user_id, item_id)
  select target_id, s.item_id
  from (values
    ('cf_classic'),('bk_crimson'),('ch_classic'),('tb_green'),
    ('dl_house'),('em_laugh'),('em_cool'),('em_angry'),('em_shake'),
    ('cn_classic'),('sl_classic'),('rb_default')
  ) as s(item_id)
  where exists (select 1 from public.items i where i.id = s.item_id)
  on conflict do nothing;

  delete from public.user_achievements where user_id = target_id;

  delete from public.friendships    where user_id = target_id or friend_id = target_id;
  delete from public.friend_requests where from_id = target_id or to_id = target_id;
  delete from public.rivalries       where user_id = target_id or friend_id = target_id;
  delete from public.referrals       where referrer_id = target_id or referee_id = target_id;
  delete from public.chip_gifts      where from_id = target_id or to_id = target_id;

  return jsonb_build_object('ok', true, 'id', target_id);
end;
$$;

grant execute on function public.admin_reset_player(uuid) to authenticated;

-- --- admin_grant_item / admin_revoke_item -------------------------------
create or replace function public.admin_grant_item(target_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if not exists (select 1 from public.profiles where id = target_id) then raise exception 'unknown player'; end if;
  if not exists (select 1 from public.items where id = p_item_id) then raise exception 'unknown item'; end if;

  insert into public.user_items (user_id, item_id) values (target_id, p_item_id)
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'item', p_item_id);
end;
$$;

grant execute on function public.admin_grant_item(uuid, text) to authenticated;

create or replace function public.admin_revoke_item(target_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  delete from public.user_items where user_id = target_id and item_id = p_item_id;
  return jsonb_build_object('ok', true, 'item', p_item_id);
end;
$$;

grant execute on function public.admin_revoke_item(uuid, text) to authenticated;

-- --- admin_set_level(target_id, level) — the targeted version -----------
-- The self-only admin_set_level(int) from admin.sql stays as-is; this is the
-- two-arg overload for helping another player.
create or replace function public.admin_set_level(target_id uuid, p_level integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare result integer;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  update public.profiles
  set level = greatest(1, least(p_level, 999)), xp = 0, updated_at = now()
  where id = target_id
  returning level into result;
  if result is null then raise exception 'unknown player'; end if;
  return result;
end;
$$;

grant execute on function public.admin_set_level(uuid, integer) to authenticated;

-- --- bug reports: list + resolve --------------------------------------
create or replace function public.admin_list_bugs()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select b.id, b.description, b.url, b.screen_size, b.user_agent,
           b.created_at, b.resolved_at, b.notes,
           p.username as reporter, p.tag as reporter_tag
    from public.bug_reports b
    left join public.profiles p on p.id = b.user_id
    order by (b.resolved_at is not null), b.created_at desc
    limit 100
  ) t;
  return result;
end;
$$;

grant execute on function public.admin_list_bugs() to authenticated;

create or replace function public.admin_resolve_bug(p_id bigint)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  update public.bug_reports
  set resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

grant execute on function public.admin_resolve_bug(bigint) to authenticated;
