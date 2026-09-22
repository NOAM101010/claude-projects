import { describe, expect, it } from 'vitest'
import { resolveActiveTab } from './Tools'

// בדיקת רינדור מלאה (React Testing Library + jsdom) לא קיימת עדיין בפרויקט (ראה
// ErrorBoundary.test.ts) - resolveActiveTab היא הלוגיקה הטהורה שמניעה את ה-gating בפועל:
// אילו טאבים מוצגים/מוסתרים לפי תבנית (TEMPLATE_TOOLS ב-workspacesApi.ts, נבדק שם בנפרד)
// ואיזה טאב פעיל אחרי מעבר תבנית.
describe('resolveActiveTab', () => {
  it('template=null - לא נוגע בטאב הנוכחי (ה-prompt מוצג במקום הטאבים בכלל)', () => {
    expect(resolveActiveTab(null, 'positionSize')).toBe('positionSize')
    expect(resolveActiveTab(null, 'watchlist')).toBe('watchlist')
  })

  it('day/swing/crypto - positionSize מותר, נשאר עליו', () => {
    expect(resolveActiveTab('day', 'positionSize')).toBe('positionSize')
    expect(resolveActiveTab('swing', 'positionSize')).toBe('positionSize')
    expect(resolveActiveTab('crypto', 'positionSize')).toBe('positionSize')
  })

  it('longterm - positionSize לא מותר, עובר אוטומטית לטאב הראשון המותר (pnl)', () => {
    expect(resolveActiveTab('longterm', 'positionSize')).toBe('pnl')
  })

  it('longterm - pnl/watchlist כבר מותרים, נשאר עליהם בלי לזוז', () => {
    expect(resolveActiveTab('longterm', 'pnl')).toBe('pnl')
    expect(resolveActiveTab('longterm', 'watchlist')).toBe('watchlist')
  })

  it('כל 4 התבניות מתירות watchlist - אף פעם לא זז ממנו', () => {
    for (const template of ['day', 'swing', 'longterm', 'crypto'] as const) {
      expect(resolveActiveTab(template, 'watchlist')).toBe('watchlist')
    }
  })
})
