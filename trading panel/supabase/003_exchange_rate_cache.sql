-- TradePanel — קאש לשערי חליפין היסטוריים (Frankfurter API), ראה src/lib/exchangeRates.ts.
-- Run once in the Supabase SQL Editor, אחרי 001/002.

create table exchange_rate_cache (
  date date not null,
  from_currency text not null,
  to_currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (date, from_currency, to_currency)
);

alter table exchange_rate_cache enable row level security;

-- דאטה ציבורית לא רגישה (שערי חליפין היסטוריים, לא קשורה ל-account_id) - כל משתמש
-- מאומת (יש לו JWT עם role='authenticated', ראה supabase/functions/_shared/jwt.ts)
-- יכול לקרוא ולכתוב, כדי שהקאש ישותף בין כל הלקוחות ויחסוך קריאות API חוזרות.
create policy "authenticated read exchange rate cache" on exchange_rate_cache
  for select to authenticated using (true);

create policy "authenticated write exchange rate cache" on exchange_rate_cache
  for insert to authenticated with check (true);

create policy "authenticated update exchange rate cache" on exchange_rate_cache
  for update to authenticated using (true) with check (true);
