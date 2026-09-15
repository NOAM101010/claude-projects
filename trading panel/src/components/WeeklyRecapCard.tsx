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
 * "Weekly Recap" - כרטיס Pro-only בדשבורד: סיכום 7 הימים האחרונים (טריידים סגורים, P&L נטו,
 * אחוז הצלחה, הטרייד הטוב/גרוע ביותר, השוואה לשבוע הקודם) - חישוב טהור מ-`weeklyRecap()`
 * ב-stats.ts, בלי backend חדש. ל-basic/demo מוצג טיזר מטושטש + כפתור שדרוג, אותו דפוס בדיוק
 * כמו ה-upgrade-hint הקיים (`WorkspaceSwitcher.tsx`/`Tools.tsx`'s `onOpenAccessCode`) - לא
 * מוסתר לגמרי, כדי שיראו מה הם מפסידים.
 *
 * שדרוג ויזואלי (feedback: "looks like just another stat card"): holo-edge--amber חם יותר
 * כדי שהכרטיס יזוהה כפיצ'ר דגל (צ'יפ "PRO" הוסר - מיותר כשמי שרואה את הגרסה הפתוחה כבר Pro,
 * ר' `weeklyRecapTitleLocked` לתיוג ה-Pro בגרסה הנעולה), ו-Net P&L מקבל משקל ויזואלי גדול
 * בהרבה מהסטטיסטיקות המשניות - אותו עיקרון בדיוק כמו StreakCard (`.value` גדול למעלה,
 * `.hint` דק למטה), רק עם שני מספרי-משנה (trades/win rate) לצד ה-P&L הראשי במקום שורת hint אחת.
 */
export function WeeklyRecapCard({ recap, baseCurrency, locale, tier, onOpenAccessCode }: WeeklyRecapCardProps) {
  const { t } = useLanguage()

  if (tier !== 'pro') {
    return (
      <div className={`${styles.card} metal-panel holo-edge holo-edge--amber`}>
        <h3 className="eyebrow">{t('dashboard.weeklyRecapTitleLocked')}</h3>
        <div className={styles.lockedTeaser} aria-hidden="true">
          <span className={`${styles.primaryValue} ${styles.positive}`}>{formatCurrency(842, baseCurrency, locale)}</span>
          <span className={styles.primaryLabel}>{t('dashboard.weeklyRecapNetPnl')}</span>
          <div className={styles.secondaryRow}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('dashboard.weeklyRecapTrades')}</span>
              <span className={styles.statValue}>5</span>
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
    <div className={`${styles.card} metal-panel holo-edge holo-edge--amber glass-hover`}>
      <div className={styles.header}>
        <h3 className="eyebrow">{t('dashboard.weeklyRecapTitle')}</h3>
      </div>

      <span className={`${styles.primaryValue} ${recap.netPnl >= 0 ? styles.positive : styles.negative}`}>
        {formatCurrency(recap.netPnl, baseCurrency, locale)}
      </span>
      <div className={styles.primaryLabelRow}>
        <span className={styles.primaryLabel}>{t('dashboard.weeklyRecapNetPnl')}</span>
        {recap.previousWeekNetPnl !== null && (
          <span className={`${styles.vsLastWeek} ${recap.netPnl >= recap.previousWeekNetPnl ? styles.positive : styles.negative}`}>
            {recap.netPnl >= recap.previousWeekNetPnl ? '▲' : '▼'}{' '}
            {t('dashboard.weeklyRecapVsLastWeek', {
              value: formatCurrency(Math.abs(recap.netPnl - recap.previousWeekNetPnl), baseCurrency, locale),
            })}
          </span>
        )}
      </div>

      <div className={styles.secondaryRow}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('dashboard.weeklyRecapTrades')}</span>
          <span className={styles.statValue}>{recap.tradeCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('dashboard.weeklyRecapWinRate')}</span>
          <span className={styles.statValue}>{recap.winRate.toFixed(0)}%</span>
        </div>
      </div>

      {recap.bestTrade ? (
        <>
          <p className={styles.bestTrade}>
            {t('dashboard.weeklyRecapBestTrade', {
              symbol: recap.bestTrade.symbol,
              pnl: formatCurrency(recap.bestTrade.pnl, baseCurrency, locale),
            })}
          </p>
          {recap.worstTrade && (
            <p className={styles.bestTrade}>
              {t('dashboard.weeklyRecapWorstTrade', {
                symbol: recap.worstTrade.symbol,
                pnl: formatCurrency(recap.worstTrade.pnl, baseCurrency, locale),
              })}
            </p>
          )}
        </>
      ) : (
        <p className={styles.bestTrade}>{t('dashboard.weeklyRecapNoTrades')}</p>
      )}
    </div>
  )
}
