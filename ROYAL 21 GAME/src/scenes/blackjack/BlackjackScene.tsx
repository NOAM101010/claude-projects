import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { ChatPanel } from '@/components/social/ChatPanel';
import { PlayingCard } from '@/components/game/PlayingCard';
import { Dealer } from '@/components/game/Dealer';
import { GameButton } from '@/components/ui/GameButton';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { EmoteBar } from '@/components/social/EmoteBar';
import { BetRail } from './BetRail';
import { ActionBar } from './ActionBar';
import { SeatView } from './SeatView';
import { DuelBoard } from './DuelBoard';
import { VsHeader } from './VsHeader';
import { SessionSummary, type SessionLine } from './SessionSummary';
import { canDouble, canSplit, handValue, isBlackjack } from '@/games/blackjack/engine';
import { duelWinner, potOf, scoreHand } from '@/games/blackjack/duel';
import { redactBjState } from '@/games/blackjack/redact';
import { blackjackService } from '@/services/blackjackService';
import { roomsService } from '@/services/roomsService';
import { presenceService, type RoomPresenceMeta } from '@/services/presenceService';
import { useRoom } from '@/stores/useRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { fmt } from '@/lib/format';
import { XP_REWARDS } from '@/data/economy';
import { isVipEligible } from '@/data/vip';
import { isOnline } from '@/services/supabase';
import type { BjSeat } from '@/games/blackjack/types';

type DealerMood = 'idle' | 'shuffle' | 'deal' | 'flip' | 'win' | 'lose' | 'blackjack' | 'bust';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

export default function BlackjackScene({ mode, roomCode }: Props) {
  const navigate = useNavigate();
  const { t } = useT();
  const compact = useIsCompact();
  const nightReturn = useNightReturn();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const setChips = usePlayer((s) => s.setChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const bumpStat = usePlayer((s) => s.bumpStat);
  const recordRivalry = usePlayer((s) => s.recordRivalry);
  const stats = usePlayer((s) => s.stats);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);
  const setLoading = useUI((s) => s.setLoading);

  const { state, send, room, members, isHost, solo, startSolo, joinByCode } = useRoom();
  const [mood, setMood] = useState<DealerMood>('shuffle');
  const [victory, setVictory] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [emotes, setEmotes] = useState<Record<string, { emote?: string; message?: string }>>({});
  const settledRound = useRef(-1);
  const autoOpenedRound = useRef(-1);
  const netRef = useRef<Record<string, number>>({});
  const [spectators, setSpectators] = useState<string[]>([]);

  const mySeat = state?.seats.find((seat) => seat.userId === profile.id);
  const duel = state?.duel ?? null;

  /* Anyone dealt out of the current hand — joined mid-round and waiting for
     the next one — shows up to the table as watching, not just idle. Full
     zero-seat spectating (someone who never joins the room at all) would need
     the room's 4-seat cap decoupled from game seats — a bigger change than
     this pass covers, so this tracks the honest version: everyone actually
     connected to the table who currently can't act. */
  useEffect(() => {
    if (solo || !room) return;
    const meta: RoomPresenceMeta = { username: profile.username, presence: 'blackjack', game: 'blackjack', spectator: Boolean(mySeat?.spectator) };
    const conn = presenceService.track(room.id, profile.id, meta);
    conn.onSync((s) => {
      const names = Object.values(s)
        .map((entries) => entries[0])
        .filter((m): m is RoomPresenceMeta => Boolean(m?.spectator))
        .map((m) => m.username);
      setSpectators(names);
    });
    return conn.unsubscribe;
  }, [solo, room?.id, profile.id, profile.username, mySeat?.spectator]);

  /* ---------------------------------------------------------- connect ---- */
  useEffect(() => {
    const boot = async () => {
      if (mode === 'solo') {
        startSolo();
        return;
      }
      if (!roomCode) return;
      setLoading('loading.blackjack');
      if (room?.code !== roomCode) {
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

  /* Emotes ride a side channel so they never touch game state. */
  useEffect(() => {
    if (!room) return;
    const channel = roomsService.chatChannel(room.id);
    if (!channel) return;
    channel
      .on('broadcast', { event: 'emote' }, ({ payload }) => {
        const data = payload as { userId: string; emote?: string; message?: string };
        setEmotes((prev) => ({ ...prev, [data.userId]: data }));
        audio.play('notify');
        setTimeout(() => setEmotes((prev) => ({ ...prev, [data.userId]: {} })), 2400);
      })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [room]);

  /* Best-effort leave when the tab closes / navigates away. Shortens the
     freeze window before the host's ghost cleanup catches on. */
  useEffect(() => {
    if (solo || !room || !mySeat) return;
    const bail = () => { void send(profile.id, { type: 'leave', userId: profile.id }); };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), solo, profile.id]);

  /* Ghost cleanup: host removes any seat whose player dropped out of room
     membership so a stranded seat can't freeze the table. Shared hook. */
  useGhostSeatCleanup(isHost && !solo, state?.seats, members,
    (userId) => void send(profile.id, { type: 'leave', userId }));

  /* Best-effort leave on tab close is already registered via pagehide above —
     don't also register beforeunload, or every desktop close dispatches leave
     twice, wasting the client's last rate-limit token. */

  /* Multiplayer hand start: the host deals the instant every seat with a bet
     down has readied (and at least one has). There is no countdown any more —
     the "all ready" gate IS the wait. A seat with no bet is dealt out as a
     spectator by the deal reducer, exactly as before. */
  useEffect(() => {
    if (!state || solo || !isHost || state.phase !== 'betting') return;
    // Duel: every non-spectator seat must be ready (a duel seat can't ready
    // without a bet anyway, so this waits for BOTH players). Cash: just the
    // seats that actually put a bet down — a lurker who never bets is dealt
    // out as a spectator, same as before.
    const inDuel = Boolean(state.duel);
    const gate = inDuel
      ? state.seats.filter((seat) => !seat.spectator)
      : state.seats.filter((seat) => seat.bet > 0);
    if (gate.length < (inDuel ? 2 : 1) || !gate.every((seat) => seat.ready)) return;
    void send(profile.id, { type: 'deal' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, solo, isHost, Boolean(state?.duel),
      state?.seats.map((s) => `${s.userId}:${s.bet}:${s.ready}:${s.spectator}`).join('|')]);

  /* After a hand settles the host auto-opens the next betting window (which
     clears every ready flag), so players just ready up again — no manual "new
     round" click. Mirrors the Sit & Go auto-continue. */
  useEffect(() => {
    if (!state || solo || !isHost || state.phase !== 'settled') return;
    if (autoOpenedRound.current === state.round) return;
    autoOpenedRound.current = state.round;
    const timer = setTimeout(() => {
      if (useRoom.getState().state?.phase === 'settled') {
        settledRound.current = -1;
        void send(profile.id, { type: 'openBetting' });
      }
    }, 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round, solo, isHost]);

  /* ------------------------------------------------------ dealer moods --- */
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'betting') setMood('shuffle');
    else if (state.phase === 'playing') setMood('deal');
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------------------------------- settlement -- */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || !mySeat) return;
    if (settledRound.current === state.round) return;
    settledRound.current = state.round;

    const payout = mySeat.hands.reduce((sum, hand) => sum + (hand.payout ?? 0), 0);
    const staked = mySeat.hands.reduce((sum, hand) => sum + hand.bet, 0);
    const net = payout - staked;
    netRef.current[profile.id] = (netRef.current[profile.id] ?? 0) + net;

    const gotBlackjack = mySeat.hands.some((hand) => isBlackjack(hand));
    const busted = mySeat.hands.every((hand) => handValue(hand.cards).total > 21);
    const dealerBusted = handValue(state.dealer.cards).total > 21;

    /* In duel mode, chips are locked in the pot at start and stay untouched
       for every hand — the ONLY payout is the pot at end. So per-hand
       addChips and claimPayout are both skipped. Points still tick up on
       the scoreboard (that block runs below). This kills the "sometimes I
       get more chips than I should" bug where a duel hand would settle
       chips AND then the pot payout would also credit at match end. */
    const inDuel = Boolean(duel);
    const roomMode = Boolean(room && isOnline());
    if (!inDuel) {
      if (payout > 0) addChips(payout, roomMode ? { localOnly: true } : undefined);
      if (roomMode && room) {
        const claim = async () => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const balance = await blackjackService.claimPayout(room.id, state.round);
            if (typeof balance === 'number') { setChips(balance); return; }
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
          setChips(usePlayer.getState().profile.chips);
          toast(t('common.retry'), 'bad', '⚠');
        };
        void claim();
      }
    }

    const outcome = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    recordResult('blackjack', outcome, net, {
      bjHands: stats.bjHands + mySeat.hands.length,
      bjWins: stats.bjWins + mySeat.hands.filter((h) => h.outcome === 'win' || h.outcome === 'blackjack').length,
      bjLosses: stats.bjLosses + mySeat.hands.filter((h) => h.outcome === 'lose' || h.outcome === 'bust').length,
      blackjacks: stats.blackjacks + mySeat.hands.filter((h) => h.outcome === 'blackjack').length,
      doubleWins: stats.doubleWins + mySeat.hands.filter((h) => h.doubled && (h.outcome === 'win' || h.outcome === 'blackjack')).length,
      splitWins: stats.splitWins + mySeat.hands.filter((h) => h.fromSplit && (h.outcome === 'win' || h.outcome === 'blackjack')).length,
      // Hands played with other people at the table — what the social trophies count.
      roomHands: stats.roomHands + (solo ? 0 : mySeat.hands.length),
      biggestBet: Math.max(stats.biggestBet, staked),
      betTotal: stats.betTotal + staked,
      betCount: stats.betCount + mySeat.hands.length,
    });

    /* Head-to-head against everyone else who was dealt in this round. */
    if (!solo) {
      recordRivalry('blackjack', net, state.seats
        .filter((seat) => seat.userId !== profile.id && !seat.spectator && seat.hands.length)
        .map((seat) => ({ userId: seat.userId, net: seat.net })));
    }
    addXp(XP_REWARDS.handPlayed + (net > 0 ? XP_REWARDS.handWon : 0) + (gotBlackjack ? XP_REWARDS.blackjack : 0));

    if (gotBlackjack) {
      audio.duck(1600);
      audio.play('blackjack');
      haptic('win');
      setMood('blackjack');
      showMoment({ kind: 'blackjack', title: 'BLACKJACK', subtitle: `+${fmt(net)}`, duration: 2000 });
      setVictory(true);
    } else if (net > 0) {
      audio.play(net >= staked * 2 ? 'bigWin' : 'win');
      haptic('win');
      setMood('lose');
      setVictory(true);
      if (dealerBusted) toast(t('blackjack.dealerBust'), 'good', '🎯');
    } else if (busted) {
      audio.play('bust');
      setMood('bust');
    } else if (net < 0) {
      audio.play('lose');
      setMood('win');
    } else {
      audio.play('push');
      setMood('idle');
      toast(t('blackjack.betReturned'), 'neutral', '↩');
    }
    setTimeout(() => setVictory(false), 2200);

    /* duel scoring is the host's job, exactly like the cards. Bump the
       version so peers don't drop this publish — their subscribe callback
       rejects updates whose version isn't strictly greater than what they
       already have, which used to silently discard the duel scoreboard for
       everyone but the host. */
    if (duel && isHost) {
      // Score off the host's full engine state, not the redacted render copy,
      // so publish() stashes the real shoe secret rather than zeros.
      const base = useRoom.getState().fullState ?? state;
      const scored = scoreHand(duel.config, duel.scores, base);
      const winner = duelWinner(duel.config, scored);
      const next = { ...base, version: base.version + 1, duel: { ...duel, scores: scored, winner } };
      useRoom.setState({ fullState: next, state: redactBjState(next) });
      if (room) void blackjackService.publish(room.id, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  /* When a duel starts, lock every player's buy-in into the pot exactly once.
     Ref-latched so a re-render (or a subscribe callback bumping state.duel)
     doesn't debit the same player twice per match. Clears on duel end so a
     rematch pays another entry. */
  const paidDuelBuyIn = useRef<string | null>(null);
  useEffect(() => {
    if (!duel || duel.winner) return;
    const key = `${duel.config.buyIn}:${state?.round ?? 0}`;
    if (paidDuelBuyIn.current === key) return;
    if (paidDuelBuyIn.current && paidDuelBuyIn.current.startsWith(`${duel.config.buyIn}:`)) return;
    paidDuelBuyIn.current = key;
    if (duel.config.buyIn > 0) addChips(-duel.config.buyIn, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.config?.buyIn, duel?.winner]);

  /* A finished duel pays the pot to the winner. Both players already paid
     their own buy-in, so the winner gets the FULL pot back (their own
     buy-in + the loser's). Loser gets nothing — same as any friendly bet. */
  useEffect(() => {
    if (!duel?.winner) return;
    const pot = potOf(duel.config, state?.seats.length ?? 1);
    if (duel.winner === profile.id) {
      addChips(pot);
      addXp(XP_REWARDS.duelWon);
      bumpStat({ duelWins: stats.duelWins + 1 });
      audio.duck(1800);
      audio.play('bigWin');
      showMoment({ kind: 'sessionEnd', title: 'duel.youWon', subtitle: `+${fmt(pot - duel.config.buyIn)}`, icon: '👑', duration: 2600 });
    }
    paidDuelBuyIn.current = null;
    setSummaryOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.winner]);

  /* Track how much I've spent this round via addBet, and reconcile against
     the seat's actual bet in state after each version bump. If the deal
     fires before my bet action lands (host processes deal locally, my bet
     is still travelling through room_actions), the reducer rejects the
     bet — this refunds the chips that were optimistically debited. */
  const pendingBetTotal = useRef(0);
  const pendingBetRound = useRef(-1);

  /* Walking away from the table mid-hand used to strand the seat (ghost
     player, frozen turn) and leave the HUD on an optimistic figure — on
     re-entry the stale table rendered under the next round's bet rail. Clean
     up on unmount: refund a bet that was only ever *staged* (never dealt),
     fire leave so no ghost seat is left behind, and pull the authoritative
     balance so the HUD can't stay stuck on a localOnly number. A hand already
     in progress is a forfeit — same as leaving a real table — so a live
     hand's stake is never refunded (that would let players bail losing
     hands). Kept in a ref + mount-only effect so it fires exactly once, on
     unmount, and never mid-render when a dep changes. */
  const leaveCleanup = useRef<() => void>(() => {});
  leaveCleanup.current = () => {
    const st = useRoom.getState().state;
    const seat = st?.seats.find((s) => s.userId === profile.id);
    if (!duel) {
      if (solo) {
        if (st?.phase === 'betting' && seat && seat.bet > 0) addChips(seat.bet, { silent: true });
      } else if (pendingBetTotal.current > 0) {
        // pendingBetTotal tracks exactly what addBet debited this round and is
        // kept in sync by clearBet — refunding it can't double up with a clear.
        addChips(pendingBetTotal.current, { silent: true, localOnly: true });
      }
    }
    pendingBetTotal.current = 0;
    pendingBetRound.current = -1;
    if (!solo && seat) void useRoom.getState().leave(profile.id);
    if (!solo && isOnline()) void usePlayer.getState().refreshFromServer();
  };
  useEffect(() => () => leaveCleanup.current(), []);

  /* ------------------------------------------------------------ actions -- */
  const addBet = useCallback((value: number) => {
    const inDuel = Boolean(duel);
    if (!inDuel && profile.chips < value) { audio.play('error'); toast(t('blackjack.notEnough'), 'bad', '⚠'); return; }
    if (!inDuel) addChips(-value, solo ? { silent: true } : { silent: true, localOnly: true });
    // Track expected bet total so a rejected bet gets refunded.
    if (!solo && state) {
      if (pendingBetRound.current !== state.round) {
        pendingBetTotal.current = 0;
        pendingBetRound.current = state.round;
      }
      pendingBetTotal.current += value;
    }
    audio.play('chip');
    haptic('chip');
    void send(profile.id, { type: 'bet', userId: profile.id, amount: value }).then((ok) => {
      if (!ok) {
        if (!inDuel) addChips(value, solo ? { silent: true } : { silent: true, localOnly: true });
        pendingBetTotal.current = Math.max(0, pendingBetTotal.current - value);
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  }, [profile.chips, profile.id, addChips, send, toast, t, solo, duel, state]);

  /* Watch the state: if we tried to bet X this round but the phase already
     left 'betting' (deal fired before our bet arrived), refund the delta.
     This turns "you got made a spectator and lost your money" into "you
     got made a spectator and kept your money". */
  useEffect(() => {
    if (solo || !state || !mySeat) return;
    // Only reconcile once the round has moved out of betting.
    if (state.phase === 'betting') return;
    if (pendingBetRound.current !== state.round) return;
    const actuallyBet = mySeat.bet + (mySeat.hands ?? []).reduce((sum, h) => sum + h.bet, 0);
    const missing = pendingBetTotal.current - actuallyBet;
    if (missing > 0 && !duel) {
      addChips(missing, { silent: true, localOnly: true });
    }
    pendingBetTotal.current = 0;
    pendingBetRound.current = -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  const clearBet = () => {
    if (!mySeat?.bet) return;
    const refunded = mySeat.bet;
    if (!duel) addChips(refunded, solo ? { silent: true } : { silent: true, localOnly: true });
    // Offset the settle-time reconcile (above): once the host processes this
    // clearBet mySeat.bet drops to 0, and pendingBetTotal would still report
    // the full amount as "missing" → the reconcile would credit it a 2nd time.
    if (!solo && pendingBetRound.current === state?.round) {
      pendingBetTotal.current = Math.max(0, pendingBetTotal.current - refunded);
    }
    void send(profile.id, { type: 'clearBet', userId: profile.id });
  };

  const repeatBet = () => {
    const target = state?.lastBet ?? 0;
    const need = target - (mySeat?.bet ?? 0);
    if (need <= 0 || profile.chips < need) return;
    addBet(need);
  };

  const readyUp = () => {
    if (!mySeat?.bet) return;
    audio.play('chipStack');
    if (solo) void send(profile.id, { type: 'deal' });
    else void send(profile.id, { type: 'ready', userId: profile.id });
  };

  const act = (type: 'hit' | 'stand' | 'double' | 'split') => {
    const hand = mySeat?.hands[state?.activeHand ?? 0];
    if ((type === 'double' || type === 'split') && hand) {
      // In duel mode, doubling/splitting doesn't cost real chips — buy-in
      // already covers the whole match. Guest/solo/room paths keep the old
      // per-hand cost.
      if (!duel && profile.chips < hand.bet) { audio.play('error'); toast(t('blackjack.notEnough'), 'bad', '⚠'); return; }
      if (!duel) addChips(-hand.bet, solo ? { silent: true } : { silent: true, localOnly: true });
    }
    audio.play(type === 'hit' ? 'card' : 'click');
    haptic(type === 'hit' ? 'card' : 'tap');
    void send(profile.id, { type, userId: profile.id } as never);
  };

  const nextHand = () => {
    settledRound.current = -1;
    setSummaryOpen(false);
    audio.play('cardFlip');
    void send(profile.id, { type: 'openBetting' });
  };

  const sendEmote = (payload: { emote?: string; message?: string }) => {
    setEmotes((prev) => ({ ...prev, [profile.id]: payload }));
    setTimeout(() => setEmotes((prev) => ({ ...prev, [profile.id]: {} })), 2400);
    if (!room) return;
    const channel = roomsService.chatChannel(room.id);
    void channel?.subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.send({ type: 'broadcast', event: 'emote', payload: { userId: profile.id, ...payload } });
    });
  };

  /* --------------------------------------------------------------- view -- */
  const others = useMemo(
    () => (state?.seats ?? []).filter((seat) => seat.userId !== profile.id),
    [state?.seats, profile.id],
  );
  const activeSeat: BjSeat | undefined = state && state.activeSeat >= 0 ? state.seats[state.activeSeat] : undefined;
  const yourTurn = state?.phase === 'playing' && activeSeat?.userId === profile.id;
  const activeHand = mySeat?.hands[state?.activeHand ?? 0];
  const dealerTotal = state && state.dealer.cards.length
    ? handValue(state.dealer.hidden ? state.dealer.cards.slice(0, 1) : state.dealer.cards).total
    : 0;

  const summaryLines: SessionLine[] = (state?.seats ?? []).map((seat) => ({
    seat,
    net: seat.userId === profile.id ? (netRef.current[profile.id] ?? 0) : seat.net,
    bestStreak: seat.userId === profile.id ? stats.bestStreak : 0,
    points: duel ? duel.scores.points[seat.userId] : undefined,
  }));

  if (!state) return null;

  return (
    <SceneShell compactHud particles={false}>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #16241d, #0a1010 50%, #08090b 82%)' }} />
        <LightPool x="50%" y="26%" size={880} color="rgba(227,178,60,.17)" />
      </div>

      <div className="mx-auto px-3 pb-4 flex flex-col" style={{ maxWidth: 1180, minHeight: 'calc(100dvh - 62px)' }}>
        {duel && others.length === 1 && mySeat && (
          <VsHeader seatA={mySeat} seatB={others[0]} scores={duel.scores} />
        )}

        {/* ---------------- the table ---------------- */}
        <div
          className={`relative table-felt ${profile.equipped.table} flex-1 flex flex-col items-center justify-between`}
          style={{ borderRadius: 'clamp(20px,4vw,44px)', padding: compact ? '14px 10px' : '20px 24px', minHeight: compact ? 420 : 460 }}
        >
          <AnimatePresence>{victory && <VictoryEffect kind={profile.equipped.victory} />}</AnimatePresence>

          <div
            className="absolute top-3 start-1/2 -translate-x-1/2 text-center pointer-events-none"
            style={{ color: 'rgba(227,178,60,.32)', fontFamily: 'var(--font-display)', letterSpacing: '.4em', fontSize: 'clamp(9px,1.4vw,12px)', fontWeight: 900 }}
          >
            BLACKJACK PAYS 3 TO 2
            <div style={{ fontSize: 8.5, letterSpacing: '.2em', color: 'rgba(255,255,255,.18)', fontWeight: 400 }}>
              {t('blackjack.rules')}
            </div>
          </div>

          {/* dealer */}
          <div className="flex flex-col items-center pt-8">
            <Dealer
              mood={mood}
              skin={profile.equipped.dealerSkin ?? 'dl-house'}
              size={compact ? 76 : 96}
              lookAt={activeSeat ? (state.seats.indexOf(activeSeat) - (state.seats.length - 1) / 2) / Math.max(1, state.seats.length) : 0}
            />
            <div className="flex mt-1" style={{ marginInlineStart: 20 }}>
              {state.dealer.cards.map((card, index) => (
                <div key={index} style={{ marginInlineStart: -20 }}>
                  <PlayingCard
                    card={card}
                    faceDown={index === 1 && state.dealer.hidden}
                    index={index}
                    size={compact ? 'sm' : 'md'}
                    face={profile.equipped.cardFace}
                    back={profile.equipped.cardBack}
                  />
                </div>
              ))}
            </div>
            {!!state.dealer.cards.length && (
              <span className="mt-1.5 px-2.5 num font-black rounded-full"
                style={{
                  fontFamily: 'var(--font-display)', background: 'rgba(0,0,0,.55)',
                  border: '1px solid var(--gold-line)',
                  color: dealerTotal > 21 ? 'var(--crimson-hi)' : 'var(--gold-hi)',
                }}>
                {state.dealer.hidden ? `${dealerTotal} +` : dealerTotal}
              </span>
            )}
          </div>

          {/* other players around the table */}
          {others.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 my-2">
              {others.map((seat) => (
                <SeatView
                  key={seat.userId}
                  seat={seat}
                  active={activeSeat?.userId === seat.userId}
                  activeHand={state.activeHand}
                  cardFace={profile.equipped.cardFace}
                  cardBack={profile.equipped.cardBack}
                  chipSkin={profile.equipped.chipSkin}
                  points={duel ? duel.scores.points[seat.userId] : undefined}
                  emote={emotes[seat.userId]}
                />
              ))}
            </div>
          )}

          {/* me, always bottom centre and always the largest */}
          {mySeat && (
            <SeatView
              seat={mySeat}
              hero
              active={!!yourTurn}
              activeHand={state.activeHand}
              cardFace={profile.equipped.cardFace}
              cardBack={profile.equipped.cardBack}
              chipSkin={profile.equipped.chipSkin}
              points={duel ? duel.scores.points[profile.id] : undefined}
              emote={emotes[profile.id]}
            />
          )}

          {mySeat?.spectator && state.phase !== 'betting' && (
            <div className="absolute inset-x-0 bottom-3 text-center">
              <span className="px-3 py-1.5 rounded-full text-[12px] font-bold glass">
                {t('blackjack.handStarted')} · {t('blackjack.spectateUntilNext')}
              </span>
            </div>
          )}
        </div>

        {/* ---------------- controls ---------------- */}
        <div className="mt-3 flex flex-col gap-2.5">
          {duel && (
            <DuelBoard seats={state.seats} config={duel.config} scores={duel.scores} potPlayers={state.seats.length} />
          )}

          {/* No mode="wait" here: it would hold the exiting control (e.g. the
              settled "new round" button, or the ActionBar after a solo re-entry
              reset) on screen if its exit animation didn't register — which is
              exactly what made "new round" need two clicks and left a stuck
              action bar over an empty table. Overlapping the ~0.3s in/out is
              the safe trade. */}
          <AnimatePresence>
            {state.phase === 'betting' && mySeat && (
              <BetRail
                key="bet"
                bet={mySeat.bet}
                chips={profile.chips}
                lastBet={state.lastBet}
                ready={mySeat.ready}
                multiplayer={!solo}
                chipSkin={profile.equipped.chipSkin}
                vip={isVipEligible(profile)}
                onAdd={addBet}
                onClear={clearBet}
                onRepeat={repeatBet}
                onAll={() => addBet(profile.chips)}
                onReady={readyUp}
              />
            )}

            {state.phase === 'playing' && (
              <ActionBar
                key="act"
                yourTurn={!!yourTurn}
                turnName={activeSeat?.username}
                canDouble={!!activeHand && canDouble(activeHand, profile.chips)}
                canSplit={!!activeHand && !!mySeat && canSplit(activeHand, mySeat, profile.chips)}
                onHit={() => act('hit')}
                onStand={() => act('stand')}
                onDouble={() => act('double')}
                onSplit={() => act('split')}
              />
            )}

            {state.phase === 'settled' && (
              <motion.div key="next" className="flex gap-2.5 items-center justify-center"
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                <GameButton tone="gold" size="lg" onClick={nextHand}>{t('blackjack.newRound')}</GameButton>
                {duel && <GameButton tone="ghost" onClick={() => setSummaryOpen(true)}>{t('duel.scoreboard')}</GameButton>}
                <GameButton tone="ghost" onClick={() => navigate(nightReturn ?? '/hub')}>
                  {nightReturn ? t('night.backToNight') : t('common.back')}
                </GameButton>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <span className="text-[12px] px-2.5 py-1.5 rounded-full glass num">
              🔥 {t('blackjack.streak')} {stats.streak}
            </span>
            {!solo && (
              <div className="flex items-center gap-2">
                {members.length > 0 && (
                  <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {members.length} {t('rooms.members')}
                  </span>
                )}
                {spectators.length > 0 && (
                  <span className="text-[11.5px] px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--muted)' }} title={spectators.join(', ')}>
                    👁 {spectators.length}
                  </span>
                )}
                <EmoteBar onSend={sendEmote} />
              </div>
            )}
          </div>
        </div>
      </div>

      <SessionSummary
        open={summaryOpen}
        lines={summaryLines}
        winnerId={duel?.winner}
        pot={duel ? potOf(duel.config, state.seats.length) : undefined}
        onAnother={nextHand}
        onClose={() => setSummaryOpen(false)}
      />

      {/* Chat belongs at the table, not just in the lobby — most of the evening
          happens here. Solo play has nobody to talk to, so it stays hidden. */}
      {!solo && room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
