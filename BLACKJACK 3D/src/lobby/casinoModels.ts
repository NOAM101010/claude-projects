import type { ModelSpec } from '../scene/models'

/**
 * Lobby props from the Casino_Free kit. All measured Y-up in roughly metric
 * scale, so they only need a height fit and a base anchor. Triangle counts are
 * tiny (200-800 each) — the large files are texture data.
 */
export const CASINO: Record<string, ModelSpec> = {
  slotMachine: {
    url: '/models/casino/slot_machine_new.glb',
    fit: { by: 'height', size: 2.1 },
    anchor: 'base',
  },
  slotMachineAlt: {
    url: '/models/casino/Slot_Machine_01.glb',
    fit: { by: 'height', size: 1.95 },
    anchor: 'base',
  },
  rouletteTable: {
    url: '/models/casino/roulette_table.glb',
    fit: { by: 'width', size: 2.7 },
    anchor: 'base',
  },
  pokerTable: {
    url: '/models/casino/poker_table.glb',
    fit: { by: 'width', size: 2.2 },
    anchor: 'base',
  },
  column: {
    url: '/models/casino/Column_17.glb',
    fit: { by: 'height', size: 4.0 },
    anchor: 'base',
  },
  neonSign: {
    url: '/models/casino/Neon_Sign_01.glb',
    fit: { by: 'width', size: 1.7 },
    anchor: 'center',
  },
  lamp: {
    url: '/models/casino/Lamp_05.glb',
    fit: { by: 'height', size: 2.2 },
    anchor: 'base',
  },
  armchair: {
    url: '/models/casino/Armchair_02.glb',
    fit: { by: 'height', size: 0.95 },
    anchor: 'base',
  },
  safe: {
    url: '/models/casino/SafeBox_01.glb',
    fit: { by: 'height', size: 0.9 },
    anchor: 'base',
  },
  sideTable: {
    url: '/models/casino/Table_01.glb',
    fit: { by: 'height', size: 0.85 },
    anchor: 'base',
  },
}

/**
 * User-supplied detailed furniture (Downloads → public/models/new). Measured
 * Y-up in metric-ish scale; low/medium triangle counts (BJ ~5.8k, slot ~10k,
 * roulette ~87k). Shadows OFF to keep the shadow map cheap next to the heavy
 * procedural blackjack table.
 */
export const NEW_MODELS: Record<string, ModelSpec> = {
  blackjackTable: {
    url: '/models/new/blackjack_table_v2.glb',
    fit: { by: 'width', size: 2.6 },
    anchor: 'base',
    castShadow: false,
  },
  slotMachine: {
    url: '/models/new/slot_machine_v2.glb',
    fit: { by: 'height', size: 2.1 },
    anchor: 'base',
    castShadow: false,
  },
  rouletteTable: {
    url: '/models/new/roulette_table_v2.glb',
    fit: { by: 'width', size: 2.8 },
    anchor: 'base',
    castShadow: false,
  },
}
