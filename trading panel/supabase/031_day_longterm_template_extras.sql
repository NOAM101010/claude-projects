-- Day Trading + Long-term: שני שדות אופציונליים נוספים לכל workspace (special-design round,
-- פריטים 9+10 מתוך רשימת 19, "Day trade-limit card"/"Portfolio-weight card" ב-progress.md).
-- שניהם null = לא מוגדר - הכרטיסים המתאימים (DayTradeLimitCard/PortfolioWeightCard) לא
-- מוצגים בכלל במצב הזה (ר' Dashboard.tsx), אותו דפוס בדיוק כמו daily_risk_budget (028).
alter table workspaces
  add column if not exists max_trades_per_day integer null,
  add column if not exists total_portfolio_value numeric null;
