-- TradePanel — RUN-THIS-NEXT.sql
-- 030_notification_direction.sql — הוסף עמודת direction להתראות, כדי שפעמון ההתראות
-- יראה אייקון חץ אמיתי (מעל/מתחת יעד) במקום נקודה גנרית. הרץ פעם אחת ב-Supabase SQL
-- Editor (הפרויקט: osxzjswbasniwmuhwjyc).
--
-- אחרי שזה רץ בהצלחה: `supabase functions deploy check-price-alerts` (מהתיקייה
-- C:\CLAUDE AI\trading panel) כדי שהתראות חדשות יתחילו לכתוב direction בפועל.

alter table notifications add column direction text null check (direction in ('above', 'below'));
