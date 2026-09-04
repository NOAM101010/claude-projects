import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/social/Avatar';
import { Chip } from '@/components/game/Chip';
import { LightPool } from '@/components/effects/LightPool';
import { RouletteWheel } from './RouletteWheel';
import { BettingTable } from './BettingTable';
import { BET_PAYOUTS, isRed, seatStake } from '@/games/roulette/engine';
import type { RouletteBetKind } from '@/games/roulette/types';
import { useRouletteRoom } from '@/stores/useRouletteRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { isOnline } from '@/services/supabase';
import { roomsService } from '@/services/roomsService';
import { presenceService } from '@/services/presenceService';
import { STAKES, XP_REWARDS } from '@/data/economy';
import { VIP_CHIP_EXTRA, isVipEligible } from '@/data/vip';
import { fmt } from '@/lib/format';
import { newSeed } from '@/lib/random';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { roomBackgroundOf } from '@/data/roomThemes';
import { DEFAULT_TABLE_SKIN } from '@/data/items';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

/** Backup countdown: once the first player at the table hits "done betting",
 *  everyone else has this long before the round locks and spins automatically —
 *  so one idle player can't stall the table forever. */
const READY_WINDOW_MS = 15_000;
/* Head-start the host gives the published spin state to reach remote clients, so
   every table starts its wheel at roughly the same wall-clock instant and the
   number surfaces together (no host-first reveal). Solo play skips it. */
const REVEAL_SYNC_MS = 500;

const PAYTABLE_ROWS: { kind: RouletteBetKind; labelKey: string }[] = [
  { kind: 'straight', labelKey: 'roulette.betStraight' },
  { kind: 'street', labelKey: 'roulette.betStreet' },
  { kind: 'corner', labelKey: 'roulette.betCorner' },
  { kind: 'column', labelKey: 'roulette.betColumn' },
  { kind: 'dozen', labelKey: 'roulette.betDozen' },
  { kind: 'red', labelKey: 'roulette.betEven' },
];

export default function RouletteScene({ mode, roomCode }: Props) {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);
  const setLoading = useUI((s) => s.setLoading);

  const { state, send, room, members, isHost, startSolo, create, joinByCode, leave } = useRouletteRoom();

  const [stake, setStake] = useState<number>(100);
  const [payTableOpen, setPayTableOpen] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const spunRound = useRef(-1);
  const spinScheduledFor = useRef(-1);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creditedRound = useRef(-1);
  const autoOpenedRound = useRef(-1);

  /* Chips a guest optimistically deducted for bets this round. The host is the
     authority on which bets actually landed — a bet inserted just as the
     betting window closes can still be rejected by the reducer (phase already
     'spinning'), and `send` returning ok only means the row was inserted, not
     applied. On settle we compare this outlay against the authoritative seat
     stake and refund the difference, so a rejected bet never quietly eats the
     player's chips. Additive and side-safe: it can only ever return chips. */
  const roundOutlay = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addOutlay = (round: number, delta: number) => {
    if (roundOutlay.current.round !== round) roundOutlay.current = { round, amount: 0 };
    roundOutlay.current.amount += delta;
  };

  /* How much of this round's outlay we've already handed back optimistically via
     a "clear" the host hasn't confirmed yet. Tracked apart from roundOutlay so
     the settle-time reconcile still sees the FULL amount this client deducted —
     a clearBets can be dropped, rate-limited or arrive out of order and the bet
     stays live on the seat and settles as a loss. This value is then subtracted
     from the computed refund so the same stake is never returned twice. */
  const clearRefunded = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addClearRefunded = (round: number, delta: number) => {
    if (clearRefunded.current.round !== round) clearRefunded.current = { round, amount: 0 };
    clearRefunded.current.amount = Math.max(0, clearRefunded.current.amount + delta);
  };

  const mySeat = state?.seats.find((s) => s.userId === profile.id);
  const myStake = mySeat ? seatStake(mySeat) : 0;
  /*
   * The engine writes the winning number (and settles net/history) the instant the
   * spin resolves — well before this client's own wheel finishes its ~4.2s animation.
   * `creditedRound` only updates once the animation genuinely completes, so reading
   * it here (a ref, not state-via-effect) can't lag a render behind the state change
   * the way `wheelSpinning` does — that lag is exactly what let the number leak for
   * one frame before the fix.
   */
  const pendingReveal = !!state && (state.phase === 'spinning' || state.phase === 'settled') && creditedRound.current !== state.round;
  const visibleHistory = pendingReveal ? (state?.history ?? []).slice(1) : (state?.history ?? []);

  /* ---------------------------------------------------------- connect ---- */
  useEffect(() => {
    const boot = async () => {
      if (mode === 'solo') { startSolo(); return; }
      if (!roomCode) return;
      setLoading('loading.generic');
      if (roomCode === 'new') {
        const created = await create(profile.id);
        if (created) navigate(`/game/roulette/room/${created.code}${window.location.search}`, { replace: true });
      } else if (room?.code !== roomCode) {
        const joined = await joinByCode(roomCode, profile.id);
        if (!joined) toast(t('rooms.notFound'), 'bad', '⚠');
      }
      setLoading(null);
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, roomCode]);

  /* Take a seat once the table exists. */
  useEffect(() => {
    if (!state || mySeat) return;
    void send(profile.id, {
      type: 'join', userId: profile.id, username: profile.username,
      avatar: profile.avatar, level: profile.level,
    });
  }, [state, mySeat, send, profile]);

  /* Table presence — so the Lobby only lists this table while someone is actually seated at it. */
  useEffect(() => {
    if (mode !== 'room' || !room) return;
    const conn = presenceService.track(room.id, profile.id, {
      username: profile.username, presence: 'roulette', game: 'roulette', spectator: Boolean(mySeat?.spectator),
    });
    return conn.unsubscribe;
  }, [mode, room?.id, profile.id, profile.username, mySeat?.spectator]);

  /* Host removes any seat whose player dropped out of room membership. */
  useGhostSeatCleanup(mode === 'room' && isHost, state?.seats, members ?? [],
    (userId) => void send(profile.id, { type: 'leave', userId }));

  /* Best-effort leave on tab close + refund on any exit mid-round. Mirrors the
     Blackjack table's leaveCleanup pattern: a bet only ever *staged* this round
     (outlay minus whatever a clear already handed back) is refunded when the
     player walks away before the wheel settles; a settled round is left alone
     (the settle handler already reconciled it). */
  useEffect(() => {
    if (mode !== 'room' || !room || !mySeat) return;
    const bail = () => { void send(profile.id, { type: 'leave', userId: profile.id }); };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), mode, profile.id]);

  const leaveCleanup = useRef<() => void>(() => {});
  leaveCleanup.current = () => {
    if (mode !== 'room') return;
    const st = useRouletteRoom.getState().state;
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

  /* A settled round: spin the wheel locally to the number the engine already
     picked. The guard is decoupled from the schedule — `spunRound` is only
     bumped INSIDE the timeout callback, and the pending timer is NEVER cleared
     on a re-render (only on unmount). Previously the effect ran on every `state`
     frame and its cleanup killed the pending timer, so any inbound frame during
     the short start-delay (host re-publish, another player's presence write, a
     late realtime frame) cancelled the spin and it was never re-armed — the
     non-host's wheel just never turned. */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || state.winningNumber === null) return;
    if (spunRound.current === state.round || spinScheduledFor.current === state.round) return;
    spinScheduledFor.current = state.round;
    const round = state.round;
    // Align the wheel start to `state.spinAt` (host wall clock). Cross-client
    // clock skew can make `Date.now() - spinAt` negative or huge, so clamp the
    // delay to [0, REVEAL_SYNC_MS] — the reveal sync only needs to be roughly
    // simultaneous, never exact.
    const spinAt = state.spinAt ?? Date.now();
    const startDelay = mode === 'solo'
      ? 0
      : Math.min(REVEAL_SYNC_MS, Math.max(0, REVEAL_SYNC_MS - (Date.now() - spinAt)));
    spinTimer.current = setTimeout(() => {
      spinTimer.current = null;
      if (spunRound.current === round) return;
      spunRound.current = round;
      setWheelSpinning(true);
      audio.play('coin');
    }, startDelay);
  }, [state]);

  /* Clear the pending spin timer only when the scene actually unmounts — and
     reset the "scheduled" latch so a StrictMode remount re-schedules. */
  useEffect(() => () => {
    if (spinTimer.current) { clearTimeout(spinTimer.current); spinTimer.current = null; }
    spinScheduledFor.current = -1;
  }, []);

  const seatedPlayers = state?.seats.filter((s) => !s.spectator) ?? [];
  const realPlayerCount = seatedPlayers.length;
  /* "Done betting" declarations — the round locks only once every seated
     (non-spectator) player has pressed it (or the backup countdown runs out).
     readyCount is a dependency of the host arm/lock effects so they re-run the
     moment a declaration lands (phase/deadline/round don't change on a `ready`). */
  const readyCount = seatedPlayers.filter((s) => s.ready).length;

  /* Betting window countdown. Once someone declares "done betting" the host arms
     a 15s backup window; when it (or the "everyone's done" gate) closes, the
     host's client locks and spins. Without it a host who bets first could close
     a round before anyone else got a bet down. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state || state.phase !== 'betting' || !state.deadline) return;
    const tick = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(tick);
  }, [state?.phase, state?.deadline]);
  /* Auto-spin when the betting window closes. Guarded by a ref keyed to the
     round so a rejected spin (nobody bet, reducer returns prev and leaves
     state.deadline in the past) doesn't fire again on every 400ms tick — that
     used to spam a spin intent per tick, wasting rate-limit budget and
     realtime traffic. */
  const lockedRound = useRef<number>(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'betting' || !state.deadline) return;
    if (lockedRound.current === state.round) return;
    const inPlay = state.seats.filter((s) => !s.spectator);
    const everyoneReady = inPlay.length >= 2 && inPlay.every((s) => s.ready);
    const hasBets = state.seats.some((s) => s.bets.length > 0);
    // Lock as soon as everyone's declared done — or when the backup window runs
    // out. lockBets is a no-op on an empty table, so a table nobody bet into
    // stays open (the arm effect re-arms it) instead of stranding in `locked`.
    if ((everyoneReady && hasBets) || Date.now() >= state.deadline) {
      lockedRound.current = state.round;
      void send(profile.id, { type: 'lockBets' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.deadline, state?.round, readyCount, now]);
  const bettingSecondsLeft = state?.phase === 'betting' && state?.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;

  /* Host arms the betting window on any multi-seat round that opened without one
     (the very first spin, or a second player joining mid-single-player). Also
     re-arms a window that expired with nobody betting, so the table can't stall
     in `betting` past a dead deadline. Guarded so it fires at most once per
     round while empty, and no more than every ~1.5s while refreshing. */
  const armedRound = useRef<number>(-1);
  const lastRearm = useRef<number>(0);
  useEffect(() => {
    if (mode !== 'room' || !isHost || !state) return;
    if (state.phase !== 'betting' || realPlayerCount <= 1) return;
    const hasBets = state.seats.some((s) => s.bets.length > 0);
    // The backup countdown only starts once at least one seated player has
    // pressed "done betting" — until then the round waits indefinitely for the
    // table (there is no host short-circuit any more).
    const anyReady = state.seats.some((s) => !s.spectator && s.ready);
    if (!state.deadline) {
      if (!anyReady || armedRound.current === state.round) return;
      armedRound.current = state.round;
      void send(profile.id, { type: 'armWindow', deadline: Date.now() + READY_WINDOW_MS });
      return;
    }
    if (!hasBets && Date.now() >= state.deadline && Date.now() - lastRearm.current > 1500) {
      lastRearm.current = Date.now();
      void send(profile.id, { type: 'armWindow', deadline: Date.now() + READY_WINDOW_MS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isHost, state?.phase, state?.deadline, state?.round, realPlayerCount, readyCount, now]);

  /* Once the window is locked, the host spins after a short beat so the
     "bets locked" flash is visible. Guarded per round. */
  const autoSpunRound = useRef<number>(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'locked') return;
    if (autoSpunRound.current === state.round) return;
    autoSpunRound.current = state.round;
    const timer = setTimeout(() => {
      void send(profile.id, { type: 'spin', nonce: newSeed() });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round]);

  /* Auto-continue: a few seconds after a round settles — long enough for every
     client's wheel + reveal + payout to finish — the host opens the next
     betting window with NO deadline, so the "all players bet in" gate governs
     when it arms (and openBetting clears every `ready` flag). The manual "new
     round" button stays as a host short-circuit. */
  useEffect(() => {
    if (mode !== 'room' || !isHost || !state || state.phase !== 'settled') return;
    if (autoOpenedRound.current === state.round) return;
    autoOpenedRound.current = state.round;
    const round = state.round;
    const timer = setTimeout(() => {
      const st = useRouletteRoom.getState().state;
      if (st?.phase === 'settled' && st.round === round) {
        void send(profile.id, { type: 'openBetting', deadline: null });
      }
    }, 7500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isHost, state?.phase, state?.round]);

  /* Snapshot my payout the instant the round settles server-side, so a
     race — another player rushing to open a new round while my wheel is
     still spinning — can't wipe seat.net back to 0 before I've credited
     the win. Without this, the loser of that race lost every winning
     bet from the round. Keyed by (round, phase==='settled') so it fires
     exactly once per round even under StrictMode remounts. */
  const pendingPayout = useRef<{ round: number; payout: number; net: number } | null>(null);
  useEffect(() => {
    if (!state || state.phase !== 'settled' || !mySeat) return;
    if (creditedRound.current === state.round) return;
    if (pendingPayout.current?.round === state.round) return;
    pendingPayout.current = {
      round: state.round,
      payout: mySeat.net + seatStake(mySeat),
      net: mySeat.net,
    };
  }, [state?.round, state?.phase, mySeat?.userId]);

  const handleWheelSettled = () => {
    setWheelSpinning(false);
    if (!state) return;
    // Prefer the snapshot captured at phase→settled — mySeat.net may have
    // been reset by an incoming openBetting from another client between
    // the wheel starting and here.
    const snap = pendingPayout.current;
    if (!snap || creditedRound.current === snap.round) return;
    creditedRound.current = snap.round;
    const { payout, net } = snap;
    pendingPayout.current = null;
    // Refund any stake this client deducted for bets the host never applied
    // (rejected at the betting→spinning boundary). actualStake = payout - net.
    if (roundOutlay.current.round === snap.round) {
      const clearedBack = clearRefunded.current.round === snap.round ? clearRefunded.current.amount : 0;
      const rejected = roundOutlay.current.amount - (payout - net) - clearedBack;
      if (rejected > 0) addChips(rejected, { silent: true });
      roundOutlay.current = { round: -1, amount: 0 };
    }
    if (clearRefunded.current.round === snap.round) clearRefunded.current = { round: -1, amount: 0 };
    haptic('land');
    if (payout > 0) {
      addChips(payout);
      audio.play(payout >= stake * 10 ? 'bigWin' : 'win');
      haptic('win');
      showMoment({ kind: 'bigWin', title: t('roulette.youWon', { amount: fmt(payout) }), icon: '🎡', duration: 1800 });
    } else {
      audio.play('lose');
    }
    recordResult('roulette', net > 0 ? 'win' : net === 0 ? 'push' : 'lose', net);
    addXp(XP_REWARDS.handPlayed + (net > 0 ? XP_REWARDS.gameWon : 0));
  };

  /* Safety net: if the wheel animation never fires onSettled (page hidden,
     tab throttled, wheel component crashed), the pending payout should
     still be credited. Runs 2.5s after the snapshot was captured. */
  useEffect(() => {
    if (!pendingPayout.current) return;
    const snap = pendingPayout.current;
    const timer = setTimeout(() => {
      if (creditedRound.current === snap.round) return;
      if (pendingPayout.current?.round !== snap.round) return;
      creditedRound.current = snap.round;
      if (snap.payout > 0) addChips(snap.payout);
      if (roundOutlay.current.round === snap.round) {
        const clearedBack = clearRefunded.current.round === snap.round ? clearRefunded.current.amount : 0;
        const rejected = roundOutlay.current.amount - (snap.payout - snap.net) - clearedBack;
        if (rejected > 0) addChips(rejected, { silent: true });
        roundOutlay.current = { round: -1, amount: 0 };
      }
      if (clearRefunded.current.round === snap.round) clearRefunded.current = { round: -1, amount: 0 };
      pendingPayout.current = null;
    }, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.round]);

  const handleBet = (kind: RouletteBetKind, numbers: number[]) => {
    if (!state || state.phase !== 'betting' || mySeat?.spectator) return;
    if (profile.chips < stake) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    audio.play('chip');
    haptic('chip');
    addChips(-stake, { silent: true });
    addOutlay(state.round, stake);
    void send(profile.id, { type: 'placeBet', userId: profile.id, kind, numbers, amount: stake }).then((ok) => {
      // Rate-limit / network drop: refund the stake so it doesn't vanish
      // silently when the bet never landed on the wheel.
      if (!ok) {
        addChips(stake, { silent: true });
        addOutlay(state.round, -stake);
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const handleClear = () => {
    if (!state || !mySeat) return;
    // Betting closed: clear is a no-op — settle reconciles any optimistic outlay.
    // Refunding here would double-credit against the settle payout/refund (over-credit bug).
    if (state.phase !== 'betting') return;
    // Refund exactly what THIS client optimistically deducted this round, not
    // what the authoritative seat shows. For a non-host player the placed bets
    // round-trip through the host, so mySeat.bets (and myStake) can still be
    // empty here — the old `!mySeat.bets.length` guard then skipped the refund
    // entirely and quietly ate the stake (repeat-last-bet then clear = lost
    // chips). clearBets is inserted after the placeBets, so the host still
    // processes place→clear in order and the authoritative table ends up empty.
    const outlayAmt = roundOutlay.current.round === state.round ? roundOutlay.current.amount : 0;
    const refundedSoFar = clearRefunded.current.round === state.round ? clearRefunded.current.amount : 0;
    const outstanding = outlayAmt - refundedSoFar;
    const refund = outstanding > 0 ? outstanding : myStake;
    if (refund <= 0 && !mySeat.bets.length) return;
    if (refund > 0) {
      addChips(refund, { silent: true });
      // Deliberately NOT addOutlay(-refund): keep the outlay intact so the
      // settle reconcile still knows the true amount deducted if this clear
      // never reaches the host. addClearRefunded offsets the double-count.
      addClearRefunded(state.round, refund);
    }
    void send(profile.id, { type: 'clearBets', userId: profile.id });
  };

  /* Repeat the same bets we made last round. Nice for spamming a hot number
     or a favourite pattern without re-clicking every cell. */
  const handleRepeatLastBet = () => {
    if (!state || state.phase !== 'betting' || mySeat?.spectator) return;
    const prev = state.lastBets?.[profile.id];
    if (!prev || prev.length === 0) return;
    const total = prev.reduce((sum, b) => sum + b.amount, 0);
    if (profile.chips < total) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(total - profile.chips) }), 'bad', '⚠');
      return;
    }
    audio.play('chip');
    haptic('chip');
    // Deduct up front so the HUD updates once instead of per-bet flicker.
    addChips(-total, { silent: true });
    addOutlay(state.round, total);
    let failed = 0;
    prev.forEach((bet) => {
      void send(profile.id, {
        type: 'placeBet', userId: profile.id,
        kind: bet.kind, numbers: bet.numbers, amount: bet.amount,
      }).then((ok) => {
        if (!ok) { addChips(bet.amount, { silent: true }); addOutlay(state.round, -bet.amount); failed += 1; }
      });
    });
    if (failed > 0) toast(t('common.retry'), 'bad', '⚠');
  };

  const handleSpin = () => {
    audio.play('door');
    // Fresh randomness minted now, after betting is closed — see the spin
    // action's `nonce` doc. Prevents any client precomputing the result.
    void send(profile.id, { type: 'spin', nonce: newSeed() });
  };

  /* "Done betting" — declare this seat finished for the round. The host starts
     the wheel once every seated player has declared (or the 15s backup window,
     armed on the first declaration, runs out). Placing or clearing a bet after
     this un-declares the seat (the engine resets `ready`). */
  const handleDoneBetting = () => {
    if (!state || !mySeat || mySeat.spectator || !mySeat.bets.length || mySeat.ready) return;
    audio.play('click');
    haptic('chip');
    void send(profile.id, { type: 'ready', userId: profile.id });
  };

  const handleNewRound = () => {
    // Open with no deadline: the "all players bet in" gate arms the window.
    void send(profile.id, { type: 'openBetting', deadline: null });
  };

  /* No credentials, or a device-local player with no uuid to host with. */
  if (mode === 'room' && (!isOnline() || !roomsService.canHost(profile.id))) {
    const offline = !isOnline();
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">{offline ? '🔌' : '🔑'}</div>
          <h2>{t('roulette.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(offline ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <div className="flex gap-2 justify-center">
            {offline
              ? <GameButton tone="gold" onClick={() => navigate('/game/roulette/solo')}>{t('roulette.solo')}</GameButton>
              : <GameButton tone="gold" onClick={() => navigate('/login')}>{t('auth.signIn')}</GameButton>}
            <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
          </div>
        </div>
      </SceneShell>
    );
  }

  const phase = state?.phase ?? 'betting';
  const canBet = phase === 'betting' && !mySeat?.spectator;
  const anyBets = Boolean(state?.seats.some((s) => s.bets.length > 0));

  /* Private table follows the host's equipped felt + backdrop, same pattern
     as Blackjack/Poker. Solo has no room, so it always gets the default felt. */
  const roomBg = mode === 'room' && room?.config?.bgSkin ? roomBackgroundOf(room.config.bgSkin) : null;
  const tableSkin = mode === 'room' ? room?.config?.tableSkin : null;
  const customTable = !!tableSkin && tableSkin !== DEFAULT_TABLE_SKIN;
  const hostName = mode === 'room' ? members?.find((m) => m.isHost)?.username : undefined;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: roomBg?.gradient ?? 'radial-gradient(ellipse at 50% 0%, #16211c, #0b0f0d 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={680} color={roomBg?.glowColor ?? 'rgba(46,158,107,.16)'} />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 640 }}>
        <div className="text-center">
          <span className="eyebrow">{mode === 'solo' ? t('roulette.solo') : t('roulette.withFriends')}</span>
          <h1 className="mt-1">{t('roulette.title')}</h1>
        </div>

        {mode === 'room' && room && (
          <GlassPanel gold className="p-3 w-full flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="eyebrow">{t('rooms.code')}</span>
              <b style={{ fontFamily: 'var(--font-display)', letterSpacing: '.2em', color: 'var(--gold-hi)' }}>{room.code}</b>
              {customTable && hostName && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10.5px]"
                  style={{ background: 'rgba(227,178,60,.12)', color: 'var(--gold-hi)', border: '1px solid var(--gold-line)' }}
                >
                  {t('rooms.customTable', { name: hostName })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(members ?? []).map((m) => {
                const seat = state?.seats.find((s) => s.userId === m.userId);
                return (
                  <div key={m.userId} className="relative">
                    <Avatar config={m.avatar} size={30} level={m.level} presence={m.presence} id={`rl-${m.userId}`} />
                    {seat && (
                      <span className="absolute -bottom-0.5 -end-0.5 rounded-full" style={{ width: 10, height: 10, background: seat.color, border: '2px solid var(--ink)' }} />
                    )}
                  </div>
                );
              })}
            </div>
            <GameButton size="sm" tone="metal" onClick={async () => {
              try {
                await navigator.clipboard.writeText(room.code);
                toast(`${t('rooms.code')} · ${t('common.copied')}`, 'good', '📋');
              } catch { toast(room.code, 'neutral'); }
            }}>
              {t('rooms.copyCode')}
            </GameButton>
          </GlassPanel>
        )}

        {/* history strip — the newest result stays hidden until this client's own wheel finishes spinning, so nobody sees the number before the reveal */}
        {!!visibleHistory.length && (
          <div className="flex gap-1.5 overflow-x-auto w-full px-1" style={{ scrollbarWidth: 'none' }}>
            {visibleHistory.map((n, i) => (
              <span
                key={i}
                className="shrink-0 rounded-full flex items-center justify-center num"
                style={{
                  width: 22, height: 22, fontSize: 10, fontWeight: 800,
                  background: n === 0 ? '#1c7a4a' : isRed(n) ? '#a8413e' : '#15161a',
                  color: '#f3efe6', opacity: i === 0 ? 1 : 0.6,
                }}
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {/* wheel + result — during the spin the wheel scales up and its
            surroundings dim so it feels like the camera cuts in close, then
            eases back to the felt when it settles. Matches how a real casino
            broadcast cuts to the wheel then back to the table. */}
        <motion.div
          className="relative grid place-items-center"
          style={{ height: 220, zIndex: wheelSpinning ? 30 : 1 }}
          animate={{ scale: wheelSpinning ? 1.35 : 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 0.9 }}
        >
          {/* Dim the rest of the page while zoomed in. */}
          <AnimatePresence>
            {wheelSpinning && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="fixed inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 35%, transparent 20%, rgba(0,0,0,.72) 65%)', zIndex: -1 }}
              />
            )}
          </AnimatePresence>
          <RouletteWheel spinning={wheelSpinning} winningNumber={state?.winningNumber ?? null} onSettled={handleWheelSettled} size={210} />
          <AnimatePresence>
            {phase === 'settled' && !pendingReveal && mySeat && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute -bottom-2 px-4 py-2 rounded-[var(--r-sm)] text-center"
                style={{ background: 'rgba(8,9,11,.85)', border: '1px solid var(--gold-line)' }}
              >
                <b style={{ color: mySeat.net > 0 ? 'var(--gold-hi)' : 'var(--muted)' }}>
                  {mySeat.net > 0 ? `+${fmt(mySeat.net)}` : mySeat.net < 0 ? fmt(mySeat.net) : t('blackjack.push')}
                </b>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {phase === 'waiting' && (
          <GlassPanel className="p-4 w-full text-center">
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{t('rooms.waitingForPlayers')}</p>
          </GlassPanel>
        )}

        {/* controls */}
        <GlassPanel className="p-3 w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">{t('games.chooseStake')}</span>
            <span className="num text-[12px]" style={{ color: 'var(--gold)' }}>{t('roulette.onTable')} · {fmt(myStake)}</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {STAKES.map((s) => (
              <button key={s} onClick={() => { audio.play('click'); setStake(s); }} style={{ opacity: stake === s ? 1 : 0.4, transform: stake === s ? 'translateY(-4px)' : 'none', transition: '.2s' }}>
                <Chip value={s} size={38} skin={profile.equipped.chipSkin} interactive />
              </button>
            ))}
          </div>
          {isVipEligible(profile) && (
            <div className="flex flex-wrap gap-2 justify-center mb-3 pt-2" style={{ borderTop: '1px dashed var(--gold-line)' }}>
              <span className="w-full text-center text-[10.5px] font-black tracking-widest" style={{ color: 'var(--gold-hi)', letterSpacing: '0.15em' }}>
                💎 VIP HIGH STAKES
              </span>
              {VIP_CHIP_EXTRA.map((s) => (
                <button key={s} onClick={() => { audio.play('click'); setStake(s); }} style={{ opacity: stake === s ? 1 : 0.4, transform: stake === s ? 'translateY(-4px)' : 'none', transition: '.2s' }}>
                  <Chip value={s} size={38} skin={profile.equipped.chipSkin} interactive />
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <GameButton size="sm" tone="ghost" disabled={!canBet || !mySeat?.bets.length} onClick={handleClear}>{t('blackjack.clear')}</GameButton>
            <GameButton
              size="sm"
              tone="metal"
              disabled={!canBet || !(state?.lastBets?.[profile.id]?.length)}
              onClick={handleRepeatLastBet}
            >
              🔁 {t('blackjack.lastBet')}
            </GameButton>
            {(phase === 'betting' || phase === 'locked') ? (
              mode === 'room' ? (
                <GameButton
                  tone="gold"
                  block
                  disabled={phase === 'locked' || !mySeat || mySeat.spectator || !mySeat.bets.length || mySeat.ready}
                  onClick={handleDoneBetting}
                >
                  {phase === 'locked'
                    ? t('roulette.betsLocked')
                    : mySeat?.ready
                      ? (bettingSecondsLeft !== null
                          ? t('roulette.spinIn', { s: bettingSecondsLeft })
                          : t('roulette.waitingOthers'))
                      : t('roulette.doneBetting')}
                </GameButton>
              ) : (
                <GameButton tone="gold" block disabled={!anyBets} onClick={handleSpin}>
                  {t('roulette.spin')}
                </GameButton>
              )
            ) : (
              <GameButton tone="gold" block disabled={wheelSpinning || !(mode === 'solo' || isHost)} onClick={handleNewRound}>
                {t('roulette.newRound')}
              </GameButton>
            )}
          </div>
          {phase === 'betting' && realPlayerCount > 1 && (
            bettingSecondsLeft !== null ? (
              <p className="text-center mt-2 text-[12px] num" style={{ color: bettingSecondsLeft <= 3 ? 'var(--crimson-hi)' : 'var(--gold-hi)' }}>
                {t('roulette.spinCountdown', { s: bettingSecondsLeft })} · {readyCount}/{realPlayerCount}
              </p>
            ) : readyCount > 0 ? (
              <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
                {t('roulette.doneCount', { n: readyCount, total: realPlayerCount })}
              </p>
            ) : null
          )}
          {phase === 'locked' && (
            <p className="text-center mt-2 text-[12px] num" style={{ color: 'var(--crimson-hi)' }}>
              {t('roulette.betsLocked')}
            </p>
          )}
          {phase !== 'betting' && phase !== 'locked' && mode === 'room' && !isHost && (
            <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
          )}
        </GlassPanel>

        {/* felt — pass the winning number so the dolly (casino marker) lands
            on it after the wheel reveal. Hidden during pendingReveal so the
            number doesn't leak on the felt before the wheel finishes spinning.
            Wrapped in the host's table skin (if any) in a private room. */}
        <div className={tableSkin ? `table-felt ${tableSkin} w-full rounded-[var(--r-sm)] p-1.5` : 'w-full'}>
          <BettingTable
            seats={state?.seats ?? []}
            disabled={!canBet}
            winningNumber={phase !== 'betting' && !pendingReveal ? state?.winningNumber ?? null : null}
            onBet={handleBet}
          />
        </div>

        {/* players */}
        {mode === 'room' && !!state?.seats.length && (
          <GlassPanel className="p-3 w-full flex flex-wrap gap-2.5">
            {state.seats.map((seat) => (
              <div key={seat.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.04)' }}>
                <span className="rounded-full" style={{ width: 9, height: 9, background: seat.color }} />
                <span className="text-[11.5px]">{seat.username}</span>
                {seat.spectator && <span className="text-[10px]" style={{ color: 'var(--dim)' }}>· {t('blackjack.spectating')}</span>}
              </div>
            ))}
          </GlassPanel>
        )}

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setPayTableOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => navigate('/hub')}>
            {t('common.back')}
          </GameButton>
        </div>
      </div>

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('games.paytable')}>
        <div className="flex flex-col gap-1.5">
          {PAYTABLE_ROWS.map((row) => (
            <div key={row.kind} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              <b className="flex-1 text-[13px]">{t(row.labelKey)}</b>
              <b className="num" style={{ color: 'var(--gold-hi)' }}>{BET_PAYOUTS[row.kind]}:1</b>
            </div>
          ))}
          <p className="mt-2 text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>{t('roulette.oddsNote')}</p>
        </div>
      </Modal>
    </SceneShell>
  );
}
