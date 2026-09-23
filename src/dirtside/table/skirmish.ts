/**
 * Dirtside II — a skirmish to put on the table: two forces of the book's
 * own vehicles and infantry, a seeded spread of terrain, objectives placed
 * as p. 17 says. What the setup panel starts from and what the tests and
 * the harness play.
 */

import { bookExample } from '../data/examples'
import { type DiceStream, draw, newStream } from '../dice'
import type { InfantryElement, InfantryTeam, InfantryTroops, VehicleDesign } from '../types'
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

export interface SkirmishOptions {
  seed: number
  name?: string
  width?: number
  depth?: number
  terrain?: 'none' | 'light' | 'dense'
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

/** A seeded spread of woods, hills, rough ground, a road and a village (p. 25–26). */
export function randomTerrain(stream: DiceStream, width: number, depth: number, density: 'none' | 'light' | 'dense'): TerrainFeature[] {
  if (density === 'none') return []
  const features: TerrainFeature[] = []
  // Numbered within the one spread, so the same seed gives the same ids however often it is laid out.
  let counter = 0
  const nextId = (stem: string) => `${stem}-${(counter += 1)}`
  const rnd = (lo: number, hi: number) => lo + draw(stream) * (hi - lo)
  const count = density === 'light' ? 6 : 11
  const kinds: TerrainFeature['terrain'][] = ['light-woods', 'hills', 'rough', 'light-woods', 'light-scrub', 'dense-woods', 'hills', 'cultivated', 'swamp', 'light-woods', 'rough']
  // A road across the table.
  const roadX = rnd(width * 0.3, width * 0.7)
  features.push({ id: nextId('road'), terrain: 'road', shape: { kind: 'path', points: [{ x: roadX, y: 0 }, { x: roadX + rnd(-6, 6), y: depth / 2 }, { x: roadX + rnd(-8, 8), y: depth }], width: 1 }, label: 'road' })
  for (let i = 0; i < count; i++) {
    const terrain = kinds[i % kinds.length]!
    if (terrain === 'cultivated') {
      features.push({ id: nextId('field'), terrain, shape: { kind: 'rect', x: rnd(2, width - 12), y: rnd(8, depth - 16), width: rnd(6, 10), height: rnd(5, 8) }, label: 'fields' })
      continue
    }
    features.push({ id: nextId(terrain), terrain, shape: { kind: 'circle', centre: { x: rnd(4, width - 4), y: rnd(8, depth - 8) }, radius: rnd(2.5, 5) }, label: terrain.replace('-', ' ') })
  }
  if (density === 'dense') features.push({ id: nextId('village'), terrain: 'urban', shape: { kind: 'rect', x: rnd(6, width - 14), y: rnd(10, depth - 16), width: 8, height: 6 }, label: 'village' })
  // The road on top so a point on it reads as road.
  const road = features.shift()!
  features.push(road)
  return features
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
