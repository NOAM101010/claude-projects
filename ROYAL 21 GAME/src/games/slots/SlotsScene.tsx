import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { BetSelector } from '@/components/game/BetSelector';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useNightScoring } from '@/hooks/useNightScoring';
import { XP_REWARDS } from '@/data/economy';
import { SLOT_STAKES, symbolsForTheme, pull, spinReel, type SlotSymbol, type SpinOutcome } from '@/data/slots';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { jackpotService } from '@/services/jackpotService';
import { JackpotBanner } from '@/components/game/JackpotBanner';
import { JackpotWin } from '@/components/effects/JackpotWin';

/** Each reel stops a beat after the one before it — the pause is the drama. */
const REEL_STOP = [900, 1250, 1650];
const TICK = 70;
/** Auto-play trims the same reveal down to something skimmable across many spins in a row. */
const REEL_STOP_AUTO = [180, 300, 420];
const TICK_AUTO = 40;
const AUTO_SPIN_GAP_MS = 260;
const AUTO_SPIN_COUNTS = [10, 25, 50] as const;

/** Cosmetic-only per-theme accent — never touches SLOT_SYMBOLS, weights, or payouts. */
const THEME_GLOW: Record<string, string> = {
  'sl-classic': 'rgba(168,120,240,.16)',
  'sl-fruit': 'rgba(255,140,60,.2)',
  'sl-neon': 'rgba(53,224,201,.22)',
  'sl-egypt': 'rgba(227,178,60,.22)',
  'sl-galaxy': 'rgba(168,120,240,.26)',
};

function Reel({ symbol, spinning, theme }: { symbol: SlotSymbol; spinning: boolean; theme: string }) {
  return (
    <div
      className={`reel-well ${theme} relative grid place-items-center overflow-hidden`}
      style={{
        width: 'clamp(64px, 22vw, 92px)',
        height: 'clamp(84px, 28vw, 116px)',
        border: '1px solid',
        borderRadius: 'var(--r-sm)',
        boxShadow: 'inset 0 10px 18px rgba(0,0,0,.7), inset 0 -10px 18px rgba(0,0,0,.7)',
      }}
    >
      {/* One node, re-keyed per symbol. An AnimatePresence here piles up exit
          nodes faster than they can leave while the reel is blurring. */}
      <motion.span
        key={symbol.id}
        style={{ fontSize: 'clamp(30px,9vw,44px)', lineHeight: 1 }}
        initial={{ y: spinning ? -34 : -14, opacity: spinning ? 0.5 : 0.2 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: spinning ? 0.07 : 0.26, ease: 'easeOut' }}
      >
        {symbol.glyph}
      </motion.span>
      {/* glass reflection */}
      <span
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,.10), transparent)' }}
      />
    </div>
  );
}

/**
 * The slot machine. Three weighted reels, one payline, an honest paytable.
 * The stake leaves your stack the moment you pull, and the return lands when
 * the last reel stops — so the number on the HUD is never a lie mid-spin.
 */
export default function SlotsScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('slots');

  const theme = profile.equipped.slotsTheme ?? 'sl-classic';
  const themeSymbols = symbolsForTheme(theme);

  const [stake, setStake] = useState(100);
  const [reels, setReels] = useState<SlotSymbol[]>([themeSymbols[5], themeSymbols[4], themeSymbols[5]]);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [payTableOpen, setPayTableOpen] = useState(false);
  const [autoSpinsLeft, setAutoSpinsLeft] = useState(0);
  const [jackpotWinAmount, setJackpotWinAmount] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  /* Read alongside the mirrored `autoSpinsLeft` state — the settle timeout below
     needs the current count at the instant it fires, not whatever was in scope
     when the timeout was scheduled several spins ago. */
  const autoRef = useRef(0);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => () => clearTimers(), []);

  const stopAuto = () => {
    autoRef.current = 0;
    setAutoSpinsLeft(0);
  };

  const spin = (fromAuto = false) => {
    if (spinning) return;
    const currentStake = stake;
    if (usePlayer.getState().profile.chips < currentStake) {
      if (fromAuto) { stopAuto(); toast(t('slots.autoStoppedChips'), 'bad', '⚠'); }
      else { audio.play('error'); toast(t('games.tooPoor', { amount: fmt(currentStake - profile.chips) }), 'bad', '⚠'); }
      return;
    }

    clearTimers();
    addChips(-currentStake, { silent: true });
    setOutcome(null);
    setSpinning(true);
    audio.play('chip');
    haptic('chip');

    // Contribute 1% of the bet to the progressive jackpot pool
    void jackpotService.addContribution('slots', currentStake);

    const result = pull(currentStake, undefined, themeSymbols);
    // Credit the win silently the moment the outcome is decided. Before this,
    // the payout was only credited inside the reveal-settled timeout — so
    // navigating away during the reveal (a common thing when you spam back
    // right after seeing a triple line up) meant the timer got cancelled and
    // the win never landed. The animation below now purely reveals what was
    // already accounted for.
    if (result.payout > 0) addChips(result.payout, { silent: true });
    const reelStop = fromAuto ? REEL_STOP_AUTO : REEL_STOP;
    const tick = fromAuto ? TICK_AUTO : TICK;

    /* Blur the reels with throwaway symbols, then settle each one onto the
       real result. The outcome is decided up front — the animation only
       reveals it, so a slow frame can never change what you won. */
    const start = Date.now();
    const blur = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setReels((current) => current.map((symbol, index) => (
        elapsed > reelStop[index] ? symbol : spinReel(undefined, themeSymbols)
      )));
    }, tick);

    reelStop.forEach((delay, index) => {
      timers.current.push(window.setTimeout(() => {
        setReels((current) => current.map((symbol, i) => (i === index ? result.reels[index] : symbol)));
        audio.play('chip');
        haptic('land');
      }, delay));
    });

    timers.current.push(window.setTimeout(() => {
      clearInterval(blur);
      setReels(result.reels);
      setSpinning(false);
      setOutcome(result);

      const net = result.payout - currentStake;
      // Payout was already credited above the moment `pull()` decided it.
      // Only trigger the sound + haptic here so the reveal still feels
      // rewarding.
      if (result.payout > 0) { audio.play('chip'); haptic('chip'); }

      if (result.kind === 'triple') {
        audio.duck(1400);
        audio.play('bigWin');
        haptic('win');
        showMoment({
          kind: 'bigWin',
          title: t('slots.tripleTitle', { symbol: result.symbol?.name[lang] ?? '' }),
          subtitle: `+${fmt(result.payout)}`,
          icon: result.symbol?.glyph ?? '🎰',
          duration: 2200,
        });
        // JACKPOT trigger: the theme's "7-equivalent" symbol wins the whole pot.
        // Every theme reuses the same weight/triple table position-for-position,
        // so triple === 250 always identifies the same-tier symbol regardless of
        // whether the player is on fruit, neon, egypt or classic.
        if (result.symbol?.triple === 250) {
          void jackpotService.claim('slots').then((res) => {
            if (res.ok && res.amount) {
              addChips(res.amount);
              haptic('win');
              // Full-screen celebration takes over; the standard moment
              // toast would be redundant on top of it.
              setJackpotWinAmount(res.amount);
            }
          });
        }
      } else if (result.kind === 'pair') {
        audio.play('win');
      } else {
        audio.play('lose');
      }

      const netOutcome = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
      reportNight(netOutcome, net);
      recordResult('slots', netOutcome, net, {
        slSpins: stats.slSpins + 1,
        slWins: stats.slWins + (net > 0 ? 1 : 0),
      });
      addXp(XP_REWARDS.handPlayed + (net > 0 ? XP_REWARDS.gameWon : 0));

      if (fromAuto && autoRef.current > 0) {
        autoRef.current -= 1;
        setAutoSpinsLeft(autoRef.current);
        if (autoRef.current > 0) {
          if (usePlayer.getState().profile.chips < currentStake) {
            stopAuto();
            toast(t('slots.autoStoppedChips'), 'bad', '⚠');
          } else {
            timers.current.push(window.setTimeout(() => spin(true), AUTO_SPIN_GAP_MS));
          }
        } else {
          toast(t('slots.autoDone'), 'neutral', '🎰');
        }
      }
    }, reelStop[reelStop.length - 1] + (fromAuto ? 120 : 260)));
  };

  const startAuto = (count: number) => {
    if (spinning || autoSpinsLeft > 0) return;
    autoRef.current = count;
    setAutoSpinsLeft(count);
    spin(true);
  };

  const net = outcome ? outcome.payout - stake : 0;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 8%, #241a2c, #100c14 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="30%" size={680} color={THEME_GLOW[theme] ?? THEME_GLOW['sl-classic']} />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-4" style={{ maxWidth: 560 }}>
        <div className="text-center">
          <span className="eyebrow">{t('slots.eyebrow')}</span>
          <h1 className="mt-1">{t('hub.slots')}</h1>
        </div>

        {/* ---------------------------- jackpot ------------------------------ */}
        <div className="w-full">
          <JackpotBanner game="slots" winCondition={t('jackpot.slotsCondition')} />
        </div>

        {/* ------------------------------ cabinet ----------------------------- */}
        <div className="relative w-full">
          <AnimatePresence>
            {outcome?.kind === 'triple' && <VictoryEffect kind={profile.equipped.victory} />}
          </AnimatePresence>

          <GlassPanel gold className="p-4">
            <div
              className="flex justify-center gap-2.5 p-3 rounded-[var(--r-sm)]"
              style={{ background: 'linear-gradient(180deg,#08090b,#12141a)', border: '1px solid var(--gold-line)' }}
            >
              {reels.map((symbol, index) => (
                <Reel key={index} symbol={symbol} spinning={spinning} theme={theme} />
              ))}
            </div>

            {/* payline + result */}
            <div className="mt-3 text-center" style={{ minHeight: 54 }}>
              <AnimatePresence mode="wait">
                {spinning ? (
                  <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-[13px]" style={{ color: 'var(--muted)' }}>
                    {t('slots.spinning')}
                  </motion.div>
                ) : outcome ? (
                  <motion.div key={`r-${outcome.kind}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div
                      className="text-[20px] font-black"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: net > 0 ? 'var(--gold-hi)' : net === 0 ? 'var(--muted)' : 'var(--crimson-hi)',
                      }}
                    >
                      {outcome.kind === 'triple'
                        ? t('slots.triple', { symbol: outcome.symbol?.name[lang] ?? '' })
                        : outcome.kind === 'pair'
                          ? t('slots.pair')
                          : t('slots.noWin')}
                    </div>
                    <div className="num text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {net >= 0 ? `+${fmt(net)}` : `-${fmt(-net)}`}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-[13px]" style={{ color: 'var(--dim)' }}>
                    {t('slots.idle')}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassPanel>
        </div>

        {/* ------------------------------ controls ---------------------------- */}
        <GlassPanel className="p-4 w-full">
          <BetSelector
            stakes={SLOT_STAKES}
            value={stake}
            onChange={setStake}
            chipSkin={profile.equipped.chipSkin}
            disabled={spinning || autoSpinsLeft > 0}
            chips={profile.chips}
          />

          <GameButton tone="gold" size="lg" block disabled={spinning || profile.chips < stake || autoSpinsLeft > 0} onClick={() => spin(false)}>
            {autoSpinsLeft > 0 ? t('slots.autoSpinning', { n: autoSpinsLeft }) : spinning ? t('slots.spinning') : `${t('hub.spin')} · ${fmt(stake)}`}
          </GameButton>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
            <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{t('slots.autoPlay')}</span>
            {AUTO_SPIN_COUNTS.map((n) => (
              <GameButton
                key={n} size="sm" tone="metal"
                disabled={spinning || autoSpinsLeft > 0 || profile.chips < stake * n}
                onClick={() => startAuto(n)}
              >
                {t('slots.autoSpins', { n })}
              </GameButton>
            ))}
            {autoSpinsLeft > 0 && (
              <GameButton size="sm" tone="danger" onClick={stopAuto}>{t('slots.stopAuto')}</GameButton>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <GameButton tone="ghost" size="sm" block disabled={autoSpinsLeft > 0} onClick={() => setPayTableOpen(true)}>
              {t('slots.paytable')}
            </GameButton>
            <GameButton tone="ghost" size="sm" block disabled={autoSpinsLeft > 0} onClick={() => navigate(nightReturn ?? '/hub')}>
              {nightReturn ? t('night.backToNight') : t('common.back')}
            </GameButton>
          </div>
        </GlassPanel>
      </div>

      {/* ------------------------------ paytable ----------------------------- */}
      {jackpotWinAmount !== null && (
        <JackpotWin amount={jackpotWinAmount} onDone={() => setJackpotWinAmount(null)} />
      )}

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('slots.paytable')}>
        <div className="flex flex-col gap-1.5">
          {[...themeSymbols].reverse().map((symbol) => (
            <div
              key={symbol.id}
              className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
            >
              <span className="text-[22px]">{symbol.glyph}{symbol.glyph}{symbol.glyph}</span>
              <b className="flex-1 text-[13px]">{symbol.name[lang]}</b>
              <b className="num" style={{ color: 'var(--gold-hi)' }}>×{symbol.triple}</b>
            </div>
          ))}
          <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>
            {t('slots.pairNote')}
          </p>
          <p className="text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>
            {t('slots.fairness')}
          </p>
        </div>
      </Modal>
    </SceneShell>
  );
}
