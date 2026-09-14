-- TradePanel — הוספת עמודת setup לטבלת trades (חסרה מ-001, נדרשת לפילוח בדשבורד).
-- Run once in the Supabase SQL Editor, אחרי 001_init_schema.sql.

alter table trades add column if not exists setup text;
