import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export type EmptyStateIllustration = 'candle' | 'calendar' | 'target'

interface EmptyStateProps {
  /** SVG line-art matching the screen's own subject - chosen per call site, not decorative-only. */
  illustration: EmptyStateIllustration
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
  className?: string
}

function CandleIllustration() {
  return (
    <svg width="54" height="72" viewBox="0 0 54 72" fill="none" aria-hidden="true">
      <line x1="27" y1="4" x2="27" y2="18" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" className={styles.flickerLine} />
      <rect x="14" y="18" width="26" height="34" rx="3" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" />
      <line x1="27" y1="52" x2="27" y2="66" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" className={styles.flickerLine} />
      <circle cx="27" cy="4" r="3" fill="var(--accent-2)" className={styles.glowDot} />
    </svg>
  )
}

function CalendarIllustration() {
  return (
    <svg width="76" height="66" viewBox="0 0 76 66" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="70" height="53" rx="6" stroke="rgba(var(--overlay-tint), 0.5)" strokeWidth="1.4" />
      <line x1="3" y1="24" x2="73" y2="24" stroke="rgba(var(--overlay-tint), 0.35)" strokeWidth="1.2" />
      <line x1="17" y1="4" x2="17" y2="14" stroke="rgba(var(--overlay-tint), 0.5)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="59" y1="4" x2="59" y2="14" stroke="rgba(var(--overlay-tint), 0.5)" strokeWidth="1.4" strokeLinecap="round" />
      <g stroke="rgba(var(--overlay-tint), 0.3)" strokeWidth="1">
        <line x1="17" y1="24" x2="17" y2="63" />
        <line x1="31" y1="24" x2="31" y2="63" />
        <line x1="45" y1="24" x2="45" y2="63" />
        <line x1="59" y1="24" x2="59" y2="63" />
        <line x1="3" y1="37" x2="73" y2="37" />
        <line x1="3" y1="50" x2="73" y2="50" />
      </g>
      <circle cx="38" cy="43.5" r="3.2" fill="var(--accent-2)" className={`${styles.glowDot} ${styles.glowDotB}`} />
    </svg>
  )
}

function TargetIllustration() {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" fill="none" aria-hidden="true">
      <circle cx="35" cy="35" r="27" stroke="rgba(var(--overlay-tint), 0.4)" strokeWidth="1.2" />
      <circle cx="35" cy="35" r="17" stroke="rgba(var(--overlay-tint), 0.5)" strokeWidth="1.2" />
      <line x1="35" y1="2" x2="35" y2="14" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" className={styles.flickerLine} />
      <line x1="35" y1="56" x2="35" y2="68" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" className={styles.flickerLine} />
      <line x1="2" y1="35" x2="14" y2="35" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" />
      <line x1="56" y1="35" x2="68" y2="35" stroke="rgba(var(--overlay-tint), 0.55)" strokeWidth="1.4" />
      <circle cx="35" cy="35" r="3.4" fill="var(--accent-2)" className={styles.glowDot} />
    </svg>
  )
}

const ILLUSTRATIONS: Record<EmptyStateIllustration, ReactNode> = {
  candle: <CandleIllustration />,
  calendar: <CalendarIllustration />,
  target: <TargetIllustration />,
}

/**
 * תבנית-בסיס גנרית למסך/כרטיס ריק, משותפת לכל האפליקציה (Open Positions / Journal /
 * Calendar וכו') - שלד קבוע (metal-panel/holo-edge/count-in + איור SVG line-art דועך עם
 * נקודת-מוקד פועמת עדינה + כותרת + הסבר), תוכן משתנה לפי הקשר. כיוון 1 מ-
 * `design-explore/empty-states-directions.html`, מאושר. אין דאטה מומצאת - האיור עצמו הוא
 * chrome דקורטיבי בלבד, לא מספרים/טיקר.
 */
export function EmptyState({ illustration, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={`${styles.shell} metal-panel holo-edge count-in ${className ?? ''}`}>
      <div className={styles.illo}>{ILLUSTRATIONS[illustration]}</div>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
