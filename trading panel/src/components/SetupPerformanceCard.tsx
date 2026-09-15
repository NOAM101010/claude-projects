import type { CSSProperties } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { formatCurrency } from '../lib/format'
import { rankedSetupPerformance } from '../lib/stats'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './SetupPerformanceCard.module.css'

interface SetupPerformanceCardProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  locale: string
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - אותו מנגנון בדיוק כמו `WeeklyRecapCard`/שאר ה-Pro-lock באפליקציה. */
  onOpenAccessCode: () => void
}

/**
 * "Setup Performance" (Pro) - דירוג setups לפי P&L מצטבר, בונה על `rankedSetupPerformance`
 * ב-stats.ts (שקוראת ל-`statsBySetup` הקיים בלי לשכפל אותו, ומסננת החוצה את "No setup" ו-
 * setups עם פחות מ-3 טריידים סגורים כרעש). דורש לפחות 2 setups אמיתיים שעומדים בקריטריונים -
 * פחות מזה (feedback: setup בודד, או הכל תחת "No setup", זה לא "דירוג" - סתם חזרה על
 * סטטיסטיקת כל החשבון) והכרטיס כולו לא מוצג (`null`), לא טבלה עם שורה אחת. ה"By Setup" table
 * המקורית הוסרה מה-Dashboard בעבר (ר' progress.md) - זו לא חזרה שלה אלא ויזואליזציה חדשה
 * (בארים מדורגים באנימציית קסקדה, לא טבלה).
 */
export function SetupPerformanceCard({ trades, baseCurrency, locale, tier, onOpenAccessCode }: SetupPerformanceCardProps) {
  const { t } = useLanguage()

  if (tier !== 'pro') {
    return (
      <div className={`${styles.card} metal-panel holo-edge holo-edge--amber`}>
        <h3 className={styles.title}>{t('dashboard.setupPerformanceTitleLocked')}</h3>
        <div className={styles.lockedTeaser} aria-hidden="true">
          {[100, 72, 45].map((width, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.rowLabel}>{t('dashboard.setupPerformanceTeaserSetup', { n: i + 1 })}</span>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${styles.barFillPos}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.upgradeHint}>
          {t('dashboard.setupPerformanceLocked')}{' '}
          <button type="button" onClick={onOpenAccessCode}>
            {t('access.enterCode')}
          </button>
        </p>
      </div>
    )
  }

  const ranked = rankedSetupPerformance(trades)

  if (ranked.length === 0) return null

  const maxAbsPnl = Math.max(...ranked.map((r) => Math.abs(r.pnl)), 1)

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <h3 className={styles.title}>{t('dashboard.setupPerformanceTitle')}</h3>
      <div className={styles.rows}>
        {ranked.map((setup, i) => {
          const positive = setup.pnl >= 0
          const widthPercent = (Math.abs(setup.pnl) / maxAbsPnl) * 100
          return (
            <div key={setup.key} className={styles.row} style={{ '--row-index': i } as CSSProperties}>
              <div className={styles.rowHeader}>
                <span className={styles.rowLabel}>{setup.key}</span>
                <span className={`${styles.rowPnl} ${positive ? styles.positive : styles.negative}`}>
                  {formatCurrency(setup.pnl, baseCurrency, locale)}
                </span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${positive ? styles.barFillPos : styles.barFillNeg}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <span className={styles.rowMeta}>
                {t('dashboard.setupPerformanceRowMeta', { trades: setup.trades, winRate: setup.winRate.toFixed(0) })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
