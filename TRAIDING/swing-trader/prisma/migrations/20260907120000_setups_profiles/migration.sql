-- AlterTable: פרופילים מובנים מסומנים כך ש-ensureBuiltinProfiles יוכל לעדכן/למחוק רק אותם
ALTER TABLE "ScannerProfile" ADD COLUMN IF NOT EXISTS "isBuiltin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: רמת הביטחון של הסטאפ החזק ביותר בתוצאת סריקה
ALTER TABLE "ScannerResult" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;

-- הפרופילים המובנים של הגרסה הקודמת — מסומנים כמובנים כדי שיוחלפו בחמישה החדשים
UPDATE "ScannerProfile"
SET "isBuiltin" = true
WHERE "name" IN (
  'Breakouts (ברירת מחדל)',
  'Momentum חזק',
  'Pullback לא נורא',
  'Gap Runners'
);
