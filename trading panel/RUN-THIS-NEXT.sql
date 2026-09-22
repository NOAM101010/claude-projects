-- TradePanel — RUN-THIS-NEXT.sql
-- 031_day_longterm_template_extras.sql — שני שדות אופציונליים חדשים ל-workspaces:
-- מגבלת-טריידים-ביום (Day) ומשקל-תיק (Long-term). הרץ פעם אחת ב-Supabase SQL Editor
-- (הפרויקט: osxzjswbasniwmuhwjyc). אין צורך בפריסת Edge Function אחרי זה - שני השדות
-- נקראים/נכתבים ישירות מהקליינט (בדיוק כמו daily_risk_budget הקיים).

alter table workspaces
  add column if not exists max_trades_per_day integer null,
  add column if not exists total_portfolio_value numeric null;
