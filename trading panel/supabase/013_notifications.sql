-- notifications: התראות בתוך האפליקציה (bell/dropdown בהדר) - נפרד לגמרי מ-push
-- (device-level, דרך push_subscriptions/_shared/push.ts). משתמש שכיבה push או שהדפדפן
-- שלו לא תומך בו עדיין צריך לראות שהתראת מחיר נורתה בפעם הבאה שהוא בתוך האפליקציה -
-- זו בדיוק המטרה של הטבלה הזו. מספר 013 (010=watchlist, 011=market_data_cache,
-- 012=fix_delete_account_fk כתובה אך לא הורצה - ראה progress.md).
create table notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- אינדקס לתבנית השאילתה הנפוצה ביותר: "כמה התראות לא-נקראות יש לחשבון הזה" (badge בפעמון).
create index notifications_account_unread_idx on notifications (account_id, read_at);

alter table notifications enable row level security;

-- הקליינט יכול לקרוא ולסמן כ"נקרא" (update על read_at) את ההתראות של עצמו בלבד -
-- אבל לא ליצור שורות: רק check-price-alerts, עם ה-service role (עוקף RLS לגמרי,
-- בדיוק כמו שהיא כבר עושה מול watchlist/push_subscriptions), יוצרת התראה. בשונה
-- מ-market_data_cache (שאין לקליינט שום גישה אליה) - כאן יש select+update כי המשתמש
-- באמת צריך לקרוא ולסמן-כנקרא את ההתראות שלו.
create policy "account reads own notifications" on notifications for select using (account_id = auth.uid());
create policy "account marks own notifications read" on notifications for update using (account_id = auth.uid());
