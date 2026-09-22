-- notifications.direction: 'above'|'below' per price alert, mirrors watchlist.direction
-- that triggered it (see check-price-alerts/index.ts's WatchlistRow.direction). Added so
-- NotificationBell can render a real up/down icon instead of parsing the free-text
-- `message` column - see design-explore/notification-bell-directions.html direction 2.
-- Nullable on purpose: existing notification rows created before this migration never had
-- a direction, and must keep rendering (just without the icon) instead of breaking.
alter table notifications add column direction text null check (direction in ('above', 'below'));
