import { describe, expect, it } from 'vitest'
import { CHART_IMAGE_LIMIT, buildChartImagePath, canUploadChartImage } from './chartImagesApi'

describe('canUploadChartImage', () => {
  it('מאפשר העלאה מתחת למגבלה', () => {
    expect(canUploadChartImage(0, false)).toBe(true)
    expect(canUploadChartImage(CHART_IMAGE_LIMIT - 1, false)).toBe(true)
  })

  it('חוסם העלאת תמונה חדשה בהגיעו למגבלה', () => {
    expect(canUploadChartImage(CHART_IMAGE_LIMIT, false)).toBe(false)
    expect(canUploadChartImage(CHART_IMAGE_LIMIT + 1, false)).toBe(false)
  })

  it('מאפשר להחליף תמונה קיימת על אותו טרייד גם מעל המגבלה', () => {
    expect(canUploadChartImage(CHART_IMAGE_LIMIT, true)).toBe(true)
    expect(canUploadChartImage(CHART_IMAGE_LIMIT + 10, true)).toBe(true)
  })
})

describe('buildChartImagePath', () => {
  it('בונה נתיב עם תיקיית-שורש = account_id, כנדרש ע"י מדיניות ה-storage', () => {
    expect(buildChartImagePath('acc-123', 'file-456')).toBe('acc-123/file-456.jpg')
  })
})
