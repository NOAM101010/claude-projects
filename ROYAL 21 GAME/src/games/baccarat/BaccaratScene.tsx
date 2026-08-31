import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { PlayingCard } from '@/components/game/PlayingCard';
import { Chip } from '@/components/game/Chip';
import { LightPool } from '@/components/effects/LightPool';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useBaccaratRoom } from '@/stores/useBaccaratRoom';
import { roomsService } from '@/services/roomsService';
import { isOnline } from '@/services/supabase';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { fmt } from '@/lib/format';
import { XP_REWARDS } from '@/data/economy';
import { newSeed } from '@/lib/random';
import {
  createState, reduce, handTotal, betCost, PAYTABLE, BACCARAT_BETS, outcomeLabel,
} from './engine';
import type { BaccaratOutcome, BaccaratSide, BaccaratState } from './types';

const MAIN_BETS: { side: BaccaratOutcome; labelKey: string; color: string }[] = [
  { side: 'player', labelKey: 'baccarat.player', color: '#4a86d6' },
  { side: 'tie',    labelKey: 'baccarat.tie',    color: '#5aa563' },
  { side: 'banker', labelKey: 'baccarat.banker', color: '#c14040' },
];

const SIDE_BETS: { side: BaccaratSide; labelKey: string }[] = [
  { side: 'playerPair',  labelKey: 'baccarat.playerPair' },
  { side: 'bankerPair',  labelKey: 'baccarat.bankerPair' },
  { side: 'perfectPair', labelKey: 'baccarat.perfectPair' },
  { side: 'big',         labelKey: 'baccarat.big' },
  { side: 'small',       labelKey: 'baccarat.small' },
];

interface SceneProps { mode?: 'solo' | 'room'; roomCode?: string }

/** Baccarat entry point — Punto Banco. Solo runs everything locally; room
 *  mode connects to the shared-hand multiplayer table. */
export default function BaccaratScene({ mode = 'solo', roomCode }: SceneProps = {}) {
  if (mode === 'room' && roomCode) return <BaccaratRoom roomCode={roomCode} />;
  return <BaccaratSolo />;
}

function BaccaratSolo() {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);

  const [state, setState] = useState<BaccaratState>(() => createState(newSeed()));
  const [stake, setStake] = useState<number>(100);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [victory, setVictory] = useState(false);
  const settledRound = useRef(-1);

  const dispatch = (action: Parameters<typeof reduce>[1]) => setState((s) => reduce(s, action));
  const totalStaked = betCost(state.bet);

  /* When the hand resolves, credit the net delta and let the moment layer
     celebrate. Only fires once per round via the ref latch, so a re-render
     doesn't re-credit. */
  useEffect(() => {
    if (state.phase !== 'settled' || state.outcome === null) return;
    if (settledRound.current === state.round) return;
    settledRound.current = state.round;
    const staked = betCost(state.lastBet);
    // net is a NET delta (already accounts for staked). Credit staked back +
    // net so the running balance moves by exactly `net`.
    addChips(staked + state.net, { silent: true });
    recordResult('scratch', state.net > 0 ? 'win' : state.net < 0 ? 'lose' : 'push', state.net);
    addXp(XP_REWARDS.handPlayed + (state.net > 0 ? XP_REWARDS.handWon : 0));
    if (state.net > 0) {
      audio.duck(1400);
      audio.play(state.net >= staked * 4 ? 'bigWin' : 'win');
      haptic('win');
      setVictory(true);
      setTimeout(() => setVictory(false), 2200);
      showMoment({
        kind: 'bigWin',
        title: t(state.outcome === 'player' ? 'baccarat.playerWins' : state.outcome === 'banker' ? 'baccarat.bankerWins' : 'baccarat.tieWins'),
        subtitle: `+${fmt(state.net)}`,
        icon: state.outcome === 'tie' ? '🤝' : state.outcome === 'player' ? '👤' : '🏦',
        duration: 2000,
      });
    } else if (state.net < 0) {
      audio.play('lose');
    } else {
      audio.play('push');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round]);

  const placeMain = (side: BaccaratOutcome) => {
    if (state.phase !== 'betting') return;
    const currentMain = state.bet.main?.side === side ? state.bet.main.amount : 0;
    const needed = stake;
    if (profile.chips < needed) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(needed - profile.chips) }), 'bad', '⚠');
      return;
    }
    if (state.bet.main && state.bet.main.side !== side) {
      // Refund the previous main bet before switching sides.
      addChips(state.bet.main.amount, { silent: true });
    }
    addChips(-needed, { silent: true });
    dispatch({ type: 'setMainBet', side, amount: currentMain + needed });
    audio.play('chip'); haptic('chip');
  };

  const placeSide = (side: BaccaratSide) => {
    if (state.phase !== 'betting') return;
    if (profile.chips < stake) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    const current = state.bet.sides[side] ?? 0;
    addChips(-stake, { silent: true });
    dispatch({ type: 'setSideBet', side, amount: current + stake });
    audio.play('chip'); haptic('chip');
  };

  const clearBet = () => {
    if (totalStaked <= 0 || state.phase !== 'betting') return;
    addChips(totalStaked, { silent: true });
    dispatch({ type: 'clearBet' });
    audio.play('click');
  };

  const repeatLast = () => {
    if (state.phase !== 'betting') return;
    const need = betCost(state.lastBet);
    if (need <= 0) return;
    if (profile.chips + totalStaked < need) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(need - profile.chips - totalStaked) }), 'bad', '⚠');
      return;
    }
    if (totalStaked > 0) addChips(totalStaked, { silent: true });
    addChips(-need, { silent: true });
    dispatch({ type: 'repeatLast' });
    audio.play('chip');
  };

  const deal = () => {
    if (state.phase !== 'betting' || totalStaked <= 0) return;
    audio.play('cardFlip');
    dispatch({ type: 'deal' });
  };

  const newRound = () => {
    dispatch({ type: 'newRound' });
  };

  const face = profile.equipped.cardFace;
  const back = profile.equipped.cardBack;
  const chipSkin = profile.equipped.chipSkin;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #221730, #100c17 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={720} color="rgba(180,120,240,.16)" />
      </div>

      <VictoryEffect kind={victory ? 'bigWin' : null} />

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 640 }}>
        <div className="text-center">
          <span className="eyebrow">Punto Banco</span>
          <h1 className="mt-1">{t('baccarat.title')}</h1>
        </div>

        {/* road / history strip */}
        {state.history.length > 0 && (
          <div className="flex gap-1 overflow-x-auto w-full px-1" style={{ scrollbarWidth: 'none' }}>
            {state.history.map((o, i) => (
              <span key={i}
                className="shrink-0 rounded-full flex items-center justify-center num font-black"
                style={{
                  width: 20, height: 20, fontSize: 10,
                  background: o === 'player' ? '#4a86d6' : o === 'banker' ? '#c14040' : '#5aa563',
                  color: '#fff', opacity: i === 0 ? 1 : 0.55,
                }}>
                {outcomeLabel(o)}
              </span>
            ))}
          </div>
        )}

        {/* felt: two hands + totals */}
        <GlassPanel gold className="w-full p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {(['player', 'banker'] as const).map((side) => {
              const cards = state[side];
              const total = cards.length ? handTotal(cards) : null;
              const isWinner = state.outcome === side;
              return (
                <div key={side} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black tracking-widest"
                      style={{ color: side === 'player' ? '#8ab4ff' : '#ff8a8a' }}>
                      {side === 'player' ? t('baccarat.player').toUpperCase() : t('baccarat.banker').toUpperCase()}
                    </span>
                    {total !== null && (
                      <span className="num font-black rounded-full px-2 text-[13px]"
                        style={{
                          background: isWinner ? 'var(--brushed-gold)' : 'rgba(0,0,0,.5)',
                          color: isWinner ? '#1a1206' : 'var(--gold-hi)',
                          border: '1px solid var(--gold-line)', minWidth: 26, textAlign: 'center',
                        }}>{total}</span>
                    )}
                  </div>
                  <div className="flex justify-center min-h-[76px] items-end"
                    style={{ marginInlineStart: 14 }}>
                    <AnimatePresence mode="popLayout">
                      {cards.map((card, i) => (
                        <motion.div
                          key={`${side}-${state.round}-${i}`}
                          initial={{ y: -80, opacity: 0, rotate: -10 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ delay: i * 0.18, type: 'spring', stiffness: 240, damping: 20 }}
                          style={{ marginInlineStart: -14 }}
                        >
                          <PlayingCard card={card} size="md" index={i} face={face} back={back} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {cards.length === 0 && (
                      <div className="rounded-[6px] border-2 border-dashed w-[52px] h-[72px]"
                        style={{ borderColor: 'rgba(255,255,255,.12)' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.phase === 'settled' && state.outcome && (
            <div className="text-center">
              <b className="text-[15px]"
                style={{ color: state.net > 0 ? 'var(--gold-hi)' : state.net < 0 ? 'var(--crimson-hi)' : 'var(--muted)' }}>
                {state.net > 0 ? `+${fmt(state.net)}` : state.net < 0 ? fmt(state.net) : t('blackjack.push')}
              </b>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {t(state.outcome === 'player' ? 'baccarat.playerWins' : state.outcome === 'banker' ? 'baccarat.bankerWins' : 'baccarat.tieWins')}
              </div>
            </div>
          )}
        </GlassPanel>

        {/* main bets — real casino P / T / B layout */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {MAIN_BETS.map(({ side, labelKey, color }) => {
            const on = state.bet.main?.side === side ? state.bet.main.amount : 0;
            const hit = state.phase === 'settled' && state.outcome === side;
            return (
              <button
                key={side}
                onClick={() => placeMain(side)}
                disabled={state.phase !== 'betting'}
                className="relative rounded-[var(--r-sm)] press"
                style={{
                  border: `2px solid ${hit ? 'var(--gold-hi)' : color}`,
                  background: on > 0 ? `${color}30` : `${color}12`,
                  padding: '14px 10px',
                  boxShadow: hit ? '0 0 24px rgba(227,178,60,.55)' : 'none',
                  opacity: state.phase === 'betting' ? 1 : 0.75,
                  transition: 'all .25s',
                }}
              >
                <div className="text-[13px] font-black" style={{ color: '#fff' }}>{t(labelKey)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                  {side === 'tie' ? '8:1' : side === 'banker' ? '0.95:1' : '1:1'}
                </div>
                {on > 0 && (
                  <div className="absolute -top-2 -end-2 rounded-full px-2 py-0.5 num text-[11px] font-black"
                    style={{ background: 'var(--brushed-gold)', color: '#1a1206', border: '1px solid rgba(0,0,0,.4)' }}>
                    {fmt(on)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* side bets row */}
        <GlassPanel className="w-full p-2.5">
          <div className="text-[10.5px] text-center mb-1.5 font-black tracking-widest"
            style={{ color: 'var(--gold-hi)', letterSpacing: '.15em' }}>
            ✨ {t('baccarat.sideBets').toUpperCase()}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SIDE_BETS.map(({ side, labelKey }) => {
              const on = state.bet.sides[side] ?? 0;
              const hit = (state.sideResults[side] ?? 0) > 0 && state.phase === 'settled';
              return (
                <button
                  key={side}
                  onClick={() => placeSide(side)}
                  disabled={state.phase !== 'betting'}
                  className="relative rounded-[6px] press"
                  style={{
                    border: `1px solid ${hit ? 'var(--gold-hi)' : 'var(--gold-line)'}`,
                    background: on > 0 ? 'rgba(227,178,60,.15)' : 'rgba(255,255,255,.03)',
                    padding: '10px 4px',
                    boxShadow: hit ? '0 0 14px rgba(227,178,60,.55)' : 'none',
                    opacity: state.phase === 'betting' ? 1 : 0.75,
                  }}
                >
                  <div className="text-[10.5px] font-bold" style={{ color: 'var(--text)', lineHeight: 1.15 }}>
                    {t(labelKey)}
                  </div>
                  {on > 0 && (
                    <div className="absolute -top-1.5 -end-1.5 rounded-full px-1.5 num text-[10px] font-black"
                      style={{ background: 'var(--brushed-gold)', color: '#1a1206' }}>
                      {fmt(on)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        {/* chip rail + actions */}
        <GlassPanel className="w-full p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">{t('games.chooseStake')}</span>
            <span className="num text-[12px]" style={{ color: 'var(--gold)' }}>
              {t('baccarat.onTable')} · {fmt(totalStaked)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {BACCARAT_BETS.map((s) => (
              <button key={s} onClick={() => { audio.play('click'); setStake(s); }}
                style={{ opacity: stake === s ? 1 : 0.4, transform: stake === s ? 'translateY(-4px)' : 'none', transition: '.2s' }}>
                <Chip value={s} size={38} skin={chipSkin} interactive />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <GameButton size="sm" tone="ghost" disabled={totalStaked === 0 || state.phase !== 'betting'} onClick={clearBet}>
              {t('blackjack.clear')}
            </GameButton>
            <GameButton size="sm" tone="metal" disabled={state.phase !== 'betting' || betCost(state.lastBet) === 0} onClick={repeatLast}>
              🔁 {t('blackjack.lastBet')}
            </GameButton>
            {state.phase === 'settled' ? (
              <GameButton tone="gold" onClick={newRound}>{t('blackjack.newRound')}</GameButton>
            ) : (
              <GameButton tone="gold" disabled={totalStaked === 0 || state.phase !== 'betting'} onClick={deal}>
                {t('baccarat.deal')}
              </GameButton>
            )}
          </div>
        </GlassPanel>

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setRulesOpen(true)}>📖 {t('baccarat.howToPlay')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => setPayOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
        </div>
      </div>

      {/* Rulebook — the "how to play" the user asked for. */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={t('baccarat.howToPlay')}>
        <div className="text-[13px] leading-relaxed flex flex-col gap-3" style={{ color: 'var(--text)' }}>
          <div>
            <b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesGoal')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesGoalText')}</p>
          </div>
          <div>
            <b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesValues')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesValuesText')}</p>
          </div>
          <div>
            <b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesDeal')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesDealText')}</p>
          </div>
          <div>
            <b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesDraw')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesDrawText')}</p>
          </div>
          <div>
            <b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesSideBets')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesSideBetsText')}</p>
          </div>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t('games.paytable')}>
        <div className="flex flex-col gap-1.5">
          {PAYTABLE.map((row) => (
            <div key={row.key} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              <b className="flex-1 text-[13px]">{t(`baccarat.${row.key}`)}</b>
              <b className="num text-[12.5px]" style={{ color: 'var(--gold-hi)' }}>{row.payout}</b>
            </div>
          ))}
        </div>
      </Modal>
    </SceneShell>
  );
}

/* =========================================================================
 * Multiplayer Baccarat — shared hand, per-seat bets. Everyone at the table
 * bets on the same round; when the host clicks Deal (or the 15s timer
 * expires), the cards are dealt once and each seat is paid according to
 * their own bet.
 * ========================================================================= */

const BETTING_WINDOW_MS = 15_000;

function BaccaratRoom({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const addXp = usePlayer((s) => s.addXp);
  const recordResult = usePlayer((s) => s.recordResult);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);
  const setLoading = useUI((s) => s.setLoading);

  const { state, room, members, isHost, send, create, joinByCode, leave } = useBaccaratRoom();
  const [stake, setStake] = useState<number>(100);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [victory, setVictory] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const settledRound = useRef(-1);
  const booting = useRef(false);

  const mySeat = state?.seats.find((s) => s.userId === profile.id);
  const myBet = mySeat?.bet ?? { main: null, sides: {} };
  const totalStaked = betCost(myBet);

  /* The hand a bet placed right now will settle under. `deal` is what bumps
     state.round (not newRound), so a bet made while phase==='betting' and
     state.round===N is paid out when state.round===N+1. There is no explicit
     betting-round id in the engine, so this derived key is what we latch the
     optimistic-outlay refs to. */
  const bettingRound = (state?.round ?? 0) + 1;

  /* Chips this client optimistically deducted for bets this round. The host is
     the authority on which bets landed — a setMainBet/setSideBet inserted just
     as the betting window closes is rejected by the reducer (phase already
     'dealing'), and `send` resolving ok only means the row was inserted, not
     applied. At settle we compare this outlay against the authoritative
     betCost(mySeat.lastBet) and refund the difference. Additive and side-safe:
     it can only ever return chips. */
  const roundOutlay = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addOutlay = (round: number, delta: number) => {
    if (roundOutlay.current.round !== round) roundOutlay.current = { round, amount: 0 };
    roundOutlay.current.amount += delta;
  };

  /* How much of this round's outlay we've already handed back optimistically via
     a clearBet the host hasn't confirmed yet. Tracked apart from roundOutlay so
     the settle reconcile still sees the FULL amount deducted (a clearBet can be
     dropped or arrive out of order and the bet stays live and settles). This is
     then subtracted from the computed refund so a stake is never returned twice. */
  const clearRefunded = useRef<{ round: number; amount: number }>({ round: -1, amount: 0 });
  const addClearRefunded = (round: number, delta: number) => {
    if (clearRefunded.current.round !== round) clearRefunded.current = { round, amount: 0 };
    clearRefunded.current.amount = Math.max(0, clearRefunded.current.amount + delta);
  };

  /* --------------------------------------------------------- connect ---- */
  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      if (booting.current) return;
      booting.current = true;
      setLoading('loading.room');
      try {
        if (roomCode === 'new') {
          const created = await create(profile.id);
          if (created) navigate(`/game/baccarat/room/${created.code}`, { replace: true });
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

  /* Take a seat once the table exists. */
  useEffect(() => {
    if (!state || mySeat) return;
    void send(profile.id, {
      type: 'join', userId: profile.id, username: profile.username,
      avatar: profile.avatar, level: profile.level,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mySeat, profile.id]);

  /* Ghost cleanup: host drops seats missing from members. */
  useEffect(() => {
    if (!isHost || !state || members.length === 0) return;
    const present = new Set(members.map((m) => m.userId));
    const ghosts = state.seats.filter((s) => !present.has(s.userId));
    for (const ghost of ghosts) void send(profile.id, { type: 'leave', userId: ghost.userId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, members.map((m) => m.userId).sort().join('|'), state?.seats.map((s) => s.userId).sort().join('|')]);

  /* Betting window countdown. Host stamps the deadline when at least one
     seat has a bet, and auto-deals when the timer runs out. */
  useEffect(() => {
    if (!state || state.phase !== 'betting') return;
    const tick = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(tick);
  }, [state?.phase, state?.deadline]);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'betting') return;
    const anyBet = state.seats.some((s) => s.bet.main || Object.keys(s.bet.sides).length > 0);
    if (!anyBet) return;
    if (!state.deadline) {
      void send(profile.id, { type: 'setDeadline', deadline: Date.now() + BETTING_WINDOW_MS });
      return;
    }
    // Fresh nonce at deal time — betting is closed, so no client can precompute
    // the shoe from the published state and bet on it.
    if (Date.now() > state.deadline) void send(profile.id, { type: 'deal', nonce: newSeed() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.deadline, state?.seats.map((s) => `${s.userId}:${betCost(s.bet)}`).join('|'), now]);
  const secondsLeft = state?.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;

  /* Settle my own net when the hand resolves. */
  useEffect(() => {
    if (!state || state.phase !== 'settled' || !mySeat) return;
    if (settledRound.current === state.round) return;
    settledRound.current = state.round;
    const staked = betCost(mySeat.lastBet);
    // Credit staked back + net so profile.chips moves by exactly `net`.
    addChips(staked + mySeat.net, { silent: true });
    // Reconcile the optimistic outlay: refund whatever this client deducted
    // for bets the host never accepted (rejected at the betting→dealing
    // boundary, or a setMainBet/setSideBet that never landed). `staked` is the
    // authoritative amount; clearedBack is what an unconfirmed clearBet already
    // returned. Only ever refunds — never takes chips.
    if (roundOutlay.current.round === state.round) {
      const clearedBack = clearRefunded.current.round === state.round ? clearRefunded.current.amount : 0;
      const rejected = roundOutlay.current.amount - staked - clearedBack;
      if (rejected > 0) addChips(rejected, { silent: true });
      roundOutlay.current = { round: -1, amount: 0 };
    }
    if (clearRefunded.current.round === state.round) clearRefunded.current = { round: -1, amount: 0 };
    recordResult('scratch', mySeat.net > 0 ? 'win' : mySeat.net < 0 ? 'lose' : 'push', mySeat.net);
    addXp(XP_REWARDS.handPlayed + (mySeat.net > 0 ? XP_REWARDS.handWon : 0));
    if (mySeat.net > 0) {
      audio.duck(1400);
      audio.play(mySeat.net >= staked * 4 ? 'bigWin' : 'win');
      haptic('win');
      setVictory(true);
      setTimeout(() => setVictory(false), 2200);
      showMoment({
        kind: 'bigWin',
        title: t(state.outcome === 'player' ? 'baccarat.playerWins' : state.outcome === 'banker' ? 'baccarat.bankerWins' : 'baccarat.tieWins'),
        subtitle: `+${fmt(mySeat.net)}`,
        icon: state.outcome === 'tie' ? '🤝' : state.outcome === 'player' ? '👤' : '🏦',
        duration: 2000,
      });
    } else if (mySeat.net < 0) audio.play('lose');
    else audio.play('push');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round]);

  /* Auto-restart a new round 3s after settle so the table keeps moving. */
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'settled') return;
    const timer = setTimeout(() => void send(profile.id, { type: 'newRound' }), 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round]);

  /* Best-effort leave-and-refund on tab close. */
  useEffect(() => {
    if (!room || !mySeat) return;
    const bail = () => {
      const st = useBaccaratRoom.getState().state;
      const seat = st?.seats.find((s) => s.userId === profile.id);
      // Refund any live bet that never got settled — take the larger of the
      // synced seat bet and the optimistic outlay this client deducted but
      // that may not have reached the host yet. Math.max avoids double-paying
      // a bet that is both synced and tracked.
      const syncedCost = seat ? betCost(seat.bet) : 0;
      const br = (st?.round ?? 0) + 1;
      const outlayAmt = roundOutlay.current.round === br ? roundOutlay.current.amount : 0;
      const refundedSoFar = clearRefunded.current.round === br ? clearRefunded.current.amount : 0;
      const refund = Math.max(syncedCost, outlayAmt - refundedSoFar);
      if (refund > 0) addChips(refund, { silent: true });
      void send(profile.id, { type: 'leave', userId: profile.id });
    };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), profile.id]);

  /* ---------- action handlers (reuse solo shapes, dispatch to room) ---- */
  const placeMain = (side: BaccaratOutcome) => {
    if (!state || state.phase !== 'betting' || !mySeat) return;
    if (profile.chips < stake) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    const prevMain = mySeat.bet.main;
    const currentMain = prevMain?.side === side ? prevMain.amount : 0;
    addChips(-stake, { silent: true });
    addOutlay(bettingRound, stake);
    audio.play('chip'); haptic('chip');
    void send(profile.id, { type: 'setMainBet', side, amount: currentMain + stake }).then((ok) => {
      if (!ok) {
        addChips(stake, { silent: true });
        addOutlay(bettingRound, -stake);
        toast(t('common.retry'), 'bad', '⚠');
        return;
      }
      // Only once the host has accepted the replacement do we refund the old
      // side's stake — the reducer's setMainBet overwrites seat.bet.main, so
      // that amount is no longer live.
      if (prevMain && prevMain.side !== side) {
        addChips(prevMain.amount, { silent: true });
        addOutlay(bettingRound, -prevMain.amount);
      }
    });
  };

  const placeSide = (side: BaccaratSide) => {
    if (!state || state.phase !== 'betting' || !mySeat) return;
    if (profile.chips < stake) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(stake - profile.chips) }), 'bad', '⚠');
      return;
    }
    const current = mySeat.bet.sides[side] ?? 0;
    addChips(-stake, { silent: true });
    addOutlay(bettingRound, stake);
    audio.play('chip'); haptic('chip');
    void send(profile.id, { type: 'setSideBet', side, amount: current + stake }).then((ok) => {
      if (!ok) {
        addChips(stake, { silent: true });
        addOutlay(bettingRound, -stake);
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const clearBet = () => {
    if (!mySeat) return;
    // Refund what THIS client optimistically deducted this round, not what the
    // synced seat shows — for a non-host player the bets round-trip through the
    // host, so totalStaked can still be 0 here while chips have already been
    // taken. Fall back to the synced amount when there's no tracked outlay.
    const outlayAmt = roundOutlay.current.round === bettingRound ? roundOutlay.current.amount : 0;
    const refundedSoFar = clearRefunded.current.round === bettingRound ? clearRefunded.current.amount : 0;
    const outstanding = outlayAmt - refundedSoFar;
    const refund = outstanding > 0 ? outstanding : totalStaked;
    if (refund <= 0 && totalStaked <= 0) return;
    if (refund > 0) {
      addChips(refund, { silent: true });
      // NOT addOutlay(-refund): keep the outlay intact so the settle reconcile
      // still knows the true amount deducted if this clear never reaches the
      // host. addClearRefunded offsets the double-count instead.
      addClearRefunded(bettingRound, refund);
    }
    void send(profile.id, { type: 'clearBet' });
    audio.play('click');
  };

  const repeatLast = () => {
    if (!mySeat || state?.phase !== 'betting') return;
    const need = betCost(mySeat.lastBet);
    if (need <= 0) return;
    if (profile.chips + totalStaked < need) {
      audio.play('error'); toast(t('games.tooPoor', { amount: fmt(need - profile.chips - totalStaked) }), 'bad', '⚠');
      return;
    }
    const refundNow = totalStaked;
    if (refundNow > 0) addChips(refundNow, { silent: true });
    addChips(-need, { silent: true });
    addOutlay(bettingRound, need - refundNow);
    audio.play('chip');
    void send(profile.id, { type: 'repeatLast' }).then((ok) => {
      if (!ok) {
        if (refundNow > 0) addChips(-refundNow, { silent: true });
        addChips(need, { silent: true });
        addOutlay(bettingRound, refundNow - need);
        toast(t('common.retry'), 'bad', '⚠');
      }
    });
  };

  const dealNow = () => {
    if (!state || state.phase !== 'betting') return;
    const anyBet = state.seats.some((s) => s.bet.main || Object.keys(s.bet.sides).length > 0);
    if (!anyBet) return;
    void send(profile.id, { type: 'deal', nonce: newSeed() });
  };

  const back = async () => {
    if (mySeat) {
      const cost = betCost(mySeat.bet);
      if (cost > 0) addChips(cost, { silent: true });
      await send(profile.id, { type: 'leave', userId: profile.id });
    }
    await leave(profile.id);
    navigate('/hub');
  };

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🎴</div>
          <h2>{t('baccarat.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <div className="flex gap-2 justify-center">
            {!isOnline() ? (
              <GameButton tone="gold" onClick={() => navigate('/game/baccarat')}>{t('roulette.solo')}</GameButton>
            ) : (
              <GameButton tone="gold" onClick={() => navigate('/login')}>{t('auth.signIn')}</GameButton>
            )}
            <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
          </div>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  const face = profile.equipped.cardFace;
  const back2 = profile.equipped.cardBack;
  const chipSkin = profile.equipped.chipSkin;

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #221730, #100c17 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="18%" size={720} color="rgba(180,120,240,.16)" />
      </div>

      <VictoryEffect kind={victory ? 'bigWin' : null} />

      <div className="mx-auto px-4 py-3 flex flex-col items-center gap-3" style={{ maxWidth: 640 }}>
        <div className="text-center">
          <span className="eyebrow">Punto Banco · {t('baccarat.player')} vs {t('baccarat.banker')}</span>
          <h1 className="mt-1">{t('baccarat.title')}</h1>
        </div>

        {/* room code + seated players */}
        <GlassPanel gold className="p-3 w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="eyebrow">{t('rooms.code')}</span>
            <b style={{ fontFamily: 'var(--font-display)', letterSpacing: '.2em', color: 'var(--gold-hi)' }}>{room.code}</b>
          </div>
          <div className="flex items-center gap-1.5">
            {state.seats.map((seat) => (
              <div key={seat.userId} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: seat.userId === profile.id ? 'rgba(227,178,60,.14)' : 'rgba(255,255,255,.04)' }}>
                <span className="text-[10.5px] font-bold">{seat.username}</span>
                {seat.bet.main && (
                  <span className="text-[9.5px] num" style={{ color: 'var(--gold-hi)' }}>{fmt(betCost(seat.bet))}</span>
                )}
              </div>
            ))}
          </div>
          <GameButton size="sm" tone="metal" onClick={async () => {
            try { await navigator.clipboard.writeText(room.code); toast(`${t('rooms.code')} · ${t('common.copied')}`, 'good', '📋'); }
            catch { toast(room.code, 'neutral'); }
          }}>
            {t('rooms.copyCode')}
          </GameButton>
        </GlassPanel>

        {/* road */}
        {state.history.length > 0 && (
          <div className="flex gap-1 overflow-x-auto w-full px-1" style={{ scrollbarWidth: 'none' }}>
            {state.history.map((o, i) => (
              <span key={i} className="shrink-0 rounded-full flex items-center justify-center num font-black"
                style={{ width: 20, height: 20, fontSize: 10, background: o === 'player' ? '#4a86d6' : o === 'banker' ? '#c14040' : '#5aa563', color: '#fff', opacity: i === 0 ? 1 : 0.55 }}>
                {outcomeLabel(o)}
              </span>
            ))}
          </div>
        )}

        {/* felt: two hands + totals */}
        <GlassPanel gold className="w-full p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {(['player', 'banker'] as const).map((side) => {
              const cards = state[side];
              const total = cards.length ? handTotal(cards) : null;
              const isWinner = state.outcome === side;
              return (
                <div key={side} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black tracking-widest"
                      style={{ color: side === 'player' ? '#8ab4ff' : '#ff8a8a' }}>
                      {side === 'player' ? t('baccarat.player').toUpperCase() : t('baccarat.banker').toUpperCase()}
                    </span>
                    {total !== null && (
                      <span className="num font-black rounded-full px-2 text-[13px]"
                        style={{ background: isWinner ? 'var(--brushed-gold)' : 'rgba(0,0,0,.5)',
                          color: isWinner ? '#1a1206' : 'var(--gold-hi)', border: '1px solid var(--gold-line)', minWidth: 26, textAlign: 'center' }}>
                        {total}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center min-h-[76px] items-end" style={{ marginInlineStart: 14 }}>
                    <AnimatePresence mode="popLayout">
                      {cards.map((card, i) => (
                        <motion.div key={`${side}-${state.round}-${i}`}
                          initial={{ y: -80, opacity: 0, rotate: -10 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ delay: i * 0.18, type: 'spring', stiffness: 240, damping: 20 }}
                          style={{ marginInlineStart: -14 }}>
                          <PlayingCard card={card} size="md" index={i} face={face} back={back2} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {cards.length === 0 && (
                      <div className="rounded-[6px] border-2 border-dashed w-[52px] h-[72px]"
                        style={{ borderColor: 'rgba(255,255,255,.12)' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.phase === 'settled' && state.outcome && mySeat && (
            <div className="text-center">
              <b className="text-[15px]"
                style={{ color: mySeat.net > 0 ? 'var(--gold-hi)' : mySeat.net < 0 ? 'var(--crimson-hi)' : 'var(--muted)' }}>
                {mySeat.net > 0 ? `+${fmt(mySeat.net)}` : mySeat.net < 0 ? fmt(mySeat.net) : t('blackjack.push')}
              </b>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {t(state.outcome === 'player' ? 'baccarat.playerWins' : state.outcome === 'banker' ? 'baccarat.bankerWins' : 'baccarat.tieWins')}
              </div>
            </div>
          )}
        </GlassPanel>

        {/* main bets */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {MAIN_BETS.map(({ side, labelKey, color }) => {
            const on = mySeat?.bet.main?.side === side ? mySeat.bet.main.amount : 0;
            const hit = state.phase === 'settled' && state.outcome === side;
            return (
              <button key={side} onClick={() => placeMain(side)} disabled={state.phase !== 'betting'}
                className="relative rounded-[var(--r-sm)] press"
                style={{
                  border: `2px solid ${hit ? 'var(--gold-hi)' : color}`,
                  background: on > 0 ? `${color}30` : `${color}12`,
                  padding: '14px 10px',
                  boxShadow: hit ? '0 0 24px rgba(227,178,60,.55)' : 'none',
                  opacity: state.phase === 'betting' ? 1 : 0.75, transition: 'all .25s',
                }}>
                <div className="text-[13px] font-black" style={{ color: '#fff' }}>{t(labelKey)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                  {side === 'tie' ? '8:1' : side === 'banker' ? '0.95:1' : '1:1'}
                </div>
                {on > 0 && (
                  <div className="absolute -top-2 -end-2 rounded-full px-2 py-0.5 num text-[11px] font-black"
                    style={{ background: 'var(--brushed-gold)', color: '#1a1206', border: '1px solid rgba(0,0,0,.4)' }}>
                    {fmt(on)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* side bets */}
        <GlassPanel className="w-full p-2.5">
          <div className="text-[10.5px] text-center mb-1.5 font-black tracking-widest"
            style={{ color: 'var(--gold-hi)', letterSpacing: '.15em' }}>
            ✨ {t('baccarat.sideBets').toUpperCase()}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SIDE_BETS.map(({ side, labelKey }) => {
              const on = mySeat?.bet.sides[side] ?? 0;
              const hit = (mySeat?.sideResults?.[side] ?? 0) > 0 && state.phase === 'settled';
              return (
                <button key={side} onClick={() => placeSide(side)} disabled={state.phase !== 'betting'}
                  className="relative rounded-[6px] press"
                  style={{
                    border: `1px solid ${hit ? 'var(--gold-hi)' : 'var(--gold-line)'}`,
                    background: on > 0 ? 'rgba(227,178,60,.15)' : 'rgba(255,255,255,.03)',
                    padding: '10px 4px',
                    boxShadow: hit ? '0 0 14px rgba(227,178,60,.55)' : 'none',
                    opacity: state.phase === 'betting' ? 1 : 0.75,
                  }}>
                  <div className="text-[10.5px] font-bold" style={{ color: 'var(--text)', lineHeight: 1.15 }}>{t(labelKey)}</div>
                  {on > 0 && (
                    <div className="absolute -top-1.5 -end-1.5 rounded-full px-1.5 num text-[10px] font-black"
                      style={{ background: 'var(--brushed-gold)', color: '#1a1206' }}>{fmt(on)}</div>
                  )}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        {/* chip rail + actions */}
        <GlassPanel className="w-full p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">{t('games.chooseStake')}</span>
            <span className="num text-[12px]" style={{ color: 'var(--gold)' }}>
              {t('baccarat.onTable')} · {fmt(totalStaked)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {BACCARAT_BETS.map((s) => (
              <button key={s} onClick={() => { audio.play('click'); setStake(s); }}
                style={{ opacity: stake === s ? 1 : 0.4, transform: stake === s ? 'translateY(-4px)' : 'none', transition: '.2s' }}>
                <Chip value={s} size={38} skin={chipSkin} interactive />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <GameButton size="sm" tone="ghost" disabled={totalStaked === 0 || state.phase !== 'betting'} onClick={clearBet}>
              {t('blackjack.clear')}
            </GameButton>
            <GameButton size="sm" tone="metal"
              disabled={state.phase !== 'betting' || !mySeat || betCost(mySeat.lastBet) === 0}
              onClick={repeatLast}>
              🔁 {t('blackjack.lastBet')}
            </GameButton>
            {isHost && state.phase === 'betting' && (
              <GameButton tone="gold" disabled={!state.seats.some((s) => betCost(s.bet) > 0)} onClick={dealNow}>
                {secondsLeft !== null ? `${t('baccarat.deal')} · ${secondsLeft}s` : t('baccarat.deal')}
              </GameButton>
            )}
            {state.phase === 'settled' && (
              <span className="text-[12px] px-3 py-2" style={{ color: 'var(--muted)' }}>
                {t('roulette.newRound')} · 3s
              </span>
            )}
          </div>
          {secondsLeft !== null && secondsLeft > 0 && state.phase === 'betting' && (
            <p className="text-center mt-2 text-[12px] num" style={{ color: secondsLeft <= 3 ? 'var(--crimson-hi)' : 'var(--gold-hi)' }}>
              {t('roulette.placeBetsWindow', { s: secondsLeft })}
            </p>
          )}
        </GlassPanel>

        <div className="flex gap-2">
          <GameButton tone="ghost" size="sm" onClick={() => setRulesOpen(true)}>📖 {t('baccarat.howToPlay')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => setPayOpen(true)}>{t('games.paytable')}</GameButton>
          <GameButton tone="ghost" size="sm" onClick={() => void back()}>{t('common.back')}</GameButton>
        </div>
      </div>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={t('baccarat.howToPlay')}>
        <div className="text-[13px] leading-relaxed flex flex-col gap-3" style={{ color: 'var(--text)' }}>
          <div><b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesGoal')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesGoalText')}</p></div>
          <div><b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesValues')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesValuesText')}</p></div>
          <div><b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesDeal')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesDealText')}</p></div>
          <div><b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesDraw')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesDrawText')}</p></div>
          <div><b style={{ color: 'var(--gold-hi)' }}>{t('baccarat.rulesSideBets')}</b>
            <p style={{ color: 'var(--muted)' }}>{t('baccarat.rulesSideBetsText')}</p></div>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t('games.paytable')}>
        <div className="flex flex-col gap-1.5">
          {PAYTABLE.map((row) => (
            <div key={row.key} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)]"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              <b className="flex-1 text-[13px]">{t(`baccarat.${row.key}`)}</b>
              <b className="num text-[12.5px]" style={{ color: 'var(--gold-hi)' }}>{row.payout}</b>
            </div>
          ))}
        </div>
      </Modal>
    </SceneShell>
  );
}
