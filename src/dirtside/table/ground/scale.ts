/**
 * The two ground scales the generator lays a table out for (BRIEF-TERRAIN's
 * "the model"): Dirtside's platoons, 6mm, where a building is under two
 * inches and a town a few inches of urban ground; Stargrunt's squads, 25mm,
 * where a building is several inches across and walls and hedges matter.
 * Every number here is a modelling reading, not a rule: neither book ties
 * a piece of terrain to a printed size.
 */

import type { TerrainScale } from '../skirmish'

export interface ScaleParams {
  /** A wood/hill/rough/swamp blob's base radius, inches. */
  piece: readonly [number, number]
  /** A field's half-width/half-height base size, inches. */
  field: readonly [number, number]
  /** A building's footprint, across, inches. */
  building: readonly [number, number]
  /** A street or garden-wall/hedge band's width, inches. */
  street: readonly [number, number]
  /** A settlement's overall footprint, across, inches (town/city bounding box). */
  settlement: readonly [number, number]
  /** A street-grid block's width/height range, inches. */
  block: readonly [number, number]
  /**
   * A city's own block range: smaller than a town's, so a city spanning a
   * wide, shallow strip of the main battle area (it leaves both deployment
   * strips clear, p. 17's 6") still cuts into several rows of blocks.
   */
  cityBlock: readonly [number, number]
  /** Whether garden walls and hedges are laid out at all (Stargrunt only, pp. 12–13; Dirtside p. 25 keeps them folded into cultivated ground). */
  wallsAndHedges: boolean
  /**
   * How far a settlement's own outline is drawn out from its block grid
   * (before the outward-only jitter that keeps it irregular, see
   * `settlement.ts`'s `urbanOutline`). Kept separate from street width —
   * squad's streets can reach 4", and taxing every settlement's placement
   * margin by that much would eat most of the main battle area's depth.
   */
  outlinePad: number
}

export const SCALE: Record<TerrainScale, ScaleParams> = {
  platoon: {
    piece: [2.2, 4.6],
    field: [3.5, 5.5],
    building: [0.5, 1.5],
    street: [0.4, 0.8],
    settlement: [12, 20],
    block: [2.4, 4.2],
    cityBlock: [1.6, 2.8],
    wallsAndHedges: false,
    outlinePad: 0.6,
  },
  squad: {
    piece: [1.5, 3],
    field: [2.6, 4.2],
    building: [3, 7],
    street: [2.5, 4],
    settlement: [26, 44],
    block: [4.5, 7],
    cityBlock: [4.2, 5.8],
    wallsAndHedges: true,
    outlinePad: 0.9,
  },
}
