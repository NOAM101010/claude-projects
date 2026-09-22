-- TradePanel — rate limiting על redeem Edge Function (robust-munching-puffin.md סבב 1).
-- רקע: קוד גישה הוא אמצעי הזיהוי היחיד במוצר (אין סיסמה) - עד כה לא הייתה שום הגנה על
-- ניחוש brute-force של קוד תקף, בשום שכבה. redeem_attempts הוא לוג ניסיונות (הצלחה/כישלון)
-- לפי deviceId, שנקרא ונכתב אך ורק מתוך redeem/index.ts (service role) - ראה שם למימוש
-- בדיקת הסף. אין policies ל-anon/authenticated בכלל, בדיוק כמו access_codes
-- (001_init_schema.sql: "access_codes: no policy granted to anon/authenticated roles at all").

create table redeem_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

alter table redeem_attempts enable row level security;
-- redeem_attempts: no policy granted to anon/authenticated roles at all - נקרא/נכתב
-- אך ורק דרך service role בתוך redeem/index.ts.

create index redeem_attempts_device_id_attempted_at_idx
  on redeem_attempts (device_id, attempted_at);
