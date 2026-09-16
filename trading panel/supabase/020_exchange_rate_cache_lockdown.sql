-- TradePanel — נעילת exchange_rate_cache: מסירה את יכולת הכתיבה מהלקוח.
-- רקע: 003_exchange_rate_cache.sql יצרה טבלת קאש משותפת (בין-חשבונית, לא נעולה
-- ל-account_id בכוונה - זו דאטה ציבורית לא רגישה: שערי חליפין היסטוריים) עם policies
-- של INSERT/UPDATE פתוחות לכל authenticated (`with_check: true` בלי שום סינון). זה
-- אומר שכל משתמש מאומת - כולל חשבון דמו חינמי, בלי רכישה - יכול לכתוב rate שרירותי
-- (כולל שלילי/מגוחך) לכל date+currency-pair דרך קריאת PostgREST ישירה, מה שיציג מספרי
-- P&L מומרים שגויים לכל משתמש אחר שיציג את אותו date+pair, עד שהשורה נדרסת מחדש
-- באופן טבעי. הקריאה (SELECT) נשארת פתוחה - היא לא רגישה. הכתיבה עוברת מעכשיו רק
-- דרך ה-Edge Function `exchange-rate` (service role, עוקף RLS) - ראה
-- supabase/functions/exchange-rate/index.ts + src/lib/exchangeRates.ts.
-- Run once in the Supabase SQL Editor, אחרי 019.

drop policy "authenticated write exchange rate cache" on exchange_rate_cache;
drop policy "authenticated update exchange rate cache" on exchange_rate_cache;

-- הגנת-עומק: גם אם אי-פעם תיפתח כתיבה מחדש בטעות, שער שלילי/אפס/הזוי לא יכול להישמר.
-- אומת מראש (read-only) שאין אף שורה קיימת שחורגת מהטווח - הקאש הכיל עד כה רק ערכים
-- אמיתיים מ-Frankfurter API, אז ADD CONSTRAINT רגיל בטוח בלי backfill.
alter table exchange_rate_cache
  add constraint exchange_rate_cache_rate_sane check (rate > 0 and rate < 1000000);
