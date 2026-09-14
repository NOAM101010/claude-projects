import { describe, expect, it } from 'vitest'
import {
  CHART_IMAGE_LIMIT_BY_TIER,
  WATCHLIST_ALERT_LIMIT_BY_TIER,
  WATCHLIST_SYMBOL_LIMIT_BY_TIER,
  canAddWatchlistSymbol,
  canSetWatchlistAlert,
  canUploadChartImage,
  getChartImageLimit,
  getWatchlistAlertLimit,
  getWatchlistSymbolLimit,
} from './tierLimits'

describe('CHART_IMAGE_LIMIT_BY_TIER / getChartImageLimit', () => {
  it('demo=1, basic=50, pro=150', () => {
    expect(CHART_IMAGE_LIMIT_BY_TIER).toEqual({ demo: 1, basic: 50, pro: 150 })
    expect(getChartImageLimit('demo')).toBe(1)
    expect(getChartImageLimit('basic')).toBe(50)
    expect(getChartImageLimit('pro')).toBe(150)
  })
})

describe('canUploadChartImage', () => {
  it('מאפשר העלאה מתחת למגבלת הדרגה', () => {
    expect(canUploadChartImage('demo', 0, false)).toBe(true)
    expect(canUploadChartImage('basic', 49, false)).toBe(true)
    expect(canUploadChartImage('pro', 149, false)).toBe(true)
  })

  it('חוסם העלאת תמונה חדשה בהגיעו למגבלת הדרגה', () => {
    expect(canUploadChartImage('demo', 1, false)).toBe(false)
    expect(canUploadChartImage('basic', 50, false)).toBe(false)
    expect(canUploadChartImage('pro', 150, false)).toBe(false)
  })

  it('מאפשר להחליף תמונה קיימת על אותו טרייד גם מעל המגבלה', () => {
    expect(canUploadChartImage('demo', 1, true)).toBe(true)
    expect(canUploadChartImage('basic', 999, true)).toBe(true)
  })
})

describe('WATCHLIST_SYMBOL_LIMIT_BY_TIER / getWatchlistSymbolLimit', () => {
  it('demo=2, basic=15, pro=30', () => {
    expect(WATCHLIST_SYMBOL_LIMIT_BY_TIER).toEqual({ demo: 2, basic: 15, pro: 30 })
    expect(getWatchlistSymbolLimit('demo')).toBe(2)
    expect(getWatchlistSymbolLimit('basic')).toBe(15)
    expect(getWatchlistSymbolLimit('pro')).toBe(30)
  })
})

describe('canAddWatchlistSymbol', () => {
  it('מאפשר הוספה כל עוד לא הגיעו למגבלת הדרגה', () => {
    expect(canAddWatchlistSymbol('demo', 0)).toBe(true)
    expect(canAddWatchlistSymbol('demo', 1)).toBe(true)
    expect(canAddWatchlistSymbol('basic', 14)).toBe(true)
    expect(canAddWatchlistSymbol('pro', 29)).toBe(true)
  })

  it('חוסם הוספה בהגיעו למגבלת הדרגה', () => {
    expect(canAddWatchlistSymbol('demo', 2)).toBe(false)
    expect(canAddWatchlistSymbol('basic', 15)).toBe(false)
    expect(canAddWatchlistSymbol('pro', 30)).toBe(false)
  })
})

describe('WATCHLIST_ALERT_LIMIT_BY_TIER / getWatchlistAlertLimit', () => {
  it('demo=0, basic=10, pro=20', () => {
    expect(WATCHLIST_ALERT_LIMIT_BY_TIER).toEqual({ demo: 0, basic: 10, pro: 20 })
    expect(getWatchlistAlertLimit('demo')).toBe(0)
    expect(getWatchlistAlertLimit('basic')).toBe(10)
    expect(getWatchlistAlertLimit('pro')).toBe(20)
  })
})

describe('canSetWatchlistAlert', () => {
  it('דמו לעולם לא יכול להגדיר התראת מחיר, גם מ-0', () => {
    expect(canSetWatchlistAlert('demo', 0)).toBe(false)
  })

  it('מאפשר הגדרת התראה כל עוד לא הגיעו למגבלת הדרגה', () => {
    expect(canSetWatchlistAlert('basic', 9)).toBe(true)
    expect(canSetWatchlistAlert('pro', 19)).toBe(true)
  })

  it('חוסם בהגיעו למגבלת הדרגה', () => {
    expect(canSetWatchlistAlert('basic', 10)).toBe(false)
    expect(canSetWatchlistAlert('pro', 20)).toBe(false)
  })
})
