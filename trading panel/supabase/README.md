# Supabase — TradePanel

**פרויקט:** `osxzjswbasniwmuhwjyc` (nakux.co / tradepanel). URL + publishable key כבר ב-`.env` (לא ב-git).

## סדר הרצה (SQL) — 001-010 כולן רצו בפועל ואומתו חי
- [x] `001_init_schema.sql` — טבלאות accounts/access_codes/workspaces/trades + RLS.
- [x] `002_add_setup_column.sql`, [x] `003_exchange_rate_cache.sql`, [x] `004_account_delete_policy.sql`, [x] `005_push_subscriptions.sql`
- [x] `006_chart_images_storage.sql` — bucket פרטי `chart-images` + מדיניות storage.objects.
- [x] `007_access_code_devices.sql` — `redeemed_devices jsonb`, מגבלת 3 מכשירים - **נבדק חי מול השרת** (מכשירים 1-3 עברו, מכשיר 4 נחסם 403 כמצופה).
- [x] `008_demo_trades_created.sql` — מונה טריידי-דמו עמיד בטריגר.
- [x] `009_unlimited_devices_codes.sql` — `unlimited_devices`, קודי הפיתוח האישיים (`DEVB-GKKH-TW4N-GUCD`/`DEVP-WRYQ-SQTW-YL2U`) נבדקו ועובדים.
- [x] `010_watchlist.sql` — טבלת watchlist+RLS+מגבלת 15 - **נבדק חי end-to-end** (הוספת alert, `check-price-alerts` הפעיל push, השורה הפכה ל-inactive).
- [x] `011_market_data_cache.sql` — טבלת `market_data_cache` (`key`/`payload` jsonb/`updated_at`), RLS מופעל בלי אף policy (רק service role נוגע בה). snapshot אחרון-שהצליח לכל key, `market-indices` נופל אליו כ-fallback כשהקריאה החיה ל-Finnhub נכשלת/rate-limited (התשובה חוזרת עם `stale:true`) - מגן מפני "N/A"/מקפים ב-Home כשה-instance של ה-Edge Function מוחלף וה-cache בזיכרון מתאפס. **הורצה בפועל** (2026-09-13, דרך `supabase db query --linked -f`, לא ידנית ב-SQL editor) - הטבלה קיימת ואומתה (`information_schema.tables`).

## Edge Functions — פרוסות ועובדות בפועל (2026-09-12)
`demo-start`, `redeem`, ו-`send-test-push` שלושתן **כתובות ופרוסות** על הפרויקט (`osxzjswbasniwmuhwjyc`), מאומת עם שמירת טרייד אמיתי דרך רענון מלא. `APP_JWT_SECRET` מוגדר כ-secret (ערכו = ה-"Legacy JWT Secret" של הפרויקט מ-Settings → API → JWT Keys - **אסור אף פעם לבצע Revoke על המפתח הישן הזה בדשבורד**, זה ישבור את מנגנון הזיהוי של כל הלקוחות). קוד/הוראות פריסה מלאות ב-`functions/README.md`.

## מודל זהות (למה אין Supabase Auth רגיל)
המוצר לא דורש הרשמה - זיהוי לפי קוד גישה בלבד, וקוד קיים במכשיר חדש חייב "למשוך" את אותה דאטה (לא ליצור כפולה). הפתרון: `account_id` הוא הזהות הקבועה (טבלת `accounts`), וה-JWT שהלקוח מחזיק מונפק ע"י Edge Function עם `sub` = ה-account_id (תבנית "bring your own auth" הרשמית של Supabase) - כך ש-`auth.uid()` ב-RLS תמיד שווה ל-account_id, בלי קשר למכשיר.

- **דמו (ביקור ראשון):** קריאה ל-`demo-start` יוצרת שורת `accounts` חדשה (tier='demo'), מנפיקה JWT, הלקוח שומר אותו ב-localStorage. כל טרייד הדמו נכתב תחת ה-account הזה דרך RLS רגיל.
- **הזנת קוד גישה:** קריאה ל-`redeem(code)` עם ה-account_id הנוכחי:
  - קוד לא מומש עדיין → משדרג את ה-account **הנוכחי** בו-מקום ל-tier של הקוד (הדאטה מהדמו נשארת, בלי "העברה").
  - קוד כבר מומש ע"י account אחר (מכשיר חדש) → מנפיק JWT חדש עם ה-`sub` של ה-account **המקורי**, הלקוח מחליף את המפתח המקומי - עכשיו רואה את הדאטה המקורית במכשיר החדש.
- Edge Functions משתמשות ב-service role (זמין אוטומטית בסביבת הפונקציה) + `APP_JWT_SECRET` (secret ידני, ראה למעלה - **לא** אוטומטי בפרויקטים חדשים).

## Watchlist + price alerts (שלב F, קוד מוכן, טרם פרוס)
שתי פונקציות חדשות (`watchlist-prices`, `check-price-alerts`) + מיגרציה `010_watchlist.sql`
+ secret חדש `CRON_SECRET` - הוראות פריסה/pg_cron מלאות ב-`functions/README.md`.

## תזכורת לפני השקה
להגדיר פינג תקופתי חיצוני (UptimeRobot / cron-job.org) לפרויקט כדי שלא "יכבה" אחרי שבוע בלי תנועה.
