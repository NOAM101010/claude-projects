-- 009: allow specific access codes (developer/testing use only) to bypass
-- the 3-device limit enforced in redeem/index.ts. Real customer codes keep
-- the limit as normal - this column defaults to false for everyone.

alter table access_codes add column if not exists unlimited_devices boolean not null default false;
