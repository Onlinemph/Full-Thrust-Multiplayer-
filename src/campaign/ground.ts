/**
 * The ground under the campaign: More Thrust's interface between Full Thrust
 * and Dirtside II (pp. 15–18, digested in docs/rules/more-thrust.md), read
 * onto the Stellar Imperium's colonies and fleets.
 *
 * An assault becomes a landing. The ships in orbit put their Marine
 * contingents down (p. 17–18), minus whatever damage in transit has cost
 * them (p. 18); the colony stands its militia and its PDUs against them; the
 * ships overhead give fire support (p. 17). The battle is an ordinary
 * Dirtside attack/defence game, and what it leaves — who holds the ground,
 * who is left — comes back to the campaign.
 *
 * The campaign rules print no ground forces, so the colony's side is a
 * reading; each constant below says which figures are the book's and which
 * are ours.
 */

import { bookExample } from '../dirtside/data/examples'
import { type DiceStream, draw, newStream } from '../dirtside/dice'
import { replay } from '../dirtside/table/game'
import { objectiveDrawer, randomTerrain } from '../dirtside/table/skirmish'
import { depthInside, insideShape } from '../dirtside/table/terrain'
import type { Action, ElementSetup, GameSetup, GameState, InterfaceCraft, Objective, OrbitalShip, Point, SideId, TerrainFeature, UnitSetup } from '../dirtside/table/types'
import type { InfantryElement } from '../dirtside/types'
import { classifyByMass, type FleetClass } from '../engine/battles'
import type { ShipDesign } from '../engine/types'
import { designById } from '../data/ships'
import { type GroundUnit, present, unitSetup } from './army'
import type { CampaignShip, Colony, PendingLanding } from './types'

// ---------------------------------------------------------------------------
// More Thrust's figures
// ---------------------------------------------------------------------------

/** A warship's Marine contingent is its total mass × 4 in cargo space, free (p. 17). */
export const MARINE_CS_PER_MASS = 4

/** One man takes 4 CS, living space and all (p. 15). */
export const CS_PER_MAN = 4

/**
 * [reading] A Dirtside infantry team is a fireteam of four. More Thrust's
 * squad of two fireteams rides in a size-2 vehicle (p. 18), whose capacity of
 * 10 takes two line teams at 4 each (Dirtside p. 12), and its squad of
 * powered infantry takes 32 CS: eight men.
 */
export const MEN_PER_TEAM = 4

/** Cargo space of one team: 16 CS. */
export const TEAM_CS = CS_PER_MAN * MEN_PER_TEAM

/** "Frigate class and larger" carry Marines and fire in support (p. 17); the book's frigate is mass 10 (p. 18). */
export const FRIGATE_MASS = 10

/** Converged sheafs a ship fires from its own armament each turn overhead (p. 17). */
export const SHEAFS: Record<FleetClass, number> = { escort: 1, cruiser: 2, capital: 3 }

/** How long a landing is fought for, in Dirtside turns. [reading] The ships come over on a D6 and again six turns on (p. 17); eight turns sees them at least once and twice on a 1 or 2. */
export const LANDING_TURNS = 8

/** [reading] One militia team for every million loyal colonists, and no more than this many on one table. */
export const MILITIA_CAP = 20

/** The table a landing is fought on. */
export const LANDING_TABLE = { width: 48, depth: 36 } as const

/**
 * Marine teams a design's contingent holds: its mass × 4 CS in teams of 16
 * CS, for a frigate or larger (p. 17). This matches six of the seven printed
 * example contingents team for team (p. 18): the frigate's squad (2), the
 * light cruiser's two squads and a specialist (5), the escort cruiser's three
 * squads (6), the heavy cruiser's four (8), the battlecruiser's four squads,
 * command team and specialist (10), the battleship's twelve; the light
 * carrier prints eighteen teams in 272 CS, its specialists at 12 CS, where
 * this gives seventeen.
 */
export function contingentTeams(design: ShipDesign): number {
  if (design.mass < FRIGATE_MASS || design.weapons.length === 0) return 0
  return Math.floor((design.mass * MARINE_CS_PER_MASS) / TEAM_CS)
}

/** Teams a ship can put down now: its contingent, less those already lost. */
export function marinesAboard(ship: CampaignShip, design: ShipDesign): number {
  return Math.max(0, contingentTeams(design) - (ship.marinesLost ?? 0))
}

/** Sheafs a ship fires from its ordinary armament (p. 17): by 13.4's mass classes, nothing below a frigate. */
export function sheafsOf(design: ShipDesign): number {
  if (design.mass < FRIGATE_MASS || design.weapons.length === 0) return 0
  return SHEAFS[classifyByMass(design.mass)]
}

/** Working ortillery systems: one bombardment monitor attack each (p. 17). */
export function ortilleryOf(ship: CampaignShip, design: ShipDesign): number {
  return design.systems.filter((s) => s.kind === 'ortillery' && !ship.systemsDamaged.includes(s.id)).length
}

/**
 * Losses in transit (p. 18): with X% of its damage points gone, each team
 * aboard has an X% chance of being among the casualties, rolled once. Damage
 * already rolled for is not rolled again: a second roll, after more damage,
 * is made at the chance that brings the whole to X% (the new damage over what
 * the hull had left at the first roll).
 */
export function transitLosses(ship: CampaignShip, design: ShipDesign, stream: DiceStream): { lost: number; chance: number } {
  const before = ship.marineLossRolledAt ?? 0
  const teams = marinesAboard(ship, design)
  if (ship.hullDamage <= before || design.hullBoxes <= before) return { lost: 0, chance: 0 }
  const chance = (ship.hullDamage - before) / (design.hullBoxes - before)
  let lost = 0
  for (let i = 0; i < teams; i++) if (draw(stream) < chance) lost += 1
  return { lost, chance }
}

// ---------------------------------------------------------------------------
// The two sides
// ---------------------------------------------------------------------------

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`

/** The specialists of a landing force in the order they fall to it: the first calls down the ships' fire. */
const SPECIALISTS: InfantryElement['team'][] = ['observer', 'anti-armour', 'apsw']

export interface LandingShip {
  ship: CampaignShip
  design: ShipDesign
  teams: number
}

/**
 * The landing force (pp. 17–18). [reading] Marines in powered armour, as the
 * book says they often are and without vehicles, as it says powered
 * detachments usually are; each ship's teams in squads of two rifle teams,
 * an odd team a specialist. The force is organised in platoons of four teams
 * in order of the ships' size, the largest ship's platoon commanding, all
 * regular with leadership 2.
 */
export function landingForce(ships: readonly LandingShip[]): { units: UnitSetup[]; landed: Record<string, string> } {
  const teams: { shipId: string; name: string; infantry: InfantryElement }[] = []
  let specialists = 0
  for (const { ship, teams: n } of [...ships].sort((a, b) => b.design.mass - a.design.mass)) {
    for (let i = 0; i < n; i++) {
      const odd = n % 2 === 1 && i === n - 1
      const team = odd ? SPECIALISTS[specialists++ % SPECIALISTS.length]! : 'rifle'
      const infantry: InfantryElement = { troops: 'powered', team }
      if (team === 'anti-armour') infantry.guidance = 'basic'
      teams.push({ shipId: ship.id, name: `${ship.name} ${team} team ${i + 1}`, infantry })
    }
  }
  const chunks: (typeof teams)[] = []
  for (let i = 0; i < teams.length; i += 4) chunks.push(teams.slice(i, i + 4))
  if (chunks.length > 1 && chunks[chunks.length - 1]!.length === 1) chunks[chunks.length - 2]!.push(...chunks.pop()!)
  const landed: Record<string, string> = {}
  const units = chunks.map((chunk, u): UnitSetup => {
    const unit: UnitSetup = {
      id: `marines-${u + 1}`,
      name: `${ordinal(u + 1)} Marine Platoon`,
      quality: 'regular',
      leadership: 2,
      elements: chunk.map((t, i): ElementSetup => {
        const id = `marines-${u + 1}-${i + 1}`
        landed[id] = t.shipId
        return { id, name: t.name, infantry: t.infantry, leader: i === 0 }
      }),
    }
    if (u === 0) unit.commandUnit = true
    return unit
  })
  return { units, landed }
}

/**
 * The colony's defenders. [reading] The campaign rules give a colony PDUs,
 * advanced PDUs and people, and nothing on the ground; here each stands for:
 *
 *  - a PDU (200 RP): a platoon of line infantry in prepared positions, three
 *    rifle teams, an APSW team and an anti-armour team, regular;
 *  - an advanced PDU (500 RP): three of the book's Medium Battle Tanks dug
 *    in, veteran;
 *  - loyal colonists: one team of green militia for every million, in
 *    companies of five, up to twenty teams; subject population does not
 *    fight for its masters.
 *
 * The first PDU commands, else the first advanced PDU, else the militia.
 */
export function garrisonOf(colony: Colony): { units: UnitSetup[]; roles: Record<string, 'militia' | 'pdu' | 'advanced-pdu'> } {
  const units: UnitSetup[] = []
  const roles: Record<string, 'militia' | 'pdu' | 'advanced-pdu'> = {}
  const line = (team: InfantryElement['team']): InfantryElement => (team === 'anti-armour' ? { troops: 'line', team, guidance: 'basic' } : { troops: 'line', team })
  for (let i = 0; i < colony.defences.pdu; i++) {
    const id = `pdu-${i + 1}`
    const teams: InfantryElement['team'][] = ['rifle', 'rifle', 'rifle', 'apsw', 'anti-armour']
    units.push({ id, name: `PDU ${i + 1}`, quality: 'regular', leadership: 2, elements: teams.map((t, j) => ({ id: `${id}-${j + 1}`, name: `PDU ${i + 1} ${t} team`, infantry: line(t), leader: j === 0, dugIn: true })) })
    roles[id] = 'pdu'
  }
  const mbt = bookExample('book-mbt')!
  for (let i = 0; i < colony.defences.advancedPdu; i++) {
    const id = `apdu-${i + 1}`
    units.push({ id, name: `Advanced PDU ${i + 1}`, quality: 'veteran', leadership: 2, elements: [1, 2, 3].map((j) => ({ id: `${id}-${j}`, name: `${mbt.name} ${i + 1}/${j}`, vehicle: structuredClone(mbt), leader: j === 1, dugIn: true })) })
    roles[id] = 'advanced-pdu'
  }
  const militia = Math.min(MILITIA_CAP, Math.floor(colony.population.loyal))
  for (let c = 0; c * 5 < militia; c++) {
    const id = `militia-${c + 1}`
    const n = Math.min(5, militia - c * 5)
    units.push({ id, name: `${colony.name} Militia ${ordinal(c + 1)} Company`, quality: 'green', leadership: 2, elements: Array.from({ length: n }, (_, j) => ({ id: `${id}-${j + 1}`, name: `Militia ${c + 1}/${j + 1}`, infantry: { troops: 'militia' as const, team: 'rifle' as const }, leader: j === 0 })) })
    roles[id] = 'militia'
  }
  if (units.length > 0) units[0]!.commandUnit = true
  return { units, roles }
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * The ground: the colony's town in the defender's rear area with an
 * objective at its heart, two more in the main battle area (the p. 17
 * quotas for an attack/defence battle), light terrain from the landing's
 * seed kept off the positions; the Marines down on the north baseline.
 *
 * The defenders take posts in order: the town's front edge first (inside
 * its first inch, where cover still sees out, p. 20), then the two flank
 * objectives, then further back on the flanks. PDUs take the first posts,
 * tanks the first on the flanks, militia what is left.
 */
export function landingTable(seed: number, force: UnitSetup[], garrison: UnitSetup[], roles: Record<string, string>, colonyName: string): GameSetup['table'] {
  const { width, depth } = LANDING_TABLE
  const stream = newStream(seed ^ 0x1a4d)
  const town: Point = { x: width / 2, y: depth * 0.72 }
  const west: Point = { x: width * 0.25, y: depth * 0.45 }
  const east: Point = { x: width * 0.75, y: depth * 0.45 }
  const anchors: Point[] = [town, west, east]
  const value = objectiveDrawer(stream)
  const objectives: Objective[] = anchors.map((p, i) => ({ id: `O${i + 1}`, position: { ...p }, value: value(), drawnBy: 'south' }))
  const townFeature: TerrainFeature = { id: 'town', terrain: 'urban', shape: { kind: 'rect', x: town.x - 6, y: town.y - 3, width: 12, height: 6 }, label: colonyName }
  const front = town.y - 3 + 0.6

  const clamp = (p: Point): Point => ({ x: Math.max(0.8, Math.min(width - 0.8, p.x)), y: Math.max(0.8, Math.min(depth - 0.8, p.y)) })
  const row = (unit: UnitSetup, centre: Point, spacing = 1.4) => unit.elements.forEach((el, j) => (el.position = clamp({ x: centre.x + (j - (unit.elements.length - 1) / 2) * spacing, y: centre.y })))
  // The Marines along the north baseline (p. 17: within 6"), seven platoons
  // to a row and up to six rows; a force bigger than that closes up its rows.
  const perRow = Math.max(7, Math.ceil(force.length / 6))
  const rows = Math.ceil(force.length / perRow)
  const gap = width / (Math.min(perRow, force.length) + 1)
  force.forEach((unit, i) => {
    const r = Math.floor(i / perRow)
    const c = i % perRow
    const inRow = Math.min(perRow, force.length - r * perRow)
    row(unit, { x: ((c + 1) * width) / (inRow + 1), y: rows === 1 ? 3 + (i % 2) * 1.5 : 1 + (r * 5) / (rows - 1) }, Math.min(1.4, gap / 3.2))
    for (const el of unit.elements) el.facing = 180
  })
  // The defenders' posts, best first: the town's front edge, the flank
  // objectives and back from them, then a grid over the rest of the
  // defender's ground (p. 17: the main battle area and its rear), nearest
  // an objective first. Should even the grid run out, a unit stands beside
  // the post it shares.
  const posts: { at: Point; flank: boolean; taken: number }[] = [
    { at: { x: town.x - 3.2, y: front }, flank: false, taken: 0 },
    { at: { x: town.x + 3.2, y: front }, flank: false, taken: 0 },
  ]
  for (let r = 0; west.y + 1.2 + r * 2.5 < depth - 1; r++) {
    posts.push({ at: { x: west.x, y: west.y + 1.2 + r * 2.5 }, flank: true, taken: 0 }, { at: { x: east.x, y: east.y + 1.2 + r * 2.5 }, flank: true, taken: 0 })
  }
  const grid: Point[] = []
  const deep = (p: Point) => insideShape(p, townFeature.shape) && depthInside(p, townFeature.shape) > 1
  for (let y = depth / 3 + 1; y < depth - 0.8; y += 2.5)
    for (let x = 4; x < width; x += 8) {
      const p = { x, y }
      if (!deep(p) && posts.every((q) => Math.abs(q.at.x - x) > 4 || Math.abs(q.at.y - y) > 1.2)) grid.push(p)
    }
  const nearest = (p: Point) => Math.min(...anchors.map((a) => Math.hypot(a.x - p.x, a.y - p.y)))
  for (const at of grid.sort((a, b) => nearest(a) - nearest(b))) posts.push({ at, flank: true, taken: 0 })
  const take = (unit: UnitSetup, flank: boolean) => {
    const post = posts.find((p) => p.taken === 0 && (!flank || p.flank)) ?? posts.find((p) => p.taken === 0) ?? posts.reduce((a, b) => (b.taken < a.taken ? b : a))
    const shift = post.taken
    post.taken += 1
    row(unit, { x: post.at.x + shift * 0.7, y: post.at.y + shift * 0.7 })
    for (const el of unit.elements) el.facing = 0
  }
  // PDUs first, then the tanks, then the colony's own ground units (armour to the flanks), then the militia.
  const order = (role: string | undefined) => (role === 'pdu' ? 0 : role === 'advanced-pdu' ? 1 : role === 'militia' ? 3 : 2)
  const armoured = (unit: UnitSetup) => roles[unit.id] === 'advanced-pdu' || (roles[unit.id] === undefined && unit.elements.some((e) => e.vehicle))
  for (const unit of [...garrison].sort((a, b) => order(roles[a.id]) - order(roles[b.id]))) take(unit, armoured(unit))

  const placed = [...force, ...garrison].flatMap((u) => u.elements.map((e) => e.position!)).concat(anchors)
  const random = randomTerrain(stream, width, depth, 'light').filter((f) => f.terrain === 'road' || !placed.some((p) => insideShape(p, f.shape)))
  // The town over the rest, and the road over the town so it still runs through.
  const road = random.filter((f) => f.terrain === 'road')
  return { width, depth, terrain: [...random.filter((f) => f.terrain !== 'road'), townFeature, ...road], objectives }
}

export interface LandingPlan {
  setup: GameSetup
  landed: Record<string, string>
  roles: Record<string, 'militia' | 'pdu' | 'advanced-pdu'>
  /** Ground units' elements on the table: the unit and its place in the establishment. */
  ground: Record<string, { unit: string; index: number }>
}

/** How many units a dropship carries at most (p. 43: "between two and five complete units"). */
export const DROPSHIP_UNITS = 5

/**
 * The fire a landing meets on the way down (p. 43: "perhaps 6 if facing
 * light defences or 5-6 if against heavy resistance"). [reading] The
 * colony's PDUs are what fire at craft: a D6 of 6 brings one down while a
 * PDU platoon is in action, 5 or 6 while an advanced PDU's tanks are.
 */
export const LANDING_FIRE: Record<'pdu' | 'advanced-pdu', number> = { pdu: 6, 'advanced-pdu': 5 }

/**
 * The craft that bring a landing force's ground units down (p. 43).
 * [reading] Each ship puts its own units down: its units with vehicles in
 * dropships, five units at most to a dropship, and each unit of infantry
 * alone in an assault lander that lets it straight out.
 */
export function craftFor(units: readonly GroundUnit[], shipName: (id: string) => string): InterfaceCraft[] {
  const craft: InterfaceCraft[] = []
  const byShip = new Map<string, GroundUnit[]>()
  for (const unit of units) {
    const ship = 'ship' in unit.at ? unit.at.ship : ''
    byShip.set(ship, [...(byShip.get(ship) ?? []), unit])
  }
  for (const [ship, aboard] of byShip) {
    const heavy = aboard.filter((u) => present(u).some((e) => e.vehicle))
    const light = aboard.filter((u) => !present(u).some((e) => e.vehicle))
    for (let i = 0; i * DROPSHIP_UNITS < heavy.length; i++) {
      craft.push({ id: `craft-${ship}-d${i + 1}`, side: 'north', name: `${shipName(ship)} dropship ${i + 1}`, kind: 'dropship', unitIds: heavy.slice(i * DROPSHIP_UNITS, (i + 1) * DROPSHIP_UNITS).map((u) => u.id) })
    }
    light.forEach((u, i) => craft.push({ id: `craft-${ship}-l${i + 1}`, side: 'north', name: `${shipName(ship)} lander ${i + 1}`, kind: 'lander', unitIds: [u.id] }))
  }
  return craft
}

/** The Dirtside battle for a landing: the table, both sides, the ships overhead, the craft coming down, and who the computer plays. */
export function landingSetup(opts: {
  seed: number
  name: string
  colony: Colony
  ships: readonly LandingShip[]
  attackerName: string
  defenderName: string
  computers: SideId[]
  /** The attacker's ground units aboard, able to land from orbit. */
  attackers?: readonly GroundUnit[]
  /** The colony's own ground units. */
  defenders?: readonly GroundUnit[]
}): LandingPlan {
  const force = landingForce(opts.ships)
  const garrison = garrisonOf(opts.colony)
  const ground: Record<string, { unit: string; index: number }> = {}
  const asUnits = (units: readonly GroundUnit[]) =>
    units.map((u) => {
      const { setup, ids } = unitSetup(u)
      for (const [id, index] of Object.entries(ids)) ground[id] = { unit: u.id, index }
      return setup
    })
  const landing = asUnits(opts.attackers ?? [])
  const standing = asUnits(opts.defenders ?? [])
  // The colony's command: its first PDU or tank troop, else its first ground unit, else the militia.
  const works = garrison.units.filter((u) => garrison.roles[u.id] !== 'militia')
  if (works.length === 0 && standing.length > 0) {
    for (const u of garrison.units) delete u.commandUnit
    standing[0]!.commandUnit = true
  }
  const defenders = [...garrison.units, ...standing]
  // The landing force's command: the Marines' first platoon, else the first unit down.
  if (force.units.length === 0 && landing.length > 0) landing[0]!.commandUnit = true
  const table = landingTable(opts.seed, force.units, defenders, garrison.roles, opts.colony.name)
  const overhead: OrbitalShip[] = opts.ships
    .map(({ ship, design }) => ({ id: ship.id, name: ship.name, sheafs: sheafsOf(design), ortillery: ortilleryOf(ship, design) }))
    .filter((s) => s.sheafs + s.ortillery > 0)
  const setup: GameSetup = {
    name: opts.name,
    seed: opts.seed,
    battle: 'attack-defence',
    attacker: 'north',
    table,
    sides: [
      { id: 'north', name: opts.attackerName, units: [...force.units, ...landing] },
      { id: 'south', name: opts.defenderName, units: defenders },
    ],
    turnLimit: LANDING_TURNS,
  }
  if (overhead.length > 0) setup.orbital = [{ side: 'north', ships: overhead }]
  if (landing.length > 0) {
    const names = new Map(opts.ships.map((s) => [s.ship.id, s.ship.name]))
    setup.craft = craftFor(opts.attackers ?? [], (id) => names.get(id) ?? 'Transport')
    const defence = Object.entries(garrison.roles).flatMap(([unitId, role]) => (role === 'militia' ? [] : [{ unitId, needs: LANDING_FIRE[role] }]))
    if (defence.length > 0) setup.landingDefence = defence
  }
  if (opts.computers.length > 0) setup.aiSides = [...opts.computers]
  return { setup, landed: force.landed, roles: garrison.roles, ground }
}

/** Ships of a task force as a landing sees them: design, and the teams each can put down. */
export function landingShips(ships: readonly CampaignShip[]): LandingShip[] {
  return ships.flatMap((ship) => {
    const design = designById(ship.designId)
    return design ? [{ ship, design, teams: marinesAboard(ship, design) }] : []
  })
}

// ---------------------------------------------------------------------------
// The battle file coming back
// ---------------------------------------------------------------------------

/** A Dirtside battle file: `(setup + journal)`, as the table saves it. */
export function parseLandingBattle(text: string): { setup: GameSetup; journal: Action[] } | string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return 'The battle file is not JSON'
  }
  const p = parsed as { setup?: GameSetup; journal?: unknown }
  if (!p || typeof p !== 'object' || !p.setup || !Array.isArray(p.journal)) return 'Not a Dirtside battle file'
  return { setup: p.setup, journal: p.journal as Action[] }
}

/** The landing's battle replayed from a file's journal over the landing's own setup, or why it cannot be. */
export function replayLanding(landing: PendingLanding, text: string): GameState | string {
  const parsed = parseLandingBattle(text)
  if (typeof parsed === 'string') return parsed
  if (parsed.setup.seed !== landing.seed) return 'That battle file is not this landing: the seed differs'
  try {
    return replay(landing.setup, parsed.journal)
  } catch (error) {
    return `The battle file does not replay on this landing: ${error instanceof Error ? error.message : String(error)}`
  }
}

/**
 * Who had the better of it. A finished battle says so itself; one brought
 * back unfinished goes to the side still on the table, else by the
 * objectives held, a tie holding the ground for the defender.
 */
export function landingWinner(game: GameState): SideId | 'draw' {
  if (game.result) return game.result.winner
  const alive = (side: SideId) => Object.values(game.elements).some((e) => e.sideId === side && !e.destroyed)
  if (!alive('north')) return 'south'
  if (!alive('south')) return 'north'
  const held = { north: 0, south: 0 }
  for (const o of game.setup.table.objectives) {
    const by = game.objectives[o.id]?.heldBy
    if (by) held[by] += o.value
  }
  return held.north > held.south ? 'north' : held.south > held.north ? 'south' : 'draw'
}

export interface LandingOutcome {
  winner: SideId | 'draw'
  /** Marine teams lost, by ship id. */
  marinesLost: Record<string, number>
  pduLost: number
  advancedPduLost: number
}

/**
 * What the battle cost each side. [reading] A PDU or advanced PDU is lost
 * when half or more of its platoon is destroyed; militia losses are a few
 * dozen people and leave the population in millions as it was.
 */
export function landingOutcome(landing: PendingLanding, game: GameState): LandingOutcome {
  const marinesLost: Record<string, number> = {}
  for (const [elementId, shipId] of Object.entries(landing.landed)) if (game.elements[elementId]?.destroyed) marinesLost[shipId] = (marinesLost[shipId] ?? 0) + 1
  let pduLost = 0
  let advancedPduLost = 0
  for (const [unitId, role] of Object.entries(landing.garrison)) {
    if (role === 'militia') continue
    // Counted over the platoon as it was set up: a regrouped unit keeps its own elements' fates.
    const unit = landing.setup.sides[1].units.find((u) => u.id === unitId)
    if (!unit) continue
    const destroyed = unit.elements.filter((e) => game.elements[e.id]?.destroyed).length
    if (destroyed * 2 < unit.elements.length) continue
    if (role === 'pdu') pduLost += 1
    else advancedPduLost += 1
  }
  return { winner: landingWinner(game), marinesLost, pduLost, advancedPduLost }
}
