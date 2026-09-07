# פריסה ל-Vercel

האפליקציה בנויה ל-**PostgreSQL** (לא SQLite). הפרודקשן מתחיל ממסד ריק — אין הגירת נתונים.

---

## 1. הגדרת הפרויקט ב-Vercel

בעת ה-Import מ-GitHub:

| שדה | ערך |
|---|---|
| Framework Preset | Next.js |
| **Root Directory** | `TRAIDING/swing-trader` |
| Build Command | להשאיר ברירת מחדל |
| Install Command | להשאיר ברירת מחדל |

> חשוב: אם ה-Root Directory לא מוגדר, ה-build ייכשל מיד (Vercel לא ימצא את `package.json`).

## 2. יצירת מסד הנתונים

בדשבורד של הפרויקט → טאב **Storage** → **Create Database** → **Postgres** (Neon) → Connect to Project.
Vercel מזריקה אוטומטית את `DATABASE_URL` (וגם `POSTGRES_*`) לכל הסביבות. אין צורך להעתיק ידנית.

## 3. משתני סביבה (Settings → Environment Variables)

| משתנה | ערך |
|---|---|
| `DATABASE_URL` | ✅ נוצר אוטומטית ע"י Vercel Postgres |
| `VAPID_PUBLIC_KEY` | מתוך ה-`.env` המקומי (או `npm run generate-vapid`) |
| `VAPID_PRIVATE_KEY` | מתוך ה-`.env` המקומי |
| `VAPID_CONTACT` | `mailto:your@email.com` |
| `CRON_SECRET` | `e8c058a661f818eb7ff95c3f640e96d6d61008c856572609d531921bff1dfa5b` |

`CRON_SECRET` מאמת שקריאות ל-`/api/scanner/cron` הגיעו מ-Vercel Cron. Vercel שולחת אוטומטית
`Authorization: Bearer $CRON_SECRET` בקריאות Cron — רק צריך להגדיר את המשתנה.
פירוט מלא של המשתנים: `.env.example`.

## 4. ה-build

`package.json` מוגדר כך:

- `postinstall`: `prisma generate` — מייצר את Prisma Client (חובה ב-Vercel, אחרת ה-build נופל).
- `vercel-build`: `prisma migrate deploy && next build` — Vercel מריצה את הסקריפט הזה במקום `build`,
  כך שהמיגרציות רצות על ה-DB לפני הבנייה. ב-deploy הראשון זה יוצר את כל 9 הטבלאות.
- `build` (מקומי): `next build` בלבד — לא נוגע ב-DB.

> אם משום מה Vercel מתעלמת מ-`vercel-build`: Settings → Build & Development Settings →
> Build Command → Override → `prisma migrate deploy && next build`.

## 5. Cron

`vercel.json` כבר מגדיר:

```json
{ "crons": [{ "path": "/api/scanner/cron", "schedule": "0 10 * * 1-5" }] }
```

הסריקה תרוץ אוטומטית בימים א׳–ה׳ ב-10:00 UTC. אין מה להגדיר ידנית — Vercel קוראת את הקובץ.
(בתוכנית Hobby יש תקרה של cron job אחד ליום; ה-schedule הזה עומד בזה.)

---

## מיגרציות

- `prisma/migrations/0_init/migration.sql` — מיגרציה ראשונית אחת שיוצרת את כל הסכימה.
  ההיסטוריה הישנה (SQLite) נמחקה כי היא לא ניתנת להרצה על Postgres ואין נתונים להגר.
- שינוי סכימה בעתיד: `npm run db:migrate` מול Postgres של פיתוח → commit לתיקיית `migrations` →
  push, ו-Vercel תריץ `migrate deploy` אוטומטית.

## פיתוח מקומי

⚠️ מאז המעבר ל-Postgres, `prisma/dev.db` (SQLite) **לא בשימוש יותר**. הקובץ נשאר בדיסק אך אינו נטען.
כדי לפתח מקומית צריך Postgres:

1. Postgres מקומי / Docker, **או** Prisma Postgres חינמי (`npx prisma init --db`), **או**
   להשתמש במחרוזת החיבור של Vercel Postgres (`vercel env pull`).
2. לעדכן `DATABASE_URL` ב-`.env`.
3. `npx prisma migrate deploy` (או `npm run db:migrate`) ואז `npm run dev`.
