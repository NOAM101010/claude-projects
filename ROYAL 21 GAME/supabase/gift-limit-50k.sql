-- ROYAL 21 — chip-gift daily limit (default 50,000/day)
-- Run once in Supabase -> SQL Editor. Idempotent (create or replace).
-- Run AFTER supabase/app-config.sql so the live `gift_daily_limit` key is read;
-- without that row it falls back to the hard-coded 50,000 (GIFT_DAILY_LIMIT).

create or replace function public.send_gift(p_to_id uuid, p_amount bigint, p_message text default null)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  sent_today bigint;
  balance    bigint;
  v_limit    bigint := public.config_num('gift_daily_limit', 50000);
begin
  if p_to_id = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_to_id) then raise exception 'unknown recipient'; end if;
  if p_amount <= 0 or p_amount > v_limit then raise exception 'invalid amount'; end if;

  select coalesce(sum(amount), 0) into sent_today
  from public.chip_gifts
  where from_id = auth.uid() and created_at >= date_trunc('day', now());
  if sent_today + p_amount > v_limit then raise exception 'daily gift limit exceeded'; end if;

  select chips into balance from public.profiles where id = auth.uid() for update;
  if balance < p_amount then raise exception 'insufficient chips'; end if;

  update public.profiles set chips = chips - p_amount, updated_at = now() where id = auth.uid()
  returning chips into balance;
  update public.profiles set chips = chips + p_amount, updated_at = now() where id = p_to_id;

  insert into public.chip_gifts (from_id, to_id, amount, message) values (auth.uid(), p_to_id, p_amount, p_message);
  insert into public.notifications (user_id, kind, actor_id, title, body, payload)
  values (p_to_id, 'gift', auth.uid(), 'gift_received', p_message, jsonb_build_object('amount', p_amount));

  return balance;
end;
$$;
