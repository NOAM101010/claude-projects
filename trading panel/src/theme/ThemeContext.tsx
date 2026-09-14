import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'tradepanel_theme'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return null
}

// מוחל מיד עם טעינת המודול (לפני ה-render הראשון של React) כדי למנוע הבזק של
// ערכת-הנושא הלא-נכונה למי שכבר בחר 'light' בביקור קודם.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', readStoredTheme() ?? 'dark')
}

/**
 * ספק ערכת-נושא גלובלי - אותו דפוס בדיוק כמו `LanguageContext` (localStorage +
 * context). ברירת המחדל היא 'dark' (המראה הקיים) עבור כל מי שעדיין לא בחר במפורש
 * ערכת-נושא בהירה - שינוי המראה בפועל קורה כולו ב-CSS (attribute `data-theme` על
 * ה-<html> + custom properties ב-index.css) כדי שהחלפת ערכת-נושא לא תגרום ל-
 * re-render של שאר העץ - רק ה-effect כאן רץ, השאר הוא cascade טהור של CSS.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** hook יחיד לגישה לערכת-הנושא הנוכחית/setTheme/toggleTheme. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
