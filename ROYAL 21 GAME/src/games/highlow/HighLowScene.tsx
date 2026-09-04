import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { PlayerName } from '@/components/social/PlayerName';
import { ChatPanel } from '@/components/social/ChatPanel';
import { PlayingCard } from '@/components/game/PlayingCard';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { newSeed } from '@/lib/random';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useHighLowRoom } from '@/stores/useHighLowRoom';
import { useT } from '@/hooks/useT';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useNightScoring } from '@/hooks/useNightScoring';
import { isOnline } from '@/services/supabase';
import { roomsService } from '@/services/roomsService';
import { GUESS_MS } from '@/games/highlow/engine';
import { XP_REWARDS } from '@/data/economy';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

/** Game-night uniform-ante tiers the host picks from. */
const NIGHT_ANTES = [500, 1000, 2500, 5000];

export default function HighLowScene({ mode, roomCode }: Props) {
  if (mode !== 'room' || !roomCode) return <HighLowUnavailable />;
  return <HighLowRoom roomCode={roomCode} />;
}

function HighLowUnavailable() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <SceneShell>
      <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
        <div className="text-[48px] mb-3 ambient-float">📈</div>
        <h2>{t('highlow.title')}</h2>
        <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t('highlow.nightOnly')}</p>
        <GameButton tone="gold" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
      </div>
    </SceneShell>
  );
}

/** 2-8 players ante the same amount; call the next card higher or lower before an
 *  8s timer. Wrong or no call is out. Last one standing takes the pot; a wipe
 *  splits it across that turn's guessers. */
function HighLowRoom({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const setLoading = useUI((s) => s.setLoading);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('highlow');

  const { room, members, state, isHost, create, joinByCode, send, leave } = useHighLowRoom();
  const [now, setNow] = useState(Date.now());
  const booting = useRef(false);

  /* ---- boot: create or join ---- */
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
          if (created) navigate(`/game/highlow/room/${created.code}`, { replace: true });
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

  /* ---- join the table ---- */
  const joinRetry = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!state || mySeat) {
      if (joinRetry.current) clearTimeout(joinRetry.current);
      joinRetry.current = null;
      return;
    }
    const doJoin = () => void send(profile.id, {
      type: 'join', userId: profile.id, username: profile.username, avatar: profile.avatar,
      level: profile.level, title: profile.equipped.title, nameColor: profile.equipped.nameColor,
    });
    doJoin();
    if (!joinRetry.current) {
      joinRetry.current = setTimeout(() => { joinRetry.current = null; doJoin(); }, 3000);
    }
    return () => { if (joinRetry.current) clearTimeout(joinRetry.current); };
  }, [state, mySeat, send, profile]);

  /* ---- host: default to the uniform-ante model ---- */
  useEffect(() => {
    if (!isHost || !state || state.anteMode) return;
    void send(profile.id, { type: 'nightAnte', amount: NIGHT_ANTES[0] });
  }, [isHost, state?.anteMode, send, profile.id, state]);

  /* ---- host: drop seats whose player left the room ---- */
  useGhostSeatCleanup(isHost, state?.seats, members ?? [],
    (userId) => void send(profile.id, { type: 'leave', userId }));

  /* ---- local ticking clock for the visible countdown ---- */
  useEffect(() => {
    if (state?.phase !== 'guessing') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state?.phase, state?.round, state?.turn]);

  /* ---- host: auto-start a round once the ante is set ---- */
  const startTried = useRef(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'betting') return;
    if (state.seats.length < 2 || !state.anteAmount) return;
    if (startTried.current === state.round) return;
    const timer = setTimeout(() => {
      startTried.current = state.round;
      void send(profile.id, { type: 'start', nonce: newSeed(), deadline: Date.now() + GUESS_MS });
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.anteAmount, state?.seats.length]);

  /* ---- host: turn the next card over when everyone's called it, or the timer's up ---- */
  const revealedKey = useRef('');
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'guessing') return;
    const key = `${state.round}:${state.turn}`;
    if (revealedKey.current === key) return;
    const alive = state.seats.filter((s) => s.alive);
    const allIn = alive.length > 0 && alive.every((s) => s.guess === 'higher' || s.guess === 'lower');
    const fire = () => {
      revealedKey.current = key;
      void send(profile.id, { type: 'reveal', nonce: newSeed(), deadline: Date.now() + GUESS_MS });
    };
    const wait = allIn ? 700 : Math.max(300, (state.deadline ?? Date.now()) - Date.now());
    const timer = setTimeout(fire, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.turn, state?.deadline,
      state?.seats.map((s) => `${s.userId}:${s.guess}:${s.alive}`).join('|')]);

  /* ---- host: open the next betting window a beat after settle ---- */
  const reopenedRound = useRef(-1);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'settled') return;
    if (reopenedRound.current === state.round) return;
    reopenedRound.current = state.round;
    const timer = setTimeout(() => {
      if (useHighLowRoom.getState().state?.phase === 'settled') void send(profile.id, { type: 'newRound' });
    }, 3600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round]);

  /* ---- chips: pay my ante when the round goes live, settle on resolve ---- */
  const paidRound = useRef(-1);
  useEffect(() => {
    if (!state || state.phase !== 'guessing' || !mySeat || mySeat.stake <= 0) return;
    if (paidRound.current === state.round) return;
    paidRound.current = state.round;
    addChips(-mySeat.stake, { silent: true });
    audio.play('chip');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  const settledRound = useRef(-1);
  useEffect(() => {
    if (!state || state.phase !== 'settled' || state.round === 0) return;
    if (settledRound.current === state.round) return;
    settledRound.current = state.round;
    const seat = state.seats.find((s) => s.userId === profile.id);
    if (!seat || paidRound.current !== state.round) return;
    const payout = seat.net + seat.stake;
    if (payout > 0) {
      addChips(payout);
      audio.play(state.winners.includes(profile.id) && state.winners.length === 1 ? 'bigWin' : 'win');
      haptic('win');
    } else {
      audio.play('lose');
    }
    const won = seat.net > 0;
    reportNight(won ? 'win' : 'lose', seat.net);
    recordResult('highlow', won ? 'win' : 'lose', seat.net, {});
    addXp(XP_REWARDS.handPlayed + (won ? XP_REWARDS.gameWon : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  /* ---- refund a live ante on any exit before the round resolves ---- */
  useEffect(() => {
    if (!room || !mySeat) return;
    const bail = () => { void send(profile.id, { type: 'leave', userId: profile.id }); };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), profile.id]);

  const leaveCleanup = useRef<() => void>(() => {});
  leaveCleanup.current = () => {
    const st = useHighLowRoom.getState().state;
    if (st && st.phase !== 'settled' && paidRound.current === st.round) {
      const seat = st.seats.find((s) => s.userId === profile.id);
      if (seat && seat.stake > 0) addChips(seat.stake, { silent: true });
    }
    paidRound.current = -1;
    void leave(profile.id);
    if (isOnline()) void usePlayer.getState().refreshFromServer();
  };
  useEffect(() => () => leaveCleanup.current(), []);

  const guess = (choice: 'higher' | 'lower') => {
    if (!state || state.phase !== 'guessing' || !mySeat?.alive || mySeat.guess === 'higher' || mySeat.guess === 'lower') return;
    audio.play('click');
    haptic('chip');
    void send(profile.id, { type: 'guess', userId: profile.id, guess: choice });
  };

  const link = useMemo(() => (room ? `${window.location.origin}/game/highlow/room/${room.code}` : ''), [room]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); audio.play('click'); toast(t('common.copied'), 'good', '📋'); }
    catch { toast(text, 'neutral'); }
  };

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🔑</div>
          <h2>{t('highlow.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="gold" onClick={() => navigate(isOnline() ? '/login' : '/hub')}>{t(isOnline() ? 'auth.signIn' : 'common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  const phase = state.phase;
  const secondsLeft = phase === 'guessing' && state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : 0;
  const iAmOut = Boolean(mySeat) && !mySeat?.alive && phase === 'guessing';
  const canGuess = phase === 'guessing' && mySeat?.alive && mySeat.guess !== 'higher' && mySeat.guess !== 'lower';
  const potNow = phase === 'betting'
    ? (state.anteAmount ?? 0) * state.seats.length
    : state.pot;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 8%, #14201a, #0c0a10 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="22%" size={640} color="rgba(74,201,142,.15)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 720 }}>
        <div className="text-center">
          <span className="eyebrow">{t('highlow.title')}</span>
          <h1 className="mt-1">
            {room.code}
            {state.turn > 0 && phase !== 'betting' && <span style={{ color: 'var(--jade-hi)' }}> · {t('highlow.turn', { n: state.turn })}</span>}
          </h1>
          {potNow > 0 && <p className="num mt-1 text-[13px]" style={{ color: 'var(--gold-hi)' }}>{t('games.pot')} {fmt(potNow)}</p>}
        </div>

        <GlassPanel gold className="p-3 w-full flex items-center justify-end gap-2 flex-wrap">
          <GameButton size="sm" tone="metal" onClick={() => copy(room.code)}>{t('rooms.copyCode')}</GameButton>
          <GameButton size="sm" tone="metal" onClick={() => copy(link)}>{t('rooms.copyLink')}</GameButton>
        </GlassPanel>

        {/* base card + reveal */}
        <div className="relative flex items-center justify-center gap-4 py-2" style={{ minHeight: 170 }}>
          <AnimatePresence>
            {phase === 'settled' && state.winners.includes(profile.id) && state.winners.length === 1 && (
              <VictoryEffect kind={profile.equipped.victory} />
            )}
          </AnimatePresence>
          <div className="flex flex-col items-center gap-1.5">
            <PlayingCard card={state.base ?? undefined} faceDown={!state.base} size="lg" face={profile.equipped.cardFace} back={profile.equipped.cardBack} fresh={false} />
            <span className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>{t('highlow.baseCard')}</span>
          </div>
          {state.revealed && (phase === 'settled' || phase === 'guessing') && (
            <motion.div className="flex flex-col items-center gap-1.5" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <PlayingCard card={state.revealed} size="lg" face={profile.equipped.cardFace} back={profile.equipped.cardBack} fresh={false} />
              <span className="text-[11px] font-bold" style={{ color: 'var(--jade-hi)' }}>{t('highlow.lastCard')}</span>
            </motion.div>
          )}
          {phase === 'guessing' && (
            <div className="absolute -top-1 start-1/2 -translate-x-1/2 num font-black"
              style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: secondsLeft <= 3 ? 'var(--crimson-hi)' : 'var(--gold-hi)', textShadow: '0 0 20px var(--glow-gold)' }}>
              {secondsLeft}
            </div>
          )}
        </div>

        {/* seats */}
        <div className="flex flex-wrap justify-center gap-3 w-full">
          {state.seats.map((seat) => {
            const isWinner = state.winners.includes(seat.userId);
            const out = !seat.alive && phase !== 'betting' && seat.stake > 0;
            const hasGuessed = seat.guess === 'higher' || seat.guess === 'lower' || seat.guess === 'hidden';
            const showGuess = phase === 'settled' && (seat.guess === 'higher' || seat.guess === 'lower');
            return (
              <motion.div
                key={seat.userId}
                className="flex flex-col items-center gap-1"
                animate={{ scale: isWinner ? 1.06 : 1, opacity: out ? 0.4 : 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <div className="relative">
                  <Avatar config={seat.avatar} size={34} level={seat.level} id={`hl-${seat.userId}`} />
                  <span className="absolute -bottom-0.5 -end-0.5 rounded-full" style={{ width: 10, height: 10, background: seat.color, border: '2px solid var(--ink)' }} />
                  {out && <span className="absolute inset-0 grid place-items-center text-[16px]">✖</span>}
                </div>
                <PlayerName username={seat.userId === profile.id ? t('night.you') : seat.username} title={seat.title} nameColor={seat.nameColor} size={10.5} />
                {phase === 'guessing' && seat.alive && (
                  <span className="text-[13px]">{hasGuessed ? '🔒' : '…'}</span>
                )}
                {showGuess && <span className="text-[13px]">{seat.guess === 'higher' ? '⬆️' : '⬇️'}</span>}
              </motion.div>
            );
          })}
        </div>

        {/* controls */}
        <GlassPanel gold className="p-4 w-full">
          {phase === 'betting' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">{t('night.fixedAnte')}</span>
                <span className="num text-[12px]" style={{ color: 'var(--gold-hi)' }}>{t('games.pot')} {fmt(potNow)}</span>
              </div>
              {isHost ? (
                <div className="flex flex-wrap gap-2">
                  {NIGHT_ANTES.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { audio.play('click'); void send(profile.id, { type: 'nightAnte', amount: amt }); }}
                      className="px-3 py-1.5 rounded-[var(--r-xs)] text-[12px] num press"
                      style={{
                        background: state.anteAmount === amt ? 'var(--gold-line)' : 'var(--glass)',
                        border: `1px solid ${state.anteAmount === amt ? 'var(--gold-hi)' : 'var(--glass-line)'}`,
                      }}
                    >
                      {fmt(amt)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[12px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
              )}
              {isHost && (
                <GameButton tone="jade" block className="mt-3" disabled={state.seats.length < 2 || !state.anteAmount}
                  onClick={() => { startTried.current = state.round; void send(profile.id, { type: 'start', nonce: newSeed(), deadline: Date.now() + GUESS_MS }); }}>
                  {t('highlow.startRound')}
                </GameButton>
              )}
              {state.seats.length < 2 && <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--dim)' }}>{t('roulette.needPlayers')}</p>}
            </>
          ) : phase === 'guessing' ? (
            iAmOut ? (
              <p className="text-center text-[13px]" style={{ color: 'var(--crimson-hi)' }}>{t('highlow.youreOut')}</p>
            ) : !mySeat ? (
              <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>{t('highlow.spectating')}</p>
            ) : (
              <div className="flex gap-3">
                <GameButton tone="jade" size="lg" block disabled={!canGuess} onClick={() => guess('higher')}>
                  ⬆️ {t('highlow.higher')}
                </GameButton>
                <GameButton tone="danger" size="lg" block disabled={!canGuess} onClick={() => guess('lower')}>
                  ⬇️ {t('highlow.lower')}
                </GameButton>
              </div>
            )
          ) : phase === 'waiting' ? (
            <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>{t('rooms.waitingForPlayers')}</p>
          ) : (
            <div className="text-center">
              <div className="text-[20px] font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>
                {state.winners.length === 1
                  ? t('highlow.tookPot', { name: nameOf(state, state.winners[0], profile.id, t('night.you')) })
                  : t('highlow.splitPot')}
              </div>
              {isHost && <GameButton tone="gold" block className="mt-3" onClick={() => void send(profile.id, { type: 'newRound' })}>{t('roulette.newRound')}</GameButton>}
            </div>
          )}
        </GlassPanel>

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => navigate(nightReturn ?? '/hub')}>
            {nightReturn ? t('night.backToNight') : t('common.back')}
          </GameButton>
        </div>
      </div>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}

function nameOf(state: { seats: { userId: string; username: string }[] }, userId: string, meId: string, youLabel: string) {
  if (userId === meId) return youLabel;
  return state.seats.find((s) => s.userId === userId)?.username ?? 'Player';
}
