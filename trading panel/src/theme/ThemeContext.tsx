import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './ThemeFadeOverlay.module.css'

const STORAGE_KEY = 'tradepanel_theme'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** true during the ~560ms fade-overlay window around a theme switch (see `ThemeFadeOverlay`) -
   * the theme attribute itself flips at the fade's midpoint (260ms in), same beat as the approved
   * `theme-transition-directions.html` direction 1 mockup. */
  isTransitioning: boolean
}

/** matches theme-transition-directions.html's direction 1 timings exactly (260ms to midpoint, 560ms total). */
const THEME_SWITCH_AT_MS = 260
const THEME_TRANSITION_TOTAL_MS = 560

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
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (next: Theme) => {
    if (next === theme || isTransitioning) return
    // Fade-overlay window (direction 1, theme-transition-directions.html): the overlay ramps
    // up first, the actual attribute/localStorage swap happens at its darkest midpoint (so the
    // hard flip is masked), then the overlay fades back out. respects prefers-reduced-motion via
    // the overlay's own CSS - the state machine here doesn't need to know about that.
    setIsTransitioning(true)
    window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, next)
      setThemeState(next)
    }, THEME_SWITCH_AT_MS)
    window.setTimeout(() => {
      setIsTransitioning(false)
    }, THEME_TRANSITION_TOTAL_MS)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      isTransitioning,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, isTransitioning],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {/* app-wide overlay (not scoped to the ThemeSwitcher button) so the fade covers the whole
          screen regardless of which top-level branch App.tsx is currently rendering. */}
      <div className={`${styles.overlay} ${isTransitioning ? styles.overlayActive : ''}`} aria-hidden="true" />
    </ThemeContext.Provider>
  )
}

/** hook יחיד לגישה לערכת-הנושא הנוכחית/setTheme/toggleTheme. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
