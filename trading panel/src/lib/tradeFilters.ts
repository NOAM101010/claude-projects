import { isTradeOpen } from './stats'
import type { Trade } from '../types/trade'

export type TypeFilter = 'all' | 'winning' | 'losing' | 'open'
export type DirectionFilter = 'all' | 'long' | 'short'
export type DateRangePreset = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'last3Months' | 'thisYear' | 'custom'

export interface TradeFiltersState {
  search: string
  type: TypeFilter
  direction: DirectionFilter
  datePreset: DateRangePreset
  /** "YYYY-MM-DD" מ-input[type=date], רלוונטי רק כש-datePreset === 'custom' */
  customFrom: string
  customTo: string
}

export const DEFAULT_TRADE_FILTERS: TradeFiltersState = {
  search: '',
  type: 'all',
  direction: 'all',
  datePreset: 'all',
  customFrom: '',
  customTo: '',
}

/** "YYYY-MM-DD" בזמן מקומי (לא UTC) - עקבי עם ה-helper המקביל ב-DesktopStatBar.tsx. */
function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** תחילת היום המקומי (00:00:00.000) עבור התאריך הנתון. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** סוף היום המקומי (23:59:59.999) עבור התאריך הנתון. */
function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** תחילת השבוע המקומי (יום ראשון, 00:00) שמכיל את התאריך הנתון. */
function startOfLocalWeek(d: Date): Date {
  const start = startOfLocalDay(d)
  start.setDate(start.getDate() - start.getDay())
  return start
}

/** ממיר "YYYY-MM-DD" (מ-input[type=date]) לתאריך מקומי, ללא הזזת אזור זמן. */
function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/**
 * בודק אם `entryAt` נופל בטווח התאריכים המבוקש, לפי זמן מקומי (לא UTC) - כדי להימנע
 * מבאגי timezone שכבר קרו בפרויקט הזה (ר' progress.md, ייבוא Excel). `referenceDate`
 * ניתן להזרקה לצורך בדיקות; ברירת המחדל `new Date()`.
 */
export function matchesDateRange(
  entryAt: string,
  preset: DateRangePreset,
  customFrom: string,
  customTo: string,
  referenceDate: Date = new Date(),
): boolean {
  if (preset === 'all') return true

  const entry = new Date(entryAt)
  if (Number.isNaN(entry.getTime())) return false

  switch (preset) {
    case 'today':
      return localDateKey(entry) === localDateKey(referenceDate)
    case 'thisWeek':
      return entry.getTime() >= startOfLocalWeek(referenceDate).getTime() && entry.getTime() <= endOfLocalDay(referenceDate).getTime()
    case 'thisMonth':
      return entry.getFullYear() === referenceDate.getFullYear() && entry.getMonth() === referenceDate.getMonth()
    case 'last3Months': {
      const from = startOfLocalDay(new Date(referenceDate))
      from.setMonth(from.getMonth() - 3)
      return entry.getTime() >= from.getTime() && entry.getTime() <= endOfLocalDay(referenceDate).getTime()
    }
    case 'thisYear':
      return entry.getFullYear() === referenceDate.getFullYear()
    case 'custom': {
      const from = parseLocalDateInput(customFrom)
      const to = parseLocalDateInput(customTo)
      if (from && entry.getTime() < startOfLocalDay(from).getTime()) return false
      if (to && entry.getTime() > endOfLocalDay(to).getTime()) return false
      if (!from && !to) return true
      return true
    }
    default:
      return true
  }
}

function matchesType(trade: Trade, type: TypeFilter): boolean {
  if (type === 'all') return true
  if (type === 'open') return isTradeOpen(trade)
  if (isTradeOpen(trade)) return false
  if (type === 'winning') return (trade.pnl ?? 0) > 0
  if (type === 'losing') return (trade.pnl ?? 0) < 0
  return true
}

/** מסנן טריידים לפי כל הפילטרים המתקדמים (חיפוש/סוג/כיוון/תאריך), משולבים ב-AND. */
export function filterTrades(trades: Trade[], filters: TradeFiltersState, referenceDate: Date = new Date()): Trade[] {
  const search = filters.search.trim().toLowerCase()
  return trades.filter((trade) => {
    if (search && !trade.symbol.toLowerCase().includes(search)) return false
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false
    if (!matchesType(trade, filters.type)) return false
    if (!matchesDateRange(trade.entryAt, filters.datePreset, filters.customFrom, filters.customTo, referenceDate)) return false
    return true
  })
}

export function hasActiveFilters(filters: TradeFiltersState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.type !== 'all' ||
    filters.direction !== 'all' ||
    filters.datePreset !== 'all'
  )
}
