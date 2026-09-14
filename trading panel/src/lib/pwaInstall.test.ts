import { describe, expect, it } from 'vitest'
import { isIosSafari, isStandaloneDisplay } from './pwaInstall'

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

describe('isIosSafari', () => {
  it('מזהה iPhone/iPad עם Safari אמיתי', () => {
    expect(isIosSafari(IOS_SAFARI)).toBe(true)
  })

  it('לא מזהה Chrome-on-iOS כ-Safari (למרות שהוא מבוסס WebKit)', () => {
    expect(isIosSafari(IOS_CHROME)).toBe(false)
  })

  it('לא מזהה אנדרואיד או דסקטופ', () => {
    expect(isIosSafari(ANDROID_CHROME)).toBe(false)
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false)
  })
})

describe('isStandaloneDisplay', () => {
  it('true אם display-mode:standalone תואם', () => {
    expect(isStandaloneDisplay(true, undefined)).toBe(true)
  })

  it('true אם navigator.standalone של iOS הוא true', () => {
    expect(isStandaloneDisplay(false, true)).toBe(true)
  })

  it('false כשאף אחד מהשניים לא מתקיים', () => {
    expect(isStandaloneDisplay(false, false)).toBe(false)
    expect(isStandaloneDisplay(false, undefined)).toBe(false)
  })
})
