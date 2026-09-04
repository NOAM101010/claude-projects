import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useUI } from '@/stores/useUI';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { fmt, todayKey } from '@/lib/format';
import { computeDailyStats, computePerGameBreakdown } from '@/lib/walletStats';
import { chipGlyphOf } from '@/components/game/CoinFace';
import type { GameKey } from '@/types';

const GAME_ICON: Record<GameKey, string> = {
  blackjack: '🃏',
  coinflip: '🪙',
  slots: '🎰',
  scratch: '🎫',
  highcard: '🂡',
  highlow: '📈',
  poker: '♠️',
  sng: '🏆',
  roulette: '🎡',
  duel: '⚔️',
  baccarat: '🎴',
};

export function ChipsPanel() {
  const panel = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const { t } = useT();
  const navigate = useNavigate();
  const chips = usePlayer((s) => s.profile.chips);
  const currencySkin = usePlayer((s) => s.profile.equipped.currencySkin);
  const chipGlyph = chipGlyphOf(currencySkin);
  const daily = usePlayer((s) => s.daily);
  const activity = usePlayer((s) => s.activity);

  const dailyReady = daily.lastClaim !== todayKey();

  const stats = useMemo(() => computeDailyStats(activity), [activity]);
  const perGame = useMemo(() => computePerGameBreakdown(activity), [activity]);

  const netColor = stats.net > 0
    ? 'var(--jade-hi)'
    : stats.net < 0
      ? 'var(--crimson-hi)'
      : 'var(--muted)';
  const netPrefix = stats.net > 0 ? '+' : '';

  return (
    <Modal
      open={panel === 'chips'}
      onClose={() => openPanel(null)}
      title={t('wallet.title')}
      subtitle={t('wallet.subtitle')}
    >
      {/* Big balance display */}
      <div className="text-center mb-4">
        <div className="eyebrow">{t('hud.balance')}</div>
        <b className="num" style={{ fontSize: 38, fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>
          {chipGlyph} {fmt(chips)}
        </b>
      </div>

      {/* Today's Net card */}
      <div
        className="p-4 rounded-[var(--r-sm)] mb-3 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(227,178,60,.08), rgba(74,168,200,.05))',
          border: '1px solid var(--glass-line)',
        }}
      >
        <div className="eyebrow mb-1">{t('wallet.today')}</div>
        <b
          className="num"
          style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: netColor }}
        >
          {netPrefix}{fmt(stats.net)}
        </b>
        {stats.gameCount > 0 && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--dim)' }}>
            {t('wallet.gamesPlayed', { count: stats.gameCount })}
          </p>
        )}
      </div>

      {/* Won/Lost breakdown */}
      {stats.gameCount > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className="p-3 rounded-[var(--r-xs)] text-center"
            style={{ background: 'rgba(46,158,107,.10)', border: '1px solid rgba(46,158,107,.35)' }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--jade-hi)' }}>
              {t('wallet.won')}
            </div>
            <b className="num text-[16px]" style={{ color: 'var(--jade-hi)' }}>
              +{fmt(stats.won)}
            </b>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {stats.wins} {t('wallet.wins')}
            </div>
          </div>
          <div
            className="p-3 rounded-[var(--r-xs)] text-center"
            style={{ background: 'rgba(168,65,62,.10)', border: '1px solid rgba(168,65,62,.35)' }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--crimson-hi)' }}>
              {t('wallet.lost')}
            </div>
            <b className="num text-[16px]" style={{ color: 'var(--crimson-hi)' }}>
              -{fmt(stats.lost)}
            </b>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {stats.losses} {t('wallet.losses')}
            </div>
          </div>
        </div>
      )}

      {/* Biggest win / biggest loss */}
      {(stats.biggestWin > 0 || stats.biggestLoss > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {stats.biggestWin > 0 && (
            <div
              className="p-2.5 rounded-[var(--r-xs)] flex items-center justify-between"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
            >
              <div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>🏆 {t('wallet.biggestWin')}</div>
                <b className="num text-[13px]" style={{ color: 'var(--gold-hi)' }}>+{fmt(stats.biggestWin)}</b>
              </div>
            </div>
          )}
          {stats.biggestLoss > 0 && (
            <div
              className="p-2.5 rounded-[var(--r-xs)] flex items-center justify-between"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
            >
              <div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>💔 {t('wallet.biggestLoss')}</div>
                <b className="num text-[13px]" style={{ color: 'var(--crimson-hi)' }}>-{fmt(stats.biggestLoss)}</b>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-game breakdown */}
      {perGame.length > 0 && (
        <div className="mb-3">
          <div className="eyebrow mb-2" style={{ fontSize: 10 }}>{t('wallet.byGame')}</div>
          <div className="flex flex-col gap-1.5">
            {perGame.map((entry) => {
              const positive = entry.net >= 0;
              return (
                <div
                  key={entry.game}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--r-xs)]"
                  style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}
                >
                  <span className="text-[18px]">{GAME_ICON[entry.game] ?? '🎮'}</span>
                  <div className="flex-1">
                    <div className="text-[12px] font-bold">{t(`games.${entry.game}`)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--dim)' }}>
                      {entry.gameCount} · {entry.wins}W / {entry.losses}L
                    </div>
                  </div>
                  <b
                    className="num text-[13px]"
                    style={{ color: positive ? 'var(--jade-hi)' : 'var(--crimson-hi)' }}
                  >
                    {positive ? '+' : ''}{fmt(entry.net)}
                  </b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.gameCount === 0 && (
        <p className="text-center text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
          {t('wallet.empty')}
        </p>
      )}

      {/* Ways to get more chips */}
      <div className="eyebrow mb-2 mt-4" style={{ fontSize: 10 }}>{t('wallet.getMore')}</div>
      <div className="grid grid-cols-2 gap-2.5">
        <GameButton tone={dailyReady ? 'gold' : 'ghost'} onClick={() => { openPanel(null); navigate('/hub?gift=1'); }}>
          🎁 {dailyReady ? t('hub.giftReady') : t('hub.giftTaken')}
        </GameButton>
        <GameButton tone="jade" onClick={() => { openPanel(null); navigate('/game/scratch'); }}>
          🎫 {t('games.freeCard')}
        </GameButton>
        <GameButton tone="metal" onClick={() => { openPanel(null); navigate('/game/coinflip'); }}>
          🪙 {t('games.coinflip')}
        </GameButton>
        <GameButton tone="metal" onClick={() => { openPanel(null); navigate('/blackjack/solo'); }}>
          🃏 {t('blackjack.title')}
        </GameButton>
      </div>
    </Modal>
  );
}
