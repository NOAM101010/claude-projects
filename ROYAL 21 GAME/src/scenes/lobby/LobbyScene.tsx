import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { LightPool } from '@/components/effects/LightPool';
import { lobbyService, roomRouteFor, type LobbyTable } from '@/services/lobbyService';
import { roomsService } from '@/services/roomsService';
import { isOnline } from '@/services/supabase';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { isVipEligible } from '@/data/vip';
import type { GameKey } from '@/types';

const GAME_ICON: Record<GameKey, string> = {
  roulette: '🎡', blackjack: '🃏', duel: '⚔️', poker: '♠️', sng: '🏆',
  coinflip: '🪙', highcard: '🎴', scratch: '🎫', slots: '🎰', baccarat: '🎴',
};

const GAME_LABEL_KEY: Partial<Record<GameKey, string>> = {
  roulette: 'roulette.title', blackjack: 'games.blackjack', duel: 'duel.title',
  poker: 'games.poker', sng: 'games.sng',
};

const STARTABLE: { game: GameKey; route: string; labelKey: string }[] = [
  { game: 'roulette', route: '/game/roulette/room/new', labelKey: 'roulette.title' },
  { game: 'blackjack', route: '/room/new', labelKey: 'games.blackjack' },
  { game: 'poker', route: '/poker/new?sb=25&bb=50', labelKey: 'games.poker' },
];

export default function LobbyScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const toast = useUI((s) => s.toast);

  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameKey | 'all'>('all');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    const list = await lobbyService.list();
    setTables(list);
    setLoading(false);
  }, []);

  /* Candidate rooms — a room row that exists, but not proof anyone is actually there. */
  useEffect(() => {
    void refresh();
    const unsubscribe = lobbyService.subscribeNewRooms(() => { void refresh(); });
    return unsubscribe;
  }, [refresh]);

  /* The real signal: live presence per candidate room. Re-subscribed whenever the
     candidate set changes (new rooms appearing), not on every render. */
  const tableIds = useMemo(() => tables.map((table) => table.id), [tables]);
  const tableIdsKey = tableIds.slice().sort().join(',');
  useEffect(() => {
    if (!tableIds.length) { setPresence({}); return; }
    const unsubscribe = lobbyService.subscribePresence(tableIds, setPresence);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIdsKey]);

  /* Only tables with someone genuinely connected right now, and not already full. */
  const visible = useMemo(() => {
    const live = tables
      .map((table) => ({ ...table, memberCount: presence[table.id] ?? 0 }))
      .filter((table) => table.memberCount > 0 && table.memberCount < table.maxSeats);
    return filter === 'all' ? live : live.filter((table) => table.game === filter);
  }, [tables, presence, filter]);

  const join = (table: LobbyTable) => {
    // VIP-only tables are visible to everyone but only enterable by VIPs.
    // We short-circuit here with a clear message so nobody wastes a click.
    if (table.config?.isVip && !isVipEligible(profile)) {
      audio.play('error');
      toast(t('vip.tableLocked'), 'bad', '👑');
      return;
    }
    audio.play('door');
    navigate(roomRouteFor(table.game, table.code));
  };

  const joinByCode = async () => {
    if (joinCode.length < 4) return;
    setJoining(true);
    const room = await roomsService.byCode(joinCode);
    setJoining(false);
    if (!room) {
      toast(t('rooms.notFound'), 'bad', '⚠');
      return;
    }
    audio.play('door');
    navigate(roomRouteFor(room.game, room.code));
  };

  if (!isOnline() || !roomsService.canHost(profile.id)) {
    const offline = !isOnline();
    return (
      <SceneShell>
        <div className="mx-auto px-5 py-16 max-w-[520px] text-center">
          <div className="text-[48px] mb-3 ambient-float">{offline ? '🔌' : '🔑'}</div>
          <h2>{t('lobby.title')}</h2>
          <p className="mt-3 mb-6" style={{ color: 'var(--muted)' }}>{t(offline ? 'rooms.needsBackend' : 'rooms.needsAccount')}</p>
          <GameButton tone="ghost" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #16211c, #0b0f0d 55%, #08090b 85%)' }} />
        <LightPool x="50%" y="16%" size={620} color="rgba(227,178,60,.14)" />
      </div>

      <div className="mx-auto px-4 py-4 flex flex-col gap-3" style={{ maxWidth: 720 }}>
        <div className="text-center">
          <span className="eyebrow">{t('lobby.subtitle')}</span>
          <h1 className="mt-1">{t('lobby.title')}</h1>
        </div>

        {/* start a table */}
        <GlassPanel className="p-3.5">
          <div className="eyebrow mb-2">{t('lobby.createTable')}</div>
          <div className="flex flex-wrap gap-2">
            {STARTABLE.map((s) => (
              <GameButton key={s.game} tone="gold" size="sm" icon={<span>{GAME_ICON[s.game]}</span>} onClick={() => navigate(s.route)}>
                {t(s.labelKey)}
              </GameButton>
            ))}
          </div>
        </GlassPanel>

        {/* join with a code */}
        <GlassPanel className="p-3.5 flex gap-2">
          <input
            className="flex-1 px-3 py-2.5 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none uppercase tracking-[.3em] text-center"
            placeholder={t('rooms.enterCode')}
            maxLength={5}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
          <GameButton tone="metal" disabled={joinCode.length < 4 || joining} onClick={joinByCode}>
            {t('lobby.joinWithCode')}
          </GameButton>
        </GlassPanel>

        {/* filters */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <GameButton size="sm" tone={filter === 'all' ? 'gold' : 'ghost'} onClick={() => setFilter('all')}>
            {t('lobby.filterAll')}
          </GameButton>
          {(['roulette', 'blackjack', 'duel', 'poker', 'sng'] as GameKey[]).map((game) => (
            <GameButton key={game} size="sm" tone={filter === game ? 'gold' : 'ghost'} onClick={() => setFilter(game)}>
              {GAME_ICON[game]} {t(GAME_LABEL_KEY[game] ?? 'lobby.filterAll')}
            </GameButton>
          ))}
          <GameButton size="sm" tone="ghost" onClick={() => { setLoading(true); void refresh(); }}>
            ↻ {t('lobby.refresh')}
          </GameButton>
        </div>

        {/* table list */}
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visible.map((table) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                layout
              >
                <GlassPanel
                  className="p-3.5 flex items-center gap-3"
                  gold={table.config?.isVip}
                >
                  <span className="text-[26px]">{GAME_ICON[table.game]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <b className="text-[14px]">{t(GAME_LABEL_KEY[table.game] ?? 'lobby.filterAll')}</b>
                      {table.config?.isVip && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-wider"
                          style={{
                            background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))',
                            color: '#1a1206',
                          }}
                        >
                          👑 VIP
                        </span>
                      )}
                      {table.config?.passwordHash && (
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>🔒</span>
                      )}
                    </div>
                    <div className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>
                      {t('lobby.host', { name: table.hostName })} · {t('lobby.players', { n: table.memberCount, max: table.maxSeats })}
                    </div>
                  </div>
                  <b className="num text-[13px]" style={{ color: 'var(--gold)', letterSpacing: '.15em' }}>{table.code}</b>
                  {table.config?.isVip && !isVipEligible(profile) ? (
                    <GameButton size="sm" tone="ghost" disabled>
                      🔒 {t('vip.locked')}
                    </GameButton>
                  ) : (
                    <GameButton size="sm" tone="jade" onClick={() => join(table)}>{t('lobby.join')}</GameButton>
                  )}
                </GlassPanel>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && !visible.length && (
            <>
              {[0, 1, 2].map((i) => (
                <GlassPanel key={i} className="p-3.5 flex items-center gap-3 ambient-breathe" style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className="rounded-full" style={{ width: 26, height: 26, background: 'rgba(255,255,255,.08)' }} />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="rounded-full" style={{ width: '40%', height: 12, background: 'rgba(255,255,255,.08)' }} />
                    <div className="rounded-full" style={{ width: '65%', height: 10, background: 'rgba(255,255,255,.05)' }} />
                  </div>
                </GlassPanel>
              ))}
            </>
          )}

          {!loading && !visible.length && (
            <GlassPanel className="p-8 text-center">
              <div className="text-[36px] mb-2 ambient-float">🕯️</div>
              <p style={{ color: 'var(--muted)' }}>{t('lobby.empty')}</p>
            </GlassPanel>
          )}
        </div>
      </div>
    </SceneShell>
  );
}
