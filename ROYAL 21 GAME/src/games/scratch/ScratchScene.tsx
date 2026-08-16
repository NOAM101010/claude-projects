import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GameButton } from '@/components/ui/GameButton';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { ScratchCard } from './ScratchCard';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useNightScoring } from '@/hooks/useNightScoring';
import { SCRATCH_TIERS, XP_REWARDS, rollScratch, type ScratchTier } from '@/data/economy';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { pick } from '@/lib/random';

/** Builds the three faces: a win shows the same symbol three times. */
function faceFor(tier: ScratchTier, prize: number) {
  if (prize > 0) {
    const index = Math.min(tier.symbols.length - 1, tier.table.findIndex(([value]) => value === prize));
    const symbol = tier.symbols[Math.max(0, index)];
    return [symbol, symbol, symbol];
  }
  const [a, b] = [pick(tier.symbols), pick(tier.symbols)];
  const c = pick(tier.symbols.filter((symbol) => symbol !== a || symbol !== b));
  return a === b && b === c ? [a, b, pick(tier.symbols.filter((s) => s !== a))] : [a, b, c];
}

export default function ScratchScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('scratch');
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);

  /* `ticket` is a fresh id per card. It keys the ScratchCard so every new card
     is a new component: without it React reused the instance, the canvas kept
     the previous card's scratched-away foil and the internal "already done"
     flag, so the second card could never be completed — while its price had
     already left your stack. */
  const [active, setActive] = useState<{ ticket: number; tier: ScratchTier; prize: number; symbols: string[] } | null>(null);
  const [revealed, setRevealed] = useState(false);

  const take = (tier: ScratchTier) => {
    if (profile.chips < tier.price) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(tier.price - profile.chips) }), 'bad', '⚠');
      return;
    }
    if (tier.price > 0) addChips(-tier.price, { silent: true });
    const prize = rollScratch(tier);
    setActive((current) => ({
      ticket: (current?.ticket ?? 0) + 1,
      tier,
      prize,
      symbols: faceFor(tier, prize),
    }));
    setRevealed(false);
    audio.play('card');
  };

  const finish = () => {
    if (!active || revealed) return;
    setRevealed(true);
    const net = active.prize - active.tier.price;
    if (active.prize > 0) {
      addChips(active.prize);
      audio.play(active.prize >= active.tier.price * 5 ? 'bigWin' : 'win');
      if (active.prize >= active.tier.price * 5 && active.tier.price > 0) {
        audio.duck(1500);
        showMoment({ kind: 'bigWin', title: 'moments.bigWin', subtitle: `+${fmt(active.prize)}`, icon: '💎', duration: 2000 });
      }
    } else {
      audio.play('lose');
    }
    const netOutcome = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    reportNight(netOutcome, net);
    recordResult('scratch', netOutcome, net, { scCards: stats.scCards + 1 });
    addXp(XP_REWARDS.scratchCard);
  };

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 6%, #221a12, #100c09 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="26%" size={680} color="rgba(227,178,60,.16)" />
      </div>

      <div className="mx-auto px-4 py-3" style={{ maxWidth: 860 }}>
        <AnimatePresence mode="wait">
          {!active ? (
            <motion.div key="counter" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-4">
                <span className="eyebrow">{t('scratch.title')}</span>
                <h1 className="mt-1">{t('games.scratch')}</h1>
                <p className="mt-2 text-[13.5px]" style={{ color: 'var(--muted)' }}>{t('scratch.subtitle')}</p>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
                {SCRATCH_TIERS.map((tier, index) => {
                  const top = Math.max(...tier.table.map(([prize]) => prize));
                  const affordable = profile.chips >= tier.price;
                  return (
                    <motion.button
                      key={tier.id}
                      className="relative p-4 text-start rounded-[var(--r-md)] glass"
                      style={{ borderColor: `${tier.accent}66`, opacity: affordable ? 1 : 0.55 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: affordable ? 1 : 0.55, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => take(tier)}
                    >
                      <div
                        className="h-16 rounded-[var(--r-xs)] mb-3 grid place-items-center text-[26px]"
                        style={{ background: `linear-gradient(150deg, ${tier.accent}, #1b1f27 75%)` }}
                      >
                        {tier.price === 0 ? '🎫' : '💳'}
                      </div>
                      <b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{tier.name[lang]}</b>
                      <div className="flex items-center justify-between mt-1.5 text-[12px]">
                        <span style={{ color: 'var(--muted)' }}>{t('scratch.price')}</span>
                        <b className="num" style={{ color: tier.price === 0 ? 'var(--jade-hi)' : 'var(--gold-hi)' }}>
                          {tier.price === 0 ? t('scratch.free') : fmt(tier.price)}
                        </b>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: 'var(--muted)' }}>{t('scratch.top')}</span>
                        <b className="num">{fmt(top)}</b>
                      </div>
                      {tier.price === 0 && (
                        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--dim)' }}>{t('scratch.freeNote')}</p>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="text-center mt-5">
                <GameButton tone="ghost" size="sm" onClick={() => navigate(nightReturn ?? '/hub')}>
                  {nightReturn ? t('night.backToNight') : t('common.back')}
                </GameButton>
              </div>
            </motion.div>
          ) : (
            <motion.div key="card" className="max-w-[420px] mx-auto"
              initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="text-center mb-3">
                <span className="eyebrow">{active.tier.name[lang]}</span>
                <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
                  {revealed ? '' : `${t('scratch.hint')} · ${t('scratch.threeSame')}`}
                </p>
              </div>

              <div className="relative">
                <AnimatePresence>{revealed && active.prize > 0 && <VictoryEffect kind={profile.equipped.victory} />}</AnimatePresence>
                <ScratchCard key={active.ticket} symbols={active.symbols} accent={active.tier.accent} onComplete={finish} />
              </div>

              <AnimatePresence>
                {revealed && (
                  <motion.div className="text-center mt-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="text-[24px] font-black" style={{ fontFamily: 'var(--font-display)', color: active.prize ? 'var(--gold-hi)' : 'var(--muted)' }}>
                      {active.prize ? t('scratch.won', { amount: fmt(active.prize) }) : t('scratch.nothing')}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <GameButton tone="gold" block onClick={() => take(active.tier)}
                        disabled={profile.chips < active.tier.price}>
                        {t('scratch.another')} · {active.tier.price === 0 ? t('scratch.free') : fmt(active.tier.price)}
                      </GameButton>
                      <GameButton tone="ghost" block onClick={() => setActive(null)}>{t('scratch.back')}</GameButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SceneShell>
  );
}
