import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_TRADE_LIMIT, canCreateTrade, clearAccountTradingData } from './accountApi'

vi.mock('./tradesApi', () => ({
  deleteAllTradesInWorkspace: vi.fn(async () => {}),
}))
vi.mock('./watchlistApi', () => ({
  deleteAllWatchlistAlerts: vi.fn(async () => {}),
}))

describe('canCreateTrade', () => {
  it('חוסם דמו בהגיעו למגבלת 5 טריידים', () => {
    expect(canCreateTrade('demo', 0)).toBe(true)
    expect(canCreateTrade('demo', DEMO_TRADE_LIMIT - 1)).toBe(true)
    expect(canCreateTrade('demo', DEMO_TRADE_LIMIT)).toBe(false)
    expect(canCreateTrade('demo', DEMO_TRADE_LIMIT + 1)).toBe(false)
  })

  it('לא מגביל דרגות בתשלום', () => {
    expect(canCreateTrade('basic', 1000)).toBe(true)
    expect(canCreateTrade('pro', 1000)).toBe(true)
  })
})

describe('clearAccountTradingData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מוחקת את הטריידים של כל workspace בחשבון, ואת כל ה-watchlist שלו', async () => {
    const { deleteAllTradesInWorkspace } = await import('./tradesApi')
    const { deleteAllWatchlistAlerts } = await import('./watchlistApi')

    await clearAccountTradingData('acc-1', ['ws-1', 'ws-2'])

    expect(deleteAllTradesInWorkspace).toHaveBeenCalledTimes(2)
    expect(deleteAllTradesInWorkspace).toHaveBeenNthCalledWith(1, 'ws-1')
    expect(deleteAllTradesInWorkspace).toHaveBeenNthCalledWith(2, 'ws-2')
    expect(deleteAllWatchlistAlerts).toHaveBeenCalledWith('acc-1')
  })

  it('לא נוגעת ב-watchlist/workspaces אחרים - workspaceIds ריק לא קורא ל-deleteAllTradesInWorkspace בכלל', async () => {
    const { deleteAllTradesInWorkspace } = await import('./tradesApi')
    const { deleteAllWatchlistAlerts } = await import('./watchlistApi')

    await clearAccountTradingData('acc-1', [])

    expect(deleteAllTradesInWorkspace).not.toHaveBeenCalled()
    expect(deleteAllWatchlistAlerts).toHaveBeenCalledWith('acc-1')
  })
})
