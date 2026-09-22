import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllNotifications, countUnread, deleteNotification, type AppNotification } from './notificationsApi'

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

function makeNotification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    symbol: overrides.symbol ?? 'AAPL',
    message: overrides.message ?? 'AAPL is now $191.50 (above your target of $190.00)',
    createdAt: overrides.createdAt ?? '2026-09-14T10:00:00.000Z',
    readAt: overrides.readAt ?? null,
    direction: overrides.direction ?? 'above',
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

describe('deleteNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מוחקת התראה בודדת לפי id', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const del = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ delete: del }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await deleteNotification('notif-1')

    expect(from).toHaveBeenCalledWith('notifications')
    expect(eq).toHaveBeenCalledWith('id', 'notif-1')
  })

  it('זורקת שגיאה אם השרת מחזיר error', async () => {
    const eq = vi.fn(async () => ({ error: new Error('boom') }))
    const del = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ delete: del }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(deleteNotification('notif-1')).rejects.toThrow('boom')
  })
})

describe('clearAllNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מוחקת את כל ההתראות של החשבון לפי account_id', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const del = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ delete: del }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await clearAllNotifications('acc-1')

    expect(from).toHaveBeenCalledWith('notifications')
    expect(eq).toHaveBeenCalledWith('account_id', 'acc-1')
  })
})
