import { useLanguage } from '../i18n/LanguageContext'
import { LANGUAGES } from '../i18n/translations'
import type { Language } from '../i18n/translations'
import styles from './LanguageSwitcher.module.css'

/** בורר שפה קטן בהדר - 4 שפות נתמכות, נשמר ב-localStorage דרך useLanguage. */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <select
      className={styles.select}
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
