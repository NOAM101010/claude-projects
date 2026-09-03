-- =============================================================================
-- ROYAL 21 — הרץ את הקובץ הזה פעם אחת ב-Supabase → SQL Editor (2026-09-03)
--
-- זו חבילה אחת של 3 קבצים בסדר הנכון:
--   1) app-config.sql   — טבלת app_config + עמלת בנקאי מתכווננת
--   2) playtime.sql     — עמודת playtime_seconds + add_playtime()
--   3) admin-tools.sql  — פונקציות העזרה לשחקן בפאנל האדמין
--
-- הכל idempotent — בטוח להריץ שוב. פשוט: Select All → Paste → Run.
-- =============================================================================


-- #############################################################################
-- ## 1 / 3 — app-config.sql
-- #############################################################################

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.app_config enable row level security;

drop policy if exists "read app_config" on public.app_config;
create policy "read app_config" on public.app_config
  for select using (auth.role() = 'authenticated');

insert into public.app_config (key, value) values
  ('gift_daily_limit',        to_jsonb(50000)),
  ('streak_rewards',          '{"1-3":500,"4-6":1000,"7":5000,"8-13":1500,"14":15000,"15-29":2000,"30":50000,"31+":2500}'::jsonb),
  ('weekly_podium',           '[5000,2500,1000]'::jsonb),
  ('mission_all_done_bonus',  to_jsonb(5000)),
  ('max_mission_reward',      to_jsonb(20000)),
  ('referrer_tiers',          '[3000,7000,15000]'::jsonb),
  ('baccarat_banker_payout',  to_jsonb(0.95))
on conflict (key) do nothing;

create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_elem  jsonb;
  v_field record;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if p_key is null or p_key = '' then raise exception 'key required'; end if;
  if p_value is null then raise exception 'value required'; end if;

  begin
    case p_key
      when 'gift_daily_limit', 'mission_all_done_bonus', 'max_mission_reward' then
        if jsonb_typeof(p_value) <> 'number' or (p_value::text::numeric) < 0 then
          raise exception 'bad';
        end if;

      when 'baccarat_banker_payout' then
        if jsonb_typeof(p_value) <> 'number'
           or (p_value::text::numeric) < 0 or (p_value::text::numeric) > 1 then
          raise exception 'bad';
        end if;

      when 'weekly_podium', 'referrer_tiers' then
        if jsonb_typeof(p_value) <> 'array' then raise exception 'bad'; end if;
        if p_key = 'weekly_podium' and jsonb_array_length(p_value) <> 3 then
          raise exception 'bad';
        end if;
        for v_elem in select * from jsonb_array_elements(p_value) loop
          if jsonb_typeof(v_elem) <> 'number' or (v_elem::text::numeric) < 0 then
            raise exception 'bad';
          end if;
        end loop;

      when 'streak_rewards' then
        if jsonb_typeof(p_value) <> 'object' then raise exception 'bad'; end if;
        for v_field in select value as v from jsonb_each(p_value) loop
          if jsonb_typeof(v_field.v) <> 'number' or (v_field.v::text::numeric) < 0 then
            raise exception 'bad';
          end if;
        end loop;

      else
        raise exception 'unknown config key: %', p_key;
    end case;
  exception
    when others then
      if sqlerrm like 'unknown config key%' then raise; end if;
      raise exception 'invalid value for %', p_key;
  end;

  insert into public.app_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end;
$$;

revoke all on function public.admin_set_config(text, jsonb) from public;
grant execute on function public.admin_set_config(text, jsonb) to authenticated;

create or replace function public.get_app_config()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_config
$$;

grant execute on function public.get_app_config() to authenticated;

create or replace function public.config_num(p_key text, p_fallback bigint)
returns bigint
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'number' then return p_fallback; end if;
  return v::text::bigint;
exception when others then
  return p_fallback;
end;
$$;

create or replace function public.config_num_from_obj(p_key text, p_field text, p_fallback bigint)
returns bigint
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb; f jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'object' then return p_fallback; end if;
  f := v -> p_field;
  if f is null or jsonb_typeof(f) <> 'number' then return p_fallback; end if;
  return f::text::bigint;
exception when others then
  return p_fallback;
end;
$$;

create or replace function public.config_bigint_array(p_key text, p_fallback bigint[])
returns bigint[]
language plpgsql
stable
security definer set search_path = public
as $$
declare v jsonb; v_out bigint[] := '{}'; elem jsonb;
begin
  select value into v from public.app_config where key = p_key;
  if v is null or jsonb_typeof(v) <> 'array' then return p_fallback; end if;
  for elem in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(elem) <> 'number' then return p_fallback; end if;
    v_out := v_out || (elem::text::bigint);
  end loop;
  if array_length(v_out, 1) is null then return p_fallback; end if;
  return v_out;
exception when others then
  return p_fallback;
end;
$$;

grant execute on function public.config_num(text, bigint) to authenticated;
grant execute on function public.config_num_from_obj(text, text, bigint) to authenticated;
grant execute on function public.config_bigint_array(text, bigint[]) to authenticated;


-- #############################################################################
-- ## 2 / 3 — playtime.sql
-- #############################################################################

alter table public.profiles
  add column if not exists playtime_seconds bigint not null default 0;

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


-- #############################################################################
-- ## 3 / 3 — admin-tools.sql
-- #############################################################################

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

-- ============================ סוף — הכל רץ ✓ ================================
