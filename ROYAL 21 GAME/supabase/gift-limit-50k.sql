-- ROYAL 21 — raise chip-gift limit 500 -> 50,000/day
-- Run once in Supabase -> SQL Editor. Idempotent (create or replace).

create or replace function public.send_gift(p_to_id uuid, p_amount bigint, p_message text default null)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  sent_today bigint;
  balance    bigint;
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
  update public.profiles set chips = chips + p_amount, updated_at = now() where id = p_to_id;

  insert into public.chip_gifts (from_id, to_id, amount, message) values (auth.uid(), p_to_id, p_amount, p_message);
  insert into public.notifications (user_id, kind, actor_id, title, body, payload)
  values (p_to_id, 'gift', auth.uid(), 'gift_received', p_message, jsonb_build_object('amount', p_amount));

  return balance;
end;
$$;
