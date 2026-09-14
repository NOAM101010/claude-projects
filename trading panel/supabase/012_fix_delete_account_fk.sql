-- Bug found live: "Delete account" fails silently for any account that ever redeemed an
-- access code. Root cause: access_codes.redeemed_by references accounts(id) with no ON
-- DELETE clause (001_init_schema.sql), which defaults to NO ACTION/RESTRICT - Postgres
-- refuses to delete an account row while an access_codes row still points to it.
--
-- Fix: ON DELETE SET NULL - deleting the account frees the code back up for reuse (it
-- returns to "not yet redeemed", exactly like a fresh unclaimed code) instead of either
-- silently failing (today) or CASCADE-deleting the code row itself (which would destroy
-- a real customer's paid-code record just because they deleted their account - wrong for
-- a real sale, only acceptable for throwaway dev/test codes).
alter table access_codes drop constraint access_codes_redeemed_by_fkey;
alter table access_codes
  add constraint access_codes_redeemed_by_fkey
  foreign key (redeemed_by) references accounts(id) on delete set null;
