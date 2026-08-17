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
import { isOnline } from '@/services/supabase';
import { roomsService } from '@/services/roomsService';
import { presenceService } from '@/services/presenceService';
import { STAKES, XP_REWARDS } from '@/data/economy';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

/** How long a new betting window stays open before the host's client auto-spins. */
const BETTING_WINDOW_MS = 10_000;

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
  const creditedRound = useRef(-1);

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
  const pendingReveal = !!state && state.phase !== 'betting' && creditedRound.current !== state.round;
  const visibleHistory = pendingReveal ? (state?.history ?? []).slice(1) : (state?.history ?? []);

  /* ---------------------------------------------------------- connect ---- */
  useEffect(() => {
    const boot = async () => {
      if (mode === 'solo') { startSolo(); return; }
      if (!roomCode) return;
      setLoading('loading.generic');
      if (roomCode === 'new') {
        const created = await create(profile.id);
        if (created) navigate(`/game/roulette/room/${created.code}`, { replace: true });
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

  /* A settled round: spin the wheel locally to the number the engine already picked. */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || state.winningNumber === null) return;
    if (spunRound.current === state.round) return;
    spunRound.current = state.round;
    setWheelSpinning(true);
    audio.play('coin');
  }, [state]);

  /* Betting window countdown. A fresh round in a multi-seat room gets a fixed
     10s window before the host's client spins automatically — without this,
     a host who bets first and immediately hits "spin" can close out a round
     before anyone else at the table gets a bet down. */
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
  const autoSpunRound = useRef<number>(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'betting' || !state.deadline) return;
    if (autoSpunRound.current === state.round) return;
    if (Date.now() >= state.deadline) {
      autoSpunRound.current = state.round;
      void send(profile.id, { type: 'spin' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.deadline, state?.round, now]);
  const bettingSecondsLeft = state?.phase === 'betting' && state?.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;
  const realPlayerCount = state?.seats.filter((s) => !s.spectator).length ?? 0;
  const bettingWindowOpen = bettingSecondsLeft !== null && bettingSecondsLeft > 0 && realPlayerCount > 1;

  const handleWheelSettled = () => {
    setWheelSpinning(false);
    if (!state || !mySeat) return;
    if (creditedRound.current === state.round) return;
    creditedRound.current = state.round;
    const payout = mySeat.net + seatStake(mySeat);
    haptic('land');
    if (payout > 0) {
      addChips(payout);
      audio.play(payout >= stake * 10 ? 'bigWin' : 'win');
      haptic('win');
      showMoment({ kind: 'bigWin', title: t('roulette.youWon', { amount: fmt(payout) }), icon: '🎡', duration: 1800 });
    } else {
      audio.play('lose');
    }
    recordResult('roulette', mySeat.net > 0 ? 'win' : mySeat.net === 0 ? 'push' : 'lose', mySeat.net);
    addXp(XP_REWARDS.handPlayed + (mySeat.net > 0 ? XP_REWARDS.gameWon : 0));
  };

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
    void send(profile.id, { type: 'placeBet', userId: profile.id, kind, numbers, amount: stake }).then((ok) => {
      // Rate-limit / network drop: refund the stake so it doesn't vanish
      // silently when the bet never landed on the wheel.
      if (!ok) {
        addChips(stake, { silent: true });
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const handleClear = () => {
    if (!mySeat || !mySeat.bets.length) return;
    addChips(myStake, { silent: true });
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
    let failed = 0;
    prev.forEach((bet) => {
      void send(profile.id, {
        type: 'placeBet', userId: profile.id,
        kind: bet.kind, numbers: bet.numbers, amount: bet.amount,
      }).then((ok) => {
        if (!ok) { addChips(bet.amount, { silent: true }); failed += 1; }
      });
    });
    if (failed > 0) toast(t('common.retry'), 'bad', '⚠');
  };

  const handleSpin = () => {
    audio.play('door');
    void send(profile.id, { type: 'spin' });
  };

  const handleNewRound = () => {
    const deadline = mode === 'room' ? Date.now() + BETTING_WINDOW_MS : null;
    void send(profile.id, { type: 'openBetting', deadline });
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

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #16211c, #0b0f0d 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={680} color="rgba(46,158,107,.16)" />
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
            {phase === 'betting' ? (
              <GameButton tone="gold" block disabled={!(mode === 'solo' || isHost) || !anyBets || bettingWindowOpen} onClick={handleSpin}>
                {bettingWindowOpen ? t('roulette.spinIn', { s: bettingSecondsLeft }) : t('roulette.spin')}
              </GameButton>
            ) : (
              <GameButton tone="gold" block disabled={wheelSpinning || !(mode === 'solo' || isHost)} onClick={handleNewRound}>
                {t('roulette.newRound')}
              </GameButton>
            )}
          </div>
          {phase === 'betting' && bettingSecondsLeft !== null && realPlayerCount > 1 && (
            <p className="text-center mt-2 text-[12px] num" style={{ color: bettingSecondsLeft <= 3 ? 'var(--crimson-hi)' : 'var(--gold-hi)' }}>
              {t('roulette.placeBetsWindow', { s: bettingSecondsLeft })}
            </p>
          )}
          {phase !== 'betting' && mode === 'room' && !isHost && (
            <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
          )}
        </GlassPanel>

        {/* felt — pass the winning number so the dolly (casino marker) lands
            on it after the wheel reveal. Hidden during pendingReveal so the
            number doesn't leak on the felt before the wheel finishes spinning. */}
        <BettingTable
          seats={state?.seats ?? []}
          disabled={!canBet}
          winningNumber={phase !== 'betting' && !pendingReveal ? state?.winningNumber ?? null : null}
          onBet={handleBet}
        />

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
          <GameButton tone="ghost" size="sm" onClick={async () => { if (mode === 'room') await leave(profile.id); navigate('/hub'); }}>
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
