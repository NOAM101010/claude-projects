-- TradePanel — drops the dead `workspaces.style` column.
--
-- `style` (trading-style preset: Day Trading/Swing/Long-term/Crypto) was part of an
-- early onboarding-flow design that was never shipped in the real app - since the
-- redesign implementation (see progress.md "createWorkspace" history), the client
-- never selects/sends a style, and no UI reads it. `applyWorkspaceStyle`,
-- `WorkspaceStylePreset`, `WORKSPACE_STYLE_PRESETS`, `WORKSPACE_STYLE_DEFAULTS`, and
-- the `style.*` i18n keys were removed from `src/lib/workspacesApi.ts` in the same
-- round as this migration (grep-confirmed zero remaining references). Safe to drop:
-- no RLS policy, trigger, or Edge Function reads/writes this column.

alter table workspaces drop column if exists style;
