import { describe, expect, it } from 'vitest'
import { computeLivePnl, liveRMultiple, slTpProgress } from './livePnl'
import type { Trade } from '../types/trade'

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    symbol: 'AAPL',
    direction: 'long',
    entryAt: '2026-01-01T00:00:00.000Z',
    entryPrice: 100,
    quantity: 10,
    stopLoss: null,
    takeProfit: null,
    exitAt: null,
    exitPrice: null,
    pnl: null,
    currency: 'USD',
    fee: null,
    notes: '',
    ...overrides,
  }
}

describe('computeLivePnl', () => {
  it('mirrors computePnl for a long trade in profit', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, quantity: 10, fee: 5 })
    // same formula as computePnl: (currentPrice - entry) * qty - fee
    expect(computeLivePnl(trade, 110)).toEqual({ pnl: (110 - 100) * 10 - 5, pnlPercent: (95 / 1000) * 100 })
  })

  it('mirrors computePnl for a short trade in profit', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, quantity: 10, fee: 0 })
    // short: (entry - currentPrice) * qty - fee
    expect(computeLivePnl(trade, 90).pnl).toBe((100 - 90) * 10)
  })

  it('a long trade below entry price is a loss', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, quantity: 10, fee: 0 })
    const result = computeLivePnl(trade, 90)
    expect(result.pnl).toBeLessThan(0)
    expect(result.pnlPercent).toBeLessThan(0)
  })

  it('returns null pnl/pnlPercent when there is no current price yet', () => {
    const trade = makeTrade()
    expect(computeLivePnl(trade, null)).toEqual({ pnl: null, pnlPercent: null })
  })

  it('returns null pnlPercent (not NaN/Infinity) when entry price is 0', () => {
    const trade = makeTrade({ entryPrice: 0, quantity: 10 })
    const result = computeLivePnl(trade, 5)
    expect(result.pnl).not.toBeNull()
    expect(result.pnlPercent).toBeNull()
  })

  it('subtracts the fee from the raw P&L exactly once', () => {
    const noFee = computeLivePnl(makeTrade({ fee: null }), 110)
    const withFee = computeLivePnl(makeTrade({ fee: 7 }), 110)
    expect((noFee.pnl ?? 0) - (withFee.pnl ?? 0)).toBe(7)
  })
})

describe('slTpProgress', () => {
  it('long: price halfway between entry and stop loss is 50% toward stop', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, takeProfit: null })
    expect(slTpProgress(trade, 95).toStopPercent).toBe(50)
  })

  it('long: price halfway between entry and take profit is 50% toward target', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: null, takeProfit: 110 })
    expect(slTpProgress(trade, 105).toTargetPercent).toBe(50)
  })

  it('long: price beyond the stop loss clamps to 100, not over', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, takeProfit: null })
    expect(slTpProgress(trade, 80).toStopPercent).toBe(100)
  })

  it('long: price beyond the take profit clamps to 100, not over', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: null, takeProfit: 110 })
    expect(slTpProgress(trade, 120).toTargetPercent).toBe(100)
  })

  it('long: price moving away from stop (in profit direction) clamps to 0, not negative', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, takeProfit: null })
    expect(slTpProgress(trade, 105).toStopPercent).toBe(0)
  })

  it('long: price moving away from target (in loss direction) clamps to 0, not negative', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: null, takeProfit: 110 })
    expect(slTpProgress(trade, 95).toTargetPercent).toBe(0)
  })

  it('short: price halfway between entry and stop loss (above entry) is 50% toward stop', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: 110, takeProfit: null })
    expect(slTpProgress(trade, 105).toStopPercent).toBe(50)
  })

  it('short: price halfway between entry and take profit (below entry) is 50% toward target', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: null, takeProfit: 90 })
    expect(slTpProgress(trade, 95).toTargetPercent).toBe(50)
  })

  it('short: price beyond the stop loss clamps to 100', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: 110, takeProfit: null })
    expect(slTpProgress(trade, 120).toStopPercent).toBe(100)
  })

  it('short: price beyond the take profit clamps to 100', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: null, takeProfit: 90 })
    expect(slTpProgress(trade, 80).toTargetPercent).toBe(100)
  })

  it('returns null for the side that has no SL/TP set, without touching the other side', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, takeProfit: null })
    const result = slTpProgress(trade, 95)
    expect(result.toStopPercent).toBe(50)
    expect(result.toTargetPercent).toBeNull()
  })

  it('returns nulls for both sides when there is no current price yet', () => {
    const trade = makeTrade({ stopLoss: 90, takeProfit: 110 })
    expect(slTpProgress(trade, null)).toEqual({ toStopPercent: null, toTargetPercent: null })
  })

  it('treats a stop loss defined on the wrong side of entry as degenerate (null, not a broken bar)', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 110, takeProfit: null })
    expect(slTpProgress(trade, 105).toStopPercent).toBeNull()
  })
})

describe('liveRMultiple', () => {
  it('long: up exactly 1R when unrealized profit equals the initial risk', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, quantity: 10, fee: 0 })
    // risk = (100-90)*10 = 100; pnl at 110 = (110-100)*10 = 100 -> 1R
    expect(liveRMultiple(trade, 110)).toBe(1)
  })

  it('long: down -0.5R when losing half the initial risk', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 90, quantity: 10, fee: 0 })
    // risk = 100; pnl at 95 = (95-100)*10 = -50 -> -0.5R
    expect(liveRMultiple(trade, 95)).toBe(-0.5)
  })

  it('short: up exactly 1R when unrealized profit equals the initial risk', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: 110, quantity: 10, fee: 0 })
    // risk = (110-100)*10 = 100; pnl at 90 = (100-90)*10 = 100 -> 1R
    expect(liveRMultiple(trade, 90)).toBe(1)
  })

  it('short: down -0.5R when losing half the initial risk', () => {
    const trade = makeTrade({ direction: 'short', entryPrice: 100, stopLoss: 110, quantity: 10, fee: 0 })
    // risk = 100; pnl at 105 = (100-105)*10 = -50 -> -0.5R
    expect(liveRMultiple(trade, 105)).toBe(-0.5)
  })

  it('returns null when there is no stop loss set', () => {
    const trade = makeTrade({ stopLoss: null })
    expect(liveRMultiple(trade, 110)).toBeNull()
  })

  it('returns null instead of Infinity when entry equals stop loss (zero risk)', () => {
    const trade = makeTrade({ direction: 'long', entryPrice: 100, stopLoss: 100, quantity: 10 })
    expect(liveRMultiple(trade, 110)).toBeNull()
  })

  it('returns null when there is no current price yet', () => {
    const trade = makeTrade({ stopLoss: 90 })
    expect(liveRMultiple(trade, null)).toBeNull()
  })
})
