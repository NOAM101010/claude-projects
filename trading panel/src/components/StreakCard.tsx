import { useId } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { StreakInfo } from '../lib/stats'
import styles from './StreakCard.module.css'

interface StreakCardProps {
  streakInfo: StreakInfo
  /** 'lg' = גרסת "באנר" רוחב-מלא לקבוצת ה-KPI ההתנהגותית ב-Dashboard - הרצף הנוכחי הוא
   * המספר הכי "סיפורי" בקבוצה, הוא זוכה למקום/משקל גדול יותר משאר הכרטיסים היבשים. */
  size?: 'default' | 'lg'
}

/** תקרת תצוגה של המד - רצף ארוך מ-12 ממלא את המד לגמרי (לא נמדד עד אינסוף). */
const GAUGE_CEILING = 12
/** גבולות ה-y האנכיים של שני ה-SVG paths (viewBox 0 0 W 60) - קצה עליון וקצה תחתון. */
const GAUGE_TOP_Y = 2
const GAUGE_BOTTOM_Y = 58

/**
 * מד-להבה/קרח SVG (לא אימוג'י) שממלא לפי אורך הרצף הנוכחי, יחסית ל-`GAUGE_CEILING`.
 * עקרון טונלי קבוע מה-progress.md: רצף-הפסדים מקבל **צורה שונה לגמרי** (קריסטל-קרח מחודד),
 * לא רק גרסה כחולה של הלהבה - לא לחגוג ויזואלית הפסד. מצב "אין רצף" מציג רק את קו המתאר.
 */
function FlameIceGauge({ isWin, ratio, filled, size }: { isWin: boolean; ratio: number; filled: boolean; size: 'default' | 'lg' }) {
  const clipId = useId()
  const clipY = GAUGE_BOTTOM_Y - (GAUGE_BOTTOM_Y - GAUGE_TOP_Y) * ratio
  const clipHeight = GAUGE_BOTTOM_Y - clipY
  const width = size === 'lg' ? (isWin ? 40 : 35) : (isWin ? 32 : 28)
  const height = size === 'lg' ? 52 : 42

  if (isWin) {
    return (
      <svg className={styles.gaugeSvg} width={width} height={height} viewBox="0 0 46 60" aria-hidden="true">
        <path
          d="M23 2c3 7-4 10-4 16 0 4 3 6 6 6 4 0 6-3 6-7 4 4 6 9 6 14 0 10-8 17-18 17S1 41 1 31c0-9 6-14 9-20 1 5 3 7 5 7 3 0-1-9 8-16z"
          fill="none"
          stroke="rgba(var(--overlay-tint), 0.16)"
          strokeWidth="1.4"
        />
        {filled && (
          <g>
            <defs>
              <linearGradient id={clipId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
              <clipPath id={`${clipId}-rect`}>
                <rect x="0" y={clipY} width="46" height={clipHeight} />
              </clipPath>
            </defs>
            <path
              d="M23 2c3 7-4 10-4 16 0 4 3 6 6 6 4 0 6-3 6-7 4 4 6 9 6 14 0 10-8 17-18 17S1 41 1 31c0-9 6-14 9-20 1 5 3 7 5 7 3 0-1-9 8-16z"
              fill={`url(#${clipId})`}
              clipPath={`url(#${clipId}-rect)`}
            />
          </g>
        )}
      </svg>
    )
  }

  return (
    <svg className={styles.gaugeSvg} width={width} height={height} viewBox="0 0 40 60" aria-hidden="true">
      <path
        d="M20 2 L26 20 L36 24 L24 30 L20 58 L16 30 L4 24 L14 20 Z"
        fill="none"
        stroke="rgba(var(--overlay-tint), 0.16)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {filled && (
        <g>
          <defs>
            <linearGradient id={clipId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--cold)" />
              <stop offset="100%" stopColor="var(--cold-2)" />
            </linearGradient>
            <clipPath id={`${clipId}-rect`}>
              <rect x="0" y={clipY} width="40" height={clipHeight} />
            </clipPath>
          </defs>
          <path d="M20 2 L26 20 L36 24 L24 30 L20 58 L16 30 L4 24 L14 20 Z" fill={`url(#${clipId})`} clipPath={`url(#${clipId}-rect)`} />
        </g>
      )}
    </svg>
  )
}

/**
 * שדרוג ויזואלי לכרטיס "Current Streak" הקיים ב-Dashboard (לוגיקה כבר קיימת ב-`streaks()`
 * ב-stats.ts, לא נבנתה כאן מחדש) - מד-להבה/קרח SVG שממלא לפי אורך הרצף במקום אימוג'י, מספר/סוג
 * גדול בגופן serif, שורת עזר עם הרצפים הארוכים ביותר.
 */
export function StreakCard({ streakInfo, size = 'default' }: StreakCardProps) {
  const { t } = useLanguage()
  const { current, longestWin, longestLoss } = streakInfo
  const hasStreak = current.type !== 'none' && current.count > 0
  const isWin = current.type === 'win'
  const ratio = hasStreak ? Math.min(current.count / GAUGE_CEILING, 1) : 0
  const valueNode = hasStreak ? (
    <span className={`${styles.value} ${isWin ? styles.positive : styles.negative}`}>
      {t(isWin ? 'dashboard.streakWins' : 'dashboard.streakLosses', { count: current.count })}
    </span>
  ) : (
    <span className={styles.valueNone}>{t('dashboard.streakCardNone')}</span>
  )
  const gauge = <FlameIceGauge isWin={hasStreak ? isWin : true} ratio={ratio} filled={hasStreak} size={size} />

  if (size === 'lg') {
    return (
      <div
        className={`${styles.card} ${styles.cardLg} metal-panel holo-edge ${hasStreak && !isWin ? 'holo-edge--cold' : 'holo-edge--amber'} glass-hover`}
      >
        <span className={styles.gaugeWrap}>{gauge}</span>
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
        <span className={styles.gaugeWrap}>{gauge}</span>
        <div className={styles.topMain}>
          <span className={styles.label}>{t('dashboard.kpiCurrentStreak')}</span>
          {valueNode}
        </div>
      </div>

      <span className={styles.hint}>{t('dashboard.streakCardHint', { win: longestWin, loss: longestLoss })}</span>
    </div>
  )
}
