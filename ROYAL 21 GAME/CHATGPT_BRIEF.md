# ROYAL 21 — תדריך מלא לצ'אט חדש

הדבק את כל הטקסט הזה כהודעה ראשונה. זה כל מה שצריך כדי להבין את הפרויקט.

---

## מה זה
משחק חדר קזינו חברתי פרטי בדפדפן. **ציפים וירטואליים בלבד** — אין הפקדה, משיכה, רכישה או כסף אמיתי בשום מקום בקוד או במסד הנתונים.

## סטאק טכני
- **Frontend:** Vite + React + TypeScript
- **Backend:** Supabase (Postgres + Realtime + Auth). Project ref: `ylhqwzokrfiwobfurkfx`
- **אודיו:** כל צליל מסונתז בקוד (AudioManager) — אין קבצי שמע
- **i18n:** עברית + אנגלית מלאות (RTL/LTR), ~854 מפתחות, parity מושלם
- סולו עובד בלי Supabase; חברים/חדרים/מולטיפלייר דורשים `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` ב-`.env`

## הרצה
```
npm install
npm run dev        # פורט 5199 (5173 תפוס ע"י פרויקט אחר). http://localhost:5199
npm run build
npm run typecheck
npm run test:engine
```

## מבנה תיקיות (src/)
```
app/        App shell, routes, deep-link handling
audio/      AudioManager
components/  ui/ game/ social/ effects/ layout/
scenes/     intro · auth · hub · room · blackjack · vault · profile · settings
games/      blackjack/ (engine.ts רולז טהורים, duel.ts מרוץ נקודות) · coinflip/ highcard/ scratch/
services/   auth · profile · friends · rooms · blackjack · shop · notifications · presence
stores/     usePlayer · useRoom · useSocial · useSettings · useUI
data/       items.ts · achievements.ts · economy.ts
i18n/       he.json · en.json
styles/     tokens.css · global.css · game.css
supabase/   קבצי .sql — סכמה, RLS, פונקציות, seed
```

## 8 המשחקים
Blackjack (סולו + מולטי), Poker Texas Hold'em (מולטי, שולחנות פרטיים), Poker Sit & Go (טורנירים), Roulette (סולו + מולטי), Slots (5 ערכות נושא, אוטו-פליי, ג'קפוט), Coin Flip (סולו + מולטי + VIP), High Card (סולו + מולטי + VIP), Scratch Cards.

## מערכות
ג'קפוט פרוגרסיבי (סלוטס + Royal Flush בפוקר), טרקלין VIP (נפתח ברמה 5 + 150K ציפים — קבועים `VIP_MIN_LEVEL` / `VIP_MIN_CHIPS`), שולחנות פוקר פרטיים (צבע/בליינדים/סיסמה/טיימר), תגמולי סטריק כניסה יומי (אבני דרך 7/14/30), בונוס הזמנת חבר (500 ציפים לשני הצדדים), דשבורד ארנק (סטטיסטיקות יומיות לפי משחק), חנות (60+ פריטי קוסמטיקה ב-15 קטגוריות + טאב מבצעים עם הנחת -30% יומית מתחלפת `DAILY_DISCOUNT`), מצב לילה (טורנירים רב-משחקיים), Rate Limiting (10 פעולות/שנייה), דיווח באגים בהגדרות, אנליטיקס.

## מצב נוכחי (עדכני ל-2026-09-01)

### ✅ הושלם ואומת חי
כל 8 הבאגים בסבב הסגירה האחרון תוקנו, עברו בדיקת בודק, ואומתו חי ב-localhost + פרודקשן:

1. **ציפים** — 3 שכבות: (A) איפוס אופטימי של `roundOutlay` דרך `clearRefunded` ref ב-roulette/coinflip/highcard; (B) `usePlayer.runReconcile` — ה-clamp של ±100K חתך תנועות `addChips` גדולות והשארית לא זומנה מחדש; תוקן לזמן ריצות חוזרות עד התכנסות; (C) HUD desync — hook `useCountUp` נכתב מחדש (מעקב displayRef, נחיתה מדויקת, טיפול ב-`document.hidden`, setTimeout גיבוי).
2. **מולטיפלייר** — baccarat outlay, SnG refund-race, BJ clearBet.
3. **קלפי hole** — redaction בפוקר/SnG/BJ + nonce ב-baccarat, מאחורי gate. ה-SQL `supabase/poker-privacy.sql` הורץ בפרודקשן.
4. **host heartbeat** — Worker ticker כל 8 שניות שורד throttling של טאב ברקע.
5. **עזיבת שולחן BJ באמצע יד** — `BlackjackScene` קיבל unmount cleanup: עזיבה מ-betting מחזירה את ההימור; מ-playing/dealer = forfeit (anti-exploit).
6. **הכספת נתקעה ב-overlay "פותח את הכספת..."** — ה-overlay הוצא מ-AnimatePresence (unmount מיידי) + setTimeout(2500) fallback + רמז "הקש להיכנס".
7. **BJ "עוד יד" דרש 2 לחיצות** + **8. סולו BJ עזיבה-וחזרה השאירה שולחן ריק** — מקור משותף: `AnimatePresence mode="wait"` סביב פקדי phase ב-BlackjackScene. הוסר.

tsc נקי, 131 טסטים ירוקים (210+ בגרסה מוקדמת).

### SQL שכבר רץ בפרודקשן
- `supabase/setup.sql` (סכמת בסיס) + `poker.sql`, `roulette.sql`, `miniGames.sql`, `telemetry.sql`, `referrals.sql`, `jackpot.sql`, `privateTables.sql`
- `supabase/poker-privacy.sql` — gate של קלפי hole
- `supabase/reset-users.sql` — כל הלא-אדמין אופסו למצב התחלתי; חדרים/היסטוריה/התראות נמחקו
- `supabase/achievements-daily.sql` — 4 פונקציות + עמודות; הישגים + בונוס יומי server-authoritative

### ⏳ נשאר (פעולת משתמש)
**אימות מולטיפלייר ב-2 דפדפנים** לפי `MP_VERIFICATION_GUIDE.md` — בדיקת באגים 2/3/4 + host handoff + קלפי hole ב-DevTools, על כל המשחקים המולטי (רולטה, קוינפליפ, היי-קארד, פוקר, BJ נגד חברים, באקרה, SnG). זה הפריט הפתוח האחרון.

### עבודה מקומית לא-committed
Redesign של ה-hub ("casino floor" layout, רולטה במרכז) + שיפורי כספת (`VaultScene.tsx`, `ItemPreview.tsx`, `AppBackdrop.tsx`, `game.css`, i18n). לא deployed.

## אילוצים קריטיים של המשתמש
- **אל תשנה שום דבר בלי בקשה מפורשת.** "אני לא רוצה שתשנה שום דבר שם אם אני לא מבקש".
- **אל תיגע ב-copy/טקסטים** מעבר למה שהתבקש במפורש.
- **תמיד השתק את כל האודיו לפני בדיקה** — הגדרות ⚙️ → כל הסליידרים ל-0. פעולה ראשונה, כל פעם.
- **תמיד תגיב בעברית.**
- כשפורט השרת משתנה — שלח URL עדכני.
- לעולם אל תשתמש ב-`service_role` key בקוד frontend.

## כניסה לבדיקה חיה
הפרויקט משתמש ב-"session-injection trick" לכניסה מהירה לפרודקשן בלי חשבון מלא (מתועד אצל המשתמש). חדרים דורשים חשבון (לא אורח); סולו עובד כאורח.
