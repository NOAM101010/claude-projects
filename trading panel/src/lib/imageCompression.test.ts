import { describe, expect, it } from 'vitest'
import { MAX_CHART_IMAGE_DIMENSION, computeResizedDimensions } from './imageCompression'

describe('computeResizedDimensions', () => {
  it('לא נוגע בתמונה שכבר קטנה מהמקסימום', () => {
    expect(computeResizedDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('לא מגדילה תמונה קטנה (רק מקטינה)', () => {
    expect(computeResizedDimensions(100, 50, 1600)).toEqual({ width: 100, height: 50 })
  })

  it('מקטינה תמונה רחבה כך שהצד הארוך שווה למקסימום, שומרת יחס גובה-רוחב', () => {
    const result = computeResizedDimensions(3200, 1600, 1600)
    expect(result).toEqual({ width: 1600, height: 800 })
  })

  it('מקטינה תמונה גבוהה (portrait) לפי הצד הארוך - הגובה', () => {
    const result = computeResizedDimensions(1000, 4000, 2000)
    expect(result).toEqual({ width: 500, height: 2000 })
  })

  it('משתמשת ב-MAX_CHART_IMAGE_DIMENSION כברירת מחדל', () => {
    const result = computeResizedDimensions(4800, 2400)
    expect(Math.max(result.width, result.height)).toBe(MAX_CHART_IMAGE_DIMENSION)
  })

  it('מטפלת בתמונה ריבועית בדיוק בגודל המקסימום', () => {
    expect(computeResizedDimensions(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('מחזירה את הערכים כמות שהם עבור מידות לא תקינות (0 או שליליות)', () => {
    expect(computeResizedDimensions(0, 0)).toEqual({ width: 0, height: 0 })
    expect(computeResizedDimensions(-10, 100)).toEqual({ width: -10, height: 100 })
  })
})
