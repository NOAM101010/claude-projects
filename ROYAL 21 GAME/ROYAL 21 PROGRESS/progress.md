# ROYAL 21 — Progress

**Last updated:** 2026-09-01

משחק קזינו חברתי (צ'יפים וירטואליים בלבד). Vite + React + TypeScript + Supabase.
תיקייה: `C:\CLAUDE AI\ROYAL 21 GAME`. חי: https://royal21.vercel.app (מתפרס אוטומטית מ-`main`).

## Current status

המשחק במצב טוב ועובד. כל הבאגים שהמשתמש דיווח עליהם תוקנו, אומתו בבדיקה חיה, ונדחפו ל-`main` (Vercel פרס). ה-Hub עבר עיצוב מחדש מלא + נוסף לוח מנהיגים גלובלי — אושר ע"י המשתמש ונדחף. `git` מסונכרן עם `origin/main`, אין קומיטים תלויים.

**הפריט האחרון הפתוח:** אימות מולטיפלייר עם 2 דפדפנים אמיתיים (המשתמש צריך לעשות את זה — ראה למטה).

## What's done

**באגים שנסגרו (כולם נדחפו + אומתו חי):**
- **ציפים (bet/clear/bet):** 3 שכבות — `clearRefunded` ref ב-roulette/coinflip/highcard; `runReconcile` שמתכנס אחרי clamp ±100K (למהמר מחובר עם הימורים גדולים); שכתוב `useCountUp` (מונה ה-HUD היה נתקע). האקונומיה תמיד היתה תקינה — הבעיה שהמשתמש ראה היתה מונה ה-HUD.
- **מולטיפלייר:** baccarat קיבל מנגנון `roundOutlay`; SnG/poker refund-race; BJ `clearBet` מקזז `pendingBetTotal`.
- **קלפי hole חשופים (פוקר/SnG/BJ/באקרה):** redaction מאחורי gate + RPCs. `supabase/poker-privacy.sql` **הורץ בפרודקשן**.
- **host heartbeat:** Web Worker ticker כל 8s (`roomsService.startHostHeartbeat`).
- **עזיבת שולחן BJ באמצע יד:** unmount cleanup ב-`BlackjackScene` (refund מ-betting, forfeit מ-playing).
- **הכספת נתקעת ב-"פותח את הכספת...":** ה-overlay יצא מ-`AnimatePresence` + `setTimeout` fallback.
- **BJ "עוד יד" דרש 2 לחיצות / חזרה לסולו השאירה שולחן תקוע:** הסרת `AnimatePresence mode="wait"`.
- **copy VIP:** כרטיס VIP בבית הראה מספרים שגויים (רמה 15/50K) → תוקן ל-`VIP_MIN_LEVEL`/`VIP_MIN_CHIPS` (5 / 150K).

**Hub redesign + לוח מנהיגים (2026-09-01, אושר, נדחף):**
- **Hub §01 "רצפת קזינו":** CSS grid `repeat(3,1fr)` + `grid-auto-rows:1fr` + gap אחיד. רולטה = כרטיס עגול גדול שפורש את עמודת המרכז (3 שורות). 6 שולחנות סביבה (RTL: פוקר/SnG/באקרה ימין · Blackjack/נגד-חברים/ערב-חברה שמאל). כל ה-art מוכל בכרטיס. בלי תגי "חדש".
- **`AppBackdrop`** (`src/components/layout/AppBackdrop.tsx`, render פעם אחת ב-`App.tsx` מאחורי כל route): גרדיאנט + tint לפי `data-zone` (gold/warm/teal/neutral, crossfade) + 4 סמלי ♠♥♦♣ (opacity נמוך, בלי blur, drift CSS איטי, גוון לפי מסך) + bokeh + אבק + וינייטה. **הכל `@keyframes` CSS**. `reduced-motion`/`quality=low` מקפיאים. `HubBackdrop.tsx` נמחק.
- **לוח מנהיגים גלובלי+חברים** (`src/scenes/hub/Leaderboard.tsx`): `LeaderboardWidget` (Top 3 + אתה + לינק) ב-Hub, `LeaderboardFull` ב-`Modal` עם `<Tabs>` (חצי ‹ ›) ל-5 קטגוריות (chips/bj_wins/biggest_win/best_streak/level). נתונים מ-`profileService.leaderboard()`; friends = סינון ל-ids של חברים; mock = fallback ל-guest/offline. הכיתוב "המובילים בכל הזמנים". הטאב הישן בפאנל החברים נמחק.
- **חנות:** hints שמסבירים סקין הטלת-מטבע (`coinSkin`, לא משפיע על סיכויים) מול מטבע שמחליף את סמל הצ'יפים בכל המשחק (`currencySkin`, נשאר כבלעדי יומי מתחלף).

**SQL שהורץ בפרודקשן ע"י המשתמש:** `poker-privacy.sql`, `reset-users.sql` (איפוס כל הלא-אדמין למצב התחלתי), `achievements-daily.sql` (הישגים + בונוס יומי server-side).

**מצב טכני:** `tsc --noEmit` נקי · `npm run build` עובר · `npm run test:all` ירוק (131) · i18n he/en parity 871/871 · 0 TODO.

## What's left / next steps

1. **אימות מולטיפלייר 2 דפדפנים** — הפריט האחרון. המשתמש פותח 2 דפדפנים (רגיל + incognito, משתמש שונה בכל אחד) ועובר לפי `ROYAL 21 GAME/MP_VERIFICATION_GUIDE.md` על 7 החדרים: ציפים (100→נקה→100), סנכרון בין השחקנים, קלפי hole מוסתרים ב-devtools (WS frames), host handoff. **פוקר / SnG / ערב-חברה נבדקו רק כאן** — לא נבדקו סולו. אם משהו נשבר — לתקן קדימה ולדחוף.
2. אחרי שהמולטיפלייר ירוק — המשתמש רצה **סקירה מקיפה סופית** של כל המשחק (כל מסך, כל משחק).
3. המשתמש רצה בסוף **חשבון טוקנים + זמן** מלא של כל העבודה בפרויקט.

## Key decisions & context

- **הסוכנים:** הסשן הראשי הוא מנהל-הפרויקט (אין סוכן `project-manager` נפרד — נמחק). מאציל ל-`builder` (חוסם), `reviewer` רק לשינויים בכסף/אימות/MP או גדולים, `designer` רק ל-UI אמיתי. מוגדר ב-`C:\CLAUDE AI\CLAUDE.md`.
- **dev server:** `cd "C:\CLAUDE AI\ROYAL 21 GAME" && PORT=5199 npm run dev` (5173 תפוס ע"י TYCOON NEO). **חשוב:** ה-dev server מחזיק module graph ישן — אם תיקון "לא מופיע", `taskkill` את הפורט + `rm -rf node_modules/.vite` + restart, ו-hard reload בדפדפן. שגיאות בקונסול הדפדפן אחרי restart הן לרוב cache ישן — `tsc`/`build`/`test:all` הם הסמכות.
- **כניסה חיה לבדיקה:** guest/אורח נבדק ישירות. למולטיפלייר אמיתי — טריק session-injection מתועד בזיכרון `royal21_bugfix_loop.md`.
- **framer-motion:** אנימציות `animate` של framer **לא רצות** בדפדפן-הבדיקה של Claude (`document.hidden` תמיד true שם). לרקע אמביינטי / אנימציות מתמשכות — CSS `@keyframes` בלבד (זה גם הקונבנציה של הפרויקט — ראה `AmbientBackground.tsx`).
- **כלכלה:** מתוכננת בכוונה, מתועדת ב-`src/data/economy.ts`. הנחת -30% בכספת = `DAILY_DISCOUNT` (מבצע יומי מתחלף), לא באג. VIP: tier (הנחה בחנות, רמה 1+) ≠ VIP Lounge (רמה 5 + 150K).
- **המשתמש:** מעדיף עברית · השתקת **כל** האודיו לפני כל בדיקה · batch של תיקונים במקום דבר-דבר (עולה טוקנים) · החלטה-ופעולה במקום סקירת אופציות.
- **git:** קומיטים ישירות ל-`main` (המשתמש רוצה שזה יתפרס). הודעת commit מסתיימת ב-`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **admin account:** email `noamshay1010@gmail.com` (`admin_emails()` ב-`supabase/admin.sql`). `reset-users.sql` לא נוגע בו.

## Known issues / open questions

- **מולטיפלייר לא אומת חי** עם 2 שחקנים אמיתיים — פוקר/SnG/ערב-חברה במיוחד. זה מה שנשאר.
- דחיפה ל-`main` איטית — ~125MB של קבצי BLACKJACK 3D ישנים שממתינים מקומיטים קודמים. שווה ניקוי מתישהו (git history של הריפו הרב-פרויקטי).
- `progress.md` הישן בשורש `ROYAL 21 GAME/` — יומן מפורט של הבאגים, נשמר לרפרנס. הקובץ הזה (`ROYAL 21 PROGRESS/progress.md`) הוא ה-snapshot הרשמי.
