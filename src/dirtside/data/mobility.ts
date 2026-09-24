/**
 * Mobility types and their base movement factors (p. 25, p. 27), and how
 * each takes the terrain (p. 26).
 */

import type { MobilityType, VehicleDesign } from '../types'

export interface MobilityKind {
  type: MobilityType
  label: string
  /** Base movement factor in inches over normal terrain, or null when it depends on the variant. */
  bmf: number | null
  /** Points, as a percentage of BVP (p. 52). */
  costPercent: number
  ground: boolean
  air: boolean
  water: boolean
  walker: boolean
}

export const MOBILITY_KINDS: readonly MobilityKind[] = [
  { type: 'low-wheeled', label: 'Low-mobility wheeled', bmf: 10, costPercent: 10, ground: true, air: false, water: false, walker: false },
  { type: 'high-wheeled', label: 'High-mobility wheeled', bmf: 10, costPercent: 30, ground: true, air: false, water: false, walker: false },
  { type: 'slow-tracked', label: 'Slow tracked', bmf: 8, costPercent: 20, ground: true, air: false, water: false, walker: false },
  { type: 'fast-tracked', label: 'Fast tracked', bmf: 12, costPercent: 40, ground: true, air: false, water: false, walker: false },
  { type: 'slow-gev', label: 'Slow GEV', bmf: 12, costPercent: 40, ground: true, air: false, water: false, walker: false },
  { type: 'fast-gev', label: 'Fast GEV', bmf: 15, costPercent: 60, ground: true, air: false, water: false, walker: false },
  { type: 'grav', label: 'Grav', bmf: 15, costPercent: 100, ground: true, air: false, water: false, walker: false },
  { type: 'boat', label: 'Conventional boat', bmf: null, costPercent: 10, ground: false, air: false, water: true, walker: false },
  { type: 'hydrofoil', label: 'Hydrofoil', bmf: null, costPercent: 40, ground: false, air: false, water: true, walker: false },
  { type: 'air-cushion', label: 'RSW air cushion', bmf: null, costPercent: 40, ground: false, air: false, water: true, walker: false },
  { type: 'vtol', label: 'VTOL', bmf: null, costPercent: 500, ground: false, air: true, water: false, walker: false },
  { type: 'aerospace', label: 'Aerospace craft', bmf: null, costPercent: 1000, ground: false, air: true, water: false, walker: false },
  { type: 'combat-walker', label: 'Combat walker', bmf: 12, costPercent: 100, ground: true, air: false, water: false, walker: true },
  { type: 'transport-walker', label: 'Transport walker', bmf: 8, costPercent: 80, ground: true, air: false, water: false, walker: true },
]

export function mobilityKind(type: MobilityType): MobilityKind {
  return MOBILITY_KINDS.find((m) => m.type === type)!
}

/** Base movement factor of a design (p. 25, p. 27); null for an aerospace craft, which makes passes (p. 41). */
export function baseMovementOf(design: Pick<VehicleDesign, 'mobility' | 'variant'>): number | null {
  const kind = mobilityKind(design.mobility)
  if (kind.bmf !== null) return kind.bmf
  switch (design.mobility) {
    case 'vtol':
      return design.variant === 'attack' ? 30 : 24
    case 'boat':
    case 'hydrofoil':
    case 'air-cushion':
      return design.variant === 'monitor' ? 8 : design.variant === 'assault-boat' ? 15 : 12
    default:
      return null
  }
}

/** Infantry and cavalry base movement (p. 25). */
export const INFANTRY_BMF = { militia: 2, line: 2, powered: 6, cavalry: 4 } as const

export type TerrainType =
  | 'road'
  | 'open'
  | 'light-scrub'
  | 'rough'
  | 'cultivated'
  | 'urban'
  | 'hills'
  | 'mountains'
  | 'swamp'
  | 'open-water'
  | 'river'
  | 'light-woods'
  | 'dense-woods'
  /** A designated crossing of a river, drawn over it (p. 26). */
  | 'ford'
  /** One building's footprint (Dirtside p. 46, Stargrunt p. 56): standing alone, or one of a town's. */
  | 'building'
  /** What a destroyed building leaves (Dirtside p. 46, Stargrunt p. 57): cover, no longer a screen. */
  | 'rubble'
  /** A wall or a hedge along a line (Stargrunt pp. 12–13): cover to a figure behind it, at squad scale only. */
  | 'wall'
  | 'hedge'

export type Going = 'easy' | 'normal' | 'poor' | 'difficult' | 'impassable'

/** Movement factors a going costs per inch (p. 25): easy is 2" per factor. */
export const FACTORS_PER_INCH: Record<Exclude<Going, 'impassable'>, number> = { easy: 0.5, normal: 1, poor: 2, difficult: 3 }

export type MobilityFamily = 'infantry' | 'low-wheeled' | 'high-wheeled' | 'tracked' | 'gev' | 'grav' | 'walker'

export function mobilityFamily(type: MobilityType): MobilityFamily {
  switch (type) {
    case 'low-wheeled':
      return 'low-wheeled'
    case 'high-wheeled':
      return 'high-wheeled'
    case 'slow-tracked':
    case 'fast-tracked':
      return 'tracked'
    case 'slow-gev':
    case 'fast-gev':
    case 'air-cushion':
      return 'gev'
    case 'grav':
      return 'grav'
    case 'combat-walker':
    case 'transport-walker':
      return 'walker'
    default:
      return 'tracked'
  }
}

/**
 * Terrain effects on mobility, family by family, as printed on p. 26
 * (walkers p. 27). `rubble` has no printed going of its own — p. 46's "the
 * immediate area has been rubbled to impede movement" gives no number, so
 * it is read onto whatever the family already does with `rough` ground,
 * the least invented answer and the same technique `urban`/`mountains`
 * already stand in for on rows that have no entry of their own. `building`
 * and `wall`/`hedge` have no entry anywhere in this table on purpose: an
 * isolated building "does NOT impede movement" (p. 46), and Dirtside's own
 * text (p. 25) keeps hedges and walls folded into `cultivated` rather than
 * modelled as their own obstacle — both default to `'normal'` going.
 */
const TERRAIN: Record<MobilityFamily, Partial<Record<TerrainType, Going>>> = {
  infantry: {
    road: 'easy', open: 'normal', 'light-scrub': 'normal', rough: 'normal', rubble: 'normal', cultivated: 'normal', urban: 'normal', hills: 'normal', 'light-woods': 'normal',
    mountains: 'poor', swamp: 'poor', 'dense-woods': 'poor', river: 'difficult', ford: 'difficult', 'open-water': 'impassable',
  },
  'low-wheeled': {
    // Rivers "crossing only at designated Ford — otherwise impassable" (p. 26).
    road: 'easy', open: 'poor', urban: 'poor', hills: 'poor', 'light-scrub': 'difficult', cultivated: 'difficult', ford: 'difficult', river: 'impassable',
    rough: 'impassable', rubble: 'impassable', mountains: 'impassable', swamp: 'impassable', 'light-woods': 'impassable', 'dense-woods': 'impassable', 'open-water': 'impassable',
  },
  'high-wheeled': {
    road: 'easy', open: 'normal', 'light-scrub': 'poor', cultivated: 'poor', urban: 'poor', hills: 'poor', rough: 'difficult', rubble: 'difficult', swamp: 'difficult', river: 'difficult', ford: 'difficult',
    mountains: 'impassable', 'light-woods': 'impassable', 'dense-woods': 'impassable', 'open-water': 'impassable',
  },
  tracked: {
    road: 'easy', open: 'normal', 'light-scrub': 'normal', rough: 'poor', rubble: 'poor', cultivated: 'poor', urban: 'poor', hills: 'poor', mountains: 'difficult', 'light-woods': 'difficult', river: 'difficult', ford: 'difficult',
    swamp: 'impassable', 'dense-woods': 'impassable', 'open-water': 'impassable',
  },
  gev: {
    road: 'easy', open: 'easy', 'open-water': 'easy', swamp: 'normal', 'light-scrub': 'poor', hills: 'poor', urban: 'difficult', cultivated: 'difficult', rough: 'difficult', rubble: 'difficult', river: 'difficult', ford: 'difficult',
    mountains: 'impassable', 'light-woods': 'impassable', 'dense-woods': 'impassable',
  },
  grav: {
    road: 'easy', open: 'easy', 'open-water': 'easy', river: 'easy', ford: 'easy', 'light-scrub': 'normal', rough: 'normal', rubble: 'normal', cultivated: 'normal', swamp: 'normal', urban: 'poor', hills: 'poor', mountains: 'difficult',
    'light-woods': 'impassable', 'dense-woods': 'impassable',
  },
  walker: {
    road: 'normal', open: 'normal', 'light-scrub': 'normal', rough: 'normal', rubble: 'normal', cultivated: 'normal', hills: 'normal', river: 'normal', ford: 'normal', 'open-water': 'poor',
    mountains: 'poor', swamp: 'poor', 'light-woods': 'poor', 'dense-woods': 'poor', urban: 'difficult',
  },
}

/**
 * How a mobility family takes a terrain type (p. 26). Open water is passable
 * at "poor" for an amphibious vehicle, and for powered infantry, whom p. 26
 * excepts from the infantry's impassable water in the same words.
 */
export function goingOf(family: MobilityFamily, terrain: TerrainType, amphibious = false): Going {
  const going = TERRAIN[family][terrain] ?? 'normal'
  if (going === 'impassable' && terrain === 'open-water' && amphibious) return 'poor'
  return going
}
