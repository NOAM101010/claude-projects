import { useSettings } from '@/stores/useSettings';
import { isVipEligible, VIP_MIN_LEVEL, VIP_MIN_CHIPS } from '@/data/vip';
import { fmt } from '@/lib/format';
import { Tooltip } from './Tooltip';
import type { Profile } from '@/types';

/**
 * Single VIP badge — you either have it or you don't.
 *
 * The old bronze/silver/gold ladder is gone; the tag exists to gate access
 * to the VIP lounge and its tables, not to advertise increments. If the
 * player isn't eligible, this renders nothing at all — no half-VIP state.
 */
export function VipBadge({ profile }: { profile: Profile }) {
  const lang = useSettings((s) => s.lang);
  if (!isVipEligible(profile)) return null;

  const label = lang === 'he' ? 'VIP' : 'VIP';
  const hint = lang === 'he'
    ? `דרישות: רמה ${VIP_MIN_LEVEL}+ וגם ${fmt(VIP_MIN_CHIPS)} צ'יפים`
    : `Requires level ${VIP_MIN_LEVEL}+ and ${fmt(VIP_MIN_CHIPS)} chips`;

  return (
    <Tooltip label={label} hint={hint} side="bottom">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-[.12em]"
        style={{
          background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))',
          color: '#1a1206',
          boxShadow: '0 2px 8px rgba(227,178,60,.4)',
        }}
      >
        👑 VIP
      </span>
    </Tooltip>
  );
}
