import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { ChatPanel } from '@/components/social/ChatPanel';
import { roomsService } from '@/services/roomsService';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { LightPool } from '@/components/effects/LightPool';
import { Chip } from '@/components/game/Chip';
import { useRoom } from '@/stores/useRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { isOnline } from '@/services/supabase';
import { notificationService } from '@/services/notificationService';
import { presenceService } from '@/services/presenceService';
import { blackjackService } from '@/services/blackjackService';
import { redactBjState } from '@/games/blackjack/redact';
import { emptyScores, type DuelConfig, type DuelFormat } from '@/games/blackjack/duel';
import { DUEL_BEST_OF, DUEL_BUYINS, DUEL_TARGETS } from '@/data/economy';
import { fmt } from '@/lib/format';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { audio } from '@/audio/AudioManager';

/** The room: a code, the people in it, and the rules the host sets. */
export default function RoomScene() {
  const { roomCode } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const friends = useSocial((s) => s.friends);
  const toast = useUI((s) => s.toast);
  const setLoading = useUI((s) => s.setLoading);
  const { room, members, isHost, create, joinByCode, leave, state } = useRoom();

  const isDuel = params.get('game') === 'duel' || !!state?.duel;
  const [format, setFormat] = useState<DuelFormat>('race');
  const [target, setTarget] = useState<number>(10);
  const [buyIn, setBuyIn] = useState<number>(500);
  const [joinCode, setJoinCode] = useState('');

  /* create or join, depending on how you arrived */
  useEffect(() => {
    const boot = async () => {
      if (!isOnline()) return;
      if (room?.code === roomCode) return;
      setLoading('loading.room');
      if (roomCode === 'new') {
        const created = await create(profile.id, 'blackjack');
        if (created) navigate(`/room/${created.code}${isDuel ? '?game=duel' : ''}`, { replace: true });
      } else if (roomCode) {
        const joined = await joinByCode(roomCode, profile.id);
        if (!joined) toast(t('rooms.notFound'), 'bad', '⚠');
      }
      setLoading(null);
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  /* Waiting-room presence — so the Lobby only lists this invite while someone is actually here. */
  useEffect(() => {
    if (!room) return;
    const conn = presenceService.track(room.id, profile.id, {
      username: profile.username, presence: isDuel ? 'duel' : 'blackjack', game: isDuel ? 'duel' : 'blackjack', spectator: false,
    });
    return conn.unsubscribe;
  }, [room?.id, profile.id, profile.username, isDuel]);

  const link = useMemo(
    () => (room ? `${window.location.origin}/room/${room.code}${isDuel ? '?game=duel' : ''}` : ''),
    [room, isDuel],
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      audio.play('click');
      toast(`${label} · ${t('common.copied')}`, 'good', '📋');
    } catch {
      toast(text, 'neutral');
    }
  };

  const share = async () => {
    const text = t('rooms.inviteText', { code: room?.code ?? '' });
    if (navigator.share) {
      try { await navigator.share({ title: 'ROYAL 21', text, url: link }); return; } catch { /* cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank');
  };

  const startGame = async () => {
    if (!room) return;
    audio.play('door');
    if (isDuel) {
      const config: DuelConfig = { format, target, buyIn };
      const seatIds = members.map((member) => member.userId);
      // Prefer the host's full engine state; fall back to a fresh init. publish()
      // stashes the real shoe secret so the room scene can hydrate it on mount.
      const base = useRoom.getState().fullState ?? state ?? (await blackjackService.initIfEmpty(room.id));
      const potPlayers = seatIds.length || 1;
      const next = { ...base, duel: { config, scores: emptyScores(seatIds.length ? seatIds : [profile.id]), winner: null, pot: config.buyIn * potPlayers } };
      useRoom.setState({ fullState: next, state: redactBjState(next) });
      await blackjackService.publish(room.id, next);
    }
    navigate(`/blackjack/room/${room.code}`);
  };

  /* No credentials, or a device-local player with no uuid to host with. Say
     which, instead of leaving a lobby that can never fill. */
  if (!isOnline() || !roomsService.canHost(profile.id)) {
    const offline = !isOnline();
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">{offline ? '🔌' : '🔑'}</div>
          <h2>{t('rooms.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>
            {t(offline ? 'rooms.needsBackend' : 'rooms.needsAccount')}
          </p>
          <div className="flex gap-2 justify-center">
            {offline
              ? <GameButton tone="gold" onClick={() => navigate('/blackjack/solo')}>{t('blackjack.solo')}</GameButton>
              : <GameButton tone="gold" onClick={() => navigate('/login')}>{t('auth.signIn')}</GameButton>}
            <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
          </div>
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #16211c, #0b0f0d 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="20%" size={620} color="rgba(227,178,60,.14)" />
      </div>

      <div className="mx-auto px-4 py-4 flex flex-col gap-3" style={{ maxWidth: 760 }}>
        <div className="text-center">
          <span className="eyebrow">{isDuel ? t('duel.title') : t('blackjack.withFriends')}</span>
          <h1 className="mt-1">{t('rooms.title')}</h1>
        </div>

        {/* the code, big, because it is the whole invitation */}
        <GlassPanel gold className="p-5 text-center">
          <div className="eyebrow mb-1.5">{t('rooms.code')}</div>
          <motion.div
            initial={{ letterSpacing: '0.6em', opacity: 0 }}
            animate={{ letterSpacing: '0.28em', opacity: 1 }}
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(34px,9vw,54px)', color: 'var(--gold-hi)',
              textShadow: '0 0 30px var(--glow-gold)',
            }}
          >
            {room?.code ?? '·····'}
          </motion.div>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <GameButton size="sm" tone="metal" onClick={() => copy(room?.code ?? '', t('rooms.code'))}>{t('rooms.copyCode')}</GameButton>
            <GameButton size="sm" tone="metal" onClick={() => copy(link, t('rooms.copyLink'))}>{t('rooms.copyLink')}</GameButton>
            <GameButton size="sm" tone="jade" onClick={share}>{t('rooms.shareWhatsapp')}</GameButton>
          </div>
        </GlassPanel>

        {/* who is here */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="eyebrow">{t('rooms.members')}</span>
            <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{members.length}/4</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map((member) => (
              <motion.div
                key={member.userId}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-[var(--r-sm)]"
                style={{ background: 'rgba(255,255,255,.035)', minWidth: 96 }}
                initial={{ scale: 0.85, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              >
                <Avatar config={member.avatar} size={44} level={member.level} presence={member.presence} id={`m-${member.userId}`} />
                <b className="text-[12.5px]">{member.username}</b>
                <span className="text-[10px]" style={{ color: member.isHost ? 'var(--gold)' : 'var(--dim)' }}>
                  {member.isHost ? t('rooms.host') : member.userId === profile.id ? t('rooms.you') : ''}
                </span>
              </motion.div>
            ))}
            {members.length < 4 && (
              <div className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-[var(--r-sm)] border border-dashed"
                style={{ borderColor: 'var(--glass-line)', minWidth: 96, color: 'var(--dim)' }}>
                <div className="text-[22px] ambient-breathe">＋</div>
                <span className="text-[11px]">{t('rooms.waitingForPlayers')}</span>
              </div>
            )}
          </div>

          {friends.filter((friend) => friend.presence !== 'offline').length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {friends.filter((friend) => friend.presence !== 'offline').slice(0, 4).map((friend) => (
                <GameButton
                  key={friend.id}
                  size="sm"
                  tone="ghost"
                  onClick={async () => {
                    if (!room) return;
                    await notificationService.invite(profile.id, friend.id, room.code, isDuel ? 'duel' : 'blackjack');
                    toast(t('friends.requestSent', { name: friend.username }), 'good', '🎮');
                  }}
                >
                  ＋ {friend.username}
                </GameButton>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* duel rules, set by the host */}
        {isDuel && (
          <GlassPanel gold className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">{t('duel.settings')}</span>
              <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{t('duel.intro')}</span>
            </div>

            {isHost ? (
              <>
                <div className="flex gap-2 mb-3">
                  <GameButton block size="sm" tone={format === 'race' ? 'gold' : 'ghost'}
                    onClick={() => { setFormat('race'); setTarget(10); }}>
                    {t('duel.race', { n: target })}
                  </GameButton>
                  <GameButton block size="sm" tone={format === 'bestOf' ? 'gold' : 'ghost'}
                    onClick={() => { setFormat('bestOf'); setTarget(3); }}>
                    {t('duel.bestOf', { n: target })}
                  </GameButton>
                </div>

                <div className="mb-3">
                  <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--muted)' }}>
                    {format === 'race' ? t('duel.target') : `${t('duel.rounds')} · ${t('duel.bestOfNote')}`}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(format === 'race' ? DUEL_TARGETS : DUEL_BEST_OF).map((value) => (
                      <GameButton key={value} size="sm" tone={target === value ? 'gold' : 'ghost'} onClick={() => setTarget(value)}>
                        {value}
                      </GameButton>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11.5px] mb-2" style={{ color: 'var(--muted)' }}>{t('duel.stake')}</div>
                  <div className="flex gap-2.5 flex-wrap items-center">
                    {DUEL_BUYINS.map((value) => (
                      <button key={value} onClick={() => { audio.play('chip'); setBuyIn(value); }}
                        style={{ opacity: buyIn === value ? 1 : 0.45, transform: buyIn === value ? 'translateY(-4px)' : 'none', transition: '.2s' }}>
                        <Chip value={value} size={44} skin={profile.equipped.chipSkin} interactive />
                      </button>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[12px]" style={{ color: 'var(--gold)' }}>
                    {t('duel.potNote', { amount: fmt(buyIn) })} · {chipGlyphOf(profile.equipped.currencySkin)} {fmt(buyIn * Math.max(1, members.length))}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center py-4" style={{ color: 'var(--muted)' }}>{t('duel.waitingHost')}</p>
            )}
          </GlassPanel>
        )}

        <div className="flex gap-2.5">
          <GameButton tone="gold" size="lg" block disabled={!room || (isDuel && !isHost)} onClick={startGame}>
            {isDuel ? t('duel.start') : t('rooms.start')}
          </GameButton>
          <GameButton tone="ghost" size="lg" onClick={async () => { await leave(profile.id); navigate('/hub'); }}>
            {t('rooms.leave')}
          </GameButton>
        </div>

        {/* join a different room from here too */}
        <GlassPanel className="p-3.5 flex gap-2">
          <input
            className="flex-1 px-3 py-2.5 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none uppercase tracking-[.3em] text-center"
            placeholder={t('rooms.enterCode')}
            maxLength={5}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
          <GameButton tone="metal" disabled={joinCode.length < 4} onClick={() => navigate(`/room/${joinCode}`)}>
            {t('rooms.join')}
          </GameButton>
        </GlassPanel>
      </div>

      {room && <ChatPanel roomId={room.id} members={members} />}
    </SceneShell>
  );
}
