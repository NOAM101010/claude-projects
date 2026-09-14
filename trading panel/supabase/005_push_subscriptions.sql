-- TradePanel — טבלת מנויי Web Push (תשתית בסיסית - subscribe + שליחת התראת בדיקה ידנית,
-- ראה supabase/functions/send-test-push ו-src/lib/pushApi.ts). אין כאן תזכורות אוטומטיות.
-- Run once in the Supabase SQL Editor, אחרי 001-004.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_account_id_idx on push_subscriptions(account_id);

alter table push_subscriptions enable row level security;

-- בידוד לקוחות: חשבון רואה/יוצר/מוחק רק את המנויים של עצמו (auth.uid() = account_id,
-- ראה supabase/README.md על מודל הזהות "bring your own auth").
create policy "account reads its own push subscriptions" on push_subscriptions
  for select using (account_id = auth.uid());

create policy "account creates its own push subscriptions" on push_subscriptions
  for insert with check (account_id = auth.uid());

create policy "account deletes its own push subscriptions" on push_subscriptions
  for delete using (account_id = auth.uid());
