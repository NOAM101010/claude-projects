-- =============================================================================
-- ROYAL 21 — חבילות חנות (שלב G) + פריטי חנות חדשים
--
-- שלושה דברים בקובץ אחד:
--   1. public.bundles — מקור האמת לתוכן/הנחת כל חבילה. הקליינט לא שולח יותר
--      item_ids/discount ל-buy_pack (אפשר היה לזייף 60% הנחה על כל פריט יקר).
--   2. buy_pack(p_pack_id) — RPC אטומי שקורא את החבילה מ-bundles, מתמחר בשרת,
--      וגובה סוף-סוף את הנחת החבילה (הלולאה הישנה קנתה פריט-פריט במחיר מלא).
--   3. seed לפריטים החדשים + עמודות דגל ל-items.
--
-- הכל idempotent — בטוח להריץ שוב. Select All → Paste → Run.
-- =============================================================================

-- --- 1. items — עמודות דגל (client-side display, נשמר גם ב-DB לעקביות) ------
alter table public.items add column if not exists daily_rarity_only  boolean not null default false;
alter table public.items add column if not exists rare_rotation_only boolean not null default false;

-- --- 2. bundles — קטלוג החבילות (מקור האמת לשחקן מחובר) --------------------
-- חייב להישאר מסונכרן עם PACKS ב-src/data/shopOffers.ts.
create table if not exists public.bundles (
  id        text primary key,
  item_ids  text[] not null,
  discount  numeric not null check (discount >= 0 and discount <= 0.6),
  updated_at timestamptz not null default now()
);

alter table public.bundles enable row level security;

drop policy if exists bundles_read on public.bundles;
create policy bundles_read on public.bundles for select to authenticated using (true);

grant select on public.bundles to authenticated;

insert into public.bundles (id, item_ids, discount) values
  ('pack_starter',     array['cf_noir','ch_gold','tb_noir'],                 0.35),
  ('pack_style',       array['cl_gold','wt_gold','cn_gold'],                 0.30),
  ('pack_luxury',      array['cf_gold','ch_ivory','tb_gold','cl_royal'],     0.40),
  ('pack_royal_table', array['tb_royal','cf_royal','bk_royal'],              0.35),
  ('pack_jade',        array['tb_jade','cf_jade','fr_jade'],                 0.30),
  ('pack_celebration', array['vc_fireworks','vc_stars','fr_rose'],           0.25)
on conflict (id) do update set
  item_ids = excluded.item_ids, discount = excluded.discount, updated_at = now();

-- --- 3. buy_pack(pack_id) -------------------------------------------------
-- SECURITY DEFINER: עוקף את הטריגר protect_chip_column בדיוק כמו buy_item().
-- כל הקלט חוץ מ-p_pack_id נקרא מ-bundles/items בשרת. המחיר מחושב מחדש,
-- ורק פריטים שעוד לא בבעלות נגבים. הנחת החבילה מחליפה את הנחת ה-VIP (לא מצטברת).
drop function if exists public.buy_pack(text, text[], numeric);

create or replace function public.buy_pack(p_pack_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_item_ids text[];
  v_discount numeric;
  v_full     bigint;
  v_price    bigint;
  v_balance  bigint;
  v_granted  int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select item_ids, discount into v_item_ids, v_discount
  from public.bundles where id = p_pack_id;
  if v_item_ids is null then raise exception 'unknown pack'; end if;

  -- discount כבר מוגבל 0..0.6 ע"י ה-check על הטבלה; clamp דפנסיבי נוסף
  v_discount := least(0.6, greatest(0, coalesce(v_discount, 0)));

  -- מחיר = סכום הפריטים שעוד לא בבעלות, אחרי הנחה, מעוגל כלפי מטה
  select coalesce(sum(i.price), 0) into v_full
  from public.items i
  where i.id = any(v_item_ids)
    and not exists (
      select 1 from public.user_items u
      where u.user_id = auth.uid() and u.item_id = i.id
    );

  v_price := floor(v_full * (1 - v_discount));

  select chips into v_balance from public.profiles where id = auth.uid() for update;
  if v_balance < v_price then raise exception 'insufficient chips'; end if;

  if v_price > 0 then
    update public.profiles set chips = chips - v_price, updated_at = now()
    where id = auth.uid()
    returning chips into v_balance;
  end if;

  with ins as (
    insert into public.user_items (user_id, item_id)
    select auth.uid(), i.id
    from public.items i
    where i.id = any(v_item_ids)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_granted from ins;

  return jsonb_build_object('ok', true, 'spent', v_price, 'granted', v_granted, 'chips', v_balance);
end;
$$;

revoke all on function public.buy_pack(text) from public;
grant execute on function public.buy_pack(text) to authenticated;

-- --- 4. פריטי חנות חדשים (שלב G) ----------------------------------------
insert into public.items (id, category, name, rarity, price, icon, payload, daily_rarity_only, rare_rotation_only) values
  ('cf_royal',      'cards',   '{"he":"קלפים מלכותיים","en":"Royal Cards"}'::jsonb,   'legendary', 22000, '♛',  '{"cardFace":"cf-royal"}'::jsonb,        false, false),
  ('cf_jade',       'cards',   '{"he":"קלפי אזמרגד","en":"Jade Cards"}'::jsonb,       'epic',       8000, '💚', '{"cardFace":"cf-jade"}'::jsonb,         false, false),
  ('cf_blush',      'cards',   '{"he":"קלפי ורד","en":"Blush Cards"}'::jsonb,         'rare',       2000, '🌹', '{"cardFace":"cf-blush"}'::jsonb,        false, false),
  ('bk_royal',      'backs',   '{"he":"גב מלכותי","en":"Royal Back"}'::jsonb,         'legendary', 22000, '♛',  '{"cardBack":"bk-royal"}'::jsonb,        false, false),
  ('bk_jade',       'backs',   '{"he":"גב אזמרגד","en":"Jade Back"}'::jsonb,          'epic',       8000, '💚', '{"cardBack":"bk-jade"}'::jsonb,         false, false),
  ('bk_wave',       'backs',   '{"he":"גב גלים","en":"Wave Back"}'::jsonb,            'rare',       2000, '🌊', '{"cardBack":"bk-wave"}'::jsonb,         false, false),
  ('tb_royal',      'tables',  '{"he":"קטיפה מלכותית","en":"Royal Velvet"}'::jsonb,   'legendary', 22000, '👑', '{"table":"tb-royal"}'::jsonb,           false, false),
  ('tb_jade',       'tables',  '{"he":"לבד אזמרגד","en":"Jade Felt"}'::jsonb,         'epic',       8000, '💚', '{"table":"tb-jade"}'::jsonb,            false, false),
  ('fr_royal',      'frames',  '{"he":"מסגרת מלכותית","en":"Royal Frame"}'::jsonb,    'legendary', 22000, '👑', '{"frame":"fr-royal"}'::jsonb,           false, false),
  ('fr_jade',       'frames',  '{"he":"מסגרת אזמרגד","en":"Jade Frame"}'::jsonb,      'epic',       8000, '💠', '{"frame":"fr-jade"}'::jsonb,            false, false),
  ('fr_rose',       'frames',  '{"he":"מסגרת ורד","en":"Rose Frame"}'::jsonb,         'rare',       2000, '🌹', '{"frame":"fr-rose"}'::jsonb,            false, false),
  ('vc_fireworks',  'victory', '{"he":"זיקוקים","en":"Fireworks"}'::jsonb,            'epic',       8000, '🎆', '{"victory":"vc-fireworks"}'::jsonb,     false, false),
  ('vc_stars',      'victory', '{"he":"מטר כוכבים","en":"Star Shower"}'::jsonb,       'legendary', 22000, '🌟', '{"victory":"vc-stars"}'::jsonb,         false, false),
  ('cn_gem',        'coins',   '{"he":"מטבע יהלום","en":"Gem Coin"}'::jsonb,          'legendary', 30000, '💎', '{"currencySkin":"cn-gem"}'::jsonb,      false, true),
  ('cn_crown_cur',  'coins',   '{"he":"מטבע כתר","en":"Crown Coin"}'::jsonb,          'mythic',    75000, '👑', '{"currencySkin":"cn-crown"}'::jsonb,    false, true),
  ('cn_nova',       'coins',   '{"he":"מטבע נובה","en":"Nova Coin"}'::jsonb,          'mythic',    75000, '✦',  '{"currencySkin":"cn-nova"}'::jsonb,     false, true),
  ('cn_ancient',    'coins',   '{"he":"מטבע עתיק","en":"Ancient Coin"}'::jsonb,       'legendary', 30000, '⚜',  '{"currencySkin":"cn-ancient"}'::jsonb,  true,  false),
  ('cn_casino',     'coins',   '{"he":"ז׳יטון קזינו","en":"Casino Token"}'::jsonb,    'epic',       8000, '♠',  '{"currencySkin":"cn-casino"}'::jsonb,   true,  false)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload,
  daily_rarity_only = excluded.daily_rarity_only, rare_rotation_only = excluded.rare_rotation_only;

-- ============================ סוף — הכל רץ ✓ ================================
