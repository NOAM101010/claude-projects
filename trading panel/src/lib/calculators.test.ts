import { describe, expect, it } from 'vitest'
import { calculateKelly, calculatePnl, calculatePositionSize, calculateRiskOfRuin } from './calculators'

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

describe('calculateKelly', () => {
  it('computes full and half Kelly for a known case (W=0.5, R=2)', () => {
    // f* = 0.5 - (1-0.5)/2 = 0.5 - 0.25 = 0.25 -> half = 0.125
    const outcome = calculateKelly(0.5, 200, -100, 10)
    expect(outcome.reason).toBeNull()
    expect(outcome.kelly?.fullKelly).toBeCloseTo(0.25, 10)
    expect(outcome.kelly?.halfKelly).toBeCloseTo(0.125, 10)
  })

  it('can return a negative fullKelly for a losing edge (do not bet)', () => {
    // W=0.3, R=1 -> f* = 0.3 - 0.7/1 = -0.4
    const outcome = calculateKelly(0.3, 100, -100, 10)
    expect(outcome.kelly?.fullKelly).toBeCloseTo(-0.4, 10)
  })

  it('returns notEnoughTrades under the minimum closed trade count', () => {
    const outcome = calculateKelly(0.5, 200, -100, 9)
    expect(outcome.kelly).toBeNull()
    expect(outcome.reason).toBe('notEnoughTrades')
  })

  it('returns noLosingTrades when there are zero losing trades (avgLoss = 0)', () => {
    const outcome = calculateKelly(1, 200, 0, 20)
    expect(outcome.kelly).toBeNull()
    expect(outcome.reason).toBe('noLosingTrades')
  })
})

describe('calculateRiskOfRuin', () => {
  it('computes a known Risk of Ruin (W=0.6, L=0.4, 10 risk units)', () => {
    // edge = 0.2, base = 0.8/1.2 = 0.66667, units = 10000/1000 = 10 -> 0.66667^10 ≈ 0.01734
    const ror = calculateRiskOfRuin({ winRate: 0.6, lossRate: 0.4, accountSize: 10000, riskPerTrade: 1000 })
    expect(ror).toBeCloseTo(0.01734, 4)
  })

  it('returns 100% ruin when edge is -1 or below (certain loss every trade)', () => {
    expect(calculateRiskOfRuin({ winRate: 0, lossRate: 1, accountSize: 10000, riskPerTrade: 1000 })).toBe(1)
  })

  it('returns 0% ruin when the win rate is 100% (edge = 1, never loses)', () => {
    expect(calculateRiskOfRuin({ winRate: 1, lossRate: 0, accountSize: 10000, riskPerTrade: 1000 })).toBe(0)
  })

  it('clamps to 100% instead of a number above 1 for a strongly negative edge', () => {
    const ror = calculateRiskOfRuin({ winRate: 0.2, lossRate: 0.8, accountSize: 10000, riskPerTrade: 1000 })
    expect(ror).toBe(1)
  })

  it('returns 100% (cannot compute safely) for invalid account size or risk per trade', () => {
    expect(calculateRiskOfRuin({ winRate: 0.6, lossRate: 0.4, accountSize: 0, riskPerTrade: 1000 })).toBe(1)
    expect(calculateRiskOfRuin({ winRate: 0.6, lossRate: 0.4, accountSize: 10000, riskPerTrade: 0 })).toBe(1)
  })
})
