-- =============================================================================
-- PROGRESSIVE JACKPOT — Slots (777) + Poker (Royal Flush)
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- Two separate pots, one per game. Row is the current pool.
create table if not exists public.jackpots (
  game text primary key check (game in ('slots', 'poker')),
  pool bigint not null default 10000,
  contribution_bp int not null default 100,        -- basis points; 100 = 1%
  seed_amount bigint not null default 10000,       -- reset value after a win
  last_won_at timestamptz,
  last_won_by uuid references auth.users(id) on delete set null,
  last_won_amount bigint default 0,
  updated_at timestamptz not null default now()
);

-- Seed both jackpots on first setup
insert into public.jackpots (game, pool) values
  ('slots', 10000),
  ('poker', 10000)
on conflict (game) do nothing;

alter table public.jackpots enable row level security;

-- Everyone reads (so the banner works for unauthenticated pages too)
drop policy if exists "read jackpots" on public.jackpots;
create policy "read jackpots" on public.jackpots
  for select using (true);
-- Writes only through RPCs below (SECURITY DEFINER); no direct-write policy.

-- History of wins, for a "recent big wins" feed and admin auditing
create table if not exists public.jackpot_wins (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('slots', 'poker')),
  amount bigint not null,
  won_at timestamptz not null default now()
);

create index if not exists jackpot_wins_won_at_idx on public.jackpot_wins (won_at desc);

alter table public.jackpot_wins enable row level security;

drop policy if exists "read jackpot wins" on public.jackpot_wins;
create policy "read jackpot wins" on public.jackpot_wins
  for select using (true);

-- =============================================================================
-- add_to_jackpot(game, bet) — called from client after each qualifying bet
-- =============================================================================
create or replace function public.add_to_jackpot(p_game text, p_bet bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contribution bigint;
  v_new_pool bigint;
begin
  if auth.uid() is null then
    return null;
  end if;
  if p_game not in ('slots', 'poker') then
    return null;
  end if;
  if p_bet <= 0 or p_bet > 1000000 then
    return null;  -- guard against silly numbers
  end if;

  -- Contribution = bet * contribution_bp / 10000
  select (p_bet * contribution_bp / 10000)::bigint
    into v_contribution
    from public.jackpots
    where game = p_game;

  if v_contribution < 1 then v_contribution := 1; end if;

  update public.jackpots
     set pool = pool + v_contribution,
         updated_at = now()
   where game = p_game
   returning pool into v_new_pool;

  return v_new_pool;
end;
$$;

revoke all on function public.add_to_jackpot(text, bigint) from public;
grant execute on function public.add_to_jackpot(text, bigint) to authenticated;

-- =============================================================================
-- claim_jackpot(game) — atomically win the pot and reset to seed
-- =============================================================================
create or replace function public.claim_jackpot(p_game text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount bigint;
  v_seed bigint;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not-signed-in');
  end if;
  if p_game not in ('slots', 'poker') then
    return jsonb_build_object('ok', false, 'reason', 'invalid-game');
  end if;

  -- Atomically read the pool + reset to seed
  update public.jackpots
     set pool = seed_amount,
         last_won_at = now(),
         last_won_by = v_user_id,
         last_won_amount = pool,
         updated_at = now()
   where game = p_game
  returning last_won_amount, seed_amount into v_amount, v_seed;

  if v_amount is null or v_amount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  -- Record the win
  insert into public.jackpot_wins (user_id, game, amount)
    values (v_user_id, p_game, v_amount);

  -- Credit the player's chip balance
  update public.profiles
     set chips = chips + v_amount
   where id = v_user_id;

  return jsonb_build_object('ok', true, 'amount', v_amount, 'new_pool', v_seed);
end;
$$;

revoke all on function public.claim_jackpot(text) from public;
grant execute on function public.claim_jackpot(text) to authenticated;

-- =============================================================================
-- ENABLE REALTIME on the jackpots table so every client sees the pot tick
-- upward as soon as any player contributes.
-- =============================================================================
alter publication supabase_realtime add table public.jackpots;
alter publication supabase_realtime add table public.jackpot_wins;
