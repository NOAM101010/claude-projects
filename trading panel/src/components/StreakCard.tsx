import { useLanguage } from '../i18n/LanguageContext'
import type { StreakInfo } from '../lib/stats'
import styles from './StreakCard.module.css'

interface StreakCardProps {
  streakInfo: StreakInfo
  /** 'lg' = גרסת "באנר" רוחב-מלא לקבוצת ה-KPI ההתנהגותית ב-Dashboard - הרצף הנוכחי הוא
   * המספר הכי "סיפורי" בקבוצה, הוא זוכה למקום/משקל גדול יותר משאר הכרטיסים היבשים. */
  size?: 'default' | 'lg'
}

/**
 * שדרוג ויזואלי לכרטיס "Current Streak" הקיים ב-Dashboard (לוגיקה כבר קיימת ב-`streaks()`
 * ב-stats.ts, לא נבנתה כאן מחדש) - אייקון 🔥, מספר/סוג גדול בגופן serif, שורת עזר עם
 * הרצפים הארוכים ביותר.
 */
export function StreakCard({ streakInfo, size = 'default' }: StreakCardProps) {
  const { t } = useLanguage()
  const { current, longestWin, longestLoss } = streakInfo
  const hasStreak = current.type !== 'none' && current.count > 0
  const isWin = current.type === 'win'
  // 🔥 "hot streak" only fits wins - a losing streak isn't something to celebrate, so it
  // gets ❄️ "cold streak" instead (the natural opposite pairing, not a fabricated icon).
  const icon = hasStreak ? (isWin ? '🔥' : '❄️') : '⏸️'
  const valueNode = hasStreak ? (
    <span className={`${styles.value} ${isWin ? styles.positive : styles.negative}`}>
      {t(isWin ? 'dashboard.streakWins' : 'dashboard.streakLosses', { count: current.count })}
    </span>
  ) : (
    <span className={styles.valueNone}>{t('dashboard.streakCardNone')}</span>
  )

  if (size === 'lg') {
    return (
      <div className={`${styles.card} ${styles.cardLg} metal-panel holo-edge holo-edge--amber glass-hover`}>
        <span className={`${styles.flame} ${styles.flameLg} ${hasStreak ? (isWin ? styles.flameWin : styles.flameLoss) : styles.flameNone}`}>
          {icon}
        </span>
        <div className={styles.lgMain}>
          <span className={styles.label}>{t('dashboard.kpiCurrentStreak')}</span>
          {valueNode}
        </div>
        <span className={`${styles.hint} ${styles.hintLg}`}>{t('dashboard.streakCardHint', { win: longestWin, loss: longestLoss })}</span>
      </div>
    )
  }

  return (
    <div className={`${styles.card} metal-panel holo-edge glass-hover`}>
      <div className={styles.top}>
        <span className={`${styles.flame} ${hasStreak ? (isWin ? styles.flameWin : styles.flameLoss) : styles.flameNone}`}>{icon}</span>
        <span className={styles.label}>{t('dashboard.kpiCurrentStreak')}</span>
      </div>

      {valueNode}

      <span className={styles.hint}>{t('dashboard.streakCardHint', { win: longestWin, loss: longestLoss })}</span>
    </div>
  )
}
