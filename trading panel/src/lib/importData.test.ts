import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importTrades, parseTradesJson } from './importData'
import type { Trade } from '../types/trade'

vi.mock('./tradesApi', () => ({
  createTrade: vi.fn(async (_workspaceId: string, _accountId: string, trade: Trade) => trade),
}))

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
  notes: 'note',
  setup: 'Breakout',
}

describe('parseTradesJson', () => {
  it('מפענח מערך JSON תקין', () => {
    const parsed = parseTradesJson(JSON.stringify([trade]))
    expect(parsed).toEqual([trade])
  })

  it('מפענח מערך ריק', () => {
    expect(parseTradesJson('[]')).toEqual([])
  })

  it('זורק שגיאה על JSON לא תקין', () => {
    expect(() => parseTradesJson('{not json')).toThrow('not valid JSON')
  })

  it('זורק שגיאה כשהתוכן אינו מערך', () => {
    expect(() => parseTradesJson(JSON.stringify({ foo: 'bar' }))).toThrow('Expected a JSON array')
  })

  it('זורק שגיאה כששדה חובה חסר', () => {
    const { symbol: _symbol, ...broken } = trade
    expect(() => parseTradesJson(JSON.stringify([broken]))).toThrow(/index 0/)
  })

  it('זורק שגיאה על direction לא תקין', () => {
    expect(() => parseTradesJson(JSON.stringify([{ ...trade, direction: 'sideways' }]))).toThrow('invalid direction')
  })

  it('זורק שגיאה על currency לא נתמך', () => {
    expect(() => parseTradesJson(JSON.stringify([{ ...trade, currency: 'XYZ' }]))).toThrow('currency')
  })

  it('מקבל exitAt/pnl/setup null או undefined לטרייד פתוח', () => {
    const openTrade = { ...trade, exitAt: null, exitPrice: null, pnl: null, setup: undefined }
    const parsed = parseTradesJson(JSON.stringify([openTrade]))
    expect(parsed[0].pnl).toBeNull()
    expect(parsed[0].setup).toBeUndefined()
  })
})

describe('importTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מייבא טרייד חדש שלא קיים עדיין', async () => {
    const result = await importTrades('ws1', 'acc1', [trade], [])
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.importedTrades).toHaveLength(1)
  })

  it('מדלג על טרייד שכבר קיים לפי המפתח הטבעי (symbol+entryAt+entryPrice+quantity)', async () => {
    const result = await importTrades('ws1', 'acc1', [trade], [trade])
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.importedTrades).toHaveLength(0)
  })

  it('לא מדלג אם רק ה-id שונה - המפתח הטבעי לא כולל id', async () => {
    const existing = { ...trade, id: 'different-id' }
    const result = await importTrades('ws1', 'acc1', [trade], [existing])
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('מייבא טרייד עם symbol שונה גם אם שאר השדות זהים', async () => {
    const existing = { ...trade, symbol: 'MSFT' }
    const result = await importTrades('ws1', 'acc1', [trade], [existing])
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('לעולם לא מחשב מחדש pnl - הערך נכנס verbatim מהקובץ', async () => {
    const result = await importTrades('ws1', 'acc1', [{ ...trade, pnl: 12345 }], [])
    expect(result.importedTrades[0].pnl).toBe(12345)
  })

  it('מקצה id חדש לכל טרייד מיובא ולא משתמש בזה מהקובץ', async () => {
    const { createTrade } = await import('./tradesApi')
    await importTrades('ws1', 'acc1', [trade], [])
    const insertedTrade = vi.mocked(createTrade).mock.calls[0][2]
    expect(insertedTrade.id).not.toBe(trade.id)
  })

  it('מדלג על כפילויות בתוך אותה קריאת ייבוא (שני טריידים זהים באותו קובץ)', async () => {
    const result = await importTrades('ws1', 'acc1', [trade, { ...trade }], [])
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
