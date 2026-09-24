/**
 * Stargrunt II — movement (Chapter 9, pp. 22–24): what a figure's move
 * costs through each terrain type for each mobility kind, Normal, Combat
 * and Travel moves, impassable ground, and how far along a declared path a
 * figure actually gets with a given movement-factor allowance.
 *
 * Round 1 has no vehicles (`types.ts`'s `MobilityKind` is infantry-only:
 * foot, very-light, slow- and fast-power-armour), so this file only ever
 * needs the two Chapter 9 terrain-effects rows that apply to troops on
 * foot: "Normal Infantry" and "Power-Armoured Infantry" (p. 22–23). The
 * other six rows (wheeled, tracked, hover/GEV, grav, walker) are a later
 * round's concern once vehicles exist in the contract.
 */

import { distance, featureAt, samplesAlong } from '../../dirtside/table/terrain'
import type { TerrainType } from '../../dirtside/data/mobility'
import { MOBILITY, encumberedBase } from '../data/weapons'
import type { DieType } from '../dice'
import type { MobilityKind, Point, TerrainFeature } from '../types'

// ---------------------------------------------------------------------------
// Normal, Combat and Travel movement (pp. 22, 24)
// ---------------------------------------------------------------------------

/** Base Normal Movement in inches, or the encumbered figure one step down (p. 22, p. 24). */
export function baseInches(mobility: MobilityKind, encumbered = false): DieType {
  const base = MOBILITY[mobility].baseInches
  return encumbered ? encumberedBase(base) : base
}

/** Normal Movement (p. 22): up to base mobility per action spent, no die roll. */
export function normalMoveInches(mobility: MobilityKind, actions: 1 | 2, encumbered = false): number {
  return baseInches(mobility, encumbered) * actions
}

/** Combat Movement's die (p. 22): the base-mobility number itself, as a die type. */
export function combatMoveDie(mobility: MobilityKind, encumbered = false): DieType {
  return baseInches(mobility, encumbered)
}

/** Combat Movement's distance for one action's roll (p. 22): double the die score. */
export function combatMoveInches(roll: number): number {
  return roll * 2
}

/** Travel Movement (p. 24): double base mobility per action spent, in column, no die roll. */
export function travelMoveInches(mobility: MobilityKind, actions: 1 | 2, encumbered = false): number {
  return baseInches(mobility, encumbered) * 2 * actions
}

// ---------------------------------------------------------------------------
// Terrain effects on mobility (pp. 22–23)
// ---------------------------------------------------------------------------

export type Going = 'clear' | 'poor' | 'difficult' | 'impassable'

/** Movement factors an inch of Clear/Poor/Difficult going costs (p. 22). Stargrunt has no "easy" tier and no travel-mode discount, unlike Dirtside. */
export const COST_PER_INCH: Record<Exclude<Going, 'impassable'>, number> = { clear: 1, poor: 2, difficult: 3 }

/** The two terrain-effects rows this round's contract needs (p. 22–23); a vehicle round adds the other six mobility families here. */
export type TerrainMobilityFamily = 'infantry' | 'power-armour'

export function terrainFamilyOf(mobility: MobilityKind): TerrainMobilityFamily {
  return mobility === 'slow-power' || mobility === 'fast-power' ? 'power-armour' : 'infantry'
}

/**
 * Normal Infantry (p. 22–23): Open/Light Scrub/Slopes/Roads Clear;
 * Rough/Cultivated/Swamp/all Woods Poor; Rivers/Streams (crossing only)
 * Difficult; Open Water Impassable unless amphibious. `building`, `wall`
 * and `hedge` are Dirtside's own additions (Dirtside p. 46, Stargrunt pp.
 * 12–13, 56) with no Chapter 9 row of their own: a building's interior is
 * Poor going for a trooper on foot picking his way through rooms and
 * doorways [reading], and clambering over a wall or through a hedge is
 * Difficult, same as any other linear obstacle this chapter prices by feel
 * rather than by a printed number [reading] (`movementGoing` folds `rubble`
 * onto this table's own Rough/Broken going, and `urban` — a town's open
 * streets and yards, once its buildings are read as their own pieces — onto
 * Clear, since chapter 9 has no urban terrain type of its own, spec 02
 * §2.8.1).
 */
const INFANTRY_GOING: Partial<Record<TerrainType, Going>> = {
  road: 'clear',
  open: 'clear',
  'light-scrub': 'clear',
  hills: 'clear', // "slopes" (p. 22) — moderate hills and rolling terrain
  rough: 'poor',
  cultivated: 'poor',
  swamp: 'poor',
  'light-woods': 'poor',
  'dense-woods': 'poor',
  building: 'poor', // picking a way through rooms and doorways [reading]
  river: 'difficult',
  ford: 'difficult',
  wall: 'difficult', // clambering over [reading]: the digest gives no numeric crossing cost, only for hiding behind one
  hedge: 'difficult', // pushing through [reading], same as `wall`
  'open-water': 'impassable',
}

/**
 * Power-Armoured Infantry (p. 22–23): Open/Light Scrub/Rough/Cultivated/
 * Slopes/Roads Clear; Swamp/all Woods Poor; Rivers/Streams (crossing only)
 * and Open Water (wading) Difficult; Open Water Impassable unless
 * amphibious, which also removes the Difficult wading case [reading,
 * spec 02 §2.4.3]. A building's interior is Difficult for the bulkier,
 * less nimble powered suit [reading]; a wall or a hedge costs it the same
 * Difficult clamber as an ordinary trooper.
 */
const POWER_ARMOUR_GOING: Partial<Record<TerrainType, Going>> = {
  road: 'clear',
  open: 'clear',
  'light-scrub': 'clear',
  rough: 'clear',
  cultivated: 'clear',
  hills: 'clear',
  swamp: 'poor',
  'light-woods': 'poor',
  'dense-woods': 'poor',
  building: 'difficult', // bulkier and less nimble than a trooper on foot [reading]
  river: 'difficult',
  ford: 'difficult',
  wall: 'difficult',
  hedge: 'difficult',
  'open-water': 'difficult',
}

const GOING_BY_FAMILY: Record<TerrainMobilityFamily, Partial<Record<TerrainType, Going>>> = {
  infantry: INFANTRY_GOING,
  'power-armour': POWER_ARMOUR_GOING,
}

/**
 * How a mobility family takes a terrain type (p. 22–23). `urban`, `rubble`
 * and `mountains` are Dirtside terrain types with no Chapter 9 entry of
 * their own: `urban` is a town's own bare ground — its streets and yards,
 * once its buildings are read as their own pieces rather than one blob —
 * so it goes as Clear, same as any other open ground the town sits on
 * [reading]; `rubble` is read as whatever this family's own Rough/Broken
 * going is (a wrecked building is rocks and broken masonry, Stargrunt p.
 * 57); and `mountains` is folded into the same going as `hills`/"slopes"
 * [reading], since neither `rubble` nor `mountains` is one of Stargrunt's
 * own eleven terrain types and a scenario using either is reaching past
 * this game's own vocabulary into Dirtside's.
 */
export function movementGoing(family: TerrainMobilityFamily, terrain: TerrainType, amphibious = false): Going {
  const table = GOING_BY_FAMILY[family]
  if (terrain === 'open-water' && amphibious) return 'poor'
  if (terrain === 'urban') return 'clear'
  if (terrain === 'rubble') return table.rough ?? 'clear'
  if (terrain === 'mountains') return table.hills ?? 'clear'
  return table[terrain] ?? 'clear'
}

// ---------------------------------------------------------------------------
// How far a path gets on a given allowance
// ---------------------------------------------------------------------------

export interface PathCost {
  factors: number
  length: number
  blockedAt: Point | null
  blockedBy: TerrainType | null
  legs: { terrain: TerrainType; going: Going; length: number }[]
}

/** The full cost of a path in movement factors (p. 22), stopping where the going becomes impassable. */
export function pathCost(path: readonly Point[], mobility: MobilityKind, features: readonly TerrainFeature[], opts: { amphibious?: boolean } = {}): PathCost {
  const family = terrainFamilyOf(mobility)
  const out: PathCost = { factors: 0, length: 0, blockedAt: null, blockedBy: null, legs: [] }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const samples = samplesAlong(a, b, 0.25)
    for (let s = 1; s < samples.length; s++) {
      const from = samples[s - 1]!
      const to = samples[s]!
      const step = distance(from, to)
      const feature = featureAt(to, features, { pieces: true })
      const terrain = feature?.terrain ?? 'open'
      const going = movementGoing(family, terrain, opts.amphibious)
      if (going === 'impassable') {
        out.blockedAt = from
        out.blockedBy = terrain
        return out
      }
      out.factors += step * COST_PER_INCH[going]
      out.length += step
      const last = out.legs[out.legs.length - 1]
      if (last && last.terrain === terrain && last.going === going) last.length += step
      else out.legs.push({ terrain, going, length: step })
    }
  }
  out.factors = Math.round(out.factors * 1000) / 1000
  out.length = Math.round(out.length * 1000) / 1000
  return out
}

export interface MoveProgress {
  /** Where the figure ends up: the path's end, the point it ran out of allowance, or the edge of impassable ground. */
  reached: Point
  /** Straight-line distance actually covered along the path (for the log), not the factors spent getting there. */
  distanceCovered: number
  factorsSpent: number
  /** Ran out of its allowance before the end of the declared path (as opposed to reaching the end, or being stopped by impassable ground). */
  ranOutOfAllowance: boolean
  blockedAt: Point | null
  blockedBy: TerrainType | null
}

/**
 * How far a figure gets along a declared path with a given movement-factor
 * allowance (p. 22): each terrain crossing is charged per Chapter 9's
 * going, quarter-inch by quarter-inch as Dirtside's own `pathCost` does, so
 * a narrow river/ford feature only costs extra for the samples that
 * actually land inside it ("crossing only", spec 02 §2.4.3) with no
 * special-case code needed. A wood a mobility type cannot enter never
 * arises for either infantry family this round (both take all woods as
 * Poor or better, never Impassable), so unlike Dirtside's `pathCost` this
 * does not need a wood-edge admission exception.
 */
export function advanceAlongPath(path: readonly Point[], allowanceFactors: number, mobility: MobilityKind, features: readonly TerrainFeature[], opts: { amphibious?: boolean } = {}): MoveProgress {
  const family = terrainFamilyOf(mobility)
  let remaining = allowanceFactors
  let covered = 0
  let spent = 0
  let last = path[0] ?? { x: 0, y: 0 }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const samples = samplesAlong(a, b, 0.25)
    for (let s = 1; s < samples.length; s++) {
      const from = samples[s - 1]!
      const to = samples[s]!
      const step = distance(from, to)
      const feature = featureAt(to, features, { pieces: true })
      const terrain = feature?.terrain ?? 'open'
      const going = movementGoing(family, terrain, opts.amphibious)
      if (going === 'impassable') {
        return { reached: from, distanceCovered: covered, factorsSpent: spent, ranOutOfAllowance: false, blockedAt: from, blockedBy: terrain }
      }
      const cost = step * COST_PER_INCH[going]
      if (cost > remaining + 1e-9) {
        const fraction = remaining / cost
        const reached: Point = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction }
        return { reached, distanceCovered: covered + step * fraction, factorsSpent: spent + remaining, ranOutOfAllowance: true, blockedAt: null, blockedBy: null }
      }
      remaining -= cost
      spent += cost
      covered += step
      last = to
    }
  }
  return { reached: last, distanceCovered: covered, factorsSpent: spent, ranOutOfAllowance: false, blockedAt: null, blockedBy: null }
}
