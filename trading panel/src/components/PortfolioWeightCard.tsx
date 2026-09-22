import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency } from '../lib/format'
import { portfolioWeights } from '../lib/stats'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './PortfolioWeightCard.module.css'

interface PortfolioWeightCardProps {
  trades: Trade[]
  /** לא-null/לא-אפס בכל מקום שהכרטיס בפועל מוצג - `Dashboard.tsx` כבר מוודא
   * `totalPortfolioValue !== null` ושיש לפחות פוזיציה פתוחה אחת (ראה `showPortfolioWeight`). */
  totalPortfolioValue: number
  baseCurrency: CurrencyCode
  locale: string
}

/** פלטת גוונים מתחלפת ל-blocks (אותה מחזור צבעים כמו `card-portfolio-weight.html` כיוון 3). */
const BLOCK_GRADIENTS = [
  'linear-gradient(150deg, #e8b341, #b57a1f)',
  'linear-gradient(150deg, #d99a2b, #a06818)',
  'linear-gradient(150deg, #4ade80, #22c55e)',
  'linear-gradient(150deg, #22c55e, #16803f)',
  'linear-gradient(150deg, #7d7d86, #4a4a52)',
  'linear-gradient(150deg, #60a5fa, #2563eb)',
]

/**
 * "משקל תיק" (Long-term בלבד, חינם לכולם - special-design round, כיוון Treemap ב-
 * `card-portfolio-weight.html`) - % מהתיק שכל פוזיציה פתוחה תופסת, לפי `portfolioWeights`
 * (`entryPrice * quantity` חלקי שווי התיק הכולל שהוגדר ב-Settings). אותו דפוס כמו
 * `DailyRiskBudgetCard`/`DayTradeLimitCard`: לא Pro-gated, כלי מודעות-סיכון בזמן-אמת,
 * לא כרטיס "תובנה" היסטורית - ממוקם ב-Dashboard בנפרד מ-`.insightsGrid`.
 *
 * ה-treemap עצמו הוא קירוב "poor man's" באמצעות flexbox (לא squarified treemap אמיתי):
 * כל בלוק מקבל `flex-grow` פרופורציונלי למשקל שלו וגולש לשורה הבאה כשנגמר הרוחב - זה
 * נותן רושם ויזואלי של "ריבועים בגדלים יחסיים" בלי ספריית ויזואליזציה חדשה, ותומך במספר
 * פוזיציות משתנה (לא גריד קבוע 6x6 כמו במוקאפ שהיה מתוכנן לדוגמה קבועה של 5 פוזיציות).
 */
export function PortfolioWeightCard({ trades, totalPortfolioValue, baseCurrency, locale }: PortfolioWeightCardProps) {
  const { t } = useLanguage()
  const weights = portfolioWeights(trades, totalPortfolioValue)

  if (weights.length === 0) return null

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('dashboard.portfolioWeightTitle')}</h3>
        <span className={styles.totalValue}>{formatCurrency(totalPortfolioValue, baseCurrency, locale)}</span>
      </div>
      <div className={styles.treemap}>
        {weights.map((w, i) => (
          <div
            key={w.symbol}
            className={styles.block}
            style={{ flexGrow: Math.max(w.weightPercent, 1), background: BLOCK_GRADIENTS[i % BLOCK_GRADIENTS.length] }}
            title={`${w.symbol} · ${w.weightPercent.toFixed(1)}%`}
          >
            <span className={styles.blockSymbol}>{w.symbol}</span>
            <span className={styles.blockPct}>{w.weightPercent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
