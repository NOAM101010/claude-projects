import { useState } from 'react'
import {
  FELT_THEMES, CHIP_SKINS, CARD_BACKS, AVATAR_FRAMES, TITLES,
  useCosmetics, Rarity, FeltTheme, ChipSkin, CardBack, AvatarFrame, Title, BuyResult,
} from '../state/useCosmetics'
import { useProgress } from '../progression/useProgress'
import { useWallet } from '../state/useWallet'
import { useDiamonds } from '../state/useDiamonds'
import { CHIP_VALUES } from '../scene/models'
import { playSfx } from '../audio/sfx'
import { t } from '../i18n/he'

const RARITY_LABEL: Record<Rarity, string> = {
  common: t('rarityCommon'),
  rare: t('rarityRare'),
  legendary: t('rarityLegendary'),
}
const RARITY_COLOR: Record<Rarity, string> = {
  common: 'text-white/50 border-white/15',
  rare: 'text-sky-300 border-sky-400/40',
  legendary: 'text-amber-300 border-amber-400/50',
}

function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RARITY_COLOR[rarity]}`}>
      {RARITY_LABEL[rarity]}
    </span>
  )
}

/** Buy / equip control shared by both catalogues. */
function ActionButton({
  owned, active, unlockLevel, cost, gemCost, level, coins, gems, onEquip, onBuy,
}: {
  owned: boolean
  active: boolean
  unlockLevel: number
  cost: number
  gemCost: number
  level: number
  coins: number
  gems: number
  onEquip: () => void
  onBuy: () => void
}) {
  if (owned) {
    return active ? (
      <span className="rounded-xl bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold">✓ {t('equipped')}</span>
    ) : (
      <button onClick={onEquip} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20">
        {t('equip')}
      </button>
    )
  }
  if (level < unlockLevel) {
    return <span className="rounded-xl bg-black/40 px-3 py-1.5 text-[11px] font-bold text-white/50">🔒 {t('needLevel')} {unlockLevel}</span>
  }
  const gem = gemCost > 0
  const canAfford = gem ? gems >= gemCost : coins >= cost
  const priceLabel = gem
    ? `${gemCost} 💎`
    : `${cost >= 1000 ? `${Math.round(cost / 1000)}K` : cost} 🪙`
  return (
    <button
      onClick={onBuy}
      disabled={!canAfford}
      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
        gem ? 'bg-amber-400/90 text-black hover:brightness-110' : 'bg-gold/90 text-black hover:brightness-110'
      }`}
    >
      {t('buy')} · {priceLabel}
    </button>
  )
}

export default function SkinsPanel({ onClose }: { onClose: () => void }) {
  const feltTheme = useCosmetics(s => s.feltTheme)
  const chipSkin = useCosmetics(s => s.chipSkin)
  const cardBack = useCosmetics(s => s.cardBack)
  const avatarFrame = useCosmetics(s => s.avatarFrame)
  const title = useCosmetics(s => s.title)
  const ownedFelts = useCosmetics(s => s.ownedFelts)
  const ownedChips = useCosmetics(s => s.ownedChips)
  const ownedBacks = useCosmetics(s => s.ownedBacks)
  const ownedFrames = useCosmetics(s => s.ownedFrames)
  const ownedTitles = useCosmetics(s => s.ownedTitles)
  const setFeltTheme = useCosmetics(s => s.setFeltTheme)
  const setChipSkin = useCosmetics(s => s.setChipSkin)
  const setCardBackSkin = useCosmetics(s => s.setCardBackSkin)
  const setAvatarFrame = useCosmetics(s => s.setAvatarFrame)
  const setTitle = useCosmetics(s => s.setTitle)
  const buyFelt = useCosmetics(s => s.buyFelt)
  const buyChip = useCosmetics(s => s.buyChip)
  const buyBack = useCosmetics(s => s.buyBack)
  const buyFrame = useCosmetics(s => s.buyFrame)
  const buyTitle = useCosmetics(s => s.buyTitle)
  const level = useProgress(s => s.level())
  const coins = useWallet(s => s.balance)
  const gems = useDiamonds(s => s.diamonds)
  const [msg, setMsg] = useState<string | null>(null)

  const handleBuy = (res: BuyResult) => {
    if (res === 'ok') { playSfx('win'); setMsg(null) }
    else if (res === 'poor-coins' || res === 'poor-gems') setMsg(t('notEnough'))
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">{t('skins')}</h2>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="text-gold">{coins >= 1000 ? `${Math.round(coins / 1000)}K` : coins} 🪙</span>
            <span className="text-sky-300">{gems} 💎</span>
            <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
              {t('close')}
            </button>
          </div>
        </div>

        {msg && <div className="mb-3 rounded-xl bg-red-500/20 px-3 py-2 text-center text-sm font-bold text-red-200">{msg}</div>}

        {/* Felt themes */}
        <div className="mb-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('feltTheme')}</div>
          <div className="grid grid-cols-2 gap-3">
            {FELT_THEMES.map((felt: FeltTheme) => {
              const owned = ownedFelts.includes(felt.id)
              const active = felt.id === feltTheme
              return (
                <div
                  key={felt.id}
                  className={`overflow-hidden rounded-2xl border p-3 ${active ? 'border-gold ring-2 ring-gold/60' : 'border-white/10'}`}
                >
                  <div className="mb-2 h-12 rounded-lg" style={{ background: felt.felt, borderBottom: `3px solid ${felt.accent}` }} />
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-white">{felt.name}</span>
                    <RarityTag rarity={felt.rarity} />
                  </div>
                  <ActionButton
                    owned={owned} active={active} unlockLevel={felt.unlockLevel}
                    cost={felt.cost} gemCost={felt.gemCost} level={level} coins={coins} gems={gems}
                    onEquip={() => setFeltTheme(felt.id)}
                    onBuy={() => handleBuy(buyFelt(felt.id))}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Chip skins */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('chipSkin')}</div>
          <div className="space-y-2">
            {CHIP_SKINS.map((skin: ChipSkin) => {
              const owned = ownedChips.includes(skin.id)
              const active = skin.id === chipSkin
              return (
                <div
                  key={skin.id}
                  className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${active ? 'border-gold ring-2 ring-gold/60' : 'border-white/10'}`}
                >
                  <div className="flex gap-1">
                    {CHIP_VALUES.slice(0, 6).map(v => (
                      <span key={v} className="h-5 w-5 rounded-full border border-white/40" style={{ background: skin.colors[v] }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{skin.name}</div>
                      <RarityTag rarity={skin.rarity} />
                    </div>
                    <ActionButton
                      owned={owned} active={active} unlockLevel={skin.unlockLevel}
                      cost={skin.cost} gemCost={skin.gemCost} level={level} coins={coins} gems={gems}
                      onEquip={() => setChipSkin(skin.id)}
                      onBuy={() => handleBuy(buyChip(skin.id))}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card backs */}
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('cardBack')}</div>
          <div className="grid grid-cols-3 gap-3">
            {CARD_BACKS.map((b: CardBack) => {
              const owned = ownedBacks.includes(b.id)
              const active = b.id === cardBack
              return (
                <div key={b.id} className={`rounded-2xl border p-2 text-center ${active ? 'border-gold ring-2 ring-gold/60' : 'border-white/10'}`}>
                  <div className="mx-auto mb-2 grid h-16 w-12 place-items-center rounded-md" style={{ background: b.back.base, border: `2px solid ${b.back.accent}` }}>
                    <span className="text-xs font-bold" style={{ color: b.back.accent }}>BJ</span>
                  </div>
                  <div className="mb-1 truncate text-[11px] font-bold text-white">{b.name}</div>
                  <div className="mb-1 flex justify-center"><RarityTag rarity={b.rarity} /></div>
                  <ActionButton
                    owned={owned} active={active} unlockLevel={b.unlockLevel}
                    cost={b.cost} gemCost={b.gemCost} level={level} coins={coins} gems={gems}
                    onEquip={() => setCardBackSkin(b.id)}
                    onBuy={() => handleBuy(buyBack(b.id))}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Avatar frames */}
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('avatarFrame')}</div>
          <div className="grid grid-cols-3 gap-3">
            {AVATAR_FRAMES.map((f: AvatarFrame) => {
              const owned = ownedFrames.includes(f.id)
              const active = f.id === avatarFrame
              return (
                <div key={f.id} className={`rounded-2xl border p-2 text-center ${active ? 'border-gold ring-2 ring-gold/60' : 'border-white/10'}`}>
                  <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/5 text-xl" style={{ boxShadow: f.ring }}>🤵</div>
                  <div className="mb-1 truncate text-[11px] font-bold text-white">{f.name}</div>
                  <div className="mb-1 flex justify-center"><RarityTag rarity={f.rarity} /></div>
                  <ActionButton
                    owned={owned} active={active} unlockLevel={f.unlockLevel}
                    cost={f.cost} gemCost={f.gemCost} level={level} coins={coins} gems={gems}
                    onEquip={() => setAvatarFrame(f.id)}
                    onBuy={() => handleBuy(buyFrame(f.id))}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Titles */}
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('playerTitle')}</div>
          <div className="space-y-2">
            {TITLES.map((ti: Title) => {
              const owned = ownedTitles.includes(ti.id)
              const active = ti.id === title
              return (
                <div key={ti.id} className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${active ? 'border-gold ring-2 ring-gold/60' : 'border-white/10'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-gold">{ti.name}</span>
                    <RarityTag rarity={ti.rarity} />
                  </div>
                  <ActionButton
                    owned={owned} active={active} unlockLevel={ti.unlockLevel}
                    cost={ti.cost} gemCost={ti.gemCost} level={level} coins={coins} gems={gems}
                    onEquip={() => setTitle(ti.id)}
                    onBuy={() => handleBuy(buyTitle(ti.id))}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
