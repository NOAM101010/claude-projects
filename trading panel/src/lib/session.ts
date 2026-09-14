import { setSupabaseAccessToken, supabaseUrl } from './supabase'

const ACCOUNT_ID_KEY = 'tradepanel_account_id'
const ACCESS_TOKEN_KEY = 'tradepanel_access_token'
const CODE_VERIFIED_KEY = 'tradepanel_code_verified'
const DEVICE_ID_KEY = 'tradepanel_device_id'

export interface Session {
  accountId: string
  accessToken: string
}

interface DemoStartResponse {
  accountId: string
  accessToken: string
  error?: string
}

interface RedeemResponse {
  accountId: string
  accessToken: string
  tier: string
  error?: string
}

/**
 * מזהה מכשיר יציב לצמיתות - נוצר פעם אחת (`crypto.randomUUID()`) ונשמר ב-localStorage,
 * לעולם לא משתנה. נשלח לשרת עם כל קריאה ל-`redeem` כדי לאכוף מגבלת 3 מכשירים לקוד
 * (ראה `supabase/functions/redeem/index.ts`). לא קשור ל-accountId/accessToken - נשאר
 * זהה גם אחרי redeem שמחליף אותם.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

function readStoredSession(): Session | null {
  const accountId = localStorage.getItem(ACCOUNT_ID_KEY)
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!accountId || !accessToken) return null
  return { accountId, accessToken }
}

function persistSession(session: Session): void {
  localStorage.setItem(ACCOUNT_ID_KEY, session.accountId)
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
  setSupabaseAccessToken(session.accessToken)
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `קריאה ל-${name} נכשלה (${res.status})`)
  }
  return data
}

/**
 * מבטיח שיש session פעיל: אם יש כבר accountId/accessToken שמורים, מחזיר אותם
 * (אחרי חיבור ה-token ללקוח Supabase). אם אין, יוצר חשבון דמו חדש דרך
 * ה-Edge Function `demo-start` ושומר את התוצאה.
 */
export async function ensureSession(): Promise<Session> {
  const stored = readStoredSession()
  if (stored) {
    setSupabaseAccessToken(stored.accessToken)
    return stored
  }

  const data = await callFunction<DemoStartResponse>('demo-start', {})
  const session: Session = { accountId: data.accountId, accessToken: data.accessToken }
  persistSession(session)
  return session
}

/**
 * מממש קוד גישה עבור ה-account הנוכחי ומעדכן את ה-session המקומי לפי התשובה.
 * `switchedAccount=true` אם הקוד הזה כבר היה משויך לחשבון **אחר** (ר' `redeem`
 * Edge Function) - המשתמש עבר בשקט לדאטה של חשבון שונה, לא לזה שהיה לו רגע קודם.
 * זה קורה תמיד אם קוד אחד נכנס בכמה מכשירים/פעמים - חוקי, אבל חייב תמיד להיות
 * גלוי למשתמש, לא שקט (ראה ה-caller ב-`useRedeemCode`/`App.tsx`).
 */
export async function redeemCode(code: string): Promise<{ session: Session; tier: string; switchedAccount: boolean }> {
  const current = readStoredSession()
  if (!current) throw new Error('No active session')

  const data = await callFunction<RedeemResponse>('redeem', {
    code,
    currentAccountId: current.accountId,
    deviceId: getDeviceId(),
  })
  const session: Session = { accountId: data.accountId, accessToken: data.accessToken }
  persistSession(session)
  return { session, tier: data.tier, switchedAccount: data.accountId !== current.accountId }
}

export function getStoredSession(): Session | null {
  return readStoredSession()
}

/**
 * האם המשתמש כבר עבר את שער קוד הגישה במכשיר הזה (ראה `src/config/locks.ts`
 * REQUIRE_ACCESS_CODE_GATE). נשמר לצמיתות ב-localStorage - אותה מחלקת עמידות כמו
 * accountId/accessToken, לפי החלטת המשתמש ("forever on this device").
 */
export function isCodeVerified(): boolean {
  return localStorage.getItem(CODE_VERIFIED_KEY) === '1'
}

export function markCodeVerified(): void {
  localStorage.setItem(CODE_VERIFIED_KEY, '1')
}
