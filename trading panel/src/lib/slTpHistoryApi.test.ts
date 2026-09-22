import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectSlTpChanges, listSlTpHistoryForTrades } from './slTpHistoryApi'

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

describe('detectSlTpChanges', () => {
  it('לא מזהה שינוי כשהערכים זהים', () => {
    expect(detectSlTpChanges({ stopLoss: 95, takeProfit: 110 }, { stopLoss: 95, takeProfit: 110 })).toEqual([])
    expect(detectSlTpChanges({ stopLoss: null, takeProfit: null }, { stopLoss: null, takeProfit: null })).toEqual([])
  })

  it('מזהה שינוי value→value בשדה בודד', () => {
    expect(detectSlTpChanges({ stopLoss: 95, takeProfit: 110 }, { stopLoss: 90, takeProfit: 110 })).toEqual([
      { field: 'stop_loss', oldValue: 95, newValue: 90 },
    ])
  })

  it('מזהה שינוי null→value (שדה שהיה ריק ומולא)', () => {
    expect(detectSlTpChanges({ stopLoss: null, takeProfit: 110 }, { stopLoss: 90, takeProfit: 110 })).toEqual([
      { field: 'stop_loss', oldValue: null, newValue: 90 },
    ])
  })

  it('מזהה שינוי value→null (שדה שנמחק)', () => {
    expect(detectSlTpChanges({ stopLoss: 90, takeProfit: 110 }, { stopLoss: null, takeProfit: 110 })).toEqual([
      { field: 'stop_loss', oldValue: 90, newValue: null },
    ])
  })

  it('מזהה שינוי בשני השדות בו-זמנית', () => {
    expect(detectSlTpChanges({ stopLoss: 95, takeProfit: 110 }, { stopLoss: 90, takeProfit: 120 })).toEqual([
      { field: 'stop_loss', oldValue: 95, newValue: 90 },
      { field: 'take_profit', oldValue: 110, newValue: 120 },
    ])
  })
})

describe('listSlTpHistoryForTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מחזירה [] בלי לזרוק כששאילתת ה-DB נכשלת (למשל: הטבלה עוד לא קיימת - מיגרציה 024 לא רצה) - לא אמורה להפיל טעינת אפליקציה', async () => {
    const order = vi.fn(async () => ({ data: null, error: new Error("relation 'trade_sl_tp_history' does not exist") }))
    const inFn = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ in: inFn }))
    const from = vi.fn(() => ({ select }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(listSlTpHistoryForTrades(['trade-1'])).resolves.toEqual([])
  })

  it('מחזירה [] בלי לזרוק גם כש-getSupabase/הרשת זורקים חריגה גולמית (לא רק error object מ-Supabase)', async () => {
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockImplementation(() => {
      throw new Error('network down')
    })

    await expect(listSlTpHistoryForTrades(['trade-1'])).resolves.toEqual([])
  })

  it('לא קוראת ל-DB בכלל ומחזירה [] כש-tradeIds ריק', async () => {
    const from = vi.fn()
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(listSlTpHistoryForTrades([])).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })
})
