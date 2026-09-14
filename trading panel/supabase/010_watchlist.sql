-- watchlist: מעקב אחר סימבולים עם התראת מחיר (Phase F, ראה vectorized-gliding-perlis.md).
-- מספר 010 (לא 009 - כבר תפוס ע"י 009_unlimited_devices_codes.sql).
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  target_price numeric not null,
  direction text not null check (direction in ('above','below')),
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);
create index watchlist_active_idx on watchlist (active);
alter table watchlist enable row level security;
create policy "account reads own watchlist" on watchlist for select using (account_id = auth.uid());
create policy "account creates own watchlist" on watchlist for insert with check (account_id = auth.uid());
create policy "account updates own watchlist" on watchlist for update using (account_id = auth.uid());
create policy "account deletes own watchlist" on watchlist for delete using (account_id = auth.uid());

-- אוכף את מגבלת 15 הסימבולים הפעילים לחשבון בצד שרת (לא ניתן לעקוף מהקליינט) -
-- security definer כדי שהספירה תעבוד בלי תלות ב-RLS של המבצע.
create or replace function enforce_watchlist_limit() returns trigger as $$
begin
  if (select count(*) from watchlist where account_id = new.account_id and active = true) >= 15 then
    raise exception 'Watchlist limit of 15 active symbols reached';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_watchlist_limit on watchlist;
create trigger trg_enforce_watchlist_limit before insert on watchlist
  for each row execute function enforce_watchlist_limit();
