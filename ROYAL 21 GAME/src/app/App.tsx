import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { AppRoutes } from './routes';
import { Toasts } from '@/components/ui/Toasts';
import { Loading } from '@/components/ui/Loading';
import { MomentLayer } from '@/components/effects/MomentLayer';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { AppBackdrop } from '@/components/layout/AppBackdrop';
import { FriendsPanel } from '@/components/social/FriendsPanel';
import { NotificationsPanel } from '@/components/social/NotificationsPanel';
import { WeeklyPodiumPanel } from '@/components/social/WeeklyPodiumPanel';
import { MissionsPanel } from '@/components/social/MissionsPanel';
import { InviteOverlay } from '@/components/social/InviteOverlay';
import { ChipsPanel } from '@/components/layout/ChipsPanel';
import { SettingsPanel } from '@/components/layout/SettingsPanel';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { usePlayer } from '@/stores/usePlayer';
import { useSettings } from '@/stores/useSettings';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { audio } from '@/audio/AudioManager';
import { profileService } from '@/services/profileService';
import { roomsService } from '@/services/roomsService';
import { authService } from '@/services/authService';
import { analytics } from '@/services/analyticsService';
import { playtimeService } from '@/services/playtimeService';
import { db, isRemoteId } from '@/services/supabase';
import { captureRefFromUrl, referralService } from '@/services/referralService';
import { fmt } from '@/lib/format';
import { useT } from '@/hooks/useT';
import type { GameKey, Presence } from '@/types';

/** Which part of the world a route belongs to — drives presence and audio zones. */
function zoneOf(pathname: string): { presence: Presence; game: GameKey | null; zone: 'hub' | 'blackjack' | 'slots' | 'vault' } {
  if (pathname.startsWith('/blackjack')) return { presence: 'blackjack', game: 'blackjack', zone: 'blackjack' };
  if (pathname.startsWith('/poker/sng')) return { presence: 'blackjack', game: 'sng', zone: 'blackjack' };
  if (pathname.startsWith('/poker')) return { presence: 'blackjack', game: 'poker', zone: 'blackjack' };
  if (pathname.startsWith('/game/highcard')) return { presence: 'roulette', game: 'highcard', zone: 'blackjack' };
  if (pathname.startsWith('/vault')) return { presence: 'hub', game: null, zone: 'vault' };
  return { presence: 'hub', game: null, zone: 'hub' };
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const hydrateSettings = useSettings((s) => s.hydrate);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const hydratePlayer = usePlayer((s) => s.hydrate);
  const profile = usePlayer((s) => s.profile);
  const ready = usePlayer((s) => s.ready);
  const loading = useUI((s) => s.loading);
  const listen = useSocial((s) => s.listen);
  const refresh = useSocial((s) => s.refresh);

  useEffect(() => {
    hydrateSettings();
    void hydratePlayer();
    // Capture ?ref=... on first load so we can claim it once the user signs in.
    captureRefFromUrl();
  }, [hydrateSettings, hydratePlayer]);

  /* Once the profile is loaded, try to claim any pending referral. This runs
     on every profile change (a fresh sign-in shows up here) — the RPC is
     idempotent, so a repeat call for a claim that already went through is
     a no-op. */
  useEffect(() => {
    if (!profile.id || !ready) return;
    void referralService.attemptClaim(profile.id).then((result) => {
      if (!result.ok || !result.bonusChips) return;
      // Credit locally so the HUD updates immediately (server has it already).
      usePlayer.getState().addChips(result.bonusChips, { silent: true });
      useUI.getState().showMoment({
        kind: 'bigWin',
        title: t('friends.inviteBonus'),
        subtitle: `+${fmt(result.bonusChips)}`,
        icon: '🎁',
        duration: 2600,
      });
      analytics.track('referral_claimed', { bonus: result.bonusChips });
    });

    // Staged referral rewards — the referred friend hitting level 5 (both
    // sides), and the referrer's tier milestones. Both RPCs are idempotent.
    void referralService.claimStage2(profile.id).then((result) => {
      if (!result.ok || !result.bonusChips) return;
      usePlayer.getState().addChips(result.bonusChips, { silent: true });
      useUI.getState().showMoment({
        kind: 'bigWin',
        title: t('friends.inviteMilestone'),
        subtitle: `+${fmt(result.bonusChips)}`,
        icon: '🎁',
        duration: 2600,
      });
      analytics.track('referral_stage2', { bonus: result.bonusChips });
    });
    void referralService.claimReferrerTier(profile.id).then((result) => {
      if (!result.ok || !result.bonusChips) return;
      usePlayer.getState().addChips(result.bonusChips, { silent: true });
      useUI.getState().showMoment({
        kind: 'bigWin',
        title: t('friends.referrerTier'),
        subtitle: `+${fmt(result.bonusChips)}`,
        icon: '🎉',
        duration: 2600,
      });
      analytics.track('referrer_tier', { tier: result.tier, bonus: result.bonusChips });
    });
  }, [profile.id, ready, t]);

  /* A session can end without anyone clicking anything — a refresh token that
     expired while the tab slept, or a sign-out in another tab. Nothing used to
     notice: the store kept the profile, the HUD kept drawing it, and every
     request went out under an id the server no longer recognised, so the shop
     and stats failed with no visible cause. Notice, and send them to the door. */
  useEffect(() => {
    return authService.onSessionLost(() => {
      if (!usePlayer.getState().profile.id) return;
      void usePlayer.getState().signOut().then(() => {
        useUI.getState().toast(t('auth.err.session-expired'), 'bad', '⚠');
        navigate('/login?mode=signin', { replace: true });
      });
    });
  }, [navigate, t]);

  /* Audio needs a gesture; the first tap anywhere unlocks and starts the room
     tone. The listeners used to be `{ once: true }`, which spent the only
     attempt on a gesture the browser might still refuse — one failed resume and
     the session stayed silent. They now stay attached until the context is
     genuinely running, then detach themselves. */
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    const start = () => {
      audio.unlock();
      audio.startAmbient();
      audio.startMusic();
      if (audio.ready) events.forEach((event) => window.removeEventListener(event, start));
    };
    events.forEach((event) => window.addEventListener(event, start));
    return () => events.forEach((event) => window.removeEventListener(event, start));
  }, []);

  // Social feed + presence follow the player around the world.
  useEffect(() => {
    if (!profile.id) return;
    void refresh(profile.id);
    return listen(profile.id);
  }, [profile.id, listen, refresh]);

  /* Same account on two devices used to drift silently — device A's balance
     only pushed deltas up, it never pulled what device B had done. When the
     tab becomes visible again (foreground on mobile, alt-tab back on
     desktop) we ask the server for the authoritative balance and adopt it,
     so returning to the tab always shows real money, not stale local math. */
  useEffect(() => {
    if (!profile.id) return;
    // visibilitychange fires on both tab focus and window focus in modern
    // browsers; window.focus would double-fire and race two restore() calls
    // against each other. Keep just the one signal.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void usePlayer.getState().refreshFromServer();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile.id]);

  /* Lifetime play-time. Count only foreground seconds (paused while the tab is
     hidden) and flush the tally to the server every minute, plus once more when
     the tab is backgrounded or closed. add_playtime() clamps each call to an
     hour, so a dropped flush is a rounding error. Signed-in accounts only. */
  const playtimePending = useRef(0);
  const accessToken = useRef<string | null>(null);
  useEffect(() => {
    if (!isRemoteId(profile.id)) return;
    const uid = profile.id;
    void db()?.auth.getSession().then(({ data }) => { accessToken.current = data.session?.access_token ?? null; });

    const flush = () => {
      const secs = playtimePending.current;
      if (secs <= 0) return;
      playtimePending.current = 0;
      void playtimeService.flush(uid, secs);
    };
    const beacon = () => {
      const secs = playtimePending.current;
      if (secs <= 0) return;
      playtimePending.current = 0;
      playtimeService.flushBeacon(uid, secs, accessToken.current);
    };

    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') playtimePending.current += 1;
    }, 1000);
    const minute = setInterval(() => {
      void db()?.auth.getSession().then(({ data }) => { accessToken.current = data.session?.access_token ?? null; });
      flush();
    }, 60_000);
    const onHide = () => { if (document.visibilityState === 'hidden') beacon(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', beacon);

    return () => {
      clearInterval(tick);
      clearInterval(minute);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', beacon);
      flush();
    };
  }, [profile.id]);

  /* Presence heartbeat. The route-change write below sets presence once; without
     a repeat, a tab that closes without the pagehide beacon landing shows
     "online" to friends forever. A Worker-backed ticker keeps beating even when
     the tab is backgrounded (setInterval is throttled to ~1/min there). The
     freshness gate (lib/presence.ts) is the real safety net at 60s; this keeps
     an active player looking active, and drops them the moment they leave. */
  useEffect(() => {
    if (!isRemoteId(profile.id)) return;
    const uid = profile.id;
    let token: string | null = null;
    void db()?.auth.getSession().then(({ data }) => { token = data.session?.access_token ?? null; });

    const beat = () => {
      // Keep the token warm so a later pagehide beacon can authenticate even if
      // the tab closes seconds after load.
      if (!token) void db()?.auth.getSession().then(({ data }) => { token = data.session?.access_token ?? null; });
      const { presence, game } = zoneOf(window.location.pathname);
      const visible = useSettings.getState().showPresence;
      void profileService.setPresence(uid, visible ? presence : 'offline', visible ? game : null);
    };
    const goOffline = () => profileService.offlineBeacon(uid, token);

    const stop = roomsService.startTicker(25_000, beat);
    beat();

    const onHide = () => {
      if (document.visibilityState === 'hidden') goOffline();
      else beat();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', goOffline);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', goOffline);
    };
  }, [profile.id]);

  useEffect(() => {
    if (!profile.id) return;
    const { presence, game, zone } = zoneOf(location.pathname);
    audio.setZone(zone);
    const visible = useSettings.getState().showPresence;
    void profileService.setPresence(profile.id, visible ? presence : 'offline', visible ? game : null);
    analytics.track('page_view', { path: location.pathname, zone });
  }, [location.pathname, profile.id]);

  // Deep link: /room/CODE opens the door straight into the room after sign-in.
  useEffect(() => {
    if (!ready) return;
    const isEntry = location.pathname === '/' || location.pathname === '/login';
    if (profile.id && isEntry && sessionStorage.getItem('royal21.next')) {
      const next = sessionStorage.getItem('royal21.next')!;
      sessionStorage.removeItem('royal21.next');
      navigate(next, { replace: true });
    }
  }, [ready, profile.id, location.pathname, navigate]);

  /* "Reduced motion" used to set a CSS data attribute and nothing else, so the
     setting quietly did almost nothing: every framer animation in the game —
     scene transitions, dealt cards, spinning reels — ran at full travel
     regardless. MotionConfig is what actually makes framer honour it. */
  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
      <AppBackdrop />
      <AmbientBackground />
      <AnimatePresence mode="wait">
        <AppRoutes key={location.pathname.split('/').slice(0, 3).join('/')} />
      </AnimatePresence>
      <ConnectionBanner />
      <FriendsPanel />
      <NotificationsPanel />
      <WeeklyPodiumPanel />
      <MissionsPanel />
      <ChipsPanel />
      <SettingsPanel />
      <InviteOverlay />
      <MomentLayer />
      <ConfirmModal />
      <Toasts />
      {loading && <Loading label={t(loading)} />}
    </MotionConfig>
  );
}
