-- TradePanel — Storage bucket לתמונות גרף (trading-journal-plan.md: "תמונת גרף (upload)").
-- Run once in the Supabase SQL Editor, אחרי 001-005.
--
-- ה-bucket פרטי (לא public) - תצוגה רק דרך signed URL קצר-טווח (ראה src/lib/chartImagesApi.ts,
-- getChartImageUrl). מגבלת 50 תמונות לכל workspace נאכפת בצד הקליינט (canUploadChartImage) +
-- ספירה מול טבלת trades - אין לזה אכיפה נוספת ב-DB כי זו מגבלת מוצר, לא אבטחה.

insert into storage.buckets (id, name, public)
values ('chart-images', 'chart-images', false)
on conflict (id) do nothing;

-- בידוד לקוחות: כל קובץ נשמר תחת נתיב `{account_id}/{filename}` (ראה buildChartImagePath) -
-- חשבון יכול לגעת רק בקבצים שהתיקייה הראשונה בנתיב שלהם היא ה-account_id שלו עצמו
-- (auth.uid(), לפי מודל הזהות "bring your own auth" ב-supabase/README.md).
create policy "account reads its own chart images" on storage.objects
  for select using (
    bucket_id = 'chart-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "account uploads its own chart images" on storage.objects
  for insert with check (
    bucket_id = 'chart-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "account deletes its own chart images" on storage.objects
  for delete using (
    bucket_id = 'chart-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
