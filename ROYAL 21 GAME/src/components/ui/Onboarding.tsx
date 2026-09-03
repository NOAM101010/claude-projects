import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';

const SEEN_KEY = 'royal21.onboarded';

/** Has this device already been shown the tour? */
export const hasOnboarded = () => localStorage.getItem(SEEN_KEY) === '1';
/** Lets Settings offer "show me again". */
export const resetOnboarding = () => localStorage.removeItem(SEEN_KEY);

interface Step {
  icon: string;
  titleKey: string;
  bodyKey: string;
}

const STEPS: Step[] = [
  { icon: '🎩', titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody' },
  { icon: '★', titleKey: 'tour.chipsTitle', bodyKey: 'tour.chipsBody' },
  { icon: '♠', titleKey: 'tour.tablesTitle', bodyKey: 'tour.tablesBody' },
  { icon: '👥', titleKey: 'tour.friendsTitle', bodyKey: 'tour.friendsBody' },
  { icon: '🎁', titleKey: 'tour.freeTitle', bodyKey: 'tour.freeBody' },
  { icon: '🏠', titleKey: 'tour.navTitle', bodyKey: 'tour.navBody' },
];

/**
 * First-run tour of the room.
 *
 * Deliberately a short sequence of cards rather than coach marks pinned to
 * elements: the hub reflows across breakpoints, and a highlight ring anchored
 * to a moving target is the thing most likely to end up pointing at nothing.
 */
export function Onboarding({ onDone }: { onDone?: () => void }) {
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile.id || hasOnboarded()) return;
    // Let the hub paint first; the tour should feel like it opens over a room.
    const timer = setTimeout(() => setOpen(true), 650);
    return () => clearTimeout(timer);
  }, [profile.id]);

  const finish = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setOpen(false);
    audio.play('click');
    onDone?.();
  };

  const next = () => {
    if (step >= STEPS.length - 1) { finish(); return; }
    audio.play('click');
    setStep((value) => value + 1);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Enter is left to the focused button so a keyboard user cannot advance twice.
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const current = STEPS[step];

  if (!open) return null;
  return (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center px-4"
          style={{ background: 'rgba(4,5,7,.72)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="dialog"
          aria-modal="true"
          aria-label={t('tour.title')}
        >
          <motion.div
            className="glass w-full text-center p-6"
            style={{ maxWidth: 400, borderColor: 'var(--gold-line)' }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <span className="eyebrow">{t('tour.title')}</span>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <motion.div
                  className="mx-auto mt-3 grid place-items-center"
                  style={{
                    width: 76, height: 76, borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 32%, rgba(227,178,60,.28), rgba(227,178,60,.05))',
                    border: '1px solid var(--gold-line)', fontSize: 34,
                  }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {current.icon}
                </motion.div>

                <h2 className="mt-3 text-[21px]">{t(current.titleKey)}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {t(current.bodyKey, { chips: fmt(profile.chips), name: profile.username })}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* progress */}
            <div className="flex justify-center gap-1.5 mt-5 mb-4">
              {STEPS.map((entry, index) => (
                <span
                  key={entry.titleKey}
                  style={{
                    width: index === step ? 18 : 6, height: 6, borderRadius: 999,
                    background: index <= step ? 'var(--gold)' : 'var(--surface-3)',
                    transition: 'width .22s var(--ease-out), background .22s',
                  }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <GameButton tone="gold" block onClick={next}>
                {step >= STEPS.length - 1 ? t('tour.start') : t('tour.next')}
              </GameButton>
              {step < STEPS.length - 1 && (
                <GameButton tone="ghost" onClick={finish}>{t('tour.skip')}</GameButton>
              )}
            </div>
          </motion.div>
        </motion.div>
  );
}
