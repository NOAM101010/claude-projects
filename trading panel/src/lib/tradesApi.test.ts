import { describe, expect, it } from 'vitest'
import { rowToTrade, tradeInputToRow } from './tradesApi'
import type { TradeRow } from './tradesApi'
import type { Trade } from '../types/trade'

function makeRow(overrides: Partial<TradeRow> = {}): TradeRow {
  return {
    id: 'trade-1',
    workspace_id: 'ws-1',
    account_id: 'acc-1',
    symbol: 'AAPL',
    direction: 'long',
    entry_at: '2026-01-01T10:00:00.000Z',
    entry_price: 100,
    quantity: 10,
    stop_loss: null,
    take_profit: null,
    exit_at: '2026-01-02T10:00:00.000Z',
    exit_price: 110,
    currency: 'USD',
    fee: 2,
    pnl: 98,
    notes: null,
    setup: null,
    chart_image_url: null,
    ...overrides,
  }
}

describe('rowToTrade', () => {
  it('ממפה שורת DB snake_case לטיפוס Trade camelCase', () => {
    const row = makeRow({ notes: 'הערה', setup: 'Swing' })
    const trade = rowToTrade(row)

    expect(trade).toEqual<Trade>({
      id: 'trade-1',
      symbol: 'AAPL',
      direction: 'long',
      entryAt: '2026-01-01T10:00:00.000Z',
      entryPrice: 100,
      quantity: 10,
      stopLoss: null,
      takeProfit: null,
      exitAt: '2026-01-02T10:00:00.000Z',
      exitPrice: 110,
      pnl: 98,
      currency: 'USD',
      fee: 2,
      notes: 'הערה',
      setup: 'Swing',
    })
  })

  it('הופך notes null לרשת ריקה, ו-setup null ל-undefined', () => {
    const trade = rowToTrade(makeRow({ notes: null, setup: null }))
    expect(trade.notes).toBe('')
    expect(trade.setup).toBeUndefined()
  })

  it('ממפה chart_image_url לנתיב, או ל-undefined אם null', () => {
    expect(rowToTrade(makeRow({ chart_image_url: 'acc-1/img.jpg' })).chartImageUrl).toBe('acc-1/img.jpg')
    expect(rowToTrade(makeRow({ chart_image_url: null })).chartImageUrl).toBeUndefined()
  })
})

describe('tradeInputToRow', () => {
  it('ממפה TradeInput ל-payload בשמות עמודות DB', () => {
    const input: Omit<Trade, 'id'> = {
      symbol: 'TSLA',
      direction: 'short',
      entryAt: '2026-02-01T10:00:00.000Z',
      entryPrice: 200,
      quantity: 5,
      stopLoss: 210,
      takeProfit: 180,
      exitAt: null,
      exitPrice: null,
      pnl: null,
      currency: 'USD',
      fee: 1,
      notes: 'פתוח',
      setup: undefined,
      chartImageUrl: undefined,
    }

    expect(tradeInputToRow(input)).toEqual({
      symbol: 'TSLA',
      direction: 'short',
      entry_at: '2026-02-01T10:00:00.000Z',
      entry_price: 200,
      quantity: 5,
      stop_loss: 210,
      take_profit: 180,
      exit_at: null,
      exit_price: null,
      currency: 'USD',
      fee: 1,
      pnl: null,
      notes: 'פתוח',
      setup: null,
      chart_image_url: null,
    })
  })
})
