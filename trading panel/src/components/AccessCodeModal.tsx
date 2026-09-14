import type { FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useRedeemCode } from '../hooks/useRedeemCode'
import type { RedeemResult } from '../hooks/useRedeemCode'
import styles from './AccessCodeModal.module.css'

interface AccessCodeModalProps {
  /** הודעת הקשר אופציונלית שמסבירה למה המודל נפתח (למשל מגבלת workspaces/שדרוג Pro). */
  contextHint?: string | null
  onRedeemed: (result: RedeemResult) => void
  onClose: () => void
}

/**
 * מודל להזנת קוד גישה (Basic/Pro) - הלוגיקה עצמה ב-`useRedeemCode` (משותפת עם
 * `AccessCodeGate`). בהצלחה מעביר את ה-session/tier החדשים למעלה (App.tsx אחראי
 * לרענן את כל המצב בלי reload מלא, כי redeem עשוי "להעביר" את המשתמש לחשבון קבוע
 * אחר עם workspaces משלו).
 */
export function AccessCodeModal({ contextHint, onRedeemed, onClose }: AccessCodeModalProps) {
  const { t } = useLanguage()
  const { code, setCode, submitting, error, success, submit } = useRedeemCode()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(onRedeemed)
  }

  return (
    <div className={`${styles.overlay} modal-overlay-in`} role="dialog" aria-modal="true">
      <form className={`${styles.dialog} metal-panel holo-edge holo-edge--amber modal-panel-in`} onSubmit={handleSubmit}>
        <h2>{t('accessCode.title')}</h2>
        {contextHint && <p className={styles.contextHint}>{contextHint}</p>}
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
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={submitting || success}>
            {submitting ? t('accessCode.checking') : t('accessCode.confirm')}
          </button>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
