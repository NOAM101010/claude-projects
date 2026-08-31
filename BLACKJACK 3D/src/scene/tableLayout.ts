import { CHIP_DIAMETER, CHIP_PITCH, CHIP_VALUES, ChipValue, breakIntoChips } from './models'
import { LAYOUT } from './TableMetrics'

export interface ChipPlacement {
  value: ChipValue
  position: [number, number, number]
}

/** Lays a set of chip values into columns rising off a base point. */
export function stackPositions(
  values: ChipValue[],
  base: [number, number, number],
  thickness: number,
  perColumn = 10,
  columnGap = CHIP_DIAMETER * 1.12
): ChipPlacement[] {
  return values.map((value, i) => {
    const col = Math.floor(i / perColumn)
    const row = i % perColumn
    return {
      value,
      position: [
        base[0] + col * columnGap,
        base[1] + row * thickness + thickness / 2,
        base[2],
      ] as [number, number, number],
    }
  })
}

/** Horizontal centre of a hand's area when several split hands share the felt. */
export function handX(slot: number, slotCount: number): number {
  if (slotCount <= 1) return 0
  const span = Math.min(0.24 * (slotCount - 1), 0.72)
  return -span / 2 + (slot * span) / (slotCount - 1)
}

/** Where a hand's wagered chips sit. */
export function betStackBase(slot: number, slotCount: number, restY: number): [number, number, number] {
  return [handX(slot, slotCount), restY, LAYOUT.bettingCircleZ]
}

export function betPlacements(
  amount: number,
  slot: number,
  slotCount: number,
  restY: number
): ChipPlacement[] {
  if (amount <= 0) return []
  const chips = breakIntoChips(amount, CHIP_VALUES, 16)
  return stackPositions(chips, betStackBase(slot, slotCount, restY), CHIP_PITCH, 8)
}

const MAX_COLUMN = 9

/**
 * How many chips of each denomination the tray shows.
 *
 * A literal breakdown looks wrong: a 5,000 bankroll is exactly one 5,000 chip,
 * leaving the tray apparently empty. A real tray is stocked with the
 * denominations you would actually bet, so each column is sized by how many of
 * that chip the bankroll comfortably covers. The columns fall as you lose,
 * which is the readable signal the tray is there to give.
 */
export function rackCounts(balance: number): Map<ChipValue, number> {
  const counts = new Map<ChipValue, number>()
  const bankroll = Math.max(Math.round(balance), 0)

  for (const value of CHIP_VALUES) {
    if (bankroll < value) {
      counts.set(value, 0)
      continue
    }
    // A tenth of the bankroll per column keeps low chips plentiful and high
    // chips scarce, the way a real tray looks.
    const n = Math.floor(bankroll / (value * 10))
    counts.set(value, Math.max(1, Math.min(n, MAX_COLUMN)))
  }
  return counts
}

/** The player's tray at the near edge, one column per denomination. */
export function rackPlacements(balance: number, restY: number): ChipPlacement[] {
  const out: ChipPlacement[] = []
  const gap = CHIP_DIAMETER * 1.15
  const startX = -((CHIP_VALUES.length - 1) * gap) / 2
  const counts = rackCounts(balance)

  CHIP_VALUES.forEach((value, i) => {
    const n = counts.get(value) ?? 0
    for (let row = 0; row < n; row++) {
      out.push({
        value,
        position: [startX + i * gap, restY + row * CHIP_PITCH + CHIP_PITCH / 2, LAYOUT.rackZ],
      })
    }
  })
  return out
}

/** The dealer's bank, shown as a full tray so payouts have a visible source. */
export function dealerTrayPlacements(restY: number): ChipPlacement[] {
  const out: ChipPlacement[] = []
  const gap = CHIP_DIAMETER * 1.15
  const columns = CHIP_VALUES.length
  const startX = -((columns - 1) * gap) / 2
  CHIP_VALUES.forEach((value, i) => {
    for (let row = 0; row < 5; row++) {
      out.push({
        value,
        position: [startX + i * gap, restY + row * CHIP_PITCH + CHIP_PITCH / 2, LAYOUT.dealerTrayZ],
      })
    }
  })
  return out
}
