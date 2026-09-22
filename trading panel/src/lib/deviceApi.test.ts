import { describe, expect, it } from 'vitest'
import { cooldownRemainingDays, DEVICE_DISCONNECT_COOLDOWN_DAYS } from './deviceApi'

const DAY_MS = 24 * 60 * 60 * 1000

describe('cooldownRemainingDays', () => {
  it('null (אף פעם לא נותק) -> 0, אין cooldown פעיל', () => {
    expect(cooldownRemainingDays(null)).toBe(0)
  })

  it('ניתוק ממש עכשיו -> 7 ימים נותרו (מלוא ה-cooldown)', () => {
    const now = new Date('2026-01-08T12:00:00.000Z')
    const lastDisconnect = now.toISOString()
    expect(cooldownRemainingDays(lastDisconnect, now)).toBe(DEVICE_DISCONNECT_COOLDOWN_DAYS)
  })

  it('בדיוק בגבול 7 הימים -> 0, מותר לנתק שוב', () => {
    const lastDisconnect = new Date('2026-01-01T12:00:00.000Z')
    const now = new Date(lastDisconnect.getTime() + 7 * DAY_MS)
    expect(cooldownRemainingDays(lastDisconnect.toISOString(), now)).toBe(0)
  })

  it('רגע לפני גבול 7 הימים (7 ימים פחות מילישנייה) -> עדיין 1 יום נותר (מעוגל כלפי מעלה)', () => {
    const lastDisconnect = new Date('2026-01-01T12:00:00.000Z')
    const now = new Date(lastDisconnect.getTime() + 7 * DAY_MS - 1)
    expect(cooldownRemainingDays(lastDisconnect.toISOString(), now)).toBe(1)
  })

  it('אחרי 8 ימים מלאים -> 0', () => {
    const lastDisconnect = new Date('2026-01-01T12:00:00.000Z')
    const now = new Date(lastDisconnect.getTime() + 8 * DAY_MS)
    expect(cooldownRemainingDays(lastDisconnect.toISOString(), now)).toBe(0)
  })

  it('אחרי 3 ימים -> 4 ימים נותרו', () => {
    const lastDisconnect = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date(lastDisconnect.getTime() + 3 * DAY_MS)
    expect(cooldownRemainingDays(lastDisconnect.toISOString(), now)).toBe(4)
  })
})
