# פריסת Edge Functions — הוראות ידניות

הקוד כאן (`demo-start`, `redeem`, `send-test-push`, `market-indices`, `_shared`) כתוב ומוכן
(חלקן טרם נפרסו) — נדרש Supabase CLI
מחובר לחשבון המשתמש. הפעולות הבאות דורשות טרמינל עם גישה לדפדפן (login אינטראקטיבי),
לכן המשתמש צריך להריץ אותן בעצמו:

```bash
# 1. התקנה (אם עוד אין CLI מותקן)
npm install -g supabase

# 2. login - יפתח דפדפן לאישור
supabase login

# 3. קישור לפרויקט הקיים (מריצים מתוך תיקיית "trading panel")
supabase link --project-ref osxzjswbasniwmuhwjyc

# 4. פריסת הפונקציות
supabase functions deploy demo-start
supabase functions deploy redeem
supabase functions deploy send-test-push
supabase functions deploy market-indices
supabase functions deploy watchlist-prices
supabase functions deploy check-price-alerts
```

## Secrets

שתי המשתנות הבאות **קיימות אוטומטית** בזמן ריצה של כל Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**`SUPABASE_JWT_SECRET` לא קיים אוטומטית** בפרויקטים עם מערכת ה-API keys החדשה
(publishable/secret) — התגלה בפועל ב-2026-09-12 (הפונקציה החזירה שגיאת "חסרים
secrets"). לכן הקוד קורא ל-`APP_JWT_SECRET` (שם משלנו, לא שמור ע"י Supabase) שערכו
**חייב להיות זהה** לסוד ה-JWT האמיתי של הפרויקט - אחרת PostgREST ידחה את ה-JWT
שאנחנו מנפיקים ו-`auth.uid()` לא יעבוד ב-RLS.

**איך למצוא את הערך הנכון:** בדשבורד של הפרויקט → Settings → API → לגלול/להרחיב
לסקשן "JWT Keys" (או "Legacy JWT Secret" - התווית משתנה בין גרסאות ה-UI) → להעתיק
את ה-secret שם (**לא** את ה-publishable/secret keys שרואים למעלה בעמוד - זה שדה
נפרד, ייעודי ל-JWT).

```bash
supabase secrets set APP_JWT_SECRET=<הערך מ-Settings > API > JWT Keys>
```

**אין secrets נוספים להגדיר ידנית** מעבר לזה לשתי הפונקציות demo-start/redeem.

## Push notifications - VAPID keys (נדרש עבור `send-test-push` וגם `check-price-alerts`)

**שינוי מבני (שלב F, בלי שינוי התנהגות):** לוגיקת ה-VAPID+`webpush.sendNotification`
חולצה מ-`send-test-push/index.ts` ל-`_shared/push.ts` (`sendPushToAccount`), כדי
ש-`check-price-alerts` תוכל לשלוח push אמיתי בלי לכפול קוד. `send-test-push` עצמה
נשארה wrapper דק - אותה התנהגות בדיוק כמו לפני, כולל הודעת השגיאה כש-VAPID secrets
חסרים. **תוספת חדשה:** מנויים שהשרת דוחה עם 404/410 (endpoint לא תקף יותר) נמחקים
אוטומטית מ-`push_subscriptions` - ניקוי, לא שינוי בהתנהגות השליחה עצמה.

זוג מפתחות VAPID כבר נוצר (`npx web-push generate-vapid-keys`). המפתח הציבורי כבר נמצא
ב-`.env` הלוקאלי (`VITE_VAPID_PUBLIC_KEY`) - המפתח הפרטי **לא נשמר בשום קובץ בריפו**
מסיבות אבטחה; הוא נמסר למשתמש בנפרד (בצ'אט הבנייה). יש להגדיר את שניהם כ-secrets
בפרויקט Supabase (הפונקציה צריכה גם את הציבורי, לא רק את הפרטי, בשביל `setVapidDetails`):

```bash
supabase secrets set VAPID_PUBLIC_KEY=<אותו ערך כמו VITE_VAPID_PUBLIC_KEY ב-.env>
supabase secrets set VAPID_PRIVATE_KEY=<המפתח הפרטי שנמסר בנפרד>
```

**אם המפתחות אי-פעם דולפים/מוחלפים:** לייצר זוג חדש (`npx web-push generate-vapid-keys`),
לעדכן את שני ה-secrets למעלה + את `VITE_VAPID_PUBLIC_KEY` ב-`.env`, ולפרוס מחדש. כל מנוי
Push קיים (`push_subscriptions`) יפסיק לעבוד ויידרש subscribe מחדש מהמכשירים.

**חשוב - `send-test-push` שונה מ-demo-start/redeem:** verify_jwt נשאר `true` (ברירת
המחדל) עבור הפונקציה הזו - אין להוסיף אותה ל-`[functions.send-test-push]` ב-`config.toml`.
הקריאה חייבת לכלול `Authorization: Bearer <access token>` תקף (אותו token שמנפיקים
demo-start/redeem) - שכבת ה-Gateway של Supabase מאמתת את החתימה מול `SUPABASE_JWT_SECRET`
לפני שהבקשה מגיעה לקוד עצמו.

**מגבלה ידועה, טרם נבדקה בפועל:** `send-test-push` משתמש בחבילת npm `web-push` דרך
`import webpush from 'npm:web-push@3.6.7'` (תמיכת `npm:` specifiers ב-Supabase Edge
Functions/Deno). זו הדרך הריאלית היחידה לממש את פרוטוקול ה-Web Push (VAPID + הצפנת
aes128gcm) בלי לכתוב מחדש קריפטוגרפיה מורכבת ביד ב-Deno - אבל **לא נבדק בפועל מול
דפדפן אמיתי**, כי זה דורש פריסה + מנוי push אמיתי. אם ה-import הזה נכשל בפריסה (תאימות
npm-בתוך-Deno לפעמים שברירית), הפתרון החלופי הוא מימוש ידני של Web Push Protocol
(ECDH + HKDF + aes128gcm) - עבודה משמעותית נוספת שלא נכללה בסבב הזה.

## מדדי מניות חיים - `market-indices` (Finnhub)

מחזירה SPY/QQQ/VIX חיים לכרטיס "מדדים" ב-Home (סגנונות שאינם Crypto). המפתח כבר
מוגדר כ-secret (המשתמש הגדיר אותו ידנית, לא נדרשת פעולה נוספת מלבד פריסה):

```bash
supabase secrets set FINNHUB_API_KEY=<כבר מוגדר בפרויקט - לא נדרש שוב>
```

**verify_jwt נשאר `true`** (בדיוק כמו `send-test-push`) - אין להוסיף את
`market-indices` ל-`config.toml`. הקליינט קורא דרך `supabase.functions.invoke('market-indices')`
הרגיל (`src/lib/marketData.ts` → `fetchStockIndices`), שכבר נושא Authorization header
תקף כי `supabase.ts` שומר את ה-access token הפעיל גלובלית על הלקוח.

**Caching:** תשובת Finnhub נשמרת בזיכרון (module-level, TTL 45 שניות) בתוך ה-Edge
Function עצמה - לא ב-DB. זה שומר על מכסת ה-60 קריאות/דקה של התוכנית החינמית גם אם
הרבה משתמשים פותחים את האתר במקביל. ה-cache מתאפס אוטומטית אם ה-instance מתחלף
(תקין, לא באג).

**VIX:** בתוכנית החינמית של Finnhub הסימבול `^VIX` לפעמים לא זמין/מחזיר `c: 0` -
הפונקציה מחזירה `null` עבור השדה הזה בלבד בלי להפיל את שאר התשובה (SPY/QQQ ממשיכים
לעבוד). הלוגיקה הטהורה (מיפוי + cache) חיה ב-`market-indices/mapping.ts` ומכוסה
ב-`market-indices/mapping.test.ts` (Vitest, כולל TTL עם שעון מוזרק).

## Watchlist + price alerts - `watchlist-prices` / `check-price-alerts` (שלב F)

**סדר פעולות חובה (בדיוק בסדר הזה):**
1. להריץ `supabase/010_watchlist.sql` ב-SQL Editor (יוצרת טבלת `watchlist` + RLS + טריגר מגבלת 15).
2. להגדיר secret חדש `CRON_SECRET` (ערך אקראי משלך, לא חייב פורמט מסוים):
   ```bash
   supabase secrets set CRON_SECRET=<ערך אקראי ארוך, לדוגמה פלט של openssl rand -hex 32>
   ```
3. לפרוס: `supabase functions deploy watchlist-prices` (verify_jwt נשאר `true` ברירת מחדל - בדיוק כמו `market-indices`/`send-test-push`, לא נדרשת פעולה נוספת).
4. לפרוס: `supabase functions deploy check-price-alerts` **ואז חובה** לכבות עבורה את "Verify JWT" בדשבורד (Edge Functions → `check-price-alerts` → Details → Verify JWT → כיבוי) - בדיוק כמו `demo-start`/`redeem`, כי `pg_cron`'s `net.http_post` לא נושא JWT משתמש בכלל. בלי הכיבוי הזה כל קריאה מה-cron תיכשל ב-401 מה-Gateway של Supabase לפני שהיא בכלל מגיעה לקוד שבודק את `CRON_SECRET`.
5. **להפעיל את הרחבת `pg_cron`** בדשבורד: Database → Extensions → לחפש `pg_cron` → Enable.
6. **להפעיל את הרחבת `pg_net`** (אם עוד לא מופעלת - נדרשת בשביל `net.http_post`): Database → Extensions → לחפש `pg_net` → Enable.
7. להריץ ב-SQL Editor (מחליפים את שני ה-`<...>` בערכים האמיתיים - ה-URL של הפרויקט וה-`CRON_SECRET` שהוגדר בשלב 2):
   ```sql
   select cron.schedule(
     'check-price-alerts-every-2-min',
     '*/2 * * * *',
     $$
     select net.http_post(
       url := '<https://osxzjswbasniwmuhwjyc.supabase.co>/functions/v1/check-price-alerts',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'X-Cron-Secret', '<אותו ערך שהוגדר כ-CRON_SECRET>'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```
   לבדיקה שהתזמון נרשם: `select * from cron.job;`. לביטול (אם צריך בעתיד): `select cron.unschedule('check-price-alerts-every-2-min');`.

**חשוב - `CRON_SECRET` הוא secret נפרד ועצמאי** מ-`APP_JWT_SECRET`/VAPID - לא קשור לזיהוי לקוחות, תפקידו היחיד הוא לוודא שרק ה-cron job שלנו (לא כל גורם ברשת) יכול להפעיל את `check-price-alerts`. אם אי-פעם דולף - להחליף גם את ה-secret וגם את ה-header בתזמון ה-`cron.schedule` (למחוק את הישן עם `cron.unschedule` וליצור מחדש).

**Cache per-symbol משותף:** שתי הפונקציות (`watchlist-prices`, `check-price-alerts`) חולקות
את אותו מטמון בזיכרון (`_shared/finnhubCache.ts`, TTL 2 דקות) - אם משתמשים שונים עוקבים
אחרי אותו טיקר, זו קריאת Finnhub אחת בלבד לחלון הזמן, לא אחת לכל משתמש/alert. זה בנוסף
ל-22 הקריאות ש-`market-indices` כבר צורכת כל 45 שניות - אם המכסה החינמית (60/דקה) אי-פעם
מתקרבת לתקרה בפועל, ה-TTL-ים הם המנוף הראשון להרחבה (לא שינוי שקט בהתנהגות).

## בדיקה ידנית אחרי הפריסה

```bash
curl -X POST https://osxzjswbasniwmuhwjyc.supabase.co/functions/v1/demo-start \
  -H "Content-Type: application/json" -d '{}'
# אמור להחזיר { "accountId": "...", "accessToken": "..." }
```

אם מוחזר 401/403 — ייתכן שהפונקציה דורשת JWT ברירת מחדל של Supabase (verify_jwt).
יש לוודא ש-`verify_jwt = false` עבור שתי הפונקציות (הן צריכות להיות נגישות ללא JWT קיים,
שהרי תפקידן להנפיק אחד). אפשר להגדיר זאת ב-`supabase/config.toml`:

```toml
[functions.demo-start]
verify_jwt = false

[functions.redeem]
verify_jwt = false
```

קובץ `config.toml` לא נוצר כאן (לא היה קיים config מקומי של הפרויקט) - יש להוסיף את
הבלוקים האלה אליו (או ליצור אותו עם `supabase init` אם עדיין אין) לפני הפריסה.
