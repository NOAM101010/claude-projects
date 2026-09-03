-- =============================================================================
-- ROYAL 21 — סבב 2: שלבים J + K + L  (הכל בקובץ אחד)
--
-- הרץ פעם אחת ב-Supabase → SQL Editor. Select All → Paste → Run. Idempotent.
-- דרישות מוקדמות שכבר רצו: app-config.sql, weekly-snapshot.sql, buy-pack.sql.
--
-- מה זה עושה:
--   J1. send_gift — ההודעה נושאת new_balance (מתקן את המתנה שזוכתה פעמיים).
--   J2. claim_weekly_prize — אותו תיקון new_balance בהודעת הפודיום.
--   K.  מוחק את גביע הפודיום ev_weekly_winner.
--   L1. מוחק את 5 מטבעות ה-currencySkin מסבב G (+ ניקוי בעלות/ציוד).
--   L2. seed: קלפים הולוגרפיים + ידית חבילה + 5 ז׳יטונים + חבילת "ערכת שולחן מלכותית".
-- =============================================================================


-- #############################################################################
-- ## J1 — send_gift (payload נושא new_balance)
-- #############################################################################
create or replace function public.send_gift(p_to_id uuid, p_amount bigint, p_message text default null)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  sent_today bigint;
  balance    bigint;
  recip_bal  bigint;
  v_limit    bigint := public.config_num('gift_daily_limit', 50000);
begin
  if p_to_id = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_to_id) then raise exception 'unknown recipient'; end if;
  if p_amount <= 0 or p_amount > v_limit then raise exception 'invalid amount'; end if;

  select coalesce(sum(amount), 0) into sent_today
  from public.chip_gifts
  where from_id = auth.uid() and created_at >= date_trunc('day', now());
  if sent_today + p_amount > v_limit then raise exception 'daily gift limit exceeded'; end if;

  select chips into balance from public.profiles where id = auth.uid() for update;
  if balance < p_amount then raise exception 'insufficient chips'; end if;

  update public.profiles set chips = chips - p_amount, updated_at = now() where id = auth.uid()
  returning chips into balance;
  update public.profiles set chips = chips + p_amount, updated_at = now() where id = p_to_id
  returning chips into recip_bal;

  insert into public.chip_gifts (from_id, to_id, amount, message) values (auth.uid(), p_to_id, p_amount, p_message);
  insert into public.notifications (user_id, kind, actor_id, title, body, payload)
  values (p_to_id, 'gift', auth.uid(), 'gift_received', p_message,
          jsonb_build_object('amount', p_amount, 'new_balance', recip_bal));

  return balance;
end;
$$;


-- #############################################################################
-- ## J2 — claim_weekly_prize (payload נושא new_balance)
-- #############################################################################
alter table public.profiles
  add column if not exists weekly_prize_claimed_week text;

create or replace function public.claim_weekly_prize()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_week      text := to_char(now() - interval '7 days', 'IYYY-"W"IW');
  claimed_wk  text;
  my_chips    bigint;
  snap_count  integer;
  ahead_count integer;
  my_rank     integer;
  prize       bigint;
  balance     bigint;
  podium      bigint[] := public.config_bigint_array('weekly_podium', array[5000, 2500, 1000]);
begin
  select weekly_prize_claimed_week into claimed_wk
  from public.profiles where id = auth.uid() for update;

  if claimed_wk is not null and claimed_wk = v_week then
    return jsonb_build_object('claimed', false, 'reason', 'already');
  end if;

  select count(*) into snap_count
  from public.weekly_chip_snapshot where week_key = v_week;
  if snap_count = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'no_snapshot');
  end if;

  select chips into my_chips
  from public.weekly_chip_snapshot
  where week_key = v_week and user_id = auth.uid();
  if my_chips is null then
    update public.profiles set weekly_prize_claimed_week = v_week where id = auth.uid();
    return jsonb_build_object('claimed', false, 'reason', 'no_snapshot');
  end if;

  select count(*) into ahead_count
  from public.weekly_chip_snapshot s
  where s.week_key = v_week
    and s.chips > my_chips
    and s.user_id in (select friend_id from public.friendships where user_id = auth.uid());

  my_rank := ahead_count + 1;

  if my_rank > 3 then
    update public.profiles set weekly_prize_claimed_week = v_week where id = auth.uid();
    return jsonb_build_object('claimed', false, 'reason', 'off_podium');
  end if;

  prize := podium[my_rank];

  update public.profiles
    set chips = chips + prize,
        weekly_prize_claimed_week = v_week,
        weekly_prize_claimed_at = now(),
        updated_at = now()
  where id = auth.uid()
  returning chips into balance;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    auth.uid(), 'podium_prize', 'weekly_podium_won', null,
    jsonb_build_object('amount', prize, 'rank', my_rank, 'week', v_week, 'claimed', true, 'new_balance', balance)
  );

  return jsonb_build_object('claimed', true, 'chips', prize, 'rank', my_rank, 'balance', balance);
end;
$$;

grant execute on function public.claim_weekly_prize() to authenticated;


-- #############################################################################
-- ## K — הסרת גביע הפודיום
-- #############################################################################
delete from public.achievements where id = 'ev_weekly_winner';


-- #############################################################################
-- ## L1 — הסרת מטבעות ה-currencySkin מסבב G
-- #############################################################################
update public.profiles
set equipped = jsonb_set(equipped, '{currencySkin}', 'null'::jsonb)
where equipped->>'currencySkin' in ('cn-gem','cn-crown','cn-nova','cn-ancient','cn-casino');

delete from public.user_items
where item_id in ('cn_gem','cn_crown_cur','cn_nova','cn_ancient','cn_casino');

delete from public.items
where id in ('cn_gem','cn_crown_cur','cn_nova','cn_ancient','cn_casino');


-- #############################################################################
-- ## L2 — פריטים חדשים + חבילה
-- #############################################################################
insert into public.items (id, category, name, rarity, price, icon, payload, daily_rarity_only, rare_rotation_only) values
  ('cf_holo',            'cards',  '{"he":"קלפים הולוגרפיים","en":"Holographic Cards"}'::jsonb,   'mythic',    60000, '✨', '{"cardFace":"cf-holo"}'::jsonb,               false, true),
  ('bundle_royal_suite', 'tables', '{"he":"ערכת שולחן מלכותית","en":"Royal Table Suite"}'::jsonb, 'legendary', 88000, '👑', '{"bundleHandle":"pack_royal_suite"}'::jsonb,  false, true),
  ('ch_royal',           'chips',  '{"he":"צ׳יפים מלכותיים","en":"Royal Chips"}'::jsonb,          'legendary', 22000, '👑', '{"chipSkin":"ck-royal"}'::jsonb,              false, false),
  ('ch_jade',            'chips',  '{"he":"צ׳יפי אזמרגד","en":"Jade Chips"}'::jsonb,              'epic',       8000, '💚', '{"chipSkin":"ck-jade"}'::jsonb,               false, false),
  ('ch_crimson',         'chips',  '{"he":"צ׳יפים ארגמניים","en":"Crimson Chips"}'::jsonb,        'epic',       8000, '🍷', '{"chipSkin":"ck-crimson"}'::jsonb,            false, false),
  ('ch_frost',           'chips',  '{"he":"צ׳יפי כפור","en":"Frost Chips"}'::jsonb,               'rare',       2000, '❄️', '{"chipSkin":"ck-frost"}'::jsonb,              false, false),
  ('ch_rosegold',        'chips',  '{"he":"צ׳יפי זהב ורוד","en":"Rose Gold Chips"}'::jsonb,       'rare',       2000, '🌹', '{"chipSkin":"ck-rosegold"}'::jsonb,           false, false)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload,
  daily_rarity_only = excluded.daily_rarity_only, rare_rotation_only = excluded.rare_rotation_only;

insert into public.bundles (id, item_ids, discount) values
  ('pack_royal_suite', array['tb_royal','bk_royal','cf_royal','vc_stars'], 0.40)
on conflict (id) do update set
  item_ids = excluded.item_ids, discount = excluded.discount, updated_at = now();

-- ============================ סוף — הכל רץ ✓ ================================
