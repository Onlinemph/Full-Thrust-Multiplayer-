/**
 * Dirtside II — the damage chits (p. 5) and what a draw of them does.
 *
 * Every hit in the game, from a laser on a tank to a rifle team's volley,
 * is resolved by drawing black chits from one pot. The pot's contents are
 * fixed by the rulebook's counter list, and the shape of the outcomes is
 * fixed by two tables: which colours count for this weapon at this range
 * (p. 29), and what the valid total does against the target's armour
 * (p. 30) or an infantry element's kill total (p. 33). This module is the
 * pot, the draw, and those two readings; the dice that decide whether there
 * is a hit at all live in fire.ts.
 */

import type { ChitValidity } from './data/weapons'
import { type DiceStream, draw } from './dice'
import type { InfantryPosition, InfantryTroops } from './types'

export type ChitColour = 'red' | 'yellow' | 'green'
export type ChitValue = 0 | 1 | 2 | 3
/** The specials: catastrophic kill, immobilised, target systems down, firer systems down (p. 30). */
export type SpecialKind = 'boom' | 'mobility' | 'systems-target' | 'systems-firer'
export type Chit = { kind: 'number'; colour: ChitColour; value: ChitValue } | { kind: SpecialKind }

export interface PotLine {
  chit: Chit
  count: number
}

const numbers = (colour: ChitColour, counts: [number, number, number, number]): PotLine[] =>
  counts.map((count, value) => ({ chit: { kind: 'number', colour, value: value as ChitValue }, count }))

/**
 * The pot as the counter sheet prints it (p. 5) and as DS.XLS counts it:
 * 100 numerical chits — 50 red, 25 yellow, 25 green — and 19 specials, 119
 * in all.
 */
export const POT_LINES: readonly PotLine[] = [
  ...numbers('green', [3, 10, 7, 5]),
  ...numbers('yellow', [3, 10, 7, 5]),
  ...numbers('red', [5, 20, 15, 10]),
  { chit: { kind: 'boom' }, count: 5 },
  { chit: { kind: 'mobility' }, count: 7 },
  { chit: { kind: 'systems-target' }, count: 5 },
  { chit: { kind: 'systems-firer' }, count: 2 },
]

export const POT: readonly Chit[] = POT_LINES.flatMap((line) => Array.from({ length: line.count }, () => line.chit))
export const POT_SIZE = POT.length

/** "RED 2", "YELLOW 0", "BOOM", "M", "T", "F" — as the chits are printed. */
export function chitLabel(chit: Chit): string {
  switch (chit.kind) {
    case 'number':
      return `${chit.colour.toUpperCase()} ${chit.value}`
    case 'boom':
      return 'BOOM'
    case 'mobility':
      return 'M'
    case 'systems-target':
      return 'T'
    case 'systems-firer':
      return 'F'
  }
}

export function chitKey(chit: Chit): string {
  return chit.kind === 'number' ? `${chit.colour}-${chit.value}` : chit.kind
}

/**
 * Draw `count` chits from a full pot without replacement. The rules return
 * every chit to the pot after each shot is resolved (p. 30), so a draw
 * always starts from all 119; an invalid chit stays drawn, it is never
 * replaced (p. 30).
 */
export function drawChits(count: number, stream: DiceStream): Chit[] {
  const pot = [...POT]
  const drawn: Chit[] = []
  for (let i = 0; i < count && pot.length > 0; i++) {
    const at = Math.floor(draw(stream) * pot.length)
    drawn.push(pot[at]!)
    pot[at] = pot[pot.length - 1]!
    pot.pop()
  }
  return drawn
}

// ---------------------------------------------------------------------------
// Validity (p. 29)
// ---------------------------------------------------------------------------

export function validColours(validity: ChitValidity): readonly ChitColour[] {
  switch (validity) {
    case 'ALL':
    case 'ALL×2':
    case 'ALL÷2':
      return ['red', 'yellow', 'green']
    case 'R/Y':
      return ['red', 'yellow']
    case 'RED':
      return ['red']
    case 'YELLOW':
      return ['yellow']
    case 'GREEN':
      return ['green']
  }
}

/** A DFFG counts double at close range and half at long (p. 29); halves stay halves. */
export function validityMultiplier(validity: ChitValidity): number {
  return validity === 'ALL×2' ? 2 : validity === 'ALL÷2' ? 0.5 : 1
}

/** What one chit is worth under a validity: nothing for a special or an invalid colour. */
export function chitPoints(chit: Chit, validity: ChitValidity): number {
  if (chit.kind !== 'number') return 0
  return validColours(validity).includes(chit.colour) ? chit.value * validityMultiplier(validity) : 0
}

export function validityLabel(validity: ChitValidity): string {
  switch (validity) {
    case 'ALL':
      return 'all colours'
    case 'ALL×2':
      return 'all colours, double value'
    case 'ALL÷2':
      return 'all colours, half value'
    case 'R/Y':
      return 'red and yellow'
    case 'RED':
      return 'red only'
    case 'YELLOW':
      return 'yellow only'
    case 'GREEN':
      return 'green only'
  }
}

// ---------------------------------------------------------------------------
// A hit on a vehicle (p. 30)
// ---------------------------------------------------------------------------

/**
 * The outcome of one hit, in the exclusive categories DS.XLS tabulates: a
 * firer systems failure voids the shot; a knock-out (by total or by BOOM)
 * needs nothing else recorded; otherwise any of damaged, target systems
 * down and immobilised may stand together.
 */
export type HitCategory = 'SD:F' | 'Miss' | 'SD:T' | 'MOB' | 'SD:T&MOB' | 'Dam' | 'Dam&SD:T' | 'Dam&MOB' | 'Dam&SD:T&MOB' | 'Kill'
export const HIT_CATEGORIES: readonly HitCategory[] = ['SD:F', 'Miss', 'SD:T', 'MOB', 'SD:T&MOB', 'Dam', 'Dam&SD:T', 'Dam&MOB', 'Dam&SD:T&MOB', 'Kill']

export interface VehicleHit {
  chits: Chit[]
  validity: ChitValidity
  armour: number
  /** The valid numerical total, halves kept. */
  points: number
  /** An F chit: the shot never happened and the firer is systems down (p. 30). */
  firerSystemsDown: boolean
  /** A BOOM chit: destroyed whatever the armour (p. 30). */
  boom: boolean
  /** Total above the armour, or a BOOM. */
  knockedOut: boolean
  /** Total equal to the armour: half speed, bands one worse (p. 30). */
  damaged: boolean
  /** An M chit on a vehicle that was not knocked out. */
  immobilised: boolean
  /** A T chit on a vehicle that was not knocked out. */
  systemsDown: boolean
  category: HitCategory
}

/**
 * Read a draw against a vehicle (p. 30): total the valid numerical chits;
 * less than the armour is no effect, equal is damaged, more is knocked out.
 * The specials are always valid against a vehicle and apply whatever the
 * total, except that a knocked-out vehicle records nothing further and an
 * F chit voids the whole shot.
 *
 * Three readings the spreadsheet fixes, all of them only visible against
 * armour 0: a BOOM drawn with an F is voided by the F (the shot was never
 * fired); a numerical chit of an invalid colour is a total of 0, which
 * equals armour 0 and *damages* a soft-skinned vehicle; and a draw of
 * specials only has no total to compare, so a lone M immobilises without
 * damaging.
 */
export function resolveVehicleHit(chits: readonly Chit[], validity: ChitValidity, armour: number): VehicleHit {
  const points = chits.reduce((sum, chit) => sum + chitPoints(chit, validity), 0)
  const has = (kind: SpecialKind) => chits.some((chit) => chit.kind === kind)
  const numerical = chits.some((chit) => chit.kind === 'number')
  const firerSystemsDown = has('systems-firer')
  const live = !firerSystemsDown
  const boom = live && has('boom')
  const knockedOut = live && (boom || (numerical && points > armour))
  const standing = live && !knockedOut
  const damaged = standing && numerical && points === armour
  const immobilised = standing && has('mobility')
  const systemsDown = standing && has('systems-target')
  let category: HitCategory
  if (firerSystemsDown) category = 'SD:F'
  else if (knockedOut) category = 'Kill'
  else {
    const parts: string[] = []
    if (damaged) parts.push('Dam')
    if (systemsDown) parts.push('SD:T')
    if (immobilised) parts.push('MOB')
    category = (parts.length ? parts.join('&') : 'Miss') as HitCategory
  }
  return { chits: [...chits], validity, armour, points, firerSystemsDown, boom, knockedOut, damaged, immobilised, systemsDown, category }
}

// ---------------------------------------------------------------------------
// A hit on infantry (p. 33)
// ---------------------------------------------------------------------------

/** Valid damage points to remove an element: militia 3, line 4, powered 5 (p. 33). */
export const INFANTRY_KILL_TOTAL: Record<InfantryTroops, number> = { militia: 3, line: 4, powered: 5 }

/** Chit validity by where the target is, for a ranged firefight (p. 33). */
export function firefightValidity(position: InfantryPosition): ChitValidity {
  switch (position) {
    case 'open':
      return 'R/Y'
    case 'soft-cover':
      return 'RED'
    case 'dug-in':
    case 'urban':
      return 'YELLOW'
  }
}

/** Close assault is deadlier: every colour in the open, red and yellow in soft cover, red only dug in (p. 34). */
export function closeAssaultValidity(position: InfantryPosition): ChitValidity {
  switch (position) {
    case 'open':
      return 'ALL'
    case 'soft-cover':
      return 'R/Y'
    case 'dug-in':
    case 'urban':
      return 'RED'
  }
}

export interface InfantryHit {
  chits: Chit[]
  validity: ChitValidity
  killTotal: number
  points: number
  /** The total equals or exceeds the kill total: the element is removed (p. 33). */
  killed: boolean
}

/** Read a draw against infantry: specials are ignored, and the total must reach the kill total (p. 33). */
export function resolveInfantryHit(chits: readonly Chit[], validity: ChitValidity, killTotal: number): InfantryHit {
  const points = chits.reduce((sum, chit) => sum + chitPoints(chit, validity), 0)
  const numerical = chits.some((chit) => chit.kind === 'number')
  return { chits: [...chits], validity, killTotal, points, killed: numerical && points >= killTotal }
}
