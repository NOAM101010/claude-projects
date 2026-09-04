# ROYAL 21 — Progress

**Last updated:** 2026-09-03

משחק קזינו חברתי פרטי (~15 חברים, צ'יפים וירטואליים בלבד — אין כסף אמיתי). Vite + React + TS + Supabase.
תיקייה: `C:\CLAUDE AI\ROYAL 21 GAME`. חי: https://royal21.vercel.app (מתפרס אוטומטית מ-`origin/main`).

## סבב 2 (2026-09-04) — תיקונים + ליטושים

תוכנית: `swift-snuggling-harp.md` "סבב 2". סדר: J→I→K→L→H → תוכנית reworks גדולים (ערב חברה + VIP).
- **STAGE J ✅ נדחף** (`d6f21a7`). J1: מתנת צ'יפים זיכתה פעמיים (RPC + client both) — ההודעה עכשיו receipt-only, נושאת `new_balance`, הקליינט `setChips`. J2: רולטה MP — כפתור "סיימתי להמר" (action `ready` שכבר היה ב-engine) + countdown 15ש, הגלגל ננעל רק כש-`every(ready)`, הוסר כפתור "סובב עכשיו" של המארח. reviewer: חוסם realtime-visibility תוקן. **המשתמש צריך להריץ `RUN-THIS-NEXT.sql` (send_gift + claim_weekly_prize מעודכנים).**
- **STAGE I ✅ נדחף** (`56638f3`). פוקר/SnG: badge פעולה + ז'יטון לקופה (מ-`seat.lastAction` שכבר היה ב-state); `showCards` action + `revealed[]` + `HandOverBar` (countdown 6ש, `NEXT_HAND_DELAY_MS`); תווית `bestHand` מתחת לקלפים; `showMoment` למנצח יד + knockout/placement ב-SnG; **תיקון all-in שחשף מנצח מוקדם** — `displayStacks` מוקפא ב-`useReveal`, log/alive/moments גדורים על `!revealing`, river all-in כופה חלון reveal. reviewer נקי. אין SQL. **ממתין לבדיקה חיה 2-דפדפנים.**
- **STAGE K ✅ נדחף** (`e87f41a`). K1: הוסר גביע `ev_weekly_winner` (הפרס הכספי נשאר). K2: `StreakBadge` עוצב מחדש — צבע tier (ברונזה/כסף/זהב) + להבה מונפשת CSS. K3: כרטיס "הזמן חבר" קיבל `InviteArt` ✈️ (היה 🎁 כפול). K4: `SettingsPanel` — גלגל השיניים ב-HUD פותח פאנל אודיו מהיר במקום לנווט (מונע teardown של משחק חי). **הרצה: `RUN-THIS-NEXT.sql` = `delete ... ev_weekly_winner`.**
- **STAGE L ✅ נדחף** (`69b4805`). הוסרו 5 מטבעות ה-currencySkin מסבב G (+ migration שמנקה equipped/user_items). נוסף `cf_holo` (mythic, shimmer CSS) + חבילת "ערכת שולחן מלכותית" (`pack_royal_suite`, -40%, נדירה). טאב "הכל" ממוין ומקובץ לפי קטגוריה+נדירות עם כותרות. 5 ז'יטונים חדשים (`ck-royal/jade/crimson/frost/rosegold`). reviewer: חוסם seed תוקן. **הרצה: `RUN-THIS-NEXT.sql` (מחיקת מטבעות + seed פריטים חדשים).**
- **STAGE H ✅ נדחף** (`01a4f50`). H1: toast "חבר נכנס למשחק" + צליל כשחבר עובר offline→online (debounce 10 דק', מדלג על refresh ראשון, מכבד showPresence, לא יוצר notification). H2: `AvatarEditor` מודל (skin/hair, תצוגה חיה) מ-`MyRoomScene` — נשמר דרך `setAvatar`→`syncProfile`; פריטי חנות לא נגעו. אין SQL.

- **תיקון המשך (`1431c48`)** — all-in חשף מנצח מוקדם **גם בפוקר cash** (לא רק SnG). השורש היה ב-`useReveal.ts` עצמו: "cold" client (non-host שפספס את שלב ההימורים) קיבל showdown מסודר כפריים ראשון → דילג על staging. תוקן: cold all-in showdown מריץ runout מ-0; `displayStacks` נגזר מ-`stack - showdown.won`.

**סבב 2 הושלם (J·I·K·L·H).**

## סבב 3 — reworks גדולים (2026-09-04). תוכנית: `swift-snuggling-harp.md` "סבב 3". סדר: P→O→M→N.
- **STAGE P ✅ נדחף** (`16dec5b`, `cb3b9b9`, `3e8ea8e`).
  - P0: "בלעדי היום"+"נדיר היום" אוחדו לסלוט "✨ מיוחד היום" אחד שמסתובב על כל הפול.
  - P0b: אדמין — כפתור "תן הכל" (קיים) + גלריית קטלוג "📦 כל הפריטים".
  - P1: שולחן/רקע של המארח נכתב ל-`rooms.config` (`tableSkin`/`bgSkin`); BJ/פוקר/SnG/באקרה בחדר מרנדרים אותו.
  - P2: טייטלים (`equipped.title`) — 7 נקנים + 4 נפתחים בהישג (בעלות נגזרת מ-`profiles.achievements`). `ttl_rookie` = starter. רכיב `PlayerName`.
  - P3: צבע שם (`equipped.nameColor`) — פלטה של 10.
  - P4: +4 משקפיים, +3 שעונים, +3 שרשראות, +2 דילרים.
  - טייטל+צבע מרונדרים במושבי פוקר/BJ, צ'אט, לוח מנהיגים, פאנל חברים.
  - reviewer: חוסם `ttl_rookie` starter-grant תוקן. **הרצה: `RUN-THIS-NEXT.sql` (עמודת `unlocked_by` + seed 28 פריטים + backfill טירון).**
  - **park:** אנימציית חלוקה/זריקת ז'יטונים. **דילג:** `tableSkin` ברולטה/coinflip/highcard (אין felt skin-able).
- **STAGE O — VIP rework ✅ נדחף** (`c3b968b`). זכאות = רמה 5 בלבד (בלי סף צ'יפים / everVip). סולם `vipTier(level)` — ברונזה 5 / כסף 12 / זהב 22 / יהלום 35. `vipTierOf`→`shopDiscountTier` (rename — היה overload). `supabase/vip.sql`: `claim_vip_daily` (בונוס דרגה 24ש), `claim_vip_cashback` (% הפסד נטו מול `weekly_chip_snapshot`, כסף+, שבועי), `claim_vip_stipend` (קצבה, זהב+, שבועי), `fetch_vip_state`. סכומים מ-`app_config`. 14 פריטי VIP בלעדיים (price 0, בעלות נגזרת מדרגה). שורת צ'יפים גבוהים גם ב-slots. `VipScene` שוכתב (כרטיס דרגה + 3 כפתורי claim + מדף קוסמטיקה). reviewer: תוקן type של `fetchVipState` + cashback no_snapshot cooldown. **הרצה: `RUN-THIS-NEXT.sql` (3 חלקים בקובץ אחד: item seed + app-config מלא + vip.sql).**
- **STAGE N1 (ערב חברה) — בעבודה.**
  - `51afe29` — roster: הוסרו slots/coinflip/scratch. `sessionStorage` keyed לחדר.
  - `0a94616` — **רולטה נוספה** (`useNightReturn`+`useNightScoring`, double-report guarded). **הייקארד ב-Night = ante אחיד** (מארח בוחר 500/1k/2.5k/5k, כולם משלמים, מנצח לוקח את הקופה; `nightAnte` action + `anteMode`). ניקוד `pointsFor(game,outcome)`. reviewer נקי. **אין SQL.**
  - **N2 — "גבוה/נמוך הישרדות" ✅ נדחף** (`a50cb02`). משחק MP חדש מקצה לקצה: ante אחיד, קלף בסיס, ניחוש גבוה/נמוך בו-זמני (טיימר 8ש), טעות/timeout=הדחה, תיקו=push, אחרון לוקח קופה. `src/games/highlow/*` (engine+types+redact+scene) + `useHighLowRoom`+`highlowService` + מסלול/roster/ניקוד/8 מושבים. reviewer: 2 חוסמים תוקנו (חלוקת wipe לא הייתה zero-sum + חלוקה באפס כשאף אחד לא ניחש — עכשיו הסיבוב מבוטל). **הרצה: `RUN-THIS-NEXT.sql`** (seat check 0-7 + `enforce_room_capacity`).
  - **נשאר ל-N:** דואל ב-Night (דורש החלטת ארכיטקטורה) · BJ MP הימורי-צד + תגית מושב (נוגע כסף) · עוד משחקי מסיבה (לפי רצון).
- STAGE M — תשתית חדרים (בסוף, לבקשת המשתמש).
- *doc drift ידוע:* `SCHEMA.sql`/`README.md` לא עודכנו ל-`items.vip_tier` + `profiles.vip_*_claimed` + RPCs של VIP — לסדר בשלב ניקוי.

## Roadmap חדש (2026-09-03) — 8 שלבים A–H

### ביניים (2026-09-03, `3969ecf`) — ניקוי .js + באקרה + playtime
- **170 קבצי `.js` מקומפלים חזרו ל-`src/`** (הצללו tsx ב-Vite). שורש: `package.json` script `typecheck` היה `tsc -b --noEmit false` — פלט JS. תוקן ל-`tsc --noEmit`; `build` → `tsc --noEmit && vite build`. **אם עריכה "לא מופיעה": `find src -name '*.js' -delete` קודם. אל תריץ `npm run typecheck` הישן.**
- **באקרה — אין באג אמיתי ב-TS** (מה שהמשתמש ראה = `engine.js` ישן). עמלת בנקאי הפכה מתכווננת: `app_config.baccarat_banker_payout` (0.95 default, 1.0 = בלי עמלה) → `settleOne`/`BaccaratState`, host-authoritative ב-MP. טסט `scripts/baccarat.test.ts` (16) ב-`test:all`.
- **playtime מצטבר:** `profiles.playtime_seconds` + `add_playtime(sec)` RPC (clamp 0..3600). accumulator ב-`App.tsx` (flush /60ש + pagehide). תצוגה: MyRoomScene + כרטיס אדמין.
- **הרצה ב-Supabase:** `app-config.sql` (חוזר) → `playtime.sql` (חדש) → `admin-tools.sql` (חוזר).


תוכנית מלאה: `C:\Users\noam7\.claude\plans\swift-snuggling-harp.md`. סדר: A→C→D→B→F→E→G→H.
- **STAGE A — איפוס מלא ✅ נדחף** (`a0c269a`). `reset-all.sql` הורחב (עמודת `ever_vip`, איפוסה, `truncate friendships`); `localStore` bump `royal21.save.v1`→`v2` + `migrateToV2()` שמנקה save ישן + `daily.v1.*` + `ref`; `rowToProfile` ממפה `ever_vip`→`everVip`. **המשתמש צריך להריץ `supabase/reset-all.sql`.** tsc/build/test ירוקים.
- **STAGE C — מסך פתיחה ✅ נדחף** (`45a600e`). `IntroScene` שוכתב מאפס — אפס framer-motion, אנימציית CSS keyframes בלבד (opacity/transform) בסגנון `AuthScene` (מסגרת זהב + רקע ירוק), לוגו "ROYAL 21" נחשף, כפתור "דלג" תמיד גלוי שמנווט החוצה מיד. ~1.3ש auto-advance (~0.38ש לחוזר/reduced-motion). keyframes ב-`game.css` בלוק INTRO. tsc/build/test ירוקים. **ממתין לאישור ויזואלי של המשתמש.**
- **STAGE D — פודיום כטבלה + הודעות ✅ נדחף** (`15fe06b`). `WeeklyPodiumPanel` חדש (טבלה חיה: אתה + חברים לפי chips, מדליות top-3, דירוג, טיימר). `weekly_chip_snapshot` + `capture_weekly_snapshot()` (ISO week שהסתיים). `claim_weekly_prize()` שוכתב — דירוג מול snapshot, מזכה + הודעת `podium_prize`. מחיקת הודעות (✕ לכל שורה). reviewer נקי. **המשתמש צריך להריץ `supabase/weekly-snapshot.sql` ואז `supabase/weekly-podium.sql`.**
- **STAGE B — Supabase + אדמין ✅ נדחף** (`575372f`). `supabase/README.md` (סדר הרצה + מפת "איפה משנים X" + הגדרה חיה לכל פונקציה כפולה); `SCHEMA.sql` reference. `app-config.sql` — טבלת `app_config` + `admin_set_config` (ולידציה per-key) + readers exception-safe (`config_num`/`config_num_from_obj`/`config_bigint_array`); `send_gift`/`claim_daily_bonus`/`claim_weekly_prize`/`claim_mission` קוראים config עם fallback קשיח. `admin-tools.sql` — `admin_find_player`/`reset_player`/`grant_item`/`revoke_item`/`set_level(target)`/`list_bugs`/`resolve_bug`. `AdminScene` — סקשנים: עזרה לשחקן / דוחות באג / כוונון כלכלה. `RequireAdmin` על `/admin`. reviewer מצא 4 חוסמי cast-crash → תוקנו. **הרצה ב-Supabase בסדר: `app-config.sql` → `streak-rewards-v2.sql` → `gift-limit-50k.sql` → `missions.sql` → `weekly-podium.sql` → `admin-tools.sql`.**
- **STAGE F — presence + צ'אט חברים ✅ נדחף** (`c8e462b`). Heartbeat 25s (Worker ticker) → `last_seen`/presence/game; pagehide → offline beacon. `lib/presence.isFriendOnline` (presence≠offline && last_seen<60s) בכל מקום. הזמנה חסומה למי שלא-מחובר או באמצע משחק. `direct_messages` (RLS: רק חברים, block-aware, throttle 15/60s) + `dmService` + `DmThread` בתוך FriendsPanel + badges. `subscribe` עם debounce 1.5s (מונע flicker מ-heartbeat). reviewer: 1 חוסם (game leak) תוקן. **המשתמש צריך להריץ `RUN-THIS-NEXT.sql` (= `direct-messages.sql`).**
- **STAGE E — אודיו + הגדרות ✅ נדחף** (`32cfc4e`). מוזיקה: 8 אקורדים (ii-V-i lounge, היה 4) + בס עם תווי מעבר + שכבת pad + וריאציה כל 8 תיבות + zone shaping. SFX: win/bigWin ארפג'יו+shimmer, blackjack ייחודי, chip/card מחודדים, lose/bust רכים. הגדרות: toggle "השתק הכל" (שומר+משחזר, persisted) + preview. אין SQL. **ממתין לאימות שמיעה של המשתמש.**
- **STAGE G — חנות ✅ נדחף** (`126fb28`). `bundles` table (מקור אמת בשרת) + `buy_pack(p_pack_id)` אטומי — סוף-סוף גובה את הנחת החבילה (הלולאה הישנה קנתה במחיר מלא). `todaysRareRotation` (היה dead code) → סקשן "נדיר היום" + עמודות דגל `rare_rotation_only`/`daily_rarity_only`. 18 פריטים חדשים (cards/backs/tables/frames/victory/currencySkin) + 3 חבילות נושאיות. reviewer: חוסם pack-forgery → תוקן. **המשתמש צריך להריץ `RUN-THIS-NEXT.sql` (= `buy-pack.sql`).**
- STAGE H — (אופ') כניסה+דמות.

**נותר לבדיקה חיה של המשתמש:** מסך פתיחה (C), אודיו (E), פודיום 2-דפדפנים (D), presence+צ'אט 2-דפדפנים (F), קניית חבילה + סבב נדיר (G). + בדיקת MP הכללית מ-`MP_VERIFICATION_GUIDE.md`.

## Current status

**כל הפיתוח שתוכנן הושלם, אומת (tsc/build/test:all/i18n ירוקים לכל שלב), נבדק ב-reviewer, ונדחף ל-`origin/main`.**
הסינגל-פלייר, שכבת המולטיפלייר, ומערכות הצמיחה/retention — כולם באוויר.

**מה שנשאר: בדיקת מולטיפלייר חיה עם 2 דפדפנים אמיתיים** (רק המשתמש יכול — Claude לא יכול להריץ 2 שחקנים בו-זמנית). זה הצעד הבא היחיד.

### ⚠️ מצב git — חשוב לצ'אט הבא
`main` הלוקאלי מזוהם ב-7 קומיטים יתומים של פרויקט "AI TOWER" (סשן אחר עשה `git add -A` מהשורש של המונו-רפו וסחף פנימה קבצים). **העבודה של ROYAL 21 נמצאת על branch `royal21` = `origin/main`.**
- לפני עבודה: `cd "C:\CLAUDE AI" && git checkout royal21` (או `git fetch && git checkout -B royal21 origin/main`).
- commit על `royal21`, דחיפה: `git push origin royal21:main`.
- **תמיד `git add "ROYAL 21 GAME/..."` בנתיבים מפורשים — לעולם לא `git add -A` מהשורש** (מונו-רפו עם סשנים במקביל).
- כשהיתומים של AI TOWER יטופלו אפשר `git checkout -B main origin/main`.
- קומיט אחרון: `f99c27a`. שרשרת: `8abee17..f99c27a`.

## What's done

### שלב 1 — סינגל-פלייר + באגים + Hub redesign (הושלם בצ'אטים קודמים)
- כל המשחקים סולו עובדים, כלכלה מדויקת, קלפי-hole מוסתרים (redaction + RPCs).
- Hub עוצב מחדש (רצפת קזינו, `AppBackdrop` CSS-only), לוח מנהיגים גלובלי+חברים.
- באגים שנסגרו: ציפים bet/clear (3 שכבות), host heartbeat (Web Worker), עזיבת שולחן BJ, כספת נתקעת, "עוד יד" 2 לחיצות.

### שלב 2 — רה-ארכיטקטורת מולטיפלייר (4 שלבים, נדחף, reviewer אישר)
- **Stage 1** (`0d949a9`) — gate "כל היושבים מוכנים → התחלה מיידית" (bj/duel/poker-cash/coinflip/highcard); פוקר cash auto-start כמו SnG (הוסר Ready ידני); coinflip/highcard auto-flip/draw כשכולם נתנו ante; hook משותף `useGhostSeatCleanup` ב-7 סצנות; phase `'waiting'` + abort-round ב-roulette/coinflip/highcard; refund על עזיבה באמצע סיבוב.
- **Stage 2** (`bcc4f35`) — רולטה MP: תיקון הגלגל שלא הסתובב אצל non-host (רגרסיית spinAt); כפתור "סובב" עובד עם 2 שחקנים; joiner נכנס כשחקן לסיבוב הבא; auto-continue אחרי settle.
- **Stage 3** (`5dc058d` + `37ed6a0`) — דואל = נקודות בלבד, אין betting UI (כפתור "מוכן" בלבד), `duel.pot` קפוא לפי מספר שחקנים ב-start, עוזב → הנותר לוקח את הקופה. הוסר "BLACKJACK PAYS 3 TO 2" (המתמטיקה 3:2 נשארה). Double מוסתר בדואל; **Split נשאר בדואל** (מוסיף נקודות, לא גובה ז'יטונים).
- **Stage 4** (`6922ec2`) — ערב חברה: רק המארח בוחר משחק והבחירה שואבת את כולם פנימה (`activeMiniGame` + auto-navigate); leaver מסומן "עזב" בלוח. SnG + cash poker: effect ה-settle גודר על `!revealing` — "ניצחת בטורניר" לא מקדים את חשיפת הקלפים.
- **מגבלה ידועה:** host-death freeze עדיין ~5-25ש (`reassign_room_host` חלון 20ש). לא בסקופ.

### שלב 3 — כוונונים אחרי משוב המשתמש (נדחפו)
- **כניסת אורח הוסרה** (`d8d7d36`) — רק הרשמה/כניסה עם חשבון (התקדמות נשמרת לחברים שמשחקים פעם בחודש).
- **מתנת צ'יפים 500 → 50,000/יום** (`d8d7d36` + `gift-limit-50k.sql` הורץ).
- **166 קבצי `.js` מקומפלים** שהצלילו את ה-`.tsx` ב-Vite — נמחקו + `.gitignore` guard (`365765c`, `dcd7704`). אם עריכה "לא מופיעה" אחרי restart+cache-clear — `find src -name '*.js'` קודם.
- **אינטרו** — הוחזר למקורי (הטיסה הקולנועית ירדה). **מסך התחברות** — רקע ישן + מסגרת זהב וקלפים דקורטיביים חדשים (`22dd456`, `1d6cbd3`).
- **פוקר/SnG:** טיימר פעולה קבוע **60ש** (הבורר הוסר מהמודל); בליינדים ב-SnG כל **2 דקות** (`3882d48`).
- **באקרה:** הימור **תיקו הוסר** (`'tie'` נשאר תוצאה → push); **חשיפת squeeze** — כל הקלפים הפוכים, נחשפים אחד-אחד בסדר חלוקה, התוצאה/הזיכוי מוקפאים עד הסוף (`10d81eb`); `PlayingCard` flip תוקן (חסר `perspective`).
- **פיצול אסים** → קלף אחד לכל יד, אין לקיחת קלף נוסף (`dcc6263`).
- **רייל ז'יטונים אחיד:** `[25, 100, 250, 500, 1000, 2500, 5000, 10000]` לכולם; VIP מקבל קטע נפרד **"💎 VIP HIGH STAKES"** עם `[25000, 50000, 100000, 250000]` (בלאק'ג'ק/רולטה/באקרה/קוינפליפ/הייקארד — **לא בסלוטס**) (`21e9b39`, `eaac3bd`).
- **בלאק'ג'ק סולו — הימורי צד:** Perfect Pairs + 21+3, שני פאנלים בצדי השולחן עם טבלת תשלומים + "הימרת: X" + הבהוב זכייה. **סולו בלבד**. דילר עם 21 → סיום מיידי (`343226d`).
- **קלפי גירוד:** טבלת פרסים גלויה (סמל×3 → סכום) + פויל/רקע/סמלים נושאיים לכל רמה (בית/פליז/כסף/זהב/אובסידיאן) (`00982a8`).

### שלב 4 — מערכות צמיחה / retention (5 sub-stages, נדחפו, reviewer אישר)
- **STAGE 1** (`fe3803b`) — באג זוהר הימור-צד (`.sb-won` CSS keyframes); היגיינת התראות (הזמנת חדר מת → נמחקת, `roomsService.isLive`, RLS delete); פרסי רצף גדולים (יום 7: 5,000 · יום 30: 50,000); בונוס הפניה 500 → 5,000.
- **STAGE 3a → re-model** (`8abee17` → `f99c27a`) — **מדף גביעים = רק 9 גביעי אירוע** (real-trophy + הפרס מתחת לכל אחד); **הישגים = סקשן נפרד collapsible** עם הפרס לכל אחד ("בחר מה לרדוף"); כרטיס **"השיא שלי"**; **סטטיסטיקות לפי משחק** (בלי סלוטס/גירוד, בלי נתונים מומצאים).
- **STAGE 2** (`dd38bf1`, `b8fd712`) — **משימות יומיות מתחלפות:** מאגר 16, `dailyMissions(dateKey)` דטרמיניסטי (3/יום distinct, לא-כמו-אתמול, כמות+גיוון) + משימה שבועית. `missionProgress` מקומי (roll ב-UTC midnight), מתעדכן ב-`recordResult`. `claim_mission` RPC אטומי (cap 20K) + guest mirror. widget ב-hub + `MissionsPanel`. בונוס "כל ה-3" +5,000.
- **STAGE 3b** (`84779a5` → `f99c27a`) — **9 גביעי אירוע:** `ev_sng_win`/`ev_jackpot`/`ev_duel_victor`/`ev_night_champion`/`ev_side_bet_10x`/`ev_weekly_winner`/`ev_first_referral`/`ev_vip`/`ev_royal_flush` (gold 2,500 / platinum 5,000). `usePlayer.grantEvent(id)` אטומי, מחווט ל-10 hooks. (`ev_streak30` נבנה ואז הוסר לבקשת המשתמש.)
- **STAGE 4** (`6e92b90`) — **הפניות מדורגות:** שלב-שני +10,000 ברמה 5; בונוס מזמין `[3000, 7000, 15000]` ל-3 חברים ראשונים; חלון anti-abuse 24→72ש. **Web Share** (`navigator.share`) + copy fallback; כפתור "הזמן חבר" ב-hub. **פרס שבועי → פודיום** (5,000/2,500/1,000 ל-3 העשירים בין החברים) + כרטיס ב-hub שמראה את הדירוג. אנליטיקס: `invite_shared`, `referral_stage2`, `mission_claimed`, `notification_click`.
- **Round 30 — תיקוני משוב** (`f99c27a`) — **באג קריטי:** פאנל החברים (+ `Modal` המשותף + `InviteOverlay`/`SideNav`/`Onboarding`) השאיר overlay שקוף `pointer-events:auto` אחרי סגירה וחסם את כל המסך (אנימציית `exit` של framer נתקעת — אותה בעיה כמו הכספת). תוקן: רינדור מותנה `{open && …}` / `if (!open) return null`, entrance-only, סגירה = unmount מיידי. **אימת חי.**

### SQL שהורץ בפרודקשן ע"י המשתמש (מצטבר)
`poker-privacy.sql` · `reset-users.sql` · `achievements-daily.sql` · `gift-limit-50k.sql` · `notifications-cleanup.sql` · `streak-rewards-v2.sql` · `referral-bonus-5k.sql` · `missions.sql` · `event-trophies.sql` (המעודכן, עם מחיקת `ev_streak30`) · `referral-growth.sql` · `weekly-podium.sql`.
*(המשתמש אישר "DONE" אחרי שכל הקבצים נשלחו — אם משהו לא עובד בפרודקשן, לוודא שהקובץ המתאים רץ.)*

## What's left / next steps

1. **בדיקת מולטיפלייר חיה — 2 דפדפנים אמיתיים** (הצעד היחיד שנשאר, רק המשתמש). מדריך: `ROYAL 21 GAME/MP_VERIFICATION_GUIDE.md`. לבדוק:
   - **MP:** דואל (שני "מוכן" → יד מיד, מנצח מקבל buyIn×2, עוזב מפסיד), רולטה (גלגל מסתובב בשני המסכים יחד, joiner יכול להמר בסיבוב הבא), פוקר (יד הבאה אוטומטית), ערב חברה (מארח בוחר → כולם נכנסים), SnG (רגע הזכייה מחכה ללוח).
   - **חברתי:** הזמנת חבר → שניכם +5,000; הזמנה לחדר → קבלה/פג-תוקף; פודיום שבועי.
   - **retention:** רצף כניסה (פעם ביום — כבר server-enforced למחובר), משימות יומיות (התקדמות + איסוף + בונוס "כל ה-3"), גביעי אירוע (נצח טורניר → toast+moment).
2. **לתקן מה שהבדיקה החיה תמצא.**
3. אחרי שהכל ירוק — **סקירה מקיפה סופית** + **חשבון טוקנים/זמן** של כל הפרויקט.

### רעיונות עתידיים (לא בסקופ, לא הובטחו)
- **QR code** ללינק הזמנה — דורש הוספת `qrcode` ל-npm (מחולל QR מלא inline גדול/מסוכן מדי).
- גביע **"חודש משימות מלא"** (`mission_month`) — נדחה, מורכב.
- **מערכת קישוט חדר** — `roomDecor`/`category:'decor'` קיימים כשלד מת, שום דבר לא מחווט. ~10-15 פריטי decor + קטגוריה ב-Vault/Inventory + רינדור ב-`MyRoomScene`.
- **איפוס רצף לפי אזור-זמן מקומי** (כרגע UTC — שחקן בישראל רואה את היום מתחלף ב-02:00/03:00).
- ה"נאדג' לגביע הבא" ב-`MyRoomScene` מציג הישג-stat מעומעם מתחת למדף הגביעים — אם המשתמש רוצה מדף נקי לגמרי, להסיר.

## Key decisions & context

- **הסוכנים:** הסשן הראשי = מנהל-הפרויקט. מאציל ל-`builder` (חוסם), `reviewer` רק לכסף/אימות/MP/גדול, `designer` רק ל-UI אמיתי. מוגדר ב-`C:\CLAUDE AI\CLAUDE.md`. **סוכן builder נפל פעם על session rate-limit** (מתאפס 5am Asia/Jerusalem) — העבודה שרדה (הייתה staged), חילצתי ל-commit נקי.
- **dev server:** `cd "C:\CLAUDE AI\ROYAL 21 GAME" && PORT=5199 npm run dev`. אם תיקון "לא מופיע" — `taskkill //F //IM node.exe` + `rm -rf node_modules/.vite` + restart + hard reload. `tsc`/`build`/`test:all` הם הסמכות, לא הקונסול.
- **בדיקת דפדפן:** guest נבדק ישירות ע"י הזרקת `royal21.save.v1` ל-localStorage עם profile `guest_*` (כניסת אורח הוסרה מה-UI). ה-Browser pane של Claude **לא אמין ל-QA ויזואלי** — מקפיא אנימציות framer/CSS one-shot, מרנדר סצנות כהות/מטושטש לא-עקבי. בדיקות DOM/JS דרך `javascript_tool` אמינות; צילומי מסך של סצנות עם blur/gradient — לא. **המשתמש הוא המאמת הויזואלי בדפדפן אמיתי.**
- **framer-motion:** אנימציות `animate` של framer + **אנימציות `exit` של `AnimatePresence`** לא מסתיימות אמין (נתקעות → overlay חוסם). לרקע/overlay — CSS `@keyframes` בלבד, ורינדור מותנה `{open && …}` בלי `exit`.
- **כלכלה:** מתועדת ב-`src/data/economy.ts`. `-30%` בכספת = `DAILY_DISCOUNT`. VIP tier (הנחה, רמה 1+) ≠ VIP Lounge (`isVipEligible` = `everVip || level≥5 && chips≥150K`). קבועים מרכזיים: `STREAK_REWARD`, `REFERRAL_BONUS`/`REFERRAL_STAGE2_BONUS`/`REFERRER_TIERS`, `WEEKLY_PODIUM`, `MISSION_ALL_DONE_BONUS`/`MAX_MISSION_REWARD`, `GIFT_DAILY_LIMIT`.
- **הישגים:** `ACHIEVEMENTS` ב-`src/data/achievements.ts` — 31 `kind:'stat'` (סף סטטיסטיקה) + 9 `kind:'event'` (רגע מיוחד). כולם מזכים צ'יפים. `claim_achievement` RPC כותב רק `profiles.achievements text[]` — לא קורא את הקטלוג.
- **המשתמש:** עברית · השתקת **כל** האודיו לפני בדיקה · batch של תיקונים · החלטה-ופעולה במקום סקירת אופציות · רגיש לעלות טוקנים (שמור סוכן חי דרך SendMessage במקום respawn).
- **git:** ראה "מצב git" למעלה. commit מסתיים ב-`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **admin:** email `noamshay1010@gmail.com`. session-injection login trick + כל פרטי הסבבים — בזיכרון `royal21_bugfix_loop.md`.

## Known issues / open questions

- **בדיקת MP חיה 2-דפדפנים לא בוצעה** — כל שכבת ה-MP + החברתי + retention נבנתה ואומתה בקוד, אבל סנכרון בו-זמני אמיתי / גלגל בשני מסכים / host handoff / הזמנות בין חשבונות — רק המשתמש יכול לאמת.
- host-death freeze ~5-25ש — לא בסקופ.
- `activeMiniGame` stale מסשן שקרס — לקוח טרי ב-`/night/CODE` עם pointer ישן עלול להישאב פנימה לרגע.
- אורח על מכשיר חדש יכול לתבוע רצף/הפניה שוב (אין שרת) — לא רלוונטי לשחקן מחובר.
- דחיפה ל-`origin` איטית — ~125MB קבצי BLACKJACK 3D ישנים מקומיטים קודמים.
