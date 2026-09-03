-- =============================================================================
-- ROYAL 21 — שלב L — חנות: פריטים חדשים + ניקוי
--
-- הרץ פעם אחת ב-Supabase → SQL Editor. Select All → Paste → Run. Idempotent.
--
-- מה זה עושה:
--   1. מוחק את 5 מטבעות ה-currencySkin שנוספו בסבב G (cn_gem / cn_crown_cur /
--      cn_nova / cn_ancient / cn_casino) — כולל ניקוי בעלות/ציוד של שחקנים.
--   2. seed לקלפים ההולוגרפיים (cf_holo) + 5 ז׳יטונים חדשים.
--   3. seed/עדכון לחבילה pack_royal_suite ("ערכת שולחן מלכותית").
-- =============================================================================

-- --- 1. הסרת מטבעות סבב G ------------------------------------------------------
update public.profiles
set equipped = jsonb_set(equipped, '{currencySkin}', 'null'::jsonb)
where equipped->>'currencySkin' in ('cn-gem','cn-crown','cn-nova','cn-ancient','cn-casino');

delete from public.user_items
where item_id in ('cn_gem','cn_crown_cur','cn_nova','cn_ancient','cn_casino');

delete from public.items
where id in ('cn_gem','cn_crown_cur','cn_nova','cn_ancient','cn_casino');

-- --- 2. פריטים חדשים (פורמט זהה ל-buy-pack.sql) ------------------------------
insert into public.items (id, category, name, rarity, price, icon, payload, daily_rarity_only, rare_rotation_only) values
  ('cf_holo',     'cards', '{"he":"קלפים הולוגרפיים","en":"Holographic Cards"}'::jsonb, 'mythic',    60000, '✨', '{"cardFace":"cf-holo"}'::jsonb,      false, true),
  ('bundle_royal_suite', 'tables', '{"he":"ערכת שולחן מלכותית","en":"Royal Table Suite"}'::jsonb, 'legendary', 88000, '👑', '{"bundleHandle":"pack_royal_suite"}'::jsonb, false, true),
  ('ch_royal',    'chips', '{"he":"צ׳יפים מלכותיים","en":"Royal Chips"}'::jsonb,        'legendary', 22000, '👑', '{"chipSkin":"ck-royal"}'::jsonb,     false, false),
  ('ch_jade',     'chips', '{"he":"צ׳יפי אזמרגד","en":"Jade Chips"}'::jsonb,            'epic',       8000, '💚', '{"chipSkin":"ck-jade"}'::jsonb,      false, false),
  ('ch_crimson',  'chips', '{"he":"צ׳יפים ארגמניים","en":"Crimson Chips"}'::jsonb,      'epic',       8000, '🍷', '{"chipSkin":"ck-crimson"}'::jsonb,   false, false),
  ('ch_frost',    'chips', '{"he":"צ׳יפי כפור","en":"Frost Chips"}'::jsonb,             'rare',       2000, '❄️', '{"chipSkin":"ck-frost"}'::jsonb,     false, false),
  ('ch_rosegold', 'chips', '{"he":"צ׳יפי זהב ורוד","en":"Rose Gold Chips"}'::jsonb,     'rare',       2000, '🌹', '{"chipSkin":"ck-rosegold"}'::jsonb,  false, false)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload,
  daily_rarity_only = excluded.daily_rarity_only, rare_rotation_only = excluded.rare_rotation_only;

-- --- 3. חבילת "ערכת שולחן מלכותית" ------------------------------------------
insert into public.bundles (id, item_ids, discount) values
  ('pack_royal_suite', array['tb_royal','bk_royal','cf_royal','vc_stars'], 0.40)
on conflict (id) do update set
  item_ids = excluded.item_ids, discount = excluded.discount, updated_at = now();

-- ============================ סוף — הכל רץ ✓ ================================
