import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { CasinoCity, type Flight } from './CasinoCity';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { useSettings } from '@/stores/useSettings';

const MARK = 'ROYAL 21';

/**
 * The opening: a night flight over the neon casino city that dives to the
 * doors, the ROYAL 21 marquee igniting on the entrance, then the buttons.
 * Long the first time (~5.5s), a ~1s fade for returning players, and instant
 * for reduced motion — always skippable (§17).
 */
export default function IntroScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const seenIntro = usePlayer((s) => s.seenIntro);
  const markIntroSeen = usePlayer((s) => s.markIntroSeen);
  const hasProfile = usePlayer((s) => !!s.profile.id);
  const ready = usePlayer((s) => s.ready);
  const signOut = usePlayer((s) => s.signOut);
  const reduced = useSettings((s) => s.reducedMotion);

  const flight: Flight = reduced ? 'instant' : seenIntro ? 'short' : 'full';
  const [done, setDone] = useState(flight === 'instant');
  const [revealed, setRevealed] = useState(flight === 'instant');

  useEffect(() => {
    const revealAt = flight === 'full' ? 5300 : flight === 'short' ? 900 : 150;
    const timer = setTimeout(() => setRevealed(true), revealAt);
    const sounds =
      flight === 'full'
        ? [
            setTimeout(() => audio.play('door'), 400),
            setTimeout(() => audio.play('chipStack'), 2700),
            setTimeout(() => audio.play('vault'), 4300),
          ]
        : flight === 'short'
          ? [setTimeout(() => audio.play('card'), 200)]
          : [];
    return () => {
      clearTimeout(timer);
      sounds.forEach(clearTimeout);
    };
  }, [flight]);

  useEffect(() => {
    if (revealed) markIntroSeen();
  }, [revealed, markIntroSeen]);

  const skip = () => {
    setDone(true);
    setRevealed(true);
  };

  const enter = () => {
    audio.unlock();
    audio.startAmbient();
    audio.startMusic();
    navigate(hasProfile ? '/hub' : '/login');
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden grid place-items-center px-5 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <CasinoCity flight={done ? 'instant' : flight} />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="cc-mark">
          <h1 aria-label="ROYAL 21">
            {MARK.split('').map((ch, i) =>
              ch === ' ' ? (
                <span key={i} className="cc-letter cc-letter--space" style={{ ['--i' as string]: i }} />
              ) : (
                <span key={i} className="cc-letter" style={{ ['--i' as string]: i }} aria-hidden="true">
                  {ch}
                </span>
              ),
            )}
          </h1>
          {revealed && <div className="cc-tagline mt-3">{t('common.tagline')}</div>}
        </div>

        {revealed && (
          <div className="cc-enter cc-plate mt-8">
            <h2 className="mb-1">{t('intro.welcome')}</h2>
            <p className="mb-6" style={{ color: 'var(--muted)' }}>
              {t('intro.roomReady')}
            </p>
            <div className="flex flex-col gap-2.5">
              {hasProfile && ready && (
                <>
                  <GameButton tone="gold" size="lg" block onClick={enter}>
                    {t('intro.continueAs', { name: usePlayer.getState().profile.username })}
                  </GameButton>
                  {/* The way back out — a stale saved session must still lead to
                      sign in / register, not only back into the failing account. */}
                  <button
                    className="text-[12px] underline underline-offset-4 mx-auto press"
                    style={{ color: 'var(--dim)' }}
                    onClick={() => {
                      void signOut().then(() => navigate('/login?mode=signin'));
                    }}
                  >
                    {t('intro.notYou')}
                  </button>
                </>
              )}
              {!hasProfile && (
                <>
                  <GameButton tone="gold" size="lg" block onClick={() => navigate('/login?mode=signin')}>
                    {t('intro.login')}
                  </GameButton>
                  <GameButton tone="metal" block onClick={() => navigate('/login?mode=signup')}>
                    {t('intro.register')}
                  </GameButton>
                </>
              )}
            </div>
            <p
              className="mt-6 mx-auto text-[11.5px] leading-relaxed"
              style={{ color: 'var(--dim)', maxWidth: 340 }}
            >
              {t('intro.legal')}
            </p>
          </div>
        )}
      </div>

      {!revealed && (
        <button
          className="absolute bottom-6 end-6 text-[12px] tracking-[.3em] uppercase z-20 press"
          style={{ color: 'var(--dim)' }}
          onClick={skip}
        >
          {t('common.skip')} →
        </button>
      )}
    </motion.div>
  );
}
