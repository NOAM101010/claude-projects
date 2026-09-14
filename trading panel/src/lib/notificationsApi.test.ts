import { describe, expect, it } from 'vitest'
import { countUnread, type AppNotification } from './notificationsApi'

function makeNotification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    symbol: overrides.symbol ?? 'AAPL',
    message: overrides.message ?? 'AAPL is now $191.50 (above your target of $190.00)',
    createdAt: overrides.createdAt ?? '2026-09-14T10:00:00.000Z',
    readAt: overrides.readAt ?? null,
  }
}

describe('countUnread', () => {
  it('מחזירה 0 עבור רשימה ריקה', () => {
    expect(countUnread([])).toBe(0)
  })

  it('סופרת רק התראות עם readAt null', () => {
    const notifications = [
      makeNotification({ readAt: null }),
      makeNotification({ readAt: '2026-09-14T11:00:00.000Z' }),
      makeNotification({ readAt: null }),
    ]
    expect(countUnread(notifications)).toBe(2)
  })

  it('מחזירה 0 כשהכל כבר נקרא', () => {
    const notifications = [makeNotification({ readAt: '2026-09-14T11:00:00.000Z' })]
    expect(countUnread(notifications)).toBe(0)
  })
})
