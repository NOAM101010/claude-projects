-- =============================================================================
-- EVENT TROPHIES — achievements catalogue gets tier / trophy / kind columns,
-- and ~10 `kind='event'` rows that are granted the instant they happen
-- (usePlayer.grantEvent) rather than when a stat counter crosses a goal.
--
-- Run once in the Supabase SQL editor. Idempotent.
--
-- claim_achievement() only touches profiles.achievements (a text[]) — it never
-- reads this catalogue — so event trophies pass through it unchanged.
-- =============================================================================

alter table public.achievements add column if not exists tier   text;
alter table public.achievements add column if not exists trophy text;
alter table public.achievements add column if not exists kind   text not null default 'stat';

-- Event trophies carry no stat / goal.
alter table public.achievements alter column stat drop not null;
alter table public.achievements alter column goal drop not null;

-- Backfill kind on existing rows (default already covers new inserts).
update public.achievements set kind = 'stat' where kind is null;

insert into public.achievements (id, name, descr, stat, goal, reward, tier, trophy, kind) values
  ('ev_sng_win',        '{"he":"ניצחון בטורניר","en":"Tournament win"}'::jsonb,        '{"he":"נצח בטורניר Sit & Go","en":"Win a Sit & Go tournament"}'::jsonb,                  null, null, 2500, 'gold',     '🏆', 'event'),
  ('ev_jackpot',        '{"he":"פיצוץ הג׳קפוט","en":"Jackpot!"}'::jsonb,                 '{"he":"זכה בקופת הג׳קפוט המצטברת","en":"Hit a progressive jackpot pool"}'::jsonb,        null, null, 5000, 'platinum', '💰', 'event'),
  ('ev_streak30',       '{"he":"חודש ברצף","en":"A month straight"}'::jsonb,             '{"he":"שמור על רצף כניסה של 30 יום","en":"Keep a 30-day login streak alive"}'::jsonb,     null, null, 5000, 'platinum', '📅', 'event'),
  ('ev_duel_victor',    '{"he":"מנצח הדואל","en":"Duel victor"}'::jsonb,                 '{"he":"נצח בדואל בלאק׳ג׳ק מול חבר","en":"Win a blackjack duel against a friend"}'::jsonb, null, null, 2500, 'gold',     '⚔️', 'event'),
  ('ev_night_champion', '{"he":"אלוף הערב","en":"Night champion"}'::jsonb,               '{"he":"סיים ערב חברה במקום הראשון","en":"Finish a game night in first place"}'::jsonb,   null, null, 2500, 'gold',     '🎉', 'event'),
  ('ev_side_bet_10x',   '{"he":"פי-10 בצד","en":"10x on the side"}'::jsonb,              '{"he":"זכה פי-10 או יותר בהימור צד בבלאק׳ג׳ק","en":"Win 10x or more on a blackjack side bet"}'::jsonb, null, null, 2500, 'gold', '🎯', 'event'),
  ('ev_weekly_winner',  '{"he":"מוביל השבוע","en":"Top of the week"}'::jsonb,            '{"he":"זכה בפרס השבועי של החברים","en":"Claim the weekly friends prize"}'::jsonb,        null, null, 2500, 'gold',     '🏅', 'event'),
  ('ev_first_referral', '{"he":"הבאת חבר","en":"Brought a friend"}'::jsonb,              '{"he":"חבר ראשון הצטרף דרך הקישור שלך","en":"Your first friend joins through your invite link"}'::jsonb, null, null, 2500, 'gold', '🎁', 'event'),
  ('ev_vip',            '{"he":"חבר VIP","en":"VIP member"}'::jsonb,                     '{"he":"הגע למעמד VIP","en":"Reach VIP status"}'::jsonb,                                    null, null, 5000, 'platinum', '👑', 'event'),
  ('ev_royal_flush',    '{"he":"רויאל פלאש חי","en":"Royal, live"}'::jsonb,              '{"he":"צור רויאל פלאש בזמן אמת","en":"Make a royal flush at the table"}'::jsonb,          null, null, 5000, 'platinum', '🃏', 'event')
on conflict (id) do update set
  name = excluded.name, descr = excluded.descr, reward = excluded.reward,
  tier = excluded.tier, trophy = excluded.trophy, kind = excluded.kind;
