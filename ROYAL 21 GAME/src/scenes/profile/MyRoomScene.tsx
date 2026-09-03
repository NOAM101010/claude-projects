import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Meter } from '@/components/ui/Meter';
import { Avatar } from '@/components/social/Avatar';
import { AvatarEditor } from '@/components/social/AvatarEditor';
import { LightPool } from '@/components/effects/LightPool';
import { useCountUp } from '@/hooks/useCountUp';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useT } from '@/hooks/useT';
import { ACHIEVEMENTS, TIER_STYLE } from '@/data/achievements';
import { MILESTONE_EVERY } from '@/data/economy';
import { VIP_MIN_LEVEL, VIP_MIN_CHIPS, isVipEligible, vipProgress } from '@/data/vip';
import { roomBackgroundOf } from '@/data/roomThemes';
import { profileService, rankOf, xpForLevel } from '@/services/profileService';
import { formatPlaytime } from '@/services/playtimeService';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { fmt, fmtSigned, pct, shortDate } from '@/lib/format';
import type { GameKey, Profile, Stats } from '@/types';

function StatTile({ label, value, tone = 'gold', delay = 0 }: { label: string; value: number | string; tone?: 'gold' | 'jade'; delay?: number }) {
  const numeric = typeof value === 'number';
  const counted = useCountUp(numeric ? (value as number) : 0, 900);
  return (
    <motion.div
      className="p-3 rounded-[var(--r-sm)]"
      style={{ background: 'rgba(255,255,255,.035)', border: '1px solid var(--glass-line)' }}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
    >
      <b className="num block" style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: tone === 'gold' ? 'var(--gold-hi)' : 'var(--jade-hi)' }}>
        {numeric ? fmt(counted) : value}
      </b>
      <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{label}</span>
    </motion.div>
  );
}

/** Bronze → platinum, so the trophy case reads as a progression. */
const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

/* The shelf shows only real trophies — the event ones, granted the instant they
   happen. The 31 stat achievements live in their own section below, as a
   checklist the player can choose to chase. */
const EVENT_TROPHIES = ACHIEVEMENTS.filter((a) => a.kind === 'event');
const STAT_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => a.kind !== 'event');

/** My Room: a place with a trophy shelf, not a dashboard. */
export default function MyRoomScene() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useT();
  const me = usePlayer((s) => s.profile);
  const stats = usePlayer((s) => s.stats);
  const owned = usePlayer((s) => s.owned);
  const achievements = usePlayer((s) => s.achievements);
  const activity = usePlayer((s) => s.activity);
  const rivalries = usePlayer((s) => s.rivalries);
  const friends = useSocial((s) => s.friends);

  const isMe = !userId || userId === me.id;
  const friend = friends.find((entry) => entry.id === userId);
  const [remote, setRemote] = useState<{ profile: Profile | null; stats: Partial<Stats> | null }>({ profile: null, stats: null });
  const [allAchOpen, setAllAchOpen] = useState(false);
  const [editAvatarOpen, setEditAvatarOpen] = useState(false);

  useEffect(() => {
    if (isMe || !userId) return;
    void (async () => {
      const [row, remoteStats] = await Promise.all([
        profileService.fetchProfile(userId),
        profileService.fetchStats(userId),
      ]);
      setRemote({ profile: row as Profile | null, stats: remoteStats });
    })();
  }, [isMe, userId]);

  const profile = isMe
    ? me
    : (remote.profile ?? (friend
      ? { ...me, id: friend.id, username: friend.username, avatar: friend.avatar, level: friend.level, chips: friend.chips }
      : me));
  const view = isMe ? stats : ({ ...stats, ...(remote.stats ?? {}) } as Stats);
  const playtimeSeconds = isMe
    ? (me.playtimeSeconds ?? 0)
    : ((remote.profile as { playtime_seconds?: number } | null)?.playtime_seconds ?? 0);

  /* Trophies on the shelf, graded bronze → platinum. The last id in
     `achievements` is the freshest unlock. */
  const earnedTrophies = useMemo(
    () => EVENT_TROPHIES.filter((entry) => achievements.includes(entry.id))
      .sort((a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || 0),
    [achievements],
  );
  const newestTrophyId = achievements[achievements.length - 1] ?? null;

  /* The closest one still missing, as a nudge under the shelf. Event trophies
     (no stat/goal) can't be "progressed toward", so they're never the nudge. */
  const nextTrophy = useMemo(() => {
    const locked = STAT_ACHIEVEMENTS.filter(
      (entry) => !achievements.includes(entry.id) && entry.stat && entry.goal,
    );
    const progress = (entry: (typeof ACHIEVEMENTS)[number]) => {
      const value = entry.stat === 'level'
        ? me.level
        : entry.stat === 'itemCount'
          ? owned.length
          : entry.stat === 'friendCount'
            ? friends.length
            : ((stats as unknown as Record<string, number>)[entry.stat as string] ?? 0);
      return value / (entry.goal ?? 1);
    };
    return locked.sort((a, b) => progress(b) - progress(a))[0] ?? null;
  }, [achievements, me.level, owned.length, friends.length, stats]);

  const roomBg = roomBackgroundOf(profile.equipped?.roomBackground ?? null);

  const winRate = pct(view.wins, Math.max(1, view.games));

  /* Per-game breakdown — only the fields that actually exist in Stats. Slots and
     scratch are deliberately left out of this section (§room rework). Roulette
     and baccarat keep no per-game counters, so they can't be shown. High card
     tracks plays only — no wins field — so it shows a play count, not a rate. */
  const perGame = ([
    { key: 'blackjack', plays: view.bjHands, wins: view.bjWins },
    { key: 'coinflip', plays: view.cfGames, wins: view.cfWins },
    { key: 'highcard', plays: view.hcGames, wins: undefined },
  ] as { key: GameKey; plays: number; wins?: number }[]).filter((row) => row.plays > 0);

  const prideStats = ([
    { label: t('games.duel'), value: view.duelWins },
    { label: t('profile.nightWins'), value: view.nightWins },
    { label: t('profile.royalFlushes'), value: view.royalFlushes },
    { label: t('profile.pokerWon'), value: view.pokerChipsWon },
    { label: t('profile.sngStreak'), value: view.sngWinStreak },
  ] as const).filter((row) => row.value > 0);
  const rank = rankOf(profile.level);
  const vip = isVipEligible(me);
  const vipProg = vipProgress(me);
  const nextMilestone = (Math.floor(me.lastMilestoneClaimed / MILESTONE_EVERY) + 1) * MILESTONE_EVERY;

  /* head-to-head, shown only for a friend's room (§86) — pulled from the real
     per-friend record, not from two unrelated lifetime win counts. */
  const rivalry = !isMe && friend ? (() => {
    const entry = rivalries.find((r) => r.friendId === friend.id);
    const byGame = Object.entries(entry?.byGame ?? {}) as [GameKey, { me: number; them: number }][];
    return {
      together: entry?.gamesTogether ?? 0, mine: entry?.myWins ?? 0, theirs: entry?.theirWins ?? 0,
      byGame: byGame.filter(([, g]) => g.me + g.them > 0).sort((a, b) => (b[1].me + b[1].them) - (a[1].me + a[1].them)),
    };
  })() : null;

  /* Every friend I have a recorded history with, worst rival first. */
  const rivalryTable = useMemo(
    () => friends
      .map((f) => ({ friend: f, entry: rivalries.find((r) => r.friendId === f.id) ?? null }))
      .filter((row) => row.entry && row.entry.gamesTogether > 0)
      .sort((a, b) => (b.entry!.gamesTogether) - (a.entry!.gamesTogether)),
    [friends, rivalries],
  );

  return (
    <SceneShell compactHud>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: roomBg.gradient }} />
        <LightPool x="50%" y="16%" size={640} color={roomBg.glowColor} />
      </div>

      <div className="mx-auto px-4 py-3 flex flex-col gap-3" style={{ maxWidth: 900 }}>
        {/* the room itself */}
        <GlassPanel gold className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
              <Avatar config={profile.avatar} size={86} level={profile.level} frame={profile.equipped?.frame} presence={isMe ? 'online' : friend?.presence} id="myroom" />
            </motion.div>
            <div className="flex-1 min-w-[180px]">
              <span className="eyebrow">{lang === 'he' ? rank.he : rank.en}</span>
              <h1 className="mt-0.5">{profile.username}</h1>
              <p className="text-[12.5px] num" style={{ color: 'var(--muted)' }}>
                {profile.tag} · {t('profile.joined')} {shortDate(profile.joinedAt ?? new Date().toISOString(), lang)}
              </p>
              {playtimeSeconds > 0 && (
                <p className="text-[12px] num mt-0.5" style={{ color: 'var(--muted)' }}>
                  {t('profile.totalPlaytime')}: {formatPlaytime(playtimeSeconds, lang)}
                </p>
              )}
              {isMe && (
                <button
                  className="mt-2 px-2.5 py-1 rounded-full text-[11.5px] press"
                  style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted)', border: '1px solid var(--glass-line)' }}
                  onClick={() => setEditAvatarOpen(true)}
                >
                  🎨 {t('avatar.editTitle')}
                </button>
              )}
            </div>
            <div className="min-w-[190px] flex-1">
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--muted)' }}>{t('common.level')} {profile.level}</span>
                <b className="num" style={{ color: 'var(--gold)' }}>{fmt(profile.xp)} / {fmt(xpForLevel(profile.level))}</b>
              </div>
              <Meter value={profile.xp} max={xpForLevel(profile.level)} />
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-[11.5px] num" style={{ background: 'rgba(227,178,60,.1)', color: 'var(--gold)' }}>
                  {chipGlyphOf(profile.equipped.currencySkin)} {fmt(profile.chips)}
                </span>
                {profile.favoriteGame && (
                  <span className="px-2.5 py-1 rounded-full text-[11.5px]" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted)' }}>
                    ⭐ {t(`games.${profile.favoriteGame}`)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>

        {isMe && (
          <GlassPanel gold={vip} className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="eyebrow" style={vip ? { color: 'var(--gold-hi)' } : undefined}>{t('profile.vip')}</div>
              {vip && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-[.12em]"
                  style={{
                    background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))',
                    color: '#1a1206',
                  }}
                >
                  👑 VIP
                </span>
              )}
            </div>

            {vip ? (
              <div className="flex items-center gap-3">
                <div className="text-[42px] leading-none">👑</div>
                <div className="flex-1">
                  <b className="block text-[14px]" style={{ color: 'var(--gold-hi)' }}>
                    {t('profile.vipActive')}
                  </b>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {t('profile.vipPerks')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
                  {t('profile.vipLockedHint')}
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span>{vipProg.level.done ? '✅' : '⏳'} {t('vip.reqLevel')}</span>
                      <b className="num" style={{ color: vipProg.level.done ? 'var(--gold-hi)' : 'var(--muted)' }}>
                        {me.level} / {VIP_MIN_LEVEL}
                      </b>
                    </div>
                    <Meter value={me.level} max={VIP_MIN_LEVEL} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span>{vipProg.chips.done ? '✅' : '⏳'} {t('vip.reqChips')}</span>
                      <b className="num" style={{ color: vipProg.chips.done ? 'var(--gold-hi)' : 'var(--muted)' }}>
                        {me.chips.toLocaleString()} / {VIP_MIN_CHIPS.toLocaleString()}
                      </b>
                    </div>
                    <Meter value={me.chips} max={VIP_MIN_CHIPS} />
                  </div>
                </div>
              </>
            )}

            <div className="mt-3 pt-3 flex items-center gap-2.5" style={{ borderTop: '1px solid var(--glass-line)' }}>
              <span className="text-[20px]">🎁</span>
              <div className="flex-1 min-w-0">
                <b className="block text-[12px]">{t('profile.vipMilestone', { level: nextMilestone })}</b>
                <span className="block text-[10.5px]" style={{ color: 'var(--dim)' }}>{t('profile.vipMilestoneHint')}</span>
              </div>
            </div>
          </GlassPanel>
        )}


        {rivalry && (
          <GlassPanel className="p-4">
            <div className="eyebrow text-center mb-3">{t('profile.rivalry')}</div>
            <div className="flex items-center justify-center gap-5">
              <div className="text-center">
                <Avatar config={me.avatar} size={44} level={me.level} id="riv-me" />
                <b className="block num mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--gold-hi)' }}>{rivalry.mine}</b>
              </div>
              <span className="text-[13px] font-black" style={{ color: 'var(--muted)' }}>{t('common.vs')}</span>
              <div className="text-center">
                <Avatar config={profile.avatar} size={44} level={profile.level} id="riv-them" />
                <b className="block num mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--gold-hi)' }}>{rivalry.theirs}</b>
              </div>
            </div>
            <p className="text-center text-[12.5px] mt-2" style={{ color: 'var(--muted)' }}>
              {rivalry.mine === rivalry.theirs
                ? t('profile.tied')
                : t('profile.leads', {
                  name: rivalry.mine > rivalry.theirs ? me.username : profile.username,
                  n: Math.abs(rivalry.mine - rivalry.theirs),
                })}
            </p>
            {rivalry.byGame.length > 0 && (
              <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--glass-line)' }}>
                {rivalry.byGame.map(([game, g]) => {
                  const total = g.me + g.them;
                  const rate = pct(g.me, total);
                  return (
                    <div key={game} className="flex items-center gap-3 text-[12.5px]">
                      <span className="flex-1 truncate" style={{ color: 'var(--muted)' }}>{t(`games.${game}`)}</span>
                      <span className="text-[10.5px] num" style={{ color: 'var(--dim)' }}>{total} {t('profile.together')}</span>
                      <b className="num" style={{ color: g.me > g.them ? 'var(--jade-hi)' : g.me < g.them ? 'var(--crimson-hi)' : 'var(--muted)', minWidth: 46, textAlign: 'end' }}>
                        {g.me}–{g.them}
                      </b>
                      <span className="num text-[11px]" style={{ color: 'var(--gold)', minWidth: 34, textAlign: 'end' }}>{rate}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        )}

        {/* THE trophy case — the centrepiece of the room */}
        <GlassPanel gold className="p-5">
          <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="eyebrow">{t('profile.trophies')}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <b className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--gold-hi)' }}>
                  {earnedTrophies.length}
                </b>
                <span className="num text-[13px]" style={{ color: 'var(--dim)' }}>/ {EVENT_TROPHIES.length}</span>
              </div>
            </div>
            <div className="flex-1 min-w-[140px] max-w-[260px]">
              <Meter value={earnedTrophies.length} max={EVENT_TROPHIES.length} />
            </div>
          </div>

          {earnedTrophies.length ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {earnedTrophies.map((entry, index) => {
                const style = TIER_STYLE[entry.tier];
                const fresh = entry.id === newestTrophyId;
                return (
                  <motion.div
                    key={entry.id}
                    className="shrink-0 text-center"
                    style={{ width: 100 }}
                    initial={{ opacity: 0, y: 16, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.04, type: 'spring', stiffness: 240, damping: 22 }}
                    whileHover={{ y: -6 }}
                    title={`${entry.name[lang]} — ${entry.desc[lang]}`}
                  >
                    <motion.div
                      className="grid place-items-center mx-auto"
                      style={{
                        width: 72, height: 72, borderRadius: '50%', fontSize: 32,
                        background: `radial-gradient(circle at 38% 30%, ${style.glow}, rgba(0,0,0,.38) 72%)`,
                        border: `2px solid ${style.ring}`,
                      }}
                      animate={fresh
                        ? { boxShadow: [`0 6px 18px ${style.glow}`, `0 6px 30px ${style.ring}`, `0 6px 18px ${style.glow}`] }
                        : { boxShadow: `0 6px 18px ${style.glow}` }}
                      transition={fresh ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                    >
                      {entry.trophy}
                    </motion.div>
                    <div className="text-[11px] font-bold mt-2 leading-tight" style={{ color: 'var(--text)' }}>
                      {entry.name[lang]}
                    </div>
                    <div className="text-[9px] uppercase tracking-[.14em] mt-0.5" style={{ color: style.ring }}>
                      {style.label[lang]}
                    </div>
                    <div className="num text-[10px] mt-0.5" style={{ color: 'var(--gold-hi)' }}>
                      +{fmt(entry.reward)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] py-5 text-center" style={{ color: 'var(--muted)' }}>{t('profile.noTrophies')}</p>
          )}

          {/* The shelf fills up as achievements unlock; the next one is the nudge. */}
          {isMe && nextTrophy && (
            <div className="mt-4 pt-3 flex items-center gap-2.5" style={{ borderTop: '1px solid var(--glass-line)' }}>
              <span className="text-[20px] grayscale opacity-60">{nextTrophy.trophy}</span>
              <div className="flex-1 min-w-0">
                <b className="block text-[12px]">{nextTrophy.name[lang]}</b>
                <span className="block text-[10.5px]" style={{ color: 'var(--dim)' }}>{nextTrophy.desc[lang]}</span>
              </div>
              <span className="text-[10px] uppercase tracking-[.14em]" style={{ color: TIER_STYLE[nextTrophy.tier].ring }}>
                {TIER_STYLE[nextTrophy.tier].label[lang]}
              </span>
            </div>
          )}

        </GlassPanel>

        {/* Achievements — the 31 stat trophies, as a checklist the player can
            choose to chase. Each shows the chip reward it pays + progress. */}
        {isMe && (
          <GlassPanel className="p-4">
            <button
              className="w-full flex items-baseline justify-between gap-2 press"
              onClick={() => setAllAchOpen((v) => !v)}
            >
              <div className="text-start">
                <div className="eyebrow">{t('profile.achievements')}</div>
                <span className="block text-[10.5px] mt-0.5" style={{ color: 'var(--dim)' }}>{t('profile.achHint')}</span>
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <span className="num text-[13px]" style={{ color: 'var(--gold-hi)' }}>
                  {STAT_ACHIEVEMENTS.filter((a) => achievements.includes(a.id)).length}
                  <span style={{ color: 'var(--dim)' }}> / {STAT_ACHIEVEMENTS.length}</span>
                </span>
                <span className="text-[12px]" style={{ color: 'var(--gold-hi)' }}>{allAchOpen ? '▲' : '▼'}</span>
              </span>
            </button>
            {allAchOpen && (
              <div className="grid gap-2.5 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
                {STAT_ACHIEVEMENTS.map((achievement) => {
                  const unlocked = achievements.includes(achievement.id);
                  const goal = achievement.goal ?? 1;
                  const value = achievement.stat === 'level' ? me.level
                    : achievement.stat === 'itemCount' ? owned.length
                      : achievement.stat === 'friendCount' ? friends.length
                        : (stats as unknown as Record<string, number>)[achievement.stat as string] ?? 0;
                  return (
                    <div key={achievement.id} className="p-3 rounded-[var(--r-sm)]"
                      style={{ background: unlocked ? 'rgba(227,178,60,.08)' : 'rgba(255,255,255,.025)', border: '1px solid var(--glass-line)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[16px]">{unlocked ? achievement.trophy : '🔒'}</span>
                        <b className="text-[13px] flex-1">{achievement.name[lang]}</b>
                        <span className="num text-[11px] shrink-0" style={{ color: 'var(--gold-hi)' }}>+{fmt(achievement.reward)}</span>
                      </div>
                      <p className="text-[11.5px] mb-2" style={{ color: 'var(--muted)' }}>{achievement.desc[lang]}</p>
                      <Meter value={Math.min(value, goal)} max={goal} height={5} tone={unlocked ? 'gold' : 'jade'} />
                      <div className="num text-[10px] mt-1 text-end" style={{ color: 'var(--dim)' }}>
                        {unlocked ? `✅ ${t('profile.eventEarned')}` : `${fmt(Math.min(value, goal))} / ${fmt(goal)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        )}

        {/* My best — the pride card, shown for me and for a friend's room */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-3">{t('profile.myBest')}</div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            <StatTile label={t('profile.biggestWin')} value={view.biggestWin} tone="jade" delay={0.02} />
            <StatTile label={t('profile.biggestBet')} value={view.biggestBet} delay={0.05} />
            <StatTile label={t('profile.bestStreak')} value={view.bestStreak} delay={0.08} />
            <StatTile label={t('profile.blackjacks')} value={view.blackjacks} delay={0.11} />
          </div>
        </GlassPanel>

        {/* head-to-head against every friend I've actually played (§rivalry) */}
        {isMe && (
          <GlassPanel className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="eyebrow">{t('profile.rivalryTable')}</div>
              {rivalryTable.length > 0 && (
                <span className="text-[11.5px] num" style={{ color: 'var(--muted)' }}>{rivalryTable.length}</span>
              )}
            </div>
            {rivalryTable.length ? (
              <div className="flex flex-col gap-1.5">
                {rivalryTable.map(({ friend: f, entry }) => (
                  <button
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-xs)] text-[13px] text-start press w-full"
                    style={{ background: 'rgba(255,255,255,.03)' }}
                    onClick={() => navigate(`/profile/${f.id}`)}
                  >
                    <Avatar config={f.avatar} size={30} level={f.level} presence={f.presence} id={`rt-${f.id}`} />
                    <b className="flex-1 truncate">{f.username}</b>
                    <span className="text-[11px] num" style={{ color: 'var(--dim)' }}>
                      {entry!.gamesTogether} {t('profile.together')}
                    </span>
                    <b className="num" style={{ color: entry!.myWins > entry!.theirWins ? 'var(--jade-hi)' : entry!.myWins < entry!.theirWins ? 'var(--crimson-hi)' : 'var(--muted)' }}>
                      {entry!.myWins}–{entry!.theirWins}
                    </b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] py-4 text-center" style={{ color: 'var(--muted)' }}>{t('profile.noRivalries')}</p>
            )}
          </GlassPanel>
        )}

        {/* the numbers */}
        <GlassPanel className="p-4">
          <div className="eyebrow mb-3">{t('profile.stats')}</div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
            <StatTile label={t('profile.games')} value={view.games} delay={0.02} />
            <StatTile label={t('profile.wins')} value={view.wins} tone="jade" delay={0.04} />
            <StatTile label={t('profile.losses')} value={view.losses} delay={0.06} />
            <StatTile label={t('profile.winRate')} value={winRate} delay={0.08} />
            <StatTile label={t('profile.handsPlayed')} value={view.bjHands} delay={0.1} />
            <StatTile label={t('profile.doubleWins')} value={view.doubleWins} delay={0.12} />
            <StatTile label={t('profile.splitWins')} value={view.splitWins} delay={0.14} />
            <StatTile label={t('profile.avgBet')} value={view.betCount ? Math.round(view.betTotal / view.betCount) : 0} delay={0.16} />
          </div>

          {perGame.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--glass-line)' }}>
              <div className="eyebrow mb-2" style={{ fontSize: 10 }}>{t('profile.byGame')}</div>
              <div className="flex flex-col gap-1.5">
                {perGame.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 text-[12.5px]">
                    <span className="flex-1 truncate" style={{ color: 'var(--muted)' }}>{t(`games.${row.key}`)}</span>
                    {row.wins !== undefined ? (
                      <>
                        <span className="num text-[10.5px]" style={{ color: 'var(--dim)' }}>{fmt(row.wins)} / {fmt(row.plays)}</span>
                        <div className="w-20"><Meter value={row.wins} max={row.plays} height={5} tone="jade" /></div>
                        <b className="num" style={{ color: 'var(--gold-hi)', minWidth: 40, textAlign: 'end' }}>{pct(row.wins, row.plays)}</b>
                      </>
                    ) : (
                      <span className="num text-[11px]" style={{ color: 'var(--dim)' }}>{fmt(row.plays)} {t('profile.plays')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prideStats.length > 0 && (
            <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--glass-line)' }}>
              {prideStats.map((row) => (
                <span key={row.label} className="px-2.5 py-1 rounded-full text-[11.5px]"
                  style={{ background: 'rgba(255,255,255,.045)', border: '1px solid var(--glass-line)' }}>
                  <span style={{ color: 'var(--muted)' }}>{row.label}</span>{' '}
                  <b className="num" style={{ color: 'var(--gold-hi)' }}>{fmt(row.value)}</b>
                </span>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* recent hands */}
        {isMe && (
          <GlassPanel className="p-4">
            <div className="eyebrow mb-3">{t('profile.recent')}</div>
            {activity.length ? (
              <div className="flex flex-col gap-1.5">
                {activity.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-[var(--r-xs)] text-[13px]"
                    style={{ background: 'rgba(255,255,255,.03)' }}>
                    <span>{t(`games.${entry.game}`)}</span>
                    <b className="num" style={{ color: entry.net > 0 ? 'var(--jade-hi)' : entry.net < 0 ? 'var(--crimson-hi)' : 'var(--muted)' }}>
                      {fmtSigned(entry.net)}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] py-4 text-center" style={{ color: 'var(--muted)' }}>{t('profile.empty')}</p>
            )}
          </GlassPanel>
        )}

        <div className="flex gap-2.5">
          <GameButton tone="gold" block onClick={() => navigate('/vault')}>{t('vault.title')}</GameButton>
          <GameButton tone="ghost" block onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
        </div>
      </div>

      <AvatarEditor open={editAvatarOpen} onClose={() => setEditAvatarOpen(false)} />
    </SceneShell>
  );
}
