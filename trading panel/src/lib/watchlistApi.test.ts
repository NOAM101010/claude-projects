import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_WATCHLIST_ALERTS, canAddWatchlistAlert, deleteAllWatchlistAlerts } from './watchlistApi'

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

describe('canAddWatchlistAlert', () => {
  it('מאפשר הוספה כל עוד לא הגיעו למגבלת 15 הסימבולים הפעילים', () => {
    expect(canAddWatchlistAlert(0)).toBe(true)
    expect(canAddWatchlistAlert(MAX_WATCHLIST_ALERTS - 1)).toBe(true)
  })

  it('חוסם הוספה בהגיעו למגבלה (תואם לטריגר בשרת ב-010_watchlist.sql)', () => {
    expect(canAddWatchlistAlert(MAX_WATCHLIST_ALERTS)).toBe(false)
    expect(canAddWatchlistAlert(MAX_WATCHLIST_ALERTS + 1)).toBe(false)
  })
})

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
