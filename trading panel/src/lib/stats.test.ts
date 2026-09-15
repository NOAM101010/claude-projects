import { describe, expect, it } from 'vitest'
import {
  avgHoldDays,
  avgRiskReward,
  avgWinLoss,
  bestTrade,
  computePnl,
  dailyPnl,
  dayActivityLevel,
  drawdownCurve,
  equityCurve,
  expectancy,
  maxDrawdown,
  profitFactor,
  statsByDayOfWeek,
  statsBySetup,
  statsBySymbol,
  streaks,
  tradeOfTheMonth,
  tradesCountByMonth,
  totalPnl,
  weeklyRecap,
  winRate,
  worstTrade,
} from './stats'
import type { Trade } from '../types/trade'

function makeTrade(overrides: Partial<Trade>): Trade {
  const base: Trade = {
    id: overrides.id ?? crypto.randomUUID(),
    symbol: 'AAPL',
    direction: 'long',
    entryAt: '2026-01-01T10:00:00.000Z',
    entryPrice: 100,
    quantity: 10,
    stopLoss: null,
    takeProfit: null,
    exitAt: '2026-01-02T10:00:00.000Z',
    exitPrice: 110,
    pnl: null,
    currency: 'USD',
    fee: 0,
    notes: '',
    ...overrides,
  }
  base.pnl = computePnl({
    direction: base.direction,
    entryPrice: base.entryPrice,
    exitPrice: base.exitPrice,
    quantity: base.quantity,
    fee: base.fee,
  })
  return base
}

describe('computePnl', () => {
  it('calculates long P&L correctly', () => {
    expect(computePnl({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 10, fee: 0 })).toBe(100)
  })

  it('calculates short P&L correctly', () => {
    expect(computePnl({ direction: 'short', entryPrice: 100, exitPrice: 90, quantity: 10, fee: 0 })).toBe(100)
  })

  it('subtracts fee from the result', () => {
    expect(computePnl({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 10, fee: 5 })).toBe(95)
  })

  it('returns null for an open position (no exit price)', () => {
    expect(computePnl({ direction: 'long', entryPrice: 100, exitPrice: null, quantity: 10, fee: 0 })).toBeNull()
  })
})

describe('winRate', () => {
  it('returns 0 when there are no closed trades', () => {
    expect(winRate([makeTrade({ exitAt: null, exitPrice: null })])).toBe(0)
  })

  it('computes the percentage of winning closed trades', () => {
    const trades = [
      makeTrade({ entryPrice: 100, exitPrice: 110 }), // win
      makeTrade({ entryPrice: 100, exitPrice: 90 }), // loss
      makeTrade({ entryPrice: 100, exitPrice: 105 }), // win
      makeTrade({ exitAt: null, exitPrice: null }), // open, excluded
    ]
    expect(winRate(trades)).toBeCloseTo(66.666, 2)
  })
})

describe('totalPnl / equityCurve', () => {
  it('accumulates P&L chronologically by exit date', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-05T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ id: 'b', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 95 }), // -50
    ]
    expect(totalPnl(trades)).toBe(50)
    const curve = equityCurve(trades)
    expect(curve.map((p) => p.cumulative)).toEqual([-50, 50])
  })
})

describe('avgWinLoss', () => {
  it('returns average win (positive) and average loss (negative)', () => {
    const trades = [
      makeTrade({ entryPrice: 100, exitPrice: 120 }), // +200
      makeTrade({ entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ entryPrice: 100, exitPrice: 90 }), // -100
    ]
    const { avgWin, avgLoss } = avgWinLoss(trades)
    expect(avgWin).toBe(150)
    expect(avgLoss).toBe(-100)
  })
})

describe('avgRiskReward', () => {
  it('averages reward/risk ratios for trades with both stop and target set', () => {
    const trades = [
      makeTrade({ entryPrice: 100, stopLoss: 90, takeProfit: 120 }), // risk 10, reward 20 -> 2
      makeTrade({ entryPrice: 100, stopLoss: 95, takeProfit: 110 }), // risk 5, reward 10 -> 2
      makeTrade({ entryPrice: 100, stopLoss: null, takeProfit: null }), // ignored
    ]
    expect(avgRiskReward(trades)).toBe(2)
  })

  it('returns null when no trade has both fields', () => {
    expect(avgRiskReward([makeTrade({ stopLoss: null, takeProfit: null })])).toBeNull()
  })
})

describe('tradesCountByMonth', () => {
  it('groups by entry month sorted chronologically', () => {
    const trades = [
      makeTrade({ entryAt: '2026-02-10T00:00:00.000Z' }),
      makeTrade({ entryAt: '2026-01-05T00:00:00.000Z' }),
      makeTrade({ entryAt: '2026-01-20T00:00:00.000Z' }),
    ]
    expect(tradesCountByMonth(trades)).toEqual([
      { period: '2026-01', count: 2 },
      { period: '2026-02', count: 1 },
    ])
  })
})

describe('bestTrade / worstTrade', () => {
  it('finds the highest and lowest P&L closed trades', () => {
    const trades = [
      makeTrade({ id: 'a', entryPrice: 100, exitPrice: 130 }), // +300
      makeTrade({ id: 'b', entryPrice: 100, exitPrice: 80 }), // -200
      makeTrade({ id: 'c', entryPrice: 100, exitPrice: 105 }), // +50
    ]
    expect(bestTrade(trades)?.id).toBe('a')
    expect(worstTrade(trades)?.id).toBe('b')
  })
})

describe('weeklyRecap', () => {
  // referenceDate 2026-03-15 -> current window: 2026-03-08..2026-03-15 (day -7..0);
  // previous window: 2026-03-01..2026-03-08 (day -14..-7).
  const referenceDate = new Date('2026-03-15T12:00:00.000Z')

  it('finds the best and worst trade in the current 7-day window', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-03-10T00:00:00.000Z', entryPrice: 100, exitPrice: 130 }), // +300, best
      makeTrade({ id: 'b', exitAt: '2026-03-12T00:00:00.000Z', entryPrice: 100, exitPrice: 80 }), // -200, worst
      makeTrade({ id: 'c', exitAt: '2026-03-14T00:00:00.000Z', entryPrice: 100, exitPrice: 105 }), // +50
      makeTrade({ id: 'd', exitAt: '2026-02-01T00:00:00.000Z', entryPrice: 100, exitPrice: 500 }), // outside window
    ]
    const recap = weeklyRecap(trades, referenceDate)
    expect(recap.bestTrade).toEqual({ symbol: 'AAPL', pnl: 300 })
    expect(recap.worstTrade).toEqual({ symbol: 'AAPL', pnl: -200 })
    expect(recap.avgPnlPerTrade).toBe(50) // (300 - 200 + 50) / 3
  })

  it('shows the same trade as both best and worst when only one trade is in the window', () => {
    const trades = [makeTrade({ id: 'a', exitAt: '2026-03-12T00:00:00.000Z', entryPrice: 100, exitPrice: 130 })] // +300
    const recap = weeklyRecap(trades, referenceDate)
    expect(recap.bestTrade).toEqual({ symbol: 'AAPL', pnl: 300 })
    expect(recap.worstTrade).toEqual({ symbol: 'AAPL', pnl: 300 })
    expect(recap.avgPnlPerTrade).toBe(300)
  })

  it('returns 0 avgPnlPerTrade when there are no closed trades in the window', () => {
    const recap = weeklyRecap([], referenceDate)
    expect(recap.tradeCount).toBe(0)
    expect(recap.avgPnlPerTrade).toBe(0)
  })

  it('computes previousWeekNetPnl from the prior non-overlapping 7-day window', () => {
    const trades = [
      makeTrade({ id: 'current', exitAt: '2026-03-10T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // +100, current window
      makeTrade({ id: 'prev1', exitAt: '2026-03-03T00:00:00.000Z', entryPrice: 100, exitPrice: 120 }), // +200, previous window
      makeTrade({ id: 'prev2', exitAt: '2026-03-05T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // -100, previous window
      makeTrade({ id: 'tooOld', exitAt: '2026-02-01T00:00:00.000Z', entryPrice: 100, exitPrice: 500 }), // before previous window
    ]
    const recap = weeklyRecap(trades, referenceDate)
    expect(recap.netPnl).toBe(100)
    expect(recap.previousWeekNetPnl).toBe(100) // +200 - 100
  })

  it('returns null previousWeekNetPnl instead of a misleading comparison when there were no prior trades', () => {
    const trades = [makeTrade({ id: 'current', exitAt: '2026-03-10T00:00:00.000Z', entryPrice: 100, exitPrice: 110 })]
    const recap = weeklyRecap(trades, referenceDate)
    expect(recap.previousWeekNetPnl).toBeNull()
  })
})

describe('tradeOfTheMonth', () => {
  const referenceDate = new Date('2026-03-15T00:00:00.000Z')

  it('returns null when there are no closed trades this calendar month', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-02-20T00:00:00.000Z', entryPrice: 100, exitPrice: 130 }),
      makeTrade({ id: 'b', exitAt: null, exitPrice: null }),
    ]
    expect(tradeOfTheMonth(trades, referenceDate)).toBeNull()
  })

  it('picks the highest-P&L closed trade whose exitAt falls in the given month, ignoring other months', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-03-02T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // +100, this month
      makeTrade({ id: 'b', exitAt: '2026-03-20T00:00:00.000Z', entryPrice: 100, exitPrice: 150 }), // +500, this month, best
      makeTrade({ id: 'c', exitAt: '2026-04-01T00:00:00.000Z', entryPrice: 100, exitPrice: 900 }), // huge, but next month
      makeTrade({ id: 'd', exitAt: '2026-03-10T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // loss, this month
    ]
    const result = tradeOfTheMonth(trades, referenceDate)
    expect(result?.trade.id).toBe('b')
    expect(result?.closedCountInMonth).toBe(3)
  })
})

describe('profitFactor', () => {
  it('divides gross wins by absolute gross losses', () => {
    const trades = [
      makeTrade({ entryPrice: 100, exitPrice: 120 }), // +200
      makeTrade({ entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ entryPrice: 100, exitPrice: 90 }), // -100
    ]
    expect(profitFactor(trades)).toBe(3)
  })

  it('returns null when there are no losing trades at all', () => {
    const trades = [makeTrade({ entryPrice: 100, exitPrice: 110 }), makeTrade({ entryPrice: 100, exitPrice: 120 })]
    expect(profitFactor(trades)).toBeNull()
  })
})

describe('expectancy', () => {
  it('returns 0 when there are no closed trades', () => {
    expect(expectancy([makeTrade({ exitAt: null, exitPrice: null })])).toBe(0)
  })

  it('computes winRate * avgWin - (1 - winRate) * |avgLoss|', () => {
    const trades = [
      makeTrade({ entryPrice: 100, exitPrice: 120 }), // +200 win
      makeTrade({ entryPrice: 100, exitPrice: 90 }), // -100 loss
    ]
    // winRate 50%, avgWin 200, avgLoss -100 -> 0.5*200 + 0.5*(-100) = 50
    expect(expectancy(trades)).toBe(50)
  })
})

describe('avgHoldDays', () => {
  it('averages holding period in days separately for winners and losers', () => {
    const trades = [
      makeTrade({ entryAt: '2026-01-01T00:00:00.000Z', exitAt: '2026-01-04T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // win, 3 days
      makeTrade({ entryAt: '2026-01-01T00:00:00.000Z', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // loss, 1 day
    ]
    expect(avgHoldDays(trades)).toEqual({ winners: 3, losers: 1 })
  })
})

describe('streaks', () => {
  it('tracks the current streak and the longest win/loss streaks chronologically', () => {
    const trades = [
      makeTrade({ exitAt: '2026-01-01T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // win
      makeTrade({ exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // win
      makeTrade({ exitAt: '2026-01-03T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // loss
      makeTrade({ exitAt: '2026-01-04T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // loss
      makeTrade({ exitAt: '2026-01-05T00:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // loss
    ]
    const result = streaks(trades)
    expect(result.current).toEqual({ type: 'loss', count: 3 })
    expect(result.longestWin).toBe(2)
    expect(result.longestLoss).toBe(3)
  })

  it('returns a "none" current streak when there are no closed trades', () => {
    expect(streaks([makeTrade({ exitAt: null, exitPrice: null })]).current).toEqual({ type: 'none', count: 0 })
  })
})

describe('maxDrawdown', () => {
  it('finds the largest peak-to-trough drop in the equity curve', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T00:00:00.000Z', entryPrice: 100, exitPrice: 200 }), // +1000, cumulative 1000 (peak)
      makeTrade({ id: 'b', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 70 }), // -300, cumulative 700 (dd 300)
      makeTrade({ id: 'c', exitAt: '2026-01-03T00:00:00.000Z', entryPrice: 100, exitPrice: 95 }), // -50, cumulative 650 (dd 350, max)
      makeTrade({ id: 'd', exitAt: '2026-01-04T00:00:00.000Z', entryPrice: 100, exitPrice: 150 }), // +500, cumulative 1150 (new peak)
    ]
    const dd = maxDrawdown(trades)
    expect(dd.amount).toBe(350)
    expect(dd.percent).toBeCloseTo(35, 5)
  })

  it('returns zero drawdown when there are no closed trades', () => {
    expect(maxDrawdown([makeTrade({ exitAt: null, exitPrice: null })])).toEqual({ amount: 0, percent: 0 })
  })
})

describe('drawdownCurve', () => {
  it('stays at zero drawdown when the equity curve only makes new highs', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T00:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ id: 'b', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 120 }), // +200
    ]
    const curve = drawdownCurve(trades)
    expect(curve.every((p) => p.drawdownAmount === 0 && p.drawdownPercent === 0)).toBe(true)
  })

  it('digs down from the peak and recovers back to zero', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T00:00:00.000Z', entryPrice: 100, exitPrice: 200 }), // +1000, peak
      makeTrade({ id: 'b', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 70 }), // -300, cumulative 700
      makeTrade({ id: 'c', exitAt: '2026-01-03T00:00:00.000Z', entryPrice: 100, exitPrice: 150 }), // +500, cumulative 1200, new peak
    ]
    const curve = drawdownCurve(trades)
    expect(curve[0]).toEqual({ date: trades[0].exitAt, drawdownAmount: 0, drawdownPercent: 0 })
    expect(curve[1].drawdownAmount).toBe(300)
    expect(curve[1].drawdownPercent).toBeCloseTo(30, 5)
    expect(curve[2]).toEqual({ date: trades[2].exitAt, drawdownAmount: 0, drawdownPercent: 0 })
  })

  it('reaches the same maximum as maxDrawdown() on the same trades (cross-check, never drift apart)', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T00:00:00.000Z', entryPrice: 100, exitPrice: 200 }),
      makeTrade({ id: 'b', exitAt: '2026-01-02T00:00:00.000Z', entryPrice: 100, exitPrice: 70 }),
      makeTrade({ id: 'c', exitAt: '2026-01-03T00:00:00.000Z', entryPrice: 100, exitPrice: 95 }),
      makeTrade({ id: 'd', exitAt: '2026-01-04T00:00:00.000Z', entryPrice: 100, exitPrice: 150 }),
    ]
    const curveMax = Math.max(...drawdownCurve(trades).map((p) => p.drawdownAmount))
    expect(curveMax).toBe(maxDrawdown(trades).amount)
  })
})

describe('dailyPnl', () => {
  it('groups closed trades by exit date (UTC)', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T10:00:00.000Z', entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ id: 'b', exitAt: '2026-01-01T20:00:00.000Z', entryPrice: 100, exitPrice: 90 }), // -100
      makeTrade({ id: 'c', exitAt: '2026-01-02T10:00:00.000Z', entryPrice: 100, exitPrice: 120 }), // +200
    ]
    expect(dailyPnl(trades)).toEqual([
      { date: '2026-01-01', pnl: 0, trades: 2 },
      { date: '2026-01-02', pnl: 200, trades: 1 },
    ])
  })
})

describe('dayActivityLevel', () => {
  it('reads "normal" for every active day when trade counts are uniform', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T10:00:00.000Z' }),
      makeTrade({ id: 'b', exitAt: '2026-01-02T10:00:00.000Z' }),
      makeTrade({ id: 'c', exitAt: '2026-01-03T10:00:00.000Z' }),
      makeTrade({ id: 'd', exitAt: '2026-01-04T10:00:00.000Z' }),
    ]
    const levels = dayActivityLevel(trades)
    expect(Array.from(levels.values())).toEqual(['normal', 'normal', 'normal', 'normal'])
  })

  it('flags a day with a wildly higher trade count than usual as "high"', () => {
    const trades = [
      makeTrade({ id: 'a', exitAt: '2026-01-01T10:00:00.000Z' }),
      makeTrade({ id: 'b', exitAt: '2026-01-02T10:00:00.000Z' }),
      makeTrade({ id: 'c', exitAt: '2026-01-03T10:00:00.000Z' }),
      // 2026-01-04: 8 trades in one day - way above the account's usual 1/day
      ...Array.from({ length: 8 }, (_, i) => makeTrade({ id: `d${i}`, exitAt: '2026-01-04T10:00:00.000Z' })),
    ]
    const levels = dayActivityLevel(trades)
    expect(levels.get('2026-01-04')).toBe('high')
    expect(levels.get('2026-01-01')).not.toBe('high')
  })

  it('degrades gracefully with too little data (0-1 active days) - no NaN/crash', () => {
    expect(Array.from(dayActivityLevel([]).values())).toEqual([])

    const oneDay = [makeTrade({ id: 'a', exitAt: '2026-01-01T10:00:00.000Z' })]
    const levels = dayActivityLevel(oneDay)
    expect(levels.get('2026-01-01')).toBe('normal')
  })
})

describe('statsBySymbol / statsBySetup', () => {
  it('groups closed trades by symbol and sorts by cumulative P&L descending', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ symbol: 'AAPL', entryPrice: 100, exitPrice: 90 }), // -100
      makeTrade({ symbol: 'TSLA', entryPrice: 100, exitPrice: 130 }), // +300
    ]
    expect(statsBySymbol(trades)).toEqual([
      { key: 'TSLA', trades: 1, winRate: 100, pnl: 300 },
      { key: 'AAPL', trades: 2, winRate: 50, pnl: 0 },
    ])
  })

  it('groups by setup and falls back to "No setup" when unset', () => {
    const trades = [
      makeTrade({ setup: 'Swing', entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ setup: undefined, entryPrice: 100, exitPrice: 120 }), // +200
    ]
    const result = statsBySetup(trades)
    expect(result).toEqual([
      { key: 'No setup', trades: 1, winRate: 100, pnl: 200 },
      { key: 'Swing', trades: 1, winRate: 100, pnl: 100 },
    ])
  })
})

describe('statsByDayOfWeek', () => {
  const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  it('always returns the 5 weekdays in calendar order, even with no trades on most of them', () => {
    const trades = [makeTrade({ exitAt: '2026-01-01T10:00:00.000Z', entryPrice: 100, exitPrice: 110 })]
    const result = statsByDayOfWeek(trades)
    expect(result.map((r) => r.key)).toEqual(WEEKDAY_NAMES)
    expect(result.every((r) => r.trades === 0 || r.trades === 1)).toBe(true)
    expect(result.reduce((sum, r) => sum + r.trades, 0)).toBe(1)
  })

  it('groups closed trades by local exit day of week', () => {
    const exitAt = '2026-01-01T10:00:00.000Z'
    const localDay = DAY_NAMES[new Date(exitAt).getDay()]
    const trades = [
      makeTrade({ id: 'a', exitAt, entryPrice: 100, exitPrice: 110 }), // +100
      makeTrade({ id: 'b', exitAt, entryPrice: 100, exitPrice: 90 }), // -100
    ]
    const bucket = statsByDayOfWeek(trades).find((r) => r.key === localDay)
    expect(bucket).toEqual({ key: localDay, trades: 2, winRate: 50, pnl: 0 })
  })
})
