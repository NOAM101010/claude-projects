import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/social/Avatar';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { Modal } from '@/components/ui/Modal';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { profileService } from '@/services/profileService';
import { isOnline, isRemoteId } from '@/services/supabase';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import type { AvatarConfig } from '@/types';

/* ============================================================================
   ROYAL 21 — Leaderboard.

   Two faces, one brain:
     <LeaderboardWidget>  — compact, lives on the Hub. Top 3 + you + a link.
     <LeaderboardFull>    — the full podium + list, shown inside a <Modal>.
   Both read only the { rows, you } shape from `useLeaderboardData`.

   `useLeaderboardData` pulls the real feed when there is a signed-in session:
     · scope 'world'   -> profileService.leaderboard(kind, 20)
     · scope 'friends' -> the same feed, filtered to friends + self
   Category -> server kind:
     chips  -> 'chips'        level  -> 'level'      bjWins -> 'bj_wins'
     streak -> 'best_streak'  bigWin -> 'biggest_win'
   Falls back to the deterministic mock roster below whenever the player is
   offline / a guest / the call fails / the feed comes back empty.
   ========================================================================== */

export type LbScope = 'world' | 'friends';
export type LbCategory = 'chips' | 'bjWins' | 'bigWin' | 'streak' | 'level';

export interface LbRow {
  id: string;
  username: string;
  tag: string;
  avatar: AvatarConfig;
  level: number;
  value: number;
  isYou?: boolean;
}

type TFn = (path: string, vars?: Record<string, string | number>) => string;

const CATEGORIES: LbCategory[] = ['chips', 'bjWins', 'bigWin', 'streak', 'level'];
const CAT_ICON: Record<LbCategory, string> = {
  chips: '🪙', bjWins: '🃏', bigWin: '💰', streak: '🔥', level: '⭐',
};
const SHIRTS = ['base', 'gold', 'royal', 'neon', 'crimson', 'white'] as const;
const MEDALS = ['①', '②', '③'];
const PODIUM_ORDER = [1, 0, 2]; // reads left→right as 2nd · 1st · 3rd

/* ---- mock roster (deterministic, so ranks don't reshuffle on every render) ---- */
const MOCK_NAMES: [string, string][] = [
  ['ליאם', 'LiamK'], ['נועה', 'noa_h'], ['איתי', 'ItayR'], ['שירה', 'shira'],
  ['דניאל', 'danielX'], ['תמר', 'tmr'], ['יונתן', 'yoni'], ['מאיה', 'maya_g'],
  ['רון', 'RonBet'], ['עדן', 'edenn'], ['גיא', 'guyf'], ['הדר', 'hadar'],
  ['אור', 'orL'], ['נטע', 'neta'], ['עומר', 'omerZ'], ['רותם', 'rotem'],
  ['אלון', 'alonm'], ['ליבי', 'libi'], ['בר', 'barB'], ['שחר', 'shhr'],
  ['נבו', 'nevoo'], ['תום', 'tomk'], ['אריאל', 'ari'], ['יעל', 'yaeli'],
];

const CATEGORY_SEED: Record<LbCategory, number> = {
  chips: 11, bjWins: 23, bigWin: 37, streak: 51, level: 67,
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baseValue(cat: LbCategory, rnd: () => number, rank: number, total: number): number {
  const top = 1 - rank / (total + 2);
  switch (cat) {
    case 'chips': return Math.round((2_400_000 * top + rnd() * 220_000) / 1000) * 1000;
    case 'bigWin': return Math.round((1_100_000 * top + rnd() * 90_000) / 500) * 500;
    case 'bjWins': return Math.round(1500 * top + rnd() * 90);
    case 'streak': return Math.round(64 * top + rnd() * 5) + 1;
    case 'level': return Math.max(4, Math.round(92 * top + rnd() * 4));
    default: return 0;
  }
}

const KIND_OF: Record<LbCategory, 'chips' | 'level' | 'bj_wins' | 'best_streak' | 'biggest_win'> = {
  chips: 'chips', bjWins: 'bj_wins', bigWin: 'biggest_win', streak: 'best_streak', level: 'level',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function valueOfRaw(cat: LbCategory, r: any): number {
  switch (cat) {
    case 'chips': return r.chips ?? 0;
    case 'level': return r.level ?? 0;
    case 'bjWins': return r.bj_wins ?? 0;
    case 'bigWin': return r.biggest_win ?? 0;
    case 'streak': return r.best_streak ?? 0;
    default: return 0;
  }
}

function useLeaderboardData(scope: LbScope, category: LbCategory) {
  const profile = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const friends = useSocial((s) => s.friends);

  /* Real feed — null until it lands, and stays null on any failure so the
     mock branch below keeps the board populated. */
  const [remote, setRemote] = useState<LbRow[] | null>(null);

  useEffect(() => {
    if (!isOnline() || !isRemoteId(profile.id)) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    const kind = KIND_OF[category];
    const friendIds = new Set<string>([profile.id, ...friends.map((f) => f.id)]);

    (async () => {
      try {
        const feed = await profileService.leaderboard(kind, scope === 'friends' ? 200 : 20) as any[];
        if (cancelled) return;
        const scoped = scope === 'friends' ? feed.filter((r) => friendIds.has(r.id)) : feed;
        const mapped: LbRow[] = scoped
          .filter((r) => r.id !== profile.id)
          .map((r) => ({
            id: r.id,
            username: r.username,
            tag: r.tag || '',
            avatar: r.avatar,
            level: r.level ?? 0,
            value: valueOfRaw(category, r),
          }));
        setRemote(mapped.length ? mapped : null);
      } catch {
        if (!cancelled) setRemote(null);
      }
    })();

    return () => { cancelled = true; };
  }, [scope, category, profile.id, friends]);

  return useMemo(() => {
    const rnd = mulberry32(CATEGORY_SEED[category] + (scope === 'friends' ? 900 : 0));
    let rows: LbRow[];

    if (remote) {
      rows = remote.map((r) => ({ ...r }));
    } else if (scope === 'friends' && friends.length) {
      rows = friends.slice(0, 19).map((f, i) => ({
        id: f.id,
        username: f.username,
        tag: f.tag || `#${1000 + (i * 137) % 8999}`,
        avatar: f.avatar,
        level: f.level,
        value:
          category === 'chips' ? f.chips
          : category === 'level' ? f.level
          : baseValue(category, rnd, i, friends.length),
      }));
    } else {
      const pool = scope === 'friends' ? MOCK_NAMES.slice(0, 8) : MOCK_NAMES;
      rows = pool.map(([username, tag], i) => {
        const value = baseValue(category, rnd, i, pool.length);
        return {
          id: `mock-${scope}-${i}`,
          username,
          tag: `${tag}#${1000 + Math.floor(rnd() * 8999)}`,
          avatar: {
            skin: Math.floor(rnd() * 5),
            hair: Math.floor(rnd() * 6),
            shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
          },
          level: category === 'level' ? value : Math.max(3, Math.floor(rnd() * 62)),
          value,
        };
      });
    }

    const myValue: Record<LbCategory, number> = {
      chips: profile.chips,
      bjWins: stats.bjWins,
      bigWin: stats.biggestWin,
      streak: stats.bestStreak,
      level: profile.level,
    };
    const you: LbRow = {
      id: profile.id,
      username: profile.username,
      tag: profile.tag,
      avatar: profile.avatar,
      level: profile.level,
      value: myValue[category],
      isYou: true,
    };

    rows.push(you);
    rows.sort((a, b) => b.value - a.value);
    const total = rows.length;
    const rank = rows.findIndex((r) => r.isYou) + 1;

    return { rows: rows.slice(0, 20), you: { row: you, rank, total } };
  }, [scope, category, profile, stats, friends, remote]);
}

function formatValue(cat: LbCategory, value: number, glyph: string, t: TFn): string {
  if (cat === 'chips' || cat === 'bigWin') return `${glyph} ${fmt(value)}`;
  if (cat === 'bjWins') return t('leaderboard.valueBjWins', { count: value });
  if (cat === 'streak') return `🔥 ${t('leaderboard.valueStreak', { count: value })}`;
  return t('leaderboard.valueLevel', { count: value });
}

const catLabel = (c: LbCategory, t: TFn) =>
  t(`leaderboard.cat${c[0].toUpperCase()}${c.slice(1)}`);

/* --------------------------------- controls -------------------------------- */

interface ControlProps {
  scope: LbScope;
  setScope: (s: LbScope) => void;
  category: LbCategory;
  setCategory: (c: LbCategory) => void;
  t: TFn;
}

function ScopeToggle({ scope, setScope, t }: Omit<ControlProps, 'category' | 'setCategory'>) {
  return (
    <div className="lb-scope" role="tablist" aria-label={t('leaderboard.title')}>
      <button type="button" data-on={scope === 'world'} onClick={() => setScope('world')}>
        {t('leaderboard.scopeWorld')}
      </button>
      <button type="button" data-on={scope === 'friends'} onClick={() => setScope('friends')}>
        {t('leaderboard.scopeFriends')}
      </button>
    </div>
  );
}

function CategoryBar({
  category, setCategory, t, iconOnly,
}: Omit<ControlProps, 'scope' | 'setScope'> & { iconOnly?: boolean }) {
  return (
    <div className="lb-cats" role="tablist">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          className={`lb-cat${iconOnly ? ' lb-cat--icononly' : ''}`}
          data-on={category === c}
          onClick={() => setCategory(c)}
          title={catLabel(c, t)}
          aria-label={catLabel(c, t)}
        >
          <span aria-hidden>{CAT_ICON[c]}</span>
          <span className="lb-cat-txt">{catLabel(c, t)}</span>
        </button>
      ))}
    </div>
  );
}

function ValueRow({
  rank, row, category, glyph, t, mini,
}: { rank: number; row: LbRow; category: LbCategory; glyph: string; t: TFn; mini?: boolean }) {
  return (
    <div className={mini ? 'lb-mini-row' : 'lb-row'} data-you={row.isYou ? 'true' : undefined}>
      <span className="lb-rank" style={row.isYou ? { color: 'var(--gold-hi)' } : undefined}>
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <Avatar config={row.avatar} size={mini ? 28 : 30} level={row.level} id={`lb-${row.id}`} />
      <span className="lb-row-name">
        {row.isYou ? t('leaderboard.you') : row.username}{' '}
        {!mini && <span className="lb-row-tag">{row.tag}</span>}
      </span>
      <span className="lb-row-val">{formatValue(category, row.value, glyph, t)}</span>
    </div>
  );
}

/* -------------------------------- the widget ------------------------------- */

function LeaderboardWidget({
  controls, data, glyph, onExpand,
}: {
  controls: ControlProps;
  data: ReturnType<typeof useLeaderboardData>;
  glyph: string;
  onExpand: () => void;
}) {
  const { t } = controls;
  const { rows, you } = data;
  const top3 = rows.slice(0, 3);

  return (
    <motion.section
      className="lb-panel lb-panel--widget"
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ type: 'spring', stiffness: 170, damping: 26 }}
    >
      <div className="lb-widget-head">
        <div>
          <span className="eyebrow" style={{ fontSize: 10 }}>{t('leaderboard.subtitle')}</span>
          <h2 className="hub-title" style={{ fontSize: 'clamp(19px, 2.6vw, 24px)', marginTop: 2 }}>
            {t('leaderboard.title')}
          </h2>
        </div>
        <ScopeToggle {...controls} />
      </div>

      <CategoryBar {...controls} iconOnly />

      {top3.length === 0 ? (
        <p className="lb-empty">
          {controls.scope === 'friends' ? t('leaderboard.friendsEmpty') : t('leaderboard.empty')}
        </p>
      ) : (
        <div className="lb-mini">
          {top3.map((row, i) => (
            <ValueRow key={row.id} rank={i + 1} row={row} category={controls.category} glyph={glyph} t={t} mini />
          ))}
          {you.rank > 3 && (
            <ValueRow rank={you.rank} row={you.row} category={controls.category} glyph={glyph} t={t} mini />
          )}
        </div>
      )}

      <button type="button" className="lb-more" onClick={onExpand}>
        {t('leaderboard.viewFull')} →
      </button>
    </motion.section>
  );
}

/* -------------------------------- the full view ---------------------------- */

function LeaderboardFull({
  controls, data, glyph,
}: {
  controls: ControlProps;
  data: ReturnType<typeof useLeaderboardData>;
  glyph: string;
}) {
  const { t, category, scope } = controls;
  const { rows, you } = data;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div>
      <div className="lb-head">
        <ScopeToggle {...controls} />
      </div>
      <CategoryBar {...controls} />

      {rows.length <= 1 ? (
        <p className="lb-empty">
          {scope === 'friends' ? t('leaderboard.friendsEmpty') : t('leaderboard.empty')}
        </p>
      ) : (
        <>
          <div className="lb-podium">
            {PODIUM_ORDER.map((idx) => {
              const row = top3[idx];
              if (!row) return <div key={idx} />;
              const place = idx + 1;
              return (
                <div key={row.id} className="lb-plinth" data-place={place}>
                  <span className="lb-medal">{MEDALS[idx]}</span>
                  <Avatar
                    config={row.avatar}
                    size={place === 1 ? 56 : 44}
                    level={row.level}
                    id={`lbp-${row.id}`}
                  />
                  <span className="lb-name">{row.isYou ? t('leaderboard.you') : row.username}</span>
                  <span className="lb-val">{formatValue(category, row.value, glyph, t)}</span>
                </div>
              );
            })}
          </div>

          <div className="lb-list">
            {rest.map((row, i) => (
              <ValueRow key={row.id} rank={i + 4} row={row} category={category} glyph={glyph} t={t} />
            ))}
          </div>

          {you.rank > 3 && (
            <div className="lb-youbar">
              <span className="lb-rank" style={{ color: 'var(--gold-hi)' }}>{you.rank}</span>
              <Avatar config={you.row.avatar} size={30} level={you.row.level} id="lb-you-full" />
              <span className="lb-row-name">
                {t('leaderboard.you')}{' '}
                <span className="lb-row-tag">{t('leaderboard.outOf', { count: you.total })}</span>
              </span>
              <span className="lb-row-val">{formatValue(category, you.row.value, glyph, t)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------- container -------------------------------- */

export function Leaderboard() {
  const { t } = useT();
  const [scope, setScope] = useState<LbScope>('world');
  const [category, setCategory] = useState<LbCategory>('chips');
  const [open, setOpen] = useState(false);
  const glyph = chipGlyphOf(usePlayer((s) => s.profile.equipped.currencySkin));
  const data = useLeaderboardData(scope, category);

  const controls: ControlProps = { scope, setScope, category, setCategory, t };

  return (
    <>
      <LeaderboardWidget controls={controls} data={data} glyph={glyph} onExpand={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('leaderboard.title')} subtitle={t('leaderboard.subtitle')} width={560}>
        <LeaderboardFull controls={controls} data={data} glyph={glyph} />
      </Modal>
    </>
  );
}
