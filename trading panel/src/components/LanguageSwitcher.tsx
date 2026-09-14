import { useLanguage } from '../i18n/LanguageContext'
import { LANGUAGES } from '../i18n/translations'
import type { Language } from '../i18n/translations'
import styles from './LanguageSwitcher.module.css'

interface LanguageSwitcherProps {
  /** מאפשר לקורא (למשל WorkspaceSettings) להוסיף/להחליף עיצוב כדי שהבורר ייראה טבעי
   * בהקשר שלא ה-header - ה-className המקומי (styles.select) תמיד נשאר כבסיס. */
  className?: string
}

/** בורר שפה - 4 שפות נתמכות, נשמר ב-localStorage דרך useLanguage. חי כרגע במסך ה-Settings בלבד. */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <select
      className={className ? `${styles.select} ${className}` : styles.select}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      aria-label={t('language.label')}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  )
}
