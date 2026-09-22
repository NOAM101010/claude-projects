-- Day Trading: תקציב סיכון יומי אופציונלי לכל workspace (robust-munching-puffin.md סבב C2).
-- null = לא הוגדר תקציב - DailyRiskBudgetCard לא מוצג בכלל במצב הזה (ר' Dashboard.tsx).
alter table workspaces
  add column if not exists daily_risk_budget numeric null;
