import { afterEach, describe, expect, it, vi } from 'vitest'
import { getQuoteForSymbol, getQuotesForSymbols } from './finnhubCache'

function mockFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) } as unknown as Response),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getQuoteForSymbol', () => {
  it('ממפה תגובה תקינה', async () => {
    mockFetchOnce({ c: 123.45, dp: 1.2 })
    const quote = await getQuoteForSymbol('AAPL', 'key', 0)
    expect(quote).toEqual({ price: 123.45, changePercent: 1.2 })
  })

  it('מחזירה null אם c חסר/0 (סימבול לא נתמך)', async () => {
    mockFetchOnce({ c: 0 })
    expect(await getQuoteForSymbol('ZZZZ', 'key', 1000)).toBeNull()
  })

  it('מחזירה null אם הבקשה נכשלת (רשת/rate-limit)', async () => {
    mockFetchOnce({}, false)
    expect(await getQuoteForSymbol('MSFT', 'key', 2000)).toBeNull()
  })

  it('לא קוראת שוב ל-fetch בתוך חלון ה-TTL עבור אותו סימבול', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ c: 10, dp: 0 }) } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    await getQuoteForSymbol('NVDA', 'key', 10_000)
    await getQuoteForSymbol('NVDA', 'key', 10_000 + 119_000) // עדיין בתוך TTL של 120s
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await getQuoteForSymbol('NVDA', 'key', 10_000 + 121_000) // אחרי שה-TTL פג
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('getQuotesForSymbols', () => {
  it('מסננת כפילויות (כולל case-insensitive) - קריאת fetch אחת לכל סימבול ייחודי', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ c: 55, dp: 0.5 }) } as unknown as Response)
    vi.stubGlobal('fetch', fetchSpy)

    const result = await getQuotesForSymbols(['tsla', 'TSLA', 'GME'], 'key', 50_000)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      TSLA: { price: 55, changePercent: 0.5 },
      GME: { price: 55, changePercent: 0.5 },
    })
  })
})
