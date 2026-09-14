-- TradePanel — מאפשר לחשבון למחוק את עצמו (נדרש ל"מחיקת חשבון" ב-UI, src/lib/accountApi.ts).
-- 001_init_schema.sql הגדיר רק policy ל-select על accounts; delete נחסם כברירת מחדל ע"י RLS.
-- ה-cascade על workspaces/trades כבר מוגדר ב-001 (`on delete cascade`) - אין צורך לשנות שם.
-- Run once in the Supabase SQL Editor, אחרי 001/002/003.

create policy "account deletes itself" on accounts
  for delete using (id = auth.uid());
