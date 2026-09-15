import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import styles from './SetupPicker.module.css'

interface SetupPickerOption {
  value: string
  label: string
  /** אופציית "Use '{query}'" - טקסט חופשי חדש (רק ל-Pro), לא אחד מ-`options`. סטייל שונה בדרופדאון. */
  isCustom?: boolean
}

interface SetupPickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  noSetupLabel: string
  /** קובעת אם מוצגת אופציית "Use '{query}'" ליצירת setup חופשי חדש - רק ל-Pro (ראה למטה). */
  tier: AccountTier
}

/**
 * שדה טקסט+dropdown מסונן (type-to-filter) לבחירת setup של טרייד מתוך רשימה גדולה
 * (~25 ערכים, ראה `types/trade.ts` SETUPS), עם אופציית "No setup" קבועה למעלה
 * וניווט מקלדת (חצים/Enter/Escape). `value` יכול להיות גם ערך חופשי שלא ברשימה
 * (טריידים ישנים, למשל 'Forex') - מוצג כטקסט חופשי כרגיל, בלי לאבד אותו.
 *
 * Pro exclusive: אם הטקסט המוקלד לא תואם בדיוק (case-insensitive) לאף ערך ב-`options`,
 * מתווספת בסוף הרשימה אופציית "Use '{query}'" שמאפשרת לשמור אותו כ-setup חופשי חדש -
 * בלעדיה (basic/demo) המשתמש יכול לבחור רק מהרשימה הקבועה, בדיוק כמו ההתנהגות המקורית
 * (הקלדה בלי בחירה מהרשימה חוזרת ל-value האחרון שאושר, ר' handleClickOutside/Escape).
 */
export function SetupPicker({ id, value, onChange, options, noSetupLabel, tier }: SetupPickerProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  const trimmedInput = query.trim()
  const trimmedQuery = trimmedInput.toLowerCase()
  const filtered = trimmedQuery ? options.filter((o) => o.toLowerCase().includes(trimmedQuery)) : options
  const hasExactMatch = trimmedQuery !== '' && options.some((o) => o.toLowerCase() === trimmedQuery)
  const canUseCustom = tier === 'pro' && trimmedInput !== '' && !hasExactMatch
  const list: SetupPickerOption[] = [
    { value: '', label: noSetupLabel },
    ...filtered.map((o) => ({ value: o, label: o })),
    ...(canUseCustom ? [{ value: trimmedInput, label: t('setupPicker.useCustomOption', { query: trimmedInput }), isCustom: true }] : []),
  ]

  const select = (item: SetupPickerOption) => {
    onChange(item.value)
    setQuery(item.value)
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, list.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = list[highlighted]
      if (item) select(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(value)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <input
        id={id}
        className={styles.input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
      />
      {open && list.length > 0 && (
        <ul id={id ? `${id}-listbox` : undefined} className={styles.dropdown} role="listbox">
          {list.map((item, index) => (
            <li
              key={item.isCustom ? `__custom__:${item.value}` : item.value || '__none__'}
              role="option"
              aria-selected={item.value === value}
              className={`${styles.option} ${index === highlighted ? styles.highlighted : ''} ${item.value === '' ? styles.noneOption : ''} ${item.isCustom ? styles.customOption : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(item)
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
