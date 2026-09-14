import { describe, expect, it } from 'vitest'
import { formatDurationHHMM, getMarketStatus } from './marketHours'

// כל ה-timestamps ב-UTC, ינואר 2026 (NY ב-EST, UTC-5, בלי סיבוכי DST).
// 2026-01-14 = יום רביעי, 2026-01-16 = יום שישי, 2026-01-17 = שבת, 2026-01-18 = ראשון.

describe('getMarketStatus', () => {
  it('פתוח באמצע יום מסחר (רביעי 10:00 NY)', () => {
    const status = getMarketStatus(new Date('2026-01-14T15:00:00Z'))
    expect(status.isOpen).toBe(true)
    expect(status.minutesUntilClose).toBe(360) // 16:00 - 10:00
  })

  it('פתוח בדיוק ברגע הפתיחה (09:30 NY)', () => {
    const status = getMarketStatus(new Date('2026-01-14T14:30:00Z'))
    expect(status.isOpen).toBe(true)
    expect(status.minutesUntilClose).toBe(390)
  })

  it('סגור בדיוק ברגע הסגירה (16:00 NY) - נחשב סגור, נפתח למחרת', () => {
    const status = getMarketStatus(new Date('2026-01-14T21:00:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(4) // חמישי
  })

  it('סגור לפני הפתיחה באותו יום מסחר (רביעי 09:00 NY) - נפתח היום', () => {
    const status = getMarketStatus(new Date('2026-01-14T14:00:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(3) // רביעי, אותו יום
    expect(status.nextOpenHour).toBe(9)
    expect(status.nextOpenMinute).toBe(30)
  })

  it('סגור אחרי הסגירה (רביעי 16:30 NY) - נפתח למחרת (חמישי)', () => {
    const status = getMarketStatus(new Date('2026-01-14T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(4)
  })

  it('סגור אחרי הסגירה ביום שישי - נפתח ביום שני הבא (לא בסופ"ש)', () => {
    const status = getMarketStatus(new Date('2026-01-16T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(1) // שני
  })

  it('סגור בשבת - נפתח ביום שני', () => {
    const status = getMarketStatus(new Date('2026-01-17T12:00:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(1)
  })

  it('סגור בראשון - נפתח ביום שני', () => {
    const status = getMarketStatus(new Date('2026-01-18T12:00:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(1)
  })
})

describe('getMarketStatus - nextOpenAt (DST-aware)', () => {
  it('נפתח למחרת בתוך EST (חורף, UTC-5) - נכון גם ב-UTC וגם בהמרה לזמן מקומי', () => {
    // רביעי 2026-01-14 21:30 NY (16:30 EST) - סגור, נפתח למחרת (חמישי) 09:30 EST = 14:30Z.
    const status = getMarketStatus(new Date('2026-01-14T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenAt?.toISOString()).toBe('2026-01-15T14:30:00.000Z')
  })

  it('נפתח בתוך EDT (קיץ, UTC-4) - offset שונה מ-EST אבל עדיין 09:30 NY מדויק', () => {
    // רביעי 2026-07-15 21:30 NY (17:30 EDT) - סגור, נפתח למחרת (חמישי) 09:30 EDT = 13:30Z.
    const status = getMarketStatus(new Date('2026-07-15T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenAt?.toISOString()).toBe('2026-07-16T13:30:00.000Z')
  })

  it('מעבר ל-DST במרץ 2026 (שעון קדימה ב-8/3) - יעד אחרי המעבר מחושב ב-EDT (UTC-4) נכון', () => {
    // שישי 2026-03-06 21:30 NY (16:30 EST, לפני המעבר) - סגור, נפתח שני 2026-03-09 -
    // אחרי מעבר ה-DST של 2026-03-08, אז 09:30 NY זה כבר EDT = 13:30Z (לא 14:30Z כמו ב-EST).
    const status = getMarketStatus(new Date('2026-03-06T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(1) // שני
    expect(status.nextOpenAt?.toISOString()).toBe('2026-03-09T13:30:00.000Z')
  })

  it('מעבר חזרה ל-standard time בנובמבר 2026 (שעון אחורה ב-1/11) - יעד אחרי המעבר מחושב ב-EST (UTC-5) נכון', () => {
    // שישי 2026-10-30 21:30 NY (17:30 EDT, לפני המעבר) - סגור, נפתח שני 2026-11-02 -
    // אחרי מעבר ה-DST של 2026-11-01, אז 09:30 NY זה כבר EST = 14:30Z (לא 13:30Z כמו ב-EDT).
    const status = getMarketStatus(new Date('2026-10-30T21:30:00Z'))
    expect(status.isOpen).toBe(false)
    expect(status.nextOpenWeekday).toBe(1) // שני
    expect(status.nextOpenAt?.toISOString()).toBe('2026-11-02T14:30:00.000Z')
  })

  it('פתוח כרגע בתוך EDT (קיץ) - minutesUntilClose מחושב נכון גם כש-offset הוא -4', () => {
    // רביעי 2026-07-15 14:00 NY (10:00 EDT) - פתוח, 6 שעות עד סגירה (16:00 EDT).
    const status = getMarketStatus(new Date('2026-07-15T14:00:00Z'))
    expect(status.isOpen).toBe(true)
    expect(status.minutesUntilClose).toBe(360)
  })
})

describe('formatDurationHHMM', () => {
  it('מעצב דקות ל-HH:MM', () => {
    expect(formatDurationHHMM(0)).toBe('00:00')
    expect(formatDurationHHMM(90)).toBe('01:30')
    expect(formatDurationHHMM(360)).toBe('06:00')
    expect(formatDurationHHMM(5)).toBe('00:05')
  })
})
