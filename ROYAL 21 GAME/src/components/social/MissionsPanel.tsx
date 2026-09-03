import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { Meter } from '@/components/ui/Meter';
import { useUI } from '@/stores/useUI';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { useAppConfig } from '@/hooks/useAppConfig';
import { todayKey, fmt } from '@/lib/format';
import {
  dailyMissions, weeklyMission, weekKeyFor, missionValue, missionComplete,
  ALL_DONE_MISSION_ID, type Mission,
} from '@/data/missions';

/** Hours:minutes left until the UTC day rolls (daily missions rotate). */
function untilMidnightUtc(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const diff = next - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function MissionsPanel() {
  const open = useUI((s) => s.panel) === 'missions';
  const openPanel = useUI((s) => s.openPanel);
  const { t, lang } = useT();
  const missionProgress = usePlayer((s) => s.missionProgress);
  const missionClaims = usePlayer((s) => s.missionClaims);
  const claimMission = usePlayer((s) => s.claimMission);
  const config = useAppConfig();

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [open]);

  const today = todayKey();
  const week = weekKeyFor(today);
  const daily = dailyMissions(today);
  const weekly = weeklyMission(week);

  const dailyCounters = { counts: missionProgress?.counts ?? {}, games: missionProgress?.games ?? [] };
  const weekCounters = { counts: missionProgress?.weekCounts ?? {}, games: missionProgress?.weekGames ?? [] };
  const claims = missionClaims ?? {};

  const dailyClaimedCount = daily.filter((m) => claims[`${today}:${m.id}`]).length;
  const allDoneKey = `${today}:${ALL_DONE_MISSION_ID}`;
  const allDoneClaimed = Boolean(claims[allDoneKey]);
  const allDoneReady = dailyClaimedCount === 3 && !allDoneClaimed;

  const row = (mission: Mission, periodKey: string, counters: typeof dailyCounters) => {
    const value = missionValue(mission, counters);
    const done = missionComplete(mission, counters);
    const claimed = Boolean(claims[`${periodKey}:${mission.id}`]);
    return (
      <div key={mission.id} className="p-3 rounded-[var(--r-sm)] border border-white/[0.07]"
        style={{ background: claimed ? 'rgba(46,158,107,.08)' : done ? 'rgba(227,178,60,.08)' : 'transparent' }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <b className="text-[13px]">{mission.name[lang]}</b>
          <span className="num text-[11.5px] shrink-0" style={{ color: 'var(--gold-hi)' }}>+{fmt(mission.reward)}</span>
        </div>
        <Meter value={value} max={mission.goal} tone={claimed ? 'jade' : 'gold'} height={7} />
        <div className="flex items-center justify-between mt-1.5">
          <span className="num text-[10.5px]" style={{ color: 'var(--dim)' }}>
            {Math.min(value, mission.goal)} / {mission.goal}
          </span>
          {claimed ? (
            <span className="text-[11px]" style={{ color: 'var(--jade-hi)' }}>✅ {t('missions.claimed')}</span>
          ) : done ? (
            <GameButton size="sm" tone="gold" onClick={() => claimMission(mission.id)}>
              {t('missions.claim')}
            </GameButton>
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{t('missions.inProgress')}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={() => openPanel(null)} title={t('missions.title')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-[11.5px]" style={{ color: 'var(--muted)' }}>
          <span>{t('missions.completed', { n: dailyClaimedCount })}</span>
          <span>{t('missions.rotatesIn', { time: untilMidnightUtc() })}</span>
        </div>

        {daily.map((m) => row(m, today, dailyCounters))}

        {/* All-3 bonus */}
        <div className="p-3 rounded-[var(--r-sm)] border"
          style={{
            borderColor: allDoneReady ? 'var(--gold-line)' : 'var(--glass-line)',
            background: allDoneClaimed ? 'rgba(46,158,107,.08)' : allDoneReady ? 'rgba(227,178,60,.10)' : 'transparent',
          }}>
          <div className="flex items-center justify-between gap-2">
            <b className="text-[13px]">🏆 {t('missions.allDone')}</b>
            <span className="num text-[11.5px]" style={{ color: 'var(--gold-hi)' }}>+{fmt(config.missionAllDoneBonus)}</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="num text-[10.5px]" style={{ color: 'var(--dim)' }}>{dailyClaimedCount} / 3</span>
            {allDoneClaimed ? (
              <span className="text-[11px]" style={{ color: 'var(--jade-hi)' }}>✅ {t('missions.claimed')}</span>
            ) : allDoneReady ? (
              <GameButton size="sm" tone="gold" onClick={() => claimMission(ALL_DONE_MISSION_ID)}>
                {t('missions.claim')}
              </GameButton>
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{t('missions.claimAll3First')}</span>
            )}
          </div>
        </div>

        {/* Weekly */}
        <div className="eyebrow mt-1">{t('missions.weekly')}</div>
        {row(weekly, week, weekCounters)}
      </div>
    </Modal>
  );
}
