import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { PrivacyPolicy } from './PrivacyPolicy'
import { TermsOfService } from './TermsOfService'
import styles from './Footer.module.css'

type LegalDoc = 'terms' | 'privacy' | null

/** הצהרה משפטית קבועה + קישורים לתנאי שימוש/מדיניות פרטיות - trading-journal-plan.md סעיף 9. */
export function Footer() {
  const { t } = useLanguage()
  const [openDoc, setOpenDoc] = useState<LegalDoc>(null)

  return (
    <footer className={styles.footer}>
      <div className="divider-glow" aria-hidden="true" />
      <p>{t('footer.disclaimer')}</p>
      <p className={styles.links}>
        <button type="button" className={styles.linkButton} onClick={() => setOpenDoc('terms')}>
          {t('footer.terms')}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className={styles.linkButton} onClick={() => setOpenDoc('privacy')}>
          {t('footer.privacy')}
        </button>
      </p>
      {openDoc === 'terms' && <TermsOfService onClose={() => setOpenDoc(null)} />}
      {openDoc === 'privacy' && <PrivacyPolicy onClose={() => setOpenDoc(null)} />}
    </footer>
  )
}
