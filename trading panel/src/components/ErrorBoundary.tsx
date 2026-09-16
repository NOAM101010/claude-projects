import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import styles from './ErrorBoundary.module.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** מסך נפילה מלא-מסך, בסגנון "Cinematic Terminal" (metal-panel/glass), מוצג כש-ErrorBoundary
 * תופס שגיאה. רכיב פונקציונלי נפרד (לא ה-class עצמו) כי צריך גישה ל-useLanguage - class
 * components לא יכולים להשתמש ב-hooks, אז ה-fallback מורכב פה מרכיב פנימי רגיל. */
function ErrorFallback({ onReload }: { onReload: () => void }) {
  const { t } = useLanguage()
  return (
    <div className={styles.wrapper}>
      <div className={`${styles.dialog} metal-panel holo-edge count-in`}>
        <span className="eyebrow">TradePanel</span>
        <h1 className={`hero-title ${styles.title}`}>{t('errorBoundary.title')}</h1>
        <p className={styles.message}>{t('errorBoundary.message')}</p>
        <button type="button" className={styles.reload} onClick={onReload}>
          {t('errorBoundary.reload')}
        </button>
      </div>
    </div>
  )
}

/**
 * Error Boundary עליון סביב `<App>` (ר' `main.tsx`) - בלי זה, חריגה לא-תפוסה בזמן render
 * בכל רכיב מפילה את כל עץ ה-React למסך לבן ריק, בלי שום הודעה או דרך התאוששות. תופס
 * חריגות render (לא async/event handlers - React error boundaries לא מיועדים לזה), מדפיס
 * ל-console (אין עדיין שירות דיווח שגיאות חיצוני בפרויקט), ומציג מסך נפילה ידידותי עם
 * כפתור רענון. מוכרח להיות class component - זו הדרך היחידה לממש error boundary ב-React.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={this.handleReload} />
    }
    return this.props.children
  }
}
