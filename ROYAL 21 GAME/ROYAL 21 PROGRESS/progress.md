# ROYAL 21 — Progress

**Last updated:** 2026-09-04

משחק קזינו חברתי פרטי (~15 חברים, צ'יפים וירטואליים בלבד — אין כסף אמיתי). Vite + React + TS + Supabase (ref `ylhqwzokrfiwobfurkfx`).
תיקייה: `C:\CLAUDE AI\ROYAL 21 GAME`. חי: https://royal21.vercel.app (מתפרס אוטומטית מ-`origin/main`).

## Current status

**סבבים 1-3 הושלמו, אומתו (tsc/build/test:all ירוקים לכל שלב), עברו reviewer, נדחפו ל-`origin/main`.** כל הסינגל-פלייר, שכבת המולטיפלייר, מערכות הצמיחה/retention, פאנל אדמין, VIP, וחנות מורחבת — הכל באוויר.

**סבב 4 — Q1-Q4 בוצעו ואומתו (tsc/build/test:all ירוקים לכל שלב), עדיין לא נדחפו ל-`origin/main`.** נעצר לפני Q5 לפי בקשת המשתמש (רצה SQL אם צריך + אישור להמשיך). Q5-Q7 עדיין מחכים. התוכנית המלאה שמורה ב-`C:\Users\noam7\.claude\plans\swift-snuggling-harp.md`.

### ⚠️ מצב git — קריטי לצ'אט הבא
`main` הלוקאלי (של המונו-רפו `C:\CLAUDE AI`) מזוהם בקומיטים יתומים מפרויקטים אחרים (היה "AI TOWER", ייתכן שיש עוד). **העבודה של ROYAL 21 נמצאת על branch `royal21` = `origin/main` (מרוחק).**
- לפני עבודה: `cd "C:\CLAUDE AI" && git checkout royal21` (או `git fetch && git checkout -B royal21 origin/main`).
- commit על `royal21`, דחיפה: `git push origin royal21:main`.
- **תמיד `git add "ROYAL 21 GAME/..."` בנתיבים מפורשים — לעולם לא `git add -A` מהשורש** (מונו-רפו עם סשנים אחרים במקביל, לפעמים גם על `TRAIDING/`).
- commit מסתיים ב-`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- קומיט אחרון בסבב 3: `57724f5` (Stage M). לפניו: `a02b334`→`3e9f680` (BJ side-bets fix).

## What's done

### סבב 1 (2026-09-03) — 8 שלבים A–H
תוכנית ה-context המקורית של הסבב הזה **נמחקה** מקובץ ה-plan (רק סבב 4 נשאר שם, כדי לא לגרור טוקנים) — הסיכום כאן הוא המקור היחיד מעתה.
- **A — איפוס מלא:** `reset-all.sql` מרחיב (`ever_vip`, `truncate friendships`), `localStore` bump ל-v2 מנקה state ישן, `everVip` נגזר מה-DB.
- **B — Supabase מסודר + אדמין:** `supabase/README.md` (סדר הרצה + "איפה משנים X" + הגדרה חיה לכל פונקציה כפולה), `SCHEMA.sql` reference. `app_config` table + `admin_set_config` + readers exception-safe (`config_num`/`config_num_from_obj`/`config_bigint_array`) — קבועי כלכלה נשלטים מהאדמין עם fallback קשיח. `admin-tools.sql` (חיפוש/איפוס/מתן-פריט/דוחות-באג). `RequireAdmin` על `/admin`.
- **C — מסך פתיחה:** `IntroScene` שוכתב — אפס framer-motion (רק CSS keyframes), דילוג אמיתי.
- **D — פודיום שבועי כטבלה:** `WeeklyPodiumPanel`, `weekly_chip_snapshot`+`capture_weekly_snapshot()`, `claim_weekly_prize()` מדרג מול snapshot + הודעה `podium_prize`. מחיקת הודעות.
- **E — אודיו:** מוזיקה עשירה יותר (8 אקורדים, בס+pad), SFX מחודדים, toggle "השתק הכל".
- **F — presence + צ'אט חברים:** heartbeat 25s, `isFriendOnline` (presence+last_seen<60s) בכל מקום, `direct_messages` + `DmThread`.
- **G — חנות (סבב ראשון):** `bundles` table + `buy_pack()` אטומי (ההנחה סוף-סוף נגבית), `todaysRareRotation` חובר, 18 פריטים חדשים.
- **H — הודעת כניסה + עיצוב דמות:** toast "חבר נכנס", `AvatarEditor` (skin/hair).
- **ביניים חשוב:** 170 קבצי `.js` מקומפלים חזרו והצלילו את ה-tsx — שורש: `package.json` script `typecheck` היה `tsc -b --noEmit false` (פולט JS!). תוקן ל-`tsc --noEmit`. **כלל קבוע: לעולם לא להריץ `npm run typecheck` — רק `npx tsc --noEmit`.** אם עריכה "לא מופיעה": `find src -name '*.js' -not -path '*/node_modules/*' -delete` קודם.
- באקרה: אין באג אמיתי ב-TS (מה שהמשתמש ראה = `engine.js` ישן שהוצל). עמלת בנקאי הפכה מתכווננת (`app_config.baccarat_banker_payout`).
- playtime מצטבר: `profiles.playtime_seconds` + `add_playtime()`.

### סבב 2 (2026-09-04) — תיקונים + ליטושים (J·I·K·L·H)
- **J — באגי MP:** מתנת צ'יפים זיכתה **פעמיים** (RPC + client) — תוקן, ההודעה receipt-only נושאת `new_balance`. רולטה MP — כפתור "סיימתי להמר" (action `ready` שכבר היה ב-engine, לא בשימוש) + countdown 15ש, בוטל כפתור "סובב עכשיו" של המארח.
- **I — פוקר/SnG:** badge פעולה + ז'יטון לקופה, `showCards`/"הצג קלפים" + `HandOverBar` (6ש), תווית `bestHand`, `showMoment` למנצח, **תיקון all-in שחשף מנצח מוקדם** (`displayStacks` מוקפא ב-`useReveal`, גם ב-cash וגם ב-SnG, כולל תרחיש "cold client").
- **K — HUB/קוסמטי:** הוסר גביע `ev_weekly_winner`, `StreakBadge` עוצב מחדש, כרטיס "הזמן חבר" קיבל אייקון נפרד, `SettingsPanel` מהיר (לא מנווט מחוץ למשחק).
- **L — חנות:** הוסרו 5 מטבעות currencySkin בעייתיים, נוסף `cf_holo` + "ערכת שולחן מלכותית", טאב "הכל" ממוין, 5 ז'יטונים חדשים.
- **H — המשך:** toast כניסה + `AvatarEditor`.

### סבב 3 (2026-09-04) — reworks גדולים (P·O·N·M)
- **P — חנות מורחבת:** "מיוחד היום" מאוחד (סלוט אחד מסתובב), אדמין תן/ראה-הכל, **שולחן אישי** (`rooms.config.tableSkin/bgSkin` מהמארח — BJ/פוקר/SnG/באקרה בלבד, חלקי!), **טייטלים** (`equipped.title`, 7 נקנים+4 בהישג), **צבע שם** (`equipped.nameColor`, פלטה של 10), +12 פריטי לבוש. טייטל+צבע חוברו למושבי פוקר/BJ, צ'אט, לוח.
- **O — VIP rework:** זכאות = **רמה 5 בלבד**. סולם `vipTier(level)`: ברונזה 5 / כסף 12 / זהב 22 / יהלום 35. `vipTierOf`→`shopDiscountTier` (rename, היה overload). `supabase/vip.sql`: `claim_vip_daily`/`claim_vip_cashback`/`claim_vip_stipend`/`fetch_vip_state`, סכומים מ-`app_config`. 14 פריטי VIP בלעדיים (בעלות נגזרת מדרגה — **5 מהם התבררו מתים לגמרי, ראה "ידוע" למטה**). `VipScene` שוכתב.
- **N — ערב חברה (רוב הרוב, ראה סבב 4 להמשך/מחיקה!):** roster צומצם, רולטה נוספה, הייקארד קיבל מודל ante-אחיד, **משחק חדש "גבוה/נמוך הישרדות"** (`src/games/highlow/*`) מקצה לקצה, **BJ MP הימורי-צד** נפתחו (וחשפו/תיקנו באג כסף אמיתי — `claim_blackjack_payout` לא כלל `sideResults`). דואל ב-Night דולג.
- **M — תשתית חדרים:** **תיקן את "BJ/דואל עם חברים לא מכניס שחקן שני"** — `rooms.active_game` (jsonb ברמת חדר) + hook `useFollowHost` גנרי ש-RoomScene+NightScene שניהם משתמשים בו. דיל-גייט cash מחכה לשחקן שני. מות מארח מהיר יותר (poll 2s, חלון 15s). `roomCapacity()` מקור יחיד. **טרם אומת חי ב-2 דפדפנים.**

### סבב 4 (2026-09-04) — Q1-Q4 בוצעו, לא נדחפו עדיין
- **Q1 — מחיקת "ערב חברה" + "גבוה/נמוך הישרדות" לגמרי.** NightScene/useNightReturn/useNightScoring/night.ts + כל `src/games/highlow/*`+service+store+test נמחקו. Routes `/night/:roomCode`+`/game/highlow/room/:roomCode` הוסרו. אינטגרציות Night הוסרו מרולטה/coinflip/slots/scratch/highcard/BJ (`activeMiniGame`/`reportResult`/`setActiveMiniGame` הוסרו — היו dead-in-practice). הייקארד: `nightAnte`/`anteMode`/`NIGHT_ANTES` הוסרו לגמרי (היו תלויים אך ורק ב-`?night=`). `'highlow'` הוסר מ-`GameKey`. Hub card הוסר. `ev_night_champion` הוסר מ-`achievements.ts` + DELETE נוסף ל-`event-trophies.sql`. i18n `night.*`/`highlow.*` נוקה. **⚠️ נשארו dead:** `king_of_night`/`legend_of_night` (achievements) תלויים ב-`stats.nightWins` שקפוא לצמיתות — לא נמחקו (לא התבקש במפורש), החלטה פתוחה למשתמש.
- **Q2 — 3 תיקונים קטנים:** (a) `nc_cream`→`#e8dcc0`, `nc_neon`→`#39ff8f` ב-`items.ts` **וגם** ב-`supabase/setup.sql` (seed עם `on conflict do update` היה דורס בחזרה לצבעים הישנים אם לא מתעדכן שם). (b) כרטיס "ערכת שולחן מלכותית" — תג "חבילה" + מחיר מוזל (52,800) עם קו על המקורי (88,000), ב-`VaultScene.tsx`. (c) `displayPot` נוסף ל-`useReveal.ts` (אותו דפוס כמו `displayStacks`) — `PokerScene.tsx`+`SitAndGoScene.tsx` קוראים ממנו במקום `state.pot` הגולמי.
- **Q3 — השלמת שולחן אישי:** bgSkin נוסף ל-`PokerScene`/`SitAndGoScene`/`BaccaratScene` (tableSkin כבר היה). tableSkin+bgSkin נוספו מאפס ל-`RouletteScene`/`CoinFlipScene`/`HighCardScene` (room mode בלבד, סולו לא נגע). תג "השולחן של X" (`rooms.customTable` i18n) — מוצג רק כש-tableSkin ≠ ברירת המחדל `tb-green`. **⚠️ לא נוסף ל-BlackjackScene** (היחיד שכבר עבד נכון קודם) — פער עקביות קטן, לשקול ב-Q7.
- **Q4 — VIP אמיתי:** 4 מסגרות CSS מדורגות (`fr-vip-bronze/silver/gold/diamond` ב-`game.css`) — ברונזה פשוטה→יהלום עם `@keyframes` פעימה. שולחן יהלום (`tb-vip-diamond`) עם מרקם+shimmer ייחודי. אפקט ניצחון יהלום (`vc-vip-diamond`) ב-`VictoryEffect.tsx` — case ייעודי, יותר חלקיקים/משך מכל אפקט אחר. **הוחלט לא להוסיף** victory effects לברונזה/כסף/זהב — אין להן payload `victory` בכלל ב-`items.ts` (שינוי מודל נתונים גדול יותר מהמשימה).
- **טרם בוצע:** commit+push, SQL ל-ev_night_champion (המשתמש צריך להריץ), בדיקה חיה של Q1-Q4 (רק tsc/build/test — לא דפדפן).

### SQL — הצטבר, ככל הנראה כולו רץ עד Stage M (לוודא בצ'אט הבא)
כל שלב שלח `RUN-THIS-NEXT.sql` מרוכז (הקובץ מוחלף בכל שלב, לא מצטבר — המשתמש רץ ברצף). האחרון שנשלח = Stage M (`rooms.active_game` + `reassign_room_host` window). **אם משהו "לא עובד" בפרודקשן — לבדוק קודם אם קובץ SQL כלשהו לא רץ.**

## What's left / next steps

**סבב 4 — תוכנית מלאה ב-`C:\Users\noam7\.claude\plans\swift-snuggling-harp.md` (Q1-Q7). לא בוצע. מחכה ל"תתחיל" מהמשתמש.**

בדיקה חיה + חקירת קוד (3 סוכנים) אחרי סבב 3 העלו 9 דברים, סודרו קל→קשה:
1. **Q1 — למחוק את "ערב חברה" לגמרי**, כולל המשחק "גבוה/נמוך הישרדות" (אין לו נגישות מחוץ ל-Night, נמחק יחד). מפשט את Q6.
2. **Q2 — 3 תיקונים קטנים:** (a) צבעי שם כפולים בחנות (`nc_cream`≈ברירת מחדל, `nc_neon`≈`nc_jade`) — להחליף לגוונים מובחנים. (b) כרטיס "ערכת שולחן מלכותית" מטעה (מציג מחיר מלא 88,000 כאילו פריט בודד; המחיר האמיתי אחרי הנחה 52,800) — להוסיף תג "חבילה" + מחיר מוזל. (c) **פוקר all-in — הקופה בראש המסך** (`state.pot`) נקראת גולמית ולא דרך ה-staging, מתאפסת מוקדם מדי — להוסיף `displayPot` ב-`useReveal.ts` (אותו דפוס כמו `displayStacks`).
3. **Q3 — השלמת שולחן אישי:** כרגע רק BJ מלא (felt+רקע); פוקר/SnG/באקרה = felt בלבד; רולטה/coinflip/highcard = כלום. להשלים + להוסיף אינדיקציה גלויה "השולחן של X".
4. **Q4 — VIP אמיתי:** 5 מתוך 14 הפריטים **מתים לגמרי** (4 מסגרות בכל הדרגות + שולחן יהלום — אין להם CSS בכלל). אפקט ניצחון יהלום נופל ל-fallback גנרי. המשתמש: כל 4 הדרגות מקבלות עיצוב אמיתי ומדורג (ברונזה עדינה → יהלום מרהיב).
5. **Q5 — דליפת קוסמטיקה במולטיפלייר (הכי גדול, הכי חמור).** שורש מדויק: `BjSeat`/פוקר `Seat` מעולם לא קיבלו שדות `chipSkin`/`cardFace`/`cardBack` per-seat (בניגוד ל-`title`/`nameColor` שכן נעשו נכון). כל רינדור מושב-יריב קורא בטעות מ-`profile.equipped.*` **המקומי** — כל שחקן רואה את **הסקין של עצמו** על שני המושבים. לתקן ב-בלאק'ג'ק + פוקר/SnG (באקרה לא בסקופ הפעם) בדיוק לפי הדפוס שעבד ל-title/nameColor.
6. **Q6 — מסך סיום BJ-עם-חברים:** להסיר כפתור "עוד יד" + auto-advance-לאותה-סצנה. חדש: להחזיק תוצאה גלויה ~4-5ש → לנווט את כולם אוטומטית חזרה ל-`/room/:code` (לובי, אותם חברים).
7. **Q7 — סבב QA/ליטוש כללי** (בסוף, אחרי שהכל יציב) — מעבר שיטתי: קונסול, מצבי ריק/שגיאה, i18n, עקביות עיצובית, מובייל, קוד מת.

**לא באג (רק להסביר למשתמש כשעולה):** פיצול אסים ב-BJ עובד תקין בכל מצב — שתי הידיים ננעלות עם קלף אחד אחרי הפיצול, זה כלל קזינו סטנדרטי, לא הבדל solo/room.

**רעיון עתידי (לא בתוכנית):** משחקי ארקייד — המשתמש הזכיר כרעיון, לדחות לשיחת תכנון נפרדת.

**בדיקה חיה שעדיין חסרה מהמשתמש (מסבבים קודמים, לא דחוף אבל פתוח):** Stage M (BJ/דואל עם חברים) ב-2 דפדפנים — השלב הכי מסוכן, לא אומת חי עדיין.

## Key decisions & context

- **הסוכנים:** הסשן הראשי = מנהל-הפרויקט (לא מפעיל "מנהל" כסוכן נפרד). מאציל ל-`builder` (חוסם, `run_in_background:false`), `reviewer` רק לכסף/MP/redaction/גדול, `designer` רק ל-UI אמיתי (לא נעשה בו שימוש בפועל השלבים האחרונים — רוב הוויזואל נעשה ע"י builder + CSS). מוגדר ב-`C:\CLAUDE AI\CLAUDE.md`.
- **תבנית עבודה שהתבססה:** בנאי מקבל batch של כל התיקונים בשלב אחת, מאבחן+מתקן+מאמת (tsc+build+test:all), מדווח diff. אם כסף/MP/redaction → reviewer עם prompt ממוקד לחוסמים אפשריים. תיקוני reviewer קטנים — לפעמים אני (הסשן הראשי) מתקן ישירות בלי סבב בנאי נוסף, לפעמים שולח בחזרה לבנאי. אחרי אימות — commit מפורש בנתיבים + push + `RUN-THIS-NEXT.sql` מרוכז אם יש SQL + `SendUserFile` + עדכון progress.md.
- **`RUN-THIS-NEXT.sql`:** קובץ יחיד שמוחלף (לא מצטבר) בכל שלב שדורש SQL — מרכז את כל מה שהמשתמש צריך להריץ מאותו שלב, גם אם זה כמה קבצי מקור. נשלח תמיד עם `SendUserFile` + כותרת שאומרת מה זה.
- **dev/build:** `PORT=5199 npm run dev`. **לעולם לא `npm run typecheck`** (script שבור בעבר — פלט JS; תוקן, אבל להיזהר). תמיד `npx tsc --noEmit` + `npm run build` + `npm run test:all`. אם עריכה "לא מופיעה" — `find src -name '*.js' -not -path '*/node_modules/*'` קודם, למחוק אם יש.
- **בדיקת דפדפן:** ה-Browser pane של Claude **לא אמין לQA ויזואלי** (מקפיא אנימציות, מרנדר לא-עקבי) — שימושי לבדיקות DOM/JS בלבד. **המשתמש הוא המאמת הויזואלי וה-2-דפדפנים תמיד.**
- **framer-motion:** אסור לרקעים/overlays — `animate`/`AnimatePresence`/`exit` נתקעים ומשאירים overlay חוסם. רק CSS `@keyframes` + רינדור מותנה `{open && …}`.
- **git:** ראה "מצב git" למעלה — branch `royal21`, נתיבים מפורשים תמיד.
- **admin:** email `noamshay1010@gmail.com`.
- **המשתמש:** עברית · השתקת **כל** האודיו לפני בדיקה · batch של תיקונים · החלטה-ופעולה במקום סקירת אופציות · רגיש לעלות טוקנים (**קובץ ה-plan מכיל רק את הסבב הנוכחי, לא היסטוריה — טרימו אותו ב-2026-09-04 כי ExitPlanMode מציג את כל הקובץ**) · אוהב שאלות ממוקדות (AskUserQuestion) לפני תוכניות גדולות, לא שאלות טקסט חופשי · ביקש במפורש "אל תתחיל לבנות עד שאני אומר 'תתחיל'" — לכבד את זה תמיד.
- **תוכנית פעילה:** `C:\Users\noam7\.claude\plans\swift-snuggling-harp.md` — מכיל רק את סבב 4 (Q1-Q7). לקרוא בתחילת הצ'אט הבא.

## Known issues / open questions

- **סבב 4 לא בוצע** — 9 דברים מחכים לבנייה (ראה "What's left").
- **Stage M לא אומת חי** ב-2 דפדפנים — BJ/דואל עם חברים, הכי חשוב לבדוק.
- **דליפת קוסמטיקה במולטיפלייר** (Q5) — באג פעיל כרגע בפרודקשן: שחקנים ב-BJ/פוקר MP רואים את הסקין (קלפים/ז'יטונים) של עצמם על שני המושבים, לא את של היריב.
- **VIP — 5/14 פריטים מתים** (Q4) — מסגרות + שולחן יהלום לא עושים כלום ויזואלית כרגע.
- **פוקר — קופה בראש המסך דולפת מוקדם** ב-all-in (Q2c) — לא באותו מקום כמו התיקונים הקודמים (displayStacks תקין, זה `state.pot` הגולמי).
- **`activeMiniGame`** (ה-legacy field על `BjState`, לפני Stage M) — לא בשימוש יותר אחרי המעבר ל-`rooms.active_game`, אבל לא הוסר מה-types — נקי לניקוי ב-Q7.
- דחיפה ל-`origin` איטית — ~125MB קבצי BLACKJACK 3D ישנים מקומיטים קודמים במונו-רפו.
- host-death freeze צומצם (M) אך לא אפס — אם נשארו רק אורחים (לא-מחוברים) בחדר, אף אחד לא יכול לתפוס host (השרת דורש session אמיתי). לא בסקופ.
