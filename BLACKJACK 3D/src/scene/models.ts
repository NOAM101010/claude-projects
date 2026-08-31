/**
 * Model specs derived from measuring the actual GLB contents (bounding boxes per
 * node group). The numbers in the comments are the raw model units so future
 * adjustments can be reasoned about without re-measuring.
 */
export interface ModelSpec {
  url: string
  /** Applied before measuring, so fitting sees the corrected orientation. */
  rotation?: [number, number, number]
  /** Node names to strip — baked-in props that fight with our own scene. */
  hide?: string[]
  /** Measure only these subtrees when computing the fit scale. */
  fitNodes?: string[]
  fit: { by: 'width' | 'height' | 'depth' | 'diameter'; size: number }
  /** 'base' puts the lowest point at y=0; 'center' centers vertically. */
  anchor?: 'base' | 'center'
  /** Node whose top face is the usable surface (reported as surfaceY). */
  surfaceNode?: string
  /**
   * Whether the model casts shadows. Off for very dense meshes that only need
   * to receive them — the shadow pass re-renders all their geometry.
   */
  castShadow?: boolean
}

/** Real casino blackjack table: ~1.83m across the chord. */
export const TABLE_WIDTH = 1.83

/** Real clay chip: 39mm across, ~3.3mm thick. */
export const CHIP_DIAMETER = 0.039
/**
 * Stacking pitch. Measured across the set, the chips are 0.0091 thick against a
 * 0.0802 diameter, so fitting to 39mm leaves ~4.4mm per chip.
 */
export const CHIP_PITCH = CHIP_DIAMETER * (0.0091 / 0.0802)

export const MODELS = {
  /**
   * Half-round table. Groups measured: Top (felt, y 3.33..15.3), Table (body,
   * y -246.4..13.47), Chips (baked-in props — hidden), Chairs (x ±428, z -434..-43).
   * The chairs sit on the -Z side, so the curved player edge faces -Z in model
   * space; rotating pi about Y turns it to face +Z, matching our convention of
   * player at +Z and dealer at -Z.
   */
  table: {
    url: '/models/table/blackjack_table.glb',
    rotation: [0, Math.PI, 0],
    hide: ['Chips'],
    fitNodes: ['Top', 'Table'],
    fit: { by: 'width', size: TABLE_WIDTH },
    anchor: 'base',
    surfaceNode: 'Top',
    // 500k triangles: casting would re-render all of it into the shadow map
    // every frame, and nothing meaningful falls from the table anyway.
    castShadow: false,
  },

  /**
   * Figure is 178 units tall (centimetres) with the Z-up correction already in
   * its root matrix. It ships with a 3.16m 'floor' disc that must be stripped —
   * otherwise fitting by horizontal extent shrinks the person to a doll.
   */
  character: {
    url: '/models/characters/man_in_suit.glb',
    hide: ['floor'],
    fit: { by: 'height', size: 1.75 },
    anchor: 'base',
  },
} satisfies Record<string, ModelSpec>

export const CHIP_VALUES = [10, 20, 50, 100, 500, 1000, 5000, 25000, 50000, 100000] as const
export type ChipValue = (typeof CHIP_VALUES)[number]

/** Fewest chips that add up to `amount`, largest denomination first. */
export function breakIntoChips(
  amount: number,
  values: readonly ChipValue[] = CHIP_VALUES,
  cap = 30
): ChipValue[] {
  const out: ChipValue[] = []
  let left = Math.round(amount)
  for (const v of [...values].sort((a, b) => b - a)) {
    while (left >= v && out.length < cap) {
      out.push(v)
      left -= v
    }
  }
  return out
}

export const CHIP_COLORS: Record<ChipValue, string> = {
  10: '#2563eb',
  20: '#16a34a',
  50: '#7c3aed',
  100: '#111827',
  500: '#c026d3',
  1000: '#ea8c1c',
  5000: '#b0111f',
  25000: '#d4af37',
  50000: '#0e7490',
  100000: '#4c1d95',
}
