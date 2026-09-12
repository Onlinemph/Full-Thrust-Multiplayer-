/**
 * Scoring a battle (4.12, 18.3).
 *
 * The introductory scenario states the ladder the rest of the book reuses:
 * a ship is worth a fraction of its Combat Points Value to the enemy according
 * to how badly it was hurt, and a ship that ran away is worth all of it.
 *
 * The interesting part is *crippled*, which is four conditions joined by OR —
 * two hull rows gone, **or** no offensive weapons left, **or** no FireCon left,
 * **or** no thrust left. Three of those are about systems rather than hull, so
 * an intact-looking ship whose guns are all gone still scores as crippled, and
 * a fleet can be beaten without a single hull being opened up.
 */

import { hullRowBounds } from './combat'
import { cpvPoints } from './battles'
import { currentThrust, hullRowsCompleted, type GameState, type ShipState } from './game'
import type { VictoryLadder } from '../data/scenarios'

export type DamageLevel = 'unhurt' | 'damaged' | 'crippled' | 'destroyed' | 'disengaged'

/**
 * Whether a weapon counts as offensive armament for the crippled test.
 *
 * 4.12 excludes expendables explicitly — "expendables do not count" — so a ship
 * left with nothing but a magazine of missiles is crippled. Point defence is
 * not offensive armament either: it cannot be fired at a ship (7.12).
 */
function isOffensiveArmament(weaponClass: string): boolean {
  switch (weaponClass) {
    case 'heavy-missile':
    case 'salvo-missile-rack':
    case 'salvo-missile-launcher':
    case 'antimatter-missile':
    case 'rocket-pod':
    case 'mine-rack':
      return false
    default:
      return true
  }
}

export function damageLevelOf(ship: ShipState): DamageLevel {
  if (ship.destroyed) return 'destroyed'
  // "Ships still under cloak at end of game count as destroyed" (4.12) — a
  // cloaked ship never came to the battle, so it is treated as lost.
  if (ship.cloaked) return 'destroyed'
  if (ship.offTable) return 'disengaged'

  const rowsGone = hullRowsCompleted(ship)
  if (rowsGone >= 2) return 'crippled'

  const armed = ship.design.weapons.some(
    (weapon) =>
      isOffensiveArmament(weapon.weaponClass) && !ship.destroyedSystems.has(weapon.id),
  )
  const fireCons = ship.design.systems.some(
    (system) =>
      (system.kind === 'firecon' || system.kind === 'advanced-firecon') &&
      !ship.destroyedSystems.has(system.id),
  )
  if (!armed || !fireCons || currentThrust(ship) <= 0) return 'crippled'

  return ship.hullMarked > 0 ? 'damaged' : 'unhurt'
}

const SHARE: Record<DamageLevel, keyof VictoryLadder | null> = {
  unhurt: null,
  damaged: 'damaged',
  crippled: 'crippled',
  destroyed: 'destroyed',
  disengaged: 'disengaged',
}

/**
 * What a hull is worth before the ladder is applied (4.12, 18.3).
 *
 * 18.3's Combat Points Value is a different currency, not a discount: it
 * reprices a hull by mass, so both what a side committed and what it concedes
 * move with it. A battle fought in CPV has to be scored in CPV or the
 * scoreboard is measuring one thing and the fleet picker another.
 */
function hullValue(ship: ShipState, cpv: boolean): number {
  return cpv ? cpvPoints(ship.design.points, ship.design.mass) : ship.design.points
}

/** Points this hull is worth to the enemy, rounded down (4.12). */
export function pointsConceded(ship: ShipState, ladder: VictoryLadder, cpv = false): number {
  const key = SHARE[damageLevelOf(ship)]
  if (!key) return 0
  return Math.floor(hullValue(ship, cpv) * ladder[key])
}

export interface SideScore {
  side: string
  name: string
  /** CPV this side brought to the table. */
  committed: number
  /** CPV this side gave away — what the enemy scores. */
  conceded: number
  /** What this side scored, which is the sum of what its enemies conceded. */
  scored: number
  ships: Array<{ id: string; name: string; level: DamageLevel; conceded: number }>
}

export interface BattleScore {
  sides: SideScore[]
  /** The side with the highest score, or null if it is a draw. */
  winner: string | null
}

/** Score the battle as it stands (4.12), in whichever currency it is fought in. */
export function scoreBattle(
  game: GameState,
  ladder: VictoryLadder,
  opts: { cpv?: boolean } = {},
): BattleScore {
  const cpv = opts.cpv === true
  const perSide = game.sides.map((side) => {
    const ships = game.ships.filter((ship) => ship.side === side.id)
    return {
      side: side.id,
      name: side.name,
      committed: ships.reduce((sum, ship) => sum + hullValue(ship, cpv), 0),
      conceded: ships.reduce((sum, ship) => sum + pointsConceded(ship, ladder, cpv), 0),
      scored: 0,
      ships: ships.map((ship) => ({
        id: ship.id,
        name: ship.name,
        level: damageLevelOf(ship),
        conceded: pointsConceded(ship, ladder, cpv),
      })),
    }
  })

  for (const side of perSide) {
    // What a side scores is what everyone it is at war with gave away. Summing
    // "not me" rather than "the other one" keeps three-cornered battles honest.
    side.scored = perSide
      .filter((other) => other.side !== side.side)
      .reduce((sum, other) => sum + other.conceded, 0)
  }

  const best = Math.max(...perSide.map((s) => s.scored))
  const leaders = perSide.filter((s) => s.scored === best)
  return { sides: perSide, winner: leaders.length === 1 ? leaders[0].side : null }
}

/**
 * How much of a hull's track is gone, as a fraction — for the SSD readout and
 * for a computer opponent deciding whether a target is worth more fire.
 */
export function hullFraction(ship: ShipState): number {
  const bounds = hullRowBounds(ship.design.hullBoxes, ship.design.hullRows)
  const total = bounds[bounds.length - 1] ?? ship.design.hullBoxes
  return total > 0 ? Math.min(1, ship.hullMarked / total) : 0
}
