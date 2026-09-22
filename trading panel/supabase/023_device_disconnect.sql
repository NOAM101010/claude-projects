-- TradePanel — self-serve "disconnect a device" for access codes.
--
-- Adds `last_device_disconnect_at` on `access_codes`: a timestamp updated every time a
-- device is successfully removed from `redeemed_devices` (see the new `disconnect-device`
-- Edge Function). Used to enforce a 7-day cooldown between disconnects for the same code -
-- without this, a user could disconnect+reconnect repeatedly to launder around the
-- MAX_DEVICES_PER_CODE limit (now 2, see supabase/functions/redeem/index.ts).
--
-- No default/backfill needed: null simply means "never disconnected a device on this code",
-- which the Edge Function treats as "cooldown not active" (allowed).

alter table access_codes
  add column if not exists last_device_disconnect_at timestamptz;

comment on column access_codes.last_device_disconnect_at is
  'Timestamp of the most recent successful device disconnect for this code (via disconnect-device Edge Function). Null = never disconnected. Used to enforce a 7-day cooldown between disconnects.';
