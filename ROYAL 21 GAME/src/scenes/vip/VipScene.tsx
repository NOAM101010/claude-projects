import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { LightPool } from '@/components/effects/LightPool';
import { ItemPreview } from '@/scenes/vault/ItemPreview';
import { PrivatePokerModal } from '@/components/game/PrivatePokerModal';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useAppConfig } from '@/hooks/useAppConfig';
import { fmt } from '@/lib/format';
import { ITEMS } from '@/data/items';
import {
  VIP_TOURNAMENT_BUYINS, VIP_TIER_LEVELS,
  vipProgress, isVipEligible, vipTier, vipTierName, nextVipTier, type VipTierId,
} from '@/data/vip';
import { profileService } from '@/services/profileService';
import { isRemoteId } from '@/services/supabase';
import { audio } from '@/audio/AudioManager';

type ClaimKind = 'daily' | 'cashback' | 'stipend';

interface VipState {
  tier: number;
  daily_ready: boolean;
  daily_next_at: string | null;
  cashback_ready: boolean;
  stipend_ready: boolean;
}

/**
 * VIP Lounge — a level-only club (level 5+) with four tiers.
 *
 * Every tier bumps the daily bonus and unlocks cashback / a weekly stipend /
 * exclusive cosmetics. The three claims all go through level-gated server RPCs
 * (supabase/vip.sql); the private-table and tournament doorways are unchanged.
 */
export default function VipScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const cfg = useAppConfig();
  const profile = usePlayer((s) => s.profile);
  const setChips = usePlayer((s) => s.setChips);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);

  const [privateOpen, setPrivateOpen] = useState(false);
  const [sngOpen, setSngOpen] = useState(false);
  const [vipState, setVipState] = useState<VipState | null>(null);
  const [busy, setBusy] = useState<ClaimKind | null>(null);

  const eligible = isVipEligible(profile);
  const progress = vipProgress(profile);
  const tier = vipTier(profile.level) as VipTierId;
  const next = nextVipTier(profile.level);
  const remote = isRemoteId(profile.id);

  const refreshState = useCallback(async () => {
    if (!remote || !eligible) return;
    const s = await profileService.fetchVipState();
    if (s) setVipState(s);
  }, [remote, eligible]);

  useEffect(() => { void refreshState(); }, [refreshState]);

  const perks = tier >= 1 ? {
    daily: cfg.vipDaily(tier as 1 | 2 | 3 | 4),
    cashbackPct: cfg.vipCashbackPct(tier as 1 | 2 | 3 | 4),
    stipend: cfg.vipStipend(tier as 1 | 2 | 3 | 4),
  } : null;

  const claim = async (kind: ClaimKind) => {
    if (busy) return;
    if (!remote) { toast(t('vip.signInToClaim'), 'neutral', '👑'); return; }
    setBusy(kind);
    const res = await profileService.claimVip(kind);
    setBusy(null);
    if (!res) { toast(t('vip.claimFailed'), 'bad', '⚠'); return; }
    if (!res.granted) {
      toast(res.reason === 'nothing' ? t('vip.nothingToClaim') : t('vip.alreadyClaimed'), 'neutral', '👑');
      void refreshState();
      return;
    }
    setChips(res.new_balance);
    audio.duck(1400);
    audio.play('bigWin');
    showMoment({ kind: 'bigWin', title: t(`vip.${kind === 'daily' ? 'claimDaily' : kind === 'cashback' ? 'claimCashback' : 'claimStipend'}`), subtitle: `+${fmt(res.amount)}`, icon: '👑', duration: 2400 });
    void refreshState();
  };

  const countdown = (iso: string | null): string => {
    if (!iso) return '';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return '';
    const h = Math.ceil(ms / 3_600_000);
    return t('vip.availableIn', { time: h >= 24 ? `${Math.ceil(h / 24)}d` : `${h}h` });
  };

  const vipItems = ITEMS.filter((it) => it.vipTier);

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #241a05 0%, #12100a 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={780} color="rgba(227,178,60,.22)" />
        <LightPool x="20%" y="70%" size={420} color="rgba(227,178,60,.12)" />
        <LightPool x="80%" y="70%" size={420} color="rgba(74,168,200,.10)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col gap-4" style={{ maxWidth: 720 }}>
        {/* header */}
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

        {/* gate */}
        {!eligible && (
          <GlassPanel gold className="p-4">
            <div className="text-center mb-3">
              <div className="text-[36px]">🔒</div>
              <b className="block mt-1">{t('vip.lockedTitle')}</b>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{t('vip.lockedSubtitle')}</p>
            </div>
            <ProgressRow
              label={t('vip.reqLevel')}
              current={progress.level.current}
              target={progress.level.target}
              done={progress.level.done}
            />
            <p className="mt-4 text-[11px] text-center" style={{ color: 'var(--dim)' }}>{t('vip.lockedHint')}</p>
          </GlassPanel>
        )}

        {eligible && (
          <>
            {/* tier card */}
            <GlassPanel gold className="p-4">
              <div className="flex items-center gap-3">
                <div className="text-[42px] leading-none">👑</div>
                <div className="flex-1">
                  <div className="eyebrow" style={{ color: 'var(--gold-hi)' }}>{t('vip.yourTier')}</div>
                  <b className="text-[20px]" style={{ color: 'var(--gold-hi)', fontFamily: 'var(--font-display)' }}>
                    {t(`vip.tier.${vipTierName(tier).toLowerCase()}`)}
                  </b>
                </div>
              </div>
              {next ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span>{t('vip.tierNext', { name: t(`vip.tier.${vipTierName(next.tier).toLowerCase()}`), level: next.atLevel })}</span>
                    <span className="num" style={{ color: 'var(--muted)' }}>{profile.level} / {next.atLevel}</span>
                  </div>
                  <TierBar current={profile.level} from={VIP_TIER_LEVELS[Math.max(0, next.tier - 2)]} to={next.atLevel} />
                </div>
              ) : (
                <p className="mt-3 text-[12px]" style={{ color: 'var(--gold-hi)' }}>{t('vip.maxTier')}</p>
              )}
            </GlassPanel>

            {/* perks + claims */}
            {perks && (
              <GlassPanel gold className="p-4 flex flex-col gap-3">
                <div className="eyebrow" style={{ color: 'var(--gold-hi)' }}>{t('vip.perksTitle')}</div>

                <ClaimRow
                  label={t('vip.claimDaily')}
                  amount={`+${fmt(perks.daily)}`}
                  ready={!!vipState?.daily_ready}
                  hint={vipState?.daily_ready ? '' : countdown(vipState?.daily_next_at ?? null) || t('vip.claimedToday')}
                  busy={busy === 'daily'}
                  onClaim={() => claim('daily')}
                />
                <ClaimRow
                  label={t('vip.claimCashback')}
                  amount={perks.cashbackPct > 0 ? t('vip.cashbackOf', { pct: Math.round(perks.cashbackPct * 100) }) : t('vip.perkLocked')}
                  ready={perks.cashbackPct > 0 && !!vipState?.cashback_ready}
                  hint={perks.cashbackPct === 0 ? t('vip.tierPerkHint', { name: t('vip.tier.silver') }) : vipState?.cashback_ready ? '' : t('vip.availableNextWeek')}
                  busy={busy === 'cashback'}
                  onClaim={() => claim('cashback')}
                />
                <ClaimRow
                  label={t('vip.claimStipend')}
                  amount={perks.stipend > 0 ? `+${fmt(perks.stipend)}` : t('vip.perkLocked')}
                  ready={perks.stipend > 0 && !!vipState?.stipend_ready}
                  hint={perks.stipend === 0 ? t('vip.tierPerkHint', { name: t('vip.tier.gold') }) : vipState?.stipend_ready ? '' : t('vip.availableNextWeek')}
                  busy={busy === 'stipend'}
                  onClaim={() => claim('stipend')}
                />
                <p className="text-[11px]" style={{ color: 'var(--dim)' }}>{t('vip.highStakesPerk')}</p>
              </GlassPanel>
            )}

            {/* VIP tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <VipCard icon="💰" title={t('vip.highRoller')} subtitle={t('vip.highRollerSubtitle')} onClick={() => setPrivateOpen(true)} />
              <VipCard icon="🎪" title={t('vip.exclusiveSng')} subtitle={t('vip.exclusiveSngSubtitle')} onClick={() => setSngOpen(true)} />
              <VipCard icon="🪙" title={t('vip.highCoinflip')} subtitle={t('vip.highCoinflipSubtitle')} onClick={() => navigate('/game/coinflip?vip=1')} />
              <VipCard icon="🂡" title={t('vip.highHighcard')} subtitle={t('vip.highHighcardSubtitle')} onClick={() => navigate('/game/highcard?vip=1')} />
            </div>

            {/* VIP cosmetics shelf */}
            <GlassPanel className="p-4">
              <div className="eyebrow mb-3" style={{ color: 'var(--gold-hi)' }}>{t('vip.shelfTitle')}</div>
              {[1, 2, 3, 4].map((tt) => {
                const group = vipItems.filter((it) => it.vipTier === tt);
                if (!group.length) return null;
                const unlocked = tier >= tt;
                return (
                  <div key={tt} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between text-[12px] mb-2">
                      <b style={{ color: unlocked ? 'var(--gold-hi)' : 'var(--muted)' }}>
                        {t(`vip.tier.${vipTierName(tt as VipTierId).toLowerCase()}`)}
                      </b>
                      <span style={{ color: 'var(--dim)' }}>
                        {unlocked ? t('vip.tierOwned') : t('vip.tierLockedUntil', { level: VIP_TIER_LEVELS[tt - 1] })}
                      </span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))' }}>
                      {group.map((it) => (
                        <div key={it.id} className="rounded-[var(--r-xs)] p-2 text-center"
                          style={{ background: 'rgba(0,0,0,.3)', opacity: unlocked ? 1 : 0.45 }}>
                          <div className="h-[52px] grid place-items-center">
                            <ItemPreview item={it} compact />
                          </div>
                          <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--muted)' }}>{it.name[lang]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </GlassPanel>
          </>
        )}

        <div className="text-center mt-2">
          <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
        </div>
      </div>

      <PrivatePokerModal open={privateOpen} onClose={() => setPrivateOpen(false)} vipOnly />

      <Modal open={sngOpen} onClose={() => setSngOpen(false)} title={t('vip.exclusiveSng')}>
        <p className="text-center mb-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>{t('vip.pickBuyIn')}</p>
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

function ProgressRow({ label, current, target, done }: { label: string; current: number; target: number; done: boolean }) {
  const pct = Math.max(0, Math.min(1, current / target));
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span>{done ? '✅' : '⏳'} {label}</span>
        <span className="num" style={{ color: done ? 'var(--gold-hi)' : 'var(--muted)' }}>{current} / {target}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
        <div className="h-full transition-all" style={{
          width: `${pct * 100}%`,
          background: done ? 'linear-gradient(90deg, var(--gold), var(--gold-hi))' : 'linear-gradient(90deg, var(--dim), var(--muted))',
        }} />
      </div>
    </div>
  );
}

function TierBar({ current, from, to }: { current: number; from: number; to: number }) {
  const span = Math.max(1, to - from);
  const pct = Math.max(0, Math.min(1, (current - from) / span));
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
      <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))' }} />
    </div>
  );
}

function ClaimRow({
  label, amount, ready, hint, busy, onClaim,
}: { label: string; amount: string; ready: boolean; hint: string; busy: boolean; onClaim: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-black">{label}</div>
        <div className="num text-[12px]" style={{ color: 'var(--gold-hi)' }}>{amount}</div>
        {hint && <div className="text-[10.5px]" style={{ color: 'var(--dim)' }}>{hint}</div>}
      </div>
      <GameButton size="sm" tone={ready ? 'gold' : 'ghost'} disabled={!ready || busy} onClick={onClaim}>
        {busy ? '…' : ready ? t('vip.claim') : t('vip.claimed')}
      </GameButton>
    </div>
  );
}

function VipCard({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
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
