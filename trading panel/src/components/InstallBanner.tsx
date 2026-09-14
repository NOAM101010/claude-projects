import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { isIosSafari, isStandaloneDisplay } from '../lib/pwaInstall'
import styles from './InstallBanner.module.css'

const DISMISSED_KEY = 'tradepanel_install_banner_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * באנר "הוסף למסך הבית": ב-iOS Safari (שאין בו beforeinstallprompt בכלל) מציג הוראה
 * סטטית; באנדרואיד/כרום-דסקטופ תופס את beforeinstallprompt ומציג כפתור "התקן" אמיתי.
 * לא מוצג כלל אם האתר כבר רץ כ-PWA מותקן (standalone), או אחרי שנסגר ידנית.
 */
export function InstallBanner() {
  const { t } = useLanguage()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')
  const [standalone, setStandalone] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
    const isStandalone = isStandaloneDisplay(window.matchMedia('(display-mode: standalone)').matches, iosStandalone)
    setStandalone(isStandalone)
    setShowIosHint(!isStandalone && isIosSafari(window.navigator.userAgent))

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (dismissed || standalone || (!showIosHint && !installPrompt)) return null

  return (
    <div className={`${styles.banner} glass-blur count-in`}>
      {installPrompt ? (
        <>
          <span className={styles.text}>
            <span className={styles.dot} aria-hidden="true" />
            {t('install.promptText')}
          </span>
          <div className={styles.actions}>
            <button type="button" onClick={install}>
              {t('install.installButton')}
            </button>
            <button type="button" className={styles.dismiss} onClick={dismiss}>
              {t('install.notNow')}
            </button>
          </div>
        </>
      ) : (
        <>
          <span className={styles.text}>
            <span className={styles.dot} aria-hidden="true" />
            {t('install.iosHint1')} <span className={styles.icon}>⎋</span> {t('install.iosHint2')}
          </span>
          <button type="button" className={styles.dismiss} onClick={dismiss}>
            {t('install.gotIt')}
          </button>
        </>
      )}
    </div>
  )
}
