import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { LightPool } from '@/components/effects/LightPool';
import { PrivatePokerModal } from '@/components/game/PrivatePokerModal';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { fmt, todayKey } from '@/lib/format';
import {
  VIP_DAILY_BONUS, VIP_TOURNAMENT_BUYINS,
  vipProgress, isVipEligible,
} from '@/data/vip';
import { audio } from '@/audio/AudioManager';

const VIP_BONUS_STORAGE_KEY = 'royal21.vip.lastBonusClaim';

/**
 * VIP Lounge — the private-tables tier for anyone at level 15+ with 50K chips.
 *
 * Everything in here is either a shortcut into an already-existing scene
 * (High Roller poker uses the standard poker room with bigger blinds, VIP
 * SNG uses the standard SNG room with a bigger buy-in) or the private-table
 * modal opened in VIP mode. There is no new game engine here — just a
 * higher-stakes doorway to the ones that already exist.
 */
export default function VipScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);

  const [privateOpen, setPrivateOpen] = useState(false);
  const [sngOpen, setSngOpen] = useState(false);

  const progress = vipProgress(profile);
  const eligible = isVipEligible(profile);

  /* Daily VIP bonus — a flat top-up once per calendar day. Stored locally
     alongside the standard save; server-side enforcement would be ideal
     for real money but is overkill for virtual chips. */
  const bonusReady = eligible && localStorage.getItem(VIP_BONUS_STORAGE_KEY) !== todayKey();

  const claimBonus = () => {
    if (!bonusReady) return;
    localStorage.setItem(VIP_BONUS_STORAGE_KEY, todayKey());
    addChips(VIP_DAILY_BONUS);
    audio.duck(1500);
    audio.play('bigWin');
    showMoment({
      kind: 'bigWin',
      title: t('vip.bonusTitle'),
      subtitle: `+${fmt(VIP_DAILY_BONUS)}`,
      icon: '👑',
      duration: 2400,
    });
  };

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #241a05 0%, #12100a 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={780} color="rgba(227,178,60,.22)" />
        <LightPool x="20%" y="70%" size={420} color="rgba(227,178,60,.12)" />
        <LightPool x="80%" y="70%" size={420} color="rgba(74,168,200,.10)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col gap-4" style={{ maxWidth: 720 }}>
        {/* ------------------------- header ------------------------- */}
        <div className="text-center">
          <span className="eyebrow" style={{ color: 'var(--gold-hi)' }}>{t('vip.eyebrow')}</span>
          <motion.h1
            className="mt-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 'clamp(28px, 6vw, 44px)',
              background: 'linear-gradient(180deg, #fff6dc, var(--gold-hi) 55%, #9a781f)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 6px 22px rgba(227,178,60,.35))',
            }}
          >
            👑 {t('vip.title')}
          </motion.h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>{t('vip.subtitle')}</p>
        </div>

        {/* -------------- gate: not-yet-eligible progress bars --------------- */}
        {!eligible && (
          <GlassPanel gold className="p-4">
            <div className="text-center mb-3">
              <div className="text-[36px]">🔒</div>
              <b className="block mt-1">{t('vip.lockedTitle')}</b>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{t('vip.lockedSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <ProgressRow
                label={t('vip.reqLevel')}
                current={progress.level.current}
                target={progress.level.target}
                done={progress.level.done}
                format={(n) => String(n)}
              />
              <ProgressRow
                label={t('vip.reqChips')}
                current={progress.chips.current}
                target={progress.chips.target}
                done={progress.chips.done}
                format={fmt}
              />
            </div>
            <p className="mt-4 text-[11px] text-center" style={{ color: 'var(--dim)' }}>
              {t('vip.lockedHint')}
            </p>
          </GlassPanel>
        )}

        {/* --------------- eligible: the actual VIP options ------------------ */}
        {eligible && (
          <>
            {/* Daily bonus */}
            <GlassPanel gold className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow" style={{ color: 'var(--gold-hi)' }}>{t('vip.dailyBonus')}</div>
                  <b className="num" style={{ fontSize: 22, color: 'var(--gold-hi)', fontFamily: 'var(--font-display)' }}>
                    +{fmt(VIP_DAILY_BONUS)}
                  </b>
                </div>
                <GameButton
                  tone={bonusReady ? 'gold' : 'ghost'}
                  onClick={bonusReady ? claimBonus : () => toast(t('vip.bonusTakenToday'), 'neutral', '👑')}
                >
                  {bonusReady ? t('vip.claim') : t('vip.claimed')}
                </GameButton>
              </div>
            </GlassPanel>

            {/* Grid of VIP options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <VipCard
                icon="💰"
                title={t('vip.highRoller')}
                subtitle={t('vip.highRollerSubtitle')}
                onClick={() => setPrivateOpen(true)}
              />
              <VipCard
                icon="🎪"
                title={t('vip.exclusiveSng')}
                subtitle={t('vip.exclusiveSngSubtitle')}
                onClick={() => setSngOpen(true)}
              />
              <VipCard
                icon="🪙"
                title={t('vip.highCoinflip')}
                subtitle={t('vip.highCoinflipSubtitle')}
                onClick={() => navigate('/game/coinflip?vip=1')}
              />
              <VipCard
                icon="🂡"
                title={t('vip.highHighcard')}
                subtitle={t('vip.highHighcardSubtitle')}
                onClick={() => navigate('/game/highcard?vip=1')}
              />
            </div>
          </>
        )}

        <div className="text-center mt-2">
          <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
        </div>
      </div>

      <PrivatePokerModal open={privateOpen} onClose={() => setPrivateOpen(false)} vipOnly />

      <Modal open={sngOpen} onClose={() => setSngOpen(false)} title={t('vip.exclusiveSng')}>
        <p className="text-center mb-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {t('vip.pickBuyIn')}
        </p>
        <div className="flex flex-col gap-2">
          {VIP_TOURNAMENT_BUYINS.map((amount) => (
            <GameButton
              key={amount}
              tone={amount === VIP_TOURNAMENT_BUYINS[0] ? 'gold' : 'metal'}
              disabled={amount > profile.chips}
              onClick={() => { setSngOpen(false); navigate(`/poker/sng/new?buyIn=${amount}`); }}
            >
              {fmt(amount)}
            </GameButton>
          ))}
        </div>
      </Modal>
    </SceneShell>
  );
}

function ProgressRow({
  label, current, target, done, format,
}: { label: string; current: number; target: number; done: boolean; format: (n: number) => string }) {
  const pct = Math.max(0, Math.min(1, current / target));
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span>{done ? '✅' : '⏳'} {label}</span>
        <span className="num" style={{ color: done ? 'var(--gold-hi)' : 'var(--muted)' }}>
          {format(current)} / {format(target)}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${pct * 100}%`,
            background: done
              ? 'linear-gradient(90deg, var(--gold), var(--gold-hi))'
              : 'linear-gradient(90deg, var(--dim), var(--muted))',
          }}
        />
      </div>
    </div>
  );
}

function VipCard({
  icon, title, subtitle, onClick,
}: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press text-start p-4 rounded-[var(--r-sm)]"
      style={{
        background: 'linear-gradient(135deg, rgba(227,178,60,.10), rgba(74,168,200,.04))',
        border: '1px solid var(--gold-line)',
        boxShadow: '0 8px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.05)',
      }}
    >
      <div className="text-[32px] mb-1">{icon}</div>
      <b className="block text-[15px]" style={{ color: 'var(--gold-hi)' }}>{title}</b>
      <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
    </button>
  );
}
