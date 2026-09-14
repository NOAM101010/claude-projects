import { describe, expect, it } from 'vitest'
import { buildAlertMessage } from './message'

describe('buildAlertMessage', () => {
  it('בונה הודעה עבור כיוון above', () => {
    expect(buildAlertMessage('AAPL', 'above', 190, 191.5)).toBe('AAPL is now $191.50 (above your target of $190.00)')
  })

  it('בונה הודעה עבור כיוון below', () => {
    expect(buildAlertMessage('TSLA', 'below', 200, 198.2)).toBe('TSLA is now $198.20 (below your target of $200.00)')
  })
})
