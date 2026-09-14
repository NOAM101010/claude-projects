-- market_data_cache: snapshot עמיד ב-DB של התוצאה המוצלחת האחרונה מ-Edge Functions
-- שקוראות ל-Finnhub (כרגע: market-indices). ה-cache בזיכרון (module-level) שבתוך
-- market-indices/index.ts מתאפס בכל פעם שה-instance של הפונקציה מוחלף (Deno Deploy קר),
-- הרבה יותר מהר מה-TTL המוצהר - וכשזה קורה וגם הקריאה ל-Finnhub נכשלת/rate-limited,
-- ה-UI מציג "unavailable"/"—" במקום הערך התקין האחרון שהיה בידינו. הטבלה הזו היא רשת
-- ביטחון: snapshot אחד לכל key, נדרס בכל הצלחה, נקרא רק כ-fallback כשהקריאה החיה נכשלת.
--
-- אין RLS ציבורי בכוונה: RLS מופעל בלי אף policy, כך שאף אחד עם anon/authenticated key
-- לא יכול לגעת בטבלה הזו בכלל - רק service role (עוקף RLS תמיד) מהעריכה של ה-Edge
-- Functions עצמן, בדיוק כמו שהן כבר עושות מול טבלאות אחרות (ראה check-price-alerts).
create table market_data_cache (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table market_data_cache enable row level security;
