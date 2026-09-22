import { describe, expect, it } from 'vitest'
import { calculateCagr, calculateLiquidationPrice, calculatePnl, calculatePositionSize, calculateScaleIn, calculateScaleOut } from './calculators'

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

describe('calculateScaleIn', () => {
  it('computes the weighted average price and combined quantity', () => {
    // 100 shares @ 10 + 100 shares @ 20 -> avg 15, total 200
    const result = calculateScaleIn({ existingEntryPrice: 10, existingQuantity: 100, addPrice: 20, addQuantity: 100 })
    expect(result.newAveragePrice).toBeCloseTo(15, 5)
    expect(result.newTotalQuantity).toBe(200)
  })

  it('weights toward the larger quantity', () => {
    // 300 shares @ 10 + 100 shares @ 30 -> (3000+3000)/400 = 15
    const result = calculateScaleIn({ existingEntryPrice: 10, existingQuantity: 300, addPrice: 30, addQuantity: 100 })
    expect(result.newAveragePrice).toBeCloseTo(15, 5)
    expect(result.newTotalQuantity).toBe(400)
  })

  it('returns zeros for invalid input (non-positive quantities/prices)', () => {
    expect(calculateScaleIn({ existingEntryPrice: 10, existingQuantity: 0, addPrice: 20, addQuantity: 100 })).toEqual({
      newAveragePrice: 0,
      newTotalQuantity: 0,
    })
    expect(calculateScaleIn({ existingEntryPrice: 10, existingQuantity: 100, addPrice: -5, addQuantity: 100 })).toEqual({
      newAveragePrice: 0,
      newTotalQuantity: 0,
    })
  })
})

describe('calculateScaleOut', () => {
  it('computes realized P&L for a long partial exit', () => {
    const result = calculateScaleOut({ entryPrice: 100, direction: 'long', totalQuantity: 100, sellPrice: 110, sellQuantity: 40 })
    expect(result.realizedPnl).toBeCloseTo(400, 5)
    expect(result.realizedPnlPercent).toBeCloseTo(10, 5)
    expect(result.remainingQuantity).toBe(60)
  })

  it('computes realized P&L for a short partial exit (price drop = profit)', () => {
    const result = calculateScaleOut({ entryPrice: 100, direction: 'short', totalQuantity: 100, sellPrice: 90, sellQuantity: 40 })
    expect(result.realizedPnl).toBeCloseTo(400, 5)
    expect(result.realizedPnlPercent).toBeCloseTo(10, 5)
    expect(result.remainingQuantity).toBe(60)
  })

  it('returns zeros for invalid input (selling more than the total position, non-positive values)', () => {
    expect(
      calculateScaleOut({ entryPrice: 100, direction: 'long', totalQuantity: 50, sellPrice: 110, sellQuantity: 60 }),
    ).toEqual({ realizedPnl: 0, realizedPnlPercent: 0, remainingQuantity: 0 })
    expect(
      calculateScaleOut({ entryPrice: 0, direction: 'long', totalQuantity: 50, sellPrice: 110, sellQuantity: 10 }),
    ).toEqual({ realizedPnl: 0, realizedPnlPercent: 0, remainingQuantity: 0 })
  })
})

describe('calculateCagr', () => {
  it('computes the annual growth rate between two values over years', () => {
    // 100 -> 200 over 1 year = 100% CAGR
    expect(calculateCagr({ startValue: 100, endValue: 200, years: 1 }).cagrPercent).toBeCloseTo(100, 5)
  })

  it('computes CAGR over multiple years (well-known: doubling over ~7.2y ~= 10%)', () => {
    const result = calculateCagr({ startValue: 100, endValue: 200, years: 7.2 })
    expect(result.cagrPercent).toBeCloseTo(10, 0)
  })

  it('handles a decline (negative CAGR)', () => {
    const result = calculateCagr({ startValue: 200, endValue: 100, years: 1 })
    expect(result.cagrPercent).toBeCloseTo(-50, 5)
  })

  it('returns zero for invalid input (non-positive start/years, negative end)', () => {
    expect(calculateCagr({ startValue: 0, endValue: 200, years: 1 })).toEqual({ cagrPercent: 0 })
    expect(calculateCagr({ startValue: 100, endValue: 200, years: 0 })).toEqual({ cagrPercent: 0 })
    expect(calculateCagr({ startValue: 100, endValue: -5, years: 1 })).toEqual({ cagrPercent: 0 })
  })
})

describe('calculateLiquidationPrice', () => {
  it('computes the liquidation price for a long position with no maintenance margin', () => {
    // 10x long from 100 -> liquidation at 100*(1-0.1) = 90
    const result = calculateLiquidationPrice({ entryPrice: 100, leverage: 10, direction: 'long' })
    expect(result.liquidationPrice).toBeCloseTo(90, 5)
    expect(result.distancePercent).toBeCloseTo(10, 5)
  })

  it('computes the liquidation price for a short position with no maintenance margin', () => {
    // 10x short from 100 -> liquidation at 100*(1+0.1) = 110
    const result = calculateLiquidationPrice({ entryPrice: 100, leverage: 10, direction: 'short' })
    expect(result.liquidationPrice).toBeCloseTo(110, 5)
    expect(result.distancePercent).toBeCloseTo(10, 5)
  })

  it('applies a maintenance margin buffer that brings liquidation closer to entry', () => {
    // 10x long, 0.5% maintenance margin -> 100*(1-0.1+0.005) = 90.5
    const result = calculateLiquidationPrice({ entryPrice: 100, leverage: 10, direction: 'long', maintenanceMarginPercent: 0.5 })
    expect(result.liquidationPrice).toBeCloseTo(90.5, 5)
  })

  it('returns zeros for invalid input (non-positive entry/leverage)', () => {
    expect(calculateLiquidationPrice({ entryPrice: 0, leverage: 10, direction: 'long' })).toEqual({
      liquidationPrice: 0,
      distancePercent: 0,
    })
    expect(calculateLiquidationPrice({ entryPrice: 100, leverage: 0, direction: 'long' })).toEqual({
      liquidationPrice: 0,
      distancePercent: 0,
    })
  })
})
