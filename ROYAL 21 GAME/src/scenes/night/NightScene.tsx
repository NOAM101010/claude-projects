import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { ChatPanel } from '@/components/social/ChatPanel';
import { LightPool } from '@/components/effects/LightPool';
import { usePlayer } from '@/stores/usePlayer';
import { useRoom } from '@/stores/useRoom';
import { useHighcardRoom } from '@/stores/useHighcardRoom';
import { useRouletteRoom } from '@/stores/useRouletteRoom';
import { useSocial } from '@/stores/useSocial';
import { notificationService } from '@/services/notificationService';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useGhostSeatCleanup } from '@/hooks/useGhostSeatCleanup';
import { isOnline } from '@/services/supabase';
import { isFriendOnline } from '@/lib/presence';
import { roomsService } from '@/services/roomsService';
import { scoreboard, nightStarted, POINTS } from '@/games/night/night';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';

interface NightGame {
  key: string;
  icon: string;
  labelKey: string;
  /** Where the group goes. Table games keep the room; quick games are solo detours. */
  to: (code: string) => string;
  scored: boolean;
  /** Coin flip / high card: up to 5 players share one table, not a solo detour. */
  multiplayer?: boolean;
}

const GAMES: NightGame[] = [
  { key: 'blackjack', icon: '♠', labelKey: 'nav.blackjack', to: (code) => `/blackjack/room/${code}?night=${code}`, scored: true },
  { key: 'highcard', icon: '🂡', labelKey: 'nav.highcard', to: () => '', scored: true, multiplayer: true },
  { key: 'roulette', icon: '🎡', labelKey: 'nav.roulette', to: () => '', scored: true, multiplayer: true },
];

/* Multiplayer sub-games each live in their own `rooms` row (a different game
   shape); the night room's own code only carries table games like Blackjack. */
const MP_GAME_URL: Record<string, (code: string, night: string) => string> = {
  highcard: (code, night) => `/game/highcard/room/${code}?night=${night}`,
  roulette: (code, night) => `/game/roulette/room/${code}?night=${night}`,
};

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Game night: one room, several games, one scoreboard.
 *
 * The board is derived from the table's settled history, so it updates for
 * everyone through the same realtime state the cards already use.
 */
export default function NightScene() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const bumpStat = usePlayer((s) => s.bumpStat);
  const toast = useUI((s) => s.toast);
  const setLoading = useUI((s) => s.setLoading);
  const { room, members, state, isHost, create, joinByCode, send } = useRoom();
  const createHighcard = useHighcardRoom((s) => s.create);
  const createRoulette = useRouletteRoom((s) => s.create);
  const [podium, setPodium] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);
  const [openingGame, setOpeningGame] = useState<string | null>(null);
  const friends = useSocial((s) => s.friends);

  /* Only the room host picks the next game, and the pick pulls EVERY player in
     the room into it. The host publishes `activeMiniGame` (game + which room);
     every client — host included — watches that field and auto-navigates in.
     High card needs its own `rooms` row (a different game shape);
     everything else rides the night room's own code. */
  const gameUrl = (amg: { game: string; code: string }): string | null => {
    const mp = MP_GAME_URL[amg.game];
    if (mp) return mp(amg.code, roomCode);
    const def = GAMES.find((g) => g.key === amg.game);
    return def ? def.to(roomCode) : null;
  };

  const pickGame = async (game: NightGame) => {
    if (!isHost || openingGame) return;
    audio.play('click');
    setOpeningGame(game.key);
    try {
      let code = roomCode;
      if (game.multiplayer) {
        const existing = state?.activeMiniGame;
        if (existing?.game === game.key && existing.code) {
          code = existing.code;
        } else {
          const created = game.key === 'roulette'
            ? await createRoulette(profile.id)
            : await createHighcard(profile.id);
          if (!created) { toast(t('errors.generic'), 'bad', '⚠'); return; }
          code = created.code;
        }
      }
      await send(profile.id, { type: 'setActiveMiniGame', userId: profile.id, game: game.key, code });
    } finally {
      setOpeningGame(null);
    }
  };

  /* Auto-navigate every client into the game the host picked. `sessionStorage`
     (per-tab) remembers the pointer we already acted on, so a player who
     returns to the lobby while the pointer is still live isn't bounced back in. */
  const handledMiniGame = useRef<string | null>(null);
  const nightActiveKey = `night-active:${roomCode}`;
  useEffect(() => {
    const amg = state?.activeMiniGame;
    if (!amg?.game) return;
    const key = `${amg.game}:${amg.code}`;
    if (handledMiniGame.current === key || sessionStorage.getItem(nightActiveKey) === key) return;
    handledMiniGame.current = key;
    sessionStorage.setItem(nightActiveKey, key);
    const url = gameUrl(amg);
    if (url) { audio.play('door'); navigate(url); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.activeMiniGame?.game, state?.activeMiniGame?.code]);

  /* Host clears a stale pointer: the picker has been through this game and is
     back in the lobby (sessionStorage marker matches), or the player who picked
     has dropped out of the room. */
  useEffect(() => {
    if (!isHost) return;
    const amg = state?.activeMiniGame;
    if (!amg?.game) return;
    const key = `${amg.game}:${amg.code}`;
    const creatorGone = amg.by ? !members.some((m) => m.userId === amg.by) : false;
    if (!creatorGone && sessionStorage.getItem(nightActiveKey) !== key) return;
    const timer = setTimeout(() => {
      void send(profile.id, { type: 'setActiveMiniGame', userId: profile.id, game: '', code: '' });
      sessionStorage.removeItem(nightActiveKey);
    }, creatorGone ? 0 : 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.activeMiniGame?.game, state?.activeMiniGame?.code, members.map((m) => m.userId).join('|')]);

  /* create or join, depending on how you arrived */
  /* StrictMode fires this effect twice on mount before either async call
     resolves, so `room` is still null both times — without this lock that
     races two `create()` calls into two real rooms and two realtime
     subscriptions on the same channel name. */
  const booting = useRef(false);
  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      if (booting.current) return;
      booting.current = true;
      setLoading('loading.room');
      try {
        if (roomCode === 'new') {
          const created = await create(profile.id, 'blackjack');
          if (created) navigate(`/night/${created.code}`, { replace: true });
        } else if (roomCode) {
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

  /* Host reconciles the shared blackjack table's seats against room membership
     so a player who drops from the night doesn't strand a seat at the sub-table. */
  useGhostSeatCleanup(isHost, state?.seats, members,
    (userId) => void send(profile.id, { type: 'leave', userId }));

  const rows = useMemo(() => scoreboard(state, members), [state, members]);

  /* Winning the night is a trophy, but only once per night and only against
     someone — a scoreboard of one is not a win. */
  const claimedNight = useRef(false);
  useEffect(() => {
    if (!podium || claimedNight.current) return;
    if (rows.length < 2 || rows[0]?.userId !== profile.id || rows[0].points <= 0) return;
    claimedNight.current = true;
    bumpStat({ nightWins: stats.nightWins + 1 });
    usePlayer.getState().grantEvent('ev_night_champion');
    audio.play('bigWin');
  }, [podium, rows, profile.id, bumpStat, stats.nightWins]);

  /* Friends who are not already at the table. */
  const invitable = useMemo(
    () => friends.filter((friend) =>
      isFriendOnline(friend) && !friend.currentGame
      && !members.some((member) => member.userId === friend.id)),
    [friends, members],
  );

  const invite = async (friendId: string) => {
    if (!room) return;
    setInvited((current) => [...current, friendId]);
    audio.play('notify');
    try {
      await notificationService.invite(profile.id, friendId, room.code, 'night');
      toast(t('night.inviteSent'), 'good', '📨');
    } catch {
      setInvited((current) => current.filter((id) => id !== friendId));
      toast(t('errors.generic'), 'bad', '⚠');
    }
  };
  const started = nightStarted(state);
  const link = room ? `${window.location.origin}/night/${room.code}` : '';

  const share = async () => {
    const text = t('night.inviteText', { code: room?.code ?? '' });
    if (navigator.share) {
      try { await navigator.share({ title: 'ROYAL 21', text, url: link }); return; } catch { /* cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      audio.play('click');
      toast(t('common.copied'), 'good', '📋');
    } catch {
      toast(link, 'neutral');
    }
  };

  /* Either the project has no credentials, or this player is device-local and
     has no uuid to host with. Both end the same way: say so, rather than
     leaving an empty lobby that never fills. */
  const blocked = !isOnline() ? 'rooms.needsSupabase' : !roomsService.canHost(profile.id) ? 'rooms.needsAccount' : null;

  if (blocked) {
    return (
      <SceneShell>
        <div className="mx-auto px-4 py-10 text-center" style={{ maxWidth: 520 }}>
          <div className="text-[46px] mb-3">🎉</div>
          <h1>{t('hub.gameNight')}</h1>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(blocked)}</p>
          <div className="flex gap-2 justify-center">
            <GameButton tone="gold" onClick={() => navigate('/login')}>{t('auth.signIn')}</GameButton>
            <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
          </div>
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 4%, #1d1830, #100c14 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="24%" size={700} color="rgba(123,91,214,.16)" />
      </div>

      <div className="mx-auto px-4 py-2" style={{ maxWidth: 900 }}>
        <div className="text-center mb-4">
          <span className="eyebrow">{t('night.eyebrow')} {room?.code ? `· ${room.code}` : ''}</span>
          <h1 className="mt-1">{podium ? t('night.tonight') : t('hub.gameNight')}</h1>
          {!podium && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
              {t('night.rules', { win: POINTS.win, bj: POINTS.blackjack, push: POINTS.push })}
            </p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {podium ? (
            <motion.div key="podium" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassPanel gold className="p-6 text-center">
                <motion.div className="text-[56px]" animate={{ y: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
                  👑
                </motion.div>
                <h2 className="mt-2">{rows[0]?.username ?? t('night.nobody')}</h2>
                <div className="num text-[26px] mt-1" style={{ color: 'var(--gold-hi)', fontFamily: 'var(--font-display)' }}>
                  {rows[0]?.points ?? 0} {t('night.pts')}
                </div>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
                  {t('night.kingOf')} · {rows[0] && rows[0].net >= 0 ? '+' : ''}{fmt(rows[0]?.net ?? 0)}
                </p>
                <div className="flex flex-col gap-2 mt-6">
                  {/* Straight back to the table — the lobby is a detour nobody
                      wants between two rounds. */}
                  <GameButton tone="gold" block onClick={() => { setPodium(false); navigate(`/blackjack/room/${roomCode}`); }}>
                    {t('night.oneMoreRound')}
                  </GameButton>
                  <div className="flex gap-2">
                    <GameButton tone="ghost" block onClick={() => setPodium(false)}>{t('night.keepPlaying')}</GameButton>
                    <GameButton tone="ghost" block onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          ) : (
            <motion.div key="board" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>

              {/* ------------------------- scoreboard ------------------------- */}
              <GlassPanel className="p-4">
                <div className="eyebrow mb-3">{t('night.scoreboard')}</div>
                <div className="flex flex-col gap-2">
                  {rows.map((row, index) => (
                    <motion.div
                      key={row.userId}
                      layout
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--r-xs)]"
                      style={{
                        background: index === 0 && row.points > 0 ? 'linear-gradient(90deg, rgba(227,178,60,.14), transparent)' : 'var(--glass)',
                        border: `1px solid ${index === 0 && row.points > 0 ? 'var(--gold-line)' : 'var(--glass-line)'}`,
                      }}
                    >
                      <span className="text-[15px] w-5 text-center">
                        {row.points > 0 && index < 3 ? MEDALS[index] : index + 1}
                      </span>
                      <Avatar
                        config={members.find((m) => m.userId === row.userId)?.avatar ?? profile.avatar}
                        size={28}
                        id={`night-${row.userId}`}
                      />
                      <div className="flex-1 min-w-0">
                        <b className="block text-[13px] truncate" style={{ fontFamily: 'var(--font-display)', opacity: row.left ? 0.55 : 1 }}>
                          {row.userId === profile.id ? t('night.you') : row.username}
                          {row.left && <span className="text-[10px] font-normal" style={{ color: 'var(--dim)' }}> · {t('night.leftTag')}</span>}
                        </b>
                        <span className="block text-[10.5px]" style={{ color: 'var(--dim)' }}>
                          {t('night.line', { hands: row.hands, wins: row.wins })}
                          {row.blackjacks > 0 ? ` · ${row.blackjacks}× BJ` : ''}
                        </span>
                      </div>
                      <div className="text-end">
                        <b className="num block text-[15px]" style={{ color: 'var(--gold-hi)' }}>{row.points}</b>
                        <span className="num block text-[10.5px]" style={{ color: row.net >= 0 ? 'var(--jade-hi)' : 'var(--crimson-hi)' }}>
                          {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {rows.length === 0 && (
                    <div className="text-center py-6">
                      <div className="text-[26px] mb-1">◌</div>
                      <p className="text-[12.5px]" style={{ color: 'var(--dim)' }}>{t('night.waiting')}</p>
                    </div>
                  )}
                </div>
              </GlassPanel>

              {/* --------------------------- controls -------------------------- */}
              <div className="flex flex-col gap-3">
                <GlassPanel className="p-4">
                  <div className="eyebrow mb-3">{t('night.pickGame')}</div>
                  {isHost ? (
                    <>
                      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
                        {GAMES.map((game) => (
                          <button
                            key={game.key}
                            className="flex flex-col items-center gap-1 px-2 py-3 rounded-[var(--r-xs)] press"
                            style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
                            disabled={openingGame === game.key}
                            onClick={() => void pickGame(game)}
                          >
                            <span className="text-[22px]">{game.icon}</span>
                            <b className="text-[12px]">{t(game.labelKey)}</b>
                            <span className="text-[9.5px]" style={{ color: game.scored ? 'var(--gold)' : 'var(--dim)' }}>
                              {game.multiplayer ? t('night.upToFive') : game.scored ? t('night.scored') : t('night.justFun')}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>
                        {t('night.scoredNote')}
                      </p>
                    </>
                  ) : (
                    <p className="text-[12.5px] py-4 text-center" style={{ color: 'var(--muted)' }}>
                      {t('night.hostPicks')}
                    </p>
                  )}
                </GlassPanel>

                <GlassPanel gold className="p-4">
                  <div className="eyebrow mb-2">{t('rooms.invite')}</div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="num text-[22px]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '.16em', color: 'var(--gold-hi)' }}>
                      {room?.code ?? '·····'}
                    </span>
                    <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                      {t('chat.members', { count: members.length })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <GameButton tone="gold" block size="sm" onClick={share} disabled={!room}>{t('rooms.share')}</GameButton>
                    <GameButton tone="ghost" block size="sm" onClick={copy} disabled={!room}>{t('common.copy')}</GameButton>
                  </div>

                  {/* Invite friends directly — a link is fine for WhatsApp, but
                      the people already in your list should be one tap. */}
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-line)' }}>
                    <div className="eyebrow mb-2" style={{ fontSize: 9.5 }}>{t('night.inviteFriends')}</div>
                    {invitable.length === 0 ? (
                      <p className="text-[11.5px]" style={{ color: 'var(--dim)' }}>
                        {friends.length ? t('night.allHere') : t('night.noFriends')}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5" style={{ maxHeight: 168, overflowY: 'auto' }}>
                        {invitable.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--r-xs)]"
                            style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
                          >
                            <Avatar config={friend.avatar} size={24} id={`inv-${friend.id}`} presence={friend.presence} />
                            <b className="flex-1 min-w-0 truncate text-[12px]">{friend.username}</b>
                            <GameButton
                              size="sm"
                              tone={invited.includes(friend.id) ? 'ghost' : 'gold'}
                              disabled={invited.includes(friend.id) || !room}
                              onClick={() => void invite(friend.id)}
                            >
                              {invited.includes(friend.id) ? t('night.invited') : t('night.invite')}
                            </GameButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {isHost && (
                    <GameButton
                      tone="metal"
                      block
                      size="sm"
                      className="mt-2"
                      disabled={!started}
                      onClick={() => { audio.play('bigWin'); setPodium(true); }}
                    >
                      {t('night.finish')}
                    </GameButton>
                  )}
                </GlassPanel>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
