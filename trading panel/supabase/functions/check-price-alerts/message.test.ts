import { describe, expect, it } from 'vitest'
import { buildAlertMessage } from './message'

describe('buildAlertMessage', () => {
  it('בונה הודעה עבור כיוון above (ברירת מחדל: אנגלית)', () => {
    expect(buildAlertMessage('AAPL', 'above', 190, 191.5)).toBe('AAPL is now $191.50 (above your target of $190.00)')
  })

  it('בונה הודעה עבור כיוון below באנגלית', () => {
    expect(buildAlertMessage('TSLA', 'below', 200, 198.2, 'en')).toBe(
      'TSLA is now $198.20 (below your target of $200.00)',
    )
  })

  it('בונה הודעה עבור כיוון above בעברית', () => {
    expect(buildAlertMessage('AAPL', 'above', 190, 191.5, 'he')).toBe(
      'AAPL נמצא כעת ב-$191.50 (מעל היעד שלך של $190.00)',
    )
  })

  it('בונה הודעה עבור כיוון below בעברית', () => {
    expect(buildAlertMessage('TSLA', 'below', 200, 198.2, 'he')).toBe(
      'TSLA נמצא כעת ב-$198.20 (מתחת היעד שלך של $200.00)',
    )
  })

  it('בונה הודעה עבור כיוון above בספרדית', () => {
    expect(buildAlertMessage('SPY', 'above', 400, 405.75, 'es')).toBe(
      'SPY está ahora en $405.75 (por encima de tu objetivo de $400.00)',
    )
  })

  it('בונה הודעה עבור כיוון below בצרפתית', () => {
    expect(buildAlertMessage('QQQ', 'below', 350, 348.1, 'fr')).toBe(
      'QQQ est maintenant à $348.10 (en dessous de votre objectif de $350.00)',
    )
  })

  it('נופלת בחזרה לאנגלית אם ה-language לא מוכר', () => {
    expect(buildAlertMessage('AAPL', 'above', 190, 191.5, 'xx')).toBe(
      'AAPL is now $191.50 (above your target of $190.00)',
    )
  })
})
