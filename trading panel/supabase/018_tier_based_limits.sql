-- 018: הופך שלוש מגבלות שהיו קבועות (flat) לכולם לתלויות-דרגה (demo/basic/pro), בהתאם
-- לטבלאות המספרים ב-src/lib/tierLimits.ts (המקור היחיד לאמת בצד קליינט - המספרים כאן
-- חייבים להיות זהים בדיוק, בלי דריפט):
--
--   | מגבלה                          | demo | basic | pro |
--   |---------------------------------|------|-------|-----|
--   | תמונות גרף (ל-workspace)         | 1    | 50    | 150 |
--   | סימבולי watchlist פעילים         | 2    | 15    | 30  |
--   | התראות מחיר (target_price!=null) | 0    | 10    | 20  |
--
-- `create or replace function` על אותם שמות פונקציה מ-016_server_side_limits.sql/
-- 017_race_and_limit_fixes.sql - מחליף אותן במקום, בלי DROP FUNCTION (הטריגרים הקיימים
-- ממשיכים להצביע על אותה פונקציה עם ה-body החדש). מגבלת ה-workspaces (016) לא נוגעת -
-- כבר הייתה תלוית-דרגה ולא השתנתה במשימה הזו.

-- --- מגבלת סימבולי watchlist פעילים - תלוית-דרגה, עם ה-advisory lock מ-017 נשמר ---

create or replace function enforce_watchlist_limit() returns trigger as $$
declare
  account_tier text;
  symbol_limit int;
begin
  perform pg_advisory_xact_lock(hashtext(new.account_id::text));

  select tier into account_tier from accounts where id = new.account_id;
  symbol_limit := case account_tier
    when 'pro' then 30
    when 'basic' then 15
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

-- --- מגבלת תמונות גרף לכל workspace - תלוית-דרגה (הדרגה נקראת מהחשבון הבעלים של ה-workspace) ---

create or replace function enforce_chart_image_limit() returns trigger as $$
declare
  account_tier text;
  image_limit int;
  other_images_count int;
begin
  if new.chart_image_url is null then
    return new;
  end if;

  select a.tier into account_tier
  from workspaces w
  join accounts a on a.id = w.account_id
  where w.id = new.workspace_id;

  image_limit := case account_tier
    when 'pro' then 150
    when 'basic' then 50
    else 1 -- demo
  end;

  select count(*) into other_images_count
  from trades
  where workspace_id = new.workspace_id
    and chart_image_url is not null
    and id <> new.id;

  if other_images_count >= image_limit then
    raise exception 'Chart image limit of % reached for this workspace', image_limit;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_chart_image_limit on trades;
create trigger trg_enforce_chart_image_limit before insert or update on trades
  for each row execute function enforce_chart_image_limit();

-- --- חדש: מגבלת התראות מחיר (שורות watchlist עם target_price לא-null) - תלוית-דרגה ---
-- דמו=0: אף שורת watchlist עם target_price לא-null לעולם לא מותרת לחשבון דמו - גם
-- INSERT עם יעד מלכתחילה וגם UPDATE שמוסיף יעד לשורת "מעקב בלבד" קיימת (setWatchlistAlert
-- בקליינט) עוברים דרך אותו trigger (BEFORE INSERT OR UPDATE). נועל באותו advisory lock
-- key כמו enforce_watchlist_limit (per account_id) כדי למנוע אותו race condition בדיוק
-- על ספירת ההתראות הפעילות.

create or replace function enforce_watchlist_alert_limit() returns trigger as $$
declare
  account_tier text;
  alert_limit int;
  other_alerts_count int;
begin
  if new.target_price is null then
    return new;
  end if;

  -- UPDATE ששומר את אותו target_price שכבר היה (ולא null) - לא "מוסיף" התראה, אין צורך בבדיקה.
  if tg_op = 'UPDATE' and old.target_price is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.account_id::text));

  select tier into account_tier from accounts where id = new.account_id;
  alert_limit := case account_tier
    when 'pro' then 20
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
