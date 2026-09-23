-- TradePanel — RUN-THIS-NEXT.sql
-- 030_notification_direction.sql אושר כבר רץ (שגיאת "already exists" כשניסינו שוב) -
-- נשאר רק 031, שהוא באמת החסר. הרץ פעם אחת ב-Supabase SQL Editor (הפרויקט: osxzjswbasniwmuhwjyc).
-- אין צורך ב-deploy אחרי זה - שני השדות נקראים/נכתבים ישירות מהקליינט.

alter table workspaces
  add column if not exists max_trades_per_day integer null,
  add column if not exists total_portfolio_value numeric null;
