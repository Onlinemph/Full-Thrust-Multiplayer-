/**
 * Ground units a player buys: Dirtside II platoons that stand garrison at a
 * colony, ride in a ship's holds and come down in interface craft to fight a
 * landing, and carry their losses and their experience from battle to
 * battle.
 *
 * Where the figures come from:
 *  - price: Dirtside's points value system (Appendix, pp. 52–53), one RP a
 *    point, as one RP is one Full Thrust point; interface-landing capability
 *    is 25% on each element that has it (p. 43, p. 52);
 *  - quality and leadership: a command marker drawn at random from the
 *    counter sheet's mix for a new unit (p. 21);
 *  - cargo space: More Thrust's 50 CS a mass of hold, 4 CS a man, a vehicle
 *    its size class × 4 (p. 15);
 *  - experience and replacements: Stargrunt II's campaign chapter (pp. 60–61),
 *    the same publisher's rules for the same universe, since Dirtside says
 *    only that a unit "builds up its own history" (p. 21, pp. 50–51).
 */

import { BOOK_EXAMPLES } from '../dirtside/data/examples'
import { INTERFACE_LANDING_PERCENT } from '../dirtside/data/costs'
import { validateDesign } from '../dirtside/design'
import { priceDesign, priceInfantry, roundPoints } from '../dirtside/pricing'
import type { ElementSetup, Leadership, Quality, UnitSetup } from '../dirtside/table/types'
import type { InfantryElement, InfantryTeam, InfantryTroops, VehicleDesign } from '../dirtside/types'
import type { ShipDesign } from '../engine/types'
import { draw, rollDie, type CampaignShipId, type ColonyId, type PlayerId, type RandomStream } from './types'

// ---------------------------------------------------------------------------
// The order and the unit
// ---------------------------------------------------------------------------

/** What a player orders: a platoon of one Motor Pool design, or of infantry teams, or both — as the skirmish panel builds a unit. */
export interface GroundUnitOrder {
  name: string
  vehicle?: VehicleDesign
  count?: number
  infantry?: { troops: InfantryTroops; teams: InfantryTeam[] }
  /** Able to come down from orbit in interface craft: 25% on each element (p. 43, p. 52). */
  interfaceLanding: boolean
}

export interface GroundElement {
  name: string
  vehicle?: VehicleDesign
  infantry?: InfantryElement
  /** Knocked out or killed in a battle; replaced by reinforcing the unit. */
  lost: boolean
}

export type GroundPost = { colony: ColonyId } | { ship: CampaignShipId }

export interface GroundUnit {
  id: string
  owner: PlayerId
  name: string
  quality: Quality
  leadership: Leadership
  /** The unit's establishment: every element it was raised with, the lost marked. */
  elements: GroundElement[]
  interfaceLanding: boolean
  /** Garrisoning a colony, or aboard a ship. */
  at: GroundPost
  /** Experience towards the next quality level (Stargrunt p. 60). */
  qualityPoints: number
  /** Battles fought. */
  battles: number
}

/** A platoon's size in elements. [reading] Dirtside lays down no limit (p. 7); this keeps one to what a unit can be. */
export const UNIT_ELEMENTS = { min: 1, max: 8 } as const

/** Whether a design is one of the book's own, exactly as printed — kept as the book prints it even where p. 10 would fault it. */
function asPrinted(design: VehicleDesign): boolean {
  const book = BOOK_EXAMPLES.find((e) => e.design.id === design.id)?.design
  return !!book && JSON.stringify(book) === JSON.stringify(design)
}

/** Why an order cannot be raised, or null. */
export function orderRefusal(order: GroundUnitOrder): string | null {
  if (!order.name.trim()) return 'Name the unit'
  const vehicles = order.vehicle ? Math.floor(order.count ?? 1) : 0
  const teams = order.infantry?.teams.length ?? 0
  if (order.vehicle && vehicles < 1) return 'A unit of vehicles needs at least one'
  if (vehicles + teams < UNIT_ELEMENTS.min) return 'A unit needs at least one vehicle or team'
  if (vehicles + teams > UNIT_ELEMENTS.max) return `A unit is at most ${UNIT_ELEMENTS.max} elements`
  if (order.vehicle && !asPrinted(order.vehicle)) {
    const fault = validateDesign(order.vehicle).find((f) => !f.advisory)
    if (fault) return `${order.vehicle.name}: ${fault.detail} (Dirtside ${fault.page})`
  }
  if (order.vehicle && (order.vehicle.mobility === 'aerospace' || order.vehicle.mobility === 'vtol')) return 'Aircraft are not yet on the Dirtside table'
  return null
}

/** The elements an order raises, named as the table shows them. */
export function orderElements(order: GroundUnitOrder): GroundElement[] {
  const out: GroundElement[] = []
  const n = order.vehicle ? Math.floor(order.count ?? 1) : 0
  for (let i = 0; i < n; i++) out.push({ name: `${order.vehicle!.name} ${i + 1}`, vehicle: structuredClone(order.vehicle!), lost: false })
  order.infantry?.teams.forEach((team, i) => {
    const infantry: InfantryElement = { troops: order.infantry!.troops, team }
    if (team === 'anti-armour') infantry.guidance = 'basic'
    out.push({ name: `${order.name} ${team} team ${i + 1}`, infantry, lost: false })
  })
  return out
}

/** An element's price in RP: its points (pp. 52–53), and a quarter more if it can land from orbit (p. 43). */
export function elementPrice(el: Pick<GroundElement, 'vehicle' | 'infantry'>, interfaceLanding: boolean): number {
  const points = el.vehicle ? priceDesign(el.vehicle).total : el.infantry ? priceInfantry(el.infantry) : 0
  return interfaceLanding ? roundPoints(points * (1 + INTERFACE_LANDING_PERCENT / 100)) : points
}

/** What an order costs in RP: one RP a Dirtside point. */
export function orderPrice(order: GroundUnitOrder): number {
  return orderElements(order).reduce((sum, el) => sum + elementPrice(el, order.interfaceLanding), 0)
}

/** What bringing a depleted unit back to its establishment costs: the lost elements, bought again. */
export function replacementPrice(unit: GroundUnit): number {
  return unit.elements.filter((e) => e.lost).reduce((sum, el) => sum + elementPrice(el, unit.interfaceLanding), 0)
}

export const present = (unit: GroundUnit) => unit.elements.filter((e) => !e.lost)

// ---------------------------------------------------------------------------
// Quality and leadership (Dirtside p. 21)
// ---------------------------------------------------------------------------

/**
 * The counter sheet's command markers: green 5, 8 and 5 of leadership 1, 2
 * and 3; blue (regular) 9, 12 and 9; orange (veteran) 5, 8 and 5.
 */
export const COMMAND_MARKERS: Record<Quality, [number, number, number]> = {
  green: [5, 8, 5],
  regular: [9, 12, 9],
  veteran: [5, 8, 5],
}

/** A new unit's command marker, drawn at random from the whole set (p. 21). */
export function drawCommandMarker(rng: RandomStream): { quality: Quality; leadership: Leadership } {
  const all: { quality: Quality; leadership: Leadership }[] = []
  for (const quality of ['green', 'regular', 'veteran'] as Quality[]) COMMAND_MARKERS[quality].forEach((n, i) => { for (let k = 0; k < n; k++) all.push({ quality, leadership: (i + 1) as Leadership }) })
  return all[Math.floor(draw(rng) * all.length)]!
}

// ---------------------------------------------------------------------------
// Cargo space (More Thrust p. 15)
// ---------------------------------------------------------------------------

/** One mass of hold carries 50 CS. */
export const CS_PER_HOLD_MASS = 50

/** Crew space by size class. [reading] More Thrust counts crews man by man; four men a vehicle of size 3 or more, two in a smaller one, match its Medium Battle Tank (28 CS) and its size-2 command vehicle (16 CS). */
export function crewCs(size: number): number {
  return (size <= 2 ? 2 : 4) * 4
}

/** Cargo space an element takes: a vehicle its size × 4 and its crew; a team four men at 4 CS (p. 15, p. 18). */
export function elementCs(el: Pick<GroundElement, 'vehicle' | 'infantry'>): number {
  if (el.vehicle) return el.vehicle.size * 4 + crewCs(el.vehicle.size)
  return 16
}

/** Cargo space a unit takes: the elements it still has. */
export function unitCs(unit: GroundUnit): number {
  return present(unit).reduce((sum, el) => sum + elementCs(el), 0)
}

/** A ship's troop space: its cargo holds and berthing at 50 CS a mass. */
export function holdCs(design: ShipDesign): number {
  const mass = design.systems.filter((s) => s.kind === 'cargo' || s.kind === 'troop-berthing' || s.kind === 'passenger-berthing').reduce((sum, s) => sum + s.mass, 0)
  return Math.round(mass * CS_PER_HOLD_MASS)
}

// ---------------------------------------------------------------------------
// On the table
// ---------------------------------------------------------------------------

/** The element id a unit's element carries on the table, back to its place in the establishment. */
export const groundElementId = (unitId: string, index: number) => `${unitId}-e${index + 1}`

/** A ground unit as the Dirtside table takes it: its present elements, its marker. */
export function unitSetup(unit: GroundUnit, extra: Partial<ElementSetup> = {}): { setup: UnitSetup; ids: Record<string, number> } {
  const ids: Record<string, number> = {}
  const elements: ElementSetup[] = []
  unit.elements.forEach((el, index) => {
    if (el.lost) return
    const id = groundElementId(unit.id, index)
    ids[id] = index
    const setup: ElementSetup = { id, name: el.name, leader: elements.length === 0, ...extra }
    if (el.vehicle) setup.vehicle = structuredClone(el.vehicle)
    if (el.infantry) setup.infantry = { ...el.infantry }
    elements.push(setup)
  })
  return { setup: { id: unit.id, name: unit.name, quality: unit.quality, leadership: unit.leadership, elements }, ids }
}

// ---------------------------------------------------------------------------
// Experience and replacements (Stargrunt pp. 60–61)
// ---------------------------------------------------------------------------

/** Points a battle is worth: 3 on the winning side, 1 on the losing, and 1 more for the unit's own objective (p. 60). */
export const QUALITY_POINTS = { win: 3, loss: 1, objective: 1 } as const

/** Points to rise a level, counted from the unit's start: 5 green to regular, 8 regular to veteran (p. 60). */
export const QUALITY_THRESHOLDS = { regular: 5, veteran: 8 } as const

/** A unit after a battle's points: the level it has earned. */
export function earnQuality(unit: GroundUnit, points: number): Quality {
  unit.qualityPoints += points
  unit.battles += 1
  if (unit.quality === 'green' && unit.qualityPoints >= QUALITY_THRESHOLDS.regular) unit.quality = 'regular'
  if (unit.quality === 'regular' && unit.qualityPoints >= QUALITY_THRESHOLDS.veteran) unit.quality = 'veteran'
  return unit.quality
}

/**
 * Replacements into a depleted unit (p. 60): roll the die nearest its
 * present strength, rounding up; a roll no higher than the number of
 * replacements drops its quality a level and uses up its points. A green
 * unit drops no further. [reading] Counted in elements, as Dirtside's units
 * are, where Stargrunt counts men.
 */
export function replacementCheck(unit: GroundUnit, rng: RandomStream): { die: number; roll: number; dropped: boolean } | null {
  const replacements = unit.elements.filter((e) => e.lost).length
  if (replacements === 0) return null
  const strength = present(unit).length
  const die = [4, 6, 8, 10, 12].find((d) => d >= strength) ?? 12
  const roll = rollDie(die, rng)
  const dropped = roll <= replacements && unit.quality !== 'green'
  if (dropped) {
    unit.quality = unit.quality === 'veteran' ? 'regular' : 'green'
    unit.qualityPoints = 0
  }
  for (const el of unit.elements) el.lost = false
  return { die, roll, dropped }
}
