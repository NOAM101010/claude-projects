import { STREAK_REWARD } from '@/data/economy';
import { useT } from '@/hooks/useT';
import { Tooltip } from './Tooltip';

/** Tier plating by streak length — bronze (1-3), silver (4-7), gold (8+). */
function tierOf(day: number): { line: string; text: string; bg: string } {
  if (day >= 8) return { line: 'var(--gold-line)', text: 'var(--gold)', bg: 'rgba(227,178,60,.10)' };
  if (day >= 4) return { line: 'rgba(192,199,208,.35)', text: '#c0c7d0', bg: 'rgba(192,199,208,.10)' };
  return { line: 'rgba(176,118,74,.35)', text: '#cf9367', bg: 'rgba(176,118,74,.12)' };
}

/** 🔥 N — the current login streak, shown even before today's claim. */
export function StreakBadge({ day }: { day: number }) {
  const { t } = useT();
  const nextTierAt = day < 4 ? 4 : day < 8 ? 8 : null;
  const hint = nextTierAt
    ? t('hub.streakNext', { day: nextTierAt, chips: STREAK_REWARD(nextTierAt) })
    : t('hub.streakMax');
  const tier = tierOf(day);

  return (
    <Tooltip label={t('hub.streakDay', { day })} hint={hint} side="bottom">
      <span
        className="streak-badge"
        style={{ borderColor: tier.line, background: tier.bg, color: tier.text }}
      >
        <span className="streak-badge__flame" aria-hidden>🔥</span>
        <b className="streak-badge__day num">{day}</b>
      </span>
    </Tooltip>
  );
}
