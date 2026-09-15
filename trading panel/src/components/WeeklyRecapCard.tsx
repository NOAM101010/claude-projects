import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { formatCurrency } from '../lib/format'
import type { WeeklyRecap } from '../lib/stats'
import type { CurrencyCode } from '../types/trade'
import styles from './WeeklyRecapCard.module.css'

interface WeeklyRecapCardProps {
  recap: WeeklyRecap
  baseCurrency: CurrencyCode
  locale: string
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - אותו מנגנון בדיוק כמו שאר תכני ה-Pro-lock באפליקציה (ר' WorkspaceSwitcher/Tools). */
  onOpenAccessCode: () => void
}

/**
 * "Weekly Recap" - כרטיס Pro-only בדשבורד: סיכום 7 הימים האחרונים (טריידים סגורים,
 * P&L נטו, אחוז הצלחה, הטרייד הטוב ביותר) - חישוב טהור מ-`weeklyRecap()` ב-stats.ts,
 * בלי backend חדש. ל-basic/demo מוצג טיזר מטושטש + כפתור שדרוג, אותו דפוס בדיוק כמו
 * ה-upgrade-hint הקיים (`WorkspaceSwitcher.tsx`/`Tools.tsx`'s `onOpenAccessCode`) - לא
 * מוסתר לגמרי, כדי שיראו מה הם מפסידים.
 */
export function WeeklyRecapCard({ recap, baseCurrency, locale, tier, onOpenAccessCode }: WeeklyRecapCardProps) {
  const { t } = useLanguage()

  if (tier !== 'pro') {
    return (
      <div className={`${styles.card} metal-panel holo-edge`}>
        <h3 className="eyebrow">{t('dashboard.weeklyRecapTitleLocked')}</h3>
        <div className={styles.lockedTeaser} aria-hidden="true">
          <div className={styles.grid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('dashboard.weeklyRecapTrades')}</span>
              <span className={styles.statValue}>5</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('dashboard.weeklyRecapNetPnl')}</span>
              <span className={`${styles.statValue} ${styles.positive}`}>{formatCurrency(842, baseCurrency, locale)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('dashboard.weeklyRecapWinRate')}</span>
              <span className={styles.statValue}>60%</span>
            </div>
          </div>
        </div>
        <p className={styles.upgradeHint}>
          {t('dashboard.weeklyRecapLocked')}{' '}
          <button type="button" onClick={onOpenAccessCode}>
            {t('access.enterCode')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className={`${styles.card} metal-panel holo-edge`}>
      <h3 className="eyebrow">{t('dashboard.weeklyRecapTitle')}</h3>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('dashboard.weeklyRecapTrades')}</span>
          <span className={styles.statValue}>{recap.tradeCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('dashboard.weeklyRecapNetPnl')}</span>
          <span className={`${styles.statValue} ${recap.netPnl >= 0 ? styles.positive : styles.negative}`}>
            {formatCurrency(recap.netPnl, baseCurrency, locale)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('dashboard.weeklyRecapWinRate')}</span>
          <span className={styles.statValue}>{recap.winRate.toFixed(0)}%</span>
        </div>
      </div>
      {recap.bestTrade ? (
        <p className={styles.bestTrade}>
          {t('dashboard.weeklyRecapBestTrade', {
            symbol: recap.bestTrade.symbol,
            pnl: formatCurrency(recap.bestTrade.pnl, baseCurrency, locale),
          })}
        </p>
      ) : (
        <p className={styles.bestTrade}>{t('dashboard.weeklyRecapNoTrades')}</p>
      )}
    </div>
  )
}
