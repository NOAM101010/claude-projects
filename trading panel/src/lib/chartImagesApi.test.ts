import { describe, expect, it } from 'vitest'
import { buildChartImagePath } from './chartImagesApi'

// מגבלת תמונות הגרף התלוית-דרגה (canUploadChartImage) עברה ל-tierLimits.ts/tierLimits.test.ts.

describe('buildChartImagePath', () => {
  it('בונה נתיב עם תיקיית-שורש = account_id, כנדרש ע"י מדיניות ה-storage', () => {
    expect(buildChartImagePath('acc-123', 'file-456')).toBe('acc-123/file-456.jpg')
  })
})
