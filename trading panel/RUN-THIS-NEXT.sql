-- TradePanel — RUN-THIS-NEXT.sql
-- 024_sl_tp_history.sql כבר רץ בעבר בפרויקט הזה (אושר ע"י שגיאת "already exists" כשניסינו
-- להריץ מחדש) - נשאר רק 029, שהוא באמת חדש. הרץ פעם אחת ב-Supabase SQL Editor
-- (הפרויקט: osxzjswbasniwmuhwjyc).
--
-- אחרי שזה רץ בהצלחה: `supabase functions deploy redeem` (מהתיקייה
-- C:\CLAUDE AI\trading panel) כדי שקוד ה-rate-limiting החדש ייכנס לתוקף בפועל.

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
