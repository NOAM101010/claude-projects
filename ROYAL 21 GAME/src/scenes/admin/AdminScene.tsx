import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { LightPool } from '@/components/effects/LightPool';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { fmt, shortDate } from '@/lib/format';
import { ITEMS } from '@/data/items';
import {
  adminService, type AdminOverview, type AdminRoom, type HealthCheck,
} from '@/services/adminService';

function Stat({ label, value, tone = 'gold' }: { label: string; value: string | number; tone?: 'gold' | 'jade' | 'crimson' }) {
  const color = tone === 'jade' ? 'var(--jade-hi)' : tone === 'crimson' ? 'var(--crimson-hi)' : 'var(--gold-hi)';
  return (
    <div className="p-3 rounded-[var(--r-sm)]" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid var(--glass-line)' }}>
      <b className="num block" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color }}>
        {typeof value === 'number' ? fmt(value) : value}
      </b>
      <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

/**
 * Behind the scenes.
 *
 * Reachable only by an account the database has flagged, and useless to anyone
 * else: every button is an RPC that re-checks that flag server side. The top
 * half is the diagnostic panel — the one that would have shown, at a glance,
 * that a signed-up player was walking around with no session behind them.
 */
export default function AdminScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const profile = usePlayer((s) => s.profile);
  const setChips = usePlayer((s) => s.setChips);
  const setProfile = usePlayer((s) => s.setProfile);
  const owned = usePlayer((s) => s.owned);
  const toast = useUI((s) => s.toast);

  const [health, setHealth] = useState<HealthCheck[] | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [busy, setBusy] = useState(false);
  const [transferTag, setTransferTag] = useState('');
  const [transferAmount, setTransferAmount] = useState('10000');

  const load = useCallback(async () => {
    setBusy(true);
    const [checks, stats, roomList] = await Promise.all([
      adminService.health(profile),
      adminService.overview(),
      adminService.recentRooms(),
    ]);
    setHealth(checks);
    setOverview(stats);
    setRooms(roomList);
    setBusy(false);
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  // The route is guarded, but a direct hit should still land somewhere sane.
  useEffect(() => {
    if (!profile.isAdmin) navigate('/hub', { replace: true });
  }, [profile.isAdmin, navigate]);

  if (!profile.isAdmin) return null;

  const give = async (amount: number) => {
    const balance = await adminService.setChips(amount);
    if (balance === null) {
      toast(t('admin.refused'), 'bad', '⛔');
      return;
    }
    setChips(balance);
    toast(t('admin.chipsSet', { n: fmt(balance) }), 'good', '🪙');
  };

  const grantItems = async () => {
    const granted = await adminService.grantAllItems();
    if (granted === null) {
      toast(t('admin.refused'), 'bad', '⛔');
      return;
    }
    usePlayer.setState({ owned: ITEMS.map((item) => item.id) });
    usePlayer.getState().persist();
    toast(t('admin.itemsGranted', { n: granted }), 'good', '🎁');
  };

  const bumpLevel = async (level: number) => {
    const result = await adminService.setLevel(level);
    if (result === null) {
      toast(t('admin.refused'), 'bad', '⛔');
      return;
    }
    setProfile({ ...profile, level: result, xp: 0 });
    toast(t('admin.levelSet', { n: result }), 'good', '🎖️');
  };

  const transfer = async () => {
    if (!transferTag.trim()) {
      toast('Enter a tag (e.g., #1234)', 'bad', '⚠');
      return;
    }
    const amount = parseInt(transferAmount, 10);
    if (!amount || amount <= 0) {
      toast('Enter valid amount', 'bad', '⚠');
      return;
    }
    const result = await adminService.transferChips(transferTag, amount);
    if (result === null) {
      toast('Transfer failed — user not found?', 'bad', '⛔');
      return;
    }
    toast(`✅ Sent ${fmt(amount)} to ${result.username} (now has ${fmt(result.balance)})`, 'good', '🪙');
    setTransferTag('');
  };

  return (
    <SceneShell compactHud particles={false}>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #241018, #140d12 55%, #08090b 88%)' }} />
        <LightPool x="50%" y="14%" size={700} color="rgba(168,65,62,.16)" />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col gap-3" style={{ maxWidth: 940 }}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <span className="eyebrow" style={{ color: 'var(--crimson-hi)' }}>{t('admin.eyebrow')}</span>
            <h1 className="mt-1">{t('admin.title')}</h1>
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
              {profile.username} · {profile.tag}
            </p>
          </div>
          <GameButton tone="ghost" size="sm" disabled={busy} onClick={() => void load()}>
            {busy ? t('loading.generic') : t('admin.refresh')}
          </GameButton>
        </div>

        {/* ---------------------------- health ---------------------------- */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-3">{t('admin.health')}</div>
          {health ? (
            <div className="flex flex-col gap-1.5">
              {health.map((check) => (
                <motion.div
                  key={check.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-[var(--r-xs)]"
                  style={{ background: check.ok ? 'rgba(46,158,107,.09)' : 'rgba(168,65,62,.11)' }}
                >
                  <span className="text-[13px] mt-[1px]">{check.ok ? '✅' : '⛔'}</span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[12.5px]">{t(`admin.checks.${check.key}`)}</b>
                    <span className="block text-[11px] break-words" style={{ color: 'var(--muted)' }}>{check.detail}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>{t('loading.generic')}</p>
          )}
        </GlassPanel>

        {/* ---------------------------- powers (self) ---------------------------- */}
        <GlassPanel gold className="p-4">
          <div className="eyebrow mb-1">{t('admin.powers')}</div>
          <p className="text-[11.5px] mb-3" style={{ color: 'var(--dim)' }}>{t('admin.powersNote')}</p>
          <div className="flex flex-wrap gap-2">
            <GameButton tone="gold" size="sm" onClick={() => void give(999999999)}>🪙 {t('admin.infinite')}</GameButton>
            <GameButton tone="metal" size="sm" onClick={() => void give(profile.chips + 1000000)}>+1,000,000</GameButton>
            <GameButton tone="metal" size="sm" onClick={() => void give(100000)}>= 100,000</GameButton>
            <GameButton tone="ghost" size="sm" onClick={() => void give(5000)}>{t('admin.resetChips')}</GameButton>
          </div>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <GameButton tone="gold" size="sm" disabled={owned.length >= ITEMS.length} onClick={() => void grantItems()}>
              🎁 {t('admin.unlockAll')} ({owned.length}/{ITEMS.length})
            </GameButton>
            <GameButton tone="metal" size="sm" onClick={() => void bumpLevel(50)}>{t('admin.level')} 50</GameButton>
            <GameButton tone="ghost" size="sm" onClick={() => void bumpLevel(1)}>{t('admin.level')} 1</GameButton>
          </div>
        </GlassPanel>

        {/* ---------------------------- powers (others) ---------------------------- */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-2.5">Transfer Chips to Others</div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Tag (e.g., #1234)</label>
              <input
                type="text"
                value={transferTag}
                onChange={(e) => setTransferTag(e.target.value)}
                placeholder="#1234"
                className="w-full px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] mt-1"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
              />
            </div>
            <div style={{ width: 100 }}>
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Amount</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="10000"
                className="w-full px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] mt-1"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
              />
            </div>
            <GameButton tone="metal" size="sm" onClick={() => void transfer()}>Send</GameButton>
          </div>
        </GlassPanel>

        {/* --------------------------- the world -------------------------- */}
        {overview && (
          <>
            <GlassPanel className="p-4">
              <div className="eyebrow mb-3">{t('admin.world')}</div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))' }}>
                <Stat label={t('admin.players')} value={overview.players} />
                <Stat label={t('admin.online')} value={overview.online} tone="jade" />
                <Stat label={t('admin.guests')} value={overview.guests} />
                <Stat label={t('admin.liveRooms')} value={overview.liveRooms} tone="jade" />
                <Stat label={t('admin.rooms')} value={overview.rooms} />
                <Stat label={t('admin.messages')} value={overview.messages} />
                <Stat label={t('admin.hands')} value={overview.handsPlayed} />
                <Stat label={t('admin.chipsInPlay')} value={overview.chipsInPlay} />
                <Stat
                  label={t('admin.unconfirmed')}
                  value={overview.unconfirmed}
                  tone={overview.unconfirmed ? 'crimson' : 'gold'}
                />
                <Stat
                  label={t('admin.missingProfile')}
                  value={overview.missingProfile}
                  tone={overview.missingProfile ? 'crimson' : 'gold'}
                />
              </div>
              {(overview.unconfirmed > 0 || overview.missingProfile > 0) && (
                <p className="mt-3 text-[11.5px] p-2.5 rounded-[var(--r-xs)]" style={{ background: 'rgba(168,65,62,.12)', color: 'var(--crimson-hi)' }}>
                  {t('admin.stuckAccounts')}
                </p>
              )}
            </GlassPanel>

            <GlassPanel className="p-4">
              <div className="eyebrow mb-3">{t('admin.richest')}</div>
              <div className="flex flex-col gap-1.5">
                {overview.topPlayers.map((player, index) => (
                  <div key={`${player.tag}-${index}`} className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)] text-[13px]"
                    style={{ background: 'rgba(255,255,255,.03)' }}>
                    <span className="num w-5" style={{ color: 'var(--dim)' }}>{index + 1}</span>
                    <b className="flex-1 truncate">{player.username}</b>
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('common.level')} {player.level}</span>
                    <b className="num" style={{ color: 'var(--gold-hi)' }}>{fmt(player.chips)}</b>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </>
        )}

        {/* ---------------------------- rooms ----------------------------- */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-3">{t('admin.recentRooms')}</div>
          {rooms.length ? (
            <div className="flex flex-col gap-1.5">
              {rooms.map((room) => (
                <button
                  key={room.code}
                  className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)] text-[13px] text-start press"
                  style={{ background: 'rgba(255,255,255,.03)' }}
                  onClick={() => navigate(`/room/${room.code}`)}
                >
                  <b className="num" style={{ color: 'var(--gold-hi)' }}>{room.code}</b>
                  <span className="flex-1 truncate" style={{ color: 'var(--muted)' }}>
                    {t(`games.${room.game}`)} · {room.host ?? '—'} · {room.members} 👥
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--dim)' }}>{shortDate(room.updated_at, lang)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>{t('admin.noRooms')}</p>
          )}
        </GlassPanel>

        <GameButton tone="ghost" block onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
      </div>
    </SceneShell>
  );
}
