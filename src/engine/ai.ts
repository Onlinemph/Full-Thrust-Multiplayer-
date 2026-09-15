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
  validateSquadron,
} from './movement'
import {
  availableFireCons,
  canWeaponFire,
  currentThrust,
  enemiesOf,
  engagedTargets,
  hullRemaining,
  shipsAwaitingDeployment,
  type GameState,
  type ShipState,
  type SideId,
} from './game'
import { maxRangeOf, needsFireCon } from './weapons'
import {
  isExhausted,
  mainMoveAllowance,
  secondaryMoveAllowance,
  FIGHTER_ATTACK_RANGE,
} from './fighters'
import { GUNBOAT_FIRE_CONTROL, GUNBOAT_MOVE, GUNBOAT_SECONDARY_MOVE } from './gunboats'
import { PLASMA_BOLT_BLAST_RADIUS } from './ordnance'
import { ANTIMATTER_CHARGE_BLAST_RADIUS } from './defences'
import { NOVA_SWEEPS, WAVE_GUN_BANDS, WAVE_GUN_CHARGE_TARGET, templateContacts } from './ew'
import {
  canMountFlak,
  projectileLine,
  FLAK_BLAST_RADIUS_MU,
  FLAK_MARKER_RANGE,
} from './weapons/kinetics'
import {
  collisionAvoidanceTarget,
  createGravityWell,
  gravityZoneAt,
  hasLineOfFire,
  meteorFieldDice,
  stationaryCollisionRisk,
  CLOUD_SAFE_VELOCITY,
} from './terrain'
import { arcsWhenInverted, coursesMatched } from './specialmoves'
import {
  antiShipPdMounts,
  deployingSide,
  novaArmedOn,
  optional,
  pointDefenceCanEngage,
  rulesReading,
  waveGunCharge,
  proposeDeployment,
  shipsAwaitingGateEntry,
  type GameAction,
} from './actions'
import { canShipFire } from './game'
import { isGateActive } from './ftl'
import { isInSpinalArc, isSpinalMount, spinalCanFire } from './weapons/kinetics'
import type { MovementOrder, Point, TurnDirection, WeaponDef } from './types'
import type { Rng } from './dice'

/**
 * How close the computer lets an enemy get before it lets its riders go (11.7).
 *
 * A rider that detaches early loses the Mothership's screens for nothing; one
 * that detaches too late dies with the Mothership, which is what 11.7 does to
 * riders with nothing left to carry them. Beam-2 range is the compromise: the
 * riders come off in time to shoot on the pass.
 */
const RIDER_RELEASE_RANGE = 24

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

  // 17.9: a gravity zone is not a hazard in itself — it adds speed, takes it
  // away, or swings the ship round — but the swing is towards the centre, and
  // a ship that lets a planet turn it is a ship being fed into the planet a
  // turn or two later. So the computer treats depth in a well as a cost, which
  // is what keeps it out of the well rather than out of the rock alone.
  for (const feature of game.terrain) {
    if (feature.gravity === undefined) continue
    const well = createGravityWell(feature.position, feature.radius, feature.gravity)
    const zone = gravityZoneAt(well, result.placement.position)
    if (zone) penalty += zone.strength * 45
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
  const table = game.table
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
/** The closest enemy hull a group could go in on, or null (8.7). */
function nearestEnemyShipTo(
  game: GameState,
  from: Point,
  side: SideId,
  within: number,
): ShipState | null {
  let best: ShipState | null = null
  let bestRange = Number.POSITIVE_INFINITY
  for (const ship of game.ships) {
    if (ship.side === side || ship.destroyed || ship.offTable || ship.captured) continue
    const range = distance(from, ship.placement.position)
    if (range > within || range >= bestRange) continue
    bestRange = range
    best = ship
  }
  return best
}

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
      // 18.1 comes before the order is written, and until it is done there is
      // nothing to write an order about — a ship that has not been placed has
      // no station to plot a course from.
      if (game.deployment && shipsAwaitingDeployment(game).length > 0) {
        if (game.deployment.order.length === 0) {
          actions.push({ type: 'roll-deployment-order' })
          break
        }
        if (deployingSide(game) !== side) break
        // One batch, then hand back: 18.1 alternates, and the loop that drives
        // the computer calls this again for whoever is next.
        for (const spot of proposeDeployment(game, side).slice(0, game.deployment.batch)) {
          actions.push({ type: 'deploy-ship', ...spot })
        }
        break
      }
      // 11.9: a gate this side holds with ships waiting behind it is switched
      // on now, because the order is written in phase 1 and the announcement
      // is a phase away. A gate somebody else holds is the defender's roll,
      // and the computer tries it anyway: three turns of delay is the worst
      // it can cost, and the relief is not coming any other way.
      for (const gate of game.gates) {
        if (gate.def.natural) continue
        if (isGateActive(gate.def, gate.state, game.turn + 1)) continue
        if (gate.activationOrderedBy !== null) continue
        const waiting = shipsAwaitingGateEntry(game).some((ship) => ship.side === side)
        const leaving = game.ships.some(
          (ship) =>
            ship.side === side &&
            !ship.destroyed &&
            !ship.offTable &&
            distance(ship.placement.position, gate.def.position) <= 1,
        )
        if (!waiting && !leaving) continue
        actions.push({ type: 'plot-gate-activation', gateId: gate.def.id, side, on: true })
      }
      // 11.7: the riders come off when the enemy is close enough that they can
      // do something about it. Too early and they lose the Mothership's
      // screens for nothing; too late and the Mothership is dead with them
      // still clamped to it, which 11.7 scores as their destruction.
      for (const rider of mine) {
        if (rider.carriedBy === null) continue
        const enemy = pickTarget(game, rider)
        if (!enemy) continue
        if (distance(rider.placement.position, enemy.placement.position) > RIDER_RELEASE_RANGE) {
          continue
        }
        actions.push({ type: 'detach-hull', shipId: rider.id })
      }
      // 16.3: a hull that cannot move is worth more on a line than adrift.
      // The link is begun in phase 1 and takes a whole turn to make, so the
      // question is asked before anything is plotted — and 16.3's match test
      // is strict enough that it only ever finds a pair that is already
      // station-keeping, which is exactly when a tow is the right idea.
      for (const load of mine) {
        if (load.tow !== null || load.carriedBy !== null) continue
        if (currentThrust(load) > 0) continue
        const tug = mine.find(
          (other) =>
            other.id !== load.id &&
            other.tow === null &&
            other.carriedBy === null &&
            currentThrust(other) > 0 &&
            !game.ships.some((third) => third.tow?.tugId === other.id) &&
            coursesMatched(
              {
                position: other.placement.position,
                facing: other.placement.facing,
                velocity: other.velocity,
              },
              {
                position: load.placement.position,
                facing: load.placement.facing,
                velocity: load.velocity,
              },
            ).matched,
        )
        if (tug) actions.push({ type: 'begin-tow', tugId: tug.id, loadId: load.id })
      }

      // 3.7: "a squadron is two to four ships in line ahead, line abreast,
      // wedge, or diamond formation, and moves on a single order." Formed at
      // the start of the turn and before any course is written, which is why
      // it comes before the loop below — a ship that joins a squadron flies
      // the leader's order and plots none of its own.
      for (const group of proposeSquadrons(game, side)) {
        actions.push({
          type: 'form-squadron',
          squadronId: group.id,
          formation: 'line-ahead',
          shipIds: group.shipIds,
        })
      }

      for (const ship of mine) {
        // 7.23: arming the Nova Cannon costs the whole ship for a turn, so it
        // is decided before the course is, and it tears up any course written.
        const nova = novaWorthArming(game, ship)
        if (nova) {
          actions.push({ type: 'arm-nova-cannon', shipId: ship.id, weaponId: nova.id, on: true })
          continue
        }
        // 7.9: a hull that is not getting home is worth more as a bomb. The
        // charge goes off at the top of phase 13, so the question is whether
        // there will still be something inside 3 MU by then — and the answer
        // has to be yes now, because the order cannot be taken back after
        // phase 1.
        if (worthDetonating(game, ship)) {
          actions.push({ type: 'plot-detonate', shipId: ship.id, on: true })
          continue
        }
        // 7.24: charging costs nothing but the order — the ship may still
        // thrust, turn and shoot while the capacitors fill — so a Wave Gun
        // that is not yet charged is always charging. It stops on its own
        // once full, because an over-charged capacitor is only a bigger bang
        // for the ship carrying it if the gun is knocked out.
        for (const gun of ship.design.weapons) {
          if (gun.weaponClass !== 'wave-gun') continue
          if (ship.destroyedSystems.has(gun.id)) continue
          if (waveGunCharge(game, ship, gun.id) >= WAVE_GUN_CHARGE_TARGET) continue
          actions.push({ type: 'charge-wave-gun', shipId: ship.id, weaponId: gun.id })
        }
        // 8.1: a carrier with a wing still in the bay writes "Launch" and
        // nothing else — 8.2 refuses the launch outright if it spent thrust.
        // Holding station for a turn is what the launch costs, and a carrier
        // that never pays it is a carrier that never launches.
        if (hasCraftAboard(game, ship)) continue
        // 17.8: a ship in orbit is carried round the track and the only order
        // that reaches it is the throttle — where slowing down means the
        // atmosphere and speeding up means leaving. The computer holds the
        // orbit rather than gambling either way; nothing it plots up here is
        // worth what losing the hull costs.
        if (ship.orbit) continue
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
      // 2.6 will not leave phase 1 while a ship has no order, and the loop
      // above has several ways of saying nothing about a ship — a carrier
      // holding station to launch, a ship in orbit, a plan that came out as
      // "straight on". Every one of those is an order to hold course, so it
      // is written down as one, and the phase can end.
      for (const ship of mine) {
        if (ship.order !== null) continue
        const spoken = actions.some(
          (action) =>
            (action.type === 'plot-turn' || action.type === 'plot-accel') &&
            action.shipId === ship.id,
        )
        if (!spoken) actions.push({ type: 'plot-accel', shipId: ship.id, accel: 0 })
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

        // 6.7 and 6.8 launch in the same phase and neither is aimed like a
        // missile: a rocket pod names a ship and rolls now, a plasma bolt puts
        // a marker on the table and waits for phase 10.
        for (const weapon of ship.design.weapons) {
          if (ship.destroyedSystems.has(weapon.id)) continue
          if (!canWeaponFire(ship, weapon.id)) continue
          const target = pickTarget(game, ship)
          if (!target) continue
          if (weapon.weaponClass === 'rocket-pod') {
            if (distance(ship.placement.position, target.placement.position) > maxRangeOf(weapon)) {
              continue
            }
            actions.push({
              type: 'fire-rocket-pod',
              shipId: ship.id,
              weaponId: weapon.id,
              targetId: target.id,
            })
            continue
          }
          if (weapon.weaponClass !== 'plasma-bolt-launcher') continue
          // The bubble is 6 MU across, so a bolt put where the target will be
          // catches it even if the prediction is a move out.
          const aim = predict(target, 1)
          if (distance(ship.placement.position, aim) > maxRangeOf(weapon)) continue
          // 6.8 does not care whose ships are inside the blast. A computer that
          // drops one on its own line has not understood the weapon.
          const friendlyInBlast = game.ships.some(
            (other) =>
              other.side === ship.side &&
              !other.destroyed &&
              !other.offTable &&
              distance(predict(other, 1), aim) <= PLASMA_BOLT_BLAST_RADIUS,
          )
          if (friendlyInBlast) continue
          actions.push({
            type: 'launch-plasma-bolt',
            shipId: ship.id,
            weaponId: weapon.id,
            aimPoint: aim,
          })
        }

        for (const shot of flakBarrages(game, ship)) actions.push(shot)
      }
      break

    case 'move-ships':
      // 11.9: the announcement the order in phase 1 was written for, and then
      // whatever the gate will let through.
      for (const gate of game.gates) {
        if (gate.activationOrderedBy === side && gate.activationOrderTurn === game.turn) {
          actions.push({ type: 'announce-gate-activation', gateId: gate.def.id })
        }
      }
      // 2.6 phase 5: the ships fly first; anything entering or leaving FTL —
      // a gate entry, an arrival dropping out of hyperspace — is placed last.
      for (const ship of mine) actions.push({ type: 'move-ship', shipId: ship.id })
      for (const ship of shipsAwaitingGateEntry(game)) {
        if (ship.side !== side) continue
        const gate = game.gates.find((candidate) => candidate.def.id === ship.awaitingGate)
        if (!gate || !isGateActive(gate.def, gate.state, game.turn)) continue
        actions.push({
          type: 'gate-entry',
          shipId: ship.id,
          gateId: gate.def.id,
          velocity: currentThrust(ship),
          course: gate.def.facing === null ? ship.placement.facing : undefined,
        })
      }
      // 11.5: an inbound hull's arrival IS its move, so it comes in before
      // anything else is flown. The computer brings it out where the scenario
      // said; the dice decide where that turns out to be.
      for (const ship of game.ships) {
        if (ship.side !== side || ship.ftlArrival === null || ship.destroyed) continue
        actions.push({
          type: 'enter-from-ftl',
          shipId: ship.id,
          entryPoint: ship.ftlArrival.entryPoint,
          course: ship.ftlArrival.course,
          velocity: ship.ftlArrival.velocity,
        })
      }
      // Ordnance flies with the ships (2.6 phase 5), once for the whole table.
      if (side === game.sides[0]?.id) actions.push({ type: 'move-ordnance' })
      break

    case 'allocate-attacks':
      // 8.7: a group names its target here, so the ship it is going in on gets
      // its point defence in phase 9. Without the declaration the run still
      // happens; the gunners just never see it coming.
      for (const flight of game.fighterGroups) {
        if (flight.side !== side || flight.status !== 'in-flight' || flight.strength <= 0) continue
        const target = nearestEnemyShipTo(game, flight.position, side, FIGHTER_ATTACK_RANGE)
        if (!target) continue
        actions.push({ type: 'flight-declare-target', flightId: flight.id, targetId: target.id })
      }
      break

    case 'point-defence':
      // Resolved once for the table: every ship shoots at what is coming for
      // it, and a marker killed is killed for everyone (2.6 phase 9).
      if (side === game.sides[0]?.id) {
        actions.push({ type: 'resolve-point-defence' })
        // 8.8 is its own sweep, because it draws its own dice.
        actions.push({ type: 'resolve-point-defence-at-flights' })
      }
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

    case 'ship-fire': {
      // 2.6: from reading 16 the phase is fired in turns, one ship's whole
      // declared fire at a time, so the computer takes one ship when the turn
      // is its own and comes back for the next when the turn comes round —
      // the console driving it re-asks each time the sequence moves on.
      const inTurns = rulesReading(game) >= 16
      if (inTurns && game.fire.side !== null && game.fire.side !== side) break
      const shooters = inTurns ? mine.filter((ship) => canShipFire(ship) && !ship.captured) : mine
      for (const ship of shooters) {
        // 7.23: an armed cannon fires and nothing else does, so the shot is
        // taken instead of the fire plan rather than alongside it.
        const nova = ship.design.weapons.find(
          (weapon) =>
            weapon.weaponClass === 'nova-cannon' && !ship.destroyedSystems.has(weapon.id),
        )
        if (nova && novaArmedOn(game, ship)) {
          actions.push({ type: 'fire-nova-cannon', shipId: ship.id, weaponId: nova.id })
          if (inTurns) break
          continue
        }
        // 7.24: letting the wave go costs every other gun on the hull for the
        // turn and opens the forward screens, so it is worth it only when the
        // front will actually touch something.
        const wave = waveWorthFiring(game, ship)
        if (wave) {
          actions.push({ type: 'fire-wave-gun', shipId: ship.id, weaponId: wave.id })
          if (inTurns) break
          continue
        }
        const plan = planFire(game, ship)
        if (!inTurns) {
          actions.push(...plan)
          continue
        }
        // The plan as one declaration: the beam that is laid on a point goes
        // first on its own, and every shot at a ship or a group rides in the
        // volley. A ship with nothing worth firing holds its fire, which is
        // what passes the turn on.
        const shots: Array<{ weaponId: string; targetId: string; kind?: 'ship' | 'flight' | 'gunboats' }> = []
        for (const action of plan) {
          if (action.type === 'fire-weapon') shots.push({ weaponId: action.weaponId, targetId: action.targetId })
          else if (action.type === 'fire-at-flight') {
            shots.push({ weaponId: action.weaponId, targetId: action.flightId, kind: 'flight' })
          } else if (action.type === 'fire-at-gunboats') {
            shots.push({ weaponId: action.weaponId, targetId: action.squadronId, kind: 'gunboats' })
          } else actions.push(action)
        }
        if (shots.length > 0) actions.push({ type: 'fire-volley', shipId: ship.id, shots })
        else if (actions.length === 0) actions.push({ type: 'pass-fire', shipId: ship.id })
        break
      }
      break
    }

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

  // 5.23: a Spinal Mount is laid on a point, and the point worth laying it on
  // is whatever enemy is nearest the bow — the beam catches everything behind
  // it down the line, so aiming at the closest target in arc puts the most
  // table behind the shot.
  for (const weapon of ship.design.weapons) {
    if (!isSpinalMount(weapon)) continue
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!canWeaponFire(ship, weapon.id)) continue
    if (!spinalCanFire(ship.weaponLastFiredTurn.get(weapon.id) ?? null, game.turn)) continue
    const inArc = enemies
      .filter((enemy) =>
        isInSpinalArc(ship.placement.position, ship.placement.facing, enemy.placement.position),
      )
      .filter(
        (enemy) =>
          distance(ship.placement.position, enemy.placement.position) <= maxRangeOf(weapon),
      )
      .sort(
        (a, b) =>
          distance(ship.placement.position, a.placement.position) -
          distance(ship.placement.position, b.placement.position),
      )
    const aim = inArc[0]
    if (!aim) continue
    actions.push({
      type: 'fire-spinal-mount',
      shipId: ship.id,
      weaponId: weapon.id,
      aimPoint: { ...aim.placement.position },
    })
  }

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
      // A Spinal Mount has already been laid above, on a point rather than
      // at a ship, and `fire-weapon` refuses it (5.23).
      .filter((weapon) => !isSpinalMount(weapon))
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

  // 7.12: a hull with no screens and no armour left is soft enough for point
  // defence to finish, and a PDS that has nothing inbound to shoot at is
  // otherwise doing nothing at all this turn.
  for (const shot of antiShipPointDefence(game, ship)) actions.push(shot)

  if (actions.length === 0) actions.push({ type: 'pass-fire', shipId: ship.id })
  return actions
}

/**
 * Point defence used as a gun (7.12, 7.13).
 *
 * *"Point Defense Systems can only be fired against ships without an
 * operational screen/field (of any type) or any remaining armor boxes – i.e.
 * undamaged warships are not vulnerable to such light weapons."* One die each,
 * a 6 for a point, 6 MU — worth nothing against a fresh cruiser and worth
 * having against a hulk that is one box from going.
 *
 * A mount that shot at a missile in phase 9 is already spent (2.6), so the
 * computer only ever reaches for the ones a quiet phase 9 left loaded.
 */
function antiShipPointDefence(game: GameState, ship: ShipState): GameAction[] {
  const soft = enemiesOf(game, ship).filter((enemy) => pointDefenceCanEngage(game, ship, enemy))
  if (soft.length === 0) return []
  // The one nearest going: 4.12 scores a cripple once it is finished.
  const mark = soft.reduce((best, enemy) =>
    hullRemaining(enemy) < hullRemaining(best) ? enemy : best,
  )
  return antiShipPdMounts(game, ship, mark).map((mount) => ({
    type: 'fire-point-defence' as const,
    shipId: ship.id,
    systemId: mount.id,
    targetId: mark.id,
  }))
}

// ---------------------------------------------------------------------------
// Small craft (8, 9)
// ---------------------------------------------------------------------------

/**
 * Squadrons worth forming this turn (3.7).
 *
 * *"A squadron is two to four ships ... and moves on a single order"*, which is
 * worth having when the ships are already flying together: a line that keeps
 * station concentrates its fire and turns as one. It is worth nothing at all
 * when they are scattered, and 3.7 will not have it — *"squadrons cannot mix
 * ships with standard and Advanced Drives"* — so the grouping is by drive type
 * and by proximity, and `validateSquadron` gets the last word.
 *
 * Ships already in a squadron are left alone: re-forming one every turn would
 * churn the journal for nothing, and 3.7's straggler clause already handles a
 * member that falls behind.
 */
function proposeSquadrons(
  game: GameState,
  side: string,
): Array<{ id: string; shipIds: string[] }> {
  const free = game.ships.filter(
    (ship) =>
      ship.side === side &&
      !ship.destroyed &&
      !ship.offTable &&
      ship.squadronId === null &&
      ship.carriedBy === null &&
      ship.tow === null &&
      ship.orbit === null &&
      currentThrust(ship) > 0,
  )
  if (free.length < 2) return []

  const groups: Array<{ id: string; shipIds: string[] }> = []
  const taken = new Set<string>()
  for (const lead of free) {
    if (taken.has(lead.id)) continue
    const members = [lead]
    for (const other of free) {
      if (members.length >= SQUADRON_MAX) break
      if (other.id === lead.id || taken.has(other.id)) continue
      if (other.design.drive.advanced !== lead.design.drive.advanced) continue
      if (distance(lead.placement.position, other.placement.position) > SQUADRON_FORM_RANGE) {
        continue
      }
      members.push(other)
    }
    if (members.length < 2) continue
    const check = validateSquadron({
      id: `sq-${side}-${lead.id}`,
      formation: 'line-ahead',
      members: members.map((ship) => ({
        id: ship.id,
        placement: ship.placement,
        drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
      })),
      velocity: lead.velocity,
    })
    if (!check.legal) continue
    for (const ship of members) taken.add(ship.id)
    groups.push({ id: `sq-${side}-${lead.id}`, shipIds: members.map((ship) => ship.id) })
  }
  return groups
}

/** 3.7: "two to four ships" outside an escort ring. */
const SQUADRON_MAX = 4

/**
 * How close two hulls have to be before the computer flies them as one (3.7).
 *
 * READING. 3.7 gives no distance — a squadron is a formation the players agree
 * on. Twelve MU is one standard turn's worth of separation: close enough that a
 * single order suits them all, far enough that a line of four is not a stack.
 */
const SQUADRON_FORM_RANGE = 12

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

/**
 * 5.16's Flak barrages, from the computer's side of the table.
 *
 * A barrage is a tripwire, not a shot: the Blast Marker goes up in phase 3 and
 * kills whatever flies through it before phase 7. So the computer looks for
 * something that is going to be somewhere — an enemy salvo, which sits still
 * on the table until the Missile Attack Phase, or an enemy wing, which will be
 * running in on the nearest hull it can reach — and lays the shrapnel there.
 *
 * The rule cuts both ways: *"It is possible to affect multiple targets
 * including your own ordnance or fighters."* Anything of the computer's own
 * inside the blast cancels the barrage, because a captain who shreds his own
 * escort to scratch a missile has not read the weapon.
 */
function flakBarrages(game: GameState, ship: ShipState): GameAction[] {
  const guns = ship.design.weapons.filter(
    (weapon) =>
      canMountFlak(weapon) &&
      weapon.flak === true &&
      !ship.destroyedSystems.has(weapon.id) &&
      canWeaponFire(ship, weapon.id),
  )
  if (guns.length === 0) return []

  // 5.16: "one FireCon is required to fire a barrage", so however many guns
  // are loaded, only as many barrages go up as there are FireCons free.
  let budget = availableFireCons(ship, game.phase)
  if (budget <= 0) return []

  const threats: Point[] = []
  // A salvo does not move until phase 7, so the marker is its own prediction.
  for (const marker of game.ordnance) {
    if (marker.side === ship.side) continue
    threats.push(marker.position)
  }
  // A wing has not written an order — it flies in phase 4, at a hull. The one
  // it is closest to is the one worth guessing at.
  for (const group of game.fighterGroups) {
    if (group.side === ship.side || group.status !== 'in-flight') continue
    const prey = nearestEnemyHull(game, group.side, group.position)
    if (!prey) continue
    const run = standoff(
      group.position,
      prey.placement.position,
      mainMoveAllowance(group, game.turn),
      FIGHTER_ATTACK_RANGE,
    )
    threats.push(run ?? group.position)
  }
  if (threats.length === 0) return []

  const friendlyInBlast = (aim: Point): boolean =>
    game.ships.some(
      (other) =>
        other.side === ship.side &&
        !other.destroyed &&
        !other.offTable &&
        distance(predict(other, 1), aim) <= FLAK_BLAST_RADIUS_MU,
    ) ||
    game.fighterGroups.some(
      (group) =>
        group.side === ship.side &&
        group.status === 'in-flight' &&
        distance(group.position, aim) <= FLAK_BLAST_RADIUS_MU,
    ) ||
    game.ordnance.some(
      (marker) => marker.side === ship.side && distance(marker.position, aim) <= FLAK_BLAST_RADIUS_MU,
    )

  const actions: GameAction[] = []
  const taken: Point[] = []
  for (const weapon of guns) {
    if (budget <= 0) break
    const reach = FLAK_MARKER_RANGE[projectileLine(weapon.variant)]
    const aim = threats.find((point) => {
      if (distance(ship.placement.position, point) > reach) return false
      if (!bearsOn(weapon.arcs, arcTo(ship.placement.position, ship.placement.facing, point))) {
        return false
      }
      // Two markers 2 MU apart is one marker's worth of shrapnel and two
      // FireCons spent.
      if (taken.some((used) => distance(used, point) <= FLAK_BLAST_RADIUS_MU * 2)) return false
      return !friendlyInBlast(point)
    })
    if (!aim) continue
    taken.push(aim)
    budget -= 1
    actions.push({
      type: 'fire-flak-barrage',
      shipId: ship.id,
      weaponId: weapon.id,
      aimPoint: aim,
    })
  }
  return actions
}

/**
 * Whether it is worth spending the whole ship on a Nova Cannon shot (7.23).
 *
 * The cannon is not a gun the computer adds to its fire plan: arming it means
 * *"it may not apply any thrust to accelerate or maneuver, it may not fire any
 * other weapons, and even its screens do not function"*. So the question is
 * not "can it reach" but "is there a hull on the bow line worth standing still
 * and unscreened for a turn".
 *
 * The answer is the first two sweeps. The round is thrown 6 MU ahead and runs
 * to 24 on the firing turn behind a 2 MU template, then to 48 behind a 4 MU
 * one; anything the computer can put inside either is worth 6D6 of penetrating
 * damage that no screen and no armour will answer. Beyond that the template is
 * wide but the shot is 2D6 and a turn and a half away, which is not worth a
 * ship's whole turn.
 */
function novaWorthArming(game: GameState, ship: ShipState): WeaponDef | null {
  const cannon = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'nova-cannon' && !ship.destroyedSystems.has(weapon.id),
  )
  if (!cannon) return null
  if (novaArmedOn(game, ship)) return null
  // The burst starts where the ship will be standing when it fires, and the
  // ship it fires from cannot turn between now and then — that is the point of
  // the power-down, and it is what makes the aim predictable at all.
  const origin = predict(ship, 1)
  const course = ship.placement.facing
  const worthIt = ([1, 2] as const).some((stage) => {
    const sweep = NOVA_SWEEPS[stage]
    return game.ships.some(
      (enemy) =>
        enemy.side !== ship.side &&
        !enemy.destroyed &&
        !enemy.offTable &&
        enemy.carriedBy === null &&
        templateContacts(origin, course, sweep.fromMu, sweep.toMu, sweep.diameter, predict(enemy, 1)),
    )
  })
  if (!worthIt) return null
  // 7.23 does not exempt the firer's own fleet, and a nova is 6D6 penetrating.
  const ownInPath = ([1, 2, 3] as const).some((stage) => {
    const sweep = NOVA_SWEEPS[stage]
    return game.ships.some(
      (other) =>
        other.side === ship.side &&
        other.id !== ship.id &&
        !other.destroyed &&
        !other.offTable &&
        templateContacts(origin, course, sweep.fromMu, sweep.toMu, sweep.diameter, predict(other, 1)),
    )
  })
  return ownInPath ? null : cannon
}

/**
 * Whether the wave is worth letting go this turn (7.24).
 *
 * The gun is charged or it is not, and a charged gun keeps its charge for
 * nothing — *"may then be fired on any turn"* — so the only question is
 * whether the front will touch a hull. It costs every other gun on the ship
 * and the forward screens for the turn, so a wave fired down an empty lane is
 * worse than not firing at all.
 *
 * The front is measured from where the ship is standing now, which is where it
 * will be standing in phase 11: the ships have already moved by the time this
 * is asked.
 */
function waveWorthFiring(game: GameState, ship: ShipState): WeaponDef | null {
  const gun = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'wave-gun' && !ship.destroyedSystems.has(weapon.id),
  )
  if (!gun) return null
  if (waveGunCharge(game, ship, gun.id) < WAVE_GUN_CHARGE_TARGET) return null

  const origin = ship.placement.position
  const course = ship.placement.facing
  const touches = (other: ShipState): boolean =>
    WAVE_GUN_BANDS.some((band) =>
      templateContacts(origin, course, band.fromMu, band.toMu, band.diameter, other.placement.position),
    )
  const worthIt = game.ships.some(
    (enemy) =>
      enemy.side !== ship.side && !enemy.destroyed && !enemy.offTable && enemy.carriedBy === null &&
      touches(enemy),
  )
  if (!worthIt) return null
  // 7.24 does not exempt the firer's own fleet from the wave front either.
  const ownInPath = game.ships.some(
    (other) =>
      other.side === ship.side &&
      other.id !== ship.id &&
      !other.destroyed &&
      !other.offTable &&
      touches(other),
  )
  return ownInPath ? null : gun
}

/**
 * Whether this hull is worth more as a bomb than as a ship (7.9).
 *
 * The charge is a last resort and the computer treats it as one: the ship has
 * to be past saving — more than two thirds of its hull gone, which on any
 * layout is inside the last threshold row — and there has to be an enemy hull
 * close enough to be worth the 3d6 a charge throws at 1 MU. Ordering it early
 * wastes the ship; ordering it with nothing alongside wastes the charge.
 *
 * The prediction is where both ships will be after the move, since the blast
 * happens in phase 13 and the order is written in phase 1.
 */
function worthDetonating(game: GameState, ship: ShipState): boolean {
  if (ship.detonateOrderedTurn !== null) return false
  const charges = ship.design.systems.filter(
    (system) => system.kind === 'antimatter-charge' && !ship.destroyedSystems.has(system.id),
  )
  if (charges.length === 0) return false
  const gone = ship.hullMarked / Math.max(1, ship.design.hullBoxes)
  if (gone < 2 / 3) return false
  const here = predict(ship, 1)
  return game.ships.some(
    (enemy) =>
      enemy.side !== ship.side &&
      !enemy.destroyed &&
      !enemy.offTable &&
      enemy.carriedBy === null &&
      distance(here, predict(enemy, 1)) <= ANTIMATTER_CHARGE_BLAST_RADIUS,
  )
}
