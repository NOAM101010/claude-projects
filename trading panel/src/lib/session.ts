import { setSupabaseAccessToken, supabaseUrl } from './supabase'

const ACCOUNT_ID_KEY = 'tradepanel_account_id'
const ACCESS_TOKEN_KEY = 'tradepanel_access_token'
const CODE_VERIFIED_KEY = 'tradepanel_code_verified'
const DEVICE_ID_KEY = 'tradepanel_device_id'
const DEVICE_ID_COOKIE = 'tradepanel_device_id'
const DEVICE_ID_DB_NAME = 'tradepanel-device'
const DEVICE_ID_DB_STORE = 'device'
/** תוקף העוגייה - כשנה, כמו שאר מנגנוני "זכור אותי" לצמיתות בקובץ הזה. */
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

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

function readCookie(name: string): string | null {
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${DEVICE_ID_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`
}

function openDeviceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEVICE_ID_DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DEVICE_ID_DB_STORE)) req.result.createObjectStore(DEVICE_ID_DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** best-effort - IndexedDB יכול להיות חסום (מצב פרטי/הגדרות דפדפן) בלי לחסום את האפליקציה. */
async function readIndexedDb(): Promise<string | null> {
  try {
    const db = await openDeviceDb()
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(DEVICE_ID_DB_STORE, 'readonly')
      const req = tx.objectStore(DEVICE_ID_DB_STORE).get(DEVICE_ID_KEY)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function writeIndexedDb(value: string): Promise<void> {
  try {
    const db = await openDeviceDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DEVICE_ID_DB_STORE, 'readwrite')
      tx.objectStore(DEVICE_ID_DB_STORE).put(value, DEVICE_ID_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore - best-effort, ראה readIndexedDb
  }
}

/**
 * הערך הקנוני מתוך שלושת המקורות, לפי סדר עדיפות localStorage -> cookie -> IndexedDB
 * (הראשון שיש בו ערך לא-ריק "מנצח"). פונקציה טהורה (לא נוגעת ב-I/O בעצמה) כדי שקל
 * לבדוק אותה - ראה session.test.ts לכל תרחישי "ניקוי חלקי" (מקור אחד חסר, השאר קיימים).
 */
export function resolveDeviceId(fromLocalStorage: string | null, fromCookie: string | null, fromIndexedDb: string | null): string | null {
  return fromLocalStorage || fromCookie || fromIndexedDb || null
}

/** כותב אותו deviceId לשלושת המקורות (best-effort - כשל באחד לא חוסם את האחרים). */
async function persistDeviceIdEverywhere(deviceId: string): Promise<void> {
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  writeCookie(DEVICE_ID_COOKIE, deviceId)
  await writeIndexedDb(deviceId)
}

/**
 * מזהה מכשיר יציב לצמיתות - נוצר פעם אחת (`crypto.randomUUID()`) ונשמר **בו-זמנית**
 * ב-3 מקומות (localStorage, IndexedDB, ועוגיה לשנה) - הרתעה רכה מול ניקוי-חלקי (רוב כלי
 * "ניקוי דפדפן" רגילים מוחקים רק localStorage) שהיה גורם ל-`redeem` לראות "מכשיר חדש"
 * בטעות ולעקוף את מגבלת המכשירים. **לא** פותר ניקוי-כל-שלושה-יחד/גלישה פרטית מכוונת -
 * זו לא הכוונה (ראה `supabase/functions/redeem/index.ts`). נשלח לשרת עם כל קריאה ל-`redeem`
 * כדי לאכוף מגבלת המכשירים לקוד. לא קשור ל-accountId/accessToken - נשאר זהה גם אחרי
 * redeem שמחליף אותם.
 */
export async function getDeviceId(): Promise<string> {
  const fromLocalStorage = localStorage.getItem(DEVICE_ID_KEY)
  const fromCookie = readCookie(DEVICE_ID_COOKIE)
  const fromIndexedDb = await readIndexedDb()

  const existing = resolveDeviceId(fromLocalStorage, fromCookie, fromIndexedDb)
  if (existing) {
    // נמצא באחד לפחות מהמקורות - אם חסר באחר/ים (ניקוי חלקי), משחזרים לכולם במקום ליצור חדש.
    if (existing !== fromLocalStorage || existing !== fromCookie || existing !== fromIndexedDb) {
      await persistDeviceIdEverywhere(existing)
    }
    return existing
  }

  const deviceId = crypto.randomUUID()
  await persistDeviceIdEverywhere(deviceId)
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
    throw new Error(data.error ?? `Call to ${name} failed (${res.status})`)
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
    deviceId: await getDeviceId(),
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
