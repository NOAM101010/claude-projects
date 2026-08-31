-- =============================================================================
-- PREMIUM COINS — make the 6 currency-skin coins real, server-persisted items
-- =============================================================================
-- Bug: the dollar/euro/pound/yen/bitcoin/gold-shekel coins (30k–75k chips, the
-- most expensive items in the game) were flagged `dailyRarityOnly` and lived
-- ONLY in the client catalogue. Buying one deducted chips locally but never
-- wrote a row to user_items, and the server items table had no row for them
-- (the user_items FK to items(id) would have rejected it anyway). So on the
-- next sign-out — which clears localStorage — the item vanished and the chips
-- were gone. The player had to buy it again.
--
-- Fix: ship these as real rows in public.items so buy_item() persists them in
-- user_items exactly like every other cosmetic. `dailyRarityOnly` stays a
-- client-only *display* flag (keeps them in the daily rare-rotation slot and
-- out of the normal grid) — it no longer affects persistence.
--
-- Idempotent: safe to run more than once.
-- Run this in Supabase → SQL Editor.
-- =============================================================================

insert into public.items (id, category, name, rarity, price, icon, payload) values
  ('cn_dollar',      'coins', '{"he":"מטבע דולר","en":"Dollar Coin"}'::jsonb,          'legendary', 30000, '💵', '{"currencySkin":"cn-dollar"}'::jsonb),
  ('cn_euro',        'coins', '{"he":"מטבע יורו","en":"Euro Coin"}'::jsonb,            'legendary', 30000, '💶', '{"currencySkin":"cn-euro"}'::jsonb),
  ('cn_pound',       'coins', '{"he":"מטבע ליש\"ט","en":"Pound Coin"}'::jsonb,         'legendary', 30000, '💷', '{"currencySkin":"cn-pound"}'::jsonb),
  ('cn_yen',         'coins', '{"he":"מטבע יין","en":"Yen Coin"}'::jsonb,              'legendary', 30000, '💴', '{"currencySkin":"cn-yen"}'::jsonb),
  ('cn_bitcoin',     'coins', '{"he":"מטבע ביטקוין","en":"Bitcoin Coin"}'::jsonb,      'mythic',    75000, '🟠', '{"currencySkin":"cn-bitcoin"}'::jsonb),
  ('cn_shekel_gold', 'coins', '{"he":"שקל זהב עתיק","en":"Ancient Gold Shekel"}'::jsonb, 'mythic',  75000, '🟡', '{"currencySkin":"cn-shekel-gold"}'::jsonb)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload;

-- Heal already-purchased coins: a player who bought one of these before the fix
-- has it in their LOCAL save but not in user_items. The client calls this once
-- per such item on hydrate to migrate that ownership server-side. It never
-- charges — the chips were already spent — and it is hard-limited to this fixed
-- set of 6 coin ids, so it cannot be used to grant arbitrary items for free.
create or replace function public.grant_owned_item(p_item_id text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_item_id not in (
    'cn_dollar','cn_euro','cn_pound','cn_yen','cn_bitcoin','cn_shekel_gold'
  ) then
    return false;
  end if;
  if not exists (select 1 from public.items where id = p_item_id) then
    return false;
  end if;
  insert into public.user_items (user_id, item_id)
  values (auth.uid(), p_item_id)
  on conflict do nothing;
  return true;
end;
$$;

grant execute on function public.grant_owned_item(text) to anon, authenticated;
