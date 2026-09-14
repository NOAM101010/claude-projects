import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAlertHistory,
  createWatchlistAlert,
  deleteAllWatchlistAlerts,
  listAlertHistory,
  setWatchlistAlert,
} from './watchlistApi'

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

// מגבלות הסימבולים/ההתראות התלויות-דרגה (canAddWatchlistSymbol/canSetWatchlistAlert)
// עברו ל-tierLimits.ts/tierLimits.test.ts.

describe('deleteAllWatchlistAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מוחקת את כל שורות ה-watchlist של החשבון לפי account_id', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const del = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ delete: del }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await deleteAllWatchlistAlerts('acc-1')

    expect(from).toHaveBeenCalledWith('watchlist')
    expect(del).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('account_id', 'acc-1')
  })

  it('זורקת אם השרת מחזיר שגיאה', async () => {
    const eq = vi.fn(async () => ({ error: new Error('boom') }))
    const from = vi.fn(() => ({ delete: () => ({ eq }) }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(deleteAllWatchlistAlerts('acc-1')).rejects.toThrow('boom')
  })
})

describe('listAlertHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('שולפת רק שורות active=false, ממוינות לפי triggered_at יורד', async () => {
    const order = vi.fn(async () => ({ data: [], error: null }))
    const eqActive = vi.fn(() => ({ order }))
    const eqAccount = vi.fn(() => ({ eq: eqActive }))
    const select = vi.fn(() => ({ eq: eqAccount }))
    const from = vi.fn(() => ({ select }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await listAlertHistory('acc-1')

    expect(from).toHaveBeenCalledWith('watchlist')
    expect(eqAccount).toHaveBeenCalledWith('account_id', 'acc-1')
    expect(eqActive).toHaveBeenCalledWith('active', false)
    expect(order).toHaveBeenCalledWith('triggered_at', { ascending: false })
  })
})

describe('createWatchlistAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('יוצרת שורת "מעקב בלבד" (target_price/direction null) כשלא הועברו', async () => {
    const single = vi.fn(async () => ({
      data: { id: '1', account_id: 'acc-1', symbol: 'AAPL', target_price: null, direction: null, active: true, triggered_at: null, created_at: 't' },
      error: null,
    }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    const result = await createWatchlistAlert('acc-1', 'basic', 'aapl', undefined, undefined, 0, 0)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: 'acc-1', symbol: 'AAPL', target_price: null, direction: null }),
    )
    expect(result.targetPrice).toBeNull()
    expect(result.direction).toBeNull()
  })

  it('יוצרת שורה עם יעד+כיוון כשהועברו', async () => {
    const single = vi.fn(async () => ({
      data: { id: '1', account_id: 'acc-1', symbol: 'AAPL', target_price: 200, direction: 'above', active: true, triggered_at: null, created_at: 't' },
      error: null,
    }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    const result = await createWatchlistAlert('acc-1', 'basic', 'aapl', 200, 'above', 0, 0)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_price: 200, direction: 'above' }),
    )
    expect(result.targetPrice).toBe(200)
  })

  it('זורקת כשהוגעה מגבלת הסימבולים הפעילים של הדרגה', async () => {
    await expect(createWatchlistAlert('acc-1', 'demo', 'aapl', undefined, undefined, 2, 0)).rejects.toThrow(
      'Watchlist limit of 2 active symbols reached',
    )
  })

  it('זורקת כשהוגעה מגבלת ההתראות של הדרגה, גם אם עדיין יש מקום לסימבולים', async () => {
    await expect(createWatchlistAlert('acc-1', 'demo', 'aapl', 200, 'above', 0, 0)).rejects.toThrow(
      'Watchlist alert limit of 0 reached',
    )
  })
})

describe('setWatchlistAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מעדכנת target_price+direction על שורה קיימת לפי id', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await setWatchlistAlert('id-1', 'basic', 150, 'below', 0)

    expect(from).toHaveBeenCalledWith('watchlist')
    expect(update).toHaveBeenCalledWith({ target_price: 150, direction: 'below' })
    expect(eq).toHaveBeenCalledWith('id', 'id-1')
  })

  it('זורקת אם השרת מחזיר שגיאה', async () => {
    const eq = vi.fn(async () => ({ error: new Error('boom') }))
    const from = vi.fn(() => ({ update: () => ({ eq }) }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(setWatchlistAlert('id-1', 'basic', 150, 'below', 0)).rejects.toThrow('boom')
  })

  it('זורקת כשהוגעה מגבלת ההתראות של הדרגה, לפני קריאה לשרת', async () => {
    await expect(setWatchlistAlert('id-1', 'demo', 150, 'below', 0)).rejects.toThrow('Watchlist alert limit of 0 reached')
  })
})

describe('clearAlertHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מוחקת רק שורות active=false של החשבון - לא נוגעת בהתראות פעילות', async () => {
    const eqActive = vi.fn(async () => ({ error: null }))
    const eqAccount = vi.fn(() => ({ eq: eqActive }))
    const del = vi.fn(() => ({ eq: eqAccount }))
    const from = vi.fn(() => ({ delete: del }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await clearAlertHistory('acc-1')

    expect(eqAccount).toHaveBeenCalledWith('account_id', 'acc-1')
    expect(eqActive).toHaveBeenCalledWith('active', false)
  })
})
