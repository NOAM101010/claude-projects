import { useEffect } from 'react'
import { useVip, VIP_CLUB, VIP_PASS_COST } from '../state/useVip'
import { useDiamonds } from '../state/useDiamonds'
import { useWallet } from '../state/useWallet'
import { useCosmetics } from '../state/useCosmetics'
import { useApp, GameId } from '../state/useApp'
import { useOverlay } from '../state/useOverlay'
import { vipTiers } from '../progression/levels'
import { playSfx } from '../audio/sfx'
import { t } from '../i18n/he'

/**
 * VIP club: a loyalty ladder (Silver→Diamond) earned by lifetime wagering, with
 * escalating perks, plus the high-limit salon (roulette/slots) for members.
 */
export default function VipPanel({ onClose }: { onClose: () => void }) {
  const tierIndex = useVip(s => s.tierIndex())
  const hasAccess = useVip(s => s.hasAccess())
  const hasPass = useVip(s => s.hasPass)
  const buyPass = useVip(s => s.buyPass)
  const diamonds = useDiamonds(s => s.diamonds)
  const wagered = useWallet(s => s.totalWagered)
  const setFelt = useCosmetics(s => s.setFeltTheme)
  const grantFelt = useCosmetics(s => s.grantFelt)
  const enterGame = useApp(s => s.enterGame)
  const closeOverlay = useOverlay(s => s.close)

  const tier = VIP_CLUB[tierIndex]
  const next = VIP_CLUB[tierIndex + 1] ?? null

  // Grant the current tier's exclusive cosmetic (idempotent).
  useEffect(() => {
    if (tier.exclusiveFelt) grantFelt(tier.exclusiveFelt)
  }, [tier.exclusiveFelt, grantFelt])

  const enter = (game: GameId) => {
    grantFelt('vip')
    setFelt('vip')
    closeOverlay()
    enterGame(game, { vip: true })
  }

  const emojiFor: Record<string, string> = { roulette: '🎡', slots: '🎰', blackjack: '🃏' }
  const labelFor: Record<string, string> = { roulette: t('roulette'), slots: t('slots'), blackjack: t('blackjack') }
  const vipGames = vipTiers().map(vt => ({
    game: vt.game as GameId,
    label: labelFor[vt.game] ?? vt.game,
    emoji: emojiFor[vt.game] ?? '👑',
    minBet: vt.minBet,
  }))

  // Progress within the current tier band toward the next threshold.
  const bandStart = tier.minWagered
  const bandEnd = next?.minWagered ?? tier.minWagered
  const frac = next ? Math.min(1, Math.max(0, (wagered - bandStart) / (bandEnd - bandStart))) : 1

  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('he-IL', { maximumFractionDigits: 1 })}M` : n.toLocaleString('he-IL'))

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-gold/50 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #241a06, #0a0608)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="lux-shimmer font-display text-2xl font-bold">👑 {t('vip')}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>

        {/* Current club tier + progress to the next */}
        <div className="mb-5 rounded-2xl border border-gold/30 bg-black/40 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">מועדון VIP</span>
            <span className="font-display text-lg font-bold" style={{ color: tier.color }}>
              {tierIndex === 0 ? 'ללא דרגה' : `דרגת ${tier.name}`}
            </span>
          </div>
          {next ? (
            <>
              <div className="my-2 h-2 overflow-hidden rounded-full bg-black/50">
                <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: next.color }} />
              </div>
              <div className="text-[11px] text-white/50">
                הומרו {fmt(wagered)} — עוד {fmt(Math.max(0, bandEnd - wagered))} לדרגת {next.name}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-gold/70">הגעת לדרגה הגבוהה ביותר 💎</div>
          )}
          {tierIndex >= 1 && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-sky-500/15 px-2 py-1 text-sky-200">💎 יהלומים ×{tier.diamondBonus}</span>
              <span className="rounded-full bg-gold/15 px-2 py-1 text-gold">🪙 בונוס קופה +{Math.round(tier.cashierBonus * 100)}%</span>
            </div>
          )}
        </div>

        {hasAccess ? (
          <>
            <p className="mb-3 text-sm text-gold/80">סלון הרולר-הגבוה — מינימום כניסה גבוה, פלט זהב-שיש בלעדי.</p>
            <div className="grid grid-cols-2 gap-3">
              {vipGames.map(g => (
                <button
                  key={g.game}
                  onClick={() => enter(g.game)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-gold/40 bg-black/40 p-5 transition hover:border-gold"
                >
                  <span className="text-4xl">{g.emoji}</span>
                  <span className="font-display text-lg font-bold text-gold">{g.label}</span>
                  <span className="text-[11px] text-white/50">{t('minEntry')} {g.minBet.toLocaleString('he-IL')}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-white/70">
              דרגת {VIP_CLUB[1].name} נפתחת בהמרה של {fmt(VIP_CLUB[1].minWagered)} סה"כ — או קנה כרטיס VIP קבוע ביהלומים.
            </p>
            <button
              onClick={() => { if (buyPass()) playSfx('win') }}
              disabled={hasPass || diamonds < VIP_PASS_COST}
              className="lux-gold w-full rounded-2xl py-3.5 font-display text-lg font-bold disabled:opacity-40"
            >
              {t('buyVipPass')} · {VIP_PASS_COST} 💎
            </button>
            {diamonds < VIP_PASS_COST && (
              <p className="mt-2 text-center text-xs text-white/40">
                יש לך {diamonds} 💎 — צריך עוד {VIP_PASS_COST - diamonds}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
