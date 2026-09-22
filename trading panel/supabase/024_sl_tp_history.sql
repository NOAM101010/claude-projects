-- TradePanel — היסטוריית שינויי Stop Loss / Take Profit (רמה בסיסית).
-- Run once in the Supabase SQL Editor, אחרי 001-023.
--
-- טבלה append-only: כל שינוי ל-stop_loss/take_profit בעריכת טרייד קיים (updateTrade,
-- ראה src/lib/tradesApi.ts) יוצר כאן שורה חדשה - אף פעם לא עורכים/מוחקים שורות קיימות
-- (חוץ מ-cascade כשהטרייד עצמו נמחק). "ערך מקורי" (baseline) לצורך סטטיסטיקה = ה-
-- old_value של השורה הכי ישנה (changed_at) לאותו trade_id+field - ראה slTpAdjustmentStats
-- ב-src/lib/stats.ts.

create table trade_sl_tp_history (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  field text not null check (field in ('stop_loss', 'take_profit')),
  old_value numeric,
  new_value numeric,
  changed_at timestamptz not null default now()
);

create index trade_sl_tp_history_trade_id_idx on trade_sl_tp_history (trade_id);

alter table trade_sl_tp_history enable row level security;

-- אין עמודת account_id ישירה על הטבלה הזו (רק trade_id) - הבידוד עובר דרך exists על
-- trades, שכבר סינן בעצמו לפי account_id = auth.uid() (ראה "own trades" ב-001_init_schema.sql).
-- קריאה/הוספה בלבד - אין update/delete ישירים על היסטוריה מהקליינט (append-only באפליקציה).
create policy "account reads own trades sl/tp history" on trade_sl_tp_history
  for select using (
    exists (select 1 from trades where trades.id = trade_sl_tp_history.trade_id and trades.account_id = auth.uid())
  );

create policy "account inserts own trades sl/tp history" on trade_sl_tp_history
  for insert with check (
    exists (select 1 from trades where trades.id = trade_sl_tp_history.trade_id and trades.account_id = auth.uid())
  );
