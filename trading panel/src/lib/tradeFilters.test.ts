import { describe, expect, it } from 'vitest'
import { DEFAULT_TRADE_FILTERS, filterTrades, hasActiveFilters, matchesDateRange, type TradeFiltersState } from './tradeFilters'
import { computePnl } from './stats'
import type { Trade } from '../types/trade'

function makeTrade(overrides: Partial<Trade>): Trade {
  const base: Trade = {
    id: overrides.id ?? crypto.randomUUID(),
    symbol: 'AAPL',
    direction: 'long',
    entryAt: '2026-01-15T10:00:00.000Z',
    entryPrice: 100,
    quantity: 10,
    stopLoss: null,
    takeProfit: null,
    exitAt: '2026-01-16T10:00:00.000Z',
    exitPrice: 110,
    pnl: null,
    currency: 'USD',
    fee: 0,
    notes: '',
    ...overrides,
  }
  if (overrides.pnl === undefined) {
    base.pnl = computePnl({
      direction: base.direction,
      entryPrice: base.entryPrice,
      exitPrice: base.exitPrice,
      quantity: base.quantity,
      fee: base.fee,
    })
  }
  return base
}

// יום ראשון קבוע, אמצע חודש/שנה, כדי שכל שבוע/חודש/שנה יהיו יציבים בבדיקות.
const REF = new Date(2026, 5, 15, 12, 0, 0) // Monday, June 15 2026, local noon

describe('matchesDateRange', () => {
  it('"all" matches everything regardless of date', () => {
    expect(matchesDateRange('2020-01-01T00:00:00.000Z', 'all', '', '', REF)).toBe(true)
  })

  it('"today" matches only the reference local day', () => {
    const sameDay = new Date(2026, 5, 15, 3, 0, 0).toISOString()
    const otherDay = new Date(2026, 5, 14, 23, 0, 0).toISOString()
    expect(matchesDateRange(sameDay, 'today', '', '', REF)).toBe(true)
    expect(matchesDateRange(otherDay, 'today', '', '', REF)).toBe(false)
  })

  it('"thisWeek" matches from local Sunday through the reference day', () => {
    // REF is Monday June 15 2026 -> week start is Sunday June 14 2026
    const inWeek = new Date(2026, 5, 14, 1, 0, 0).toISOString()
    const beforeWeek = new Date(2026, 5, 13, 23, 0, 0).toISOString()
    const afterRef = new Date(2026, 5, 16, 1, 0, 0).toISOString()
    expect(matchesDateRange(inWeek, 'thisWeek', '', '', REF)).toBe(true)
    expect(matchesDateRange(beforeWeek, 'thisWeek', '', '', REF)).toBe(false)
    expect(matchesDateRange(afterRef, 'thisWeek', '', '', REF)).toBe(false)
  })

  it('"thisMonth" matches only the reference local month/year', () => {
    expect(matchesDateRange(new Date(2026, 5, 1, 0, 0, 0).toISOString(), 'thisMonth', '', '', REF)).toBe(true)
    expect(matchesDateRange(new Date(2026, 4, 30, 0, 0, 0).toISOString(), 'thisMonth', '', '', REF)).toBe(false)
  })

  it('"last3Months" goes back 3 calendar months from the reference day', () => {
    const within = new Date(2026, 3, 1, 0, 0, 0).toISOString() // April 1
    const outside = new Date(2026, 2, 14, 0, 0, 0).toISOString() // before March 15
    expect(matchesDateRange(within, 'last3Months', '', '', REF)).toBe(true)
    expect(matchesDateRange(outside, 'last3Months', '', '', REF)).toBe(false)
  })

  it('"thisYear" matches only the reference local year', () => {
    expect(matchesDateRange(new Date(2026, 0, 1, 0, 0, 0).toISOString(), 'thisYear', '', '', REF)).toBe(true)
    expect(matchesDateRange(new Date(2025, 11, 31, 23, 0, 0).toISOString(), 'thisYear', '', '', REF)).toBe(false)
  })

  it('"custom" is inclusive of both From and To local days', () => {
    const from = '2026-06-10'
    const to = '2026-06-12'
    expect(matchesDateRange(new Date(2026, 5, 10, 0, 0, 1).toISOString(), 'custom', from, to, REF)).toBe(true)
    expect(matchesDateRange(new Date(2026, 5, 12, 23, 59, 0).toISOString(), 'custom', from, to, REF)).toBe(true)
    expect(matchesDateRange(new Date(2026, 5, 9, 23, 59, 59).toISOString(), 'custom', from, to, REF)).toBe(false)
    expect(matchesDateRange(new Date(2026, 5, 13, 0, 0, 1).toISOString(), 'custom', from, to, REF)).toBe(false)
  })
})

describe('filterTrades', () => {
  const trades = [
    makeTrade({ id: '1', symbol: 'NVDA', direction: 'long', exitPrice: 120 }), // win
    makeTrade({ id: '2', symbol: 'AAPL', direction: 'short', exitPrice: 120 }), // long entry price 100 exit 120 short => loss
    makeTrade({ id: '3', symbol: 'nvda', direction: 'long', exitPrice: null, pnl: null }), // open, lowercase ticker
    makeTrade({ id: '4', symbol: 'TSLA', direction: 'long', exitPrice: 100 }), // breakeven, pnl 0
  ]

  it('search matches symbol case-insensitively as substring', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, search: 'nvda' }
    const result = filterTrades(trades, filters)
    expect(result.map((t) => t.id).sort()).toEqual(['1', '3'])
  })

  it('type "winning" excludes open and breakeven trades', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, type: 'winning' }
    expect(filterTrades(trades, filters).map((t) => t.id)).toEqual(['1'])
  })

  it('type "losing" excludes open and breakeven trades', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, type: 'losing' }
    expect(filterTrades(trades, filters).map((t) => t.id)).toEqual(['2'])
  })

  it('type "open" only matches trades with pnl === null', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, type: 'open' }
    expect(filterTrades(trades, filters).map((t) => t.id)).toEqual(['3'])
  })

  it('breakeven trade (pnl === 0) is excluded from winning/losing but included in "all"', () => {
    const all = filterTrades(trades, DEFAULT_TRADE_FILTERS)
    expect(all.map((t) => t.id)).toContain('4')
    expect(filterTrades(trades, { ...DEFAULT_TRADE_FILTERS, type: 'winning' }).map((t) => t.id)).not.toContain('4')
    expect(filterTrades(trades, { ...DEFAULT_TRADE_FILTERS, type: 'losing' }).map((t) => t.id)).not.toContain('4')
  })

  it('direction filter narrows to long/short', () => {
    expect(filterTrades(trades, { ...DEFAULT_TRADE_FILTERS, direction: 'short' }).map((t) => t.id)).toEqual(['2'])
  })

  it('combines filters with AND logic', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, search: 'nvda', direction: 'long', type: 'open' }
    expect(filterTrades(trades, filters).map((t) => t.id)).toEqual(['3'])
  })

  it('search matches notes case-insensitively when the term is absent from symbol', () => {
    const withNotes = [
      ...trades,
      makeTrade({ id: '5', symbol: 'MSFT', notes: 'Earnings gap up, waited for pullback' }),
    ]
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, search: 'EARNINGS' }
    expect(filterTrades(withNotes, filters).map((t) => t.id)).toEqual(['5'])
  })

  it('search matching neither symbol nor notes returns nothing', () => {
    const withNotes = [
      ...trades,
      makeTrade({ id: '5', symbol: 'MSFT', notes: 'Earnings gap up' }),
    ]
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, search: 'nonexistentterm' }
    expect(filterTrades(withNotes, filters)).toEqual([])
  })

  it('trades without notes never throw and are simply excluded from notes-only matches', () => {
    const filters: TradeFiltersState = { ...DEFAULT_TRADE_FILTERS, search: 'pullback' }
    expect(() => filterTrades(trades, filters)).not.toThrow()
    expect(filterTrades(trades, filters)).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('is false for the default state', () => {
    expect(hasActiveFilters(DEFAULT_TRADE_FILTERS)).toBe(false)
  })

  it('is true when any single filter differs from default', () => {
    expect(hasActiveFilters({ ...DEFAULT_TRADE_FILTERS, search: 'a' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_TRADE_FILTERS, type: 'open' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_TRADE_FILTERS, direction: 'long' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_TRADE_FILTERS, datePreset: 'today' })).toBe(true)
  })
})
