import { describe, expect, it } from 'vitest'
import { buildTradesCsv, buildTradesJson } from './exportData'
import type { Trade } from '../types/trade'

const trade: Trade = {
  id: 't1',
  symbol: 'AAPL',
  direction: 'long',
  entryAt: '2026-01-01T10:00:00.000Z',
  entryPrice: 100,
  quantity: 10,
  stopLoss: 95,
  takeProfit: 110,
  exitAt: '2026-01-02T10:00:00.000Z',
  exitPrice: 105,
  pnl: 50,
  currency: 'USD',
  fee: 1,
  notes: 'note, with comma',
  setup: 'Swing',
}

describe('buildTradesJson', () => {
  it('מייצר JSON תקין עם כל הטריידים', () => {
    const json = buildTradesJson([trade])
    expect(JSON.parse(json)).toEqual([trade])
  })

  it('מייצר מערך ריק כשאין טריידים', () => {
    expect(JSON.parse(buildTradesJson([]))).toEqual([])
  })
})

describe('buildTradesCsv', () => {
  it('כולל שורת כותרות ושורת דאטה אחת לכל טרייד', () => {
    const csv = buildTradesCsv([trade])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(
      'id,symbol,direction,entryAt,entryPrice,quantity,stopLoss,takeProfit,exitAt,exitPrice,pnl,currency,fee,setup,notes,chartImageUrl',
    )
  })

  it('עוטף במרכאות ומברח ערכים עם פסיקים', () => {
    const csv = buildTradesCsv([trade])
    expect(csv).toContain('"note, with comma"')
  })

  it('מייצר רק שורת כותרות כשאין טריידים', () => {
    const csv = buildTradesCsv([])
    expect(csv.split('\n')).toHaveLength(1)
  })

  it('משאיר תא ריק לערכים null', () => {
    const openTrade: Trade = { ...trade, exitAt: null, exitPrice: null, pnl: null, setup: undefined }
    const csv = buildTradesCsv([openTrade])
    const dataRow = csv.split('\n')[1]
    expect(dataRow.split(',')).toContain('')
  })
})
