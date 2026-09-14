import { describe, expect, it, vi } from 'vitest'
import { resolveHistoricalRate, toApiDate } from './exchangeRates'
import type { RateCacheStore } from './exchangeRates'

function makeStore(initial: Record<string, number> = {}): RateCacheStore & { writes: Array<[string, string, string, number]> } {
  const data = new Map(Object.entries(initial))
  const writes: Array<[string, string, string, number]> = []
  return {
    writes,
    async read(date, from, to) {
      const key = `${date}|${from}|${to}`
      return data.has(key) ? data.get(key)! : null
    },
    async write(date, from, to, rate) {
      data.set(`${date}|${from}|${to}`, rate)
      writes.push([date, from, to, rate])
    },
  }
}

describe('resolveHistoricalRate', () => {
  it('מחזיר 1 מיידית כשהמטבעות זהים, בלי לגעת בקאש או ב-API', async () => {
    const store = makeStore()
    const fetchRate = vi.fn()
    const rate = await resolveHistoricalRate('2026-01-01', 'USD', 'USD', store, fetchRate)
    expect(rate).toBe(1)
    expect(fetchRate).not.toHaveBeenCalled()
  })

  it('מחזיר שער מהקאש בלי לקרוא ל-API כשיש cache-hit', async () => {
    const store = makeStore({ '2026-01-01|USD|ILS': 3.7 })
    const fetchRate = vi.fn()
    const rate = await resolveHistoricalRate('2026-01-01', 'USD', 'ILS', store, fetchRate)
    expect(rate).toBe(3.7)
    expect(fetchRate).not.toHaveBeenCalled()
  })

  it('קורא ל-API בcache-miss ושומר את התוצאה לקאש', async () => {
    const store = makeStore()
    const fetchRate = vi.fn().mockResolvedValue(4.1)
    const rate = await resolveHistoricalRate('2026-02-02', 'GBP', 'ILS', store, fetchRate)
    expect(rate).toBe(4.1)
    expect(fetchRate).toHaveBeenCalledWith('2026-02-02', 'GBP', 'ILS')
    expect(store.writes).toEqual([['2026-02-02', 'GBP', 'ILS', 4.1]])
  })

  it('לא כותב לקאש כשה-API נכשל', async () => {
    const store = makeStore()
    const fetchRate = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(resolveHistoricalRate('2026-02-02', 'GBP', 'ILS', store, fetchRate)).rejects.toThrow('boom')
    expect(store.writes).toEqual([])
  })
})

describe('toApiDate', () => {
  it('חותך ISO datetime לתאריך בלבד', () => {
    expect(toApiDate('2026-03-15T10:30:00.000Z')).toBe('2026-03-15')
  })

  it('משאיר תאריך בלי שעה כמו שהוא', () => {
    expect(toApiDate('2026-03-15')).toBe('2026-03-15')
  })
})
