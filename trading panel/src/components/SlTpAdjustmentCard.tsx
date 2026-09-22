import { useLanguage } from '../i18n/LanguageContext'
import { slTpAdjustmentStats } from '../lib/stats'
import type { SlTpHistoryEntry } from '../lib/slTpHistoryApi'
import type { Trade } from '../types/trade'
import styles from './SlTpAdjustmentCard.module.css'

interface SlTpAdjustmentCardProps {
  trades: Trade[]
  history: SlTpHistoryEntry[]
}

/**
 * "SL/TP Adjustments" - כרטיס insight בסיסי (בכוונה, ללא win-rate analysis בשלב הזה):
 * כמה טריידים סגורים עברו לפחות עדכון אחד ל-Stop Loss/Take Profit, ובאיזה כיוון ביחס
 * ל"ערך מקורי" (baseline - הרשומה הכי ישנה בהיסטוריה, ראה `slTpAdjustmentStats`
 * ב-stats.ts). כמו `LossSourceCard`/`SetupPerformanceCard` - `null` כשאין נתונים רלוונטיים
 * (אף טרייד סגור עם היסטוריית שינוי) במקום כרטיס ריק/"0 מכל דבר".
 */
export function SlTpAdjustmentCard({ trades, history }: SlTpAdjustmentCardProps) {
  const { t } = useLanguage()
  const stats = slTpAdjustmentStats(trades, history)

  if (stats.adjustedTradesCount === 0) return null

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <h3 className={styles.title}>{t('dashboard.slTpAdjustmentTitle')}</h3>
      <p className={styles.summary}>{t('dashboard.slTpAdjustmentSummary', { count: stats.adjustedTradesCount })}</p>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t('dashboard.slTpAdjustmentStopLoss')}</span>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipWidened}`}>
              {t('dashboard.slTpAdjustmentWidened')} · {stats.stopLoss.widened}
            </span>
            <span className={`${styles.chip} ${styles.chipTightened}`}>
              {t('dashboard.slTpAdjustmentTightened')} · {stats.stopLoss.tightened}
            </span>
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t('dashboard.slTpAdjustmentTakeProfit')}</span>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipWidened}`}>
              {t('dashboard.slTpAdjustmentWidened')} · {stats.takeProfit.widened}
            </span>
            <span className={`${styles.chip} ${styles.chipTightened}`}>
              {t('dashboard.slTpAdjustmentTightened')} · {stats.takeProfit.tightened}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
