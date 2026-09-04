import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SceneShell } from '@/components/layout/SceneShell';
import { ChatPanel } from '@/components/social/ChatPanel';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { PlayingCard } from '@/components/game/PlayingCard';
import { LightPool } from '@/components/effects/LightPool';
import { useSngRoom } from '@/stores/useSngRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { notificationService } from '@/services/notificationService';
import { presenceService, type RoomPresenceMeta } from '@/services/presenceService';
import { useT } from '@/hooks/useT';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { isOnline } from '@/services/supabase';
import { isFriendOnline } from '@/lib/presence';
import { roomsService } from '@/services/roomsService';
import { audio } from '@/audio/AudioManager';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { fmt } from '@/lib/format';
import { SNG_BUYINS, ACTION_SECONDS, NEXT_HAND_DELAY_MS, levelIndexFor } from '@/games/poker/engine';
import { XP_REWARDS } from '@/data/economy';
import { usePokerReveal } from '@/games/poker/useReveal';
import { bestHand } from '@/games/poker/handEval';
import { MAX_SEATS } from '@/games/poker/types';
import type { PokerSeat } from '@/games/poker/types';
import { SeatCard, ActionBar, HandOverBar } from './PokerScene';

const SLOTS = [
  { left: '50%', top: '90%' },
  { left: '13%', top: '76%' },
  { left: '4%', top: '34%' },
  { left: '50%', top: '8%' },
  { left: '96%', top: '34%' },
  { left: '87%', top: '76%' },
];

/** Sit & Go: same table as cash poker, wrapped with escalating blinds, no rebuys, winner takes all. */
export default function SitAndGoScene() {
  const { roomCode } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const recordResult = usePlayer((s) => s.recordResult);
  const bumpStat = usePlayer((s) => s.bumpStat);
  const addXp = usePlayer((s) => s.addXp);

  const { room, members, state, isHost, create, joinByCode, send, leave } = useSngRoom();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);
  const processedHand = useRef(0);
  const knownEliminated = useRef<string[]>([]);
  const settledTournament = useRef(false);
  const booting = useRef(false);

  const buyIn = SNG_BUYINS.includes(Number(params.get('buyIn')) as (typeof SNG_BUYINS)[number])
    ? Number(params.get('buyIn'))
    : SNG_BUYINS[1];

  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      if (booting.current) return;
      booting.current = true;
      useUI.getState().setLoading('loading.room');
      try {
        if (roomCode === 'new') {
          const created = await create(profile.id, buyIn);
          if (created) navigate(`/poker/sng/${created.code}`, { replace: true });
        } else if (roomCode) {
          const joined = await joinByCode(roomCode, profile.id);
          if (!joined) toast(t('rooms.notFound'), 'bad', '⚠');
        }
      } finally {
        useUI.getState().setLoading(null);
        booting.current = false;
      }
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const mySeat = useMemo(() => state?.seats.find((s) => s.userId === profile.id) ?? null, [state, profile.id]);
  const myTurn = Boolean(state && mySeat && state.seats[state.toAct]?.userId === profile.id);
  const tournament = state?.tournament ?? null;
  const registered = state ? state.seats.length : 0;
  const started = Boolean(state && state.handNumber > 0);

  const [spectators, setSpectators] = useState<string[]>([]);
  useEffect(() => {
    if (!room) return;
    const meta: RoomPresenceMeta = { username: profile.username, presence: 'blackjack', game: 'sng', spectator: !mySeat };
    const conn = presenceService.track(room.id, profile.id, meta);
    conn.onSync((s) => {
      setSpectators(Object.values(s).map((e) => e[0]).filter((m): m is RoomPresenceMeta => Boolean(m?.spectator)).map((m) => m.username));
    });
    return conn.unsubscribe;
  }, [room?.id, profile.id, profile.username, Boolean(mySeat)]);

  /* Decision clock — identical mechanics to the cash table. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state || state.toAct === -1) return;
    const tick = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(tick);
  }, [state?.toAct]);
  // One-shot latch per (toAct, deadline) — see PokerScene for the reasoning.
  const timeoutFiredFor = useRef<string>('');
  useEffect(() => {
    if (!state || state.toAct === -1) return;
    const actor = state.seats[state.toAct];
    if (!actor) return;
    const key = `${state.toAct}:${state.deadline ?? 0}`;
    if (isHost) {
      if (!state.deadline) { void send(profile.id, { type: 'setDeadline', deadline: Date.now() + ACTION_SECONDS * 1000 }); return; }
      if (Date.now() > state.deadline && timeoutFiredFor.current !== key) {
        timeoutFiredFor.current = key;
        void send(profile.id, { type: 'timeout', userId: actor.userId });
      }
      return;
    }
    if (state.deadline && Date.now() > state.deadline + 5000 && timeoutFiredFor.current !== key) {
      timeoutFiredFor.current = key;
      void send(profile.id, { type: 'timeout', userId: actor.userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.toAct, state?.deadline, now]);
  const secondsLeft = state?.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;

  const { displayCommunity, displayShowdown, liveEquity, revealing, displayStacks } = usePokerReveal(state);

  /* Players still in the tournament. Frozen against the raw eliminated list while
     an all-in runout is playing out — otherwise "players left" ticks down and a
     seat greys out before the last card lands, spoiling the result. */
  const prevEliminated = useRef<string[]>([]);
  useEffect(() => {
    if (tournament && !revealing) prevEliminated.current = tournament.eliminated;
  }, [tournament?.eliminated, revealing]);
  const displayEliminated = revealing ? prevEliminated.current : (tournament?.eliminated ?? []);
  // Purely off the eliminated list — an all-in seat sits at 0 chips mid-runout
  // yet is still very much in the hand, so a stack check here would drop it early.
  const alive = state?.seats.filter((s) => !displayEliminated.includes(s.userId)) ?? [];

  const winnerIds = useMemo(() => {
    if (!state || state.street !== 'waiting' || revealing) return new Set<string>();
    const fromShowdown = state.showdown?.filter((e) => e.won > 0).map((e) => e.userId) ?? [];
    if (fromShowdown.length) return new Set(fromShowdown);
    return new Set((state.lastResult ?? []).filter((r) => r.net > 0).map((r) => r.userId));
  }, [state, revealing]);

  const myHandLabel = useMemo(() => {
    if (!mySeat || (mySeat.hole?.length ?? 0) < 2 || displayCommunity.length < 3) return null;
    return t(`poker.hand.${bestHand([...mySeat.hole, ...displayCommunity]).category}`);
  }, [mySeat, displayCommunity, t]);

  const actLabelOf = (s: PokerSeat): string | null => {
    switch (s.lastAction) {
      case 'fold': return t('poker.act.fold');
      case 'check': return t('poker.act.check');
      case 'call': return t('poker.act.call');
      case 'bet': return t('poker.act.bet', { amount: fmt(Math.max(s.committed, 0)) });
      case 'raise': return t('poker.act.raise', { amount: fmt(Math.max(s.committed, 0)) });
      case 'allin': return t('poker.act.allin');
      default: return null;
    }
  };

  const [handOverAt, setHandOverAt] = useState<number | null>(null);
  const [mucked, setMucked] = useState(false);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (state?.street === 'waiting' && state?.lastResult && !revealing && !state?.tournament?.finished) {
      setHandOverAt((prev) => prev ?? Date.now());
    } else {
      setHandOverAt(null);
    }
  }, [state?.street, state?.lastResult, state?.handNumber, state?.tournament?.finished, revealing]);
  useEffect(() => { setMucked(false); }, [state?.handNumber]);
  useEffect(() => {
    if (handOverAt == null) return;
    const id = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [handOverAt]);
  const nextHandIn = handOverAt != null
    ? Math.max(0, Math.ceil((NEXT_HAND_DELAY_MS - (Date.now() - handOverAt)) / 1000))
    : null;
  const iPlayedThisHand = Boolean(mySeat && mySeat.hole?.length === 2 && state?.lastResult);
  const iShowed = Boolean(state?.revealed?.includes(profile.id));

  /* Ghost cleanup: host removes any seat whose player dropped out of room
     membership so a stranded seat can't freeze the table. Shared hook. */
  useGhostSeatCleanup(isHost, state?.seats, members,
    (userId) => void send(profile.id, { type: 'leave', userId }));

  /* The host keeps the tournament moving on its own — a turbo Sit & Go doesn't wait
     for anyone to click "next hand". `state.street` flips to 'waiting' the instant
     a hand resolves, even mid all-in-runout reveal (the engine settles everything
     in one synchronous step) — starting the next hand before the theatrical reveal
     above finishes would wipe the board out from under it, so this waits for
     `revealing` to clear first. */
  useEffect(() => {
    if (!isHost || !state || !tournament || tournament.finished) return;
    if (state.street !== 'waiting' || revealing) return;
    if (alive.length < 2) return;
    const timer = setTimeout(() => void send(profile.id, { type: 'startHand' }), NEXT_HAND_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.street, state?.handNumber, tournament?.finished, alive.length, revealing]);

  /* Settle stats once per finished hand, same as the cash table — no rivalry recording
     here since a Sit & Go's meaningful result is the tournament outcome, not the hand. */
  useEffect(() => {
    if (!state || state.street !== 'waiting' || !state.lastResult || state.handNumber === 0) return;
    if (revealing) return; // wait for this client's own board reveal to finish
    if (state.handNumber === processedHand.current) return;
    processedHand.current = state.handNumber;

    /* Knockout call-out — only once the reveal is done (guarded above). */
    const elim = state.tournament?.eliminated ?? [];
    const newlyOut = elim.filter((id) => !knownEliminated.current.includes(id) && id !== profile.id);
    knownEliminated.current = [...elim];
    if (newlyOut.length && !state.tournament?.finished) {
      const name = state.seats.find((s) => s.userId === newlyOut[0])?.username ?? '—';
      useUI.getState().showMoment({ kind: 'friendJoined', title: t('sng.knockedOut', { name }), icon: '💥', duration: 1800 });
    }

    const mine = state.lastResult.find((r) => r.userId === profile.id);
    if (mine?.net) audio.play(mine.net > 0 ? 'win' : 'lose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.street, state?.handNumber, revealing]);

  /* Settle the tournament itself, once — and only after this client's own
     all-in board reveal has finished. `tournament.finished` arrives on the same
     settled frame the reveal has only just begun, so without the `revealing`
     gate the "you won the tournament" moment + bigWin sting landed 4-8s before
     the last card hit the felt. */
  useEffect(() => {
    if (!tournament?.finished || settledTournament.current || revealing) return;
    settledTournament.current = true;
    const iWon = tournament.winnerId === profile.id;
    const wasIn = tournament.eliminated.includes(profile.id) || iWon;
    if (!wasIn) return;
    const pool = tournament.buyIn * (tournament.eliminated.length + 1);
    addXp(XP_REWARDS.handPlayed + (iWon ? XP_REWARDS.gameWon : 0));
    if (iWon) {
      addChips(pool);
      usePlayer.getState().grantEvent('ev_sng_win');
      const s = usePlayer.getState().stats;
      bumpStat({ sngWinStreak: s.sngWinStreak + 1 });
      recordResult('sng', 'win', pool - tournament.buyIn, {});
      audio.duck(1800);
      audio.play('bigWin');
      useUI.getState().showMoment({ kind: 'sessionEnd', title: 'sng.youWon', subtitle: `+${fmt(pool - tournament.buyIn)}`, icon: '🏆', duration: 2800 });
    } else {
      bumpStat({ sngWinStreak: 0 });
      recordResult('sng', 'lose', -tournament.buyIn, {});
      const place = (tournament.eliminated.length + 1) - tournament.eliminated.indexOf(profile.id);
      useUI.getState().showMoment({ kind: 'sessionEnd', title: t('sng.placed', { place }), icon: place === 2 ? '🥈' : place === 3 ? '🥉' : '🎯', duration: 2600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.finished, revealing]);

  const link = useMemo(() => (room ? `${window.location.origin}/poker/sng/${room.code}` : ''), [room]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); audio.play('click'); toast(t('common.copied'), 'good', '📋'); }
    catch { toast(text, 'neutral'); }
  };

  const register = async () => {
    if (!tournament || profile.chips < tournament.buyIn) { toast(t('poker.notEnoughChips'), 'bad', '⚠'); return; }
    const buyIn = tournament.buyIn;
    addChips(-buyIn, { silent: true });
    audio.play('chip');
    await send(profile.id, { type: 'join', userId: profile.id, username: profile.username, avatar: profile.avatar, level: profile.level, buyIn: 0, title: profile.equipped.title, nameColor: profile.equipped.nameColor });
    /* Refund ONLY if we're still not seated once the full window has elapsed.
       A bumped state.version is not proof our join was rejected — any other
       player's action advances it too, and firing the refund then handed out
       free entries while our seat was still in flight. Poll until the deadline,
       then re-confirm after a short grace before returning the buy-in. */
    const deadline = Date.now() + 8000;
    const confirmAndRefund = () => {
      const s2 = useSngRoom.getState().state;
      if (s2?.seats.some((s) => s.userId === profile.id)) return;
      addChips(buyIn, { silent: true });
      toast(t('sng.registrationFailed'), 'bad', '⚠');
    };
    const check = () => {
      const latest = useSngRoom.getState().state;
      if (latest?.seats.some((s) => s.userId === profile.id)) return;
      if (Date.now() > deadline) { setTimeout(confirmAndRefund, 700); return; }
      setTimeout(check, 300);
    };
    setTimeout(check, 300);
  };

  const leaveTable = async () => {
    if (mySeat) await send(profile.id, { type: 'leave', userId: profile.id });
    await leave(profile.id);
    navigate('/hub');
  };

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🔑</div>
          <h2>{t('sng.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="gold" onClick={() => navigate(isOnline() ? '/login' : '/hub')}>{t(isOnline() ? 'auth.signIn' : 'common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state || !tournament) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  const level = tournament.levels[levelIndexFor(tournament)];
  const nextLevelIn = Math.max(0, tournament.levelMs - ((Date.now() - tournament.startedAt) % tournament.levelMs));
  const canRegister = !mySeat && !started && registered < MAX_SEATS && profile.chips >= tournament.buyIn;

  const seatSlots = Array.from({ length: MAX_SEATS }, (_, seatNumber) => {
    const occupant = state.seats.find((s) => s.seat === seatNumber) ?? null;
    const mySeatNum = mySeat?.seat ?? null;
    const rel = mySeatNum != null ? (seatNumber - mySeatNum + MAX_SEATS) % MAX_SEATS : seatNumber;
    return { seatNumber, occupant, position: SLOTS[rel] };
  });

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 10%, #241a0e, #120c08 55%, #08090b 88%)' }} />
        <LightPool x="50%" y="18%" size={700} color="rgba(227,178,60,.16)" />
      </div>

      <div className="mx-auto px-3 py-3 flex flex-col gap-3" style={{ maxWidth: 880 }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="eyebrow">🏆 {t('sng.title')}</span>
            <h1 className="mt-0.5 text-[19px]">{room.code} · {t('sng.buyIn')} {fmt(tournament.buyIn)}</h1>
          </div>
          <div className="flex items-center gap-2">
            {spectators.length > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[11.5px]" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--muted)' }} title={spectators.join(', ')}>
                👁 {spectators.length}
              </span>
            )}
            <GameButton size="sm" tone="metal" onClick={() => copy(room.code)}>{t('rooms.copyCode')}</GameButton>
            <GameButton size="sm" tone="metal" onClick={() => copy(link)}>{t('rooms.copyLink')}</GameButton>
          </div>
        </div>

        {!tournament.finished && (
          <div className="flex items-center justify-center gap-4 text-[12px] px-3 py-2 rounded-full glass" style={{ color: 'var(--muted)' }}>
            <span>{t('sng.level')} {levelIndexFor(tournament) + 1}</span>
            <b className="num" style={{ color: 'var(--gold-hi)' }}>
              {level.sb}/{level.bb}{level.ante ? ` · ${t('sng.ante')} ${level.ante}` : ''}
            </b>
            <span className="num">{t('sng.nextLevel')} {Math.ceil(nextLevelIn / 60000)}m</span>
            <span>{t('sng.playersLeft')} {alive.length || registered}/{registered}</span>
          </div>
        )}

        {/* --------------------------- the felt --------------------------- */}
        <GlassPanel gold className="relative p-3" style={{ aspectRatio: '1.5', minHeight: 340 }}>
          {room.config?.tableSkin ? (
            <div className={`absolute inset-4 rounded-[50%] table-felt ${room.config.tableSkin}`} />
          ) : (
            <div className="absolute inset-4 rounded-[50%]" style={{ background: 'radial-gradient(ellipse at 50% 35%, #3a2812, #1c1409 75%)', border: '2px solid rgba(227,178,60,.35)' }} />
          )}

          <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-2 z-10">
            <div className="px-3 py-1 rounded-full text-[12px] num" style={{ background: 'rgba(0,0,0,.4)', color: 'var(--gold-hi)', border: '1px solid var(--gold-line)' }}>
              {chipGlyphOf(profile.equipped.currencySkin)} {t('poker.pot')} {fmt(state.pot || state.pots.reduce((s, p) => s + p.amount, 0))}
            </div>
            <div className="flex gap-1.5">
              {displayCommunity.map((card, i) => (
                <PlayingCard key={i} card={card} size="sm" index={i} face={profile.equipped.cardFace} back={profile.equipped.cardBack} />
              ))}
              {Array.from({ length: 5 - displayCommunity.length }).map((_, i) => (
                <div key={`ph-${i}`} className="rounded-[6px]" style={{ width: 44, height: 63, border: '1px dashed rgba(255,255,255,.12)' }} />
              ))}
            </div>
            {liveEquity && (
              <div className="flex gap-1.5 flex-wrap justify-center">
                {Object.entries(liveEquity).map(([userId, pct]) => {
                  const seat = state.seats.find((s) => s.userId === userId);
                  if (!seat) return null;
                  return (
                    <span
                      key={userId}
                      className="px-2 py-0.5 rounded-full text-[11px] num"
                      style={{ background: 'rgba(0,0,0,.4)', border: '1px solid var(--gold-line)', color: 'var(--gold-hi)' }}
                    >
                      {seat.username} · {t('poker.winChance', { pct: Math.round(pct * 100) })}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {seatSlots.map(({ seatNumber, occupant, position }) => (
            <div key={seatNumber} className="absolute -translate-x-1/2 -translate-y-1/2 z-20" style={{ left: position.left, top: position.top }}>
              {occupant ? (
                <SeatCard
                  seat={occupant}
                  isMe={occupant.userId === profile.id}
                  isTurn={state.toAct >= 0 && state.seats[state.toAct]?.userId === occupant.userId}
                  isDealer={state.dealerSeat >= 0 && state.seats[state.dealerSeat]?.userId === occupant.userId}
                  street={state.street}
                  showdown={displayShowdown}
                  runoutReveal={state.allInEquity !== null}
                  cardFace={profile.equipped.cardFace}
                  cardBack={profile.equipped.cardBack}
                  label={{ fold: t('poker.folded'), sitOut: t('sng.eliminated'), allin: t('poker.allInLabel'), winner: t('poker.handWinner') }}
                  revealedIds={state.revealed}
                  displayStack={displayStacks[occupant.userId]}
                  isWinner={winnerIds.has(occupant.userId)}
                  actLabel={actLabelOf(occupant)}
                  potDir={{ x: (50 - parseFloat(position.left)) * 2.6, y: (36 - parseFloat(position.top)) * 2.2 }}
                  handLabel={occupant.userId === profile.id ? myHandLabel : null}
                />
              ) : (
                !started && (
                  <button
                    className="grid place-items-center rounded-full press"
                    style={{ width: 58, height: 58, border: '1px dashed rgba(255,255,255,.2)', color: 'var(--dim)', fontSize: 11, background: 'rgba(0,0,0,.25)' }}
                    disabled={Boolean(mySeat) || !canRegister}
                    onClick={register}
                  >
                    {t('sng.register')}
                  </button>
                )
              )}
            </div>
          ))}
        </GlassPanel>

        {!started && (
          <div className="flex flex-wrap gap-2 px-1">
            {useSocial.getState().friends.filter((f) => isFriendOnline(f) && !f.currentGame).slice(0, 6).map((friend) => (
              <GameButton
                key={friend.id}
                size="sm"
                tone="ghost"
                onClick={async () => {
                  await notificationService.invite(profile.id, friend.id, room.code, 'sng');
                  toast(t('friends.requestSent', { name: friend.username }), 'good', '🎮');
                }}
              >
                ＋ {friend.username}
              </GameButton>
            ))}
          </div>
        )}

        {/* Hidden during an all-in runout — see PokerScene. */}
        {state.log.length > 0 && !revealing && (
          <div className="text-[11.5px] px-2 flex flex-col gap-0.5 max-h-[64px] overflow-y-auto" style={{ color: 'var(--dim)' }}>
            {state.log.slice(-4).map((line, i) => <span key={i}>{line}</span>)}
          </div>
        )}

        {state.street === 'waiting' && state.lastResult && !tournament.finished && !revealing && (
          <GlassPanel className="p-3 text-center">
            <span className="eyebrow">{t('poker.handNumber', { n: state.handNumber })}</span>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1.5">
              {state.lastResult.map((r) => {
                const seat = state.seats.find((s) => s.userId === r.userId);
                return (
                  <span key={r.userId} className="text-[12.5px] num">
                    {seat?.username ?? '—'}{' '}
                    <b style={{ color: r.net > 0 ? 'var(--jade-hi)' : r.net < 0 ? 'var(--crimson-hi)' : 'var(--muted)' }}>
                      {r.net > 0 ? '+' : ''}{fmt(r.net)}
                    </b>
                  </span>
                );
              })}
            </div>
          </GlassPanel>
        )}

        {state.street === 'waiting' && state.lastResult && !tournament.finished && !revealing && (
          <HandOverBar
            nextIn={nextHandIn}
            canChoose={iPlayedThisHand}
            shown={iShowed}
            mucked={mucked}
            onShow={() => void send(profile.id, { type: 'showCards', userId: profile.id })}
            onMuck={() => setMucked(true)}
            t={t}
          />
        )}

        {/* --------------------------- controls ---------------------------- */}
        {tournament.finished && !revealing ? (
          <GlassPanel gold className="p-6 text-center">
            <div className="text-[56px] mb-1">🏆</div>
            {(() => {
              const myPlace = tournament.winnerId === profile.id
                ? 1
                : (tournament.eliminated.length + 1) - tournament.eliminated.indexOf(profile.id);
              const wasIn = tournament.winnerId === profile.id || tournament.eliminated.includes(profile.id);
              return wasIn ? (
                <div className="text-[34px] font-black leading-none mb-1" style={{ color: 'var(--gold-hi)' }}>
                  {t('sng.finishPlace', { place: myPlace })}
                </div>
              ) : null;
            })()}
            <h2 className="mb-1 text-[22px]">
              {tournament.winnerId === profile.id ? t('sng.youWon') : t('sng.winnerIs', { name: state.seats.find((s) => s.userId === tournament.winnerId)?.username ?? '' })}
            </h2>
            {tournament.winnerId === profile.id && (
              <p className="num mb-3 text-[18px]" style={{ color: 'var(--gold-hi)' }}>+{fmt(tournament.buyIn * (tournament.eliminated.length + 1))}</p>
            )}
            <GameButton tone="ghost" onClick={leaveTable}>{t('common.back')}</GameButton>
          </GlassPanel>
        ) : !started ? (
          <GlassPanel className="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
              {t('sng.needPlayers')} · {registered}/{MAX_SEATS}
            </span>
            <div className="flex gap-2">
              {canRegister && <GameButton tone="gold" onClick={register}>{t('sng.register')}</GameButton>}
              {isHost && (
                <GameButton tone="jade" disabled={registered < 2} onClick={() => void send(profile.id, { type: 'startHand' })}>
                  {t('sng.startTournament')}
                </GameButton>
              )}
              <GameButton tone="ghost" onClick={leaveTable}>{t('common.back')}</GameButton>
            </div>
          </GlassPanel>
        ) : mySeat && mySeat.stack > 0 ? (
          <ActionBar
            seat={mySeat}
            state={state}
            myTurn={myTurn}
            raiseTo={raiseTo}
            setRaiseTo={setRaiseTo}
            onAct={(action) => void send(profile.id, action)}
            secondsLeft={secondsLeft}
            onUseTimeBank={() => void send(profile.id, { type: 'useTimeBank', userId: profile.id })}
            t={t}
          />
        ) : (
          <GlassPanel className="p-3.5 text-center">
            <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
              {mySeat ? t('sng.youAreOut') : t('sng.spectating')}
            </span>
          </GlassPanel>
        )}
      </div>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
