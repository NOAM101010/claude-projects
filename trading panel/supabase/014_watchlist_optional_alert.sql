-- watchlist: מפרידה בין "מעקב" (watch) ל"התראה" (alert) - שתי תפיסות שונות שהיו
-- מבולבלות יחד (010_watchlist.sql הכריח target_price+direction על כל שורה, כלומר
-- לא אפשר היה פשוט לעקוב אחרי סימבול בלי להגדיר יעד מחיר). מעכשיו אפשר להוסיף
-- שורת watchlist עם סימבול בלבד (target_price/direction = null), ולהוסיף/לעדכן
-- את ההתראה מאוחר יותר בנפרד (ראה setWatchlistAlert ב-watchlistApi.ts).
alter table watchlist alter column target_price drop not null;
alter table watchlist alter column direction drop not null;

-- ה-check constraint הקיים (direction in ('above','below')) כבר מאפשר NULL כברירת
-- מחדל ב-Postgres - check constraint נכשל רק כשהביטוי מוערך ל-false, ו-NULL in (...)
-- מוערך ל-NULL (לא false), ולכן עובר. אין צורך לגעת בו.

-- enforce_watchlist_limit() לא משתנה בכוונה: היא סופרת שורות active=true בלי קשר
-- לקיום target_price - שורת "מעקב בלבד" עדיין תופסת מקום מתוך מגבלת 15 הסימבולים,
-- וזו עדיין ההתנהגות הרצויה (מגבלה על סימבולים במעקב, לא רק על התראות פעילות).
