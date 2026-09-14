import { Moon, Sun } from 'lucide-react'
import { useTranslation } from '../i18n/LanguageContext'
import { useTheme } from '../theme/ThemeContext'
import styles from './ThemeSwitcher.module.css'

/**
 * מתג ערכת-נושא קטן בהדר (Dark/Light) - אותה משפחה ויזואלית כמו כפתורי ה-nav
 * (`btn-metal`, ראה index.css). המצב עצמו נשמר ב-localStorage דרך `useTheme`;
 * ההחלפה בפועל היא attribute על ה-<html> שה-CSS מגיב אליו - אין כאן שום תלות
 * ברינדור מחדש של שאר העץ.
 */
export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme()
  const t = useTranslation()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`${styles.button} btn-metal`}
      onClick={toggleTheme}
      aria-label={isLight ? t('theme.switchToDark') : t('theme.switchToLight')}
      title={isLight ? t('theme.switchToDark') : t('theme.switchToLight')}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
