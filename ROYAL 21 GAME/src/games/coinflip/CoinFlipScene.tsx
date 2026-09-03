import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/social/Avatar';
import { ChatPanel } from '@/components/social/ChatPanel';
import { BetSelector } from '@/components/game/BetSelector';
import { CoinFace } from '@/components/game/CoinFace';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { useCoinflipRoom } from '@/stores/useCoinflipRoom';
import { notificationService } from '@/services/notificationService';
import { presenceService, type RoomPresenceMeta } from '@/services/presenceService';
import { useT } from '@/hooks/useT';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useNightScoring } from '@/hooks/useNightScoring';
import { isOnline } from '@/services/supabase';
import { isFriendOnline } from '@/lib/presence';
import { roomsService } from '@/services/roomsService';
import { STAKES, XP_REWARDS } from '@/data/economy';
import { VIP_CHIP_EXTRA, isVipEligible } from '@/data/vip';
import type { CfSide } from '@/games/coinflip/types';
import { fmt } from '@/lib/format';
import { newSeed } from '@/lib/random';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

export default function CoinFlipScene({ mode, roomCode }: Props) {
  return mode === 'room' && roomCode ? <CoinFlipRoom roomCode={roomCode} /> : <CoinFlipSolo />;
}

/** One coin, one choice, one of the shortest loops in the room — unchanged solo economy: call it right, double your stake. */
function CoinFlipSolo() {
  const navigate = useNavigate();
  const { t } = useT();
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('coinflip');
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);

  const [stake, setStake] = useState<number>(100);
  const [side, setSide] = useState<CfSide>('heads');
  const [phase, setPhase] = useState<'bet' | 'flying' | 'result'>('bet');
  const [result, setResult] = useState<CfSide | null>(null);
  const [won, setWon] = useState(false);
  const [streakWin, setStreakWin] = useState(0);
  const [payTableOpen, setPayTableOpen] = useState(false);

  const flip = (amount: number) => {
    if (profile.chips < amount) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(amount - profile.chips) }), 'bad', '⚠');
      return;
    }
    addChips(-amount, { silent: true });
    setStake(amount);
    setPhase('flying');
    setResult(null);
    audio.play('coin');
    haptic('chip');

    const outcome: CfSide = Math.random() < 0.5 ? 'heads' : 'tails';
    setTimeout(() => {
      const isWin = outcome === side;
      setResult(outcome);
      setWon(isWin);
      setPhase('result');
      audio.play('coinLand');
      haptic('land');
      if (isWin) {
        addChips(amount * 2);
        setStreakWin((value) => value + 1);
        audio.play(amount >= 1000 ? 'bigWin' : 'win');
        showMoment({ kind: 'bigWin', title: t('games.youWon', { amount: fmt(amount) }), icon: '🪙', duration: 1600 });
      } else {
        setStreakWin(0);
        audio.play('lose');
      }
      reportNight(isWin ? 'win' : 'lose', isWin ? amount : -amount);
      recordResult('coinflip', isWin ? 'win' : 'lose', isWin ? amount : -amount, {
        cfGames: stats.cfGames + 1,
        cfWins: stats.cfWins + (isWin ? 1 : 0),
        cfLossStreak: isWin ? 0 : stats.cfLossStreak + 1,
      });
      addXp(XP_REWARDS.handPlayed + (isWin ? XP_REWARDS.gameWon : 0));
    }, 2600);
  };

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 10%, #1c1710, #0d0c0a 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="34%" size={680} color="rgba(227,178,60,.2)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-4" style={{ maxWidth: 560 }}>
        <div className="text-center">
          <span className="eyebrow">{t('games.coinflip')}</span>
          <h1 className="mt-1">{t('games.pickSide')}</h1>
        </div>

        {/* the coin */}
        <div className="relative grid place-items-center" style={{ height: 240, perspective: 1000 }}>
          <AnimatePresence>{phase === 'result' && won && <VictoryEffect kind={profile.equipped.victory} />}</AnimatePresence>
          <motion.div
            style={{ width: 168, height: 168, transformStyle: 'preserve-3d', position: 'relative' }}
            animate={
              phase === 'flying'
                ? { rotateX: [0, 1800, 3600 + (result === 'tails' ? 180 : 0)], y: [0, -150, 0] }
                : phase === 'result'
                  ? { rotateX: result === 'tails' ? 180 : 0, y: [0, -12, 0] }
                  : { rotateX: side === 'tails' ? 180 : 0, y: [0, -8, 0] }
            }
            transition={
              phase === 'flying'
                ? { duration: 2.6, ease: [0.25, 0.05, 0.2, 1] }
                : phase === 'result'
                  ? { duration: 0.4 }
                  : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            {(['heads', 'tails'] as CfSide[]).map((face) => (
              <div
                key={face}
                className="absolute inset-0 grid place-items-center"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: face === 'tails' ? 'rotateX(180deg)' : undefined,
                }}
              >
                <CoinFace skin={profile.equipped.coinSkin ?? 'cn-classic'} face={face} size={168} />
              </div>
            ))}
          </motion.div>
          <div className="absolute rounded-full" style={{ bottom: 6, width: 120, height: 16, background: 'rgba(0,0,0,.5)', filter: 'blur(10px)' }} />
        </div>

        {phase === 'result' ? (
          <GlassPanel gold className="p-4 w-full text-center">
            <div className="text-[26px] font-black" style={{ fontFamily: 'var(--font-display)', color: won ? 'var(--gold-hi)' : 'var(--crimson-hi)' }}>
              {t(`games.${result}`)} · {won ? t('blackjack.win') : t('blackjack.lose')}
            </div>
            <p className="mt-1 mb-4 num" style={{ color: 'var(--muted)' }}>
              {won ? `+${fmt(stake)}` : `-${fmt(stake)}`}
              {streakWin > 1 && ` · 🔥 ${streakWin}`}
            </p>
            <div className="flex gap-2">
              <GameButton tone="gold" block onClick={() => { setPhase('bet'); }}>{t('games.rematch')}</GameButton>
              {won && (
                <GameButton tone="jade" block disabled={profile.chips < stake * 2} onClick={() => flip(stake * 2)}>
                  {t('games.doubleOrNothing')}
                </GameButton>
              )}
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel gold className="p-4 w-full">
            <div className="flex gap-2 mb-4">
              {(['heads', 'tails'] as CfSide[]).map((option) => (
                <GameButton key={option} block size="lg" tone={side === option ? 'gold' : 'ghost'}
                  disabled={phase === 'flying'} onClick={() => setSide(option)}>
                  {t(`games.${option}`)}
                </GameButton>
              ))}
            </div>

            <BetSelector
              stakes={STAKES}
              vipStakes={isVipEligible(profile) ? VIP_CHIP_EXTRA : undefined}
              value={stake}
              onChange={setStake}
              chipSkin={profile.equipped.chipSkin}
              disabled={phase === 'flying'}
              chips={profile.chips}
            />

            <GameButton tone="gold" size="lg" block disabled={phase === 'flying' || profile.chips < stake}
              onClick={() => flip(stake)}>
              {t('games.flip')} · {fmt(stake)}
            </GameButton>
          </GlassPanel>
        )}

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setPayTableOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => navigate(nightReturn ?? '/hub')}>
            {nightReturn ? t('night.backToNight') : t('common.back')}
          </GameButton>
        </div>
      </div>

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('games.paytable')}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <span className="text-[22px]">🪙</span>
            <b className="flex-1 text-[13px]">{t('games.cfWin')}</b>
            <b className="num" style={{ color: 'var(--gold-hi)' }}>×2</b>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <span className="text-[22px]">💨</span>
            <b className="flex-1 text-[13px]">{t('games.cfLose')}</b>
            <b className="num" style={{ color: 'var(--muted)' }}>×0</b>
          </div>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>{t('games.cfOdds')}</p>

          <div className="eyebrow mt-3 mb-1">{t('games.cfChainTitle')}</div>
          {[2, 4, 8, 16].map((mult) => (
            <div key={mult} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              <b className="flex-1 text-[13px]" style={{ color: 'var(--muted)' }}>×{mult}</b>
              <b className="num" style={{ color: 'var(--gold-hi)' }}>{fmt(stake * mult)}</b>
            </div>
          ))}

          <p className="mt-2 text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>{t('games.cfFairness')}</p>
        </div>
      </Modal>
    </SceneShell>
  );
}

/** Up to 5 players ante and pick a side; one flip; whoever called it right splits the pot. */
function CoinFlipRoom({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const setLoading = useUI((s) => s.setLoading);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('coinflip');
  const friends = useSocial((s) => s.friends);

  const { room, members, state, isHost, create, joinByCode, send, leave } = useCoinflipRoom();
  const [stake, setStake] = useState(100);
  const [payTableOpen, setPayTableOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const spunRound = useRef(-1);
  const creditedRound = useRef(-1);
  const booting = useRef(false);

  /* Chips optimistically deducted for a pick this round. `send` returning ok
     only means the intent row was inserted — the host can still reject the pick
     (phase already flipped) and then seat.pick comes back null, so the settle
     handler's `!seat.pick` early-return would skip the refund and the stake
     would vanish. On settle we refund whatever we deducted beyond the stake the
     host actually recorded. Additive: it can only return chips. */
  const roundOutlay = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addOutlay = (round: number, delta: number) => {
    if (roundOutlay.current.round !== round) roundOutlay.current = { round, amount: 0 };
    roundOutlay.current.amount += delta;
  };

  /* Stake already handed back optimistically by a clearPick the host hasn't
     confirmed. Kept apart from roundOutlay so the settle reconcile still sees
     the full amount deducted (the clear can drop / arrive out of order and the
     pick stays live and settles as a loss); subtracted from the refund so the
     same stake is never returned twice. */
  const clearRefunded = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addClearRefunded = (round: number, delta: number) => {
    if (clearRefunded.current.round !== round) clearRefunded.current = { round, amount: 0 };
    clearRefunded.current.amount = Math.max(0, clearRefunded.current.amount + delta);
  };

  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      if (booting.current) return;
      booting.current = true;
      setLoading('loading.generic');
      try {
        if (roomCode === 'new') {
          const created = await create(profile.id);
          if (created) navigate(`/game/coinflip/room/${created.code}`, { replace: true });
        } else {
          const joined = await joinByCode(roomCode, profile.id);
          if (!joined) toast(t('rooms.notFound'), 'bad', '⚠');
        }
      } finally {
        setLoading(null);
        booting.current = false;
      }
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const mySeat = state?.seats.find((s) => s.userId === profile.id);
  const joinRetryRef = useRef<NodeJS.Timeout | null>(null);

  /* Host removes any seat whose player dropped out of room membership. */
  useGhostSeatCleanup(isHost, state?.seats, members ?? [],
    (userId) => void send(profile.id, { type: 'leave', userId }));

  /* Auto-run the flip once every seated player has picked a side + staked
     (stake > 0 is the implicit "ready"). Host-only, guarded per round, delayed
     so a late pick sync doesn't trigger a premature flip. */
  const autoFlippedRound = useRef(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'betting') return;
    if (state.seats.length < 2 || !state.seats.every((s) => s.stake > 0)) return;
    if (autoFlippedRound.current === state.round) return;
    const timer = setTimeout(() => {
      autoFlippedRound.current = state.round;
      void send(profile.id, { type: 'flip', nonce: newSeed() });
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.seats.map((s) => `${s.userId}:${s.stake}`).join('|')]);

  /* Auto-open the next betting window a beat after a round settles, clearing
     every pick. Host-only, guarded per round. */
  const autoOpenedRound = useRef(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'settled') return;
    if (autoOpenedRound.current === state.round) return;
    autoOpenedRound.current = state.round;
    const timer = setTimeout(() => {
      if (useCoinflipRoom.getState().state?.phase === 'settled') void send(profile.id, { type: 'openBetting' });
    }, 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round]);

  /* Best-effort leave on tab close + refund a staked pick on any exit before
     the round settles. Mirrors the Blackjack table's leaveCleanup pattern. */
  useEffect(() => {
    if (!room || !mySeat) return;
    const bail = () => { void send(profile.id, { type: 'leave', userId: profile.id }); };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), profile.id]);

  const leaveCleanup = useRef<() => void>(() => {});
  leaveCleanup.current = () => {
    const st = useCoinflipRoom.getState().state;
    if (st && st.phase !== 'settled') {
      const r = st.round;
      const out = roundOutlay.current.round === r ? roundOutlay.current.amount : 0;
      const back = clearRefunded.current.round === r ? clearRefunded.current.amount : 0;
      const refund = out - back;
      if (refund > 0) addChips(refund, { silent: true });
    }
    roundOutlay.current = { round: -1, amount: 0 };
    clearRefunded.current = { round: -1, amount: 0 };
    void leave(profile.id);
    if (isOnline()) void usePlayer.getState().refreshFromServer();
  };
  useEffect(() => () => leaveCleanup.current(), []);

  /* Take a seat once the table exists, with retry for race condition */
  useEffect(() => {
    if (!state || mySeat) {
      if (joinRetryRef.current) clearTimeout(joinRetryRef.current);
      joinRetryRef.current = null;
      return;
    }
    void send(profile.id, { type: 'join', userId: profile.id, username: profile.username, avatar: profile.avatar, level: profile.level });

    // Retry join once after 3s if seat still missing (fixes non-host race condition)
    if (!joinRetryRef.current) {
      joinRetryRef.current = setTimeout(() => {
        joinRetryRef.current = null;
        void send(profile.id, { type: 'join', userId: profile.id, username: profile.username, avatar: profile.avatar, level: profile.level });
      }, 3000);
    }

    return () => {
      if (joinRetryRef.current) clearTimeout(joinRetryRef.current);
    };
  }, [state, mySeat, send, profile]);

  const [spectators, setSpectators] = useState<string[]>([]);
  useEffect(() => {
    if (!room) return;
    const meta: RoomPresenceMeta = { username: profile.username, presence: 'roulette', game: 'coinflip', spectator: false };
    const conn = presenceService.track(room.id, profile.id, meta);
    conn.onSync((s) => {
      setSpectators(Object.values(s).map((e) => e[0]).filter((m): m is RoomPresenceMeta => Boolean(m?.spectator)).map((m) => m.username));
    });
    return conn.unsubscribe;
  }, [room?.id, profile.id, profile.username]);

  /* Settled round: hold the reveal for a beat, same suspense pattern as Roulette's wheel. */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || state.result === null) return;
    if (spunRound.current === state.round) return;
    spunRound.current = state.round;
    setFlipping(true);
    audio.play('coin');
    const id = setTimeout(() => {
      setFlipping(false);
      if (creditedRound.current === state.round) return;
      creditedRound.current = state.round;
      const seat = state.seats.find((s) => s.userId === profile.id);
      // Refund any stake the host never recorded (pick rejected at the
      // betting→flip boundary). Must run before the no-pick early return below,
      // or a rejected pick silently eats the chips.
      const authStake = seat?.pick ? seat.stake : 0;
      const clearedBack = clearRefunded.current.round === state.round ? clearRefunded.current.amount : 0;
      if (roundOutlay.current.round === state.round) {
        const rejected = roundOutlay.current.amount - authStake - clearedBack;
        if (rejected > 0) addChips(rejected, { silent: true });
        roundOutlay.current = { round: -1, amount: 0 };
      }
      if (clearRefunded.current.round === state.round) clearRefunded.current = { round: -1, amount: 0 };
      if (!seat || !seat.pick) return;
      const payout = seat.net + seat.stake;
      if (payout > 0) {
        addChips(payout);
        audio.play(payout >= stake * 4 ? 'bigWin' : 'win');
        haptic('win');
      } else if (seat.net < 0) {
        audio.play('lose');
      }
      reportNight(seat.net > 0 ? 'win' : seat.net < 0 ? 'lose' : 'push', seat.net);
      recordResult('coinflip', seat.net > 0 ? 'win' : seat.net < 0 ? 'lose' : 'push', seat.net);
      addXp(XP_REWARDS.handPlayed + (seat.net > 0 ? XP_REWARDS.gameWon : 0));
    }, 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  const link = useMemo(() => (room ? `${window.location.origin}/game/coinflip/room/${room.code}` : ''), [room]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); audio.play('click'); toast(t('common.copied'), 'good', '📋'); }
    catch { toast(text, 'neutral'); }
  };

  const pick = (side: CfSide) => {
    if (!state || state.phase !== 'betting') return;
    // Guard against a rapid double-tap racing the seat's pick update — before
    // this, both taps fired addChips(-stake) but the reducer only records one
    // stake, so on flip the refund was short a full stake.
    if (mySeat?.pick) return;
    if (profile.chips < stake) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    audio.play('chip');
    haptic('chip');
    addChips(-stake, { silent: true });
    addOutlay(state.round, stake);
    void send(profile.id, { type: 'pick', userId: profile.id, side, amount: stake }).then((ok) => {
      // Rate-limit / network drop: refund locally so the stake doesn't
      // silently disappear when the pick never made it to the table.
      if (!ok) {
        addChips(stake, { silent: true });
        addOutlay(state.round, -stake);
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const clearPick = () => {
    if (!state) return;
    // Betting closed: clear is a no-op — settle reconciles any optimistic outlay.
    // Refunding here would double-credit against the settle payout/refund (over-credit bug).
    if (state.phase !== 'betting') return;
    // Refund what this client optimistically staked, not what the (possibly
    // un-synced) seat shows — for a non-host player the pick round-trips through
    // the host, so mySeat.pick can still be null here and the old guard would
    // skip the refund, eating the stake.
    const outlayAmt = roundOutlay.current.round === state.round ? roundOutlay.current.amount : 0;
    const refundedSoFar = clearRefunded.current.round === state.round ? clearRefunded.current.amount : 0;
    const outstanding = outlayAmt - refundedSoFar;
    const refund = outstanding > 0 ? outstanding : (mySeat?.pick ? mySeat.stake : 0);
    if (refund <= 0) return;
    addChips(refund, { silent: true });
    // Keep the outlay intact (no addOutlay(-refund)) so a clear the host never
    // applies is still reconciled at settle; addClearRefunded offsets the double-count.
    addClearRefunded(state.round, refund);
    void send(profile.id, { type: 'clearPick', userId: profile.id });
  };

  const handleFlip = () => { audio.play('door'); void send(profile.id, { type: 'flip', nonce: newSeed() }); };
  const handleNewRound = () => void send(profile.id, { type: 'openBetting' });

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🔑</div>
          <h2>{t('games.coinflip')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="gold" onClick={() => navigate(isOnline() ? '/login' : '/hub')}>{t(isOnline() ? 'auth.signIn' : 'common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  const picked = state.seats.filter((s) => s.pick);
  const phase = state.phase;
  const canPick = phase === 'betting' && !mySeat?.pick;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 10%, #1c1710, #0d0c0a 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="20%" size={680} color="rgba(227,178,60,.2)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 620 }}>
        <div className="text-center">
          <span className="eyebrow">{t('games.coinflip')} · {t('duel.short')}</span>
          <h1 className="mt-1">{room.code}</h1>
        </div>

        <GlassPanel gold className="p-3 w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {state.seats.map((seat) => (
              <div key={seat.userId} className="relative">
                <Avatar config={seat.avatar} size={30} level={seat.level} id={`cf-${seat.userId}`} />
                <span className="absolute -bottom-0.5 -end-0.5 rounded-full" style={{ width: 10, height: 10, background: seat.color, border: '2px solid var(--ink)' }} />
                {seat.pick && (
                  <span className="absolute -top-1.5 -start-1.5 text-[11px]">{seat.pick === 'heads' ? '🙂' : '🌀'}</span>
                )}
              </div>
            ))}
            {spectators.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--muted)' }}>
                👁 {spectators.length}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <GameButton size="sm" tone="metal" onClick={() => copy(room.code)}>{t('rooms.copyCode')}</GameButton>
            <GameButton size="sm" tone="metal" onClick={() => copy(link)}>{t('rooms.copyLink')}</GameButton>
          </div>
        </GlassPanel>

        {!!state.history.length && (
          <div className="flex gap-1.5 overflow-x-auto w-full px-1" style={{ scrollbarWidth: 'none' }}>
            {state.history.map((side, i) => (
              <span key={i} className="shrink-0 rounded-full flex items-center justify-center num"
                style={{ width: 22, height: 22, fontSize: 11, background: 'rgba(255,255,255,.06)', opacity: i === 0 ? 1 : 0.6 }}>
                {side === 'heads' ? '🙂' : '🌀'}
              </span>
            ))}
          </div>
        )}

        {/* the coin */}
        <div className="relative grid place-items-center" style={{ height: 200, perspective: 1000 }}>
          <motion.div
            style={{ width: 140, height: 140, transformStyle: 'preserve-3d', position: 'relative' }}
            animate={flipping ? { rotateX: [0, 1440, 1800], y: [0, -110, 0] } : { rotateX: state.result === 'tails' ? 180 : 0 }}
            transition={flipping ? { duration: 1.8, ease: [0.25, 0.05, 0.2, 1] } : { duration: 0.4 }}
          >
            {(['heads', 'tails'] as CfSide[]).map((face) => (
              <div key={face} className="absolute inset-0 grid place-items-center"
                style={{ backfaceVisibility: 'hidden', transform: face === 'tails' ? 'rotateX(180deg)' : undefined }}>
                <CoinFace skin={profile.equipped.coinSkin ?? 'cn-classic'} face={face} size={140} />
              </div>
            ))}
          </motion.div>
          <AnimatePresence>
            {phase === 'settled' && !flipping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute -bottom-2 px-4 py-2 rounded-[var(--r-sm)] text-center"
                style={{ background: 'rgba(8,9,11,.85)', border: '1px solid var(--gold-line)' }}
              >
                <b>{t(`games.${state.result}`)}</b>
                {mySeat?.pick && (
                  <span className="ms-2" style={{ color: mySeat.net > 0 ? 'var(--gold-hi)' : 'var(--muted)' }}>
                    {mySeat.net > 0 ? `+${fmt(mySeat.net)}` : mySeat.net < 0 ? fmt(mySeat.net) : t('blackjack.push')}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {friends.filter((f) => isFriendOnline(f) && !f.currentGame).length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {friends.filter((f) => isFriendOnline(f) && !f.currentGame).slice(0, 6).map((friend) => (
              <GameButton key={friend.id} size="sm" tone="ghost" onClick={async () => {
                await notificationService.invite(profile.id, friend.id, room.code, 'coinflip');
                toast(t('friends.requestSent', { name: friend.username }), 'good', '🎮');
              }}>
                ＋ {friend.username}
              </GameButton>
            ))}
          </div>
        )}

        {/* controls */}
        <GlassPanel gold className="p-4 w-full">
          {phase === 'betting' ? (
            <>
              <div className="flex gap-2 mb-3">
                {(['heads', 'tails'] as CfSide[]).map((option) => (
                  <GameButton key={option} block size="lg" tone={mySeat?.pick === option ? 'gold' : 'ghost'} disabled={!canPick} onClick={() => pick(option)}>
                    {t(`games.${option}`)}
                  </GameButton>
                ))}
              </div>
              <BetSelector stakes={STAKES} vipStakes={isVipEligible(profile) ? VIP_CHIP_EXTRA : undefined} value={stake} onChange={setStake} chipSkin={profile.equipped.chipSkin} disabled={!canPick} chips={profile.chips} />
              <div className="flex gap-2">
                <GameButton tone="ghost" block disabled={phase !== 'betting' || !mySeat?.pick} onClick={clearPick}>{t('blackjack.clear')}</GameButton>
                <GameButton tone="gold" block disabled={!isHost || picked.length < 2} onClick={handleFlip}>{t('games.flip')}</GameButton>
              </div>
              {!isHost && <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>}
              {isHost && picked.length < 2 && <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--dim)' }}>{t('roulette.needPlayers')}</p>}
            </>
          ) : phase === 'waiting' ? (
            <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>{t('rooms.waitingForPlayers')}</p>
          ) : (
            <GameButton tone="gold" block disabled={flipping || !isHost} onClick={handleNewRound}>{t('roulette.newRound')}</GameButton>
          )}
        </GlassPanel>

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setPayTableOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => navigate(nightReturn ?? '/hub')}>
            {nightReturn ? t('night.backToNight') : t('common.back')}
          </GameButton>
        </div>
      </div>

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('games.paytable')}>
        <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{t('games.cfPoolNote')}</p>
      </Modal>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
