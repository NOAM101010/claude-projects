import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LOCK_LANGUAGE_TO_ENGLISH } from '../config/locks'
import {
  LOCALE_BY_LANGUAGE,
  RTL_LANGUAGES,
  TRANSLATIONS,
  detectDefaultLanguage,
  interpolate,
} from './translations'
import type { Language, TranslationKey } from './translations'

const STORAGE_KEY = 'tradepanel_language'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  /** קוד locale ל-Intl (תאריכים/מטבעות) - תואם את השפה הנוכחית. */
  locale: string
  dir: 'ltr' | 'rtl'
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStoredLanguage(): Language | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'he' || stored === 'es' || stored === 'fr') return stored
  return null
}

/**
 * ספק שפה גלובלי: קורא שפה שמורה מ-localStorage, ואם אין - מזהה לפי navigator.language
 * בביקור ראשון. מעדכן `dir`/`lang` על ה-<html> בכל שינוי שפה (ראה index.html).
 * אם `LOCK_LANGUAGE_TO_ENGLISH` דלוק (ראה `src/config/locks.ts`) - תמיד 'en', בלי
 * לגעת ב-localStorage/navigator.language בכלל. תשתית ה-i18n עצמה נשארת שלמה.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    LOCK_LANGUAGE_TO_ENGLISH ? 'en' : readStoredLanguage() ?? detectDefaultLanguage(navigator.language),
  )

  useEffect(() => {
    const dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language])

  const setLanguage = (lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang)
    setLanguageState(lang)
  }

  const value = useMemo<LanguageContextValue>(() => {
    const dict = TRANSLATIONS[language]
    return {
      language,
      setLanguage,
      locale: LOCALE_BY_LANGUAGE[language],
      dir: RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr',
      t: (key, params) => interpolate(dict[key], params),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/** hook יחיד לגישה לשפה/כיווניות/locale/setLanguage. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

/** נוחות: מחזיר רק את פונקציית התרגום. */
export function useTranslation(): LanguageContextValue['t'] {
  return useLanguage().t
}
