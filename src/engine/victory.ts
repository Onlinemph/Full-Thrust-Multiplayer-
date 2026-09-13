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

import { battleriderRecovery, carryingCapacity } from './ftl'
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
  // 11.5: a hull that is still inbound has not disengaged — it has not
  // arrived. Counting it as a withdrawal would score the attacker for its own
  // reinforcements before they turn up.
  if (ship.ftlArrival !== null) return 'unhurt'
  // 11.9: same for a hull still waiting behind a gate. It has not withdrawn;
  // it has not turned up.
  if (ship.awaitingGate !== null) return 'unhurt'
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

/**
 * Riders that do not get home (11.7): *"In one-off battles, battleriders are
 * considered destroyed at the end of the battle if there are no surviving
 * Motherships capable of transporting them."*
 *
 * Per side, because a Mothership does not carry the enemy's riders, and
 * excluding captured hulls, because a prize is not going anywhere its old
 * owner wants. Riders still attached at the end are aboard already and count
 * against their carrier's room like any other.
 *
 * Only meaningful once the battle is over, so `scoreBattle` asks for it rather
 * than assuming it — a scoreboard drawn on turn three would otherwise write
 * off every rider whose Mothership had not yet been built room for.
 */
export function strandedBattleriders(game: GameState): Set<string> {
  const stranded = new Set<string>()
  for (const side of game.sides) {
    const mine = game.ships.filter(
      (ship) => ship.side === side.id && !ship.destroyed && !ship.captured,
    )
    const riders = mine.filter((ship) => ship.design.battlerider === true)
    if (riders.length === 0) continue
    const recovery = battleriderRecovery(
      riders.map((ship) => ({
        id: ship.id,
        mass: ship.design.mass,
        ftl: ship.design.ftl,
        mothershipId: ship.design.mothershipId ?? null,
      })),
      mine
        .filter((ship) => carryingCapacity(ship.design) > 0)
        .map((ship) => ({ id: ship.id, capacity: carryingCapacity(ship.design) })),
    )
    for (const id of recovery.destroyed) stranded.add(id)
  }
  return stranded
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
export function pointsConceded(
  ship: ShipState,
  ladder: VictoryLadder,
  cpv = false,
  level: DamageLevel = damageLevelOf(ship),
): number {
  const key = SHARE[level]
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
  opts: { cpv?: boolean; battleOver?: boolean } = {},
): BattleScore {
  const cpv = opts.cpv === true
  // 11.7's stranded riders are a rule about the end of the battle, so they are
  // only worked out when the caller says the battle has ended. A running
  // scoreboard shows them alive, which they are.
  const stranded = opts.battleOver === true ? strandedBattleriders(game) : new Set<string>()
  const levelOf = (ship: ShipState): DamageLevel =>
    stranded.has(ship.id) ? 'destroyed' : damageLevelOf(ship)
  const perSide = game.sides.map((side) => {
    const ships = game.ships.filter((ship) => ship.side === side.id)
    return {
      side: side.id,
      name: side.name,
      committed: ships.reduce((sum, ship) => sum + hullValue(ship, cpv), 0),
      conceded: ships.reduce(
        (sum, ship) => sum + pointsConceded(ship, ladder, cpv, levelOf(ship)),
        0,
      ),
      scored: 0,
      ships: ships.map((ship) => ({
        id: ship.id,
        name: ship.name,
        level: levelOf(ship),
        conceded: pointsConceded(ship, ladder, cpv, levelOf(ship)),
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

