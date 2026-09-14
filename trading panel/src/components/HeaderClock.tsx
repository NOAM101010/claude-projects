import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import styles from './HeaderClock.module.css'

const CLOCK_REFRESH_MS = 30_000

/**
 * שעון מקומי קטן, תמיד נראה בפינת ה-header (ראה App.tsx/PillNav.tsx). `setInterval`
 * עצמאי משלו (לא משתף state עם Home.tsx - זה route-level ונכנס/יוצא מה-DOM בכל מעבר
 * טאב, בעוד שה-header תמיד mounted) - 30 שניות מספיק לשעון שמציג HH:MM בלבד, בלי
 * ריצוד מיותר של עדכון כל שנייה. תמיד הזמן המקומי של הדפדפן - בלי בחירת אזור זמן.
 */
export function HeaderClock() {
  const { locale } = useLanguage()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const timeLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(now)

  return (
    <span className={`${styles.clock} num`} dir="ltr">
      {timeLabel}
    </span>
  )
}
