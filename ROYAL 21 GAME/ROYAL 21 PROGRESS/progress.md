# ROYAL 21 — Progress

**Last updated:** 2026-09-01

משחק קזינו חברתי (צ'יפים וירטואליים בלבד). Vite + React + TypeScript + Supabase.
תיקייה: `C:\CLAUDE AI\ROYAL 21 GAME`. חי: https://royal21.vercel.app (מתפרס אוטומטית מ-`main`).

## Current status

הסינגל-פלייר גמור ובאוויר. ה-Hub עוצב מחדש + לוח מנהיגים גלובלי — אושר ונדחף. **המשתמש הריץ בדיקת מולטיפלייר עם 2 דפדפנים אמיתיים וכל שכבת ה-MP של המשחקים החברתיים שבורה** (דואל, ערב-חברה, רולטה MP, פוקר, טורניר). יש תוכנית עבודה מפורטת ומאושרת ב-4 שלבים — ראה "What's left".

`git` מסונכרן עם `origin/main`. קומיטים אחרונים בסבב הזה: `f50617e` (guard על clear אחרי betting), `fd91b98` (סנכרון חשיפת רולטה).

**⚠️ תיקון הרולטה `fd91b98` הכניס רגרסיה** — הגלגל לא מסתובב אצל השחקן שאינו host. מתועד ב-Stage 2a של התוכנית.

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

### Stage 1 (תשתית MP משותפת) — מומש, **לא נבדק חי, לא נדחף**
- `src/hooks/useGhostSeatCleanup.ts` חדש — חילוץ ה-host ghost-cleanup, מחווט ב-7 סצנות (bj/poker/sng/roulette/coinflip/highcard/night).
- **Blackjack:** gate "כל היושבים-עם-הימור מוכנים → חלוקה מיידית" (בדואל: כל היושבים). בוטל טיימר ה-15ש. אחרי settle — ה-host פותח אוטומטית סיבוב הבא (`openBetting` מנקה `ready`).
- **פוקר cash:** auto-start כמו SnG (host שולח `startHand` 2.5ש אחרי `waiting` כש-≥2 עם צ'יפים, `!revealing`). נעקר `setReady`/`seat.ready`/UI ה-Ready מ-engine+scene+i18n (poker). כפתור host "התחל יד" נשאר כ-fallback.
- **roulette/coinflip/highcard engines:** נוסף phase `'waiting'` (פחות מ-2 יושבים). `leave` reducer: ≥2 נשארו ובאמצע סיבוב → abort + סיבוב נקי; <2 → `'waiting'`. join מ-`'waiting'` ל-2 → חוזר ל-`'betting'`.
- **coinflip/highcard scenes:** auto-flip/auto-draw כשכל היושבים נתנו ante (stake>0 = implicit-ready), auto-war-continue, auto-openBetting אחרי settle. פאנל "ממתין לשחקנים" ב-phase waiting.
- **refund on leave:** roulette/coinflip/highcard קיבלו `leaveCleanup` ref + `pagehide` (חיקוי blackjack) — refund של `roundOutlay - clearRefunded` אם `phase !== 'settled'`. כפתורי "חזרה" עברו ל-navigate בלבד (הניקוי ב-unmount).
- **roulette:** window נפתח רק כשכל היושבים הימרו; כפתור "סובב" של ה-host אופשר כ-fallback (הוסר `realPlayerCount > 1`). auto-continue אחרי settle **נדחה ל-Stage 2** (שרשרת ה-wheel/reveal/credit של רולטה שברירית — "סיבוב חדש" נשאר ידני).
- אימות: tsc נקי · vite build נקי · test:all ירוק (65+44+minigames+...) · i18n he/en 869/869.

### Stage 2 (רולטה MP) — מומש, **לא נבדק חי, לא נדחף**
- **2a** — הגלגל לא הסתובב אצל לא-host: ה-guard נותק מהתזמון. `spunRound` מתעדכן רק בתוך callback ה-`setTimeout`; `spinScheduledFor` ref מונע תזמון-כפול; ה-timer נמחק **רק ב-unmount** (cleanup effect נפרד `[]`), לא על כל frame. `startDelay` clamped ל-`[0, REVEAL_SYNC_MS]` נגד clock skew.
- **2b** — כפתור "סובב": הוסר disable של `realPlayerCount>1`; ה-host יכול "סובב עכשיו" כש-`allSeatedBetIn` (כל היושבים הימרו) או שהחלון פתוח — short-circuit לספירה.
- **2c** — joiner: `engine.ts` join — נוחת כשחקן מלא רק אם `phase==='waiting'` או `betting` בלי deadline (סיבוב טרי, כולם עוד מהמרים); הצטרפות אחרי שהחלון רץ / באמצע spin/settle → spectator לסיבוב הזה, `openBetting` הבא מקדם אותו. ה-gate (`allSeatedBetIn` / armWindow) סופר את הנכנס כ"נוכח, חייב להמר".
- **2d** — refund בעזיבה: כבר מ-Stage 1 (`leaveCleanup` + pagehide), עובד עם השינויים כאן.
- **auto-continue** (נדחה מ-Stage 1): host שולח `openBetting({deadline:null})` 7.5ש אחרי settle (אחרי סיום גלגל+reveal+credit של כל הלקוחות); ה-gate של "כולם הימרו" מזיין את החלון. `handleNewRound` גם עבר ל-`deadline:null`. כפתור "סיבוב חדש" נשאר כ-short-circuit.
- אימות: tsc נקי · vite build נקי · test:all ירוק (roulette + minigames + engine 65) · i18n 869/869 · רגרסיית סולו רולטה: כל האפקטים החדשים `mode==='room'`/host-gated, מסלול הסולו לא נגע.

### Stage 3 (Duel + הסרת "3 TO 2" + Double/Split) — מומש, **לא נבדק חי, לא נדחף**
- **3a** — ה-betting UI נעקר מ-duel: ב-duel מרונדר כפתור "מוכן" יחיד (`readyUp` בלי bet), לא `BetRail`. `ready` reducer מקבל בדואל בלי `bet>0`. `deal` reducer — ענף duel: מושב לכל `ready` (לא-spectator), `newHand(0)`, ה-cash נשאר כשהיה.
- **3b** — זרימת ז'יטונים חסינה: `duelConfirmed` ref (נדלק ברגע שרואים `state.duel`, לעולם לא מריץ per-hand `addChips`/`claimPayout` אחרי) + בדיקת `useRoom.getState().state?.duel` מה-store (לא closure). שדה `duel.pot` חדש (`types.ts`) שנקבע ב-`RoomScene.startGame` (`buyIn × מספר יושבים בזמן ה-start`) — `potOf` החי כ-fallback בלבד. `duelPaidOut` ref חוסם `refreshFromServer` ב-unmount אחרי תשלום pot. engine `leave` — force-resolve: `state.duel && !winner && <2 non-spectator` → הנותר מנצח ולוקח את הקופה.
- **3c** — auto-deal יד הבאה בלי re-ready: `openBetting` בדואל מדליק `seat.ready=true` לכל היושבים → אפקט ה-auto-deal (Stage 1) חולק מיד. אפקט ה-auto-openBetting (Stage 1) מדלג כש-`state.duel.winner`. על `duelWinner` → pot + `SessionSummary`.
- **3d** — הוסר "BLACKJACK PAYS 3 TO 2" + שורת הכללים מ-`BlackjackScene` (כל המצבים) ומ-`hub/hubObjects.tsx`. מפתח `blackjack.rules` נמחק (he+en). **מתמטיקת התשלום `bet + floor(bet*1.5)` ב-`engine.ts` לא נגעה** (engine.test 65/65).
- **3e** — `ActionBar` קיבל prop `duel` → בדואל רק Hit/Stand (grid 2 עמודות). `canDouble`/`canSplit` מקבלים `!duel &&` בקריאה (לא קורסים).
- אימות: tsc נקי · vite build נקי · test:all ירוק (engine 65, poker 44, minigames, roulette) · i18n he/en 868/868 · רגרסיית סולו+cash: `duel` undefined → כל המסלולים הישנים (BetRail, ActionBar 4-col, per-hand settle, activePlayers) לא נגעו.

### Stage 4 (Game Night + SnG all-in reveal) — מומש, **לא נבדק חי, לא נדחף** — השלב האחרון של ה-rework
- **4a** — Game Night host-only pick: ה-picker גדור ל-`isHost` (non-host רואה "ממתינים למארח" + לוח). `activeMiniGame` הורחב לכל המשחקים (`{game, code, by}`), `setActiveMiniGame` reducer מקבל `userId` + `game:''` מנקה ל-null. `pickGame` (host): coinflip/highcard יוצר sub-room, השאר על קוד ה-night. אפקט auto-navigate בכל לקוח מושך את כולם פנימה (guard `sessionStorage['night-active']` per-tab נגד bounce-back בחזרה ללובי). ניקוי: host שחזר ללובי (marker תואם) → 2.5ש → clear; היוצר נעלם מ-members → clear מיידי.
- **4b** — `useGhostSeatCleanup` ב-NightScene (כבר מ-Stage 1). `scoreboard()` — עוזב שומר נקודות/history, מסומן `left:true` (שם מעומעם + תג "עזב"). host עוזב → `reassign_room_host` מקדם, ה-host החדש מקבל picker (`isHost`). ניקוי `activeMiniGame` כשהיוצר עזב.
- **4c** — SnG: אפקט ה-tournament-settle (+ צליל היד) גודר על `!revealing` (`if (... || revealing) return` + dep) — "ניצחת בטורניר" + `bigWin` כבר לא מקדימים את חשיפת הבורד ב-4-8ש. cash poker: אפקט ה-settle (stats + rivalry + `win`/`bigWin` + jackpot claim של royal flush) גודר על `!revealing` באותו דפוס.
- אימות: tsc נקי · vite build נקי · test:all ירוק (65/44/minigames/roulette) · i18n he/en 870/870 · רגרסיית single-flow poker/SnG/night: `revealing` clears תמיד (הקוד הקיים של `usePokerReveal` + אפקטי ה-auto-start כבר תלויים בזה); solo night host — pick→auto-nav→play→return→clear עובד.
- **מגבלה ידועה (Stage 4):** `activeMiniGame` stale מסשן שקרס — נוקה ע"י ה-host כשחוזר/כשהיוצר נעלם, אבל לקוח שנכנס טרי ל-`/night/CODE` עם pointer ישן+היוצר עדיין member עלול להישאב פנימה לרגע.

### כוונונים אחרי משחק (פוקר/SnG/באקרה) — מומש, **לא נבדק חי, לא נדחף**
- **A** — `ACTION_SECONDS` 30→**60** (`poker/engine.ts`, משמש cash + SnG). בורר הטיימר הוסר מ-`PrivatePokerModal` (`TIMER_OPTIONS`/state/JSX/`actionSeconds` בקונפיג). `actionSeconds?` הוסר מ-`RoomConfig` (חדרים ישנים ב-DB עם השדה — נעלמים בשקט). i18n `privateTable.timer`+`seconds` נמחקו. time-bank נשאר 2×60 → מקס' תור = 60+120.
- **B** — `SNG_LEVEL_MINUTES` 5→**2**. `poker.test.ts` — ה-offset של בדיקת התקדמות הרמות נגזר מ-`SNG_LEVEL_MINUTES` (`(4*SNG_LEVEL_MINUTES+1)*60_000`) במקום `22*60_000` קשיח, ה-assertion "רמה 4" נשמר. 44/44 עובר.
  - **קוויאק ידוע (משאירים):** `tournament.startedAt` נחתם ביצירת הטורניר, לא ביד הראשונה → שעון הבליינדים רץ במהלך המתנת ה-registration. עם רמות של 2 דק', התחלה איטית (המתנה ארוכה לשחקנים) עלולה להתחיל כבר ברמה 2. לקבוצת חברים קטנה ה-ready-gate הופך התחלות למיידיות → מקובל. Follow-up אפשרי: לחתום `startedAt` ב-`startHand` הראשון.
- **C** — הימור תיקו הוסר מבאקרה. `'tie'` נשאר **תוצאה** (push להימורי P/B) לא צד. `BaccaratMainSide='player'|'banker'` חדש, `bet.main.side` + `setMainBet` צומצמו אליו. `settleOne` — ענף זכיית תיקו נמחק, ענף push נשמר. `PAYTABLE`/`MAIN_BETS` ל-2 פריטים, רשת `grid-cols-2`, תווית תשלום בלי tie. טקסט תיקו → `baccarat.push` ("תיקו — ההימור מוחזר", אייקון 🔄). i18n: `baccarat.tie` נמחק, `tieWins`→`push`, `rulesGoalText` עודכן.
- **D** — חשיפת squeeze בבאקרה: hook חדש `src/games/baccarat/useBaccaratReveal.ts` (לוקאלי לכל לקוח, אין שינוי מנוע). הצד שלא הימרת עליו — גלוי מיד; הצד שלך — הפוך, הקשה על קלף הופכת, auto-flip fallback כל 1.5ש. `PlayingCard` קיבל `onClick?`. תג-הסכום/הזוהר/טקסט-התוצאה + ה-settle `useEffect` (זיכוי + showMoment + אודיו) של הצד שלך מגודרים על `rv.revealComplete`. `reducedMotion`/quality low / אין הימור ראשי → חשיפה מיידית. MP auto-newRound של המארח 3200→**7000ms**.
- אימות: tsc נקי · vite build נקי · test:all ירוק (poker 44, engine 65, minigames/roulette/social) · i18n he/en 865/865. רגרסיית סולו: אין הימור ראשי → `instant`, התנהגות זהה לקודם; פוקר סולו/single-flow לא נגע (רק הקבוע).

### בלאק'ג'ק סולו — הימורי צד (Part A מ-`smooth-soaring-dove.md`) — מומש, **לא נבדק חי, לא נדחף**
- **מנוע** (`blackjack/{types,engine}.ts`): `BjSide = 'pairs'|'trio'`. `BjSeat.sideBets?`/`sideResults?` (net חתום). action `sideBet` (additive, `amount<=0` מנקה). `evalSideBets(firstTwo, dealerUp)` exported — Perfect Pairs (25/12/6) + 21+3 (100/40/30/10/5, A גבוה/נמוך ל-straight). נקרא ב-`deal` reducer מיד אחרי חלוקת 2+1, כותב `seat.sideResults`. `settle()` מוסיף `Σ sideResults` ל-`net` פעם אחת. `openBetting`/`clearBet` מנקים.
- **Dealer 21 → סיום מיידי:** `deal` reducer — אחרי חלוקה + הערכת הימורי צד, אם לדילר 21 טבעי (2 קלפים) → `resolveDealer` מיד, בלי תור לשחקן (`activeSeat = -1`). `settle()` מטפל (הפסד / push אם גם לשחקן BJ).
- **UI** — `src/scenes/blackjack/FeltBets.tsx` חדש: **שני פאנלים** absolute בצדי ה-`div.table-felt` (Perfect Pairs שמאל, 21+3 ימין) — טבלת תשלומים קריאה + ChipStack + "הימרת: X". נקישה → `onSide(side, lastChip)`. פאנל שזכה מהבהב זהב + "+זכייה". **רק `solo`** (`compact` prop למובייל). זרימת ההימור הראשי חזרה לרייל כמו קודם — `lastChip` state נלכד ב-`onAdd`. `placeSide` — debit אופטימי + `sideBet`. Clear/Last-bet כוללים צדדיים.
- **זיכוי** — settlement effect בסולו: `sidePayout = sideStaked + sideNet` מתווסף ל-`addChips` הראשי, `net` הכולל לסטטיסטיקה. עיגול שזכה מהבהב זהב.
- אימות: tsc נקי · vite build נקי · test:engine 84/84 (+~20 בדיקות evalSideBets/settle) · test:all ירוק · i18n he/en 879/879.
- **רגרסיה:** חדר cash + דואל — `solo` false → אין `FeltBets`, `BetRail` הקשה=הוספה (`selectMode={solo}`), `placeSide` גדור, `sideStaked/sideNet = 0`, זרימת ההימור/הזיכוי זהה בית. סולו בלי הימורי צד — `sidePayout=0`, זהה. Part B (סקין קלף-גירוד) — המעצב, לא נגעתי ב-`scratch/`.

**מגבלה ידועה (1d, לא בסקופ):** קיפאון עם מוות-host עדיין ~5-25ש (`reassign_room_host` חלון 20ש stale). שיפור עתידי: לקצר `HOST_HEARTBEAT_MS` או ש-host מקודם יעשה abort+restart לסיבוב.

### הבא בתור: רה-ארכיטקטורה של המולטיפלייר — **תוכנית מלאה ומאושרת:**
### 📋 `C:\Users\noam7\.claude\plans\snug-moseying-allen.md`

קרא את קובץ התוכנית — הוא עצמאי לגמרי (נכתב לצ'אט חדש בלי הקשר), מחולק ל-4 שלבים לפי עדיפות, עם file:line מדויקים ודפוסים קיימים למחזר. תקציר:

- **Stage 1 — תשתית MP משותפת:** gate "כולם מוכנים → מתחיל" (רולטה/קוינפליפ/היי-קארד/דואל/ערב-חברה); auto-start ליד פוקר הבאה (כמו SnG); טיפול אחיד בעזיבת שחקן (מספיק נשארו → סיבוב מתחיל מחדש; לא → מסך המתנה); hook משותף `useGhostSeatCleanup`.
- **Stage 2 — רולטה MP (הכי שבור):** לתקן את הרגרסיה שהגלגל לא מסתובב אצל non-host (`RouletteScene.tsx:141-157` — ה-guard נצרך לפני שה-timeout רץ); כפתור "סובב" מושבת עם 2 שחקנים; joiner תקוע כ-spectator; refund בעזיבה.
- **Stage 3 — דואל + הסרת "3 TO 2" + כפול:** להוריד לגמרי את UI ההימורים בדואל (buy-in → קופה → מנצח, נקודות בלבד); לתקן את זרימת הציפים (pot לפי מספר שחקנים מקורי, מנצח בברירת מחדל אם השני עזב); להסיר "BLACKJACK PAYS 3 TO 2" מכל מקום (גם סולו + אובייקט Hub); להסתיר כפול/פיצול בדואל.
- **Stage 4 — ערב-חברה + חשיפת SnG:** רק ה-host בוחר משחק והבחירה מכניסה את כולם; ghost-cleanup לערב-חברה; לגדר את effect ה-settle של הטורניר (+ צלילי פוקר) על `!revealing` כדי שהמנצח לא יוצג לפני שהקלפים נפתחים.

**החלטות שכבר סגורות עם המשתמש** מפורטות בטבלה בתוך קובץ התוכנית — אל תשאל שוב.

### אחרי שהמולטיפלייר ירוק:
- **סקירה מקיפה סופית** של כל המשחק (כל מסך, כל משחק).
- **חשבון טוקנים + זמן** מלא של כל העבודה בפרויקט (הצ'אטים הקודמים).

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

- **כל שכבת ה-MP של המשחקים החברתיים שבורה** — מטופל בתוכנית `snug-moseying-allen.md` (4 שלבים).
- רגרסיה פעילה: `fd91b98` — הגלגל ברולטה לא מסתובב אצל non-host (Stage 2a).
- **מה שנמצא בבדיקת המשתמש** (הכל בתוך התוכנית): דואל מציג UI הימורים ומזליג ציפים; "מוכן" מכניס שחקן אחד לבד; טיימר 15ש מחלק בלי לחכות לשני; עזיבת שחקן מקפיאה כל משחק חברתי; רולטה MP — גלגל לא מסתובב אצל השני, "סובב" מושבת עם 2, שחקן שמצטרף לא יכול להמר; ערב-חברה — כל אחד יכול לבחור משחק וזה מכניס רק אותו; פוקר — "התחל יד" אחרי כל יד; SnG — all-in הראה מנצח לפני שהקלפים נפתחו.
- host-death freeze עדיין ~5-25s (`reassign_room_host` 20s stale). לא בסקופ הנוכחי.
- דחיפה ל-`main` איטית — ~125MB של קבצי BLACKJACK 3D ישנים מקומיטים קודמים.
- `progress.md` הישן בשורש `ROYAL 21 GAME/` — יומן מפורט. הקובץ הזה הוא ה-snapshot הרשמי.
