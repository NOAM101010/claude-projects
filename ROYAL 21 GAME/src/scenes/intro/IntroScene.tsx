import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { LightPool } from '@/components/effects/LightPool';
import { Particles } from '@/components/effects/Particles';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { useSettings } from '@/stores/useSettings';

/**
 * The room wakes up: a spotlight, a card sliding in, chips landing, then the
 * name. Long version the first time (~4s), short version for returning players,
 * and always skippable (§17).
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

  const short = seenIntro || reduced;
  const [stage, setStage] = useState(0); // 0 dark · 1 light · 2 card · 3 chips · 4 doors open

  useEffect(() => {
    const beats = short ? [0, 120, 260, 420, 700] : [0, 500, 1300, 2100, 3100];
    const timers = beats.map((delay, index) => setTimeout(() => setStage(index), delay));
    const sounds = short
      ? [setTimeout(() => audio.play('card'), 200)]
      : [
        setTimeout(() => audio.play('door'), 400),
        setTimeout(() => audio.play('card'), 1350),
        setTimeout(() => audio.play('chipStack'), 2150),
        setTimeout(() => audio.play('vault'), 3050),
      ];
    return () => [...timers, ...sounds].forEach(clearTimeout);
  }, [short]);

  useEffect(() => {
    if (stage >= 4) markIntroSeen();
  }, [stage, markIntroSeen]);

  const enter = () => {
    audio.unlock();
    audio.startAmbient();
    audio.startMusic();
    navigate(hasProfile ? '/hub' : '/login');
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden grid place-items-center vignette px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* background: the far wall of the room */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 120%, #143024, #0b1410 45%, #08090b 75%)' }} />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[52%]"
        style={{ background: 'linear-gradient(0deg, #0d2019, transparent)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: stage >= 1 ? 1 : 0 }}
        transition={{ duration: 1.2 }}
      />

      {/* the spotlight coming on */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0.2 }}
        animate={{ opacity: stage >= 1 ? 1 : 0, scaleY: stage >= 1 ? 1 : 0.2 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.25, 1] }}
        className="absolute top-0 start-1/2 -translate-x-1/2 origin-top pointer-events-none"
        style={{
          width: 'min(760px, 120vw)', height: '78vh',
          background: 'linear-gradient(180deg, rgba(227,178,60,.20), transparent 72%)',
          clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          filter: 'blur(2px)',
        }}
      />
      <LightPool x="50%" y="72%" size={620} color="rgba(227,178,60,.20)" />
      {stage >= 2 && <Particles count={16} />}

      {/* a card slides across the felt */}
      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            className="absolute"
            style={{ bottom: '26%', width: 78, height: 110, borderRadius: 10, background: 'linear-gradient(160deg,#fffdf6,#e6dfcd)', boxShadow: '0 18px 30px rgba(0,0,0,.55)' }}
            initial={{ x: '-70vw', rotate: -28, opacity: 0 }}
            animate={{ x: -70, rotate: -9, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 60, damping: 16 }}
          >
            <div style={{ padding: 8, color: '#b0201f', fontWeight: 900, fontFamily: 'var(--font-display)', fontSize: 20 }}>A</div>
            <div style={{ textAlign: 'center', fontSize: 34, color: '#b0201f' }}>♥</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chips land */}
      <AnimatePresence>
        {stage >= 3 && (
          <div className="absolute" style={{ bottom: '24%', insetInlineStart: '58%' }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="chip-obj absolute"
                style={{ width: 44, height: 44, fontSize: 11, ['--chip-color' as string]: ['#a8413e', '#2e9e6b', '#e3b23c'][i] }}
                initial={{ y: -220, opacity: 0, rotate: -40 }}
                animate={{ y: -i * 7, opacity: 1, rotate: (i - 1) * 6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: i * 0.12 }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* the name, then the doors */}
      <div className="relative z-10 text-center max-w-[440px] w-full">
        <motion.div
          initial={{ opacity: 0, y: 20, letterSpacing: '0.5em' }}
          animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? 0 : 20, letterSpacing: '0.02em' }}
          transition={{ duration: 1 }}
        >
          <h1
            style={{
              fontSize: 'clamp(46px, 12vw, 92px)', lineHeight: 0.94,
              background: 'linear-gradient(180deg,#fff6dc,var(--gold) 58%,#9a781f)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 10px 34px rgba(227,178,60,.4))',
            }}
          >
            ROYAL 21
          </h1>
          <div className="eyebrow mt-2">{t('common.tagline')}</div>
        </motion.div>

        <AnimatePresence>
          {stage >= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mt-8"
            >
              <h2 className="mb-1">{t('intro.welcome')}</h2>
              <p className="mb-6" style={{ color: 'var(--muted)' }}>{t('intro.roomReady')}</p>
              <div className="flex flex-col gap-2.5">
                {hasProfile && ready && (
                  <>
                    <GameButton tone="gold" size="lg" block onClick={enter}>
                      {t('intro.continueAs', { name: usePlayer.getState().profile.username })}
                    </GameButton>
                    {/* The way back out. With a saved profile this screen used to
                        offer nothing but "continue", so a session that had gone
                        stale left no route to sign in or register — the only
                        visible door led back into the account that was failing. */}
                    <button
                      className="text-[12px] underline underline-offset-4 mx-auto press"
                      style={{ color: 'var(--dim)' }}
                      onClick={() => { void signOut().then(() => navigate('/login?mode=signin')); }}
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
              <p className="mt-6 mx-auto text-[11.5px] leading-relaxed" style={{ color: 'var(--dim)', maxWidth: 340 }}>
                {t('intro.legal')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stage < 4 && (
        <button
          className="absolute bottom-6 end-6 text-[12px] tracking-[.3em] uppercase z-20"
          style={{ color: 'var(--dim)' }}
          onClick={() => setStage(4)}
        >
          {t('common.skip')} →
        </button>
      )}
    </motion.div>
  );
}
