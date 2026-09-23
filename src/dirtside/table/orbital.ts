/**
 * Dirtside II — fire from orbit: *Dirtside*'s Ortillery (p. 40), which is
 * artillery (pp. 37–39) that may stray, with *More Thrust*'s figures for
 * starships giving it (p. 17). The pure half: when the ships are overhead,
 * who may call, the die they call on, where the fire lands, what it covers
 * and what it does. `game.ts` puts it through the one door.
 */

import type { ChitValidity, DieType } from '../data/weapons'
import { type DiceStream, roll, rollD6 } from '../dice'
import { distance, samplesAlong } from './terrain'
import type { ElementState, GameState, Leadership, OrbitalAttack, OrbitalShip, Point, SideId } from './types'

/** Off-table fire comes when called on 6 or more (p. 38). */
export const OFF_TABLE_CALL = 6

/** The ships come round again every sixth turn after the first (More Thrust p. 17). */
export const ORBIT_PERIOD = 6

/** A converged sheaf's beaten zone is 4" across (p. 38, More Thrust p. 17); a bombardment monitor's 8" (More Thrust p. 17). */
export const STRIKE_RADIUS: Record<OrbitalAttack, number> = { sheaf: 2, pbm: 4 }

/** Chits drawn for every element in the zone: three for a ship's own guns, four for ortillery (More Thrust p. 17). */
export const STRIKE_CHITS: Record<OrbitalAttack, number> = { sheaf: 3, pbm: 4 }

/** Nobody unprotected comes within this of ground zero for the rest of the game (More Thrust p. 17). */
export const NUKE_EXCLUSION = 2

export const ATTACK_LABELS: Record<OrbitalAttack, string> = { sheaf: 'converged sheaf', pbm: 'ortillery' }

/** Whether the side's ships are over the table this turn: the rolled turn, then every sixth (More Thrust p. 17). */
export function overhead(state: GameState, side: SideId, turn = state.turn): boolean {
  const first = state.orbit?.windows[side]
  if (first === undefined || turn < first) return false
  return (turn - first) % ORBIT_PERIOD === 0
}

/** The next turn, from `turn` on, that the side's ships are overhead; null without orbital support. */
export function nextOverhead(state: GameState, side: SideId, turn = state.turn): number | null {
  const first = state.orbit?.windows[side]
  if (first === undefined) return null
  if (turn <= first) return first
  return first + Math.ceil((turn - first) / ORBIT_PERIOD) * ORBIT_PERIOD
}

export function orbitalShips(state: GameState, side: SideId): OrbitalShip[] {
  return (state.setup.orbital ?? []).filter((s) => s.side === side).flatMap((s) => s.ships)
}

/** What a ship still has to fire this turn. */
export function attacksLeft(state: GameState, ship: OrbitalShip): Record<OrbitalAttack, number> {
  const spent = state.orbit?.spent[ship.id] ?? { sheafs: 0, ortillery: 0 }
  return { sheaf: Math.max(0, ship.sheafs - spent.sheafs), pbm: Math.max(0, ship.ortillery - spent.ortillery) }
}

/**
 * The die a request is rolled on (p. 38): a specialist observer a D12; a
 * unit commander a D10, D8 or D6 by leadership 1, 2 or 3.
 */
export function callDie(caller: ElementState, leadership: Leadership): DieType {
  if (caller.infantry?.team === 'observer') return 12
  return leadership === 1 ? 10 : leadership === 2 ? 8 : 6
}

export interface Deviation {
  /** The clock face, 12 up the table towards the north baseline. */
  clock: number
  d6: number
  d8: number
  /** Inches: the D8's excess over the D6, or none (p. 40). */
  inches: number
  impact: Point
}

/**
 * Where the fire lands (p. 40): a D12 on the clock face for the direction,
 * then a D6 and a D8 together; the D8 beating the D6 moves the marker the
 * difference in inches. Twelve o'clock is taken as up the table (north).
 */
export function rollDeviation(aim: Point, stream: DiceStream): Deviation {
  const clock = roll(12, stream)
  const d6 = rollD6(stream)
  const d8 = roll(8, stream)
  const inches = d8 > d6 ? d8 - d6 : 0
  const angle = (clock * 30 * Math.PI) / 180
  const impact = inches === 0 ? { ...aim } : { x: aim.x + Math.sin(angle) * inches, y: aim.y - Math.cos(angle) * inches }
  return { clock, d6, d8, inches, impact }
}

/**
 * The chits that count (p. 29): orbital fire is HEF against infantry and MAK
 * against vehicles (More Thrust p. 17). HEF on infantry is yellow, red only
 * when dug in; MAK on a vehicle is yellow, and ineffective against one dug
 * in. Null is no effect at all.
 *
 * [reading] p. 39 says dug-in vehicles are immune to HEF and dug-in infantry
 * to MAK, which reads as if a dug-in vehicle were open to MAK; p. 29's table,
 * which p. 39 sends the reader to, prints MAK against a dug-in vehicle as
 * ineffective. The table is followed.
 */
export function strikeValidity(target: ElementState): ChitValidity | null {
  if (target.infantry) return target.dugIn ? 'RED' : 'YELLOW'
  return target.dugIn ? null : 'YELLOW'
}

/**
 * The armour a bombardment is read against: the top, one less than the
 * front (p. 10). [reading] p. 39 says only "as per direct fire, based on
 * the vehicle's armour rating"; fire falling from above strikes the top.
 */
export function strikeArmour(target: ElementState): number {
  return Math.max(0, (target.vehicle?.armour ?? 0) - 1)
}

/**
 * Who may walk up to a crater (More Thrust p. 17 bars "unprotected troops and
 * vehicles" from 2" of it). [reading] Powered infantry and armoured vehicles
 * are protected, as *Dirtside*'s nuclear rules count sealed vehicles and
 * powered troops (p. 47); line and militia teams, and soft-skinned vehicles,
 * are not.
 */
export function protectedFromFallout(el: ElementState): boolean {
  if (el.infantry) return el.infantry.troops === 'powered'
  return (el.vehicle?.armour ?? 0) > 0
}

/** The crater a path would bring an unprotected element too close to, or null. Starting inside, it may only draw away. */
export function falloutBreach(el: ElementState, path: readonly Point[], nukes: readonly Point[]): Point | null {
  if (protectedFromFallout(el) || nukes.length === 0) return null
  const points = [el.position, ...path]
  for (const nuke of nukes) {
    const floor = Math.min(NUKE_EXCLUSION, distance(el.position, nuke))
    for (let i = 1; i < points.length; i++) {
      for (const sample of samplesAlong(points[i - 1]!, points[i]!, 0.1)) {
        if (distance(sample, nuke) < floor - 1e-6) return nuke
      }
    }
  }
  return null
}

/** Elements the zone catches: every one not already out of action within the radius of the impact, friend or foe. */
export function caughtBy(state: GameState, impact: Point, attack: OrbitalAttack): ElementState[] {
  const radius = STRIKE_RADIUS[attack]
  return Object.values(state.elements).filter((e) => !e.destroyed && !e.aboard && distance(e.position, impact) <= radius + 1e-9)
}
