-- GOLDEN ACE — leaderboard table.
-- Run once in the Supabase SQL editor for the project whose URL + anon key you
-- put in .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).

create table if not exists public.leaderboard (
  id          text primary key,
  name        text not null,
  level       int  not null default 1,
  chips       bigint not null default 0,
  biggest_win bigint not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

-- Anyone (anon key) may read the board.
create policy "leaderboard read"
  on public.leaderboard for select
  using (true);

-- Anyone may insert their own row and update it (id is client-generated).
-- Tighten this if you add real auth later.
create policy "leaderboard upsert"
  on public.leaderboard for insert
  with check (true);

create policy "leaderboard update"
  on public.leaderboard for update
  using (true)
  with check (true);

create index if not exists leaderboard_chips_idx on public.leaderboard (chips desc);
