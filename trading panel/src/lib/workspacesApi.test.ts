import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELD_SETTINGS, MAX_PRO_WORKSPACES, canCreateWorkspace } from './workspacesApi'

describe('DEFAULT_FIELD_SETTINGS', () => {
  it('כל השדות האופציונליים דלוקים כברירת מחדל', () => {
    expect(DEFAULT_FIELD_SETTINGS).toEqual({
      stopLoss: true,
      takeProfit: true,
      fee: true,
      notes: true,
      setup: true,
      requireExactTime: true,
    })
  })
})

describe('canCreateWorkspace', () => {
  it('חוסם יצירת workspace נוסף לדרגות שאינן Pro, גם אם עדיין אין אף אחד', () => {
    expect(canCreateWorkspace('demo', 0)).toBe(false)
    expect(canCreateWorkspace('basic', 0)).toBe(false)
    expect(canCreateWorkspace('basic', 1)).toBe(false)
  })

  it('מאפשר ל-Pro ליצור עד המגבלה', () => {
    for (let count = 0; count < MAX_PRO_WORKSPACES; count += 1) {
      expect(canCreateWorkspace('pro', count)).toBe(true)
    }
  })

  it('חוסם Pro בהגיעו למגבלת 5', () => {
    expect(canCreateWorkspace('pro', MAX_PRO_WORKSPACES)).toBe(false)
    expect(canCreateWorkspace('pro', MAX_PRO_WORKSPACES + 1)).toBe(false)
  })
})
