/**
 * Dirtside II — a skirmish to put on the table: two forces of the book's
 * own vehicles and infantry, a seeded spread of terrain, objectives placed
 * as p. 17 says. What the setup panel starts from and what the tests and
 * the harness play.
 */

import { bookExample } from '../data/examples'
import { type DiceStream, draw, newStream } from '../dice'
import type { InfantryElement, InfantryTeam, InfantryTroops, VehicleDesign } from '../types'
import { generateGroundTerrain } from './ground/generate'
import { distance } from './terrain'
import type { GameSetup, Leadership, Objective, Point, Quality, SideId, TerrainFeature, UnitSetup } from './types'

export interface UnitSpec {
  name: string
  quality: Quality
  leadership: Leadership
  commandUnit?: boolean
  vehicle?: VehicleDesign
  count?: number
  infantry?: { troops: InfantryTroops; teams: InfantryTeam[] }
}

/**
 * The kinds of table the generator lays out: open, the two rural spreads (light and dense), and the
 * built-up ones, a village on a road, a town of blocks and streets round a square, a city.
 */
export type TerrainStyle = 'none' | 'light' | 'dense' | 'village' | 'town' | 'city'
export const TERRAIN_STYLES: readonly TerrainStyle[] = ['none', 'light', 'dense', 'village', 'town', 'city']

/**
 * The ground scale a table is laid out for: Dirtside's platoons, where a building is under an inch
 * and a town a few inches of urban ground, or Stargrunt's squads, where a building is several
 * inches across and walls and hedges matter.
 */
export type TerrainScale = 'platoon' | 'squad'

export interface SkirmishOptions {
  seed: number
  name?: string
  width?: number
  depth?: number
  terrain?: TerrainStyle
  objectivesPerSide?: number
  turnLimit?: number | null
  north?: UnitSpec[]
  south?: UnitSpec[]
  northName?: string
  southName?: string
}


export function unitFromSpec(spec: UnitSpec, side: SideId, index: number): UnitSetup {
  const id = `${side}-${index + 1}`
  const elements: UnitSetup['elements'] = []
  if (spec.vehicle) {
    const n = spec.count ?? 3
    for (let i = 0; i < n; i++) elements.push({ id: `${id}-${i + 1}`, name: `${spec.vehicle.name} ${i + 1}`, vehicle: structuredClone(spec.vehicle), leader: i === 0 })
  }
  if (spec.infantry) {
    spec.infantry.teams.forEach((team, i) => {
      const inf: InfantryElement = { troops: spec.infantry!.troops, team }
      elements.push({ id: `${id}-i${i + 1}`, name: `${spec.name} ${team} team ${i + 1}`, infantry: inf, leader: elements.length === 0 && i === 0 })
    })
  }
  const unit: UnitSetup = { id, name: spec.name, quality: spec.quality, leadership: spec.leadership, elements }
  if (spec.commandUnit) unit.commandUnit = true
  return unit
}

/**
 * A seeded spread of terrain (p. 25–26): irregular woods, hills, rough
 * ground and fields, curving roads and rivers, and (from `village` up)
 * buildings and streets — every style at both the platoon scale Dirtside
 * plays at and the squad scale Stargrunt does (`src/dirtside/table/
 * ground/generate.ts` does the actual shape-making; this is its one call
 * site so every caller keeps working unchanged).
 */
export function randomTerrain(stream: DiceStream, width: number, depth: number, style: TerrainStyle, opts: { scale?: TerrainScale } = {}): TerrainFeature[] {
  return generateGroundTerrain(stream, width, depth, style, opts.scale ?? 'platoon')
}

/** The counter sheet's objective markers: seven worth 1, four worth 2, three worth 3. */
export const OBJECTIVE_MARKERS: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3]

/** Draw markers face down from the counter sheet's fourteen, without putting any back; a fresh sheet once they run out. */
export function objectiveDrawer(stream: DiceStream): () => number {
  let pool: number[] = []
  return () => {
    if (pool.length === 0) pool = [...OBJECTIVE_MARKERS]
    const at = Math.floor(draw(stream) * pool.length)
    return pool.splice(at, 1)[0]!
  }
}

/**
 * Objective markers for an encounter (p. 17): each side draws its own, at
 * least half in its own rear area, the rest in the main battle area, none
 * within 6" of another.
 */
export function placeObjectives(stream: DiceStream, width: number, depth: number, perSide: number): Objective[] {
  const out: Objective[] = []
  const value = objectiveDrawer(stream)
  const rnd = (lo: number, hi: number) => lo + draw(stream) * (hi - lo)
  const tryPlace = (side: SideId, i: number, rear: boolean) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const y = rear ? (side === 'north' ? rnd(2, depth / 3 - 1) : rnd((2 * depth) / 3 + 1, depth - 2)) : rnd(depth / 3 + 1, (2 * depth) / 3 - 1)
      const p: Point = { x: rnd(3, width - 3), y }
      if (out.every((o) => distance(o.position, p) >= 6)) {
        out.push({ id: `${side === 'north' ? 'N' : 'S'}${i + 1}`, position: p, value: value(), drawnBy: side })
        return
      }
    }
  }
  for (const side of ['north', 'south'] as SideId[]) {
    const rear = Math.floor(perSide / 2)
    for (let i = 0; i < perSide; i++) tryPlace(side, i, i < Math.max(rear, perSide - rear) ? i < rear || perSide === 1 : false)
  }
  return out
}

/** The book's Medium Battle Tank platoon, MICVs with a line platoon aboard on foot, DEIMOS heavies, militia. */
export function defaultForces(): { north: UnitSpec[]; south: UnitSpec[] } {
  const mbt = bookExample('book-mbt')!
  const micv = bookExample('book-micv')!
  const deimos = bookExample('book-deimos')!
  const apc = bookExample('book-wheeled-apc')!
  return {
    north: [
      { name: '1st Tank Platoon', quality: 'regular', leadership: 2, vehicle: mbt, count: 3, commandUnit: true },
      { name: '2nd Tank Platoon', quality: 'regular', leadership: 2, vehicle: mbt, count: 3 },
      { name: 'Mech Platoon', quality: 'regular', leadership: 2, vehicle: micv, count: 3 },
      { name: 'Rifle Platoon', quality: 'regular', leadership: 2, infantry: { troops: 'line', teams: ['rifle', 'rifle', 'rifle', 'apsw'] } },
    ],
    south: [
      { name: 'Heavy Troop', quality: 'veteran', leadership: 1, vehicle: deimos, count: 2, commandUnit: true },
      { name: 'Scout Troop', quality: 'veteran', leadership: 2, vehicle: deimos, count: 2 },
      { name: 'Wheeled Platoon', quality: 'green', leadership: 3, vehicle: apc, count: 3 },
      { name: 'Militia Company', quality: 'green', leadership: 2, infantry: { troops: 'militia', teams: ['rifle', 'rifle', 'rifle', 'rifle', 'apsw'] } },
    ],
  }
}

export function skirmishSetup(opts: SkirmishOptions): GameSetup {
  const width = opts.width ?? 48
  const depth = opts.depth ?? 36
  const stream = newStream(opts.seed ^ 0x5eed)
  const forces = defaultForces()
  const north = (opts.north ?? forces.north).map((s, i) => unitFromSpec(s, 'north', i))
  const south = (opts.south ?? forces.south).map((s, i) => unitFromSpec(s, 'south', i))
  return {
    name: opts.name ?? `Skirmish ${opts.seed}`,
    seed: opts.seed,
    battle: 'encounter',
    table: { width, depth, terrain: randomTerrain(stream, width, depth, opts.terrain ?? 'light'), objectives: placeObjectives(stream, width, depth, opts.objectivesPerSide ?? 3) },
    sides: [
      { id: 'north', name: opts.northName ?? 'Northern force', units: north },
      { id: 'south', name: opts.southName ?? 'Southern force', units: south },
    ],
    turnLimit: opts.turnLimit === undefined ? 8 : opts.turnLimit,
  }
}
