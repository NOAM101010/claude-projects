-- =============================================================================
-- ROYAL 21 — full database setup
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
--
-- Virtual chips only. No real-money balances, deposits or withdrawals exist
-- anywhere in this schema by design.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null default 'Player',
  tag          text not null default '#0000',
  avatar       jsonb not null default '{"skin":0,"hair":0,"shirt":"base"}'::jsonb,
  chips        bigint not null default 5000 check (chips >= 0),
  xp           integer not null default 0 check (xp >= 0),
  level        integer not null default 1 check (level >= 1),
  last_milestone_claimed integer not null default 0,
  weekly_prize_claimed_at timestamptz,
  equipped     jsonb not null default '{"cardFace":"cf-classic","cardBack":"bk-crimson","chipSkin":"ck-classic","table":"tb-green","frame":null,"victory":null,"dealerSkin":"dl-house"}'::jsonb,
  presence     text not null default 'offline',
  current_game text,
  favorite_game text,
  is_guest     boolean not null default false,
  is_admin     boolean not null default false,
  last_seen    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists last_milestone_claimed integer not null default 0;
alter table public.profiles add column if not exists weekly_prize_claimed_at timestamptz;
alter table public.profiles add column if not exists is_admin boolean not null default false;

create index if not exists profiles_username_idx on public.profiles (lower(username));
create index if not exists profiles_tag_idx on public.profiles (tag);
create index if not exists profiles_chips_idx on public.profiles (chips desc);
create index if not exists profiles_level_idx on public.profiles (level desc);

-- =============================================================================
-- 2. STATS
-- =============================================================================
create table if not exists public.player_stats (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  games            integer not null default 0,
  wins             integer not null default 0,
  losses           integer not null default 0,
  pushes           integer not null default 0,
  chips_won        bigint  not null default 0,
  biggest_bet      bigint  not null default 0,
  biggest_win      bigint  not null default 0,
  streak           integer not null default 0,
  best_streak      integer not null default 0,
  bj_hands         integer not null default 0,
  bj_wins          integer not null default 0,
  bj_losses        integer not null default 0,
  blackjacks       integer not null default 0,
  double_wins      integer not null default 0,
  split_wins       integer not null default 0,
  bet_total        bigint  not null default 0,
  bet_count        integer not null default 0,
  cf_games         integer not null default 0,
  cf_wins          integer not null default 0,
  cf_loss_streak   integer not null default 0,
  sl_spins         integer not null default 0,
  sl_wins          integer not null default 0,
  sc_cards         integer not null default 0,
  dice_games       integer not null default 0,
  hc_games         integer not null default 0,
  double_or_nothing integer not null default 0,
  updated_at       timestamptz not null default now()
);

-- =============================================================================
-- 3. SOCIAL: friendships, requests, blocks, rivalries
-- =============================================================================
create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint no_self_friend check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships (friend_id);

create table if not exists public.friend_requests (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  constraint no_self_request check (from_id <> to_id)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_id, status);

create table if not exists public.blocks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);

create table if not exists public.rivalries (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  friend_id   uuid not null references public.profiles(id) on delete cascade,
  games       integer not null default 0,
  my_wins     integer not null default 0,
  their_wins  integer not null default 0,
  by_game     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create table if not exists public.chip_gifts (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  amount     bigint not null check (amount > 0),
  message    text,
  created_at timestamptz not null default now()
);
create index if not exists chip_gifts_from_idx on public.chip_gifts (from_id, created_at desc);
create index if not exists chip_gifts_to_idx on public.chip_gifts (to_id, created_at desc);

-- =============================================================================
-- 4. ROOMS & MULTIPLAYER GAME STATE
-- =============================================================================
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  host_id    uuid not null references public.profiles(id) on delete cascade,
  game       text not null default 'blackjack',
  state      jsonb,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_host_idx on public.rooms (host_id);

create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  seat      integer check (seat between 0 and 5),
  is_host   boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.room_actions (
  id         bigserial primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  action     jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists room_actions_room_idx on public.room_actions (room_id, id desc);

create table if not exists public.blackjack_hands (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  round      integer not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  hand_index integer not null default 0,
  cards      jsonb not null,
  bet        bigint not null,
  outcome    text not null,
  net        bigint not null,
  created_at timestamptz not null default now(),
  unique (room_id, round, user_id, hand_index)
);

create table if not exists public.blackjack_payouts (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  round      integer not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  net        bigint not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round, user_id)
);

create table if not exists public.game_sessions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms(id) on delete set null,
  game       text not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  summary    jsonb
);

create table if not exists public.game_players (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  net        bigint not null default 0,
  wins       integer not null default 0,
  losses     integer not null default 0,
  points     integer not null default 0,
  primary key (session_id, user_id)
);

-- =============================================================================
-- 5. ITEMS, INVENTORY, ACHIEVEMENTS, NOTIFICATIONS, SETTINGS
-- =============================================================================
create table if not exists public.items (
  id       text primary key,
  category text not null,
  name     jsonb not null,
  rarity   text not null check (rarity in ('common','rare','epic','legendary','mythic')),
  price    bigint not null default 0 check (price >= 0),
  icon     text not null default '',
  payload  jsonb not null default '{}'::jsonb,
  -- client-side display flags (mirrored from src/data/items.ts); see buy-pack.sql
  daily_rarity_only  boolean not null default false,
  rare_rotation_only boolean not null default false
);

create table if not exists public.user_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.items(id) on delete cascade,
  favorite    boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.achievements (
  id     text primary key,
  name   jsonb not null,
  descr  jsonb not null,
  stat   text not null,
  goal   bigint not null,
  reward bigint not null default 0
);

create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  title      text not null,
  body       text,
  payload    jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.user_settings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 6. VIEWS
-- =============================================================================
create or replace view public.leaderboard_view as
select p.id, p.username, p.tag, p.avatar, p.level, p.chips,
       coalesce(s.bj_wins, 0)     as bj_wins,
       coalesce(s.best_streak, 0) as best_streak,
       coalesce(s.biggest_win, 0) as biggest_win
from public.profiles p
left join public.player_stats s on s.user_id = p.id;

-- =============================================================================
-- 7. FUNCTIONS
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  starter text;
begin
  insert into public.profiles (id, username, tag, avatar, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Player' || floor(random() * 9000 + 1000)::text),
    '#' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'),
    coalesce(new.raw_user_meta_data->'avatar', '{"skin":0,"hair":0,"shirt":"base"}'::jsonb),
    coalesce((new.raw_user_meta_data->>'is_guest')::boolean, new.email is null)
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id) values (new.id) on conflict do nothing;

  foreach starter in array array['cf_classic','bk_crimson','ch_classic','tb_green','dl_house','em_laugh','em_cool','em_angry','em_shake','cn_classic','sl_classic','rb_default']
  loop
    insert into public.user_items (user_id, item_id)
    select new.id, starter where exists (select 1 from public.items where id = starter)
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = request_id;
  if req is null then raise exception 'request not found'; end if;
  if req.to_id <> auth.uid() then raise exception 'not your request'; end if;

  update public.friend_requests set status = 'accepted' where id = request_id;
  insert into public.friendships (user_id, friend_id) values (req.to_id, req.from_id) on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (req.from_id, req.to_id) on conflict do nothing;
  insert into public.notifications (user_id, kind, actor_id, title)
  values (req.from_id, 'friend_request', req.to_id, 'accepted');
end;
$$;

create or replace function public.buy_item(p_item_id text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  item_price bigint;
  balance    bigint;
  vip_level  integer;
  discount   numeric;
begin
  select price into item_price from public.items where id = p_item_id;
  if item_price is null then raise exception 'unknown item'; end if;

  if exists (select 1 from public.user_items where user_id = auth.uid() and item_id = p_item_id) then
    select chips into balance from public.profiles where id = auth.uid();
    return balance;
  end if;

  select chips, level into balance, vip_level from public.profiles where id = auth.uid() for update;
  discount := case when vip_level >= 36 then 0.15 when vip_level >= 16 then 0.10 when vip_level >= 1 then 0.05 else 0 end;
  item_price := floor(item_price * (1 - discount));
  if balance < item_price then raise exception 'insufficient chips'; end if;

  update public.profiles set chips = chips - item_price, updated_at = now() where id = auth.uid()
  returning chips into balance;
  insert into public.user_items (user_id, item_id) values (auth.uid(), p_item_id) on conflict do nothing;
  return balance;
end;
$$;

create or replace function public.send_gift(p_to_id uuid, p_amount bigint, p_message text default null)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  sent_today bigint;
  balance    bigint;
  recip_bal  bigint;
begin
  if p_to_id = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_to_id) then raise exception 'unknown recipient'; end if;
  if p_amount <= 0 or p_amount > 50000 then raise exception 'invalid amount'; end if;

  select coalesce(sum(amount), 0) into sent_today
  from public.chip_gifts
  where from_id = auth.uid() and created_at >= date_trunc('day', now());
  if sent_today + p_amount > 50000 then raise exception 'daily gift limit exceeded'; end if;

  select chips into balance from public.profiles where id = auth.uid() for update;
  if balance < p_amount then raise exception 'insufficient chips'; end if;

  update public.profiles set chips = chips - p_amount, updated_at = now() where id = auth.uid()
  returning chips into balance;
  update public.profiles set chips = chips + p_amount, updated_at = now() where id = p_to_id
  returning chips into recip_bal;

  insert into public.chip_gifts (from_id, to_id, amount, message) values (auth.uid(), p_to_id, p_amount, p_message);
  -- `new_balance` = recipient's balance after the credit; the client adopts it
  -- directly (no realtime sub on their own profiles row).
  insert into public.notifications (user_id, kind, actor_id, title, body, payload)
  values (p_to_id, 'gift', auth.uid(), 'gift_received', p_message,
          jsonb_build_object('amount', p_amount, 'new_balance', recip_bal));

  return balance;
end;
$$;

create or replace function public.claim_level_milestone()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  my_level      integer;
  last_claimed  integer;
  next_milestone integer;
  tier          integer;
  chips_reward  bigint;
  give_cosmetic boolean;
  rarity_pool   text[];
  chosen_item   text;
  balance       bigint;
begin
  select level, last_milestone_claimed into my_level, last_claimed
  from public.profiles where id = auth.uid() for update;

  next_milestone := ((last_claimed / 5) + 1) * 5;
  if next_milestone > my_level then
    return jsonb_build_object('claimed', false);
  end if;

  tier := case when next_milestone >= 36 then 3 when next_milestone >= 16 then 2 else 1 end;
  chips_reward := next_milestone * 80;
  give_cosmetic := random() < (case tier when 1 then 0.15 when 2 then 0.35 else 0.6 end);
  rarity_pool := case tier when 1 then array['rare'] when 2 then array['rare','epic'] else array['epic','legendary'] end;

  if give_cosmetic then
    select id into chosen_item from public.items
    where rarity = any(rarity_pool)
      and id not in (select item_id from public.user_items where user_id = auth.uid())
    order by random() limit 1;
    if chosen_item is not null then
      insert into public.user_items (user_id, item_id) values (auth.uid(), chosen_item) on conflict do nothing;
    end if;
  end if;

  update public.profiles
     set chips = chips + chips_reward, last_milestone_claimed = next_milestone, updated_at = now()
   where id = auth.uid()
  returning chips into balance;

  insert into public.notifications (user_id, kind, title, payload)
  values (auth.uid(), 'reward', 'milestone_reward',
          jsonb_build_object('level', next_milestone, 'chips', chips_reward, 'item', chosen_item));

  return jsonb_build_object(
    'claimed', true, 'level', next_milestone, 'chips', chips_reward,
    'item', chosen_item, 'balance', balance
  );
end;
$$;

create or replace function public.claim_weekly_prize()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  my_chips        bigint;
  friend_count    integer;
  max_friend_chips bigint;
  last_claim      timestamptz;
  balance         bigint;
begin
  select chips, weekly_prize_claimed_at into my_chips, last_claim
  from public.profiles where id = auth.uid() for update;

  if last_claim is not null and last_claim > now() - interval '7 days' then
    return jsonb_build_object('claimed', false, 'reason', 'too_soon');
  end if;

  select count(*), coalesce(max(p.chips), -1) into friend_count, max_friend_chips
  from public.friendships f join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid();

  if friend_count = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'no_friends');
  end if;
  if my_chips < max_friend_chips then
    return jsonb_build_object('claimed', false, 'reason', 'not_first');
  end if;

  update public.profiles set chips = chips + 1000, weekly_prize_claimed_at = now(), updated_at = now()
  where id = auth.uid()
  returning chips into balance;

  return jsonb_build_object('claimed', true, 'chips', 1000, 'balance', balance);
end;
$$;

create or replace function public.claim_blackjack_payout(p_room_id uuid, p_round integer)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  game_state jsonb;
  seat       jsonb;
  hand       jsonb;
  total_net  bigint := 0;
  balance    bigint;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'not a member of this room';
  end if;

  if exists (select 1 from public.blackjack_payouts where room_id = p_room_id and round = p_round and user_id = auth.uid()) then
    select chips into balance from public.profiles where id = auth.uid();
    return balance;
  end if;

  select state into game_state from public.rooms where id = p_room_id;
  if game_state is null then raise exception 'no game state'; end if;
  if (game_state->>'phase') <> 'settled' then raise exception 'round not settled'; end if;
  if (game_state->>'round')::int <> p_round then raise exception 'round mismatch'; end if;

  select value into seat
  from jsonb_array_elements(game_state->'seats')
  where value->>'userId' = auth.uid()::text
  limit 1;
  if seat is null then return (select chips from public.profiles where id = auth.uid()); end if;

  for hand in select value from jsonb_array_elements(seat->'hands') loop
    total_net := total_net + coalesce((hand->>'payout')::bigint, 0) - coalesce((hand->>'bet')::bigint, 0);
    insert into public.blackjack_hands (room_id, round, user_id, hand_index, cards, bet, outcome, net)
    values (
      p_room_id, p_round, auth.uid(),
      coalesce((select count(*)::int from public.blackjack_hands where room_id = p_room_id and round = p_round and user_id = auth.uid()), 0),
      hand->'cards', coalesce((hand->>'bet')::bigint, 0),
      coalesce(hand->>'outcome', 'lose'),
      coalesce((hand->>'payout')::bigint, 0) - coalesce((hand->>'bet')::bigint, 0)
    )
    on conflict do nothing;
  end loop;

  insert into public.blackjack_payouts (room_id, round, user_id, net)
  values (p_room_id, p_round, auth.uid(), total_net);

  update public.profiles
     set chips = greatest(0, chips + total_net), updated_at = now()
   where id = auth.uid()
  returning chips into balance;

  return balance;
end;
$$;

create or replace function public.adjust_chips(p_delta bigint, p_reason text default 'solo')
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  balance bigint;
begin
  if abs(p_delta) > 100000 then raise exception 'delta out of range'; end if;
  update public.profiles
     set chips = greatest(0, chips + p_delta), updated_at = now()
   where id = auth.uid()
  returning chips into balance;
  return balance;
end;
$$;

create or replace function public.protect_chip_column()
returns trigger
language plpgsql
as $$
begin
  if new.chips is distinct from old.chips and current_user in ('authenticated', 'anon') then
    raise exception 'chips is not directly writable — use a chip RPC (adjust_chips, buy_item, etc.)';
  end if;
  if new.is_admin is distinct from old.is_admin and current_user in ('authenticated', 'anon') then
    raise exception 'is_admin is not directly writable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chip_column_trigger on public.profiles;
create trigger protect_chip_column_trigger
before update on public.profiles
for each row execute function public.protect_chip_column();

create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.room_members where room_id = new.room_id) >= 4 then
    raise exception 'room is full';
  end if;
  return new;
end;
$$;

drop trigger if exists room_capacity on public.room_members;
create trigger room_capacity
before insert on public.room_members
for each row execute function public.enforce_room_capacity();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
for each row execute function public.touch_updated_at();

create or replace function public.reassign_room_host(p_room_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_host uuid := auth.uid();
  last_update timestamptz;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = new_host) then
    raise exception 'not a member of this room';
  end if;
  select updated_at into last_update from public.rooms where id = p_room_id;
  if last_update is null then raise exception 'room not found'; end if;
  if last_update > now() - interval '20 seconds' then
    raise exception 'room is still active';
  end if;
  update public.rooms set host_id = new_host where id = p_room_id;
  update public.room_members set is_host = (user_id = new_host) where room_id = p_room_id;
  return new_host;
end;
$$;

-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.player_stats        enable row level security;
alter table public.friendships         enable row level security;
alter table public.friend_requests     enable row level security;
alter table public.blocks              enable row level security;
alter table public.rivalries           enable row level security;
alter table public.rooms               enable row level security;
alter table public.room_members        enable row level security;
alter table public.room_actions        enable row level security;
alter table public.blackjack_hands     enable row level security;
alter table public.blackjack_payouts   enable row level security;
alter table public.game_sessions       enable row level security;
alter table public.game_players        enable row level security;
alter table public.items               enable row level security;
alter table public.user_items          enable row level security;
alter table public.achievements        enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.notifications       enable row level security;
alter table public.user_settings       enable row level security;
alter table public.chip_gifts          enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);

drop policy if exists stats_read on public.player_stats;
create policy stats_read on public.player_stats for select using (true);
drop policy if exists stats_write on public.player_stats;
create policy stats_write on public.player_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);
drop policy if exists friendships_write on public.friendships;
create policy friendships_write on public.friendships for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists requests_read on public.friend_requests;
create policy requests_read on public.friend_requests for select using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists requests_insert on public.friend_requests;
create policy requests_insert on public.friend_requests for insert with check (auth.uid() = from_id);
drop policy if exists requests_update on public.friend_requests;
create policy requests_update on public.friend_requests for update using (auth.uid() = to_id);

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists rivalries_own on public.rivalries;
create policy rivalries_own on public.rivalries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chip_gifts_read on public.chip_gifts;
create policy chip_gifts_read on public.chip_gifts for select using (auth.uid() = from_id or auth.uid() = to_id);

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert with check (auth.uid() = host_id);
drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host on public.rooms for update using (auth.uid() = host_id) with check (auth.uid() = host_id);
drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host on public.rooms for delete using (auth.uid() = host_id);

drop policy if exists members_read on public.room_members;
create policy members_read on public.room_members for select using (true);
drop policy if exists members_join on public.room_members;
create policy members_join on public.room_members for insert with check (auth.uid() = user_id);
drop policy if exists members_leave on public.room_members;
create policy members_leave on public.room_members for delete
  using (auth.uid() = user_id or auth.uid() = (select host_id from public.rooms r where r.id = room_id));

drop policy if exists actions_read on public.room_actions;
create policy actions_read on public.room_actions for select
  using (exists (select 1 from public.room_members m where m.room_id = room_id and m.user_id = auth.uid()));
drop policy if exists actions_insert on public.room_actions;
create policy actions_insert on public.room_actions for insert
  with check (auth.uid() = user_id and exists (select 1 from public.room_members m where m.room_id = room_id and m.user_id = auth.uid()));

drop policy if exists hands_read on public.blackjack_hands;
create policy hands_read on public.blackjack_hands for select
  using (exists (select 1 from public.room_members m where m.room_id = room_id and m.user_id = auth.uid()));

drop policy if exists payouts_read on public.blackjack_payouts;
create policy payouts_read on public.blackjack_payouts for select using (auth.uid() = user_id);

drop policy if exists sessions_read on public.game_sessions;
create policy sessions_read on public.game_sessions for select using (true);
drop policy if exists sessions_write on public.game_sessions;
create policy sessions_write on public.game_sessions for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists game_players_read on public.game_players;
create policy game_players_read on public.game_players for select using (true);
drop policy if exists game_players_write on public.game_players;
create policy game_players_write on public.game_players for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists items_read on public.items;
create policy items_read on public.items for select using (true);

drop policy if exists user_items_read on public.user_items;
create policy user_items_read on public.user_items for select using (true);
drop policy if exists user_items_update on public.user_items;
create policy user_items_update on public.user_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select using (true);
drop policy if exists user_ach_read on public.user_achievements;
create policy user_ach_read on public.user_achievements for select using (true);
drop policy if exists user_ach_write on public.user_achievements;
create policy user_ach_write on public.user_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (auth.uid() = user_id);
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (auth.uid() is not null);

drop policy if exists settings_own on public.user_settings;
create policy settings_own on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 9. REALTIME
-- =============================================================================
do $$
declare tbl text;
begin
  foreach tbl in array array['rooms','room_members','room_actions','notifications','friend_requests','friendships','profiles']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =============================================================================
-- 10. SEED DATA
-- =============================================================================
insert into public.items (id, category, name, rarity, price, icon, payload) values
  ('cf_classic', 'cards', '{"he":"קלפים קלאסיים","en":"Classic Cards"}'::jsonb, 'common', 0, '🂡', '{"cardFace":"cf-classic"}'::jsonb),
  ('cf_noir', 'cards', '{"he":"קלפי נואר","en":"Noir Cards"}'::jsonb, 'rare', 2000, '🖤', '{"cardFace":"cf-noir"}'::jsonb),
  ('cf_gold', 'cards', '{"he":"קלפי זהב","en":"Gold Cards"}'::jsonb, 'epic', 8000, '👑', '{"cardFace":"cf-gold"}'::jsonb),
  ('cf_neon', 'cards', '{"he":"קלפי ניאון","en":"Neon Cards"}'::jsonb, 'epic', 8000, '⚡', '{"cardFace":"cf-neon"}'::jsonb),
  ('cf_ice', 'cards', '{"he":"קלפי קרח","en":"Ice Cards"}'::jsonb, 'legendary', 22000, '❄️', '{"cardFace":"cf-ice"}'::jsonb),
  ('cf_fire', 'cards', '{"he":"קלפי אש","en":"Fire Cards"}'::jsonb, 'mythic', 55000, '🔥', '{"cardFace":"cf-fire"}'::jsonb),
  ('bk_crimson', 'backs', '{"he":"ארגמן קלאסי","en":"Crimson Classic"}'::jsonb, 'common', 0, '🂠', '{"cardBack":"bk-crimson"}'::jsonb),
  ('bk_noir', 'backs', '{"he":"שחור יוקרתי","en":"Black Luxury"}'::jsonb, 'rare', 2000, '🃏', '{"cardBack":"bk-noir"}'::jsonb),
  ('bk_crown', 'backs', '{"he":"כתר זהב","en":"Gold Crown"}'::jsonb, 'epic', 8000, '👑', '{"cardBack":"bk-crown"}'::jsonb),
  ('bk_galaxy', 'backs', '{"he":"גלקסיה","en":"Galaxy"}'::jsonb, 'epic', 8000, '✦', '{"cardBack":"bk-galaxy"}'::jsonb),
  ('bk_ember', 'backs', '{"he":"גחלים","en":"Ember"}'::jsonb, 'legendary', 22000, '🔥', '{"cardBack":"bk-ember"}'::jsonb),
  ('bk_frost', 'backs', '{"he":"כפור","en":"Frost"}'::jsonb, 'legendary', 22000, '❄️', '{"cardBack":"bk-frost"}'::jsonb),
  ('ch_classic', 'chips', '{"he":"צ׳יפים קלאסיים","en":"Classic Chips"}'::jsonb, 'common', 0, '🪙', '{"chipSkin":"ck-classic"}'::jsonb),
  ('ch_gold', 'chips', '{"he":"צ׳יפים מוזהבים","en":"Gold Chips"}'::jsonb, 'rare', 2000, '🟡', '{"chipSkin":"ck-gold"}'::jsonb),
  ('ch_neon', 'chips', '{"he":"צ׳יפי ניאון","en":"Neon Chips"}'::jsonb, 'epic', 8000, '⚡', '{"chipSkin":"ck-neon"}'::jsonb),
  ('ch_ivory', 'chips', '{"he":"צ׳יפי שנהב","en":"Ivory Chips"}'::jsonb, 'epic', 8000, '🤍', '{"chipSkin":"ck-ivory"}'::jsonb),
  ('ch_obsidian', 'chips', '{"he":"צ׳יפי אובסידיאן","en":"Obsidian Chips"}'::jsonb, 'legendary', 22000, '⬛', '{"chipSkin":"ck-obsidian"}'::jsonb),
  ('ch_ember', 'chips', '{"he":"צ׳יפי להבה","en":"Ember Chips"}'::jsonb, 'mythic', 55000, '🔥', '{"chipSkin":"ck-ember"}'::jsonb),
  ('tb_green', 'tables', '{"he":"ירוק קלאסי","en":"Classic Green"}'::jsonb, 'common', 0, '🟢', '{"table":"tb-green"}'::jsonb),
  ('tb_noir', 'tables', '{"he":"שחור מלכותי","en":"Royal Black"}'::jsonb, 'rare', 2000, '⬛', '{"table":"tb-noir"}'::jsonb),
  ('tb_midnight', 'tables', '{"he":"כחול חצות","en":"Midnight Blue"}'::jsonb, 'rare', 2000, '🔵', '{"table":"tb-midnight"}'::jsonb),
  ('tb_gold', 'tables', '{"he":"זהב יוקרתי","en":"Luxury Gold"}'::jsonb, 'epic', 8000, '👑', '{"table":"tb-gold"}'::jsonb),
  ('tb_cyber', 'tables', '{"he":"סייבר","en":"Cyber"}'::jsonb, 'epic', 8000, '⚡', '{"table":"tb-cyber"}'::jsonb),
  ('tb_crimson', 'tables', '{"he":"קטיפה ארגמנית","en":"Crimson Velvet"}'::jsonb, 'mythic', 55000, '🍷', '{"table":"tb-crimson"}'::jsonb),
  ('cl_gold', 'clothing', '{"he":"חליפת זהב","en":"Gold Suit"}'::jsonb, 'epic', 8000, '🥇', '{"shirt":"gold"}'::jsonb),
  ('cl_royal', 'clothing', '{"he":"חליפה מלכותית","en":"Royal Suit"}'::jsonb, 'epic', 8000, '🟣', '{"shirt":"royal"}'::jsonb),
  ('cl_neon', 'clothing', '{"he":"חליפת ניאון","en":"Neon Suit"}'::jsonb, 'rare', 2000, '🟩', '{"shirt":"neon"}'::jsonb),
  ('cl_crimson', 'clothing', '{"he":"חליפה ארגמנית","en":"Crimson Suit"}'::jsonb, 'rare', 2000, '🟥', '{"shirt":"crimson"}'::jsonb),
  ('em_laugh', 'emotes', '{"he":"צחוק","en":"Laugh"}'::jsonb, 'common', 0, '😂', '{"emote":"😂"}'::jsonb),
  ('em_cool', 'emotes', '{"he":"קול","en":"Cool"}'::jsonb, 'common', 0, '😎', '{"emote":"😎"}'::jsonb),
  ('em_angry', 'emotes', '{"he":"כועס","en":"Angry"}'::jsonb, 'common', 0, '😡', '{"emote":"😡"}'::jsonb),
  ('em_shake', 'emotes', '{"he":"לחיצת יד","en":"Handshake"}'::jsonb, 'common', 0, '🤝', '{"emote":"🤝"}'::jsonb),
  ('dl_house', 'dealers', '{"he":"דילר הבית","en":"House Dealer"}'::jsonb, 'common', 0, '🎩', '{"dealerSkin":"dl-house"}'::jsonb),
  ('cn_classic', 'coins', '{"he":"מטבע קלאסי","en":"Classic Coin"}'::jsonb, 'common', 0, '🪙', '{"coinSkin":"cn-classic"}'::jsonb),
  ('sl_classic', 'reels', '{"he":"מכונה קלאסית","en":"Classic Machine"}'::jsonb, 'common', 0, '🎰', '{"slotsTheme":"sl-classic"}'::jsonb),
  ('rb_default', 'backgrounds', '{"he":"רקע קלאסי","en":"Classic Room"}'::jsonb, 'common', 0, '🌑', '{"roomBackground":"rb-default"}'::jsonb),
  -- Stage G — shop expansion (themed packs + rare rotation pool)
  ('cf_royal', 'cards', '{"he":"קלפים מלכותיים","en":"Royal Cards"}'::jsonb, 'legendary', 22000, '♛', '{"cardFace":"cf-royal"}'::jsonb),
  ('cf_jade', 'cards', '{"he":"קלפי אזמרגד","en":"Jade Cards"}'::jsonb, 'epic', 8000, '💚', '{"cardFace":"cf-jade"}'::jsonb),
  ('cf_blush', 'cards', '{"he":"קלפי ורד","en":"Blush Cards"}'::jsonb, 'rare', 2000, '🌹', '{"cardFace":"cf-blush"}'::jsonb),
  ('bk_royal', 'backs', '{"he":"גב מלכותי","en":"Royal Back"}'::jsonb, 'legendary', 22000, '♛', '{"cardBack":"bk-royal"}'::jsonb),
  ('bk_jade', 'backs', '{"he":"גב אזמרגד","en":"Jade Back"}'::jsonb, 'epic', 8000, '💚', '{"cardBack":"bk-jade"}'::jsonb),
  ('bk_wave', 'backs', '{"he":"גב גלים","en":"Wave Back"}'::jsonb, 'rare', 2000, '🌊', '{"cardBack":"bk-wave"}'::jsonb),
  ('tb_royal', 'tables', '{"he":"קטיפה מלכותית","en":"Royal Velvet"}'::jsonb, 'legendary', 22000, '👑', '{"table":"tb-royal"}'::jsonb),
  ('tb_jade', 'tables', '{"he":"לבד אזמרגד","en":"Jade Felt"}'::jsonb, 'epic', 8000, '💚', '{"table":"tb-jade"}'::jsonb),
  ('fr_royal', 'frames', '{"he":"מסגרת מלכותית","en":"Royal Frame"}'::jsonb, 'legendary', 22000, '👑', '{"frame":"fr-royal"}'::jsonb),
  ('fr_jade', 'frames', '{"he":"מסגרת אזמרגד","en":"Jade Frame"}'::jsonb, 'epic', 8000, '💠', '{"frame":"fr-jade"}'::jsonb),
  ('fr_rose', 'frames', '{"he":"מסגרת ורד","en":"Rose Frame"}'::jsonb, 'rare', 2000, '🌹', '{"frame":"fr-rose"}'::jsonb),
  ('vc_fireworks', 'victory', '{"he":"זיקוקים","en":"Fireworks"}'::jsonb, 'epic', 8000, '🎆', '{"victory":"vc-fireworks"}'::jsonb),
  ('vc_stars', 'victory', '{"he":"מטר כוכבים","en":"Star Shower"}'::jsonb, 'legendary', 22000, '🌟', '{"victory":"vc-stars"}'::jsonb),
  -- Stage L — holographic cards + Royal Suite bundle handle (rare rotation) + synergy chip skins
  ('cf_holo', 'cards', '{"he":"קלפים הולוגרפיים","en":"Holographic Cards"}'::jsonb, 'mythic', 60000, '✨', '{"cardFace":"cf-holo"}'::jsonb),
  ('bundle_royal_suite', 'tables', '{"he":"ערכת שולחן מלכותית","en":"Royal Table Suite"}'::jsonb, 'legendary', 88000, '👑', '{"bundleHandle":"pack_royal_suite"}'::jsonb),
  ('ch_royal', 'chips', '{"he":"צ׳יפים מלכותיים","en":"Royal Chips"}'::jsonb, 'legendary', 22000, '👑', '{"chipSkin":"ck-royal"}'::jsonb),
  ('ch_jade', 'chips', '{"he":"צ׳יפי אזמרגד","en":"Jade Chips"}'::jsonb, 'epic', 8000, '💚', '{"chipSkin":"ck-jade"}'::jsonb),
  ('ch_crimson', 'chips', '{"he":"צ׳יפים ארגמניים","en":"Crimson Chips"}'::jsonb, 'epic', 8000, '🍷', '{"chipSkin":"ck-crimson"}'::jsonb),
  ('ch_frost', 'chips', '{"he":"צ׳יפי כפור","en":"Frost Chips"}'::jsonb, 'rare', 2000, '❄️', '{"chipSkin":"ck-frost"}'::jsonb),
  ('ch_rosegold', 'chips', '{"he":"צ׳יפי זהב ורוד","en":"Rose Gold Chips"}'::jsonb, 'rare', 2000, '🌹', '{"chipSkin":"ck-rosegold"}'::jsonb)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload;

insert into public.achievements (id, name, descr, stat, goal, reward) values
  ('beginners_luck', '{"he":"מזל של מתחילים","en":"Beginner''s luck"}'::jsonb, '{"he":"נצח במשחק הראשון שלך","en":"Win your very first game"}'::jsonb, 'wins', 1, 500)
on conflict (id) do update set
  name = excluded.name, descr = excluded.descr, stat = excluded.stat,
  goal = excluded.goal, reward = excluded.reward;
