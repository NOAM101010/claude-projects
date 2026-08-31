# ROYAL 21 — סבב סגירת באגים סופי

## סטטוס — כל הבאגים סגורים בקוד + בדיקת בודק. ממתין לאימות חי סופי + commit/push.

---
## Hub redesign + לוח מנהיגים גלובלי — הושלם, אושר ע"י המשתמש (2026-09-01), נדחף ל-main
- **Hub §01 חדש — "רצפת קזינו":** 3 עמודות שוות, gap אחיד, רולטה = כרטיס עגול גדול שפורש את עמודת המרכז (3 שורות); 6 שולחנות סביבה (פוקר/SnG/באקרה ימין · Blackjack/נגד-חברים/ערב-חברה שמאל). כל ה-art מוכל. בלי תגי "חדש".
- **`src/components/layout/AppBackdrop.tsx`** (חדש, render פעם אחת ב-App.tsx מאחורי כל route): גרדיאנט סטטי + tint לפי `data-zone` (gold/warm/teal/neutral, crossfade 0.9s) + 4 סמלי ♠♥♦♣ (opacity נמוך, בלי blur, drift CSS איטי, גוון לפי zone) + bokeh + אבק + וינייטה נושמת. הכל `@keyframes` CSS (framer לא רץ). reduced-motion / quality=low מקפיאים. `HubBackdrop.tsx` נמחק.
- **לוח מנהיגים אמיתי גלובלי+חברים:** `src/scenes/hub/Leaderboard.tsx` — `LeaderboardWidget` (Top 3 + אתה + לינק "הלוח המלא") ב-Hub, `LeaderboardFull` ב-Modal עם `<Tabs>` (חצי ‹ ›) ל-5 קטגוריות. נתונים מ-`profileService.leaderboard()` (נוסף `biggest_win`); friends = סינון ל-ids של חברים; mock = fallback ל-guest/offline. הכיתוב "המובילים בכל הזמנים" (היה "השבוע" בטעות). הטאב הישן בפאנל החברים נמחק; claim פרס שבועי עבר ל-on-open.
- **חנות:** hints מתחת לטאבי מטבעות/צ'יפים + על preview מטבע-מטבע — מבהירים סקין הטלת-מטבע מול מטבע שמחליף את סמל הצ'יפים.
- קומיטים: `13ccd54`..`21a56d6`. tsc+build+test:all ירוקים, i18n parity 871/871.

---

### באג 1 — ציפים — תוקן (2 שכבות), בודק אישר
שכבה A (סבב מוקדם): handleClear/clearPick/clearAnte איפסו roundOutlay אופטימית -> clearRefunded ref ב-roulette/coinflip/highcard. settle: rejected = outlay - authStake - clearedBack.
שכבה B — usePlayer.runReconcile: ה-clamp +-100K חתך תנועות addChips גדולות (>100K) והשארית לא זומנה מחדש -> למשתמש מחובר השרת פיגר. תוקן: runReconcile(id, slice) מזמן ריצה נוספת על אותה שרשרת כשה-clamp חתך, עד התכנסות (תנאי עצירה: remaining=0 / לא מצטמצם / MAX 200). סימולציה scripts/reconcile-sim.mjs מוכיחה diff=0. clamp עצמו לא נגע (anti-cheat).
שכבה C — HUD desync: המשתמש שחזר חי (guest, סולו BJ) שהאקונומיה תקינה 100% (profile.chips + save עוקבים מושלם), אבל מונה ה-HUD "היתרה שלך" נתקע על ערך נמוך אחרי clear עד ניווט. גורם: hook useCountUp — from.current יצא מסנכרון, early-return delta=0 נטש תצוגה, rAF קפוא בטאב רקע. תוקן: כתיבה מחדש של ה-tween (displayRef עוקב אחרי setDisplay, נחיתה מדויקת, document.hidden קפיצה, setTimeout גיבוי). ה-HUD ערך תצוגה טהור — אין דליפה ל-reconcile/server. תוקן לכל הסצנות בקובץ אחד.

### באג 2 — מולטיפלייר (baccarat outlay, SnG refund-race, BJ clearBet) — תוקן, בודק אישר
### באג 4 — host heartbeat (Worker ticker 8s) — תוקן, בודק אישר
### באג 3 — hole cards (poker/SnG/BJ redaction + baccarat nonce) — תוקן מאחורי gate, בודק אישר. SQL supabase/poker-privacy.sql הורץ ע"י המשתמש על הפרודקשן (טבלאות + RPC מאומתים חי).

### באג 5 — עזיבת שולחן BJ באמצע יד — תוקן (Claude ישירות, PM היה rate-limited)
BlackjackScene לא היה לו unmount cleanup (בניגוד ל-PokerScene). עזיבה מ-betting -> ההימור שהונח (addChips -value) לא הוחזר = אובדן שקט בסולו. MP: מושב רפאים + HUD תקוע על ערך אופטימי.
תיקון (BlackjackScene.tsx): leaveCleanup ב-ref + useEffect mount-only. betting: מחזיר את ההימור שהונח (solo: seat.bet; MP: pendingBetTotal.current — race-safe מול clearBet). playing/dealer: forfeit (לא מחזיר — anti-exploit). MP: useRoom.leave() + refreshFromServer(). tsc נקי, 131 טסטים ירוקים.
אומת חי (guest, סולו): leave מ-betting אחרי stage 2K -> chips 3000->1000->3000 (הוחזר). leave מ-playing -> 2500 נשאר (forfeit). bug 1 לא נסוג: 3 מחזורי stage 2K -> clear -> chips+HUD חוזרים ל-2500 בדיוק.

### באגים 6-8 — סקירה חיה מקיפה (Claude ישירות, commit 225580e, נדחף) — תוקנו ואומתו חי
- **באג 6 — הכספת נתקעת ב-overlay "פותח את הכספת..."** (`VaultScene.tsx`). ה-overlay היה בתוך AnimatePresence עם exit animation שנתקע (framer-motion לא החיל את ה-rotate transform בפרוד, onAnimationComplete לא ירה, אין fallback). שוחזר חי ב-localhost + פרודקשן. תיקון: הוצאת ה-overlay מ-AnimatePresence (unmount מיידי, בלי exit), + setTimeout(2500) fallback + transformBox/Origin ל-svg + רמז "הקש להיכנס" (i18n vault.tapToEnter). אומת: נכנס תוך ~1ש.
- **באג 7 — BJ "עוד יד" דורש 2 לחיצות** + **באג 8 — סולו BJ עזיבה-וחזרה משאירה שולחן ריק / action bar תקוע**. מקור משותף: `AnimatePresence mode="wait"` סביב פקדי ה-phase ב-BlackjackScene — החזיק את הפקד היוצא עד שאנימציית exit נרשמה כגמורה, מה שלא קרה במעברים מהירים. תיקון: הסרת mode="wait". אומת חי: לחיצה אחת מספיקה, חזרה לסולו = מסך הימורים נקי.

## מצב סקירה (2026-08-31)
✅ נבדק חי ותקין: כלכלת ציפים ב-5 המשחקים בסולו (BJ/coinflip/highcard/baccarat/roulette — הימור/נקה/חלוקה/הסדרה מדויקים), כספת, מלאי, הגדרות, לובי, VIP — נטענים ועובדים. i18n he/en parity מושלם (854 מפתחות). 0 TODO. הנחת -30% בכספת = פיצ'ר (DAILY_DISCOUNT, מבצעי היום מתחלפים).

### copy — תוקן (commit c229a2f, נדחף). המשתמש ביקש לא לגעת ב-copy מעבר לזה.
כרטיס VIP בבית אמר "נפתח ברמה 15 עם 50K" — הסף האמיתי רמה 5 + 150K (VIP_MIN_LEVEL/VIP_MIN_CHIPS). blurbLocked עכשיו interpolate מהקבועים. lockedSubtitle "עוד קצת ואתה שם" → "השולחנות הבלעדיים ממתינים".

### SQL — **המשתמש הריץ את שניהם על הפרודקשן** (2026-08-31):
- `supabase/reset-users.sql` (commit c229a2f) — כל הלא-אדמין אופסו למצב התחלתי; חדרים/היסטוריה/התראות/דוחות/אנליטיקס נמחקו. אדמין לא נגע.
- `supabase/achievements-daily.sql` — 4 הפונקציות + העמודות. שגיאות ה-404 של fetch_achievements/fetch_daily_state אמורות להיעלם. הישגים + בונוס יומי עכשיו server-authoritative.
- (בעבר גם `supabase/poker-privacy.sql` הורץ — gate של קלפי hole פעיל.)

## נשאר (המשתמש)
- **אימות מולטיפלייר 2 דפדפנים** — `MP_VERIFICATION_GUIDE.md`. באגים 2/3/4 + host handoff + קלפי hole ב-devtools. סצנות שלא נבדקו סולו (פוקר/SnG/ערב חברה) — כאן. זה הפריט האחרון הפתוח.

dev server: `PORT=5199 npm run dev` (5173 תפוס ע"י TYCOON NEO). הפורט משתנה — אם כן, החזר URL למשתמש.
