-- TradePanel — server-side enforcement of the Basic template-switch lock
-- (robust-munching-puffin.md round B, closes a reviewer-found blocker).
--
-- Problem: `workspaces` RLS ("own workspaces", 001_init_schema.sql) only checks
-- `account_id = auth.uid()` - it has no idea about tier or template state. Before this
-- migration, any authenticated client (e.g. from the browser console) could call
-- `supabase.from('workspaces').update({ template: 'swing' }).eq('id', workspaceId)`
-- directly and bypass the template-switch access-code requirement entirely for a Basic
-- account that already picked a template once. This is the exact same class of bug
-- already fixed for `accounts.tier`/`demo_trades_created` via
-- `protect_account_privileged_columns` (021_account_language.sql) - this migration copies
-- that same trigger pattern (`auth.role() is distinct from 'service_role'`,
-- `pg_trigger_depth() <= 1`) onto `workspaces.template`.
--
-- Rule enforced (matches canSelectTemplateDirectly in src/lib/workspacesApi.ts exactly):
--   - Demo/Pro: never blocked here (the trigger only looks at Basic accounts below).
--   - Basic, first pick (old.template is null): never blocked - stays free for everyone,
--     unchanged, no code needed (TemplatePicker calls setWorkspaceTemplate directly).
--   - Basic, changing an already-set template: blocked unless the request runs as
--     service_role - i.e. only the `switch-template` Edge Function (which verifies a
--     template-switch access code first, see 026_template_switch_codes.sql) can perform
--     this write now. `setWorkspaceTemplate` itself is unchanged (still a plain client
--     update) - it's the trigger, not application code, that closes the gap.

create or replace function protect_workspace_template_column() returns trigger as $$
declare
  v_tier text;
begin
  if new.template is distinct from old.template
     and auth.role() is distinct from 'service_role'
     and pg_trigger_depth() <= 1 then
    select tier into v_tier from accounts where id = new.account_id;
    if v_tier = 'basic' and old.template is not null then
      raise exception 'workspaces.template cannot be changed directly by a Basic client once already set - redeem a template-switch access code instead';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_workspace_template_column on workspaces;
create trigger trg_protect_workspace_template_column
  before update on workspaces
  for each row execute function protect_workspace_template_column();
