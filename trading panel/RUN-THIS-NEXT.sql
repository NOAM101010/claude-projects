-- TradePanel — RUN-THIS-NEXT.sql
-- כל המיגרציות הממתינות הרצה, בסדר הנכון. הרץ פעם אחת ב-Supabase SQL Editor
-- (הפרויקט: osxzjswbasniwmuhwjyc), מלמעלה למטה. שתי המיגרציות עצמאיות זו מזו,
-- אפשר להריץ את כל הקובץ בבת אחת.
--
-- אחרי שהרצת את זה: תעשה גם `supabase functions deploy redeem` (מהתיקייה
-- C:\CLAUDE AI\trading panel) כדי שקוד ה-rate-limiting החדש ייכנס לתוקף בפועל.

-- ============================================================
-- 024_sl_tp_history.sql — היסטוריית שינויי Stop Loss / Take Profit
-- ============================================================
create table trade_sl_tp_history (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  field text not null check (field in ('stop_loss', 'take_profit')),
  old_value numeric,
  new_value numeric,
  changed_at timestamptz not null default now()
);

create index trade_sl_tp_history_trade_id_idx on trade_sl_tp_history (trade_id);

alter table trade_sl_tp_history enable row level security;

create policy "account reads own trades sl/tp history" on trade_sl_tp_history
  for select using (
    exists (select 1 from trades where trades.id = trade_sl_tp_history.trade_id and trades.account_id = auth.uid())
  );

create policy "account inserts own trades sl/tp history" on trade_sl_tp_history
  for insert with check (
    exists (select 1 from trades where trades.id = trade_sl_tp_history.trade_id and trades.account_id = auth.uid())
  );

-- ============================================================
-- 029_redeem_rate_limit.sql — rate limiting על redeem Edge Function
-- ============================================================
create table redeem_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

alter table redeem_attempts enable row level security;
-- אין policies ל-anon/authenticated בכלל - נקרא/נכתב אך ורק דרך service role בתוך redeem/index.ts.

create index redeem_attempts_device_id_attempted_at_idx
  on redeem_attempts (device_id, attempted_at);
