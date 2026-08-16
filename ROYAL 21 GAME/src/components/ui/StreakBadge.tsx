import { STREAK_REWARD } from '@/data/economy';
import { useT } from '@/hooks/useT';
import { Tooltip } from './Tooltip';

/** 🔥 N — the current login streak, shown even before today's claim. */
export function StreakBadge({ day }: { day: number }) {
  const { t } = useT();
  const nextTierAt = day < 4 ? 4 : day < 8 ? 8 : null;
  const hint = nextTierAt
    ? t('hub.streakNext', { day: nextTierAt, chips: STREAK_REWARD(nextTierAt) })
    : t('hub.streakMax');

  return (
    <Tooltip label={t('hub.streakDay', { day })} hint={hint} side="bottom">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold border border-white/10"
        style={{ background: 'rgba(227,178,60,.08)', color: 'var(--gold)' }}
      >
        🔥 {day}
      </span>
    </Tooltip>
  );
}
