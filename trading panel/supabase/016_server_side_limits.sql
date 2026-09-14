-- 016: אכיפת שרת (DB-level) למגבלות שהיום נאכפות רק בקוד React - ניתנות לעקיפה
-- בקריאת REST ישירה ל-Supabase עם JWT תקף. שלוש מגבלות קיימות (לא חדשות - רק
-- מעבירות את האכיפה גם ל-DB, אותם מספרים בדיוק כמו בקוד הקליינט):
--   - דמו: עד 5 טריידים (DEMO_TRADE_LIMIT ב-accountApi.ts) - נשען על אותו מונה
--     tamper-proof demo_trades_created מ-008_demo_trades_created.sql.
--   - workspaces: דרגות שאינן Pro נעולות ל-1 בלבד (אין להן כפתור יצירה, ensureWorkspace
--     יוצר את הראשון), Pro עד MAX_PRO_WORKSPACES=5 (workspacesApi.ts).
--   - CHECK constraints על שדות מספריים ב-trades/watchlist, כדי ש-insert/update ישיר
--     דרך ה-REST API לא יוכל לשמור נתונים חסרי-משמעות (כמות שלילית, מחיר שלילי וכו').
--     המחירים תמיד חיוביים בשני הכיוונים (long/short) - כיוון הפוזיציה נשמר בעמודה
--     נפרדת (direction) והמתמטיקה של הרווח/הפסד מתחשבת בו ב-computePnl (stats.ts),
--     לא בסימן המחיר עצמו.
--
-- מגבלת תמונות גרף (CHART_IMAGE_LIMIT=50, chartImagesApi.ts) **לא** נאכפת כאן - היא
-- נספרת מעמודת trades.chart_image_url (לא מ-Storage ישירות), ומוגבלת ל-workspace לא
-- ל-account, כך שאין דרך נקייה לאכוף אותה כ-Storage policy (ל-storage.objects אין
-- עמודת workspace_id בכלל - רק path תחת תיקיית account_id, ראה 006_chart_images_storage.sql).
-- אפשרות "נקייה" תדרוש denormalization של workspace_id לתוך ה-path או טבלת מעקב נפרדת
-- לכל object שהועלה - שינוי פולשני יותר ממה שמוצדק כאן. מסומן כמגבלה ידועה.

-- --- דמו: עד 5 טריידים לחשבון (מבוסס על accounts.demo_trades_created הקיים) ---

create or replace function enforce_demo_trade_limit() returns trigger as $$
declare
  account_tier text;
  trades_created int;
begin
  select tier, demo_trades_created into account_tier, trades_created
  from accounts where id = new.account_id;

  if account_tier = 'demo' and trades_created >= 5 then
    raise exception 'Demo trade limit of 5 reached - upgrade required';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_demo_trade_limit on trades;
create trigger trg_enforce_demo_trade_limit before insert on trades
  for each row execute function enforce_demo_trade_limit();

-- --- workspaces: 1 לדרגות שאינן Pro, עד 5 ל-Pro ---

create or replace function enforce_workspace_limit() returns trigger as $$
declare
  account_tier text;
  workspace_count int;
begin
  select tier into account_tier from accounts where id = new.account_id;
  select count(*) into workspace_count from workspaces where account_id = new.account_id;

  if account_tier = 'pro' then
    if workspace_count >= 5 then
      raise exception 'Workspace limit of 5 reached for Pro tier';
    end if;
  else
    if workspace_count >= 1 then
      raise exception 'Creating another workspace requires a Pro upgrade';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_workspace_limit on workspaces;
create trigger trg_enforce_workspace_limit before insert on workspaces
  for each row execute function enforce_workspace_limit();

-- --- CHECK constraints: שדות מספריים ב-trades/watchlist ---
-- כל השדות האלה נאלביים בסכמה הקיימת (001_init_schema.sql) - ה-constraint מאפשר
-- NULL במפורש (NULL IN/NULL >= ... מוערך ל-NULL, לא false, אז constraint היה עובר גם
-- בלי ה-"IS NULL OR" - אבל כתוב מפורש לקריאות, כמו התיעוד ב-014_watchlist_optional_alert.sql).

alter table trades add constraint trades_quantity_positive
  check (quantity is null or quantity > 0);

alter table trades add constraint trades_entry_price_nonnegative
  check (entry_price is null or entry_price >= 0);

alter table trades add constraint trades_exit_price_nonnegative
  check (exit_price is null or exit_price >= 0);

alter table trades add constraint trades_stop_loss_nonnegative
  check (stop_loss is null or stop_loss >= 0);

alter table trades add constraint trades_take_profit_nonnegative
  check (take_profit is null or take_profit >= 0);

alter table trades add constraint trades_fee_nonnegative
  check (fee is null or fee >= 0);

alter table watchlist add constraint watchlist_target_price_positive
  check (target_price is null or target_price > 0);
