import { describe, expect, it } from 'vitest'
import { IndicesCache, isIndicesResponseFailed, mapFinnhubQuote, mapSectorQuote } from './mapping'
import type { MarketIndicesResponse } from './mapping'

describe('mapFinnhubQuote', () => {
  it('ממפה תגובה תקינה', () => {
    expect(mapFinnhubQuote({ c: 512.34, dp: 1.23 })).toEqual({ price: 512.34, changePercent: 1.23 })
  })

  it('ברירת מחדל 0 אם dp חסר', () => {
    expect(mapFinnhubQuote({ c: 512.34 })).toEqual({ price: 512.34, changePercent: 0 })
  })

  it('מחזירה null אם c חסר (סימבול לא נתמך בתוכנית החינמית)', () => {
    expect(mapFinnhubQuote({ dp: 1 })).toBeNull()
  })

  it('מחזירה null אם c הוא 0 (Finnhub מחזיר 0 עבור סימבול לא מוכר)', () => {
    expect(mapFinnhubQuote({ c: 0, dp: 0 })).toBeNull()
  })

  it('מחזירה null אם data הוא null/undefined', () => {
    expect(mapFinnhubQuote(null)).toBeNull()
    expect(mapFinnhubQuote(undefined)).toBeNull()
  })
})

describe('mapSectorQuote', () => {
  it('ממפה אחוז שינוי כשהנתון תקין', () => {
    expect(mapSectorQuote('XLK', { c: 210.5, dp: 0.85 })).toEqual({ etf: 'XLK', changePercent: 0.85 })
  })

  it('מחזירה null כש-c חסר/0', () => {
    expect(mapSectorQuote('XLF', { c: 0 })).toEqual({ etf: 'XLF', changePercent: null })
    expect(mapSectorQuote('XLE', null)).toEqual({ etf: 'XLE', changePercent: null })
  })
})

describe('isIndicesResponseFailed', () => {
  const base: MarketIndicesResponse = {
    spy: null,
    qqq: null,
    vix: null,
    dia: null,
    iwm: null,
    dxy: null,
    oil: null,
    gold: null,
    silver: null,
    bondLong: null,
    bondMid: null,
    sectors: [],
    fetchedAt: 'x',
  }

  it('true כשכל השדות null (כשל מלא)', () => {
    expect(isIndicesResponseFailed(base)).toBe(true)
  })

  it('false אם ולו שדה אחד תקין (למשל רק VIX לא זמין בתוכנית החינמית)', () => {
    expect(isIndicesResponseFailed({ ...base, spy: { price: 512.34, changePercent: 1.23 } })).toBe(false)
  })
})

describe('IndicesCache', () => {
  const sample = {
    spy: null,
    qqq: null,
    vix: null,
    dia: null,
    iwm: null,
    dxy: null,
    oil: null,
    gold: null,
    silver: null,
    bondLong: null,
    bondMid: null,
    sectors: [],
    fetchedAt: 'x',
  }

  it('מחזירה null כשריק', () => {
    const cache = new IndicesCache(1000)
    expect(cache.get(0)).toBeNull()
  })

  it('מחזירה את הערך השמור בתוך חלון ה-TTL', () => {
    const cache = new IndicesCache(1000)
    cache.set(sample, 0)
    expect(cache.get(500)).toBe(sample)
    expect(cache.get(999)).toBe(sample)
  })

  it('מחזירה null אחרי שה-TTL פג', () => {
    const cache = new IndicesCache(1000)
    cache.set(sample, 0)
    expect(cache.get(1001)).toBeNull()
    expect(cache.get(2000)).toBeNull()
  })
})
