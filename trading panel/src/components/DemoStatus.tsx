import { useLanguage } from '../i18n/LanguageContext'
import { DEMO_TRADE_LIMIT } from '../lib/accountApi'
import styles from './DemoStatus.module.css'

interface DemoBannerProps {
  tradeCount: number
  onOpenAccessCode: () => void
}

/**
 * באנר קבוע ולא-פולשני לחשבונות דמו: מראה כמה טריידים נשארו מתוך המגבלה, עם כפתור
 * שפותח את מודל קוד הגישה בכל שלב (גם לפני שנגמרה המכסה, למי שכבר קנה).
 */
export function DemoBanner({ tradeCount, onOpenAccessCode }: DemoBannerProps) {
  const { t } = useLanguage()
  const remaining = Math.max(0, DEMO_TRADE_LIMIT - tradeCount)
  return (
    <div className={`${styles.banner} glass-blur`}>
      <span className={styles.text}>
        <span className={styles.dot} aria-hidden="true" />
        {t('demo.bannerPrefix')}{' '}
        <strong className={`${styles.chip} num`}>{t('demo.bannerUsed', { count: tradeCount, limit: DEMO_TRADE_LIMIT })}</strong>
        {remaining > 0 ? t('demo.bannerRemaining', { remaining }) : ''}
      </span>
      <button type="button" className={styles.cta} onClick={onOpenAccessCode}>
        {t('demo.enterCodeButton')}
      </button>
    </div>
  )
}

interface DemoLimitBlockProps {
  onOpenAccessCode: () => void
  onCancel: () => void
}

/** מוצג במקום טופס הוספת טרייד כשחשבון דמו הגיע למגבלת 5 הטריידים החינמיים. */
export function DemoLimitBlock({ onOpenAccessCode, onCancel }: DemoLimitBlockProps) {
  const { t } = useLanguage()
  return (
    <div className={`${styles.block} metal-panel holo-edge holo-edge--amber count-in`}>
      <h2>{t('demo.limitTitle')}</h2>
      <p>{t('demo.limitText', { limit: DEMO_TRADE_LIMIT })}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onOpenAccessCode}>
          {t('demo.enterCodeCta')}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
