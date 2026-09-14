import { useLanguage } from '../i18n/LanguageContext'
import styles from './LegalModal.module.css'

interface PrivacyPolicyProps {
  onClose: () => void
}

/**
 * מדיניות פרטיות - בסיס בלבד, לא ייעוץ משפטי מקצועי (trading-journal-plan.md סעיף 9,
 * כולל התייחסות ל-GDPR: איפה הדאטה מאוחסנת + זכות מחיקה). מוצג כ-overlay פשוט
 * (בהשראת AccessCodeModal), נגיש דרך קישור ב-Footer.
 */
export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  const { t } = useLanguage()
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${styles.dialog} metal-panel holo-edge`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{t('privacy.title')}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <p className={styles.disclaimer}>{t('privacy.disclaimer')}</p>

        <div className={styles.content}>
          <h3>{t('privacy.dataTitle')}</h3>
          <p>{t('privacy.dataText')}</p>

          <h3>{t('privacy.storageTitle')}</h3>
          <p>{t('privacy.storageText')}</p>

          <h3>{t('privacy.securityTitle')}</h3>
          <p>{t('privacy.securityText')}</p>

          <h3>{t('privacy.deleteTitle')}</h3>
          <p>{t('privacy.deleteText')}</p>

          <h3>{t('privacy.contactTitle')}</h3>
          <p>{t('privacy.contactText')}</p>
        </div>
      </div>
    </div>
  )
}
