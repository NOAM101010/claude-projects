import { describe, expect, it } from 'vitest'
import { heatClass } from './SectorHeatmap'

describe('heatClass', () => {
  it('null -> ניטרלי (אין דאטה)', () => {
    expect(heatClass(null)).toBe('heat-neu')
  })

  it('בדיוק בגבול הטווח הניטרלי (±0.05%) -> עדיין ניטרלי', () => {
    expect(heatClass(0.05)).toBe('heat-neu')
    expect(heatClass(-0.05)).toBe('heat-neu')
    expect(heatClass(0)).toBe('heat-neu')
  })

  it('מעל/מתחת ל-0.05% אבל מתחת ל-0.3% -> כבר מקבל צבע (heat-pos1/heat-neg1), לא ניטרלי', () => {
    expect(heatClass(0.06)).toBe('heat-pos1')
    expect(heatClass(0.2)).toBe('heat-pos1')
    expect(heatClass(-0.06)).toBe('heat-neg1')
    expect(heatClass(-0.2)).toBe('heat-neg1')
  })

  it('רמות העוצמה החזקות (1%/2%) נשארות ללא שינוי', () => {
    expect(heatClass(1)).toBe('heat-pos2')
    expect(heatClass(1.99)).toBe('heat-pos2')
    expect(heatClass(2)).toBe('heat-pos3')
    expect(heatClass(-1)).toBe('heat-neg1') // גבול >= -1 עדיין heat-neg1 (לא השתנה בסבב הזה)
    expect(heatClass(-1.5)).toBe('heat-neg2')
    expect(heatClass(-2)).toBe('heat-neg2')
    expect(heatClass(-2.5)).toBe('heat-neg3')
  })
})
