import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { ChatPanel } from '@/components/social/ChatPanel';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { PlayingCard } from '@/components/game/PlayingCard';
import { Chip } from '@/components/game/Chip';
import { LightPool } from '@/components/effects/LightPool';
import { usePokerRoom } from '@/stores/usePokerRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { notificationService } from '@/services/notificationService';
import { presenceService, type RoomPresenceMeta } from '@/services/presenceService';
import { useT } from '@/hooks/useT';
import { isOnline } from '@/services/supabase';
import { roomsService } from '@/services/roomsService';
import { audio } from '@/audio/AudioManager';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { fmt } from '@/lib/format';
import { jackpotService } from '@/services/jackpotService';
import { JackpotBanner } from '@/components/game/JackpotBanner';
import { JackpotWin } from '@/components/effects/JackpotWin';
import { PasswordPromptModal } from '@/components/game/PasswordPromptModal';
import { isVipEligible } from '@/data/vip';
import {
  POKER_STAKES, buyInFor, callCost, minRaiseTo, canSeatAct, ACTION_SECONDS,
} from '@/games/poker/engine';
import { usePokerReveal } from '@/games/poker/useReveal';
import { MAX_SEATS } from '@/games/poker/types';
import type { PokerAction, PokerSeat, PokerState, ShowdownEntry } from '@/games/poker/types';

/** Quick-raise sizing as a fraction of the current pot. */
const POT_FRACTIONS = [0.33, 0.5, 0.77, 1] as const;

/** Felt colours per private-table color option. */
const TABLE_FELT: Record<string, string> = {
  green: 'radial-gradient(ellipse at 50% 35%, #1d4a37, #0c2018 75%)',
  red:   'radial-gradient(ellipse at 50% 35%, #4a1d1d, #200c0c 75%)',
  blue:  'radial-gradient(ellipse at 50% 35%, #1d354a, #0c1820 75%)',
  gold:  'radial-gradient(ellipse at 50% 35%, #4a3810, #201808 75%)',
};

const SLOTS = [
  { left: '50%', top: '90%' },
  { left: '13%', top: '76%' },
  { left: '4%', top: '34%' },
  { left: '50%', top: '8%' },
  { left: '96%', top: '34%' },
  { left: '87%', top: '76%' },
];

/** Texas Hold'em, up to six real players, host-authoritative like the room's Blackjack table. */
export default function PokerScene() {
  const { roomCode } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const recordResult = usePlayer((s) => s.recordResult);
  const recordRivalry = usePlayer((s) => s.recordRivalry);
  const addXp = usePlayer((s) => s.addXp);
  const bumpStat = usePlayer((s) => s.bumpStat);

  const { room, members, state, isHost, create, joinByCode, send, leave } = usePokerRoom();
  const friends = useSocial((s) => s.friends);
  const [buyInOpen, setBuyInOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState<number | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [jackpotWinAmount, setJackpotWinAmount] = useState<number | null>(null);
  const processedHand = useRef(0);
  const contributedHand = useRef(0);
  /* StrictMode fires this effect twice on mount before either async call
     resolves, so `room` is still null both times — without this lock that
     races two `create()` calls into two real rooms and two realtime
     subscriptions on the same channel name. */
  const booting = useRef(false);

  const bbParam = Number(params.get('bb') ?? 50);
  const stake = POKER_STAKES.find((s) => s.bb === bbParam) ?? POKER_STAKES[1];

  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      if (booting.current) return;
      booting.current = true;
      useUI.getState().setLoading('loading.room');
      try {
        if (roomCode === 'new') {
          const created = await create(profile.id, stake.sb, stake.bb);
          if (created) navigate(`/poker/${created.code}`, { replace: true });
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

  /* Anyone with the table open tracks themselves in room presence, seated or
     not — the seated players see who's watching, and a spectator can follow
     a hand with zero write access: there's simply no seat, so no action bar. */
  const [spectators, setSpectators] = useState<string[]>([]);
  useEffect(() => {
    if (!room) return;
    const meta: RoomPresenceMeta = { username: profile.username, presence: 'blackjack', game: 'poker', spectator: !mySeat };
    const conn = presenceService.track(room.id, profile.id, meta);
    conn.onSync((s) => {
      const names = Object.values(s)
        .map((entries) => entries[0])
        .filter((m): m is RoomPresenceMeta => Boolean(m?.spectator))
        .map((m) => m.username);
      setSpectators(names);
    });
    return conn.unsubscribe;
  }, [room?.id, profile.id, profile.username, Boolean(mySeat)]);

  /* Decision clock. The host stamps a deadline the instant play passes to a new
     seat and, on the same interval, folds anyone whose clock (base time + any
     banked extensions) has fully run out — mirroring how the host already
     drives every other rule in this table. Non-host clients just read the
     stamped deadline to render the same countdown. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state || state.toAct === -1) return;
    const tick = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(tick);
  }, [state?.toAct]);
  useEffect(() => {
    if (!state || state.toAct === -1) return;
    const actor = state.seats[state.toAct];
    if (!actor) return;
    if (isHost) {
      // Host stamps the deadline and, once it's blown, fires the timeout that folds
      // the AFK seat and hands play to the next player.
      if (!state.deadline) {
        void send(profile.id, { type: 'setDeadline', deadline: Date.now() + ACTION_SECONDS * 1000 });
        return;
      }
      if (Date.now() > state.deadline) void send(profile.id, { type: 'timeout', userId: actor.userId });
      return;
    }
    // Failsafe: if the host is themselves the AFK player (or their own timer effect
    // is stuck), the table used to freeze forever. After a 5-second grace past the
    // deadline, any seated client can send the same timeout intent — the reducer
    // validates it the same way and the host loop will process it. Race-safe:
    // repeat sends after the fold are rejected because state.toAct has advanced.
    if (state.deadline && Date.now() > state.deadline + 5000) {
      void send(profile.id, { type: 'timeout', userId: actor.userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.toAct, state?.deadline, now]);
  const secondsLeft = state?.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;

  const { displayCommunity, displayShowdown, liveEquity, revealing } = usePokerReveal(state);

  const seatSlots = useMemo(() => {
    const mySeatNum = mySeat?.seat ?? null;
    return Array.from({ length: MAX_SEATS }, (_, seatNumber) => {
      const occupant = state?.seats.find((s) => s.seat === seatNumber) ?? null;
      const rel = mySeatNum != null ? (seatNumber - mySeatNum + MAX_SEATS) % MAX_SEATS : seatNumber;
      return { seatNumber, occupant, position: SLOTS[rel] };
    });
  }, [state, mySeat]);

  /* Each hand contributes once to the poker jackpot — only the host client
     fires the contribution, so N players at a table don't multiply the pot
     N times per hand. */
  useEffect(() => {
    if (!state || state.handNumber === 0 || state.street === 'waiting') return;
    if (state.handNumber === contributedHand.current) return;
    if (!isHost) return;
    contributedHand.current = state.handNumber;
    void jackpotService.addContribution('poker', state.bigBlind);
  }, [state?.handNumber, state?.street, state?.bigBlind, isHost]);

  /* Once per finished hand: settle stats + rivalry from the shared result. */
  useEffect(() => {
    if (!state || state.street !== 'waiting' || !state.lastResult || state.handNumber === 0) return;
    if (state.handNumber === processedHand.current) return;
    processedHand.current = state.handNumber;
    const mine = state.lastResult.find((r) => r.userId === profile.id);
    if (!mine) return;
    const outcome = mine.net > 0 ? 'win' : mine.net < 0 ? 'lose' : 'push';
    recordResult('poker', outcome, mine.net, {});
    const opponents = state.lastResult.filter((r) => r.userId !== profile.id);
    if (opponents.length) recordRivalry('poker', mine.net, opponents);
    if (mine.net > 0) {
      addXp(15);
      audio.play(mine.net >= state.bigBlind * 20 ? 'bigWin' : 'win');
      const s = usePlayer.getState().stats;
      const patch: Partial<typeof s> = { pokerChipsWon: s.pokerChipsWon + mine.net };
      if (mine.longshot) patch.allInLongshotWins = s.allInLongshotWins + 1;
      const myShowdown = state.showdown?.find((e) => e.userId === profile.id);
      if (myShowdown?.category === 'royalFlush') {
        patch.royalFlushes = s.royalFlushes + 1;
        // JACKPOT: royal flush wins the whole progressive pot
        void jackpotService.claim('poker').then((res) => {
          if (res.ok && res.amount) {
            addChips(res.amount);
            setJackpotWinAmount(res.amount);
          }
        });
      }
      bumpStat(patch);
      if (mine.longshot) toast(t('poker.longshotWin'), 'good', '🎲');
    }
    else if (mine.net < 0) audio.play('lose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.street, state?.handNumber]);

  /* Best-effort leave when the tab closes / navigates away. pagehide is more
     reliable than beforeunload across mobile browsers, and Supabase's insert
     is fire-and-forget so we don't rely on await surviving the unload. This
     shortens the freeze window before the host's ghost cleanup catches on. */
  useEffect(() => {
    if (!room || !mySeat) return;
    const bail = () => { void send(profile.id, { type: 'leave', userId: profile.id }); };
    window.addEventListener('pagehide', bail);
    return () => window.removeEventListener('pagehide', bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, Boolean(mySeat), profile.id]);

  /* When a player just closes their tab (or otherwise drops without clicking
     "cash out"), Supabase notices they've left the room and members updates —
     but the poker state still has their seat, and if it was their turn the
     table freezes forever. The host reconciles: any seat whose userId isn't in
     the current members list gets a synthetic 'leave' dispatched, which the
     reducer already handles (removes the seat, finishes uncontested if
     everyone else has folded, etc). Only the host runs this so two clients
     don't race the same cleanup. */
  useEffect(() => {
    if (!isHost || !state || members.length === 0) return;
    const present = new Set(members.map((m) => m.userId));
    const ghosts = state.seats.filter((s) => !present.has(s.userId));
    for (const ghost of ghosts) {
      void send(profile.id, { type: 'leave', userId: ghost.userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, members.map((m) => m.userId).sort().join('|'), state?.seats.map((s) => s.userId).sort().join('|')]);

  /* Auto-start the next hand the instant every seated player has hit "Ready" —
     no host click, no wait. Guarded by isHost so only one client actually
     dispatches, and by street==='waiting' so it can't fire in the middle of
     a hand from a stale ready flag. */
  useEffect(() => {
    if (!isHost || !state || state.street !== 'waiting') return;
    const seated = state.seats.filter((s) => !s.sittingOut);
    if (seated.length < 2 || !seated.every((s) => s.ready)) return;
    void send(profile.id, { type: 'startHand' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.street, state?.seats.map((s) => `${s.userId}:${s.ready}:${s.sittingOut}`).join('|')]);

  const link = useMemo(() => (room ? `${window.location.origin}/poker/${room.code}` : ''), [room]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); audio.play('click'); toast(t('common.copied'), 'good', '📋'); }
    catch { toast(text, 'neutral'); }
  };

  const sitDown = async (amount: number) => {
    if (amount > profile.chips) { toast(t('poker.notEnoughChips'), 'bad', '⚠'); return; }
    const wasSeated = Boolean(mySeat);
    addChips(-amount, { silent: true });
    if (wasSeated) {
      await send(profile.id, { type: 'topUp', userId: profile.id, amount });
    } else {
      await send(profile.id, { type: 'join', userId: profile.id, username: profile.username, avatar: profile.avatar, level: profile.level, buyIn: amount });
    }
    setBuyInOpen(false);
    audio.play('chip');
    /* Refund if the reducer refused the join — the seat cap is full, a config
       gate rejected us, or we lost a race. Without this the chips silently
       vanish. Rebuy (topUp) has no such rejection paths so we only guard the
       join case. */
    if (!wasSeated) {
      setTimeout(() => {
        const latest = usePokerRoom.getState().state;
        const seated = latest?.seats.some((s) => s.userId === profile.id);
        if (!seated) {
          addChips(amount, { silent: true });
          toast(t('rooms.notFound'), 'bad', '⚠');
        }
      }, 800);
    }
  };

  const cashOut = async () => {
    if (mySeat && mySeat.stack > 0) addChips(mySeat.stack, { silent: true });
    if (mySeat) await send(profile.id, { type: 'leave', userId: profile.id });
    await leave(profile.id);
    navigate('/hub');
  };

  /* Cleanup when the tab closes: dispatch leave so the seat doesn't hang
     forever with a ghost player at the table. beforeunload fires before
     the page truly unloads, so send() can complete. */
  useEffect(() => {
    const cleanup = () => {
      const st = usePokerRoom.getState();
      const s = st.state?.seats.find((seat) => seat.userId === profile.id);
      if (s) void send(profile.id, { type: 'leave', userId: profile.id });
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [profile.id, send]);

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">🔑</div>
          <h2>{t('poker.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(!isOnline() ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="gold" onClick={() => navigate(isOnline() ? '/login' : '/hub')}>{t(isOnline() ? 'auth.signIn' : 'common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  if (!room || !state) {
    return <SceneShell><div className="grid place-items-center min-h-[60dvh]"><p style={{ color: 'var(--muted)' }}>{t('loading.room')}</p></div></SceneShell>;
  }

  // VIP gate: a table marked isVip is only enterable by players who meet
  // the VIP bar. The host can always enter their own table — the check is
  // meaningful for anyone else clicking through a lobby card or shared link.
  if (room.config?.isVip && !isHost && !isVipEligible(profile)) {
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[56px] mb-3">👑</div>
          <h2>{t('vip.lockedTitle')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t('vip.tableLocked')}</p>
          <div className="flex gap-2 justify-center">
            <GameButton tone="gold" onClick={() => navigate('/vip')}>{t('vip.viewProgress')}</GameButton>
            <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
          </div>
        </div>
      </SceneShell>
    );
  }

  // Password gate: shown to non-hosts on a password-protected table until
  // they've verified. Host bypasses (they created it).
  const needsPassword = !!room.config?.passwordHash && !isHost && !passwordOk;
  if (needsPassword) {
    return (
      <SceneShell>
        <PasswordPromptModal
          open
          roomId={room.id}
          onSuccess={() => setPasswordOk(true)}
          onCancel={() => navigate('/hub')}
        />
      </SceneShell>
    );
  }

  const seatedPlayers = state.seats.filter((s) => !s.sittingOut);
  const seatedCount = seatedPlayers.length;
  const canStart = state.street === 'waiting' && seatedCount >= 2;
  const allReady = canStart && seatedPlayers.every((s) => s.ready);
  const recommendedBuyIn = buyInFor(state.bigBlind);

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 10%, #14231c, #0a120e 55%, #08090b 88%)' }} />
        <LightPool x="50%" y="18%" size={700} color="rgba(46,158,107,.14)" />
      </div>

      <div className="mx-auto px-3 py-3 flex flex-col gap-3" style={{ maxWidth: 880 }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="eyebrow">{t('poker.title')}</span>
            <h1 className="mt-0.5 text-[19px]">{room.code} · {state.smallBlind}/{state.bigBlind}</h1>
          </div>
          <div className="flex items-center gap-2">
            {spectators.length > 0 && (
              <span
                className="px-2.5 py-1 rounded-full text-[11.5px]"
                style={{ background: 'rgba(255,255,255,.06)', color: 'var(--muted)' }}
                title={spectators.join(', ')}
              >
                👁 {spectators.length}
              </span>
            )}
            {/* Rebuy is always reachable while you're seated — including mid-hand.
                Waiting until the next hand is what got players stuck after losing
                a big pot: the "everyone ready" panel only draws in street==='waiting'. */}
            {mySeat && mySeat.stack < recommendedBuyIn * 2 && (
              <GameButton size="sm" tone="gold" onClick={() => setBuyInOpen(true)}>
                + {t('poker.topUp')}
              </GameButton>
            )}
            <GameButton size="sm" tone="metal" onClick={() => copy(room.code)}>{t('rooms.copyCode')}</GameButton>
            <GameButton size="sm" tone="metal" onClick={() => copy(link)}>{t('rooms.copyLink')}</GameButton>
          </div>
        </div>

        <JackpotBanner game="poker" winCondition={t('jackpot.pokerCondition')} />

        {/* --------------------------- the felt --------------------------- */}
        <GlassPanel gold className="relative p-3" style={{ aspectRatio: '1.5', minHeight: 340 }}>
          <div
            className="absolute inset-4 rounded-[50%]"
            style={{ background: TABLE_FELT[room.config?.tableColor ?? 'green'], border: '2px solid rgba(227,178,60,.35)' }}
          />

          {/* pot + community */}
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

          {/* seats */}
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
                  label={{
                    fold: t('poker.folded'), sitOut: t('poker.sittingOut'), allin: t('poker.allInLabel'),
                  }}
                />
              ) : (
                <button
                  className="grid place-items-center rounded-full press"
                  style={{ width: 58, height: 58, border: '1px dashed rgba(255,255,255,.2)', color: 'var(--dim)', fontSize: 11, background: 'rgba(0,0,0,.25)' }}
                  disabled={Boolean(mySeat)}
                  onClick={() => setBuyInOpen(true)}
                >
                  {t('poker.sitDown')}
                </button>
              )}
            </div>
          ))}
        </GlassPanel>

        {friends.filter((f) => f.presence !== 'offline').length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {friends.filter((f) => f.presence !== 'offline').slice(0, 6).map((friend) => (
              <GameButton
                key={friend.id}
                size="sm"
                tone="ghost"
                onClick={async () => {
                  await notificationService.invite(profile.id, friend.id, room.code, 'poker');
                  toast(t('friends.requestSent', { name: friend.username }), 'good', '🎮');
                }}
              >
                ＋ {friend.username}
              </GameButton>
            ))}
          </div>
        )}

        {/* -------------------------- table log -------------------------- */}
        {state.log.length > 0 && (
          <div className="text-[11.5px] px-2 flex flex-col gap-0.5 max-h-[64px] overflow-y-auto" style={{ color: 'var(--dim)' }}>
            {state.log.slice(-4).map((line, i) => <span key={i}>{line}</span>)}
          </div>
        )}

        {/* ----------------------- hand result banner ---------------------- */}
        {state.street === 'waiting' && state.lastResult && !revealing && (
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

        {/* --------------------------- controls ---------------------------- */}
        {state.street === 'waiting' ? (
          <GlassPanel className="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
              {allReady ? t('poker.everyoneReady')
                : canStart ? t('poker.waitingReady', { count: seatedPlayers.filter((s) => s.ready).length, total: seatedCount })
                : t('poker.needPlayers')} · {seatedCount}/{MAX_SEATS}
            </span>
            <div className="flex gap-2 flex-wrap">
              {mySeat && !mySeat.sittingOut && (
                <GameButton
                  size="sm"
                  tone={mySeat.ready ? 'jade' : 'metal'}
                  onClick={() => void send(profile.id, { type: 'setReady', userId: profile.id, ready: !mySeat.ready })}
                >
                  {mySeat.ready ? `✓ ${t('poker.ready')}` : t('poker.pressReady')}
                </GameButton>
              )}
              {isHost && (
                <GameButton tone="gold" disabled={!canStart} onClick={() => void send(profile.id, { type: 'startHand' })}>
                  {t('poker.startHand')}
                </GameButton>
              )}
              <GameButton tone="ghost" onClick={cashOut}>{t('poker.cashOut')}</GameButton>
            </div>
          </GlassPanel>
        ) : mySeat ? (
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
            <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{t('poker.sitDown')}</span>
          </GlassPanel>
        )}
      </div>

      {/* -------------------------- buy-in modal -------------------------- */}
      <AnimatePresence>
        {buyInOpen && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center p-5" style={{ background: 'rgba(0,0,0,.6)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBuyInOpen(false)}>
            <GlassPanel gold className="p-5 w-full max-w-[360px]" onClick={(e) => e.stopPropagation()}>
              <div className="eyebrow mb-1">{t('poker.buyIn')}</div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>{state.smallBlind}/{state.bigBlind} · {chipGlyphOf(profile.equipped.currencySkin)} {fmt(profile.chips)}</p>
              <div className="flex flex-col gap-2">
                {[0.5, 1, 2].map((mult) => {
                  const amount = Math.round(recommendedBuyIn * mult);
                  return (
                    <GameButton key={mult} tone={mult === 1 ? 'gold' : 'metal'} disabled={amount > profile.chips} onClick={() => void sitDown(amount)}>
                      {fmt(amount)} · {mult * 100} BB
                    </GameButton>
                  );
                })}
              </div>
              <GameButton tone="ghost" block className="mt-3" onClick={() => setBuyInOpen(false)}>{t('common.close')}</GameButton>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {room && <ChatPanel roomId={room.id} members={members} />}

      {jackpotWinAmount !== null && (
        <JackpotWin amount={jackpotWinAmount} onDone={() => setJackpotWinAmount(null)} />
      )}
    </SceneShell>
  );
}

export function SeatCard({ seat, isMe, isTurn, isDealer, street, showdown, runoutReveal, cardFace, cardBack, label }: {
  seat: PokerSeat; isMe: boolean; isTurn: boolean; isDealer: boolean; street: string;
  showdown: ShowdownEntry[] | null;
  /** True whenever we're in an all-in runout — flip everyone still in the hand
   *  face-up so the players can see who's ahead as the board comes out. */
  runoutReveal?: boolean;
  cardFace: string; cardBack: string;
  label: { fold: string; sitOut: string; allin: string };
}) {
  const revealed = showdown?.some((s) => s.userId === seat.userId) && !seat.folded;
  const runoutShow = runoutReveal && !seat.folded && seat.hole.length === 2;
  const showHole = isMe || revealed || runoutShow;
  return (
    <div className="flex flex-col items-center gap-1" style={{ opacity: seat.folded ? 0.45 : seat.sittingOut ? 0.55 : 1 }}>
      <div className="flex gap-0.5">
        {seat.hole.map((card, i) => (
          <PlayingCard key={i} card={showHole ? card : undefined} faceDown={!showHole} size="sm" index={i} face={cardFace} back={cardBack} fresh={false} />
        ))}
      </div>
      <div className="relative">
        <Avatar config={seat.avatar} size={44} level={seat.level} id={`pk-${seat.userId}`} />
        {isDealer && (
          <span className="absolute -top-1 -start-1 grid place-items-center rounded-full text-[9px] font-black" style={{ width: 16, height: 16, background: 'var(--gold-hi)', color: '#1a1206' }}>D</span>
        )}
        {isTurn && <span className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 2px var(--gold-hi)', animation: 'pulse 1.2s infinite' }} />}
      </div>
      <b className="text-[10.5px] truncate max-w-[70px]">{seat.username}</b>
      <span className="text-[10px] num" style={{ color: 'var(--gold)' }}>{fmt(seat.stack)}</span>
      {seat.committed > 0 && street !== 'waiting' && (
        <div className="flex items-center gap-1"><Chip value={Math.max(10, seat.committed)} size={20} /><span className="text-[9px] num">{fmt(seat.committed)}</span></div>
      )}
      {seat.folded && <span className="text-[9px]" style={{ color: 'var(--dim)' }}>{label.fold}</span>}
      {!seat.folded && seat.sittingOut && <span className="text-[9px]" style={{ color: 'var(--dim)' }}>{label.sitOut}</span>}
      {!seat.folded && seat.allIn && <span className="text-[9px]" style={{ color: 'var(--crimson-hi)' }}>{label.allin}</span>}
    </div>
  );
}

export function ActionBar({ seat, state, myTurn, raiseTo, setRaiseTo, onAct, secondsLeft, onUseTimeBank, t }: {
  seat: PokerSeat; state: PokerState; myTurn: boolean;
  raiseTo: number | null; setRaiseTo: (v: number | null) => void;
  onAct: (action: PokerAction) => void;
  secondsLeft: number | null;
  onUseTimeBank: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const cost = callCost(state, seat);
  const minTo = minRaiseTo(state, seat);
  const maxTo = seat.committed + seat.stack;
  const current = raiseTo ?? minTo;

  if (!myTurn || !canSeatAct(seat)) {
    return (
      <GlassPanel className="p-3.5 text-center">
        <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {state.toAct >= 0
            ? t('poker.turnOf', { name: state.seats[state.toAct]?.username ?? '' }) + (secondsLeft != null ? ` · ${secondsLeft}s` : '')
            : t('poker.waitingRoom')}
        </span>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel gold className="p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{t('poker.yourTurn')}</span>
        {secondsLeft != null && (
          <div className="flex items-center gap-2">
            <span className="num text-[12px]" style={{ color: secondsLeft <= 8 ? 'var(--crimson-hi)' : 'var(--gold-hi)' }}>{secondsLeft}s</span>
            {seat.timeBanksLeft > 0 && (
              <button
                type="button"
                className="press text-[10.5px] px-2 py-1 rounded-full"
                style={{ border: '1px solid var(--gold-line)', color: 'var(--gold-hi)', background: 'rgba(0,0,0,.3)' }}
                onClick={onUseTimeBank}
              >
                ⏳ +60s ({seat.timeBanksLeft})
              </button>
            )}
          </div>
        )}
      </div>
      {secondsLeft != null && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, (secondsLeft / ACTION_SECONDS) * 100))}%`,
              background: secondsLeft <= 8 ? 'var(--crimson-hi)' : 'var(--gold-hi)',
              transition: 'width .3s linear',
            }}
          />
        </div>
      )}
      <div className="flex gap-2 flex-wrap justify-center">
        <GameButton tone="danger" onClick={() => onAct({ type: 'fold', userId: seat.userId })}>{t('poker.fold')}</GameButton>
        {cost === 0 ? (
          <GameButton tone="metal" onClick={() => onAct({ type: 'check', userId: seat.userId })}>{t('poker.check')}</GameButton>
        ) : (
          <GameButton tone="metal" onClick={() => onAct({ type: 'call', userId: seat.userId })}>{t('poker.call', { amount: fmt(cost) })}</GameButton>
        )}
        <GameButton tone="jade" onClick={() => onAct({ type: 'allin', userId: seat.userId })}>{t('poker.allin')}</GameButton>
      </div>
      {maxTo > minTo && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5 flex-wrap justify-center">
            {POT_FRACTIONS.map((frac) => {
              const target = Math.max(minTo, Math.min(Math.round(state.currentBet + state.pot * frac), maxTo));
              return (
                <button
                  key={frac}
                  type="button"
                  className="press text-[10.5px] px-2 py-1 rounded-full"
                  style={{
                    border: '1px solid var(--gold-line)', color: 'var(--gold-hi)',
                    background: current === target ? 'rgba(227,178,60,.22)' : 'rgba(0,0,0,.3)',
                  }}
                  onClick={() => setRaiseTo(target)}
                >
                  {frac === 1 ? t('poker.potFull') : `${Math.round(frac * 100)}%`}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range" min={minTo} max={maxTo} value={Math.min(current, maxTo)}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number" min={minTo} max={maxTo} value={current}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) setRaiseTo(Math.max(minTo, Math.min(v, maxTo)));
              }}
              className="num text-[12.5px] text-center"
              style={{ width: 78, background: 'rgba(0,0,0,.3)', border: '1px solid var(--gold-line)', borderRadius: 6, color: 'var(--gold-hi)', padding: '3px 4px' }}
            />
          </div>
          <div className="text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {t('poker.raisingBy', { amount: fmt(Math.max(0, current - state.currentBet)) })} · {t('poker.raiseTo', { amount: fmt(current) })}
          </div>
          <GameButton
            size="sm" tone="gold" block
            onClick={() => { onAct({ type: state.currentBet === 0 ? 'bet' : 'raise', userId: seat.userId, amount: current }); setRaiseTo(null); }}
          >
            {state.currentBet === 0 ? t('poker.bet') : t('poker.raise')}
          </GameButton>
        </div>
      )}
    </GlassPanel>
  );
}
