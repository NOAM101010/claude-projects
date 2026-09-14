-- TradePanel — initial schema (accounts / access_codes / workspaces / trades)
-- Run once in the Supabase SQL Editor, in order (001, 002, ...).

create extension if not exists "pgcrypto";

-- accounts: the durable tenant identity. auth.uid() on every request equals
-- this id — the client authenticates with a JWT minted by an Edge Function
-- whose `sub` claim is set to the account's id (see supabase/README.md).
create table accounts (
  id uuid primary key default gen_random_uuid(),
  tier text not null default 'demo' check (tier in ('demo', 'basic', 'pro')),
  created_at timestamptz not null default now()
);

-- access_codes: pre-generated purchase codes (one row per sold code).
-- No client ever queries this table directly — only the redeem Edge
-- Function (service role) touches it, so RLS just denies everything.
create table access_codes (
  code text primary key,
  tier text not null check (tier in ('basic', 'pro')),
  redeemed_by uuid references accounts(id),
  redeemed_at timestamptz
);

-- workspaces: exactly 1 for demo/basic, up to 5 for pro (enforced in app code).
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  style text,
  field_settings jsonb not null default '{}',
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- trades. account_id is denormalized onto the row so RLS can check it
-- directly without a join.
create table trades (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_at timestamptz not null,
  entry_price numeric,
  quantity numeric,
  stop_loss numeric,
  take_profit numeric,
  exit_at timestamptz,
  exit_price numeric,
  currency text not null default 'USD',
  fee numeric,
  pnl numeric,
  notes text,
  chart_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trades_workspace_id_idx on trades (workspace_id);
create index trades_account_id_idx on trades (account_id);

alter table accounts enable row level security;
alter table access_codes enable row level security;
alter table workspaces enable row level security;
alter table trades enable row level security;

create policy "account reads itself" on accounts
  for select using (id = auth.uid());

-- access_codes: no policy granted to anon/authenticated roles at all —
-- only the service-role key (used inside the Edge Function) bypasses RLS.

create policy "own workspaces" on workspaces
  for all using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "own trades" on trades
  for all using (account_id = auth.uid())
  with check (account_id = auth.uid());
