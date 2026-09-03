-- =============================================================================
-- ROYAL 21 — שלב J — תיקון payload מתנה + פודיום
--
-- הרץ פעם אחת ב-Supabase → SQL Editor. Select All → Paste → Run.
-- הכל idempotent (create or replace) — בטוח להריץ שוב.
--
-- מה זה עושה: send_gift ו-claim_weekly_prize מוסיפים `new_balance` ל-payload של
-- ההודעה — היתרה של המקבל/הזוכה אחרי הזיכוי. אין subscription בזמן אמת על שורת
-- ה-profiles של השחקן עצמו, אז בלי זה הצ'יפים נראים רק אחרי refresh. הקליינט
-- מאמץ את הערך ישירות (setChips) — בלי לזכות דלתא, שהיה גורם לכפילות.
--
-- סדר: (1) gift-limit-50k.sql המעודכן  (2) weekly-podium.sql המעודכן
-- דרישות מוקדמות שכבר רצו: app-config.sql, weekly-snapshot.sql
-- =============================================================================


-- ===== 1/2 — supabase/gift-limit-50k.sql ====================================
-- chip-gift daily limit (default 50,000/day). קורא את `gift_daily_limit` מ-
-- app_config; בלי המפתח נופל ל-50,000.

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
  -- `new_balance` = the recipient's authoritative balance AFTER the credit, so
  -- the client can adopt it directly (no delta add — that would double the
  -- gift once persist() pushed it back). There is no realtime subscription on
  -- the recipient's own profiles row, so the notification carries the figure.
  insert into public.notifications (user_id, kind, actor_id, title, body, payload)
  values (p_to_id, 'gift', auth.uid(), 'gift_received', p_message,
          jsonb_build_object('amount', p_amount, 'new_balance', recip_bal));

  return balance;
end;
$$;


-- ===== 2/2 — supabase/weekly-podium.sql ====================================
-- claim_weekly_prize משלם #1/#2/#3 בין חברים לפי weekly_chip_snapshot הקפוא.

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
    and s.user_id in (
      select friend_id from public.friendships where user_id = auth.uid()
    );

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

  -- `new_balance` lets the client adopt the post-credit figure directly — there
  -- is no realtime subscription on the winner's own profiles row, so without it
  -- the prize only shows after a manual refresh / visibility flip.
  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    auth.uid(), 'podium_prize', 'weekly_podium_won', null,
    jsonb_build_object('amount', prize, 'rank', my_rank, 'week', v_week, 'claimed', true, 'new_balance', balance)
  );

  return jsonb_build_object('claimed', true, 'chips', prize, 'rank', my_rank, 'balance', balance);
end;
$$;

grant execute on function public.claim_weekly_prize() to authenticated;

-- ============================ סוף — הכל רץ ✓ ================================
