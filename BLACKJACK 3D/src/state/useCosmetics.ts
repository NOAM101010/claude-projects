import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHIP_COLORS, ChipValue } from '../scene/models'
import { clearChipMaterialCache } from '../scene/chipMesh'
import { setCardBack, CardBackPalette } from '../scene/cardTexture'
import { useWallet } from './useWallet'
import { useDiamonds } from './useDiamonds'
import { useProgress } from '../progression/useProgress'

export type Rarity = 'common' | 'rare' | 'legendary'

interface Priced {
  /** Level required before the skin can be bought. */
  unlockLevel: number
  /** Coin price. 0 means it isn't sold for coins. */
  cost: number
  /** Diamond price. > 0 marks a rare, diamonds-only skin. */
  gemCost: number
  rarity: Rarity
}

export interface FeltTheme extends Priced {
  id: string
  name: string
  felt: string
  accent: string
}

export interface ChipSkin extends Priced {
  id: string
  name: string
  colors: Record<ChipValue, string>
}

// ── Felt themes ──────────────────────────────────────────────────────────────
// Common/rare themes are bought with coins; legendary themes are diamonds-only.
export const FELT_THEMES: FeltTheme[] = [
  { id: 'classic', name: 'ירוק קלאסי', felt: '#0e5a2b', accent: '#d4af37', unlockLevel: 1, cost: 0, gemCost: 0, rarity: 'common' },
  { id: 'royal', name: 'כחול מלכותי', felt: '#123a6a', accent: '#d4af37', unlockLevel: 1, cost: 25000, gemCost: 0, rarity: 'common' },
  { id: 'crimson', name: 'בורדו', felt: '#6a1220', accent: '#e8c94a', unlockLevel: 1, cost: 60000, gemCost: 0, rarity: 'common' },
  { id: 'emerald', name: 'ברקת', felt: '#0a4d3a', accent: '#7fffd4', unlockLevel: 3, cost: 120000, gemCost: 0, rarity: 'rare' },
  { id: 'violet', name: 'סגול מלכותי', felt: '#3a1a5a', accent: '#e0b0ff', unlockLevel: 5, cost: 200000, gemCost: 0, rarity: 'rare' },
  { id: 'onyx', name: 'שחור-זהב', felt: '#161616', accent: '#d4af37', unlockLevel: 8, cost: 400000, gemCost: 0, rarity: 'rare' },
  { id: 'sapphire', name: 'ספיר עמוק', felt: '#0b1e5a', accent: '#8ac6ff', unlockLevel: 1, cost: 0, gemCost: 18, rarity: 'legendary' },
  { id: 'inferno', name: 'מפל אש', felt: '#4a0d08', accent: '#ff7a2a', unlockLevel: 1, cost: 0, gemCost: 28, rarity: 'legendary' },
  { id: 'aurora', name: 'זוהר קוטבי', felt: '#0a2e33', accent: '#a0ffcf', unlockLevel: 1, cost: 0, gemCost: 22, rarity: 'legendary' },
  { id: 'vip', name: 'VIP זהב-שיש', felt: '#1c1408', accent: '#ffe08a', unlockLevel: 1, cost: 0, gemCost: 40, rarity: 'legendary' },
]

const DEFAULT_CHIPS = { ...CHIP_COLORS }

// ── Chip skins ───────────────────────────────────────────────────────────────
export const CHIP_SKINS: ChipSkin[] = [
  { id: 'classic', name: 'קלאסי', colors: DEFAULT_CHIPS, unlockLevel: 1, cost: 0, gemCost: 0, rarity: 'common' },
  {
    id: 'candy', name: 'ממתקים',
    colors: { 10: '#ff9ec4', 20: '#9ee6ff', 50: '#c8a8ff', 100: '#3a2a3a', 500: '#ffd28a', 1000: '#a8f0b0', 5000: '#ff8a8a', 25000: '#ffe08a', 50000: '#ff6ac1', 100000: '#b06aff' },
    unlockLevel: 1, cost: 45000, gemCost: 0, rarity: 'common',
  },
  {
    id: 'neon', name: 'ניאון',
    colors: { 10: '#00e5ff', 20: '#39ff14', 50: '#ff00e5', 100: '#1a1a1a', 500: '#ffea00', 1000: '#ff6a00', 5000: '#ff1744', 25000: '#d4af37', 50000: '#00ffa3', 100000: '#c800ff' },
    unlockLevel: 4, cost: 80000, gemCost: 0, rarity: 'rare',
  },
  {
    id: 'ocean', name: 'מעמקי ים',
    colors: { 10: '#1e6fa8', 20: '#2ea6a6', 50: '#3a5fd4', 100: '#0a1a2a', 500: '#4fd0e0', 1000: '#2a7fb0', 5000: '#1440a0', 25000: '#8ad0ff', 50000: '#00b4d8', 100000: '#023e8a' },
    unlockLevel: 6, cost: 150000, gemCost: 0, rarity: 'rare',
  },
  {
    id: 'gold', name: 'זהב טהור',
    colors: { 10: '#d4af37', 20: '#e8c94a', 50: '#caa63a', 100: '#3a2c08', 500: '#f0d878', 1000: '#b8901e', 5000: '#8a6a10', 25000: '#fff0b0', 50000: '#ffd700', 100000: '#6a4e08' },
    unlockLevel: 1, cost: 0, gemCost: 24, rarity: 'legendary',
  },
  {
    id: 'ruby', name: 'אבני חן',
    colors: { 10: '#e0115f', 20: '#50c878', 50: '#4169e1', 100: '#2a0a1a', 500: '#ff6ac1', 1000: '#ffb000', 5000: '#c00040', 25000: '#e8c0ff', 50000: '#00a86b', 100000: '#7b1fa2' },
    unlockLevel: 1, cost: 0, gemCost: 30, rarity: 'legendary',
  },
]

export function feltById(id: string): FeltTheme {
  return FELT_THEMES.find(t => t.id === id) ?? FELT_THEMES[0]
}
export function chipSkinById(id: string): ChipSkin {
  return CHIP_SKINS.find(s => s.id === id) ?? CHIP_SKINS[0]
}

/**
 * Chip colours live in a mutable map that chipMesh caches materials from, so a
 * skin change writes the new palette and clears that cache — otherwise the old
 * colours persist on already-built materials.
 */
function applyChipColors(colors: Record<ChipValue, string>) {
  for (const k of Object.keys(colors) as unknown as ChipValue[]) {
    ;(CHIP_COLORS as Record<ChipValue, string>)[k] = colors[k]
  }
  clearChipMaterialCache()
}

// ── Card backs ───────────────────────────────────────────────────────────────
export interface CardBack extends Priced {
  id: string
  name: string
  back: CardBackPalette
}
export const CARD_BACKS: CardBack[] = [
  { id: 'classic', name: 'קלאסי אדום', back: { base: '#8b1220', accent: '#d4af37', pattern: 'diagonal' }, unlockLevel: 1, cost: 0, gemCost: 0, rarity: 'common' },
  { id: 'navy', name: 'כחול נייבי', back: { base: '#152a5a', accent: '#d4af37', pattern: 'grid' }, unlockLevel: 1, cost: 40000, gemCost: 0, rarity: 'common' },
  { id: 'forest', name: 'ירוק יער', back: { base: '#144a2e', accent: '#e8c94a', pattern: 'diagonal' }, unlockLevel: 3, cost: 90000, gemCost: 0, rarity: 'rare' },
  { id: 'onyx-back', name: 'שחור-זהב', back: { base: '#161616', accent: '#d4af37', pattern: 'grid' }, unlockLevel: 6, cost: 180000, gemCost: 0, rarity: 'rare' },
  { id: 'sunburst', name: 'קרני זהב', back: { base: '#3a1c0c', accent: '#ffd700', pattern: 'rays' }, unlockLevel: 1, cost: 0, gemCost: 22, rarity: 'legendary' },
  { id: 'royal-back', name: 'סגול מלכותי', back: { base: '#3a1a5a', accent: '#e0b0ff', pattern: 'rays' }, unlockLevel: 1, cost: 0, gemCost: 28, rarity: 'legendary' },
]
export function cardBackById(id: string): CardBack {
  return CARD_BACKS.find(b => b.id === id) ?? CARD_BACKS[0]
}

// ── Avatar frames (pure CSS ring around the avatar) ──────────────────────────
export interface AvatarFrame extends Priced {
  id: string
  name: string
  /** CSS border/box-shadow describing the ring. */
  ring: string
}
export const AVATAR_FRAMES: AvatarFrame[] = [
  { id: 'none', name: 'ללא מסגרת', ring: '0 0 0 2px rgba(255,255,255,0.12)', unlockLevel: 1, cost: 0, gemCost: 0, rarity: 'common' },
  { id: 'bronze', name: 'ברונזה', ring: '0 0 0 2px #b87333', unlockLevel: 1, cost: 30000, gemCost: 0, rarity: 'common' },
  { id: 'silver', name: 'כסף', ring: '0 0 0 2px #c4ccd6', unlockLevel: 4, cost: 90000, gemCost: 0, rarity: 'rare' },
  { id: 'gold-frame', name: 'זהב', ring: '0 0 0 3px #d4af37, 0 0 10px rgba(212,175,55,0.6)', unlockLevel: 8, cost: 220000, gemCost: 0, rarity: 'rare' },
  { id: 'neon-frame', name: 'ניאון', ring: '0 0 0 3px #39ff14, 0 0 12px rgba(57,255,20,0.7)', unlockLevel: 1, cost: 0, gemCost: 20, rarity: 'legendary' },
  { id: 'diamond-frame', name: 'יהלום', ring: '0 0 0 3px #8ac6ff, 0 0 14px rgba(138,198,255,0.8)', unlockLevel: 1, cost: 0, gemCost: 30, rarity: 'legendary' },
]
export function avatarFrameById(id: string): AvatarFrame {
  return AVATAR_FRAMES.find(f => f.id === id) ?? AVATAR_FRAMES[0]
}

// ── Titles (a short label shown by the player's name) ────────────────────────
export interface Title extends Priced {
  id: string
  /** The title text itself, e.g. "רב אמן". */
  name: string
}
export const TITLES: Title[] = [
  { id: 'none', name: '—', unlockLevel: 1, cost: 0, gemCost: 0, rarity: 'common' },
  { id: 'rookie', name: 'טירון', unlockLevel: 1, cost: 20000, gemCost: 0, rarity: 'common' },
  { id: 'gambler', name: 'מהמר', unlockLevel: 5, cost: 75000, gemCost: 0, rarity: 'common' },
  { id: 'shark', name: 'כריש', unlockLevel: 10, cost: 200000, gemCost: 0, rarity: 'rare' },
  { id: 'highroller', name: 'רולר גבוה', unlockLevel: 1, cost: 0, gemCost: 18, rarity: 'legendary' },
  { id: 'legend', name: 'אגדה', unlockLevel: 1, cost: 0, gemCost: 35, rarity: 'legendary' },
]
export function titleById(id: string): Title {
  return TITLES.find(t => t.id === id) ?? TITLES[0]
}

export type BuyResult = 'ok' | 'owned' | 'locked' | 'poor-coins' | 'poor-gems'

/** Charge for a skin: diamonds if it's a gem-only item, otherwise coins. */
function purchase(item: Priced): BuyResult {
  if (useProgress.getState().level() < item.unlockLevel) return 'locked'
  if (item.gemCost > 0) {
    if (!useDiamonds.getState().spend(item.gemCost)) return 'poor-gems'
  } else if (item.cost > 0) {
    if (!useWallet.getState().canAfford(item.cost)) return 'poor-coins'
    useWallet.getState().add(-item.cost)
  }
  return 'ok'
}

interface CosmeticsState {
  feltTheme: string
  chipSkin: string
  cardBack: string
  avatarFrame: string
  title: string
  ownedFelts: string[]
  ownedChips: string[]
  ownedBacks: string[]
  ownedFrames: string[]
  ownedTitles: string[]

  ownsFelt: (id: string) => boolean
  ownsChip: (id: string) => boolean
  ownsBack: (id: string) => boolean
  ownsFrame: (id: string) => boolean
  ownsTitle: (id: string) => boolean
  /** Grant a felt without charging (used for perks like VIP access). */
  grantFelt: (id: string) => void
  buyFelt: (id: string) => BuyResult
  buyChip: (id: string) => BuyResult
  buyBack: (id: string) => BuyResult
  buyFrame: (id: string) => BuyResult
  buyTitle: (id: string) => BuyResult
  setFeltTheme: (id: string) => void
  setChipSkin: (id: string) => void
  setCardBackSkin: (id: string) => void
  setAvatarFrame: (id: string) => void
  setTitle: (id: string) => void
  currentFelt: () => FeltTheme
  currentFrame: () => AvatarFrame
  currentTitle: () => Title
}

export const useCosmetics = create<CosmeticsState>()(
  persist(
    (set, get) => ({
      feltTheme: 'classic',
      chipSkin: 'classic',
      cardBack: 'classic',
      avatarFrame: 'none',
      title: 'none',
      ownedFelts: ['classic'],
      ownedChips: ['classic'],
      ownedBacks: ['classic'],
      ownedFrames: ['none'],
      ownedTitles: ['none'],

      ownsFelt: id => get().ownedFelts.includes(id),
      ownsChip: id => get().ownedChips.includes(id),
      ownsBack: id => get().ownedBacks.includes(id),
      ownsFrame: id => get().ownedFrames.includes(id),
      ownsTitle: id => get().ownedTitles.includes(id),

      grantFelt: id => {
        if (!FELT_THEMES.some(t => t.id === id)) return
        set(s => (s.ownedFelts.includes(id) ? {} : { ownedFelts: [...s.ownedFelts, id] }))
      },

      buyFelt: id => {
        if (get().ownsFelt(id)) return 'owned'
        const theme = FELT_THEMES.find(t => t.id === id)
        if (!theme) return 'locked'
        const res = purchase(theme)
        if (res !== 'ok') return res
        set(s => ({ ownedFelts: [...s.ownedFelts, id], feltTheme: id }))
        return 'ok'
      },

      buyChip: id => {
        if (get().ownsChip(id)) return 'owned'
        const skin = CHIP_SKINS.find(s => s.id === id)
        if (!skin) return 'locked'
        const res = purchase(skin)
        if (res !== 'ok') return res
        set(s => ({ ownedChips: [...s.ownedChips, id], chipSkin: id }))
        applyChipColors(skin.colors)
        return 'ok'
      },

      buyBack: id => {
        if (get().ownsBack(id)) return 'owned'
        const b = CARD_BACKS.find(x => x.id === id)
        if (!b) return 'locked'
        const res = purchase(b)
        if (res !== 'ok') return res
        set(s => ({ ownedBacks: [...s.ownedBacks, id], cardBack: id }))
        setCardBack(b.back)
        return 'ok'
      },
      buyFrame: id => {
        if (get().ownsFrame(id)) return 'owned'
        const f = AVATAR_FRAMES.find(x => x.id === id)
        if (!f) return 'locked'
        const res = purchase(f)
        if (res !== 'ok') return res
        set(s => ({ ownedFrames: [...s.ownedFrames, id], avatarFrame: id }))
        return 'ok'
      },
      buyTitle: id => {
        if (get().ownsTitle(id)) return 'owned'
        const ti = TITLES.find(x => x.id === id)
        if (!ti) return 'locked'
        const res = purchase(ti)
        if (res !== 'ok') return res
        set(s => ({ ownedTitles: [...s.ownedTitles, id], title: id }))
        return 'ok'
      },

      // Equip only what's owned.
      setFeltTheme: id => {
        if (get().ownsFelt(id) && FELT_THEMES.some(t => t.id === id)) set({ feltTheme: id })
      },
      setChipSkin: id => {
        const skin = CHIP_SKINS.find(s => s.id === id)
        if (!skin || !get().ownsChip(id)) return
        set({ chipSkin: id })
        applyChipColors(skin.colors)
      },
      setCardBackSkin: id => {
        const b = CARD_BACKS.find(x => x.id === id)
        if (!b || !get().ownsBack(id)) return
        set({ cardBack: id })
        setCardBack(b.back)
      },
      setAvatarFrame: id => {
        if (get().ownsFrame(id) && AVATAR_FRAMES.some(f => f.id === id)) set({ avatarFrame: id })
      },
      setTitle: id => {
        if (get().ownsTitle(id) && TITLES.some(ti => ti.id === id)) set({ title: id })
      },

      currentFelt: () => feltById(get().feltTheme),
      currentFrame: () => avatarFrameById(get().avatarFrame),
      currentTitle: () => titleById(get().title),
    }),
    {
      name: 'goldenace-cosmetics',
      onRehydrateStorage: () => state => {
        if (!state) return
        // Ensure equipped skins are owned + fields exist (covers older saves).
        state.cardBack ??= 'classic'
        state.avatarFrame ??= 'none'
        state.title ??= 'none'
        if (!state.ownedFelts?.includes(state.feltTheme)) {
          state.ownedFelts = [...(state.ownedFelts ?? ['classic']), state.feltTheme]
        }
        if (!state.ownedChips?.includes(state.chipSkin)) {
          state.ownedChips = [...(state.ownedChips ?? ['classic']), state.chipSkin]
        }
        state.ownedBacks ??= ['classic']
        if (!state.ownedBacks.includes(state.cardBack)) state.ownedBacks = [...state.ownedBacks, state.cardBack]
        state.ownedFrames ??= ['none']
        if (!state.ownedFrames.includes(state.avatarFrame)) state.ownedFrames = [...state.ownedFrames, state.avatarFrame]
        state.ownedTitles ??= ['none']
        if (!state.ownedTitles.includes(state.title)) state.ownedTitles = [...state.ownedTitles, state.title]
        applyChipColors(chipSkinById(state.chipSkin).colors)
        setCardBack(cardBackById(state.cardBack).back)
      },
    }
  )
)
