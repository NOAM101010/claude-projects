-- TradePanel — persists the user's language choice server-side so Edge Functions
-- (check-price-alerts) can build push/in-app notification text in the account's own
-- language instead of always English (progress.md "Known issues": found live, language
-- set to Hebrew, alert text still English). src/i18n/LanguageContext.tsx only ever wrote
-- the choice to localStorage - invisible to any server-side code.
--
-- Column placement: `accounts` (not `workspaces`) - language is a property of the
-- person/tenant, not of an individual workspace (a Pro user can have up to 5
-- workspaces sharing one language), and it must live somewhere the account_id is
-- directly queryable from `watchlist` (which has account_id, not workspace_id) without
-- an extra join through workspaces.
--
-- RLS risk considered: `accounts` already has SELECT ("account reads itself",
-- 001_init_schema.sql) and DELETE ("account deletes itself", 004) policies for the
-- account's own row, but no UPDATE policy - needed now so a user can change their own
-- language from Settings. A *bare* `for update using (id = auth.uid()) with check
-- (id = auth.uid())` policy would be a real security regression: `accounts` also has
-- `tier` (controls paid feature access) and `demo_trades_created` (tamper-proof demo-
-- limit counter, 008_demo_trades_created.sql) - Postgres RLS applies per-row, not
-- per-column, so a bare policy would let any authenticated client self-upgrade to
-- `tier = 'pro'` via a raw PostgREST PATCH, bypassing the redeem-code Edge Function
-- entirely. Both `tier` and `demo_trades_created` are today only ever written by
-- trusted server-side code (`tier`: redeem/demo-start Edge Functions, using the
-- service-role key, which bypasses RLS; `demo_trades_created`: a SECURITY DEFINER
-- trigger on `trades` insert). RLS policies don't gate service-role writes and can't
-- gate triggers at all (triggers always fire), so the fix is a companion BEFORE UPDATE
-- trigger that blocks changes to those two columns unless the request either (a) comes
-- in as `service_role`, or (b) is itself a nested update fired from inside another
-- trigger (`pg_trigger_depth() > 1` - covers the demo-counter trigger's own `update
-- accounts` call, which runs under the *client's* role, not service_role).

alter table accounts add column language text not null default 'en'
  check (language in ('en', 'he', 'es', 'fr'));

create policy "account updates its own language" on accounts
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function protect_account_privileged_columns() returns trigger as $$
begin
  if auth.role() is distinct from 'service_role' and pg_trigger_depth() <= 1 then
    if new.tier is distinct from old.tier then
      raise exception 'accounts.tier cannot be changed directly by a client';
    end if;
    if new.demo_trades_created is distinct from old.demo_trades_created then
      raise exception 'accounts.demo_trades_created cannot be changed directly by a client';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_account_privileged_columns on accounts;
create trigger trg_protect_account_privileged_columns
  before update on accounts
  for each row execute function protect_account_privileged_columns();
