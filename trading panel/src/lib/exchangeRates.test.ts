import { describe, expect, it } from 'vitest'
import { toApiDate } from './exchangeRates'

// getHistoricalRate עצמה עוברת דרך getSupabase().functions.invoke('exchange-rate', ...) -
// לוגיקת cache-hit/miss+fetch-מ-Frankfurter+כתיבה-לקאש עברה לצד שרת
// (supabase/functions/exchange-rate/index.ts, ראה 020_exchange_rate_cache_lockdown.sql
// לנימוק), אז אין כאן יותר לוגיקה טהורה client-side לבדוק - בדיוק כמו
// fetchStockIndices/fetchWatchlistPrices ב-marketData.ts שגם לא מכוסות ביחידה, רק
// הפונקציות הטהורות (mapCoinGeckoResponse וכו').

describe('toApiDate', () => {
  it('חותך ISO datetime לתאריך בלבד', () => {
    expect(toApiDate('2026-03-15T10:30:00.000Z')).toBe('2026-03-15')
  })

  it('משאיר תאריך בלי שעה כמו שהוא', () => {
    expect(toApiDate('2026-03-15')).toBe('2026-03-15')
  })
})
