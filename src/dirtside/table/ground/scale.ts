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
  /** A building's footprint, across, inches: a terraced building's own frontage. */
  building: readonly [number, number]
  /** A street's width, inches: the main gaps a settlement's blocks are cut apart by. */
  street: readonly [number, number]
  /** A lane's width, inches: the narrower gaps that also cut the grid, mixed in among the streets. */
  lane: readonly [number, number]
  /** The main avenue's width, inches (BRIEF-SETTLE: at most 3" at squad scale). */
  avenue: readonly [number, number]
  /** A settlement's overall footprint, across, inches (town/city bounding box) — platoon scale only; squad sizes a town or city to its own building count instead (see `sizeByCount`). */
  settlement: readonly [number, number]
  /**
   * A block's long axis (the street frontage a row of buildings lines up
   * along), inches — a town's own, at platoon scale (`!sizeByCount`) only;
   * squad always builds with `cityBlockLength` below, town included (see
   * `settlement.ts`'s own note on why a target-sized town still wants
   * tight blocks).
   */
  blockLength: readonly [number, number]
  /** A block's short axis (a row's own depth, there and back), inches — the platoon-only pairing of `blockLength`. */
  blockDepth: readonly [number, number]
  /** A city's own, smaller block axes (and, at squad scale, every style's). */
  cityBlockLength: readonly [number, number]
  cityBlockDepth: readonly [number, number]
  /** How many buildings a roadside village (BRIEF-SETTLE's building counts) is strung with. */
  villageBuildings: readonly [number, number]
  /** A town's target building count on a 48×36 table (squad scale only; see `sizeByCount`). */
  townBuildings: readonly [number, number]
  /** A city's target building count on a 48×36 table (squad scale only; see `sizeByCount`). */
  cityBuildings: readonly [number, number]
  /**
   * Squad towns and cities are sized to their own target building count
   * (`townBuildings`/`cityBuildings`), growing a grid of blocks until it
   * holds that many, then stopping — the fix for BRIEF-SETTLE's "mostly
   * paving and street". Platoon keeps the older reading: a settlement fills
   * whatever footprint (`settlement`, or the city's own battle-area span)
   * it is given, as densely as its blocks allow.
   */
  sizeByCount: boolean
  /** Whether garden walls and hedges are laid out at all (Stargrunt only, pp. 12–13; Dirtside p. 25 keeps them folded into cultivated ground). */
  wallsAndHedges: boolean
  /**
   * How far a settlement's own outline is drawn out from its block grid
   * (before the outward-only jitter that keeps it irregular, see
   * `settlement.ts`'s `urbanOutline`). Kept separate from street width —
   * squad's streets can reach several inches, and taxing every settlement's
   * placement margin by that much would eat most of the main battle area's depth.
   */
  outlinePad: number
}

export const SCALE: Record<TerrainScale, ScaleParams> = {
  platoon: {
    piece: [2.2, 4.6],
    field: [3.5, 5.5],
    building: [0.5, 1.5],
    street: [0.4, 0.8],
    lane: [0.25, 0.45],
    avenue: [0.55, 1.1],
    settlement: [12, 20],
    blockLength: [3.2, 7],
    blockDepth: [2.2, 4],
    cityBlockLength: [2.4, 4.4],
    cityBlockDepth: [1.6, 2.8],
    villageBuildings: [4, 8],
    townBuildings: [8, 14],
    cityBuildings: [14, 28],
    sizeByCount: false,
    wallsAndHedges: false,
    outlinePad: 0.6,
  },
  squad: {
    piece: [1.5, 3],
    field: [2.6, 4.2],
    building: [3, 6],
    street: [2, 2.5],
    lane: [1.5, 2],
    avenue: [1.8, 3],
    settlement: [26, 44],
    blockLength: [9, 15],
    blockDepth: [6.5, 9],
    cityBlockLength: [9, 15],
    cityBlockDepth: [4.5, 6.5],
    villageBuildings: [5, 9],
    townBuildings: [12, 20],
    cityBuildings: [22, 40],
    sizeByCount: true,
    wallsAndHedges: true,
    outlinePad: 0.9,
  },
}
