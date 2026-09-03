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
  adminService, type AdminOverview, type AdminRoom, type HealthCheck, type AdminActivePlayer,
  type AdminPlayer, type AdminBug,
} from '@/services/adminService';

type ConfigShape = 'number' | 'array3' | 'numArray' | 'numObject';

/** Each app_config key + the shape the server will accept. Mirrors the
 *  validation in admin_set_config() so a bad edit is caught before the round
 *  trip (and the economy RPCs never see a value that would break a cast). */
const CONFIG_KEYS: { key: string; shape: ConfigShape }[] = [
  { key: 'gift_daily_limit', shape: 'number' },
  { key: 'streak_rewards', shape: 'numObject' },
  { key: 'weekly_podium', shape: 'array3' },
  { key: 'mission_all_done_bonus', shape: 'number' },
  { key: 'max_mission_reward', shape: 'number' },
  { key: 'referrer_tiers', shape: 'numArray' },
];

const isNonNegNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Returns an error string, or null when `value` matches `shape`. */
function validateConfig(shape: ConfigShape, value: unknown): string | null {
  switch (shape) {
    case 'number':
      return isNonNegNum(value) ? null : 'must be a number ≥ 0';
    case 'array3':
      return Array.isArray(value) && value.length === 3 && value.every(isNonNegNum)
        ? null : 'must be an array of 3 numbers ≥ 0';
    case 'numArray':
      return Array.isArray(value) && value.length > 0 && value.every(isNonNegNum)
        ? null : 'must be a non-empty array of numbers ≥ 0';
    case 'numObject':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        && Object.values(value as Record<string, unknown>).every(isNonNegNum)
        ? null : 'must be an object of numbers ≥ 0';
  }
}

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
  const [active, setActive] = useState<AdminActivePlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [transferTag, setTransferTag] = useState('');
  const [transferAmount, setTransferAmount] = useState('10000');
  const [setTag, setSetTag] = useState('');
  const [setAmount, setSetAmount] = useState('50000');

  // ---- player support ----
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminPlayer[]>([]);
  const [picked, setPicked] = useState<AdminPlayer | null>(null);
  const [grantId, setGrantId] = useState(ITEMS[0]?.id ?? '');
  const [levelDraft, setLevelDraft] = useState('1');

  // ---- bug reports ----
  const [bugs, setBugs] = useState<AdminBug[]>([]);

  // ---- economy config ----
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refreshPicked = useCallback(async (id: string) => {
    const rows = await adminService.findPlayer(id);
    const row = rows.find((r) => r.id === id) ?? null;
    setPicked(row);
    if (row) setLevelDraft(String(row.level));
  }, []);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setResults(await adminService.findPlayer(query.trim()));
  }, [query]);

  const loadConfig = useCallback(async () => {
    const cfg = await adminService.getConfig();
    setConfig(cfg);
    setDrafts(Object.fromEntries(CONFIG_KEYS.map(({ key }) => [key, JSON.stringify(cfg[key] ?? null)])));
  }, []);

  const loadBugs = useCallback(async () => { setBugs(await adminService.listBugs()); }, []);

  const load = useCallback(async () => {
    setBusy(true);
    const [checks, stats, roomList, live] = await Promise.all([
      adminService.health(profile),
      adminService.overview(),
      adminService.recentRooms(),
      adminService.activePlayers(30),
    ]);
    setHealth(checks);
    setOverview(stats);
    setRooms(roomList);
    setActive(live);
    setBusy(false);
  }, [profile]);

  useEffect(() => { void load(); void loadConfig(); void loadBugs(); }, [load, loadConfig, loadBugs]);

  /* Auto-refresh: every 5 seconds while autoRefresh is on. Skip the health
     check on the interval (it's a big RPC bag) — reload on demand for that. */
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = setInterval(async () => {
      const [stats, roomList, live] = await Promise.all([
        adminService.overview(),
        adminService.recentRooms(),
        adminService.activePlayers(30),
      ]);
      setOverview(stats);
      setRooms(roomList);
      setActive(live);
    }, 5000);
    return () => clearInterval(tick);
  }, [autoRefresh]);

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
    if (!transferTag.trim()) { toast('Enter a tag or username', 'bad', '⚠'); return; }
    const amount = parseInt(transferAmount, 10);
    if (!amount || amount <= 0) { toast('Enter valid amount', 'bad', '⚠'); return; }
    const result = await adminService.transferChips(transferTag, amount);
    if (result === null) { toast('Transfer failed — user not found?', 'bad', '⛔'); return; }
    toast(`✅ Sent ${fmt(amount)} to ${result.username} (now has ${fmt(result.balance)})`, 'good', '🪙');
    setTransferTag('');
    void load();
  };

  const setExact = async () => {
    if (!setTag.trim()) { toast('Enter a tag or username', 'bad', '⚠'); return; }
    const chips = parseInt(setAmount, 10);
    if (chips === null || chips < 0 || Number.isNaN(chips)) { toast('Enter valid chips value', 'bad', '⚠'); return; }
    const result = await adminService.setUserChips(setTag, chips);
    if (result === null) { toast('Set failed — user not found?', 'bad', '⛔'); return; }
    toast(`✅ ${result.username} now has ${fmt(result.balance)}`, 'good', '🪙');
    setSetTag('');
    void load();
  };

  const prefillTag = (tag: string, currentChips: number) => {
    setTransferTag(tag);
    setSetTag(tag);
    setSetAmount(String(currentChips));
  };

  const resetPlayer = async (p: AdminPlayer) => {
    if (!confirm(`Reset ${p.username} ${p.tag} to a fresh start? Chips → 5,000, level 1, cosmetics → starters, friends/referrals wiped. This cannot be undone.`)) return;
    const ok = await adminService.resetPlayer(p.id);
    toast(ok ? `✅ ${p.username} reset` : 'Reset failed', ok ? 'good' : 'bad', ok ? '♻️' : '⛔');
    if (ok) void refreshPicked(p.id);
  };

  const grantItemTo = async (p: AdminPlayer, revoke: boolean) => {
    const ok = revoke ? await adminService.revokeItem(p.id, grantId) : await adminService.grantItem(p.id, grantId);
    toast(ok ? `✅ ${revoke ? 'Removed' : 'Gave'} ${grantId}` : 'Failed', ok ? 'good' : 'bad', ok ? '🎁' : '⛔');
    if (ok) void refreshPicked(p.id);
  };

  const setPlayerLevel = async (p: AdminPlayer) => {
    const lvl = parseInt(levelDraft, 10);
    if (!lvl || lvl < 1) { toast('Enter a valid level', 'bad', '⚠'); return; }
    const result = await adminService.setPlayerLevel(p.id, lvl);
    toast(result !== null ? `✅ ${p.username} → level ${result}` : 'Failed', result !== null ? 'good' : 'bad', result !== null ? '🎖️' : '⛔');
    if (result !== null) void refreshPicked(p.id);
  };

  const resolveBug = async (id: number) => {
    const ok = await adminService.resolveBug(id);
    if (ok) void loadBugs();
    else toast('Failed', 'bad', '⛔');
  };

  const saveConfig = async (key: string, shape: ConfigShape) => {
    let parsed: unknown;
    try { parsed = JSON.parse(drafts[key] ?? ''); }
    catch { toast(`${key}: not valid JSON`, 'bad', '⚠'); return; }
    const err = validateConfig(shape, parsed);
    if (err) { toast(`${key}: ${err}`, 'bad', '⚠'); return; }
    const ok = await adminService.setConfig(key, parsed);
    toast(ok ? `✅ ${key} saved` : `${key}: save failed`, ok ? 'good' : 'bad', ok ? '💾' : '⛔');
    if (ok) void loadConfig();
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
          <div className="flex gap-2 items-center">
            <label className="text-[11.5px] flex items-center gap-1.5 cursor-pointer"
              style={{ color: autoRefresh ? 'var(--jade-hi)' : 'var(--muted)' }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              LIVE (5s)
            </label>
            <GameButton tone="ghost" size="sm" disabled={busy} onClick={() => void load()}>
              {busy ? t('loading.generic') : t('admin.refresh')}
            </GameButton>
          </div>
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
          <div className="eyebrow mb-2.5">🎁 Gift chips (add to their balance)</div>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Tag or username</label>
              <input
                type="text"
                value={transferTag}
                onChange={(e) => setTransferTag(e.target.value)}
                placeholder="#1234 or Noam"
                className="w-full px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] mt-1"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
              />
            </div>
            <div style={{ width: 110 }}>
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Add</label>
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
          <div className="eyebrow mt-4 mb-2.5">🎯 Set exact balance</div>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Tag or username</label>
              <input
                type="text"
                value={setTag}
                onChange={(e) => setSetTag(e.target.value)}
                placeholder="#1234 or Noam"
                className="w-full px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] mt-1"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
              />
            </div>
            <div style={{ width: 130 }}>
              <label className="text-[11px]" style={{ color: 'var(--dim)' }}>Exact chips</label>
              <input
                type="number"
                value={setAmount}
                onChange={(e) => setSetAmount(e.target.value)}
                placeholder="50000"
                className="w-full px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] mt-1"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
              />
            </div>
            <GameButton tone="gold" size="sm" onClick={() => void setExact()}>Set</GameButton>
          </div>
        </GlassPanel>

        {/* --------------------------- help a player ---------------------- */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-2.5">🔎 Help a player</div>
          <div className="flex gap-2 items-end">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
              placeholder="tag or username"
              className="flex-1 px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px]"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
            />
            <GameButton tone="metal" size="sm" onClick={() => void runSearch()}>Search</GameButton>
          </div>

          {results.length > 0 && !picked && (
            <div className="flex flex-col gap-1 mt-2.5">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setPicked(r); setLevelDraft(String(r.level)); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--r-xs)] text-[12.5px] text-start press"
                  style={{ background: 'rgba(255,255,255,.03)' }}
                >
                  <b className="flex-1 truncate">{r.username} <span style={{ color: 'var(--dim)' }}>{r.tag}</span></b>
                  <span style={{ color: 'var(--muted)' }}>Lv {r.level}</span>
                  <b className="num" style={{ color: 'var(--gold-hi)' }}>{fmt(r.chips)}</b>
                </button>
              ))}
            </div>
          )}

          {picked && (
            <div className="mt-3 p-3 rounded-[var(--r-sm)]" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-line)' }}>
              <div className="flex items-center justify-between mb-2">
                <b className="text-[13.5px]">{picked.username} <span style={{ color: 'var(--dim)' }}>{picked.tag}</span></b>
                <button className="text-[11px] press" style={{ color: 'var(--muted)' }} onClick={() => { setPicked(null); }}>✕ close</button>
              </div>
              <div className="grid gap-1.5 text-[11.5px] mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', color: 'var(--muted)' }}>
                <span>Chips <b style={{ color: 'var(--gold-hi)' }}>{fmt(picked.chips)}</b></span>
                <span>Level <b style={{ color: 'inherit' }}>{picked.level}</b> · XP {picked.xp}</span>
                <span>Streak <b>{picked.daily_streak}</b></span>
                <span>Items <b>{picked.item_count}</b></span>
                <span>Friends <b>{picked.friend_count}</b></span>
                <span>Referrals <b>{picked.referral_count}</b></span>
                <span>{picked.is_guest ? 'guest' : 'account'}{picked.is_admin ? ' · ADMIN' : ''}{picked.ever_vip ? ' · VIP' : ''}</span>
                <span>{picked.presence}{picked.current_game ? ` · ${picked.current_game}` : ''}</span>
                <span>Joined {shortDate(picked.created_at, lang)}</span>
                <span>Seen {picked.last_seen ? shortDate(picked.last_seen, lang) : '—'}</span>
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-[10.5px]" style={{ color: 'var(--dim)' }}>Level</label>
                  <div className="flex gap-1 mt-1">
                    <input type="number" value={levelDraft} onChange={(e) => setLevelDraft(e.target.value)}
                      className="w-16 px-2 py-1.5 rounded-[var(--r-xs)] text-[12px]"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }} />
                    <GameButton tone="metal" size="sm" onClick={() => void setPlayerLevel(picked)}>Set</GameButton>
                  </div>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10.5px]" style={{ color: 'var(--dim)' }}>Item</label>
                  <div className="flex gap-1 mt-1">
                    <select value={grantId} onChange={(e) => setGrantId(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-[var(--r-xs)] text-[12px]"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}>
                      {ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name[lang]} ({it.id})</option>)}
                    </select>
                    <GameButton tone="gold" size="sm" onClick={() => void grantItemTo(picked, false)}>Give</GameButton>
                    <GameButton tone="ghost" size="sm" onClick={() => void grantItemTo(picked, true)}>Remove</GameButton>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <GameButton tone="metal" size="sm" onClick={() => prefillTag(picked.tag, picked.chips)}>Prefill chip forms ↑</GameButton>
                <GameButton tone="ghost" size="sm" onClick={() => void resetPlayer(picked)}>♻️ Reset player</GameButton>
              </div>
            </div>
          )}
        </GlassPanel>

        {/* --------------------------- bug reports ------------------------ */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">🐞 Bug reports ({bugs.filter((b) => !b.resolved_at).length} open)</div>
            <GameButton tone="ghost" size="sm" onClick={() => void loadBugs()}>{t('admin.refresh')}</GameButton>
          </div>
          {bugs.length === 0 ? (
            <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>No bug reports.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {bugs.map((b) => (
                <div key={b.id} className="px-3 py-2 rounded-[var(--r-xs)] text-[12px]"
                  style={{ background: b.resolved_at ? 'rgba(46,158,107,.07)' : 'rgba(168,65,62,.10)' }}>
                  <div className="flex items-start gap-2">
                    <span className="flex-1 break-words">{b.description}</span>
                    {!b.resolved_at && (
                      <GameButton tone="ghost" size="sm" onClick={() => void resolveBug(b.id)}>Mark done</GameButton>
                    )}
                  </div>
                  <div className="text-[10.5px] mt-1" style={{ color: 'var(--dim)' }}>
                    {b.reporter ?? 'anon'}{b.reporter_tag ? ` ${b.reporter_tag}` : ''} · {shortDate(b.created_at, lang)}
                    {b.screen_size ? ` · ${b.screen_size}` : ''}{b.url ? ` · ${b.url}` : ''}
                    {b.resolved_at ? ' · ✅ resolved' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* --------------------------- economy tuning -------------------- */}
        <GlassPanel gold className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="eyebrow">⚖️ Economy tuning (app_config)</div>
            <GameButton tone="ghost" size="sm" onClick={() => void loadConfig()}>{t('admin.refresh')}</GameButton>
          </div>
          <p className="text-[11px] mb-3" style={{ color: 'var(--dim)' }}>
            Each value is JSON. Server RPCs fall back to the shipped economy.ts constant when a key is missing.
          </p>
          <div className="flex flex-col gap-2.5">
            {CONFIG_KEYS.map(({ key, shape }) => (
              <div key={key}>
                <label className="text-[11px] flex items-center justify-between" style={{ color: 'var(--muted)' }}>
                  <span><b style={{ color: 'inherit' }}>{key}</b></span>
                  {config[key] === undefined && <span style={{ color: 'var(--dim)' }}>using fallback</span>}
                </label>
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="text"
                    value={drafts[key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 rounded-[var(--r-xs)] text-[12px] num"
                    style={{ background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-line)', color: 'inherit' }}
                  />
                  <GameButton tone="gold" size="sm" onClick={() => void saveConfig(key, shape)}>Save</GameButton>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* --------------------------- live players ------------------------ */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">🔴 Live players ({active.length})</div>
            {autoRefresh && <span className="text-[10.5px]" style={{ color: 'var(--jade-hi)' }}>updating every 5s</span>}
          </div>
          {active.length === 0 ? (
            <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>Nobody active right now.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {active.map((p) => {
                const seenMs = Date.now() - new Date(p.last_seen).getTime();
                const seenMin = Math.floor(seenMs / 60000);
                const seenLabel = seenMin < 1 ? 'now' : seenMin < 60 ? `${seenMin}m ago` : `${Math.floor(seenMin / 60)}h ago`;
                const live = seenMs < 60_000 && p.presence !== 'offline';
                const gameLabel = p.current_game ? t(`games.${p.current_game}`, {}) : (p.presence === 'hub' ? 'Hub' : p.presence);
                return (
                  <button
                    key={p.id}
                    onClick={() => prefillTag(p.tag, p.chips)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--r-xs)] text-[12.5px] text-start press"
                    style={{ background: live ? 'rgba(46,158,107,.08)' : 'rgba(255,255,255,.03)' }}
                  >
                    <span className="rounded-full" style={{ width: 8, height: 8, background: live ? 'var(--jade-hi)' : 'var(--dim)' }} />
                    <b className="min-w-0 flex-1 truncate">
                      {p.username}
                      {p.is_admin && <span className="ms-1.5 text-[10px]" style={{ color: 'var(--crimson-hi)' }}>ADMIN</span>}
                      {p.is_guest && <span className="ms-1.5 text-[10px]" style={{ color: 'var(--dim)' }}>guest</span>}
                      <span className="ms-1.5 text-[10.5px]" style={{ color: 'var(--dim)' }}>{p.tag}</span>
                    </b>
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{gameLabel}</span>
                    <b className="num" style={{ color: 'var(--gold-hi)', minWidth: 80, textAlign: 'end' }}>{fmt(p.chips)}</b>
                    <span className="text-[10px] w-14 text-end" style={{ color: 'var(--dim)' }}>{seenLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10.5px] mt-2" style={{ color: 'var(--dim)' }}>Click a row to prefill the tag in the forms above.</p>
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
