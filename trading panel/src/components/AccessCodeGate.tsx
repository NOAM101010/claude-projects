import type { FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useRedeemCode } from '../hooks/useRedeemCode'
import type { RedeemResult } from '../hooks/useRedeemCode'
import { markCodeVerified } from '../lib/session'
import { AnimatedBackground } from './AnimatedBackground'
import { StaticCandleBackground } from './StaticCandleBackground'
import styles from './AccessCodeGate.module.css'

interface AccessCodeGateProps {
  onVerified: (result: RedeemResult) => void | Promise<void>
}

/**
 * שער כניסה מלא-מסך: קוד גישה חובה לפני הכניסה לאפליקציה (ראה `src/config/locks.ts`
 * REQUIRE_ACCESS_CODE_GATE, `App.tsx`). מוצג מעל `AnimatedBackground` דקורטיבי - שדה
 * הקלט וכפתור האישור אינטראקטיביים מהפריים הראשון, האנימציה לא חוסמת קלט ולא
 * "חותכת" למסך ריק. בהצלחה שומר את דגל האימות ב-localStorage לצמיתות על המכשיר הזה.
 */
export function AccessCodeGate({ onVerified }: AccessCodeGateProps) {
  const { t } = useLanguage()
  const { code, setCode, submitting, error, success, submit } = useRedeemCode()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(async (result) => {
      markCodeVerified()
      await onVerified(result)
    })
  }

  return (
    <div className={styles.wrapper}>
      <StaticCandleBackground className={styles.candles} />
      <AnimatedBackground className={styles.background} />
      <form className={`${styles.dialog} metal-panel holo-edge holo-edge--amber det-frame count-in`} onSubmit={handleSubmit}>
        <span className={`eyebrow ${styles.eyebrow}`}>TradePanel</span>
        <h1 className={`hero-title ${styles.title}`}>{t('accessCode.title')}</h1>
        <p className={styles.hint}>{t('accessCode.hint')}</p>
        <input
          className={styles.input}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('accessCode.placeholder')}
          autoFocus
          disabled={submitting || success}
        />
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{t('accessCode.success')}</p>}
        <button type="submit" className={styles.submit} disabled={submitting || success}>
          {submitting ? t('accessCode.checking') : success ? t('accessCode.success') : t('accessCode.confirm')}
        </button>
      </form>
    </div>
  )
}
