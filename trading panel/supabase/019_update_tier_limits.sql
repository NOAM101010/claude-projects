-- 019: עדכון מספרי המגבלות מ-018_tier_based_limits.sql, לפי בקשת המשתמש (לא שינוי מבני,
-- רק עדכון הערכים בתוך אותן פונקציות - create or replace, אין צורך לגעת בטריגרים עצמם
-- כי הם כבר קיימים ומצביעים על אותם שמות פונקציה).
--
--   | מגבלה                          | demo | basic | pro |  (לפני, ב-018)
--   |---------------------------------|------|-------|-----|
--   | סימבולי watchlist פעילים         | 2    | 15    | 30  |
--   | התראות מחיר                     | 0    | 10    | 20  |
--
--   | מגבלה                          | demo | basic | pro |  (אחרי, כאן)
--   |---------------------------------|------|-------|-----|
--   | סימבולי watchlist פעילים         | 2    | 20    | 50  |
--   | התראות מחיר                     | 0    | 10    | 30  |
--
-- תמונות גרף (1/50/150) ומגבלת ה-workspaces לא השתנו - לא נגעו כאן בכלל.
-- המספרים העדכניים תואמים בדיוק ל-src/lib/tierLimits.ts (המקור היחיד לאמת בצד קליינט).

create or replace function enforce_watchlist_limit() returns trigger as $$
declare
  account_tier text;
  symbol_limit int;
begin
  perform pg_advisory_xact_lock(hashtext(new.account_id::text));

  select tier into account_tier from accounts where id = new.account_id;
  symbol_limit := case account_tier
    when 'pro' then 50
    when 'basic' then 20
    else 2 -- demo
  end;

  if (select count(*) from watchlist where account_id = new.account_id and active = true) >= symbol_limit then
    raise exception 'Watchlist limit of % active symbols reached', symbol_limit;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_watchlist_limit on watchlist;
create trigger trg_enforce_watchlist_limit before insert on watchlist
  for each row execute function enforce_watchlist_limit();

create or replace function enforce_watchlist_alert_limit() returns trigger as $$
declare
  account_tier text;
  alert_limit int;
  other_alerts_count int;
begin
  if new.target_price is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.target_price is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.account_id::text));

  select tier into account_tier from accounts where id = new.account_id;
  alert_limit := case account_tier
    when 'pro' then 30
    when 'basic' then 10
    else 0 -- demo
  end;

  select count(*) into other_alerts_count
  from watchlist
  where account_id = new.account_id
    and active = true
    and target_price is not null
    and id <> new.id;

  if other_alerts_count >= alert_limit then
    raise exception 'Watchlist alert limit of % reached', alert_limit;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_watchlist_alert_limit on watchlist;
create trigger trg_enforce_watchlist_alert_limit before insert or update on watchlist
  for each row execute function enforce_watchlist_alert_limit();
