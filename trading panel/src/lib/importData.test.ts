import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importTrades, parseTradesJson } from './importData'
import { isTradeOpen } from './stats'
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
  pnl: 50, // matches computePnl(long, 100, 105, 10, fee=0) - keep fee at 0 so this fixture stays a valid round-trip after the pnl-recompute fix below
  currency: 'USD',
  fee: 0,
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

  // תרחיש הבאג המקורי (ראה stats.ts isTradeOpen + CLAUDE.md task packet): קובץ מיובא עם
  // exitPrice מלא אבל pnl שנשאר null (שדה חסר/לא ממופה במקור) - לפני התיקון היה נשאר
  // מסונכרן-לא-נכון ומסווג בטעות כ"Live" בכל מקום שבדק pnl===null. עכשיו pnl תמיד מחושב
  // מחדש מ-exitPrice, כך שהטרייד מסווג נכון כסגור גם אם הקובץ המקורי היה חסר/שגוי.
  it('מחשב מחדש pnl מ-exitPrice כש-pnl בקובץ נשאר null - הטרייד מסווג נכון כסגור', () => {
    const mismatched = { ...trade, exitPrice: 105, pnl: null }
    const parsed = parseTradesJson(JSON.stringify([mismatched]))
    expect(parsed[0].pnl).toBe(50) // computePnl(long, 100, 105, qty 10, fee 0)
    expect(isTradeOpen(parsed[0])).toBe(false)
  })

  it('מתעלם מ-pnl שגוי/לא-מסונכרן בקובץ ומחשב את הערך הנכון מ-exitPrice', () => {
    const wrongPnl = { ...trade, pnl: 99999 }
    const parsed = parseTradesJson(JSON.stringify([wrongPnl]))
    expect(parsed[0].pnl).toBe(50)
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

  it('importTrades עצמו לא נוגע ב-pnl - מקבל טריידים כבר-מעובדים (אחרי parseTradesJson) ומעביר אותם ל-createTrade כמות שהם', async () => {
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
