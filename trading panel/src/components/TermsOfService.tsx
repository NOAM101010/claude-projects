import { useLanguage } from '../i18n/LanguageContext'
import styles from './LegalModal.module.css'

interface TermsOfServiceProps {
  onClose: () => void
}

/**
 * תנאי שימוש - בסיס בלבד, לא ייעוץ משפטי מקצועי (trading-journal-plan.md סעיף 9).
 * מוצג כ-overlay פשוט (בהשראת AccessCodeModal), נגיש דרך קישור ב-Footer.
 */
export function TermsOfService({ onClose }: TermsOfServiceProps) {
  const { t } = useLanguage()
  return (
    <div className={`${styles.overlay} modal-overlay-in`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${styles.dialog} metal-panel holo-edge modal-panel-in`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{t('terms.title')}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <p className={styles.disclaimer}>{t('terms.disclaimer')}</p>

        <div className={styles.content}>
          <h3>{t('terms.whatTitle')}</h3>
          <p>{t('terms.whatText')}</p>

          <h3>{t('terms.notTitle')}</h3>
          <p>{t('terms.notText')}</p>

          <h3>{t('terms.consentTitle')}</h3>
          <p>{t('terms.consentText')}</p>

          <h3>{t('terms.responsibilityTitle')}</h3>
          <p>{t('terms.responsibilityText')}</p>

          <h3>{t('terms.contactTitle')}</h3>
          <p>{t('terms.contactText')}</p>
        </div>
      </div>
    </div>
  )
}
