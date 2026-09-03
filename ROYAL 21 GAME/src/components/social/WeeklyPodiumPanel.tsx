import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useUI } from '@/stores/useUI';
import { useSocial } from '@/stores/useSocial';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { isRemoteId } from '@/services/supabase';
import { friendsService } from '@/services/friendsService';
import { analytics } from '@/services/analyticsService';
import { WEEKLY_PODIUM } from '@/data/economy';
import { fmt } from '@/lib/format';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Next weekly reset — Sunday 00:00 UTC. */
function nextWeeklyReset(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilSunday = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return d;
}

/**
 * The weekly friends podium as a live table. Rows are the player plus every
 * friend, sorted by current chip balance — the same feed
 * (`friendsService.subscribe` → `useSocial.friends`) that powers presence keeps
 * this current, so a friend's balance change re-sorts the table with no extra
 * wiring. The prize is claimed opportunistically on open via `claim_weekly_prize`.
 */
export function WeeklyPodiumPanel() {
  const panel = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const toast = useUI((s) => s.toast);
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const friends = useSocial((s) => s.friends);
  const open = panel === 'weeklyPodium';

  const rows = useMemo(() => {
    const all = [
      { id: profile.id, username: t('leaderboard.you'), chips: profile.chips, self: true },
      ...friends.map((f) => ({ id: f.id, username: f.username, chips: f.chips, self: false })),
    ];
    all.sort((a, b) => b.chips - a.chips);
    return all;
  }, [friends, profile.id, profile.chips, t]);

  const myRank = rows.findIndex((r) => r.self) + 1;

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [open]);

  const resetLabel = useMemo(() => {
    const ms = nextWeeklyReset().getTime() - nowTick;
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    return days > 0 ? t('podium.resetDays', { days, hours }) : t('podium.resetHours', { hours });
  }, [t, nowTick]);

  useEffect(() => {
    if (!open || !isRemoteId(profile.id)) return;
    void friendsService.captureWeeklySnapshot();
    void friendsService.claimWeeklyPrize(profile.id).then((result) => {
      if (result.claimed && result.chips) {
        addChips(result.chips, { silent: true });
        toast(t('friends.weeklyPodium', { rank: result.rank ?? 1, amount: fmt(result.chips) }), 'good', '🏆');
        analytics.track('weekly_prize', { rank: result.rank ?? 1, chips: result.chips });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile.id]);

  return (
    <Modal
      open={open}
      onClose={() => openPanel(null)}
      title={t('hub.weeklyPodium')}
      subtitle={t('podium.subtitle', {
        first: fmt(WEEKLY_PODIUM[0]), second: fmt(WEEKLY_PODIUM[1]), third: fmt(WEEKLY_PODIUM[2]),
      })}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--muted)' }}>
          <span>{rows.length > 1 ? t('podium.yourRank', { rank: myRank, field: rows.length }) : t('hub.podiumNoFriends')}</span>
          <span>{resetLabel}</span>
        </div>
        {rows.map((r, i) => {
          const prize = i < 3 ? WEEKLY_PODIUM[i] : 0;
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-[var(--r-sm)] border border-white/[0.07]"
              style={{ background: r.self ? 'rgba(227,178,60,.10)' : i < 3 ? 'rgba(255,255,255,.04)' : 'transparent' }}
            >
              <span className="w-6 text-center text-[16px] num">{i < 3 ? MEDALS[i] : i + 1}</span>
              <span className="flex-1 text-[13.5px] font-semibold">{r.username}</span>
              <span className="num text-[13px]" style={{ color: 'var(--gold-hi)' }}>{fmt(r.chips)}</span>
              {prize > 0 && (
                <span className="num text-[11.5px]" style={{ color: 'var(--jade-hi)' }}>+{fmt(prize)}</span>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
