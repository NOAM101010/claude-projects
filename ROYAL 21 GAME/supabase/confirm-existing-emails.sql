-- =============================================================================
-- ROYAL 21 — release accounts stuck behind email confirmation
--
-- WHEN YOU NEED THIS
-- Someone signed up with an email address while the project had
-- Authentication -> Providers -> Email -> "Confirm email" switched ON, and
-- never clicked the link in the confirmation mail. Their `auth.users` row
-- exists, so signing up again answers "already registered", but signing in
-- answers "email not confirmed" — the account is real and unreachable.
--
-- Turning "Confirm email" off only changes what happens to NEW sign-ups. It
-- does not release accounts already created, which is what this script is for.
--
-- WHAT IT DOES
-- Marks every existing email address as confirmed. Read that twice before
-- running it: from here on those addresses are trusted without anyone having
-- proved they can receive mail there. That is the right trade for a private
-- game with friends; it is the wrong trade for anything where the address
-- matters. There is a single-address version at the bottom — prefer it.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- =============================================================================

-- ---- Look first: who is actually stuck? -------------------------------------
select id, email, created_at, email_confirmed_at
from auth.users
where email is not null and email_confirmed_at is null
order by created_at desc;

-- ---- One address (preferred) ------------------------------------------------
-- Put your address in and run just this statement.
--
-- update auth.users
-- set email_confirmed_at = now()
-- where email = 'you@example.com' and email_confirmed_at is null;

-- ---- Every address (blunt) --------------------------------------------------
-- Uncomment only if you are the only people with accounts on this project.
--
-- update auth.users
-- set email_confirmed_at = now()
-- where email is not null and email_confirmed_at is null;

-- ---- Repair anyone missing a profile row ------------------------------------
-- The new-user trigger only runs for accounts created after setup.sql was
-- installed. An account without a profiles row authenticates fine and is then
-- refused by every policy keyed on `auth.uid() = user_id` — the shop, chat and
-- stats all fail while the game looks signed in. This backfills them.
insert into public.profiles (id, username, tag, avatar, is_guest)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'username', 'Player' || floor(random() * 9000 + 1000)::text),
  '#' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'),
  coalesce(u.raw_user_meta_data->'avatar', '{"skin":0,"hair":0,"shirt":"base"}'::jsonb),
  u.email is null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.player_stats (user_id)
select id from auth.users
on conflict do nothing;

-- Starter items for anyone who never got them.
insert into public.user_items (user_id, item_id)
select u.id, i.id
from auth.users u
cross join (values ('cf_classic'),('bk_crimson'),('ch_classic'),('tb_green'),('dl_house'),
                   ('em_laugh'),('em_cool'),('em_angry'),('em_shake')) as s(id)
join public.items i on i.id = s.id
on conflict do nothing;
