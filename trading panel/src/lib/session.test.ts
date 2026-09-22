import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDeviceId, resolveDeviceId } from './session'

const DEVICE_ID_KEY = 'tradepanel_device_id'
const DEVICE_ID_DB_STORE = 'device'

/** localStorage מינימלי מבוסס-Map - הסביבה כאן node (לא jsdom), אין localStorage אמיתי. */
function createFakeLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
  }
}

/** document.cookie מינימלי - תומך רק ב"set = append" ו-read, כמו התנהגות דפדפן אמיתית מול ה-regex ב-session.ts. */
function createFakeDocument() {
  let cookieString = ''
  return {
    get cookie() {
      return cookieString
    },
    set cookie(value: string) {
      const [pair] = value.split(';')
      const [name] = pair.split('=')
      const existingPairs = cookieString
        .split('; ')
        .filter((c) => c && !c.startsWith(`${name}=`))
      existingPairs.push(pair)
      cookieString = existingPairs.join('; ')
    },
    clear: () => {
      cookieString = ''
    },
  }
}

/** IndexedDB מינימלי (in-memory) שתומך רק בפעולות ש-session.ts בפועל משתמש בהן:
 * open (עם onupgradeneeded ליצירת ה-object store), get, put. מספיק לבדוק את זרימת
 * השחזור המשולשת בלי תלות בחבילה חיצונית (fake-indexeddb לא מותקנת בפרויקט). */
function createFakeIndexedDb() {
  const store = new Map<string, string>()

  function open() {
    const req: Record<string, unknown> = { onupgradeneeded: null, onsuccess: null, onerror: null, result: undefined }
    queueMicrotask(() => {
      const db = {
        objectStoreNames: { contains: (name: string) => name === DEVICE_ID_DB_STORE },
        createObjectStore: () => undefined,
        transaction: () => {
          const tx: Record<string, unknown> = { oncomplete: null, onerror: null }
          queueMicrotask(() => {
            ;(tx.oncomplete as (() => void) | null)?.()
          })
          return {
            objectStore: () => ({
              get: (key: string) => {
                const getReq: Record<string, unknown> = { onsuccess: null, onerror: null, result: undefined }
                queueMicrotask(() => {
                  getReq.result = store.get(key)
                  ;(getReq.onsuccess as (() => void) | null)?.()
                })
                return getReq
              },
              put: (value: string, key: string) => {
                store.set(key, value)
                return {}
              },
            }),
            get oncomplete() {
              return tx.oncomplete
            },
            set oncomplete(fn: unknown) {
              tx.oncomplete = fn
            },
            get onerror() {
              return tx.onerror
            },
            set onerror(fn: unknown) {
              tx.onerror = fn
            },
          }
        },
      }
      req.result = db
      ;(req.onupgradeneeded as (() => void) | null)?.()
      ;(req.onsuccess as (() => void) | null)?.()
    })
    return req
  }

  return { open, _store: store }
}

let fakeLocalStorage: ReturnType<typeof createFakeLocalStorage>
let fakeDocument: ReturnType<typeof createFakeDocument>
let fakeIndexedDb: ReturnType<typeof createFakeIndexedDb>

beforeEach(() => {
  fakeLocalStorage = createFakeLocalStorage()
  fakeDocument = createFakeDocument()
  fakeIndexedDb = createFakeIndexedDb()
  vi.stubGlobal('localStorage', fakeLocalStorage)
  vi.stubGlobal('document', fakeDocument)
  vi.stubGlobal('indexedDB', fakeIndexedDb)
  vi.stubGlobal('crypto', { randomUUID: () => 'generated-uuid-1234' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveDeviceId (עדיפות: localStorage -> cookie -> IndexedDB)', () => {
  it('כל השלושה ריקים -> null', () => {
    expect(resolveDeviceId(null, null, null)).toBeNull()
  })

  it('localStorage מנצח כשקיים בכולם', () => {
    expect(resolveDeviceId('from-ls', 'from-cookie', 'from-idb')).toBe('from-ls')
  })

  it('cookie מנצח כש-localStorage ריק', () => {
    expect(resolveDeviceId(null, 'from-cookie', 'from-idb')).toBe('from-cookie')
  })

  it('IndexedDB הוא המקור האחרון כששני האחרים ריקים', () => {
    expect(resolveDeviceId(null, null, 'from-idb')).toBe('from-idb')
  })
})

describe('getDeviceId - זרימת שמירה/שחזור משולשת', () => {
  it('כל שלושת המקורות ריקים -> נוצר מזהה חדש ונשמר בכולם', async () => {
    const id = await getDeviceId()
    expect(id).toBe('generated-uuid-1234')
    expect(fakeLocalStorage.getItem(DEVICE_ID_KEY)).toBe(id)
    expect(fakeDocument.cookie).toContain(`tradepanel_device_id=${id}`)
    expect(fakeIndexedDb._store.get(DEVICE_ID_KEY)).toBe(id)
  })

  it('localStorage בלבד מכיל ערך -> משוחזר ל-cookie ו-IndexedDB, לא נוצר חדש', async () => {
    fakeLocalStorage.setItem(DEVICE_ID_KEY, 'existing-device-id')
    const id = await getDeviceId()
    expect(id).toBe('existing-device-id')
    expect(fakeDocument.cookie).toContain('tradepanel_device_id=existing-device-id')
    expect(fakeIndexedDb._store.get(DEVICE_ID_KEY)).toBe('existing-device-id')
  })

  it('cookie בלבד מכיל ערך -> משוחזר ל-localStorage ו-IndexedDB, לא נוצר חדש', async () => {
    fakeDocument.cookie = 'tradepanel_device_id=cookie-only-id'
    const id = await getDeviceId()
    expect(id).toBe('cookie-only-id')
    expect(fakeLocalStorage.getItem(DEVICE_ID_KEY)).toBe('cookie-only-id')
    expect(fakeIndexedDb._store.get(DEVICE_ID_KEY)).toBe('cookie-only-id')
  })

  it('IndexedDB בלבד מכיל ערך -> משוחזר ל-localStorage ו-cookie, לא נוצר חדש', async () => {
    fakeIndexedDb._store.set(DEVICE_ID_KEY, 'idb-only-id')
    const id = await getDeviceId()
    expect(id).toBe('idb-only-id')
    expect(fakeLocalStorage.getItem(DEVICE_ID_KEY)).toBe('idb-only-id')
    expect(fakeDocument.cookie).toContain('tradepanel_device_id=idb-only-id')
  })
})
