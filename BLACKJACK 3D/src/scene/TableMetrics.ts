import { createContext, useContext } from 'react'

/**
 * Where things sit on the felt, in world units. Z is the table's depth axis:
 * the dealer is at -Z, the seated player at +Z. The fitted table is centred on
 * the origin and is ~0.92 deep, so its near edge is around z = +0.46.
 */
export const LAYOUT = {
  dealerCardsZ: -0.28,
  dealerTrayZ: -0.42,
  dealerStandZ: -0.86,
  playerCardsZ: 0.02,
  bettingCircleZ: 0.21,
  rackZ: 0.39,
  seatZ: 0.76,
  /** Height of the camera above the felt when seated. */
  eyeAboveFelt: 0.33,
  /** Cards and chips rest this far above the felt to avoid z-fighting. */
  restOffset: 0.001,
} as const

export interface TableMetrics {
  /** Measured world Y of the felt. Everything on the table derives from this. */
  surfaceY: number
  ready: boolean
}

const FALLBACK: TableMetrics = { surfaceY: 0.81, ready: false }

export const TableMetricsContext = createContext<TableMetrics>(FALLBACK)

export function useTableMetrics(): TableMetrics {
  return useContext(TableMetricsContext)
}

/** Y at which loose objects (cards, chips) rest on the felt. */
export function useRestY(): number {
  return useTableMetrics().surfaceY + LAYOUT.restOffset
}
