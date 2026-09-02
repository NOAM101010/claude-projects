import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { LightPool } from '@/components/effects/LightPool';
import { Particles } from '@/components/effects/Particles';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { authService, AuthError, type AuthFailure } from '@/services/authService';
import { accountsService } from '@/services/accountsService';
import { isOnline } from '@/services/supabase';
import { audio } from '@/audio/AudioManager';
import type { AvatarConfig } from '@/types';

type Mode = 'signin' | 'signup' | 'reset' | 'newPassword';

/** The environment keeps moving behind a dark glass panel — never a white page. */
export default function AuthScene() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const setProfile = usePlayer((s) => s.setProfile);
  const requestedMode = params.get('mode') as Mode | null;
  const [mode, setMode] = useState<Mode>(requestedMode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>({ skin: 0, hair: 0, shirt: 'base' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AuthFailure | null>(null);
  const [knownVersion, setKnownVersion] = useState(0);
  const known = useMemo(() => accountsService.list(), [knownVersion]);

  const land = (profile: Parameters<typeof setProfile>[0]) => {
    setProfile(profile);
    // Remember who played here so the next switch is one tap, not a recall test.
    accountsService.remember({
      id: profile.id,
      username: profile.username,
      email: email.trim() || undefined,
      avatar: profile.avatar,
    });
    audio.unlock();
    audio.startAmbient();
    audio.startMusic();
    audio.play('door');
    navigate('/hub');
  };

  const enter = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const profile =
        mode === 'signup'
          ? await authService.signUp(email, password, username || 'Player', avatar)
          : await authService.signIn(email, password);
      land(profile);
    } catch (error) {
      const failure: AuthFailure = error instanceof AuthError ? error.failure : 'unknown';

      /* The account exists and the password was fine — the address just has to
         be confirmed. Reporting that as a failure sent people back to sign up
         again and again against an address that was already taken. */
      if (failure === 'needs-confirmation') {
        setProblem(failure);
        setMode('signin');
        toast(t('auth.err.needs-confirmation'), 'neutral', '✉️');
        return;
      }

      setProblem(failure);
      audio.play('error');
      toast(t(`auth.err.${failure}`), 'bad', '⚠');
    } finally {
      setBusy(false);
    }
  };

  // The recovery link's tokens are already parsed and a session already
  // established by detectSessionInUrl (src/services/supabase.ts) before this
  // fires — it's only the signal to swap into "set a new password".
  useEffect(() => authService.onPasswordRecovery(() => setMode('newPassword')), []);

  const requestReset = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await authService.requestPasswordReset(email);
      toast(t('auth.resetSent'), 'good', '✉️');
      setMode('signin');
    } catch (error) {
      const failure: AuthFailure = error instanceof AuthError ? error.failure : 'unknown';
      setProblem(failure);
      audio.play('error');
      toast(t(`auth.err.${failure}`), 'bad', '⚠');
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await authService.updatePassword(password);
      // The session was already established by the recovery link; just catch
      // usePlayer's profile up to it before landing in the hub.
      await usePlayer.getState().hydrate();
      toast(t('auth.resetSuccess'), 'good', '✅');
      audio.unlock();
      audio.startAmbient();
      audio.startMusic();
      navigate('/hub');
    } catch (error) {
      const failure: AuthFailure = error instanceof AuthError ? error.failure : 'unknown';
      setProblem(failure);
      audio.play('error');
      toast(t(`auth.err.${failure}`), 'bad', '⚠');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-3.5 py-3 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none focus:border-[color:var(--gold-line)]';

  return (
    <motion.div
      className="relative min-h-[100dvh] grid place-items-center px-5 vignette overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 110%, #143024, #0b1410 48%, #08090b 78%)' }} />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <LightPool x="24%" y="18%" size={520} color="rgba(227,178,60,.14)" />
        <LightPool x="78%" y="70%" size={460} color="rgba(46,158,107,.12)" />
      </motion.div>
      <Particles count={14} />

      <GlassPanel gold className="relative z-10 w-full max-w-[420px] p-6">
        <div className="text-center mb-5">
          <div className="eyebrow">ROYAL 21</div>
          <h2 className="mt-1">{t('auth.title')}</h2>
        </div>

        <div className="flex gap-2 mb-5">
          {(['signin', 'signup'] as Mode[]).map((key) => (
            <GameButton
              key={key}
              size="sm"
              block
              tone={mode === key ? 'gold' : 'ghost'}
              onClick={() => setMode(key)}
            >
              {t(key === 'signin' ? 'auth.signIn' : 'auth.signUp')}
            </GameButton>
          ))}
        </div>

        {!isOnline() && (
          <p className="text-[12px] mb-4 p-2.5 rounded-[var(--r-xs)]" style={{ background: 'rgba(168,65,62,.14)', color: 'var(--crimson-hi)' }}>
            {t('auth.offlineNote')}
          </p>
        )}

        {/* Everyone who has played on this device. Tapping one fills the
            address in; the password is never stored, so it is still typed. */}
        {(mode === 'signin' || mode === 'signup') && known.length > 0 && (
          <div className="mb-4">
            <div className="eyebrow mb-2" style={{ fontSize: 9.5 }}>{t('auth.switchAccount')}</div>
            <div className="flex flex-wrap gap-2">
              {known.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="flex items-center gap-2 ps-1 pe-2.5 py-1 rounded-full press"
                  style={{
                    border: `1px solid ${email === account.email ? 'var(--gold-line)' : 'var(--glass-line)'}`,
                    background: email === account.email ? 'rgba(227,178,60,.10)' : 'var(--glass)',
                  }}
                  onClick={() => {
                    if (account.email) setEmail(account.email);
                    setUsername(account.username);
                    setAvatar(account.avatar);
                    setMode('signin');
                  }}
                >
                  <Avatar config={account.avatar} size={22} id={`known-${account.id}`} />
                  <span className="text-[12px] font-bold">{account.username}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t('auth.forgetAccount')}
                    className="text-[11px] opacity-50 hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      accountsService.forget(account.id);
                      setKnownVersion((value) => value + 1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.stopPropagation();
                      accountsService.forget(account.id);
                      setKnownVersion((value) => value + 1);
                    }}
                  >
                    ✕
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {mode === 'reset' ? (
            <input className={field} type="email" placeholder={t('auth.email')} value={email}
              onChange={(event) => setEmail(event.target.value)} />
          ) : mode === 'newPassword' ? (
            <input className={field} type="password" placeholder={t('auth.newPassword')} value={password}
              onChange={(event) => setPassword(event.target.value)} />
          ) : (
            <>
              {mode === 'signup' && (
                <input className={field} placeholder={t('auth.username')} value={username} maxLength={14}
                  onChange={(event) => setUsername(event.target.value)} />
              )}
              <input className={field} type="email" placeholder={t('auth.email')} value={email}
                onChange={(event) => setEmail(event.target.value)} />
              <input className={field} type="password" placeholder={t('auth.password')} value={password}
                onChange={(event) => setPassword(event.target.value)} />
              {mode === 'signin' && (
                <button type="button" className="text-[12px] text-start self-start"
                  style={{ color: 'var(--gold)' }} onClick={() => setMode('reset')}>
                  {t('auth.forgotPassword')}
                </button>
              )}
            </>
          )}
        </div>

        {mode === 'signup' && (
          <>
            <div className="hairline my-5"><span className="eyebrow">{t('auth.pickLook')}</span></div>
            {/* Big live preview */}
            <div className="flex justify-center mb-4">
              <div
                className="rounded-full grid place-items-center"
                style={{
                  width: 100, height: 100,
                  background: 'radial-gradient(circle at 50% 40%, rgba(227,178,60,.25), transparent 70%)',
                  border: '2px solid var(--gold-line)',
                }}
              >
                <Avatar config={avatar} size={84} id="preview" />
              </div>
            </div>

            {/* Skin tone */}
            <div className="mb-3">
              <div className="eyebrow mb-1.5" style={{ fontSize: 9.5 }}>{t('auth.skinTone')}</div>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {[0, 1, 2, 3, 4].map((skin) => (
                  <button
                    key={skin}
                    onClick={() => { audio.play('click'); setAvatar({ ...avatar, skin }); }}
                    className="rounded-full press"
                    style={{ outline: avatar.skin === skin ? '2px solid var(--gold)' : '1px solid rgba(255,255,255,.15)', outlineOffset: 2 }}
                    aria-label={`Skin ${skin + 1}`}
                  >
                    <Avatar config={{ ...avatar, skin, hair: 0, shirt: 'base' }} size={36} id={`pick-skin-${skin}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Hair style */}
            <div className="mb-3">
              <div className="eyebrow mb-1.5" style={{ fontSize: 9.5 }}>{t('auth.hairStyle')}</div>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {[0, 1, 2, 3, 4, 5].map((hair) => (
                  <button
                    key={hair}
                    onClick={() => { audio.play('click'); setAvatar({ ...avatar, hair }); }}
                    className="rounded-full press"
                    style={{ outline: avatar.hair === hair ? '2px solid var(--gold)' : '1px solid rgba(255,255,255,.15)', outlineOffset: 2 }}
                    aria-label={`Hair ${hair + 1}`}
                  >
                    <Avatar config={{ ...avatar, hair }} size={36} id={`pick-hair-${hair}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Shirt color */}
            <div className="mb-1">
              <div className="eyebrow mb-1.5" style={{ fontSize: 9.5 }}>{t('auth.shirtColor')}</div>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {(['base', 'gold', 'royal', 'neon', 'crimson', 'white'] as const).map((shirt) => (
                  <button
                    key={shirt}
                    onClick={() => { audio.play('click'); setAvatar({ ...avatar, shirt }); }}
                    className="rounded-full press"
                    style={{ outline: avatar.shirt === shirt ? '2px solid var(--gold)' : '1px solid rgba(255,255,255,.15)', outlineOffset: 2 }}
                    aria-label={`Shirt ${shirt}`}
                  >
                    <Avatar config={{ ...avatar, shirt }} size={36} id={`pick-shirt-${shirt}`} />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* A toast disappears; the reason you cannot get in should not. */}
        {problem && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-[12px] leading-relaxed p-2.5 rounded-[var(--r-xs)]"
            style={{
              background: problem === 'needs-confirmation' ? 'rgba(46,158,107,.14)' : 'rgba(168,65,62,.14)',
              color: problem === 'needs-confirmation' ? 'var(--jade-hi)' : 'var(--crimson-hi)',
            }}
          >
            {t(`auth.err.${problem}`)}
          </motion.p>
        )}

        <GameButton
          tone="gold" size="lg" block className="mt-6" disabled={busy}
          onClick={mode === 'reset' ? requestReset : mode === 'newPassword' ? submitNewPassword : enter}
        >
          {busy
            ? t('loading.generic')
            : mode === 'reset'
              ? t('auth.sendResetLink')
              : mode === 'newPassword'
                ? t('auth.setNewPassword')
                : t('auth.enter')}
        </GameButton>

        {mode === 'reset' && (
          <button type="button" className="mt-3 w-full text-center text-[12px]" style={{ color: 'var(--muted)' }}
            onClick={() => setMode('signin')}>
            {t('common.back')}
          </button>
        )}
      </GlassPanel>
    </motion.div>
  );
}
