-- =============================================================================
-- ROYAL 21 — שלב P — תארים + צבע שם + מילוי קטגוריות
--
-- הרץ פעם אחת ב-Supabase → SQL Editor. Select All → Paste → Run. Idempotent.
-- דרישות מוקדמות שכבר רצו: setup.sql, buy-pack.sql.
--
-- מה זה עושה:
--   1. items.unlocked_by — עמודה חדשה (תארים שנפתחים דרך הישג; הבעלות נגזרת
--      בקליינט מ-profiles.achievements, אין user_items row).
--   2. seed: תארים נקנים (6) + צבעי שם (10) + משקפיים (4) + שעונים (3) +
--      שרשראות (3) + דילרים (2).  התארים שנפתחים דרך הישג לא נזרעים — הם
--      client-only ונגזרים.
--   3. rooms.config — אין DDL. שדות tableSkin / bgSkin מתווספים ל-jsonb הקיים
--      ע"י roomsService.create (סקין השולחן + הרקע של המארח).
-- =============================================================================

-- --- 1. items.unlocked_by ----------------------------------------------------
alter table public.items add column if not exists unlocked_by text;

-- --- 2. seed — פריטי שלב P --------------------------------------------------
insert into public.items (id, category, name, rarity, price, icon, payload, unlocked_by) values
  -- תארים נקנים
  ('ttl_rookie',      'title',     '{"he":"טירון","en":"Rookie"}'::jsonb,                    'common',        0, '🃏', '{"title":"ttl-rookie"}'::jsonb,       null),
  ('ttl_regular',     'title',     '{"he":"האורח הקבוע","en":"The Regular"}'::jsonb,          'rare',       2000, '🪑', '{"title":"ttl-regular"}'::jsonb,      null),
  ('ttl_lucky',       'title',     '{"he":"בר מזל","en":"Lucky Charm"}'::jsonb,               'rare',       2000, '🍀', '{"title":"ttl-lucky"}'::jsonb,        null),
  ('ttl_shark',       'title',     '{"he":"הכריש","en":"The Shark"}'::jsonb,                  'epic',       8000, '🦈', '{"title":"ttl-shark"}'::jsonb,        null),
  ('ttl_allin',       'title',     '{"he":"כל-אין","en":"All-In"}'::jsonb,                    'epic',       8000, '💥', '{"title":"ttl-allin"}'::jsonb,        null),
  ('ttl_highroller',  'title',     '{"he":"מהמר על","en":"High Roller"}'::jsonb,              'legendary', 22000, '💎', '{"title":"ttl-highroller"}'::jsonb,   null),
  ('ttl_legend',      'title',     '{"he":"האגדה","en":"The Legend"}'::jsonb,                 'mythic',    55000, '🌟', '{"title":"ttl-legend"}'::jsonb,       null),
  -- צבעי שם (פלטה קבועה)
  ('nc_gold',         'nameColor', '{"he":"שם זהב","en":"Gold Name"}'::jsonb,                 'epic',       8000, '🟨', '{"nameColor":"#f8e3a8"}'::jsonb,      null),
  ('nc_jade',         'nameColor', '{"he":"שם ירקן","en":"Jade Name"}'::jsonb,                'rare',       2000, '🟩', '{"nameColor":"#4fd39a"}'::jsonb,      null),
  ('nc_crimson',      'nameColor', '{"he":"שם ארגמן","en":"Crimson Name"}'::jsonb,            'rare',       2000, '🟥', '{"nameColor":"#e8807d"}'::jsonb,      null),
  ('nc_sky',          'nameColor', '{"he":"שם תכלת","en":"Sky Name"}'::jsonb,                 'rare',       2000, '🟦', '{"nameColor":"#7cc4f0"}'::jsonb,      null),
  ('nc_violet',       'nameColor', '{"he":"שם סגול","en":"Violet Name"}'::jsonb,              'epic',       8000, '🟪', '{"nameColor":"#b98cff"}'::jsonb,      null),
  ('nc_rosegold',     'nameColor', '{"he":"שם זהב-ורוד","en":"Rose Gold Name"}'::jsonb,       'epic',       8000, '🌷', '{"nameColor":"#f2b6c6"}'::jsonb,      null),
  ('nc_amber',        'nameColor', '{"he":"שם ענבר","en":"Amber Name"}'::jsonb,               'rare',       2000, '🟧', '{"nameColor":"#f0a94a"}'::jsonb,      null),
  ('nc_turquoise',    'nameColor', '{"he":"שם טורקיז","en":"Turquoise Name"}'::jsonb,         'rare',       2000, '🩵', '{"nameColor":"#45d8c8"}'::jsonb,      null),
  ('nc_cream',        'nameColor', '{"he":"שם שמנת","en":"Cream Name"}'::jsonb,               'rare',       2000, '🤍', '{"nameColor":"#efe7d0"}'::jsonb,      null),
  ('nc_neon',         'nameColor', '{"he":"שם ניאון","en":"Neon Name"}'::jsonb,               'epic',       8000, '💚', '{"nameColor":"#5ef2a0"}'::jsonb,      null),
  -- משקפיים
  ('gl_aviator',      'glasses',   '{"he":"אבירייטור","en":"Aviators"}'::jsonb,               'rare',       2000, '🕶️', '{"glasses":"aviator"}'::jsonb,        null),
  ('gl_rimless',      'glasses',   '{"he":"ללא מסגרת","en":"Rimless"}'::jsonb,                'epic',       8000, '👓', '{"glasses":"rimless"}'::jsonb,        null),
  ('gl_visor',        'glasses',   '{"he":"מגן שמש","en":"Sun Visor"}'::jsonb,                'rare',       2000, '🥽', '{"glasses":"visor"}'::jsonb,          null),
  ('gl_led',          'glasses',   '{"he":"משקפי LED","en":"LED Shades"}'::jsonb,             'legendary', 22000, '💡', '{"glasses":"led"}'::jsonb,            null),
  -- שעונים
  ('wt_rose',         'watches',   '{"he":"שעון זהב ורוד","en":"Rose Gold Watch"}'::jsonb,    'epic',       8000, '⌚', '{"watch":"rose"}'::jsonb,             null),
  ('wt_jade',         'watches',   '{"he":"שעון ירקן","en":"Jade Watch"}'::jsonb,             'rare',       2000, '⌚', '{"watch":"jade"}'::jsonb,             null),
  ('wt_onyx',         'watches',   '{"he":"שעון אוניקס","en":"Onyx Watch"}'::jsonb,           'legendary', 22000, '⌚', '{"watch":"onyx"}'::jsonb,             null),
  -- שרשראות
  ('cn_rose',         'chains',    '{"he":"שרשרת זהב ורוד","en":"Rose Gold Chain"}'::jsonb,   'epic',       8000, '📿', '{"chain":"rose"}'::jsonb,             null),
  ('cn_onyx',         'chains',    '{"he":"שרשרת אוניקס","en":"Onyx Chain"}'::jsonb,          'rare',       2000, '🔗', '{"chain":"onyx"}'::jsonb,             null),
  ('cn_diamond',      'chains',    '{"he":"שרשרת יהלום","en":"Diamond Chain"}'::jsonb,        'legendary', 22000, '💠', '{"chain":"diamond"}'::jsonb,          null),
  -- דילרים
  ('dl_jade',         'dealers',   '{"he":"דילר ירקן","en":"Jade Dealer"}'::jsonb,            'epic',       8000, '🟢', '{"dealerSkin":"dl-jade"}'::jsonb,     null),
  ('dl_crimson',      'dealers',   '{"he":"דילר ארגמן","en":"Crimson Dealer"}'::jsonb,        'legendary', 22000, '🍷', '{"dealerSkin":"dl-crimson"}'::jsonb,  null)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload,
  unlocked_by = excluded.unlocked_by;

-- --- 3. backfill: התואר ההתחלתי "טירון" לכל השחקנים הקיימים -----------------
insert into public.user_items (user_id, item_id)
select id, 'ttl_rookie' from public.profiles
on conflict do nothing;

-- ============================ סוף — הכל רץ ✓ ================================
