/**
 * The computer opponent.
 *
 * Full Thrust is a plotted-movement game: orders are written for every ship
 * before anything moves (3.5), so the hard part of playing it is not shooting —
 * it is guessing where the enemy will be in a minute's time and arriving there
 * with the right arc pointed at them. That is what most of this module is.
 *
 * The approach is one-ply search over the orders a ship may legally write, each
 * scored against where the enemy is predicted to be. No rollouts and no
 * learning: the thing that makes a Full Thrust captain good is reading the
 * geometry, and the geometry is cheap to evaluate exactly.
 *
 * Deterministic, like everything else in the engine. The AI is handed the
 * game's own `Rng` for tie-breaking, so a battle against the computer replays
 * exactly like any other.
 */

import {
  arcTo,
  bearsOn,
  courseVector,
  distance,
  incomingArc,
  moveShip,
  rangeBand,
  REAR_ARCS,
  BEAM_RANGE_BAND,
} from './geometry'
import {
  applyOrder,
  driveFromDef,
  standardTurnAllowance,
  validateOrder,
  type MovementResult,
  type MovementState,
} from './movement'
import {
  availableFireCons,
  canWeaponFire,
  currentThrust,
  enemiesOf,
  engagedTargets,
  type GameState,
  type ShipState,
} from './game'
import { maxRangeOf, needsFireCon } from './weapons'
import {
  isExhausted,
  mainMoveAllowance,
  secondaryMoveAllowance,
  FIGHTER_ATTACK_RANGE,
} from './fighters'
import { GUNBOAT_FIRE_CONTROL, GUNBOAT_MOVE, GUNBOAT_SECONDARY_MOVE } from './gunboats'
import {
  collisionAvoidanceTarget,
  hasLineOfFire,
  meteorFieldDice,
  stationaryCollisionRisk,
  CLOUD_SAFE_VELOCITY,
} from './terrain'
import { arcsWhenInverted } from './specialmoves'
import { optional, type GameAction } from './actions'
import type { MovementOrder, Point, TurnDirection } from './types'
import type { Rng } from './dice'

// ---------------------------------------------------------------------------
// Doctrine
// ---------------------------------------------------------------------------

/**
 * How a captain fights. Full Thrust rewards very different postures — a
 * missile ship wants to stay at 24 MU, a K-gun brawler wants to be at 6 — and a
 * single "get closer" heuristic plays all of them badly.
 */
export type Doctrine = 'brawler' | 'gunline' | 'skirmisher' | 'standoff'

export interface AiSettings {
  doctrine?: Doctrine
  /** How far ahead to predict the enemy, in turns. One is usually right. */
  lookahead?: number
}

/**
 * The range a doctrine wants to fight at, in MU.
 *
 * Derived from the ship where it can be: a hull whose longest gun reaches
 * 12 MU has no business loitering at 30, whatever its captain's temperament.
 */
export function preferredRange(ship: ShipState, doctrine: Doctrine): number {
  const reach = longestReach(ship)
  switch (doctrine) {
    case 'brawler':
      // Inside the first band, where a beam rolls all its dice (4.5).
      return Math.min(reach, BEAM_RANGE_BAND * 0.5)
    case 'gunline':
      // Just inside the best band the ship actually has.
      return Math.max(BEAM_RANGE_BAND * 0.8, reach * 0.55)
    case 'skirmisher':
      return Math.max(BEAM_RANGE_BAND, reach * 0.75)
    case 'standoff':
      return Math.max(BEAM_RANGE_BAND, reach * 0.95)
  }
}

/** The longest range at which any of a ship's surviving guns does anything. */
export function longestReach(ship: ShipState): number {
  let best = 0
  for (const weapon of ship.design.weapons) {
    if (ship.destroyedSystems.has(weapon.id)) continue
    // A beam-type weapon has one range band per class (4.3); everything else
    // states its own, and until the weapon modules are consulted the class is
    // the honest approximation.
    best = Math.max(best, weapon.rating * BEAM_RANGE_BAND)
  }
  return best || BEAM_RANGE_BAND
}

/** A doctrine that suits the hull, when nobody has chosen one. */
export function doctrineFor(ship: ShipState): Doctrine {
  const reach = longestReach(ship)
  const thrust = currentThrust(ship)
  if (reach >= BEAM_RANGE_BAND * 3) return thrust >= 5 ? 'skirmisher' : 'standoff'
  if (thrust >= 6) return 'brawler'
  return 'gunline'
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

/**
 * Where a ship will be next turn if it holds its course.
 *
 * Deliberately naive, and that is the right call: orders are written
 * simultaneously and secretly (3.5), so *nobody* at the table knows what the
 * enemy plotted. Straight-ahead is the honest guess, and a cleverer prediction
 * would be the AI cheating rather than the AI thinking.
 */
export function predict(ship: ShipState, turns = 1): Point {
  let position = ship.placement.position
  const v = courseVector(ship.placement.facing)
  for (let i = 0; i < turns; i++) {
    position = { x: position.x + v.x * ship.velocity, y: position.y + v.y * ship.velocity }
  }
  return position
}

/** The enemy this ship should be pointing at. */
export function pickTarget(game: GameState, ship: ShipState): ShipState | undefined {
  const enemies = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
  if (enemies.length === 0) return undefined

  let best: ShipState | undefined
  let bestScore = -Infinity
  for (const enemy of enemies) {
    const range = distance(ship.placement.position, enemy.placement.position)
    // Prefer the hurt and the near. A cripple finished off is points banked
    // (4.12), and range is the thing a turn of manoeuvre can least afford to
    // spend fixing.
    const hurt = enemy.design.hullBoxes > 0 ? enemy.hullMarked / enemy.design.hullBoxes : 0
    const score = hurt * 40 - range
    if (score > bestScore) {
      bestScore = score
      best = enemy
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Order search
// ---------------------------------------------------------------------------

/** Every order this ship could legally write this turn. */
export function candidateOrders(ship: ShipState): MovementOrder[] {
  const state = movementStateOf(ship)
  const turnCap = standardTurnAllowance(state.drive)
  const thrust = state.drive.rating

  const out: MovementOrder[] = []
  const directions: Array<TurnDirection | null> = ['port', 'starboard', null]
  for (const direction of directions) {
    const maxPoints = direction === null ? 0 : turnCap
    for (let points = direction === null ? 0 : 1; points <= maxPoints; points++) {
      for (let accel = -thrust; accel <= thrust; accel++) {
        const order: MovementOrder = {
          turn: direction ? { direction, points } : null,
          accel,
        }
        if (validateOrder(order, state).legal) out.push(order)
      }
    }
  }
  return out
}

export interface ScoredOrder {
  order: MovementOrder
  score: number
}

/**
 * Score one order: where it puts the ship relative to where the target will be.
 *
 * Four things matter, in this order of weight — being at the range the
 * doctrine wants, being able to bring guns to bear on the target, not
 * presenting a rear arc (4.10), and not flying off the table (3.9).
 */
export function scoreOrder(
  game: GameState,
  ship: ShipState,
  target: ShipState,
  order: MovementOrder,
  settings: AiSettings = {},
): number {
  const doctrine = settings.doctrine ?? doctrineFor(ship)
  const result = applyOrder(movementStateOf(ship), order)
  const enemyAt = predict(target, settings.lookahead ?? 1)

  const range = distance(result.placement.position, enemyAt)
  const want = preferredRange(ship, doctrine)

  // Range: a squared penalty, so being twice as far off is four times as bad.
  // Scaled by the band, because 6 MU out of position matters a great deal at
  // knife range and hardly at all at 36.
  let score = -(((range - want) / BEAM_RANGE_BAND) ** 2) * 10

  // Guns bearing. The arc the target will be in, counted by how much of the
  // ship's surviving armament can fire into it (4.2). The aft arc counts for
  // nothing: this is a position the ship is about to manoeuvre into, so it
  // will have spent thrust and 4.2's exception cannot apply to it.
  const arc = arcTo(result.placement.position, result.placement.facing, enemyAt)
  const band = rangeBand(range)
  if (arc === 'A') return score - edgePenalty(game, result.placement.position)
  for (const weapon of ship.design.weapons) {
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!bearsOn(arcsWhenInverted(weapon.arcs, ship.rollStatus.inverted), arc)) continue
    // A weapon out of range contributes nothing, and one deep inside its range
    // contributes its full class (4.5).
    score += Math.max(0, weapon.rating - (band - 1)) * 6
  }

  // Do not show them the engines. 4.10 is optional, but a captain who does not
  // know whether it is in play should assume it is.
  const facingThem = incomingArc(result.placement.position, result.placement.facing, enemyAt)
  if (REAR_ARCS.includes(facingThem)) score -= 25

  // The table edge. Leaving it is a real decision (3.9) and never an accident.
  score -= edgePenalty(game, result.placement.position)

  // Section 17. A rock is not scenery when the hazards are in play.
  score -= terrainPenalty(game, ship, result)

  return score
}

/**
 * What this order risks flying into (17.2, 17.4, 17.6).
 *
 * Weighted so that a real chance of the ship simply ceasing to exist outranks
 * everything else on the board: 17.6 destroys outright and there is no damage
 * roll to survive. The dust and the field penalties are proportional to what
 * they would actually cost, so a computer that has to cross a meteor field will
 * slow down to do it rather than refuse.
 */
function terrainPenalty(game: GameState, ship: ShipState, result: MovementResult): number {
  if (!optional(game).terrainHazards) return 0
  if (game.terrain.length === 0) return 0

  const path = [ship.placement.position, ...result.legs.map((leg) => leg.to)]
  let penalty = 0
  for (const feature of game.terrain) {
    const body = { id: feature.id, position: feature.position, radius: feature.radius }
    if (!stationaryCollisionRisk(path, body)) continue
    if (feature.kind === 'planet' || feature.kind === 'planetoid') {
      // The chance of the avoidance roll failing, times what losing the ship
      // is worth. 17.6: above 6 and "a crash is inevitable".
      const need = collisionAvoidanceTarget(result.velocity, currentThrust(ship), {
        advancedDrive: ship.design.drive.advanced,
      })
      const fail = need <= 1 ? 0 : need > 6 ? 1 : (need - 1) / 6
      penalty += fail * 1000
    } else if (feature.kind === 'dust-cloud' || feature.kind === 'nebula') {
      if (result.velocity > CLOUD_SAFE_VELOCITY) penalty += 40
    } else if (feature.kind === 'asteroid-field' || feature.kind === 'debris') {
      // 3.5 penetrating damage per die on average, and it goes past armour.
      penalty += meteorFieldDice(result.velocity) * 25
    }
  }
  return penalty
}

/**
 * How badly an order flies the ship off the table.
 *
 * A ramp rather than a cliff, so a ship near the edge turns away over a couple
 * of turns instead of jamming itself against the boundary.
 */
function edgePenalty(game: GameState, position: Point): number {
  const table = tableOf(game)
  const margin = Math.min(
    position.x,
    position.y,
    table.width - position.x,
    table.height - position.y,
  )
  if (margin >= BEAM_RANGE_BAND) return 0
  if (margin < 0) return 400
  return ((BEAM_RANGE_BAND - margin) / BEAM_RANGE_BAND) ** 2 * 60
}

/**
 * The table the battle is on.
 *
 * The engine does not carry it — a Full Thrust table is a property of the
 * scenario, not of the rules — so the AI works from the spread of the ships
 * with a margin. Wrong by a little, and only used to keep ships from wandering
 * off, which is a soft preference anyway.
 */
function tableOf(game: GameState): { width: number; height: number } {
  let width = 72
  let height = 48
  for (const ship of game.ships) {
    width = Math.max(width, ship.placement.position.x + BEAM_RANGE_BAND)
    height = Math.max(height, ship.placement.position.y + BEAM_RANGE_BAND)
  }
  return { width, height }
}

function movementStateOf(ship: ShipState): MovementState {
  return {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
}

/** The best order for this ship, with the runners-up, for inspection. */
export function planMovement(
  game: GameState,
  ship: ShipState,
  settings: AiSettings = {},
): ScoredOrder[] {
  const target = pickTarget(game, ship)
  const candidates = candidateOrders(ship)
  if (!target) {
    // Nobody to fight: hold course and speed rather than wander.
    return [{ order: { turn: null, accel: 0 }, score: 0 }]
  }
  return candidates
    .map((order) => ({ order, score: scoreOrder(game, ship, target, order, settings) }))
    .sort((a, b) => b.score - a.score)
}

/** Launcher classes that put a marker on the table rather than firing (6.2). */
const LAUNCHER_CLASSES = new Set([
  'heavy-missile',
  'salvo-missile-rack',
  'salvo-missile-launcher',
  'antimatter-missile',
])

// ---------------------------------------------------------------------------
// Driving
// ---------------------------------------------------------------------------

/**
 * The actions the computer takes for one side in the current phase.
 *
 * Returns them rather than dispatching, so the caller journals them through the
 * same door a human's clicks go through — which is what keeps an AI battle
 * replayable and lets a player undo the computer's turn.
 */
export function aiActions(
  game: GameState,
  side: string,
  settings: AiSettings = {},
  _rng?: Rng,
): GameAction[] {
  const mine = game.ships.filter(
    (ship) => ship.side === side && !ship.destroyed && !ship.offTable,
  )
  const actions: GameAction[] = []

  switch (game.phase) {
    case 'orders':
      for (const ship of mine) {
        // 8.1: a carrier with a wing still in the bay writes "Launch" and
        // nothing else — 8.2 refuses the launch outright if it spent thrust.
        // Holding station for a turn is what the launch costs, and a carrier
        // that never pays it is a carrier that never launches.
        if (hasCraftAboard(game, ship)) continue
        const best = planMovement(game, ship, settings)[0]
        if (!best) continue
        if (best.order.turn) {
          actions.push({
            type: 'plot-turn',
            shipId: ship.id,
            direction: best.order.turn.direction,
            points: best.order.turn.points,
          })
        }
        if (best.order.accel !== 0) {
          actions.push({ type: 'plot-accel', shipId: ship.id, accel: best.order.accel })
        }
      }
      break

    case 'launch-missiles':
      // 6.3: a missile is aimed at a point, not at a ship, and attacks whatever
      // it finds within 6 MU of that point after movement — so the aim point is
      // where the target will BE, not where it is.
      for (const ship of mine) {
        for (const weapon of ship.design.weapons) {
          if (ship.destroyedSystems.has(weapon.id)) continue
          if (!LAUNCHER_CLASSES.has(weapon.weaponClass)) continue
          if (!canWeaponFire(ship, weapon.id)) continue
          const target = pickTarget(game, ship)
          if (!target) continue
          const aim = predict(target, 1)
          if (distance(ship.placement.position, aim) > maxRangeOf(weapon)) continue
          actions.push({
            type: 'launch-ordnance',
            shipId: ship.id,
            weaponId: weapon.id,
            aimPoint: aim,
          })
        }
      }
      break

    case 'move-ships':
      for (const ship of mine) actions.push({ type: 'move-ship', shipId: ship.id })
      // Ordnance flies with the ships (2.6 phase 5), once for the whole table.
      if (side === game.sides[0]?.id) actions.push({ type: 'move-ordnance' })
      break

    case 'point-defence':
      // Resolved once for the table: every ship shoots at what is coming for
      // it, and a marker killed is killed for everyone (2.6 phase 9).
      if (side === game.sides[0]?.id) actions.push({ type: 'resolve-point-defence' })
      break

    case 'ordnance-vs-ships':
      // Resolved once for the table rather than per side: a marker attacks
      // whatever it acquires, whoever launched it.
      if (side === game.sides[0]?.id) actions.push({ type: 'resolve-ordnance-attacks' })
      // Attack runs and gunboat attacks are this side's own, and belong here:
      // 8.7 resolves them after point defence, and 9.1 puts gunboats in the
      // same phase.
      actions.push(...planSmallCraftAttacks(game, side))
      break

    case 'ship-fire':
      for (const ship of mine) actions.push(...planFire(game, ship))
      break

    case 'move-fighters':
      actions.push(...planSmallCraftMoves(game, side, false))
      break

    case 'secondary-fighter-moves':
      actions.push(...planSmallCraftMoves(game, side, true))
      break

    case 'fighter-vs-fighter':
      actions.push(...planDogfights(game, side))
      break

    default:
      break
  }

  return actions
}

/**
 * What a ship shoots at, and with what (4.4, 4.2, 4.5).
 *
 * FireCon is the scarce thing — one target apiece — so the plan is: rank the
 * enemies you can actually hurt, spend your FireCon on the best of them in
 * order, then send every gun to whichever engaged target it does the most
 * damage against. Concentrating fire is usually right in Full Thrust, because a
 * ship is only worth points once it is crippled (4.12), but a gun that cannot
 * bear on the best target should still shoot at the second best rather than
 * sulk.
 */
export function planFire(game: GameState, ship: ShipState): GameAction[] {
  const actions: GameAction[] = []
  const enemies = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
  if (enemies.length === 0) return actions

  // 17.1: a target behind a planet cannot be shot at, so it is not a target.
  // Filtering here rather than at the shot keeps the computer from spending
  // FireCons on hulls it cannot reach.
  const bodies = game.terrain
    .filter((feature) => feature.kind === 'planet' || feature.kind === 'planetoid')
    .map((feature) => ({ id: feature.id, position: feature.position, radius: feature.radius }))

  // What each gun would do to each enemy, if anything.
  const shots = new Map<string, Array<{ weapon: (typeof ship.design.weapons)[number]; dice: number }>>()
  // 4.2: the aft arc is shut to offensive fire unless the table plays the
  // optional exception and this ship kept its hands off the throttle.
  const aftOpen = optional(game).aftArcFire === true && ship.thrustUsed === 0

  for (const enemy of enemies) {
    if (!hasLineOfFire(ship.placement.position, enemy.placement.position, bodies)) continue
    const range = distance(ship.placement.position, enemy.placement.position)
    const arc = arcTo(ship.placement.position, ship.placement.facing, enemy.placement.position)
    if (arc === 'A' && !aftOpen) continue
    const able = ship.design.weapons
      .filter((weapon) => !ship.destroyedSystems.has(weapon.id))
      .filter((weapon) => canWeaponFire(ship, weapon.id))
      // 16.2: an inverted ship's port batteries bear to starboard, so the
      // computer has to read its own attitude before it decides what bears.
      .filter((weapon) => arcsWhenInverted(weapon.arcs, ship.rollStatus.inverted).includes(arc))
      .filter((weapon) => range <= maxRangeOf(weapon))
      .map((weapon) => ({ weapon, dice: Math.max(1, weapon.rating - (rangeBand(range) - 1)) }))
    if (able.length > 0) shots.set(enemy.id, able)
  }
  if (shots.size === 0) return actions

  // Rank by weight of fire this ship can put on them, breaking ties towards
  // the one already hurt — the difference between two damaged cruisers and one
  // dead one is the difference between 50 points and 100 (4.12).
  const ranked = [...shots.entries()]
    .map(([id, able]) => {
      const enemy = enemies.find((e) => e.id === id)
      const hurt = enemy && enemy.design.hullBoxes > 0 ? enemy.hullMarked / enemy.design.hullBoxes : 0
      return { id, able, weight: able.reduce((sum, s) => sum + s.dice, 0) + hurt * 6 }
    })
    .sort((a, b) => b.weight - a.weight)

  // Engage as many as there is FireCon for, best first (4.4).
  const already = new Set(engagedTargets(ship, game.phase))
  let spare = availableFireCons(ship, game.phase)
  const engagedNow = new Set(already)
  for (const { id } of ranked) {
    if (engagedNow.has(id)) continue
    if (spare <= 0) break
    engagedNow.add(id)
    spare -= 1
  }

  // Every gun to the best engaged target it can reach.
  const spent = new Set<string>()
  for (const { id, able } of ranked) {
    if (!engagedNow.has(id)) continue
    for (const { weapon } of able) {
      if (spent.has(weapon.id)) continue
      // A weapon needing no FireCon — point defence used offensively — is not
      // bound by the engagement list.
      if (needsFireCon(weapon) && !engagedNow.has(id)) continue
      spent.add(weapon.id)
      actions.push({ type: 'fire-weapon', shipId: ship.id, weaponId: weapon.id, targetId: id })
    }
  }

  if (actions.length === 0) actions.push({ type: 'pass-fire', shipId: ship.id })
  return actions
}

/**
 * Where a ship would end up under an order — exported because the UI draws the
 * computer's intentions when a player asks to see them, and because it is the
 * one piece of this module worth testing directly.
 */
export function projectedPosition(ship: ShipState, order: MovementOrder): Point {
  const thrust = currentThrust(ship)
  const velocity = Math.max(0, ship.velocity + Math.max(-thrust, Math.min(thrust, order.accel)))
  const turn = order.turn
    ? order.turn.points * (order.turn.direction === 'starboard' ? 1 : -1)
    : 0
  return moveShip(ship.placement.position, ship.placement.facing, velocity, turn).position
}

// ---------------------------------------------------------------------------
// Small craft (8, 9)
// ---------------------------------------------------------------------------

/**
 * How the computer flies its wings and its gunboat squadrons.
 *
 * Deliberately simpler than the ship AI, and for a reason that is about the
 * game rather than about effort: a fighter group has no course, no velocity
 * and no orders to guess at, so there is no simultaneity to model and nothing
 * clever to do with a search. What is left is a standoff decision — get to the
 * range your guns work at and no closer, because 8.7's 6 MU and 9.1's 12 MU
 * are the whole of a small craft's tactics.
 *
 * It flies at ships rather than at other fighters. Trading fighters for
 * fighters is a losing exchange for whoever has fewer, and the computer cannot
 * tell whether it is that player; going for the hulls is the play that is
 * never actively wrong.
 */
function planSmallCraftMoves(game: GameState, side: string, secondary: boolean): GameAction[] {
  const actions: GameAction[] = []

  for (const group of game.fighterGroups) {
    if (group.side !== side) continue
    const carrier = group.carrierId ? game.ships.find((s) => s.id === group.carrierId) : undefined
    if (group.status === 'aboard' && !secondary && carrier) {
      // A launch the carrier cannot make is refused and costs nothing (8.2),
      // and the move that follows it is refused with it. Both go in the list:
      // the actions are applied in order, so a group that gets out of the
      // tube still gets its half move in the same phase (8.1).
      actions.push({ type: 'launch-flight', carrierId: carrier.id, flightId: group.id })
      const prey = nearestEnemyHull(game, group.side, carrier.placement.position)
      if (prey) {
        const to = standoff(
          carrier.placement.position,
          prey.placement.position,
          mainMoveAllowance(group, game.turn) / 2,
          FIGHTER_ATTACK_RANGE,
        )
        if (to) actions.push({ type: 'move-flight', flightId: group.id, to })
      }
      continue
    }
    if (group.status !== 'in-flight') continue
    if (secondary && isExhausted(group)) continue
    const prey = nearestEnemyHull(game, group.side, group.position)
    if (!prey) continue
    const allowance = secondary
      ? secondaryMoveAllowance(group)
      : mainMoveAllowance(group, game.turn)
    const to = standoff(group.position, prey.placement.position, allowance, FIGHTER_ATTACK_RANGE)
    if (!to) continue
    actions.push(
      secondary
        ? { type: 'secondary-move-flight', flightId: group.id, to }
        : { type: 'move-flight', flightId: group.id, to },
    )
  }

  for (const squadron of game.gunboatSquadrons) {
    if (squadron.side !== side) continue
    const tender = squadron.carrierId
      ? game.ships.find((s) => s.id === squadron.carrierId)
      : undefined
    if (squadron.status === 'aboard' && !secondary && tender) {
      actions.push({ type: 'launch-gunboats', carrierId: tender.id, squadronId: squadron.id })
      const prey = nearestEnemyHull(game, squadron.side, tender.placement.position)
      if (prey) {
        const to = standoff(
          tender.placement.position,
          prey.placement.position,
          GUNBOAT_MOVE,
          GUNBOAT_FIRE_CONTROL,
        )
        if (to) actions.push({ type: 'move-gunboats', squadronId: squadron.id, to })
      }
      continue
    }
    if (squadron.status !== 'in-flight') continue
    if (secondary && squadron.cef <= 0) continue
    const prey = nearestEnemyHull(game, squadron.side, squadron.position)
    if (!prey) continue
    const allowance = secondary ? GUNBOAT_SECONDARY_MOVE : GUNBOAT_MOVE
    const to = standoff(
      squadron.position,
      prey.placement.position,
      allowance,
      GUNBOAT_FIRE_CONTROL,
    )
    if (!to) continue
    actions.push({ type: 'move-gunboats', squadronId: squadron.id, to })
  }

  return actions
}

/** Attack runs and gunboat attacks, once everything is where it is going. */
function planSmallCraftAttacks(game: GameState, side: string): GameAction[] {
  const actions: GameAction[] = []

  for (const group of game.fighterGroups) {
    if (group.side !== side || group.status !== 'in-flight') continue
    if (isExhausted(group) || group.attackedThisTurn) continue
    const prey = nearestEnemyHull(game, side, group.position)
    if (!prey) continue
    if (distance(group.position, prey.placement.position) > FIGHTER_ATTACK_RANGE) continue
    actions.push({ type: 'flight-strike', flightId: group.id, targetId: prey.id })
  }

  for (const squadron of game.gunboatSquadrons) {
    if (squadron.side !== side || squadron.status !== 'in-flight') continue
    if (squadron.cef <= 0 || squadron.attackedThisTurn) continue
    const prey = nearestEnemyHull(game, side, squadron.position)
    if (!prey) continue
    if (distance(squadron.position, prey.placement.position) > GUNBOAT_FIRE_CONTROL) continue
    actions.push({ type: 'gunboat-attack', squadronId: squadron.id, targetId: prey.id })
  }

  return actions
}

/**
 * Dogfights (8.10). A group that an enemy has closed with is going to be in
 * one whether it likes it or not, so the computer engages rather than being
 * engaged: the fire is simultaneous either way and the one that declares gets
 * to pick which enemy it is simultaneous with.
 */
function planDogfights(game: GameState, side: string): GameAction[] {
  const actions: GameAction[] = []
  const taken = new Set<string>()

  for (const group of game.fighterGroups) {
    if (group.side !== side || group.status !== 'in-flight') continue
    if (isExhausted(group) || group.attackedThisTurn) continue
    const enemy = game.fighterGroups
      .filter(
        (other) =>
          other.side !== side &&
          other.status === 'in-flight' &&
          !taken.has(other.id) &&
          distance(group.position, other.position) <= FIGHTER_ATTACK_RANGE,
      )
      .sort((a, b) => distance(group.position, a.position) - distance(group.position, b.position))[0]
    if (!enemy) continue
    taken.add(enemy.id)
    actions.push({ type: 'flight-dogfight', flightId: group.id, targetFlightId: enemy.id })
  }

  return actions
}

/** Whether this ship still has a wing or a squadron waiting to go up (8.1). */
function hasCraftAboard(game: GameState, ship: ShipState): boolean {
  return (
    game.fighterGroups.some((g) => g.carrierId === ship.id && g.status === 'aboard') ||
    game.gunboatSquadrons.some((s) => s.carrierId === ship.id && s.status === 'aboard')
  )
}

/** The nearest live enemy hull to a point. */
function nearestEnemyHull(game: GameState, side: string, from: Point): ShipState | undefined {
  const enemies = game.ships.filter(
    (ship) => ship.side !== side && !ship.destroyed && !ship.offTable,
  )
  if (enemies.length === 0) return undefined
  return enemies.reduce((best, ship) =>
    distance(from, ship.placement.position) < distance(from, best.placement.position) ? ship : best,
  )
}

/**
 * A point `standoff` MU short of the target, as far along as this move allows.
 *
 * Stopping short is the whole point: a group that flies onto its target has
 * spent its move to arrive at the same range it could have reached from
 * further out, and given the enemy's point defence a closer shot for it. Null
 * when the group is already where it wants to be.
 */
function standoff(from: Point, to: Point, allowance: number, keep: number): Point | null {
  const span = distance(from, to)
  const want = Math.max(0, span - keep * 0.8)
  if (want <= 1e-9) return null
  const travel = Math.min(allowance, want)
  const t = travel / span
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}
