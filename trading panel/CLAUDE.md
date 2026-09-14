# TradePanel — קונטקסט פרויקט

נטען אוטומטית כשעובדים בתת-התיקייה הזו. מצב עבודה נוכחי → `progress.md`.

## Stack
Vite + React + TS. Supabase (פרויקט עדיין לא נוצר — ראה `supabase/README.md`).
PWA למעקב יומן מסחר אישי, נמכר ב-2 דרגות (Basic/Pro) דרך קוד גישה, ללא סיגנלים/המלצות השקעה.

## מסמכי תכנון
- `tradepanel-build-prompt.md` — הפרומפט המקורי שהועבר לבנייה
- `trading-journal-plan.md` — התוכנית המלאה והסגורה (כולל סעיף מטבע/שער היסטורי)

## dev / build / test
- dev: `npm run dev` (פורט 5200). אם משתנה — להחזיר URL למשתמש.
- אימות לפני דיווח: `npx tsc --noEmit` + `npm run build` + `npm run test:all`.
- **לעולם לא `npm run typecheck`** — רק `npx tsc --noEmit`. אם עריכה "לא מופיעה": `find src -name '*.js' -not -path '*/node_modules/*'` ומחיקה.

## git (מונו-רפו)
- **תמיד `git add "trading panel/..."` בנתיבים מפורשים — לעולם לא `git add -A`.**
- commit רק כשהמשתמש מבקש. מסתיים ב-`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## אודיו
אין אודיו במוצר הזה (כלי תיעוד, לא משחק) — לדלג על שלב ההשתקה.

## מלכודות ידועות
- QA ויזואלי: ה-Browser pane של Claude לא אמין (מקפיא אנימציות) — לבדיקות DOM/JS בלבד. המשתמש הוא המאמת הויזואלי, כולל Safari/iOS.
- **בידוד לקוחות:** כל שאילתת Supabase חייבת לסנן לפי מזהה הלקוח (קוד גישה/מזהה אנונימי) — RLS policies חובה, לא רק סינון בצד קליינט.
- **מטבע:** P&L של טרייד קיים לעולם לא מחושב מחדש. המרה קורית רק בתצוגת דשבורד לפי שער היסטורי ליום הכניסה — ראה `trading-journal-plan.md`.
- **הגדרות שדות (Toggle):** שינוי הגדרות workspace לעולם לא מוחק/משנה דאטה שכבר נרשמה בטריידים קיימים.
- **PWA:** `public/manifest.webmanifest` הוא קובץ סטטי אמיתי (לא נוצר ע"י `vite-plugin-pwa` - `manifest: false` ב-`vite.config.ts`), כדי שיוגש זהה ב-dev וב-build בלי תלות ב-`devOptions.enabled`. ה-Service Worker (`src/sw.ts`) כן דרך הפלאגין, באסטרטגיית `injectManifest` (לא `generateSW`) כי צריך event listeners מותאמים ל-push notifications.
- **Push notifications:** `supabase/functions/send-test-push` משתמש ב-`npm:web-push` בתוך Deno Edge Function - תלוי בתמיכת `npm:` specifiers, לא נבדק בפועל מול פריסה/דפדפן אמיתיים. VAPID private key לעולם לא נשמר בקובץ בריפו - רק כ-Supabase secret.
