// עוזר משותף להנפקת JWT חתום (HS256) עם sub=account_id, בהתאם לתבנית
// "bring your own auth" הרשמית של Supabase - ראה supabase/README.md.
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * מנפיק access token עבור account_id נתון. ה-`sub` הוא ה-account_id הקבוע,
 * כך ש-`auth.uid()` בכל RLS policy שווה אליו בלי קשר למכשיר/session.
 */
export async function mintAccessToken(accountId: string, jwtSecret: string): Promise<string> {
  const key = await importHmacKey(jwtSecret)
  return create(
    { alg: 'HS256', typ: 'JWT' },
    {
      sub: accountId,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: getNumericDate(0),
      exp: getNumericDate(ONE_YEAR_SECONDS),
    },
    key,
  )
}

/**
 * מפענח את ה-`sub` (account_id) מתוך Authorization header, בלי לאמת חתימה שוב -
 * שכבת Supabase Gateway כבר עשתה זאת לפני שהבקשה הגיעה לפונקציה (verify_jwt=true,
 * ראה send-test-push/market-indices/watchlist-prices). מחזיר null אם ה-header חסר/מעוות.
 */
export function decodeJwtSub(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const payloadPart = token.split('.')[1]
  if (!payloadPart) return null
  try {
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { sub?: string }
    return payload.sub ?? null
  } catch {
    return null
  }
}
