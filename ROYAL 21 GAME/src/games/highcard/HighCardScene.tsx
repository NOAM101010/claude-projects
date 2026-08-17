import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/social/Avatar';
import { ChatPanel } from '@/components/social/ChatPanel';
import { BetSelector } from '@/components/game/BetSelector';
import { PlayingCard } from '@/components/game/PlayingCard';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { buildShoe, cardValue } from '@/games/blackjack/engine';
import { newSeed } from '@/lib/random';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { useHighcardRoom } from '@/stores/useHighcardRoom';
import { notificationService } from '@/services/notificationService';
import { presenceService, type RoomPresenceMeta } from '@/services/presenceService';
import { useT } from '@/hooks/useT';
import { useNightReturn } from '@/hooks/useNightReturn';
import { useNightScoring } from '@/hooks/useNightScoring';
import { isOnline } from '@/services/supabase';
import { roomsService } from '@/services/roomsService';
import { STAKES, XP_REWARDS } from '@/data/economy';
import { VIP_HIGHCARD_STAKES, isVipEligible } from '@/data/vip';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import type { Card } from '@/games/blackjack/types';

interface Props { mode: 'solo' | 'room'; roomCode?: string }

export default function HighCardScene({ mode, roomCode }: Props) {
  return mode === 'room' && roomCode ? <HighCardRoom roomCode={roomCode} /> : <HighCardSolo />;
}

/** War, one card each, against the dealer — unchanged solo economy. */
function HighCardSolo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useT();
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('highcard');
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);

  const vipMode = params.get('vip') === '1' && isVipEligible(profile);
  const stakeTable = vipMode ? VIP_HIGHCARD_STAKES : STAKES;
  const [stake, setStake] = useState<number>(vipMode ? VIP_HIGHCARD_STAKES[0] : 100);
  const [pot, setPot] = useState(0);
  const [phase, setPhase] = useState<'bet' | 'countdown' | 'reveal' | 'result'>('bet');
  const [count, setCount] = useState(3);
  const [mine, setMine] = useState<Card | null>(null);
  const [theirs, setTheirs] = useState<Card | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'lose' | 'war' | null>(null);
  const [payTableOpen, setPayTableOpen] = useState(false);

  const rank = (card: Card) => (card.r === 'A' ? 14 : ['J', 'Q', 'K'].includes(card.r) ? 10 + ['J', 'Q', 'K'].indexOf(card.r) + 1 : cardValue(card.r));

  const deal = (amount: number, carriedPot = 0) => {
    const isWarContinuation = carriedPot > 0;
    const canAfford = profile.chips >= amount;
    if (!isWarContinuation && !canAfford) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(amount - profile.chips) }), 'bad', '⚠');
      return;
    }
    if (canAfford) {
      addChips(-amount, { silent: true });
    }
    const nextPot = carriedPot + amount * 2;
    setPot(nextPot);
    setMine(null);
    setTheirs(null);
    setOutcome(null);
    setPhase('countdown');
    setCount(3);

    const shoe = buildShoe(newSeed());
    const [a, b] = [shoe[0], shoe[1]];

    const tick = setInterval(() => {
      setCount((value) => {
        if (value <= 1) {
          clearInterval(tick);
          audio.play('cardFlip');
          haptic('card');
          setMine(a);
          setTheirs(b);
          setPhase('reveal');
          setTimeout(() => {
            const mineRank = rank(a);
            const theirsRank = rank(b);
            if (mineRank === theirsRank) {
              setOutcome('war');
              setPhase('result');
              audio.play('notify');
              return;
            }
            const isWin = mineRank > theirsRank;
            setOutcome(isWin ? 'win' : 'lose');
            setPhase('result');
            if (isWin) {
              addChips(nextPot);
              audio.play(nextPot >= 2000 ? 'bigWin' : 'win');
              haptic('win');
            } else {
              audio.play('lose');
            }
            reportNight(isWin ? 'win' : 'lose', isWin ? nextPot - amount : -amount);
            recordResult('highcard', isWin ? 'win' : 'lose', isWin ? nextPot - amount : -amount, {
              hcGames: stats.hcGames + 1,
            });
            addXp(XP_REWARDS.handPlayed + (isWin ? XP_REWARDS.gameWon : 0));
          }, 700);
          return 0;
        }
        audio.play('click');
        return value - 1;
      });
    }, 650);
  };

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 8%, #1a1424, #0c0a10 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="32%" size={640} color="rgba(123,91,214,.16)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-4" style={{ maxWidth: 620 }}>
        <div className="text-center">
          <span className="eyebrow">{t('games.highcard')}</span>
          <h1 className="mt-1">{t('games.higher')}</h1>
        </div>

        <div className="relative flex items-center justify-center gap-6" style={{ minHeight: 190 }}>
          <AnimatePresence>{outcome === 'win' && <VictoryEffect kind={profile.equipped.victory} />}</AnimatePresence>

          {[{ card: mine, label: t('common.you'), win: outcome === 'win' },
            { card: theirs, label: t('blackjack.dealer'), win: outcome === 'lose' }].map((entry, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center gap-2"
              animate={{ scale: entry.win ? 1.08 : 1, y: entry.win ? -8 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <div style={{ filter: entry.win ? 'drop-shadow(0 0 22px var(--glow-gold))' : 'none' }}>
                <PlayingCard
                  card={entry.card ?? undefined}
                  faceDown={!entry.card}
                  size="lg"
                  face={profile.equipped.cardFace}
                  back={profile.equipped.cardBack}
                  fresh={false}
                />
              </div>
              <span className="text-[12px] font-bold" style={{ color: entry.win ? 'var(--gold-hi)' : 'var(--muted)' }}>{entry.label}</span>
            </motion.div>
          ))}

          <AnimatePresence>
            {phase === 'countdown' && (
              <motion.div
                key={count}
                className="absolute font-black"
                style={{ fontFamily: 'var(--font-display)', fontSize: 76, color: 'var(--gold-hi)', textShadow: '0 0 30px var(--glow-gold)' }}
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                {count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {phase === 'result' ? (
          <GlassPanel gold className="p-4 w-full text-center">
            <div className="text-[24px] font-black" style={{ fontFamily: 'var(--font-display)', color: outcome === 'win' ? 'var(--gold-hi)' : outcome === 'war' ? 'var(--social)' : 'var(--crimson-hi)' }}>
              {outcome === 'war' ? t('games.war') : outcome === 'win' ? t('blackjack.win') : t('blackjack.lose')}
            </div>
            <p className="num mt-1 mb-4" style={{ color: 'var(--muted)' }}>
              {outcome === 'win' ? `+${fmt(pot - stake)}` : outcome === 'war' ? `${t('games.pot')} ${fmt(pot)}` : `-${fmt(stake)}`}
            </p>
            <div className="flex gap-2">
              {outcome === 'war' ? (
                <GameButton tone="gold" block onClick={() => deal(stake, pot)}>{t('games.war')} · {fmt(stake)}</GameButton>
              ) : (
                <GameButton tone="gold" block onClick={() => setPhase('bet')}>{t('games.rematch')}</GameButton>
              )}
              <GameButton tone="ghost" block onClick={() => navigate(nightReturn ?? '/hub')}>
                {nightReturn ? t('night.backToNight') : t('common.back')}
              </GameButton>
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel gold className="p-4 w-full">
            <BetSelector
              stakes={stakeTable}
              value={stake}
              onChange={setStake}
              chipSkin={profile.equipped.chipSkin}
              disabled={phase !== 'bet'}
              chips={profile.chips}
            />
            <GameButton tone="gold" size="lg" block disabled={phase !== 'bet' || profile.chips < stake} onClick={() => deal(stake)}>
              {t('games.draw')} · {fmt(stake)}
            </GameButton>
            <GameButton tone="ghost" size="sm" block className="mt-2" onClick={() => setPayTableOpen(true)}>
              {t('games.paytable')}
            </GameButton>
          </GlassPanel>
        )}
      </div>

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('games.paytable')}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <span className="text-[22px]">🏆</span>
            <b className="flex-1 text-[13px]">{t('games.hcWin')}</b>
            <b className="num" style={{ color: 'var(--gold-hi)' }}>×2</b>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <span className="text-[22px]">⚔️</span>
            <b className="flex-1 text-[13px]">{t('games.hcWar')}</b>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <span className="text-[22px]">💨</span>
            <b className="flex-1 text-[13px]">{t('games.hcLose')}</b>
            <b className="num" style={{ color: 'var(--muted)' }}>×0</b>
          </div>

          <div className="eyebrow mt-3 mb-1">{t('games.hcChainTitle')}</div>
          {[1, 2, 3, 4].map((round) => (
            <div key={round} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              <b className="flex-1 text-[13px]" style={{ color: 'var(--muted)' }}>
                {round === 1 ? t('games.hcOpening') : t('games.hcRound', { n: round - 1 })}
              </b>
              <b className="num" style={{ color: 'var(--gold-hi)' }}>{fmt(stake * round * 2)}</b>
            </div>
          ))}

          <p className="mt-2 text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>{t('games.hcFairness')}</p>
        </div>
      </Modal>
    </SceneShell>
  );
}

/** Up to 5 players ante into a shared pot; highest card takes it all. Ties send just the tied seats to a war re-draw. */
function HighCardRoom({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const setLoading = useUI((s) => s.setLoading);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const nightReturn = useNightReturn();
  const reportNight = useNightScoring('highcard');
  const friends = useSocial((s) => s.friends);

  const { room, members, state, isHost, create, joinByCode, send, leave } = useHighcardRoom();
  const [stake, setStake] = useState(100);
  const [payTableOpen, setPayTableOpen] = useState(false);
  const settledRound = useRef(-1);
  const booting = useRef(false);

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
          if (created) navigate(`/game/highcard/room/${created.code}`, { replace: true });
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
    const meta: RoomPresenceMeta = { username: profile.username, presence: 'roulette', game: 'highcard', spectator: false };
    const conn = presenceService.track(room.id, profile.id, meta);
    conn.onSync((s) => {
      setSpectators(Object.values(s).map((e) => e[0]).filter((m): m is RoomPresenceMeta => Boolean(m?.spectator)).map((m) => m.username));
    });
    return conn.unsubscribe;
  }, [room?.id, profile.id, profile.username]);

  /* Settle once per newly-resolved round (phase 'settled', winners decided). War rounds don't settle chips — only the final decision does. */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || state.round === 0) return;
    if (settledRound.current === state.round) return;
    settledRound.current = state.round;
    const seat = state.seats.find((s) => s.userId === profile.id);
    if (!seat || seat.stake <= 0) return;
    const payout = seat.net + seat.stake;
    if (payout > 0) {
      addChips(payout);
      audio.play(state.winners.includes(profile.id) ? 'bigWin' : 'win');
      haptic('win');
    } else {
      audio.play('lose');
    }
    reportNight(seat.net > 0 ? 'win' : 'lose', seat.net);
    recordResult('highcard', seat.net > 0 ? 'win' : 'lose', seat.net, {});
    addXp(XP_REWARDS.handPlayed + (seat.net > 0 ? XP_REWARDS.gameWon : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  const link = useMemo(() => (room ? `${window.location.origin}/game/highcard/room/${room.code}` : ''), [room]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); audio.play('click'); toast(t('common.copied'), 'good', '📋'); }
    catch { toast(text, 'neutral'); }
  };

  const ante = () => {
    if (!state || state.phase !== 'betting') return;
    // Guard against a rapid double-tap racing the seat's ante update.
    if (mySeat?.stake) return;
    if (profile.chips < stake) {
      audio.play('error');
      toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    audio.play('chip');
    haptic('chip');
    addChips(-stake, { silent: true });
    void send(profile.id, { type: 'ante', userId: profile.id, amount: stake }).then((ok) => {
      // Rate-limit / network drop: refund locally so the ante doesn't vanish.
      if (!ok) {
        addChips(stake, { silent: true });
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const clearAnte = () => {
    if (!mySeat?.stake) return;
    addChips(mySeat.stake, { silent: true });
    void send(profile.id, { type: 'clearAnte', userId: profile.id });
  };

  const handleDraw = () => { audio.play('cardFlip'); haptic('card'); void send(profile.id, { type: 'draw' }); };
  const handleNewRound = () => void send(profile.id, { type: 'openBetting' });

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🔑</div>
          <h2>{t('games.highcard')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="gold" onClick={() => navigate(isOnline() ? '/login' : '/hub')}>{t(isOnline() ? 'auth.signIn' : 'common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  const ready = state.seats.filter((s) => s.stake > 0);
  const phase = state.phase;
  const canAnte = phase === 'betting' && !mySeat?.stake;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 8%, #1a1424, #0c0a10 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="20%" size={640} color="rgba(123,91,214,.16)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 700 }}>
        <div className="text-center">
          <span className="eyebrow">{t('games.highcard')} · {t('duel.short')}</span>
          <h1 className="mt-1">
            {room.code}
            {phase === 'war' && <span style={{ color: 'var(--social)' }}> · {t('games.war')} {state.warRound}</span>}
          </h1>
          {state.pot > 0 && <p className="num mt-1 text-[13px]" style={{ color: 'var(--gold-hi)' }}>{t('games.pot')} {fmt(state.pot)}</p>}
        </div>

        <GlassPanel gold className="p-3 w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
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

        {/* seats + cards */}
        <div className="flex flex-wrap justify-center gap-4 w-full py-2">
          <AnimatePresence>
            {phase === 'settled' && state.winners.includes(profile.id) && <VictoryEffect kind={profile.equipped.victory} />}
          </AnimatePresence>
          {state.seats.map((seat) => {
            const isWinner = state.winners.includes(seat.userId);
            const isOut = seat.stake > 0 && !seat.contending && phase !== 'betting';
            return (
              <motion.div
                key={seat.userId}
                className="flex flex-col items-center gap-1.5"
                animate={{ scale: isWinner ? 1.08 : 1, y: isWinner ? -8 : 0, opacity: isOut ? 0.5 : seat.stake > 0 || phase === 'betting' ? 1 : 0.6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <div style={{ filter: isWinner ? 'drop-shadow(0 0 22px var(--glow-gold))' : 'none' }}>
                  <PlayingCard
                    card={seat.card ?? undefined}
                    faceDown={!seat.card}
                    size="md"
                    face={profile.equipped.cardFace}
                    back={profile.equipped.cardBack}
                    fresh={false}
                  />
                </div>
                <div className="relative">
                  <Avatar config={seat.avatar} size={30} level={seat.level} id={`hc-${seat.userId}`} />
                  <span className="absolute -bottom-0.5 -end-0.5 rounded-full" style={{ width: 10, height: 10, background: seat.color, border: '2px solid var(--ink)' }} />
                </div>
                <b className="text-[10.5px] truncate max-w-[70px]">{seat.userId === profile.id ? t('night.you') : seat.username}</b>
                {seat.stake > 0 && <span className="text-[9.5px] num" style={{ color: 'var(--gold)' }}>{fmt(seat.stake)}</span>}
              </motion.div>
            );
          })}
        </div>

        {friends.filter((f) => f.presence !== 'offline').length > 0 && phase === 'betting' && (
          <div className="flex flex-wrap gap-2 px-1">
            {friends.filter((f) => f.presence !== 'offline').slice(0, 6).map((friend) => (
              <GameButton key={friend.id} size="sm" tone="ghost" onClick={async () => {
                await notificationService.invite(profile.id, friend.id, room.code, 'highcard');
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
              <BetSelector stakes={STAKES} value={stake} onChange={setStake} chipSkin={profile.equipped.chipSkin} disabled={!canAnte} chips={profile.chips} />
              <div className="flex gap-2">
                <GameButton tone="ghost" block disabled={!mySeat?.stake} onClick={clearAnte}>{t('blackjack.clear')}</GameButton>
                <GameButton tone="gold" block disabled={!canAnte} onClick={ante}>{t('games.draw')} · {fmt(stake)}</GameButton>
              </div>
              {isHost ? (
                <GameButton tone="jade" block className="mt-2" disabled={ready.length < 2} onClick={handleDraw}>{t('games.draw')}</GameButton>
              ) : (
                <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
              )}
              {ready.length < 2 && <p className="text-center mt-2 text-[12px]" style={{ color: 'var(--dim)' }}>{t('roulette.needPlayers')}</p>}
            </>
          ) : phase === 'war' ? (
            isHost ? (
              <GameButton tone="jade" size="lg" block onClick={handleDraw}>{t('games.war')} · {t('games.draw')}</GameButton>
            ) : (
              <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
            )
          ) : (
            <GameButton tone="gold" block disabled={!isHost} onClick={handleNewRound}>{t('roulette.newRound')}</GameButton>
          )}
        </GlassPanel>

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setPayTableOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={async () => { await leave(profile.id); navigate(nightReturn ?? '/hub'); }}>
            {nightReturn ? t('night.backToNight') : t('common.back')}
          </GameButton>
        </div>
      </div>

      <Modal open={payTableOpen} onClose={() => setPayTableOpen(false)} title={t('games.paytable')}>
        <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted)' }}>{t('games.hcPoolNote')}</p>
      </Modal>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
