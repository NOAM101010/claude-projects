-- Adds a `template` column on `workspaces` for the trading-style templates feature
-- (Day / Swing / Long-term / Crypto). Default null - existing workspaces are NOT
-- retroactively assigned a template (see robust-munching-puffin.md plan, round A).
-- Round B (separate) will add the access-code "template-switch" mechanism for Basic
-- accounts changing an already-chosen template; this migration only adds storage.

alter table workspaces
  add column if not exists template text;

alter table workspaces
  add constraint workspaces_template_check
  check (template in ('day', 'swing', 'longterm', 'crypto') or template is null);
