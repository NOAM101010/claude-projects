-- 007: per-device tracking for access codes, to enforce a max-3-devices limit
-- per purchased code (see redeem/index.ts). Run after 001-006.

alter table access_codes add column if not exists redeemed_devices jsonb not null default '[]'::jsonb;
