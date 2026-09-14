import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importOrUpdateTrades } from './mergeImport'
import type { ParsedExcelRow } from './importExcel'
import type { Trade } from '../types/trade'

vi.mock('./tradesApi', () => ({
  createTrade: vi.fn(async (_workspaceId: string, _accountId: string, trade: Trade) => trade),
  updateTrade: vi.fn(async (_id: string, trade: Trade) => trade),
}))

const existingTrade: Trade = {
  id: 'existing-1',
  symbol: 'AAPL',
  direction: 'long',
  entryAt: '2026-01-05T14:30:00.000Z', // has a real time-of-day, unlike an external spreadsheet row
  entryPrice: 150,
  quantity: 10,
  stopLoss: null,
  takeProfit: null,
  exitAt: '2026-01-10T00:00:00.000Z',
  exitPrice: 160,
  pnl: 100, // already closed - must never be overwritten, even with 0
  currency: 'USD',
  fee: null,
  notes: '',
  setup: undefined,
}

const matchingRow: ParsedExcelRow = {
  symbol: 'AAPL',
  direction: 'long',
  entryAt: '2026-01-05', // date-only, no time-of-day - must still match by day
  entryPrice: 150,
  quantity: 10,
}

describe('importOrUpdateTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('יוצר טרייד חדש כשלא נמצאה התאמה', async () => {
    const result = await importOrUpdateTrades('ws1', 'acc1', [matchingRow], [])
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.unchanged).toBe(0)
    expect(result.createdTrades).toHaveLength(1)
  })

  it('מתאים טרייד קיים לפי תאריך בלבד (לא שעה מדויקת)', async () => {
    const result = await importOrUpdateTrades('ws1', 'acc1', [{ ...matchingRow, fee: 5 }], [existingTrade])
    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)
  })

  it('משלים שדה ריק (fee) בטרייד קיים בלי לגעת בשדות שכבר קיימים', async () => {
    const { updateTrade } = await import('./tradesApi')
    const result = await importOrUpdateTrades('ws1', 'acc1', [{ ...matchingRow, fee: 5, notes: 'from excel' }], [existingTrade])
    expect(result.updated).toBe(1)
    const patched = vi.mocked(updateTrade).mock.calls[0][1]
    expect(patched.fee).toBe(5) // was null - filled in
    expect(patched.notes).toBe('from excel') // was '' - filled in
    expect(patched.pnl).toBe(100) // untouched
    expect(patched.exitPrice).toBe(160) // untouched
    expect(patched.entryPrice).toBe(150) // untouched
  })

  it('לעולם לא דורס pnl קיים - גם אם השורה המיובאת מביאה pnl אחר', async () => {
    const { updateTrade } = await import('./tradesApi')
    await importOrUpdateTrades('ws1', 'acc1', [{ ...matchingRow, pnl: 999, fee: 2 }], [existingTrade])
    const patched = vi.mocked(updateTrade).mock.calls[0][1]
    expect(patched.pnl).toBe(100)
  })

  it('לעולם לא דורס pnl==0 קיים (0 הוא ערך אמיתי, לא "ריק")', async () => {
    const { updateTrade } = await import('./tradesApi')
    const breakEvenTrade = { ...existingTrade, pnl: 0 }
    await importOrUpdateTrades('ws1', 'acc1', [{ ...matchingRow, pnl: 500, fee: 3 }], [breakEvenTrade])
    const patched = vi.mocked(updateTrade).mock.calls[0][1]
    expect(patched.pnl).toBe(0)
  })

  it('unchanged אם אין שום שדה חסר להשלים - ולא נקראת updateTrade כלל', async () => {
    const { updateTrade } = await import('./tradesApi')
    const fullTrade: Trade = { ...existingTrade, fee: 2, notes: 'already filled', setup: 'Breakout' }
    const result = await importOrUpdateTrades('ws1', 'acc1', [matchingRow], [fullTrade])
    expect(result.unchanged).toBe(1)
    expect(result.updated).toBe(0)
    expect(updateTrade).not.toHaveBeenCalled()
  })

  it('טרייד חדש מקבל UUID חדש, לא id מהקובץ (אין id בקובץ Excel חיצוני ממילא)', async () => {
    const result = await importOrUpdateTrades('ws1', 'acc1', [matchingRow], [])
    expect(result.createdTrades[0].id).toBeTruthy()
    expect(typeof result.createdTrades[0].id).toBe('string')
  })

  it('ambiguous - שני טריידים קיימים עם אותו מפתח טבעי (שעות כניסה שונות) - מדלג ולא מנחש איזה לעדכן', async () => {
    const { updateTrade } = await import('./tradesApi')
    const secondExisting: Trade = { ...existingTrade, id: 'existing-2', entryAt: '2026-01-05T20:00:00.000Z' }
    const result = await importOrUpdateTrades('ws1', 'acc1', [{ ...matchingRow, fee: 5 }], [existingTrade, secondExisting])
    expect(result.ambiguous).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.created).toBe(0)
    expect(result.unchanged).toBe(0)
    expect(updateTrade).not.toHaveBeenCalled()
  })
})
