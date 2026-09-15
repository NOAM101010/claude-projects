import { describe, expect, it } from 'vitest'
import { calculatePnl, calculatePositionSize } from './calculators'

describe('calculatePositionSize', () => {
  it('computes shares from a fixed dollar risk amount', () => {
    // risk $500, entry 100, stop 95 -> per-share risk 5 -> 100 shares -> exact $500 risk
    const result = calculatePositionSize({ accountSize: 10000, entryPrice: 100, stopLossPrice: 95, riskAmount: 500 })
    expect(result.shares).toBe(100)
    expect(result.dollarRisk).toBe(500)
    expect(result.percentOfAccountRisked).toBeCloseTo(5, 5)
  })

  it('computes shares from a risk percent of account', () => {
    // 1% of 10000 = $100 risk budget, per-share risk = 2 -> 50 shares
    const result = calculatePositionSize({ accountSize: 10000, entryPrice: 50, stopLossPrice: 48, riskPercent: 1 })
    expect(result.shares).toBe(50)
    expect(result.dollarRisk).toBe(100)
    expect(result.percentOfAccountRisked).toBeCloseTo(1, 5)
  })

  it('floors partial shares rather than rounding up', () => {
    // risk budget 100, per-share risk 3 -> 33.33 -> floors to 33
    const result = calculatePositionSize({ accountSize: 10000, entryPrice: 100, stopLossPrice: 97, riskAmount: 100 })
    expect(result.shares).toBe(33)
    expect(result.dollarRisk).toBeCloseTo(99, 5)
  })

  it('works the same regardless of long/short (uses absolute distance to stop)', () => {
    const short = calculatePositionSize({ accountSize: 10000, entryPrice: 95, stopLossPrice: 100, riskAmount: 500 })
    expect(short.shares).toBe(100)
  })

  it('returns zeros for invalid input (entry equals stop, non-positive account size)', () => {
    expect(calculatePositionSize({ accountSize: 10000, entryPrice: 100, stopLossPrice: 100, riskAmount: 500 })).toEqual({
      shares: 0,
      dollarRisk: 0,
      percentOfAccountRisked: 0,
    })
    expect(calculatePositionSize({ accountSize: 0, entryPrice: 100, stopLossPrice: 95, riskAmount: 500 })).toEqual({
      shares: 0,
      dollarRisk: 0,
      percentOfAccountRisked: 0,
    })
    expect(calculatePositionSize({ accountSize: 10000, entryPrice: 100, stopLossPrice: 95 })).toEqual({
      shares: 0,
      dollarRisk: 0,
      percentOfAccountRisked: 0,
    })
  })
})

describe('calculatePnl', () => {
  it('computes long profit from an absolute target price', () => {
    const result = calculatePnl({ entryPrice: 100, quantity: 10, direction: 'long', targetPrice: 110 })
    expect(result.profitLoss).toBe(100)
    expect(result.profitLossPercent).toBeCloseTo(10, 5)
  })

  it('computes short profit from an absolute target price (price drop = profit)', () => {
    const result = calculatePnl({ entryPrice: 100, quantity: 10, direction: 'short', targetPrice: 90 })
    expect(result.profitLoss).toBe(100)
    expect(result.profitLossPercent).toBeCloseTo(10, 5)
  })

  it('computes long loss from a negative target percent', () => {
    const result = calculatePnl({ entryPrice: 100, quantity: 10, direction: 'long', targetPercent: -5 })
    expect(result.profitLoss).toBeCloseTo(-50, 5)
    expect(result.profitLossPercent).toBeCloseTo(-5, 5)
  })

  it('computes short loss from a positive target percent (price rise hurts a short)', () => {
    const result = calculatePnl({ entryPrice: 100, quantity: 10, direction: 'short', targetPercent: 5 })
    expect(result.profitLoss).toBeCloseTo(-50, 5)
    expect(result.profitLossPercent).toBeCloseTo(-5, 5)
  })

  it('returns zeros for invalid input (no target provided, non-positive entry/quantity)', () => {
    expect(calculatePnl({ entryPrice: 100, quantity: 10, direction: 'long' })).toEqual({
      profitLoss: 0,
      profitLossPercent: 0,
    })
    expect(calculatePnl({ entryPrice: 0, quantity: 10, direction: 'long', targetPrice: 110 })).toEqual({
      profitLoss: 0,
      profitLossPercent: 0,
    })
    expect(calculatePnl({ entryPrice: 100, quantity: 0, direction: 'long', targetPrice: 110 })).toEqual({
      profitLoss: 0,
      profitLossPercent: 0,
    })
  })
})
