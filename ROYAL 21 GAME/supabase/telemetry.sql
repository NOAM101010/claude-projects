-- =============================================================================
-- TELEMETRY — bug reports + analytics events
-- Run once in the Supabase SQL editor after setup.sql.
-- =============================================================================

-- =============================================================================
-- Bug Reports
-- =============================================================================
create table if not exists public.bug_reports (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  description text not null check (char_length(description) between 1 and 2000),
  url text,
  user_agent text,
  browser_info jsonb,
  screen_size text,
  created_at timestamptz not null default now(),
  -- Admin can mark as resolved
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists bug_reports_created_at_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_user_id_idx on public.bug_reports (user_id);
create index if not exists bug_reports_unresolved_idx on public.bug_reports (created_at desc)
  where resolved_at is null;

alter table public.bug_reports enable row level security;

-- Anyone signed in can submit a bug report
drop policy if exists "insert own bug report" on public.bug_reports;
create policy "insert own bug report" on public.bug_reports
  for insert with check (auth.uid() = user_id or user_id is null);

-- Only admins can read/update (via profiles.is_admin flag)
drop policy if exists "admin read bug reports" on public.bug_reports;
create policy "admin read bug reports" on public.bug_reports
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "admin update bug reports" on public.bug_reports;
create policy "admin update bug reports" on public.bug_reports
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- =============================================================================
-- Analytics Events
-- =============================================================================
create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (char_length(event_name) between 1 and 64),
  properties jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name);
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

-- Anyone signed in can insert their own events
drop policy if exists "insert own event" on public.analytics_events;
create policy "insert own event" on public.analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);

-- Only admins can read all events
drop policy if exists "admin read events" on public.analytics_events;
create policy "admin read events" on public.analytics_events
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Users can read only their own events (useful for debugging)
drop policy if exists "read own events" on public.analytics_events;
create policy "read own events" on public.analytics_events
  for select using (auth.uid() = user_id);
