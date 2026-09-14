-- 008: tamper-proof demo-trade counter. `trades` has a denormalized
-- `account_id` column directly (see 001_init_schema.sql), so no join through
-- workspaces is needed. The counter only ever increments (insert trigger),
-- so deleting trades never lowers it - a demo user can't game the limit by
-- creating and deleting trades over and over.

alter table accounts add column if not exists demo_trades_created int not null default 0;

create or replace function increment_demo_trades_created() returns trigger as $$
begin
  update accounts set demo_trades_created = demo_trades_created + 1
  where id = new.account_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_increment_demo_trades_created on trades;

create trigger trg_increment_demo_trades_created
  after insert on trades
  for each row execute function increment_demo_trades_created();
