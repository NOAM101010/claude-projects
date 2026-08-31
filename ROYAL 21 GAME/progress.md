# ROYAL 21 — סבב סגירת באגים סופי

## סטטוס — כל הבאגים סגורים בקוד + בדיקת בודק. ממתין לאימות חי סופי + commit/push.

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

## נשאר לאימות חי (המשתמש כשחקן שני — ראה MP_VERIFICATION_GUIDE.md)
- באג 2/3/4: אימות 2 דפדפנים חדר-חדר — ציפים, סנכרון, הסתרת קלפים ב-devtools, host handoff.
- מינורי לבדיקה סופית: (א) אחרי סיום יד BJ "עוד יד" דורש 2 לחיצות. (ב) סולו BJ: עזיבה מ-playing וחזרה -> שולחן ריק + action bar תקוע (startSolo לא מרהידרט את היד; pre-existing).

## אחרי אימות: branch מ-main -> commit (Co-Authored-By: Claude Sonnet 5) -> push
dev server: הפורט משתנה (5173 בברירת מחדל / 5199 אם מוגדר).
