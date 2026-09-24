import type { ShipDesign } from '../../../engine/types'
import type { CounterSilhouette } from '../../ssd/layout'
import type { HullExtent } from '../hullExtent'

/**
 * What both art styles need to draw a hull: the same data `Counter.tsx`
 * already gathered, so neither style re-derives it its own way. Each style
 * owns everything from here down to the paint — `Counter.tsx` only decides
 * how visible each one is, by crossfade opacity on its wrapping `<g>`.
 */
export interface ArtProps {
  design: ShipDesign
  silhouette: CounterSilhouette
  extent: HullExtent
  /** `extent.tailY - extent.noseY`, at least 1. */
  length: number
  isStation: boolean
  isCarrier: boolean
  /** The counter's on-screen radius, screen px — drives LOD inside each style. */
  r: number
  /** `r / COUNTER_EXTENT` — every style scales its local-unit geometry by this. */
  shrink: number
  destroyed: boolean
  /** Drawn as an outline only: visible to its own side, not the enemy (7.20). */
  cloaked: boolean
  /** Hull boxes marked of the total (0–1), 0 when undefined. */
  damageFraction: number
  /** Seeds the scar/wreck scatter — the ship's label, or its design id. */
  seedKey: string
  /** The drive's rating, for the thrust flare's reach (painted style only). */
  thrust: number
  /** True only while this ship's plotted order actually burns thrust — painted style's flare. */
  thrusting: boolean
  /** Same idle-glow radius `Counter.tsx` already sized off thrust, for the flare to match. */
  glowRadius: number
  /** Stable per-instance id, for this style's own gradient/clip defs. */
  uid: string
}
