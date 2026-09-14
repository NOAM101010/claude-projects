import { describe, expect, it } from 'vitest'
import { subscriptionToRow, urlBase64ToUint8Array } from './pushApi'

describe('urlBase64ToUint8Array', () => {
  it('ממיר מפתח VAPID תקין (base64url ללא padding) למערך בייטים לא ריק', () => {
    const key = 'BP-Fpmcr-031kKQV-lR0CUW4LQYEMekPEQ0HjubyGdKErWfBFCGprCznGX53fIsMlOSbZHZzHrr6q7iLfi8HSjA'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('מטפל נכון בתווים -/_  הספציפיים ל-base64url', () => {
    // "--__" ב-base64url שקול ל-"++//" ב-base64 רגיל
    const withUrlChars = urlBase64ToUint8Array('--__')
    const withStandardChars = Uint8Array.from(atob('++//'), (c) => c.charCodeAt(0))
    expect(Array.from(withUrlChars)).toEqual(Array.from(withStandardChars))
  })
})

describe('subscriptionToRow', () => {
  it('בונה שורת insert עם account_id ומפתחות ה-subscription', () => {
    const row = subscriptionToRow('acc-1', {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    })
    expect(row).toEqual({
      account_id: 'acc-1',
      endpoint: 'https://push.example.com/abc',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    })
  })
})
