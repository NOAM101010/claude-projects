import { useSettings } from '@/stores/useSettings';
import { isVipEligible, vipTier, vipTierName, VIP_MIN_LEVEL } from '@/data/vip';
import { Tooltip } from './Tooltip';
import type { Profile } from '@/types';

/** Colour per VIP tier — bronze / silver / gold / diamond. */
const TIER_STYLE: Record<1 | 2 | 3 | 4, { grad: string; fg: string }> = {
  1: { grad: 'linear-gradient(90deg,#a9713f,#d69a63)', fg: '#1a1206' },
  2: { grad: 'linear-gradient(90deg,#9aa6b4,#dfe7f0)', fg: '#12161c' },
  3: { grad: 'linear-gradient(90deg,var(--gold),var(--gold-hi))', fg: '#1a1206' },
  4: { grad: 'linear-gradient(90deg,#5fd0e3,#b7f0f8)', fg: '#062028' },
};

/**
 * VIP badge — shows the player's current VIP tier, not a binary flag.
 * Renders nothing below level 5.
 */
export function VipBadge({ profile }: { profile: Profile }) {
  const lang = useSettings((s) => s.lang);
  if (!isVipEligible(profile)) return null;

  const tier = vipTier(profile.level) as 1 | 2 | 3 | 4;
  const name = vipTierName(tier);
  const style = TIER_STYLE[tier];
  const hint = lang === 'he'
    ? `דרגת VIP: ${name} · נפתח מרמה ${VIP_MIN_LEVEL}`
    : `VIP tier: ${name} · unlocks at level ${VIP_MIN_LEVEL}`;

  return (
    <Tooltip label={`VIP ${name}`} hint={hint} side="bottom">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-[.12em]"
        style={{ background: style.grad, color: style.fg, boxShadow: '0 2px 8px rgba(0,0,0,.35)' }}
      >
        👑 {name.toUpperCase()}
      </span>
    </Tooltip>
  );
}
