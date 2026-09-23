-- TradePanel — RUN-THIS-NEXT.sql
-- שתי מיגרציות ממתינות (עדיין לא אושר שרצו). הרץ את כל הקובץ פעם אחת ב-Supabase SQL
-- Editor (הפרויקט: osxzjswbasniwmuhwjyc) - שתיהן עצמאיות זו מזו, סדר לא משנה.
--
-- אחרי שזה ירוץ: `supabase functions deploy check-price-alerts` (בשביל 030 - כדי
-- שהתראות חדשות יתחילו לכתוב direction בפועל). 031 לא דורש שום deploy - שני השדות
-- נקראים/נכתבים ישירות מהקליינט.

-- ============================================================
-- 030_notification_direction.sql — אייקון כיוון (מעל/מתחת יעד) בפעמון התראות
-- ============================================================
alter table notifications add column direction text null check (direction in ('above', 'below'));

-- ============================================================
-- 031_day_longterm_template_extras.sql — מגבלת-טריידים-ביום (Day) + משקל-תיק (Long-term)
-- ============================================================
alter table workspaces
  add column if not exists max_trades_per_day integer null,
  add column if not exists total_portfolio_value numeric null;
