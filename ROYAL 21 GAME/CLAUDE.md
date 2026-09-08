# ROYAL 21 — קונטקסט פרויקט

נטען אוטומטית כשעובדים בתת-התיקייה הזו. מצב עבודה נוכחי → `progress.md` (הקובץ היחיד).

## Stack
Vite + React + TS + Supabase (project ref `ylhqwzokrfiwobfurkfx`). משחק קזינו חברתי פרטי (~15 חברים, צ'יפים וירטואליים בלבד, אין כסף אמיתי). חי: https://royal21.vercel.app (deploy אוטומטי מ-`origin/main`).

## dev / build / test
- dev: `PORT=5199 npm run dev` (5173 תפוס ע"י TYCOON NEO). אם הפורט משתנה — להחזיר URL למשתמש.
- אימות לפני דיווח: `npx tsc --noEmit` + `npm run build` + `npm run test:all`. i18n parity חייב להישאר מלא (he/en).
- **לעולם לא `npm run typecheck`** — הסקריפט הזה פלט בעבר קבצי `.js` שהצלילו את ה-tsx. אם עריכה "לא מופיעה": `find src -name '*.js' -not -path '*/node_modules/*'` ומחיקה קודם.

## git (מונו-רפו — זהירות)
- העבודה על branch **`royal21`** = `origin/main`. לפני עבודה: `git checkout royal21` (או `git fetch && git checkout -B royal21 origin/main`).
- דחיפה: `git push origin royal21:main`.
- **תמיד `git add "ROYAL 21 GAME/..."` בנתיבים מפורשים — לעולם לא `git add -A`** (סשנים אחרים עובדים במקביל על תיקיות אחרות).
- `main` הלוקאלי מזוהם בקומיטים יתומים — להתעלם ממנו.
- commit מסתיים ב-`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## SQL
כל שלב שדורש SQL → לרכז הכל לקובץ יחיד `RUN-THIS-NEXT.sql` (מוחלף, לא מצטבר) + `SendUserFile` + כותרת מה זה. אם משהו "לא עובד" בפרוד — קודם לבדוק שכל ה-SQL רץ.

## אדמין
email: `noamshay1010@gmail.com`

## מלכודות ידועות
- **framer-motion אסור לרקעים/overlays** — `animate`/`AnimatePresence`/`exit` נתקעים ומשאירים overlay חוסם. רק CSS `@keyframes` + רינדור מותנה `{open && …}`.
- **QA ויזואלי/MP:** ה-Browser pane של Claude לא אמין (מקפיא אנימציות, רינדור לא-עקבי) — לבדיקות DOM/JS בלבד. המאמת הויזואלי + 2-דפדפנים = המשתמש, תמיד.
- השתקת **כל** האודיו (מוזיקה + SFX + כל הסליידרים ל-0) לפני כל בדיקה: הגדרות ⚙️ → כל הסליידרים ל-0.
