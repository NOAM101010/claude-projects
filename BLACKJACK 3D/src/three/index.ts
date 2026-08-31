/**
 * Shared 3D building blocks used across every game (blackjack, slots, roulette)
 * and the lobby. These re-export the implementations that currently live under
 * src/scene so new games depend on a stable path, not on blackjack's folder.
 */
export { useFittedModel, fitModel, preloadModel } from '../scene/useFittedModel'
export type { FittedModel } from '../scene/useFittedModel'

export {
  MODELS,
  CHIP_VALUES,
  CHIP_COLORS,
  CHIP_DIAMETER,
  CHIP_PITCH,
  TABLE_WIDTH,
  breakIntoChips,
} from '../scene/models'
export type { ModelSpec, ChipValue } from '../scene/models'

export { chipGeometry, chipMaterials } from '../scene/chipMesh'
export { cardFaceTexture, cardBackTexture } from '../scene/cardTexture'
export { default as ScorePlaque } from '../scene/ScorePlaque'
export type { PlaqueTone } from '../scene/ScorePlaque'
