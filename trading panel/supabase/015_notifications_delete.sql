-- 013_notifications.sql נתנה ללקוח רק select+update (לסמן read_at) - אבל אין דרך
-- למחוק התראה מהפעמון. מוסיפה policy למחיקה, מוגבלת לשורות של החשבון עצמו בלבד,
-- באותה מוסכמה בדיוק כמו שאר הטבלאות (watchlist וכו').
create policy "account deletes own notifications" on notifications for delete using (account_id = auth.uid());
