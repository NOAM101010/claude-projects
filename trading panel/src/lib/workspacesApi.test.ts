import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FIELD_SETTINGS,
  MAX_PRO_WORKSPACES,
  TEMPLATE_FIELD_DEFAULTS,
  TEMPLATE_TOOLS,
  canCreateWorkspace,
  canSelectTemplateDirectly,
  createWorkspace,
  setWorkspaceTemplate,
} from './workspacesApi'

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

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

describe('TEMPLATE_FIELD_DEFAULTS', () => {
  it('תואם בדיוק לטבלה המאושרת ב-robust-munching-puffin.md', () => {
    expect(TEMPLATE_FIELD_DEFAULTS).toEqual({
      day: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
      swing: { requireExactTime: false, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
      longterm: { requireExactTime: false, stopLoss: false, takeProfit: false, fee: true, setup: false, notes: true },
      crypto: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
    })
  })
})

describe('TEMPLATE_TOOLS', () => {
  it('תואם בדיוק למיפוי המאושר - longterm ללא positionSize, כל השאר כל 3 הכלים', () => {
    expect(TEMPLATE_TOOLS).toEqual({
      day: ['positionSize', 'pnl', 'watchlist'],
      swing: ['positionSize', 'pnl', 'watchlist', 'scaleIn', 'scaleOut'],
      longterm: ['pnl', 'watchlist', 'cagr'],
      crypto: ['positionSize', 'pnl', 'watchlist', 'liquidation'],
    })
  })
})

describe('canSelectTemplateDirectly', () => {
  it('Demo תמיד חופשי, גם עם תבנית כבר קיימת', () => {
    expect(canSelectTemplateDirectly('demo', null)).toBe(true)
    expect(canSelectTemplateDirectly('demo', 'day')).toBe(true)
  })

  it('Pro תמיד חופשי, גם עם תבנית כבר קיימת', () => {
    expect(canSelectTemplateDirectly('pro', null)).toBe(true)
    expect(canSelectTemplateDirectly('pro', 'swing')).toBe(true)
  })

  it('Basic חופשי רק בבחירה הראשונה (template===null)', () => {
    expect(canSelectTemplateDirectly('basic', null)).toBe(true)
    expect(canSelectTemplateDirectly('basic', 'crypto')).toBe(false)
  })
})

describe('createWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('בלי template - יוצר עם DEFAULT_FIELD_SETTINGS ובלי עמודת template ב-insert', async () => {
    const select1 = vi.fn(() => ({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }))
    const single = vi.fn(async () => ({ data: { id: 'ws-2', account_id: 'acc-1', name: 'X', field_settings: DEFAULT_FIELD_SETTINGS, base_currency: 'USD', template: null }, error: null }))
    const select2 = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select: select2 }))
    const from = vi.fn((table: string) => (table === 'workspaces' ? { select: select1, insert } : {}))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await createWorkspace('acc-1', 'pro', 'X')

    expect(insert).toHaveBeenCalledWith({ account_id: 'acc-1', name: 'X', field_settings: DEFAULT_FIELD_SETTINGS })
  })

  it('עם template - כותב גם template וגם את ה-field_settings התואמים ב-insert', async () => {
    const select1 = vi.fn(() => ({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }))
    const single = vi.fn(async () => ({
      data: { id: 'ws-3', account_id: 'acc-1', name: 'Y', field_settings: TEMPLATE_FIELD_DEFAULTS.crypto, base_currency: 'USD', template: 'crypto' },
      error: null,
    }))
    const select2 = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select: select2 }))
    const from = vi.fn((table: string) => (table === 'workspaces' ? { select: select1, insert } : {}))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    const created = await createWorkspace('acc-1', 'pro', 'Y', 'crypto')

    expect(insert).toHaveBeenCalledWith({ account_id: 'acc-1', name: 'Y', field_settings: TEMPLATE_FIELD_DEFAULTS.crypto, template: 'crypto' })
    expect(created.template).toBe('crypto')
  })
})

describe('setWorkspaceTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('מעדכנת גם template וגם field_settings (ברירות המחדל של התבנית) באותה קריאה', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await setWorkspaceTemplate('ws-1', 'longterm')

    expect(from).toHaveBeenCalledWith('workspaces')
    expect(update).toHaveBeenCalledWith({ template: 'longterm', field_settings: TEMPLATE_FIELD_DEFAULTS.longterm })
    expect(eq).toHaveBeenCalledWith('id', 'ws-1')
  })

  it('זורקת אם השרת מחזיר שגיאה', async () => {
    const eq = vi.fn(async () => ({ error: new Error('boom') }))
    const from = vi.fn(() => ({ update: () => ({ eq }) }))
    const { getSupabase } = await import('./supabase')
    vi.mocked(getSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getSupabase>)

    await expect(setWorkspaceTemplate('ws-1', 'day')).rejects.toThrow('boom')
  })
})
