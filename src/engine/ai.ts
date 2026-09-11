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
import { applyOrder, driveFromDef, standardTurnAllowance, validateOrder, type MovementState } from './movement'
import { currentThrust, enemiesOf, type GameState, type ShipState } from './game'
import type { GameAction } from './actions'
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
  // ship's surviving armament can fire into it (4.2).
  const arc = arcTo(result.placement.position, result.placement.facing, enemyAt)
  const band = rangeBand(range)
  for (const weapon of ship.design.weapons) {
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!bearsOn(weapon.arcs, arc)) continue
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

  return score
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

    case 'move-ships':
      for (const ship of mine) actions.push({ type: 'move-ship', shipId: ship.id })
      break

    default:
      break
  }

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
