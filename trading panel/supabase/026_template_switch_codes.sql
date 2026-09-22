-- TradePanel — template-switch access codes (robust-munching-puffin.md, round B).
--
-- Adds `kind` on `access_codes` to distinguish two kinds of codes:
--   - 'tier' (default, every existing code keeps this): upgrades an account's tier
--     (Basic/Pro) - the original/only behaviour until now, handled entirely by
--     `redeem/index.ts`. Unchanged.
--   - 'template_switch': a one-time code that unlocks changing a workspace's trading-style
--     template again after the free first pick (only Basic ever needs one - Demo/Pro are
--     always free to switch, see `canSelectTemplateDirectly` in workspacesApi.ts). Handled
--     entirely by the new `switch-template` Edge Function - never touches
--     `accounts.tier`/`redeemed_devices`. Unlike the first draft of this migration,
--     `switch-template` now also performs the actual `workspaces.template` write itself
--     (via the service-role key, in the same request that claims the code) - it is not
--     just a client-side unlock flag. This is required by `027_protect_workspace_template.sql`
--     (run this after that migration, or before - order between 026/027 doesn't matter,
--     only that both are applied): a `BEFORE UPDATE` trigger now blocks a Basic client from
--     writing `workspaces.template` directly once it's already set, so only a service-role
--     write (i.e. only `switch-template`, after verifying the code) can perform that change.
--
-- `tier` becomes nullable: template_switch codes don't upgrade anything, so they carry no
-- tier. The replacement check constraint keeps the two kinds mutually exclusive/consistent.

alter table access_codes
  add column if not exists kind text not null default 'tier' check (kind in ('tier', 'template_switch'));

alter table access_codes
  alter column tier drop not null;

-- ⚠️ BEFORE RUNNING: `access_codes_tier_check` below is Postgres's *default* auto-generated
-- name for the inline `check (tier in ('basic', 'pro'))` constraint from 001_init_schema.sql
-- (`<table>_<column>_check`) - it was never verified against the live database (no direct DB
-- access from this session). If it's wrong, `drop constraint if exists` is a harmless no-op
-- (won't error, won't drop anything) but the `add constraint` right after it will then fail
-- with "constraint already exists" naming a *different* existing constraint - Postgres's own
-- error message will name the real constraint in that case. If that happens: run
-- `select conname from pg_constraint where conrelid = 'access_codes'::regclass and contype = 'c';`
-- (or `\d access_codes` in psql) to find the real name, and substitute it below before re-running.
alter table access_codes
  drop constraint if exists access_codes_tier_check;

alter table access_codes
  add constraint access_codes_tier_check check (
    (kind = 'tier' and tier in ('basic', 'pro')) or
    (kind = 'template_switch' and tier is null)
  );

comment on column access_codes.kind is
  'tier = upgrades accounts.tier (original behaviour, redeem Edge Function). template_switch = one-time unlock+write for workspaces.template, performed by switch-template Edge Function under service_role (see 027_protect_workspace_template.sql). Defaults to tier so every pre-existing code keeps working unchanged.';
