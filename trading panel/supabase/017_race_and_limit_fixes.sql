-- 017: שני תיקוני אכיפה שהושארו מפורשות בחוץ ב-016_server_side_limits.sql, כעת נסגרים.
--
-- חלק א' — race condition במגבלת 15 סימבולי watchlist פעילים (010_watchlist.sql):
--   ה-trigger הקיים (enforce_watchlist_limit) הוא count-then-check קלאסי - שתי הכנסות
--   מקבילות לאותו account יכולות שתיהן לקרוא count=14 לפני שאחת מהן מתחייבת (commit),
--   שתיהן עוברות את הבדיקה, ומגיעות ל-16 סימבולים פעילים. התיקון: pg_advisory_xact_lock
--   בתחילת הפונקציה, ממופתח (keyed) על account_id - נועל את כל ה-inserts המקבילים לאותו
--   חשבון לרצף אחד (serialized) עד סוף הטרנזקציה, כך שהספירה תמיד עדכנית ברגע שהיא נבדקת.
--   המנעול הוא per-transaction (xact) - משתחרר אוטומטית ב-commit/rollback, לא דורש ניקוי.
--   hashtext הופך את ה-uuid למספר bigint יציב לצורך מפתח המנעול (pg_advisory_xact_lock
--   מקבל bigint, לא uuid).
--
-- חלק ב' — מגבלת 50 תמונות גרף לכל workspace (CHART_IMAGE_LIMIT ב-chartImagesApi.ts)
--   נאכפה עד כה רק בקליינט (canUploadChartImage) - ניתנת לעקיפה בקריאת REST ישירה.
--   התיקון: trigger על trades (BEFORE INSERT OR UPDATE) שסופר כמה טריידים *אחרים* (id <> new.id)
--   באותו workspace_id כבר עם chart_image_url לא-null, ודוחה אם הספירה כבר >= 50 - בדיוק
--   אותה לוגיקה ואותו scope כמו canUploadChartImage/countWorkspaceChartImages בקליינט
--   (אם לטרייד הזה כבר יש תמונה משלו, זה לא נספר כ"תמונה נוספת" - מתקבל בכל מקרה על
--   ידי exclusion של id <> new.id, בדיוק כמו hasImageOnThisTradeAlready בצד קליינט).
--   אם new.chart_image_url הוא null (הסרת תמונה) - אין צורך בבדיקה כלל, ה-trigger חוזר מיד.

-- --- חלק א': advisory lock סביב בדיקת מגבלת watchlist ---

create or replace function enforce_watchlist_limit() returns trigger as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.account_id::text));

  if (select count(*) from watchlist where account_id = new.account_id and active = true) >= 15 then
    raise exception 'Watchlist limit of 15 active symbols reached';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_watchlist_limit on watchlist;
create trigger trg_enforce_watchlist_limit before insert on watchlist
  for each row execute function enforce_watchlist_limit();

-- --- חלק ב': אכיפת מגבלת 50 תמונות גרף לכל workspace ---

create or replace function enforce_chart_image_limit() returns trigger as $$
declare
  other_images_count int;
begin
  if new.chart_image_url is null then
    return new;
  end if;

  select count(*) into other_images_count
  from trades
  where workspace_id = new.workspace_id
    and chart_image_url is not null
    and id <> new.id;

  if other_images_count >= 50 then
    raise exception 'Chart image limit of 50 reached for this workspace';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_chart_image_limit on trades;
create trigger trg_enforce_chart_image_limit before insert or update on trades
  for each row execute function enforce_chart_image_limit();
