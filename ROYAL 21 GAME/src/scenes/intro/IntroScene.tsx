import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { useSettings } from '@/stores/useSettings';

/**
 * The name is revealed over the same gold-framed room as sign-in, then the
 * scene hands off on its own (~1.3s, or almost instantly for a returning
 * player / reduced motion). Always skippable.
 *
 * Motion rule — matches AppBackdrop / AmbientBackground: NO framer-motion here.
 * Every effect is a CSS @keyframes on opacity / transform only, so a stalled
 * animation can never leave an overlay covering the screen. See
 * `.intro-*` keyframes in src/styles/game.css.
 */
export default function IntroScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const seenIntro = usePlayer((s) => s.seenIntro);
  const markIntroSeen = usePlayer((s) => s.markIntroSeen);
  const hasProfile = usePlayer((s) => !!s.profile.id);
  const reduced = useSettings((s) => s.reducedMotion);

  const short = seenIntro || reduced;
  const done = useRef(false);

  const enter = () => {
    if (done.current) return;
    done.current = true;
    markIntroSeen();
    audio.unlock();
    audio.startAmbient();
    audio.startMusic();
    navigate(hasProfile ? '/hub' : '/login');
  };

  useEffect(() => {
    const holdMs = short ? 420 : 2400;
    const advance = setTimeout(enter, holdMs);
    const cue = short ? -1 : window.setTimeout(() => audio.play('card'), 420);
    return () => {
      clearTimeout(advance);
      if (cue !== -1) clearTimeout(cue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short]);

  return (
    <div className="intro-root vignette" data-short={short ? '' : undefined}>
      <div className="intro-bg" />

      <div className="auth-frame intro-card">
        <span className="auth-deco-card d0" aria-hidden="true">A♠</span>
        <span className="auth-deco-card d1" aria-hidden="true">K♥</span>
        <div className="glass glass-gold intro-panel">
          <div className="eyebrow">{t('common.tagline')}</div>
          <h1 className="intro-title">ROYAL 21</h1>
        </div>
      </div>

      <button type="button" className="intro-skip" onClick={enter}>
        {t('common.skip')} →
      </button>
    </div>
  );
}
