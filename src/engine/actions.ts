/**
 * Every mutation the game accepts, as a named, serializable record.
 *
 * The UI never mutates the game directly — it dispatches one of these, and the
 * store journals what it dispatched. Because the engine is deterministic and
 * the RNG is seeded, (setup + journal) reconstructs the game exactly, which is
 * what save/resume, undo, replays and two browsers staying in step are made of.
 *
 * Two rules keep replay honest:
 *
 *  1. Payloads carry ids and player choices only — never derived state. Each
 *     handler re-derives its context (range, arc, screen level, ECM, cloak)
 *     from the game itself, so a stale or hand-edited payload cannot make a
 *     replay disagree with the original battle.
 *  2. A refused action mutates nothing and is refused identically on replay,
 *     so journalling refusals is harmless — and it has to be harmless, because
 *     the journal records everything the player tried.
 */

import {
  advancePhase,
  assignDamageControl,
  assignFireCon,
  availableDamageControlParties,
  availableFireCons,
  canWeaponFire,
  currentThrust,
  engagedTargets,
  hullRowsCompleted,
  markHullBoxes,
  markShipFired,
  markWeaponFired,
  pushLog,
  rollInitiative,
  setInitiativeOrder,
  shipById,
  shipsAwaitingDeployment,
  tableBounds,
  vectorStateOf,
  type FighterGroupState,
  type TerrainKind,
  type GameState,
  type GunboatSquadronState,
  type ShipState,
  type SideId,
} from './game'
import {
  applyOrder,
  departureEdge,
  driveFromDef,
  formatOrder,
  isOffTable,
  rollEmergencyThrust,
  rollTableReentry,
  thrustBudget,
  validateOrder,
  type MovementState,
} from './movement'
import { applyDamage, createTargetState, type DamageableTarget } from './combat'
import {
  cloudSpeedDamage,
  hasLineOfFire,
  resolveCollision,
  resolveMeteorField,
  stationaryCollisionRisk,
  type TerrainBody,
} from './terrain'
import {
  arcsWhenInverted,
  canManoeuvre,
  crowdedEdge,
  dockingApproach,
  holdApproach,
  isDocked,
  leavingTableIsRetreat,
  orderCastOff,
  readyToDisengage,
  resolveDisengagement,
  resolveRam,
  rollShip,
  tableShift,
  type TableEdge as ShiftEdge,
} from './specialmoves'
import { defaultPlacements, validatePlacement } from './battles'
import {
  formatVectorOrders,
  moveVector,
  validateVectorOrders,
  VECTOR_ORDER_KINDS,
  type VectorOrder,
} from './vectormovement'
import {
  ftlExitRestrictions,
  ftlExitStage,
  resolveFtlExit,
  type FtlExitStage,
} from './ftl'
import {
  boardingUnits,
  resolveBoardingCombat,
  MAX_DCPS_PER_TARGET,
  type BoardedShip,
  type BoardingForce,
  type BoardingPlan,
} from './boarding'
import {
  adfcLockedOut,
  canDeclareAttack,
  evadeShipFire,
  interceptMissiles,
  isEngaged,
  launchFighterGroup,
  moveFighterGroup,
  recoverFighterGroup,
  resolveAttackRun,
  resolveDogfight,
  secondaryMoveFighterGroup,
  shipFireAtFighters,
  type CarrierFlightState,
  type FighterGroup,
  type RearmResult,
} from './fighters'
import { arcTo, distance, isRearArcAttack } from './geometry'
import {
  combinedStealthLevel,
  effectiveScreenLevel as screenLevelOf,
  pointDefenceOptions,
  stealthHullLevel,
  STEALTH_BAND_SCALE,
  resolvePointDefence,
  type PdAllocation,
  type PdDefender,
  type PdMount,
  type PdMountKind,
  type PdThreat,
  type StealthLevel,
} from './defences'
import { d6, type ScreenLevel } from './dice'
import {
  fireWeapon,
  isAreaEffect,
  maxRangeOf,
  needsFireCon,
  rollsBeamDice,
  type WeaponResult,
} from './weapons'
import {
  acquireMissileTargets,
  launchMissile,
  moveOrdnanceMarkers,
  nearestCourse,
  resolveOrdnanceAttack,
  type MissileMarker,
} from './ordnance'
import {
  damageControlPhase,
  isOutOfControl,
  reactorExplosionPhase,
  rollThresholdChecks,
  thresholdPhase,
} from './threshold'
import {
  launchGunboatSquadron,
  moveGunboatSquadron,
  recoverGunboatSquadron,
  resolveGunboatAttack,
  secondaryMoveGunboatSquadron,
  type GunboatCarrierState,
  type GunboatSquadron,
} from './gunboats'
import {
  cancelCloakOrder,
  cloakCapability,
  cloakEndOfMovement,
  cloakMode,
  cloakStartOfMovement,
  ewFireEffect,
  isEnergyWeapon,
  orderCloak,
  rollReflexField,
  AREA_ECM_RADIUS,
  type EwDefences,
} from './ew'
import type {
  Arc,
  Course,
  DamageMode,
  MovementOrder,
  Point,
  SystemKind,
  TurnDirection,
  WeaponDef,
} from './types'

// ---------------------------------------------------------------------------
// The action union
// ---------------------------------------------------------------------------

export type GameAction =
  // Sequence of play (2.6)
  | { type: 'advance-phase' }
  /** A side declares itself done with the phase. The last one closes it. */
  | { type: 'signal-ready'; side: SideId; ready: boolean }
  | { type: 'roll-initiative' }
  /** Ties in 2.6 phase 2 are re-rolled; a chosen order is journalled instead. */
  | { type: 'set-initiative-order'; order: SideId[] }
  /** Christen a hull — cosmetic, journalled so replays and saves keep the name. */
  | { type: 'rename-ship'; shipId: string; name: string }

  // Orders (3.5) — written before anything moves
  | { type: 'plot-turn'; shipId: string; direction: TurnDirection | null; points: number }
  | { type: 'plot-second-turn'; shipId: string; direction: TurnDirection | null; points: number }
  | { type: 'plot-accel'; shipId: string; accel: number }
  | { type: 'plot-emergency-thrust'; shipId: string; on: boolean }
  /**
   * 16.2: *"the player simply writes 'Roll' in the movement orders for that
   * turn"*. It rides in the order because that is where the rulebook puts it
   * and because it is charged against the same thrust; the attitude it
   * produces outlives the turn and lives on the ship.
   */
  | { type: 'plot-roll'; shipId: string; on: boolean }
  | { type: 'plot-mines'; shipId: string; on: boolean }
  /**
   * 12.12's order sheet, replaced whole.
   *
   * A list, because the sheet is a sequence: *"Each effect is applied to the
   * ship strictly IN THE ORDER THEY ARE WRITTEN DOWN BY THE PLAYER."* The
   * payload is what the player wrote and nothing derived from it — the budget,
   * the legality and the flown path are all re-computed when the ship moves.
   */
  | { type: 'plot-vector-orders'; shipId: string; orders: VectorOrder[] }
  | { type: 'clear-order'; shipId: string }

  // Deployment (18.1) — before the first order of turn 1
  /** 4.12's die: the lower roll places first, and they alternate from there. */
  | { type: 'roll-deployment-order' }
  /**
   * 18.1: *"Players alternate in placing one ship at a time within 6 MU of
   * their table edge (or two to four ships at a time for large battles) with
   * any desired course and an initial velocity."*
   */
  | {
      type: 'deploy-ship'
      shipId: string
      position: { x: number; y: number }
      facing: Course
      velocity: number
    }
  /** 18.1: *"The defender can also place a planet or similar terrain feature."* */
  | {
      type: 'place-terrain'
      sideId: SideId
      kind: TerrainKind
      position: { x: number; y: number }
      radius: number
    }

  // Movement (3, phase 5)
  | { type: 'move-ship'; shipId: string }

  // Targeting (4.4) — one FireCon, one target
  | { type: 'assign-firecon'; shipId: string; targetId: string }
  | { type: 'clear-firecons'; shipId: string }

  // Fire (phase 11). The weapon and the target; everything else is re-derived.
  | { type: 'fire-weapon'; shipId: string; weaponId: string; targetId: string }
  /** Fire at a fighter group, which costs a FireCon like a ship (4.4). */
  | { type: 'fire-at-flight'; shipId: string; weaponId: string; flightId: string }
  | { type: 'pass-fire'; shipId: string }

  // Ordnance (6) — launched in phase 3, flown and resolved later
  | { type: 'launch-ordnance'; shipId: string; weaponId: string; aimPoint: { x: number; y: number } }
  | { type: 'move-ordnance' }
  | { type: 'resolve-ordnance-attacks' }

  // Point defence (phase 9)
  | { type: 'assign-point-defence'; shipId: string; systemId: string; targetId: string }
  | { type: 'resolve-point-defence' }

  // Flight operations (8)
  | { type: 'launch-flight'; carrierId: string; flightId: string }
  /**
   * A group flies where it likes: no course, no velocity, no written order
   * (8.5). `facing` is separate because a group's facing need not be its
   * direction of travel, and it decides which 180° it can shoot into (8.7).
   */
  | { type: 'move-flight'; flightId: string; to: { x: number; y: number }; facing?: Course }
  | {
      type: 'secondary-move-flight'
      flightId: string
      to: { x: number; y: number }
      facing?: Course
    }
  | { type: 'flight-strike'; flightId: string; targetId: string }
  | { type: 'flight-dogfight'; flightId: string; targetFlightId: string }
  | { type: 'flight-intercept'; flightId: string; ordnanceId: string }
  | { type: 'flight-evade'; flightId: string }
  | { type: 'recover-flight'; flightId: string; carrierId: string }

  // Gunboats (9) — a squadron of six, flown like fighters, shot at like ships
  | { type: 'launch-gunboats'; carrierId: string; squadronId: string }
  | {
      type: 'move-gunboats'
      squadronId: string
      to: { x: number; y: number }
      facing?: Course
    }
  | { type: 'gunboat-attack'; squadronId: string; targetId: string }
  | { type: 'recover-gunboats'; squadronId: string; carrierId: string }

  // Boarding (phase 12)
  | { type: 'resolve-boarding' }

  // Threshold and repair (phases 13, 14)
  /** One ship's threshold point. Every ship that owes one, in one action. */
  | { type: 'threshold-check'; shipId: string }
  | { type: 'threshold-sweep' }
  | { type: 'assign-damage-control'; shipId: string; systemId: string; parties: number }
  /** Phase 14 sweep: every party that was assigned makes its roll. */
  | { type: 'resolve-damage-control' }
  | { type: 'resolve-reactor-explosions' }

  // Electronic warfare and cloaks (7.17 – 7.22)
  /**
   * 7.20: "the player must note this in orders for that turn, and the number
   * of turns the ship is to remain cloaked" — declared in advance, which is
   * what stops a ship decloaking "just because a juicy target has wandered
   * into range" (7.21). `turns` defaults to one.
   */
  | { type: 'set-cloak'; shipId: string; on: boolean; turns?: number }
  /**
   * 7.25: a Reflex Field is switched on in orders and costs the ship every
   * weapon it has for that turn. Its status is secret until someone shoots at
   * the ship, "by which time it may be too late".
   */
  | { type: 'set-reflex-field'; shipId: string; on: boolean }
  /**
   * 11.4: an exit is announced in orders and takes two turns — a warm-up turn
   * with no thrust and no offensive fire, then a half move on the present
   * course and the ship is gone for good.
   */
  | { type: 'plot-ftl-exit'; shipId: string; on: boolean }
  /**
   * 16.7: a ram is declared in orders like any other move — *"Deliberate
   * attempts to ram another ship are possible"* but not as a reaction — and
   * resolved at the end of the movement phase, when both ships have arrived.
   */
  | { type: 'plot-ram'; shipId: string; targetId: string | null }
  /**
   * 16.6: *"the ship's movement orders must be plotted so that it ends up
   * within 3 MU of the target ship/starbase at the end of the turn"*. The
   * intent is written with the order; whether the approach worked is settled
   * when the ship has finished moving.
   */
  | { type: 'plot-dock'; shipId: string; targetId: string | null }
  /** 16.6: *"one full turn is also required to 'cast off' and undock again"*. */
  | { type: 'plot-cast-off'; shipId: string }
  /**
   * 16.4: *"move every ship and object in play a certain agreed distance back
   * towards the opposite table edge … effectively you can think of it as
   * extending the playing area under the ships."* The distance is the players',
   * because 16.4 names none.
   */
  | { type: 'shift-table'; crowding: 'top' | 'bottom' | 'left' | 'right'; distance: number }
  /**
   * 16.5: *"when all the ships are off the table edge, each player rolls a
   * D6"*. Declared by the side running away, once its last ship is clear and
   * they all went out by the same edge.
   */
  | { type: 'resolve-disengagement'; sideId: SideId }

  /**
   * Answers to questions the rules put to a player mid-resolution — which
   * system a needle beam took out, which of several equal targets a missile
   * marker goes for. Journalled immediately ahead of the action that consumes
   * it, so a replay makes the same choices. See docs/architecture.md.
   */
  | { type: 'queue-choices'; choices: PlayerChoice[] }

/** One answer in a queued choice script. */
export interface PlayerChoice {
  kind: 'system' | 'target' | 'arc'
  value: string
  arc?: Arc
}

/**
 * What an action did. `refused` means the action was illegal and nothing
 * changed — journalled all the same, and refused identically on replay.
 */
export interface ActionOutcome {
  refused?: string
  /** Log entries this action produced, for the effects layer to animate. */
  logged?: number
}

const OK: ActionOutcome = {}

function refuse(reason: string): ActionOutcome {
  return { refused: reason }
}

// ---------------------------------------------------------------------------
// Order plotting (3.5)
// ---------------------------------------------------------------------------

const BLANK_ORDER: MovementOrder = { turn: null, accel: 0 }

/**
 * 4.2's aft-arc ban: *"No ship may fire offensive weaponry through its aft arc
 * due to the interference of the ship's main drive."*
 *
 * This is a base rule, not an optional one — the optional rule is the
 * exception: *"Aft arc fire is permitted on any game turn in which the firing
 * ship did not use any thrust from its main drive to accelerate, decelerate,
 * or change course."* Point defence is exempt because PD is not offensive
 * weaponry and 4.2 gives systems with no directionality all-round fire.
 */
function aftArcBlocked(state: GameState, ship: ShipState, arc: Arc): boolean {
  if (arc !== 'A') return false
  if (!optional(state).aftArcFire) return true
  return ship.thrustUsed > 0
}

/**
 * A mounting's arcs as they actually bear (16.2, 4.2).
 *
 * *"Rolling has no effect on combat (except that the port batteries now bear
 * to starboard and vice versa)"* — so an inverted ship's guns are mirrored
 * through its long axis and nothing else about the shot changes. Every place
 * the engine asks whether a weapon covers an arc goes through here, because a
 * ship that rolls to bring its good broadside round and then finds the engine
 * still reading the printed arcs has been sold the manoeuvre and not given it.
 */
function bearingArcs(ship: ShipState, arcs: readonly Arc[]): readonly Arc[] {
  return ship.rollStatus.inverted ? arcsWhenInverted(arcs, true) : arcs
}

/** Orders are written in phase 1 and nowhere else (2.6). */
function orderable(state: GameState, ship: ShipState | undefined): ActionOutcome | ShipState {
  if (!ship) return refuse('No such ship')
  if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
  if (state.phase !== 'orders') return refuse('Orders are written in phase 1')
  // 18.1 comes first, and a ship still in the wings has no station to plot a
  // course from. Gated on there being a deployment at all, so it is inert for
  // every scenario and every saved battle that has none.
  if (state.deployment && !state.deployment.placed.includes(ship.id)) {
    return refuse(`${ship.name} has not been deployed yet (18.1)`)
  }
  // 16.6: only a free ship writes an ordinary movement order. A held approach
  // is spent holding it, a docked ship is attached, and the cast-off turn is
  // spent casting off — *"after which the ship may maneuver as normal"*.
  if (!canManoeuvre(ship.dock)) {
    return refuse(`${ship.name} is ${ship.dock.phase.replace('-', ' ')} and cannot manoeuvre (16.6)`)
  }
  return ship
}

function movementStateOf(ship: ShipState): MovementState {
  return {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
}

function editOrder(
  state: GameState,
  shipId: string,
  edit: (order: MovementOrder) => MovementOrder,
): ActionOutcome {
  const found = orderable(state, shipById(state, shipId))
  if (!('id' in found)) return found
  const ship = found

  // 12.12 replaces 3.5's order entirely: a turn, an acceleration and emergency
  // thrust are all cinematic quantities, and a panel that still offered them
  // would be offering a manoeuvre the ship cannot make.
  if (optional(state).movementSystem === 'vector') {
    return refuse('This battle is fought under vector movement (12.12)')
  }
  const next = edit(ship.order ?? { ...BLANK_ORDER })
  const check = validateOrder(next, movementStateOf(ship))
  if (!check.legal) return refuse(check.violations[0] ?? 'Illegal order')

  ship.order = next
  return OK
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Apply one action. The single door every mutation goes through — the human,
 * the computer opponent and a remote peer all arrive here.
 */
export function applyAction(state: GameState, action: GameAction): ActionOutcome {
  switch (action.type) {
    // ── Sequence ──────────────────────────────────────────────────────────
    case 'advance-phase': {
      // 18.1 happens before the first order is written, so the turn cannot
      // start with ships still in the wings. The guard lives here rather than
      // in `advancePhase` because `advancePhase` is also the tests' and
      // `advanceToPhase`'s way round the sequence, and because `applyAction`
      // is the boundary — which is the whole point of it.
      const owed = shipsAwaitingDeployment(state)
      if (state.turn === 1 && owed.length > 0) {
        return refuse(`${owed.length} ships are still to be deployed (18.1)`)
      }
      // 16.6 tests where a ship "ends up … at the end of the turn", and against
      // a target that is itself under way that cannot be answered until both
      // have moved. So the approach is settled as the movement phase closes,
      // not as each ship arrives.
      if (state.phase === 'move-ships') {
        for (const ship of state.ships) resolveDockingApproach(state, ship)
      }
      advancePhase(state)
      return OK
    }

    // ── Deployment (18.1) ─────────────────────────────────────────────────
    case 'roll-deployment-order': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Ships are deployed before the first orders are written (18.1)')
      }
      if (deployment.order.length > 0) return refuse('Deployment order has already been rolled')

      // 4.12: "Both players roll a die. The player with the lowest roll sets up
      // one heavy cruiser. The player with the higher roll then sets up one."
      // Section 18 rolls nothing at all, so this die is 4.12's.
      const rolls = state.sides.map((side) => ({ id: side.id, roll: d6(state.rng) }))
      // Ties are broken by re-rolling among the tied sides, the way initiative
      // is (2.6 phase 2), so the order is always total.
      let guard = 20
      while (guard-- > 0) {
        const clash = rolls.find((a, i) => rolls.some((b, j) => i !== j && b.roll === a.roll))
        if (!clash) break
        const lowest = Math.min(...rolls.map((r) => r.roll))
        for (const entry of rolls) {
          if (rolls.filter((r) => r.roll === entry.roll).length > 1) {
            entry.roll = lowest + d6(state.rng) / 10
          }
        }
      }
      deployment.order = [...rolls].sort((a, b) => a.roll - b.roll).map((r) => r.id)
      pushLog(state, {
        kind: 'orders',
        dice: rolls.map((r) => Math.round(r.roll)),
        text:
          `Deployment order (4.12): ` +
          deployment.order
            .map((id) => state.sides.find((s) => s.id === id)?.name ?? id)
            .join(', then '),
      })
      return OK
    }

    case 'deploy-ship': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Ships are deployed before the first orders are written (18.1)')
      }
      if (deployment.order.length === 0) return refuse('Roll for who places first (4.12)')

      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (deployment.placed.includes(ship.id)) return refuse(`${ship.name} is already deployed`)

      const turnOf = deployingSide(state)
      if (turnOf !== null && turnOf !== ship.side) {
        const name = state.sides.find((s) => s.id === turnOf)?.name ?? turnOf
        return refuse(`It is ${name}'s turn to place (18.1)`)
      }

      const zone = deployment.zones[ship.side]
      if (!zone) return refuse('That side has no deployment zone')
      const check = validatePlacement(zone, {
        position: action.position,
        facing: action.facing,
        velocity: action.velocity,
      })
      if (!check.legal) return refuse(check.reasons[0] ?? 'Not a legal deployment')
      if (!Number.isInteger(action.velocity) || action.velocity < 0) {
        return refuse('Velocity is a whole number and 3.1 has no reverse')
      }

      ship.placement = { position: { ...action.position }, facing: action.facing }
      ship.velocity = action.velocity
      // A wing still in the bay goes where the ship goes — the same reason
      // `move-ship` drags it, and the same three lines.
      for (const group of state.fighterGroups) {
        if (group.carrierId === ship.id && group.status === 'aboard') {
          group.position = ship.placement.position
          group.facing = ship.placement.facing
        }
      }
      for (const squadron of state.gunboatSquadrons) {
        if (squadron.carrierId === ship.id && squadron.status === 'aboard') {
          squadron.position = ship.placement.position
          squadron.facing = ship.placement.facing
        }
      }
      deployment.placed.push(ship.id)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} deploys at velocity ${action.velocity}, course ${action.facing} (18.1)`,
      })
      return OK
    }

    case 'place-terrain': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (deployment.battleType !== 'offensive-defensive') {
        return refuse('Only the defender in an offensive/defensive battle places terrain (18.1)')
      }
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Terrain is placed at deployment (18.1)')
      }
      if (deployment.terrainPlaced) {
        return refuse('The defender has already placed a feature (18.1)')
      }
      const defender = defendingSide(state)
      if (defender === null || action.sideId !== defender) {
        return refuse('Only the defending fleet places terrain (18.1)')
      }
      if (!(action.radius > 0)) return refuse('A feature needs a radius')

      state.terrain.push({
        id: 'deployed-terrain',
        kind: action.kind,
        position: { ...action.position },
        radius: action.radius,
        label: `${action.kind.replace('-', ' ')} (18.1)`,
      })
      deployment.terrainPlaced = true
      pushLog(state, {
        kind: 'orders',
        side: action.sideId,
        text: `The defender places a ${action.kind.replace('-', ' ')} (18.1)`,
      })
      return OK
    }

    case 'signal-ready': {
      const side = state.sides.find((s) => s.id === action.side)
      if (!side) return refuse('No such side')
      readySides(state)[action.side] = action.ready
      return OK
    }

    case 'roll-initiative': {
      if (state.phase !== 'initiative') return refuse('Initiative is rolled in phase 2')
      rollInitiative(state)
      return OK
    }

    case 'set-initiative-order': {
      if (state.phase !== 'initiative') return refuse('Initiative is rolled in phase 2')
      return setInitiativeOrder(state, action.order) ? OK : refuse('Not a valid initiative order')
    }

    case 'rename-ship': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      // Trimmed and capped: a name rides in every save and every log line.
      const name = action.name.trim().slice(0, 40)
      if (!name) return refuse('A ship needs a name')
      ship.name = name
      return OK
    }

    // ── Orders (3.5) ──────────────────────────────────────────────────────
    case 'plot-turn':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        turn: action.direction ? { direction: action.direction, points: action.points } : null,
      }))

    case 'plot-second-turn':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        secondTurn: action.direction
          ? { direction: action.direction, points: action.points }
          : null,
      }))

    case 'plot-accel':
      return editOrder(state, action.shipId, (order) => ({ ...order, accel: action.accel }))

    case 'plot-emergency-thrust':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        emergencyThrust: action.on,
      }))

    case 'plot-roll':
      return editOrder(state, action.shipId, (order) => ({ ...order, roll: action.on }))

    case 'plot-mines': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.layingMines = action.on
      return OK
    }

    case 'plot-vector-orders': {
      if (optional(state).movementSystem !== 'vector') {
        return refuse('This battle is fought under cinematic movement (3.1)')
      }
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      const ship = found
      for (const order of action.orders) {
        if (!VECTOR_ORDER_KINDS.includes(order.kind)) return refuse(`${order.kind} is not an order`)
        if (!Number.isInteger(order.points) || order.points < 0) {
          return refuse('An order is written in whole points')
        }
      }
      // 12.12 has no penalty clause for an over-budget sheet — `moveVector`
      // flies it as an empty one — but a player writing the sheet should be
      // told at the moment they overspend, not next phase when the ship coasts.
      const drive = { rating: ship.design.drive.thrust, hits: ship.driveHits }
      const check = validateVectorOrders(action.orders, drive)
      if (!check.legal) return refuse(check.problems[0] ?? 'That sheet overruns the drive')
      ship.vectorOrders = action.orders.map((order) => ({ ...order }))
      return OK
    }

    case 'clear-order': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.order = null
      found.vectorOrders = null
      return OK
    }

    // ── Movement (phase 5) ────────────────────────────────────────────────
    case 'move-ship': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'move-ships') return refuse('Ships move in phase 5')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      // `lastKnown` is stamped with the turn as the ship moves, so it doubles
      // as the has-moved flag and survives replay without extra state.
      if (ship.lastKnown?.turn === state.turn) return refuse('Already moved this turn')

      // 11.4: a ship on its way into hyperspace holds course and velocity —
      // "The ship may not apply any thrust in that move" — and on the second
      // turn it half-moves and is gone. Both legs ignore whatever was plotted.
      const ftl = ftlStageOf(ship, state.turn)
      if (ftl === 'jumping') return jumpToFtl(state, ship)

      if (optional(state).movementSystem === 'vector') {
        return moveUnderVector(state, ship, ftl === 'warming-up')
      }

      // A ship with no written order holds its course: velocity is conserved
      // and it must move its full velocity anyway (3.1).
      const order = ftl === 'warming-up' ? BLANK_ORDER : (ship.order ?? BLANK_ORDER)
      const before = movementStateOf(ship)

      // Emergency thrust is checked immediately after orders are written, and
      // a failure forces a re-plot under the standard limits (3.6). Rolling it
      // here — at the moment the ship moves — keeps the RNG draw in a fixed
      // place in the stream, which is what makes the replay exact.
      let effective = order
      if (order.emergencyThrust) {
        const et = rollEmergencyThrust(order, before.drive, state.rng)
        pushLog(state, {
          kind: 'move',
          text: `${ship.name} runs the drive hot: ${et.outcome}`,
          dice: et.rolls,
          shipId: ship.id,
        })
        if (et.driveHits > 0) ship.driveHits += et.driveHits
        if (et.mustReplot) effective = { ...order, emergencyThrust: false }
      }

      // 7.21, 7.22: a total cloak goes up before the ship moves — "At the
      // start of its movement for that turn, the ship model is removed from
      // the table" — and 7.20's Device goes up after. Both are handled by the
      // module; here they simply bracket the move.
      if (ship.cloak) {
        ship.cloak = cloakStartOfMovement(ship.cloak, ship.placement.position)
        ship.cloaked = cloakMode(ship.cloak) !== 'none'
      }

      const result = applyOrder(movementStateOf(ship), effective)

      // 16.2: "The roll then occurs at the start of the ship's movement." It
      // is read off `flown` rather than off the written order because 3.5
      // throws an illegal order away entirely — a ship that could not pay for
      // its plot does not get the free half of it.
      if (result.flown.roll === true) {
        ship.rollStatus = rollShip(ship.rollStatus, state.turn)
        pushLog(state, {
          kind: 'move',
          shipId: ship.id,
          side: ship.side,
          text: ship.rollStatus.inverted
            ? `${ship.name} rolls inverted — port and starboard batteries swap (16.2)`
            : `${ship.name} rolls upright (16.2)`,
        })
      }

      ship.lastKnown = {
        course: ship.placement.facing,
        velocity: ship.velocity,
        turn: state.turn,
        cloaked: ship.cloaked,
      }
      ship.placement = result.placement
      ship.velocity = result.velocity
      // 4.2's optional exception and 8.3's scramble both turn on whether the
      // ship touched its drive this turn, so the figure is recorded here — the
      // one place a ship's thrust is actually spent. An illegal plot is flown
      // as STRAIGHT_AHEAD (3.5), which spends nothing.
      ship.thrustUsed = result.legal ? result.budget.totalUsed : 0
      // A wing still in the bay goes where the ship goes. Nothing in section 8
      // says so because on a real table the counters are the same counter —
      // but here they are two, and a group left behind at last turn's station
      // would launch into empty space.
      for (const group of state.fighterGroups) {
        if (group.carrierId === ship.id && group.status === 'aboard') {
          group.position = ship.placement.position
          group.facing = ship.placement.facing
        }
      }
      if (ship.cloak) {
        const wasCloaked = ship.cloaked
        const after = cloakEndOfMovement(ship.cloak, { velocity: ship.velocity })
        ship.cloak = after
        ship.cloaked = cloakMode(after) !== 'none'
        if (ship.cloaked !== wasCloaked) {
          pushLog(state, {
            kind: 'note',
            shipId: ship.id,
            side: ship.side,
            text: ship.cloaked
              ? `${ship.name} cloaks (7.20)`
              : `${ship.name} decloaks` +
                (after.voidedBy === 'over-speed' ? ' — over 24 MU voids the cloak (7.20)' : ''),
          })
        }
      }
      pushLog(state, {
        kind: 'move',
        text: `${ship.name} ${formatOrder(effective, before.velocity)}`,
        side: ship.side,
      })
      // 17.6 tests "its path during the Ship Movement Phase", so the track is
      // the whole two-leg cinematic path (3.4), not the endpoints. Resolved
      // before the ram, because a ship that flew into a planetoid does not go
      // on to hit anything else.
      resolveTerrainHazards(state, ship, [
        before.placement.position,
        ...result.legs.map((leg) => leg.to),
      ])
      resolveDeclaredRam(state, ship)
      resolveLeavingTable(state, ship)
      dragDockedShips(state, ship)
      return OK
    }

    // ── Targeting (4.4) ───────────────────────────────────────────────────
    case 'assign-firecon': {
      const ship = shipById(state, action.shipId)
      const target = shipById(state, action.targetId)
      if (!ship || !target) return refuse('No such ship')
      if (ship.destroyed || target.destroyed) return refuse('Ship is out of the battle')
      return assignFireCon(ship, action.targetId, state.phase)
        ? OK
        : refuse('No FireCon available')
    }

    case 'clear-firecons': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      ship.fireconAssignments = ship.fireconAssignments.filter((a) => a.phase !== state.phase)
      return OK
    }

    // ── Damage control (10.4, phase 14) ───────────────────────────────────
    case 'assign-damage-control': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'damage-control') return refuse('Repairs are made in phase 14')
      const assigned = assignDamageControl(ship, action.systemId, action.parties)
      return assigned === action.parties ? OK : refuse('Not enough damage control parties')
    }

    // ── Fire (4.4 – 4.9, phase 11) ────────────────────────────────────────
    case 'fire-weapon': {
      const ship = shipById(state, action.shipId)
      const target = shipById(state, action.targetId)
      if (!ship || !target) return refuse('No such ship')
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (ship.side === target.side) return refuse('That is a friendly ship')

      // 7.25: a ship running its Reflex Field "may not use any weaponry of its
      // own that turn", and 7.20 says the same of a cloaked one. 10.3 says it
      // of a ship whose bridge has gone: "While a ship is out of control it
      // will continue on its present course and velocity, and may not fire
      // weapons, launch fighters, or take any other offensive action."
      if (ship.reflexFieldActive) return refuse(`${ship.name} is running its Reflex Field (7.25)`)
      if (ship.cloaked) return refuse(`${ship.name} is cloaked and cannot fire (7.20)`)
      if (isOutOfControl(ship, state.turn)) {
        return refuse(`${ship.name} is out of control and cannot fire (10.3)`)
      }
      // 11.4: a ship on its way into hyperspace "may not... use any offensive
      // weaponry or ADFC" from the moment the drive starts spinning up.
      if (ftlStageOf(ship, state.turn) !== null) {
        return refuse(`${ship.name} is entering hyperspace and cannot fire (11.4)`)
      }

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That weapon is knocked out')
      // 2.6: a weapon fires once a turn, and point defence in phase 9 spends it.
      if (!canWeaponFire(ship, weapon.id)) return refuse('That weapon has already fired')

      // Everything the resolver needs is re-derived here rather than carried in
      // the payload, so a stale or edited action cannot make a replay disagree.
      //
      // The geometry is checked BEFORE a FireCon is claimed, and the order is
      // the point: 4.4 spends a FireCon to engage a target, and a shot that
      // cannot be taken at all never engaged anything. Claiming it first meant
      // a mistaken click — wrong arc, or a rock in the way — quietly cost the
      // ship a target it could have held.
      const rules = optional(state)
      const range = distance(ship.placement.position, target.placement.position)
      const arc = arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
      if (!bearingArcs(ship, weapon.arcs).includes(arc)) {
        return refuse('Target is not in that arc')
      }
      if (aftArcBlocked(state, ship, arc)) {
        return refuse(`${ship.name} cannot fire through its own drive plume (4.2)`)
      }
      // 17.1: a planet or planetoid across the line stops the shot. Measured
      // centre to centre, because that is how the models are measured.
      if (!hasLineOfFire(ship.placement.position, target.placement.position, blockingTerrain(state))) {
        return refuse(`${target.name} is behind cover (17.1)`)
      }

      // 4.4: each FireCon engages one target. A weapon may join a target the
      // ship is already engaging for free; a new target costs a FireCon.
      if (needsFireCon(weapon) && !engagedTargets(ship, state.phase).includes(target.id)) {
        if (!assignFireCon(ship, target.id, state.phase)) return refuse('No FireCon available')
      }

      // 7.17 – 7.22: what the target's electronic warfare fit does to this
      // particular shot. It can change the range as well as the die roll — a
      // Holofield adds 12 MU against a to-hit table and a Cloaking Device
      // doubles it — so the effect is computed before the shot, not applied
      // to its result.
      const ew = ewFireEffect(
        {
          range,
          usesBeamDice: rollsBeamDice(weapon),
          areaEffect: isAreaEffect(weapon),
          gravitonBeam: weapon.weaponClass === 'gravitic-gun',
          needleBeam: weapon.weaponClass === 'needle-beam',
          maxRange: maxRangeOf(weapon),
        },
        ewDefencesOf(state, target),
      )
      if (ew.untargetable) {
        return refuse(`${target.name} is not on the table (7.21)`)
      }
      // 7.4, 7.5: stealth shrinks the attacker's range brackets, which is the
      // same arithmetic as stretching the range — a Stealth-1 target 12 MU
      // away is ranged as though it were at 14.4. Applied AFTER the electronic
      // warfare stack rather than before it, so the holofield's "ignored
      // inside 6 MU" test still measures the true distance (7.17).
      const stealth = stealthLevelOf(target)
      const rangeToUse = stealth > 0 ? ew.effectiveRange / STEALTH_BAND_SCALE[stealth] : ew.effectiveRange
      if (stealth > 0 && rangeToUse > maxRangeOf(weapon)) {
        markWeaponFired(ship, weapon.id, state.phase)
        markShipFired(ship)
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} cannot range ${target.name} — Stealth-${stealth} (7.4)`,
        })
        return OK
      }
      if (ew.autoMiss) {
        markWeaponFired(ship, weapon.id, state.phase)
        markShipFired(ship)
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} misses — ${ew.modifiers.map((m) => m.label).join('; ')}`,
        })
        return OK
      }

      const result = fireWeapon(weapon, {
        range: rangeToUse,
        arc,
        targetScreens: effectiveScreenLevel(target),
        rearArc: isRearArcAttack(
          target.placement.position,
          target.placement.facing,
          ship.placement.position,
        ),
        drm: ew.drm,
        rng: state.rng,
      })
      markWeaponFired(ship, weapon.id, state.phase)
      markShipFired(ship)

      if ('refused' in result) {
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} holds fire — ${result.refused}`,
        })
        return OK
      }

      // 7.25: the damage is rolled first, then the field's own die decides how
      // much of it lands and how much comes back.
      const reflected = reflexField(state, ship, target, weapon, result)
      const applied = applyDamage(targetStateOf(target), reflected.result, {
        rearArcRule: rules.rearArcAttacks,
        rearArc: isRearArcAttack(
          target.placement.position,
          target.placement.facing,
          ship.placement.position,
        ),
        source: 'direct-fire',
      })
      writeBackDamage(target, applied.target)
      // markHullBoxes owns the row accounting and the pending threshold, so
      // the hull damage goes through it rather than being written directly.
      markHullBoxes(target, applied.hullDamage)
      // 5.9: "Every hit generated allows the player to send one unit of
      // Marines or a Damage Control Party over to the enemy ship"; 5.18: "two
      // 'Marine' markers are placed on the enemy ship". Landing them is where
      // the source stops — see the boarding phase.
      landBoarders(state, ship, target, applied.boarders ?? 0)

      pushLog(state, {
        kind: applied.hullDamage > 0 ? 'damage' : 'fire',
        shipId: ship.id,
        targetId: target.id,
        side: ship.side,
        dice: result.dice,
        text: `${ship.name} fires ${weapon.label} at ${target.name}: ${result.detail}`,
      })
      if (reflected.back > 0) {
        // The energy that came back is applied like any other direct fire, to
        // the ship that sent it (7.25).
        const onShooter = applyDamage(
          targetStateOf(ship),
          { ...reflected.result, normalDamage: reflected.back, penetratingDamage: 0 },
          { rearArcRule: false, rearArc: false, source: 'direct-fire' },
        )
        writeBackDamage(ship, onShooter.target)
        markHullBoxes(ship, onShooter.hullDamage)
        if (ship.destroyed) {
          pushLog(state, {
            kind: 'destroyed',
            shipId: ship.id,
            text: `${ship.name} is destroyed by its own fire`,
          })
        }
      }
      if (target.destroyed) {
        pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
      }
      return OK
    }

    case 'pass-fire': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      markShipFired(ship)
      return OK
    }

    // ── Ordnance (6, phases 3, 5, 9 and 10) ───────────────────────────────
    case 'launch-ordnance': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'launch-missiles') return refuse('Missiles launch in phase 3')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That launcher is knocked out')
      if (!canWeaponFire(ship, weapon.id)) return refuse('That launcher has already fired')

      const kind = missileKindOf(weapon.weaponClass)
      if (!kind) return refuse(`${weapon.label} is not a missile launcher`)

      const markers = ordnanceOf(state)
      const result = launchMissile({
        id: `ord-${state.turn}-${markers.length + 1}-${ship.id}-${weapon.id}`,
        owner: ship.side,
        sourceShipId: ship.id,
        sourceWeaponId: weapon.id,
        kind,
        grade: weapon.variant === 'extended' ? 'extended' : 'standard',
        stages: weapon.variant === 'two-stage' ? 2 : 1,
        origin: { position: ship.placement.position, facing: ship.placement.facing },
        arcs: bearingArcs(ship, weapon.arcs),
        aim: action.aimPoint,
        turn: state.turn,
        fireConsAvailable: availableFireCons(ship, state.phase),
      })

      markWeaponFired(ship, weapon.id, state.phase)
      if (!result.marker) {
        pushLog(state, {
          kind: 'launch',
          shipId: ship.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} does not launch — ${result.detail}`,
        })
        return OK
      }
      markers.push(result.marker)
      projectOrdnance(state)
      pushLog(state, {
        kind: 'launch',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} launches ${weapon.label}: ${result.detail}`,
      })
      return OK
    }

    case 'move-ordnance': {
      if (state.phase !== 'move-ships') return refuse('Ordnance flies in phase 5')
      const markers = ordnanceOf(state)
      setOrdnance(state, moveOrdnanceMarkers(markers))
      projectOrdnance(state)
      return OK
    }

    case 'resolve-ordnance-attacks': {
      if (state.phase !== 'ordnance-vs-ships') {
        return refuse('Ordnance attacks in phase 10')
      }
      const alive = state.ships.filter((ship) => !ship.destroyed && !ship.offTable)
      const acquired = acquireMissileTargets(
        ordnanceOf(state),
        alive.map((ship) => ({ id: ship.id, owner: ship.side, position: ship.placement.position })),
      )
      setOrdnance(state, acquired.markers)

      for (const hit of acquired.acquisitions) {
        const marker = acquired.markers.find((m) => m.id === hit.markerId)
        const target = shipById(state, hit.targetShipId)
        if (!marker || !target) continue

        const result = resolveOrdnanceAttack(marker, marker.missiles, {
          level: effectiveScreenLevel(target),
          advanced: target.design.screens.advanced,
        }, state.rng)
        if (!result) continue

        const applied = applyDamage(targetStateOf(target), result, {
          // 4.10: "Missiles or fighters do not benefit from rear arc attacks."
          source: 'ordnance',
        })
        writeBackDamage(target, applied.target)
        markHullBoxes(target, applied.hullDamage)
        pushLog(state, {
          kind: applied.hullDamage > 0 ? 'damage' : 'fire',
          targetId: target.id,
          side: marker.owner,
          dice: result.dice,
          text: `Ordnance strikes ${target.name}: ${result.detail}`,
        })
        if (target.destroyed) {
          pushLog(state, {
            kind: 'destroyed',
            shipId: target.id,
            text: `${target.name} is destroyed`,
          })
        }
      }

      // A marker that attacked is spent (6.3); one that found nothing flies on.
      const spent = new Set(acquired.acquisitions.map((a) => a.markerId))
      setOrdnance(
        state,
        acquired.markers.filter((marker) => !spent.has(marker.id)),
      )
      projectOrdnance(state)
      return OK
    }

    // ── Point defence (7.12 – 7.15, phase 9) ──────────────────────────────
    case 'resolve-point-defence': {
      if (state.phase !== 'point-defence') return refuse('Point defence is phase 9')
      const markers = ordnanceOf(state)
      if (markers.length === 0) return OK

      for (const ship of state.ships) {
        if (ship.destroyed || ship.offTable) continue
        // 10.3: "Passive defenses (screens, armor) are still operational,
        // though active defenses (PDS) are not." 11.4 lets a warming-up ship
        // keep its PDS but takes its ADFC, and a jumping one has already gone.
        if (isOutOfControl(ship, state.turn)) continue
        const ftlStage = ftlStageOf(ship, state.turn)
        if (ftlStage !== null && !ftlExitRestrictions(ftlStage).mayUsePds) continue
        const mounts = pdMountsOf(ship)
        if (mounts.length === 0) continue

        // A marker is a threat to this ship if it is close enough to be worth
        // shooting at; the options function applies the actual reach rules.
        const threats: PdThreat[] = markers
          .filter((marker) => marker.owner !== ship.side && marker.missiles > 0)
          .map((marker) => ({
            id: marker.id,
            kind: marker.kind === 'heavy' ? 'heavy-missile' : 'salvo-missile',
            position: marker.position,
            attacking: ship.id,
          }))
        if (threats.length === 0) continue

        const defender = pdDefenderOf(state, ship, mounts)
        const options = pointDefenceOptions(defender, threats)
        // Doctrine: every mount at the nearest thing it can reach. That is what
        // a player does when missiles are inbound, and splitting fire between
        // two salvos usually stops neither.
        const used = new Set<string>()
        const allocations: PdAllocation[] = []
        for (const option of [...options].sort((a, b) => a.range - b.range)) {
          if (used.has(option.mountId)) continue
          used.add(option.mountId)
          allocations.push({
            mountId: option.mountId,
            threatId: option.threatId,
            reach: option.reach,
            coveringShipId: option.coveringShipId,
            dice: option.dice,
          })
        }
        if (allocations.length === 0) continue

        const outcome = resolvePointDefence(defender, threats, allocations, state.rng)

        for (const result of outcome.results) {
          if (result.kills <= 0) continue
          const marker = markers.find((m) => m.id === result.threatId)
          if (!marker) continue
          marker.missiles = Math.max(0, marker.missiles - result.kills)
          pushLog(state, {
            kind: 'point-defence',
            shipId: ship.id,
            side: ship.side,
            dice: result.rolls,
            text: `${ship.name} point defence: ${result.detail}`,
          })
        }
        // A mount that fires as point defence has fired for the turn (2.6).
        for (const allocation of allocations) markWeaponFired(ship, allocation.mountId, state.phase)
      }

      setOrdnance(state, markers.filter((marker) => marker.missiles > 0))
      projectOrdnance(state)
      return OK
    }

    // ── Threshold checks (4.11, phase 13) ─────────────────────────────────
    case 'threshold-check': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      const result = rollThresholdChecks(ship, state.rng, {
        turn: state.turn,
        driveDamage: optional(state).driveDamage,
      })
      if (!result) return refuse('No threshold check owing')
      pushLog(state, {
        kind: 'threshold',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} crosses hull row ${result.rowsLost}: systems lost on ${result.target}+`,
        dice: result.checks.map((check) => check.roll),
      })
      return OK
    }

    case 'threshold-sweep': {
      if (state.phase !== 'threshold') return refuse('Threshold checks are phase 13')
      thresholdPhase(state, { driveDamage: optional(state).driveDamage })
      return OK
    }

    case 'resolve-damage-control': {
      if (state.phase !== 'damage-control') return refuse('Repairs are made in phase 14')
      damageControlPhase(state)
      return OK
    }

    case 'resolve-reactor-explosions': {
      if (state.phase !== 'reactor-explosions') {
        return refuse('A breached core is rolled for in phase 15')
      }
      for (const result of reactorExplosionPhase(state)) {
        // 10.3's optional Reactor Breach: the blast is reported by the phase
        // and applied here, because how it meets armour and screens belongs to
        // the damage pipeline. Semi-armour-piercing, and standard screens are
        // no help — "Half of the damage would be applied to armor; the other
        // half to the hull ignoring screens if any."
        for (const hit of result.blast) {
          if (hit.kind !== 'ship') {
            // What a point of blast does to a fighter group or a missile
            // marker is not stated in section 10, so it is logged rather than
            // guessed at.
            pushLog(state, {
              kind: 'damage',
              text: `${hit.targetId} is caught in the blast: ${hit.damage} points (10.3)`,
              dice: hit.dice,
            })
            continue
          }
          const victim = shipById(state, hit.targetId)
          if (!victim) continue
          const applied = applyDamage(
            targetStateOf(victim),
            {
              normalDamage: hit.damage,
              penetratingDamage: 0,
              mode: 'SAP',
              dice: hit.dice,
              detail: `reactor breach, ${hit.damage} SAP`,
            },
            { rearArcRule: false, rearArc: false, source: 'direct-fire' },
          )
          writeBackDamage(victim, applied.target)
          markHullBoxes(victim, applied.hullDamage)
          pushLog(state, {
            kind: 'damage',
            shipId: victim.id,
            side: victim.side,
            dice: hit.dice,
            text: `${victim.name} is caught in the blast: ${hit.damage} semi-AP (10.3)`,
          })
          if (victim.destroyed) {
            pushLog(state, {
              kind: 'destroyed',
              shipId: victim.id,
              text: `${victim.name} is destroyed by the blast`,
            })
          }
        }
      }
      // "Apply damage if necessary and roll threshold checks again" — the
      // quick reference sheet's phase 15, and the reason the sweep runs after
      // the blast rather than before it.
      thresholdPhase(state, { driveDamage: optional(state).driveDamage })
      return OK
    }

    // ── Boarding (phase 12) ───────────────────────────────────────────────
    case 'resolve-boarding': {
      if (state.phase !== 'boarding') return refuse('Boarding is resolved in phase 12')
      for (const ship of state.ships) {
        if (ship.destroyed || ship.offTable) continue
        if (!ship.boarders.some((party) => party.side !== ship.side)) continue

        const boarded: BoardedShip = {
          side: ship.side,
          hullRemaining: ship.design.hullBoxes - ship.hullMarked,
          // 12.7's counter-attack is a damage control action, and the quick
          // reference sheet's phase 14 is "Damage Control assignments for DC
          // parties not used to repel boarders" — so what is spent here is
          // what phase 14 will not see.
          damageControlParties: availableDamageControlParties(ship),
          marines: ship.marinesAboard,
        }
        const result = resolveBoardingCombat(
          boarded,
          ship.boarders,
          defaultBoardingPlan(boarded, ship.boarders),
          state.rng,
        )

        ship.boarders = result.survivors.map((force) => ({
          side: force.side,
          parties: force.parties,
          landedTurn: force.landedTurn,
        }))
        ship.marinesAboard = Math.max(0, ship.marinesAboard - result.defendingMarinesLost)
        if (result.dcpsCommitted > 0) {
          ship.damageControl.push({ systemId: 'repelling-boarders', parties: result.dcpsCommitted })
        }
        for (const line of result.log) {
          pushLog(state, { kind: 'boarding', shipId: ship.id, side: ship.side, text: line })
        }
        if (result.hullDamage > 0) {
          // Boarders wreck a ship from the inside, so their damage meets no
          // armour and no screens on the way to the hull (12.7).
          markHullBoxes(ship, result.hullDamage)
          pushLog(state, {
            kind: 'damage',
            shipId: ship.id,
            side: ship.side,
            text: `${ship.name} takes ${result.hullDamage} from boarders inside the hull (12.7)`,
          })
        }
        if (result.captured) {
          // "it is considered captured" — an intact hull in someone else's
          // hands, which is not at all the same as a destroyed one.
          ship.captured = true
          pushLog(state, {
            kind: 'boarding',
            shipId: ship.id,
            text: `${ship.name} is carried by boarding action (12.7)`,
          })
        }
      }
      return OK
    }

    // ── Flight operations (8, phases 4, 6, 8 and 10) ──────────────────────
    case 'launch-flight': {
      if (state.phase !== 'move-fighters') return refuse('Fighters launch in phase 4')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (flight.carrierId !== carrier.id) {
        return refuse(`${flight.label} is not aboard ${carrier.name}`)
      }
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      // 10.3: an out-of-control ship "may not fire weapons, launch fighters,
      // or take any other offensive action".
      if (isOutOfControl(carrier, state.turn)) {
        return refuse(`${carrier.name} is out of control (10.3)`)
      }

      const result = launchFighterGroup(
        flight,
        carrierFlightState(state, carrier),
        state.turn,
        carrier.placement.position,
        carrier.placement.facing,
      )
      if (!result.launched) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'launch',
        side: flight.side,
        shipId: carrier.id,
        text: `${carrier.name} launches ${flight.label}`,
      })
      return OK
    }

    case 'move-flight': {
      if (state.phase !== 'move-fighters') return refuse('Fighter groups move in phase 4')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.movedThisTurn) return refuse(`${flight.label} has already moved this turn`)
      // 8.6: a screen or a pursuit moves with what it is tied to, in phase 5.
      if (flight.mission !== 'free') {
        return refuse(`${flight.label} is ${flight.mission === 'screen' ? 'screening' : 'pursuing'} and moves with its charge (8.6)`)
      }

      const result = moveFighterGroup(
        flight,
        action.to,
        state.turn,
        facingAfterMove(flight, action.to, action.facing),
      )
      if (!result.moved) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      return OK
    }

    case 'secondary-move-flight': {
      if (state.phase !== 'secondary-fighter-moves') {
        return refuse('Secondary fighter moves are phase 6')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.secondaryMovedThisTurn) return refuse(`${flight.label} has already moved again`)

      const result = secondaryMoveFighterGroup(
        flight,
        action.to,
        facingAfterMove(flight, action.to, action.facing),
      )
      if (!result.moved) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        text: `${flight.label} moves again, ${flight.cef} CEF left`,
      })
      return OK
    }

    case 'recover-flight': {
      // 8.1 lands a group on its fighter move; phase 6 works too and is where
      // a group that spent phase 4 elsewhere gets home, at the cost of the
      // secondary move's endurance.
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('A group lands on a fighter move, phase 4 or 6 (8.1)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (carrier.side !== flight.side) return refuse('A group lands on its own side’s ship')

      // "The fighter group moves into contact with the carrier in the Fighter
      // Movement Phase" (8.1) — so the flight home is part of the landing, and
      // it is flown under whichever phase's allowance applies.
      const home = carrier.placement.position
      const flown = secondary
        ? secondaryMoveFighterGroup(flight, home, carrier.placement.facing)
        : moveFighterGroup(flight, home, state.turn, carrier.placement.facing)
      if (!flown.moved) return refuse(`${flight.label}: ${flown.reason}`)

      const result = recoverFighterGroup(
        flown.group,
        carrierFlightState(state, carrier),
        state.turn,
        state.rng,
      )
      if (!result.recovered) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.carrierId = carrier.id
      flight.recoveredTurn = state.turn
      flight.targetId = null
      pushLog(state, {
        kind: 'launch',
        side: flight.side,
        shipId: carrier.id,
        text: `${carrier.name} recovers ${flight.label}${describeRearm(result.rearm)}`,
        dice: result.rearm ? [result.rearm.roll] : undefined,
      })
      return OK
    }

    case 'flight-strike': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not strafe its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      const result = resolveAttackRun(
        flight,
        {
          screens: effectiveScreenLevel(target),
          advancedScreens: target.design.screens.advanced,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            flight.position,
          ),
        },
        state.rng,
      )
      if (!result.fired) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: flight.side,
        shipId: target.id,
        text: `${flight.label} strafes ${target.name}: ${result.detail}`,
        dice: result.dice,
      })
      applyFighterDamage(state, target, {
        normalDamage: result.normalDamage,
        penetratingDamage: result.penetratingDamage,
        mode: result.mode,
        dice: result.dice,
        detail: result.detail,
      })
      return OK
    }

    case 'flight-dogfight': {
      if (state.phase !== 'fighter-vs-fighter') return refuse('Dogfights are phase 8')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const enemy = flightById(state, action.targetFlightId)
      if (!enemy) return refuse('No such enemy group')
      if (enemy.side === flight.side) return refuse('A group does not dogfight its own side')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already fought this turn`)

      const allowed = canDeclareAttack(flight, enemy.position, { kind: 'fighter' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      // 8.10: "All fire between fighter groups in a dogfight is considered
      // simultaneous", so both groups are written back from one resolution.
      const result = resolveDogfight(flight, enemy, state.rng)
      for (const group of result.groups) {
        const live = flightById(state, group.id)
        if (live) writeFlight(live, group)
      }
      for (const side of result.sides) {
        const shooter = flightById(state, side.groupId)
        if (!shooter) continue
        pushLog(state, {
          kind: 'fire',
          side: shooter.side,
          text: `${shooter.label} dogfights: ${side.kills} killed${side.exhausted ? ' (out of endurance)' : ''}`,
          dice: side.dice,
        })
      }
      return OK
    }

    case 'flight-intercept': {
      if (state.phase !== 'point-defence') return refuse('Fighters intercept missiles in phase 9')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const markers = ordnanceOf(state)
      const marker = markers.find((m) => m.id === action.ordnanceId)
      if (!marker) return refuse('No such missile marker')
      if (marker.owner === flight.side) return refuse('A group does not shoot down its own missiles')
      if (marker.missiles <= 0) return refuse('That salvo is already gone')

      const allowed = canDeclareAttack(flight, marker.position, { kind: 'missile' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      const result = interceptMissiles(
        flight,
        { kind: marker.kind === 'heavy' ? 'heavy' : 'salvo', count: marker.missiles },
        state.rng,
      )
      if (!result.intercepted) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      marker.missiles = Math.max(0, marker.missiles - result.kills)
      setOrdnance(state, markers.filter((m) => m.missiles > 0))
      projectOrdnance(state)
      pushLog(state, {
        kind: 'point-defence',
        side: flight.side,
        text: `${flight.label} intercepts: ${result.kills} killed, ${result.losses} lost`,
        dice: [...result.rolls, ...result.casualtyRolls],
      })
      return OK
    }

    case 'flight-evade': {
      // 8.6: declared "After a player has announced fire against a fighter
      // group but before actually rolling the dice", which is the ship fire
      // phase — and there is no evading point defence.
      if (state.phase !== 'ship-fire') return refuse('Evasion answers ship fire, phase 11 (8.6)')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')

      const result = evadeShipFire(flight)
      if (!result.evaded) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'note',
        side: flight.side,
        text: `${flight.label} evades: ship weapons miss it for the rest of the turn (8.6)`,
      })
      return OK
    }

    case 'fire-at-flight': {
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.side === ship.side) return refuse('A ship does not shoot its own fighters')
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not on the table`)
      // 8.6: "Only groups that are not engaged … may be fired at."
      if (isEngaged(flight)) return refuse(`${flight.label} is engaged; ships may not fire into it (8.6, 8.10)`)

      if (isOutOfControl(ship, state.turn)) {
        return refuse(`${ship.name} is out of control and cannot fire (10.3)`)
      }
      if (ftlStageOf(ship, state.turn) !== null) {
        return refuse(`${ship.name} is entering hyperspace and cannot fire (11.4)`)
      }
      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (!canWeaponFire(ship, weapon.id)) return refuse(`${weapon.label} has already fired this turn`)
      const arc = arcTo(ship.placement.position, ship.placement.facing, flight.position)
      if (!bearingArcs(ship, weapon.arcs).includes(arc)) {
        return refuse(`${weapon.label} does not bear on ${flight.label}`)
      }
      if (aftArcBlocked(state, ship, arc)) {
        return refuse(`${ship.name} cannot fire through its own drive plume (4.2)`)
      }
      if (!hasLineOfFire(ship.placement.position, flight.position, blockingTerrain(state))) {
        return refuse(`${flight.label} is behind cover (17.1)`)
      }
      if (distance(ship.placement.position, flight.position) > maxRangeOf(weapon)) {
        return refuse(`${flight.label} is out of ${weapon.label}'s reach`)
      }
      // 8.6: "each fighter group targeted requires a separate FireCon." A
      // group already engaged this phase is free, exactly as a ship is (4.4).
      if (needsFireCon(weapon) && !assignFireCon(ship, flight.id, state.phase)) {
        return refuse(`No FireCon left to hold ${flight.label} (4.4, 8.6)`)
      }

      // "Ship to ship weapons roll 1D6 only against fighter groups, regardless
      // of range band or normal damage inflicted" (8.6) — so the mount's own
      // dice table does not come into it, and one mount is one die.
      const result = shipFireAtFighters(flight, 1, state.rng)
      markWeaponFired(ship, weapon.id, state.phase)
      markShipFired(ship)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'fire',
        side: ship.side,
        shipId: ship.id,
        text: result.evaded
          ? `${ship.name}'s ${weapon.label} finds ${flight.label} evading: automatic miss (8.6)`
          : `${ship.name}'s ${weapon.label} at ${flight.label}: ${result.kills} killed`,
        dice: result.rolls,
      })
      return OK
    }

    // ── Cloaks (7.20 – 7.22) ──────────────────────────────────────────────
    case 'set-cloak': {
      // Written with the movement order, and nowhere else: the count is
      // declared in advance and cannot be revised once the turn is under way.
      if (state.phase !== 'orders') return refuse('A cloak is written in orders, phase 1 (7.20)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (!ship.cloak) return refuse(`${ship.name} has no cloak fitted`)

      if (!action.on) {
        ship.cloak = cancelCloakOrder(ship.cloak)
        return OK
      }
      if (cloakCapability(ship.cloak) === 'none') {
        return refuse(`${ship.name}'s cloak is knocked out (7.20)`)
      }
      const turns = Math.max(1, Math.floor(action.turns ?? 1))
      ship.cloak = orderCloak(ship.cloak, turns)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        // Written orders are the one secret in an open-book game (2.6).
        visibleTo: [ship.side],
        text: `${ship.name} will cloak for ${turns} turn${turns === 1 ? '' : 's'} (7.20)`,
      })
      return OK
    }

    case 'set-reflex-field': {
      if (state.phase !== 'orders') {
        return refuse('A Reflex Field is written in orders, phase 1 (7.25)')
      }
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (action.on && operationalCount(ship, 'reflex-field') === 0) {
        return refuse(`${ship.name} has no working Reflex Field`)
      }
      ship.reflexFieldActive = action.on
      if (action.on) {
        pushLog(state, {
          kind: 'orders',
          shipId: ship.id,
          side: ship.side,
          // Secret: "The opposing player is not told of the field's status
          // until the ship is fired upon" (7.25).
          visibleTo: [ship.side],
          text: `${ship.name} raises its Reflex Field — no weapons this turn (7.25)`,
        })
      }
      return OK
    }

    case 'plot-ram': {
      if (state.phase !== 'orders') return refuse('A ram is declared in orders (16.7)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (action.targetId === null) {
        ship.ramTargetId = null
        return OK
      }
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.side === ship.side) return refuse('A ship does not ram its own fleet')
      ship.ramTargetId = target.id
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        visibleTo: [ship.side],
        text: `${ship.name} will attempt to ram ${target.name} (16.7)`,
      })
      return OK
    }

    case 'plot-dock': {
      if (state.phase !== 'orders') return refuse('A docking approach is plotted in orders (16.6)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (ship.dock.phase !== 'free') return refuse(`${ship.name} is already docking (16.6)`)
      if (action.targetId === null) {
        ship.dockTargetId = null
        return OK
      }
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.id === ship.id) return refuse('A ship does not dock with itself')
      if (target.destroyed || target.offTable) return refuse('That target is out of the battle')
      ship.dockTargetId = target.id
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} will attempt to dock with ${target.name} (16.6)`,
      })
      return OK
    }

    case 'plot-cast-off': {
      if (state.phase !== 'orders') return refuse('A cast-off is ordered in orders (16.6)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (!isDocked(ship.dock)) return refuse(`${ship.name} is not docked`)
      ship.dock = orderCastOff(ship.dock, state.turn)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} casts off — one full turn before it manoeuvres again (16.6)`,
      })
      return OK
    }

    case 'shift-table': {
      if (!optional(state).movingTable) {
        return refuse('The table only moves when the table agrees to it (16.4)')
      }
      if (!(action.distance > 0)) return refuse('A shift has to go somewhere')
      const offset = tableShift(action.crowding as ShiftEdge, action.distance)
      // Every object, or the rule is not a shift of the table: "because the
      // same offset is applied to every object, every range, bearing and arc
      // in the game is identical afterwards".
      const slide = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y })
      for (const ship of state.ships) ship.placement = { ...ship.placement, position: slide(ship.placement.position) }
      for (const group of state.fighterGroups) group.position = slide(group.position)
      for (const squadron of state.gunboatSquadrons) squadron.position = slide(squadron.position)
      for (const marker of ordnanceOf(state)) marker.position = slide(marker.position)
      for (const feature of state.terrain) feature.position = slide(feature.position)
      projectOrdnance(state)
      pushLog(state, {
        kind: 'move',
        text:
          `The table slides ${action.distance} MU away from the ${action.crowding} edge ` +
          `— every range and bearing is unchanged (16.4)`,
      })
      return OK
    }

    case 'resolve-disengagement': {
      if (!optional(state).movingTable) {
        // 16.5's abstract roll is what you do *instead* of playing out the
        // stern chase, and 16.4's moving table is what makes a stern chase
        // possible at all. Without it, 3.9 has already settled the question.
        return refuse('A disengagement is rolled under the moving table rules (16.4, 16.5)')
      }
      const side = state.sides.find((s) => s.id === action.sideId)
      if (!side) return refuse('No such side')

      const mine = state.ships.filter((ship) => ship.side === side.id && !ship.destroyed)
      const check = readyToDisengage(
        mine.map((ship) => ({
          onTable: !ship.offTable,
          exitEdge: ship.exitEdge,
          thrust: currentThrust(ship),
        })),
      )
      if (!check.ready) return refuse(check.reason)

      const pursuing = state.ships.filter(
        (ship) => ship.side !== side.id && !ship.destroyed && !ship.offTable,
      )
      const result = resolveDisengagement(
        mine.map((ship) => currentThrust(ship)),
        pursuing.map((ship) => currentThrust(ship)),
        state.rng,
      )
      pushLog(state, {
        kind: 'note',
        side: side.id,
        dice: [result.disengagingRoll, result.pursuingRoll],
        text: `${side.name} tries to disengage by the ${check.edge} edge: ${result.detail} (16.5)`,
      })
      if (result.disengaged) return OK

      // "The fleeing player may then attempt the disengagement again by leaving
      // the opposite edge of the new playing area" — so the fleet comes back on
      // with the table slid under it, and the chase carries on.
      for (const ship of mine) {
        ship.offTable = false
        ship.exitEdge = null
      }
      pushLog(state, {
        kind: 'note',
        text: `The pursuit continues: ${side.name} is back on the new playing area (16.5)`,
      })
      return OK
    }

    case 'plot-ftl-exit': {
      if (state.phase !== 'orders') return refuse('An FTL exit is announced in orders (11.4)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (!action.on) {
        ship.ftlTransit = 'none'
        ship.ftlWarmupTurn = null
        return OK
      }
      if (ship.design.ftl === 'none') return refuse(`${ship.name} has no FTL drive`)
      if (ship.cloaked) return refuse(`${ship.name} is cloaked and cannot enter hyperspace (7.20)`)
      if (ship.ftlWarmupTurn !== null) return refuse(`${ship.name} is already spinning up`)
      ship.ftlTransit = 'exiting'
      ship.ftlWarmupTurn = state.turn
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} spins up its FTL drive — no thrust and no guns until it is gone (11.4)`,
      })
      return OK
    }

    // ── Gunboats (9, phases 4, 6 and 10) ──────────────────────────────────
    case 'launch-gunboats': {
      if (state.phase !== 'move-fighters') {
        return refuse('Gunboats launch with the fighters, in phase 4 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (squadron.carrierId !== carrier.id) {
        return refuse(`${squadron.label} is not aboard ${carrier.name}`)
      }
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (isOutOfControl(carrier, state.turn)) {
        return refuse(`${carrier.name} is out of control (10.3)`)
      }

      const result = launchGunboatSquadron(
        squadron,
        gunboatCarrierState(state, carrier),
        state.turn,
        carrier.placement.position,
        carrier.placement.facing,
      )
      if (!result.launched) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      pushLog(state, {
        kind: 'launch',
        side: squadron.side,
        shipId: carrier.id,
        text: `${carrier.name} launches ${squadron.label}`,
      })
      return OK
    }

    case 'move-gunboats': {
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('Gunboats move with the fighters, phases 4 and 6 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      if (secondary ? squadron.secondaryMovedThisTurn : squadron.movedThisTurn) {
        return refuse(`${squadron.label} has already moved this phase`)
      }

      const facing = squadronFacingAfterMove(squadron, action.to, action.facing)
      const result = secondary
        ? secondaryMoveGunboatSquadron(squadron, action.to, facing)
        : moveGunboatSquadron(squadron, action.to, facing)
      if (!result.moved) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      if (secondary) {
        pushLog(state, {
          kind: 'move',
          side: squadron.side,
          text: `${squadron.label} moves again, ${squadron.cef} CEF left`,
        })
      }
      return OK
    }

    case 'gunboat-attack': {
      // 9.1: "Gunboats then make their attacks in the Fighter Attack Phase
      // (phase 10)" — the same phase a fighter's attack run is resolved in.
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Gunboats attack in phase 10 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === squadron.side) return refuse('A squadron does not shoot its own fleet')

      const range = distance(squadron.position, target.placement.position)
      const result = resolveGunboatAttack(
        squadron,
        {
          screens: effectiveScreenLevel(target),
          range,
          arc: arcTo(target.placement.position, target.placement.facing, squadron.position),
        },
        state.rng,
      )
      if (!result.fired) return refuse(`${squadron.label}: ${result.reason}`)

      writeSquadron(squadron, result.squadron)
      squadron.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: squadron.side,
        shipId: target.id,
        text:
          `${squadron.label} attacks ${target.name}: ` +
          `${result.normalDamage} damage, ${result.penetratingDamage} penetrating`,
        dice: result.dice,
      })
      // Unlike a fighter, a gunboat's guns are ship guns (9.1), so the
      // optional rear-arc rule of 4.10 applies to them as it does to a
      // cruiser's — 8.9's "no advantage" is written about fighters only.
      applyFighterDamage(
        state,
        target,
        {
          normalDamage: result.normalDamage,
          penetratingDamage: result.penetratingDamage,
          mode: result.mode,
          dice: result.dice,
          detail: result.shots.map((shot) => shot.detail).join('; '),
        },
        {
          rearArcRule: optional(state).rearArcAttacks,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            squadron.position,
          ),
        },
      )
      return OK
    }

    case 'recover-gunboats': {
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('A squadron lands on a fighter move, phase 4 or 6 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (carrier.side !== squadron.side) return refuse('A squadron lands on its own side’s ship')

      // Fly it home first, under this phase's allowance, exactly as a wing.
      const home = carrier.placement.position
      const facing = carrier.placement.facing
      const flown = secondary
        ? secondaryMoveGunboatSquadron(squadron, home, facing)
        : moveGunboatSquadron(squadron, home, facing)
      if (!flown.moved) return refuse(`${squadron.label}: ${flown.reason}`)

      const result = recoverGunboatSquadron(
        flown.squadron,
        gunboatCarrierState(state, carrier),
        state.turn,
      )
      if (!result.recovered) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      squadron.carrierId = carrier.id
      pushLog(state, {
        kind: 'launch',
        side: squadron.side,
        shipId: carrier.id,
        text: `${carrier.name} recovers ${squadron.label}, refuelled and rearmed (9.1)`,
      })
      return OK
    }

    default:
      // Handlers for combat, ordnance, flight operations, boarding, threshold
      // and cloaks arrive with their engine modules. Refusing by name rather
      // than falling through silently means an action dispatched before its
      // module lands shows up as a refusal in the log instead of a no-op that
      // looks like it worked.
      return refuse(`Not yet implemented: ${action.type}`)
  }
}

// ---------------------------------------------------------------------------
// Ordnance in flight
// ---------------------------------------------------------------------------

/**
 * Missile markers on the table.
 *
 * `ordnance.ts` has a richer marker than `GameState` does — it carries a facing
 * and the distance flown, which a seeker needs and a counter on a map does not
 * — so the authoritative list lives here and `GameState.ordnance` carries a
 * projection of it for drawing. The projection is derived and never read back,
 * and both are rebuilt identically by a replay, so nothing about this is a
 * second source of truth.
 */
const ORDNANCE = new WeakMap<GameState, MissileMarker[]>()

function ordnanceOf(state: GameState): MissileMarker[] {
  let markers = ORDNANCE.get(state)
  if (!markers) {
    markers = []
    ORDNANCE.set(state, markers)
  }
  return markers
}

function setOrdnance(state: GameState, markers: MissileMarker[]): void {
  ORDNANCE.set(state, markers)
}

/** Copy what the map needs into GameState, for drawing only. */
function projectOrdnance(state: GameState): void {
  state.ordnance = ordnanceOf(state).map((marker) => ({
    id: marker.id,
    side: marker.owner,
    sourceShipId: marker.sourceShipId,
    kind: marker.kind === 'rocket' ? 'rocket' : marker.kind,
    grade: marker.grade === 'extended' ? 'extended' : 'standard',
    missiles: marker.missiles,
    position: marker.position,
    launchedTurn: marker.launchedTurn,
    stagesRemaining: 0,
    targetShipId: null,
  }))
}

/**
 * A ship's point-defence mounts (7.12 – 7.15).
 *
 * Two sources: the dedicated systems — PDS, ADS, scattergun, grapeshot — and
 * any class-1 beam, which 8.8 lets a ship fire as point defence at a worse
 * table. Both spend the mount for the turn, which is why the ids stay the ids
 * the rest of the engine knows them by.
 */
function pdMountsOf(ship: ShipState): PdMount[] {
  const kinds: Partial<Record<string, PdMountKind>> = {
    pds: 'pds',
    ads: 'ads',
    scattergun: 'scattergun',
    grapeshot: 'grapeshot',
  }
  const mounts: PdMount[] = []
  for (const system of ship.design.systems) {
    const kind = kinds[system.kind]
    if (!kind) continue
    if (ship.destroyedSystems.has(system.id)) continue
    if (!canWeaponFire(ship, system.id)) continue
    mounts.push({
      id: system.id,
      kind,
      arcs: bearingArcs(ship, system.arcs ?? ALL_ARCS),
      // The roll table this mount uses (8.8): a scattergun rolls four dice but
      // reads each on the PDS table, and a beam-1 reads a worse one.
      mode: 'pds',
    })
  }
  for (const weapon of ship.design.weapons) {
    if (weapon.weaponClass !== 'beam' || weapon.rating !== 1) continue
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!canWeaponFire(ship, weapon.id)) continue
    mounts.push({
      id: weapon.id,
      kind: 'beam-1',
      arcs: bearingArcs(ship, weapon.arcs),
      mode: 'beam-1',
    })
  }
  return mounts
}

const ALL_ARCS = ['F', 'FS', 'AS', 'A', 'AP', 'FP'] as const

function adfcCount(ship: ShipState, kind: 'adfc' | 'advanced-adfc'): number {
  return ship.design.systems.filter(
    (system) => system.kind === kind && !ship.destroyedSystems.has(system.id),
  ).length
}

/** Which launcher classes put a marker on the table (6.2, 6.6). */
function missileKindOf(weaponClass: string): 'salvo' | 'heavy' | 'antimatter' | null {
  switch (weaponClass) {
    case 'heavy-missile':
      return 'heavy'
    case 'salvo-missile-rack':
    case 'salvo-missile-launcher':
      return 'salvo'
    case 'antimatter-missile':
      return 'antimatter'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Flight operations (8)
// ---------------------------------------------------------------------------

/**
 * The boundary between the game's fighter groups and `fighters.ts`.
 *
 * The module works in values: every one of its functions takes a group and
 * returns a new one, which is what makes a dogfight between two groups one
 * call instead of two half-applied mutations. `GameState` works in place,
 * because the engine marks a ship's SSD the way a player marks a dry-erase
 * sheet. `writeFlight` is where the two meet, and the only reason it is not a
 * plain `Object.assign` is that the table's own columns — the group's name,
 * whether it is gunboats, the landing stamp, what it declared an attack on —
 * are not the module's to overwrite.
 */
function writeFlight(live: FighterGroupState, next: FighterGroup): void {
  const { label, recoveredTurn, targetId, side } = live
  Object.assign(live, next, { label, recoveredTurn, targetId, side })
}

function flightById(state: GameState, id: string): FighterGroupState | undefined {
  return state.fighterGroups.find((group) => group.id === id)
}

/**
 * What the carrier's flight deck can do this turn (8.1, 8.2).
 *
 * `usedThrust` is read off the written order rather than off the ship's
 * position, because flight operations are phase 4 and ships do not move until
 * phase 5: at the moment a group launches, the only evidence of what the
 * carrier is about to do is what its captain wrote down.
 */
function carrierFlightState(state: GameState, carrier: ShipState): CarrierFlightState {
  return {
    launchFacilities: operationalCount(carrier, 'launch-tube'),
    facilitiesUsed: facilitiesUsed(state, carrier),
    usedThrust: carrierUnderThrust(carrier),
    catapults: operationalCount(carrier, 'catapult') > 0,
  }
}

/**
 * Where the group is pointing after it moves.
 *
 * The default is the way it flew, because that is what a player who does not
 * say otherwise means; 8.5 lets them say otherwise, and 8.7's front 180° makes
 * it worth saying. A group that did not actually go anywhere keeps its facing.
 */
function facingAfterMove(
  flight: FighterGroupState,
  to: Point,
  chosen: Course | undefined,
): Course {
  if (chosen !== undefined) return chosen
  if (distance(flight.position, to) <= 1e-9) return flight.facing
  return nearestCourse(flight.position, to)
}

/** The re-arm die a landing group rolls, in words for the log (8.16). */
function describeRearm(rearm: RearmResult | null): string {
  if (!rearm) return ''
  if (rearm.outcome === 'lost') return ' — the group is written off (8.16)'
  if (rearm.outcome === 'crash-turnaround') return ` — turned around for turn ${rearm.readyTurn}`
  return ` — re-arming until turn ${rearm.readyTurn}`
}

function operationalCount(ship: ShipState, kind: SystemKind): number {
  return ship.design.systems.filter(
    (system) => system.kind === kind && !ship.destroyedSystems.has(system.id),
  ).length
}

/**
 * Launch tubes spent this turn.
 *
 * 8.1: "All carriers are allowed to launch (or recover) as many groups per
 * turn as they have operational launch tube/flight decks" — one pool, drawn on
 * by both operations, which is why both stamps are counted here.
 */
function facilitiesUsed(state: GameState, carrier: ShipState): number {
  return state.fighterGroups.filter(
    (group) =>
      group.carrierId === carrier.id &&
      (group.launchedTurn === state.turn || group.recoveredTurn === state.turn),
  ).length
}

function carrierUnderThrust(carrier: ShipState): boolean {
  if (!carrier.order) return false
  return thrustBudget(carrier.order, movementStateOf(carrier).drive).totalUsed > 0
}

/**
 * A fighter group's hits going onto a hull.
 *
 * The rear arc is denied on purpose: 8.9 says fighters "can attack ships from
 * the rear arc, but like missiles gain no advantage from doing so as it is
 * assumed that they must avoid being melted by the drive", so the optional rule
 * of 4.10 does not apply however the game is configured.
 */
function applyFighterDamage(
  state: GameState,
  target: ShipState,
  result: WeaponResult,
  opts: { rearArcRule?: boolean; rearArc?: boolean } = {},
): void {
  const applied = applyDamage(targetStateOf(target), result, {
    rearArcRule: opts.rearArcRule ?? false,
    rearArc: opts.rearArc ?? false,
    source: 'direct-fire',
  })
  writeBackDamage(target, applied.target)
  markHullBoxes(target, applied.hullDamage)
  if (target.destroyed) {
    pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
  }
}

/**
 * The gunboat half of the same boundary.
 *
 * A squadron carries the same per-turn flags a wing does and is written back
 * the same way; the columns the table owns are fewer, because a squadron has
 * no mission and no dogfight — 9.1 gives it a rack, a target and endurance.
 */
function writeSquadron(live: GunboatSquadronState, next: GunboatSquadron): void {
  const { label, targetId, side } = live
  Object.assign(live, next, { label, targetId, side })
}

function squadronById(state: GameState, id: string): GunboatSquadronState | undefined {
  return state.gunboatSquadrons.find((squadron) => squadron.id === id)
}

/**
 * What the carrying ship's racks and bays can do this turn (9.1).
 *
 * `gunboat-bay` is its own fit rather than a large `boat-bay` because 9.1
 * gives it its own mass and its own job: a bay recovers gunboats only when it
 * is *"of sufficient size to recover the whole squadron"*, and a ship's
 * general-purpose boat cradle is not that.
 */
function gunboatCarrierState(state: GameState, carrier: ShipState): GunboatCarrierState {
  return {
    racks: operationalCount(carrier, 'gunboat-rack'),
    bays: operationalCount(carrier, 'gunboat-bay'),
    used: state.gunboatSquadrons.filter(
      (squadron) =>
        squadron.carrierId === carrier.id &&
        (squadron.launchedTurn === state.turn || squadron.recoveredTurn === state.turn),
    ).length,
  }
}

/** The same default as a wing's: the way it flew, unless the player says (9.1). */
function squadronFacingAfterMove(
  squadron: GunboatSquadronState,
  to: Point,
  chosen: Course | undefined,
): Course {
  if (chosen !== undefined) return chosen
  if (distance(squadron.position, to) <= 1e-9) return squadron.facing
  return nearestCourse(squadron.position, to)
}

/**
 * Put boarding parties on the target's SSD (5.9, 5.18).
 *
 * They are stamped with the turn they landed because phase 13 says not to roll
 * for boarders that arrived this turn, and the boarding rules of 12.7 — when
 * they can be read — will want the same stamp.
 */
function landBoarders(
  state: GameState,
  from: ShipState,
  target: ShipState,
  parties: number,
): void {
  if (parties <= 0) return
  const existing = target.boarders.find(
    (party) => party.side === from.side && party.landedTurn === state.turn,
  )
  if (existing) existing.parties += parties
  else target.boarders.push({ side: from.side, parties, landedTurn: state.turn })
  pushLog(state, {
    kind: 'boarding',
    shipId: target.id,
    side: from.side,
    text: `${parties} boarding part${parties === 1 ? 'y' : 'ies'} from ${from.name} board ${target.name}`,
  })
}

/**
 * The Reflex Field's die, and what it does to a volley (7.25).
 *
 * "Energy weapon" is 7.25's own list, which `ew.ts` reads off each weapon's
 * section — the same set 7.2 says screens protect against. Anything else goes
 * straight through: a Reflex Field does nothing to a pulse torpedo.
 *
 * **[reading]** The table talks about "the damage" as one number, and a volley
 * arrives here as two — the part screens and armour may answer, and the part
 * that goes straight to the hull (4.6). So the die is rolled once against the
 * total, as the rule says, and the surviving damage is split back in the same
 * proportion, with the odd point going to the normal pile so armour still gets
 * its chance at it. Halving the two piles separately would round up twice and
 * quietly favour the attacker.
 */
function reflexField(
  state: GameState,
  shooter: ShipState,
  target: ShipState,
  weapon: WeaponDef,
  result: WeaponResult,
): { result: WeaponResult; back: number } {
  if (!target.reflexFieldActive) return { result, back: 0 }
  if (operationalCount(target, 'reflex-field') === 0) return { result, back: 0 }
  if (!isEnergyWeapon(weapon.weaponClass)) return { result, back: 0 }

  const total = result.normalDamage + result.penetratingDamage
  if (total <= 0) return { result, back: 0 }

  const roll = rollReflexField(total, state.rng)
  const penetrating = Math.min(result.penetratingDamage, Math.floor(roll.toTarget / 2))
  const normal = roll.toTarget - penetrating
  pushLog(state, {
    kind: 'note',
    shipId: target.id,
    side: target.side,
    dice: [roll.roll],
    text:
      `${target.name}'s Reflex Field: ${roll.outcome} — ${roll.toTarget} of ${total} lands` +
      (roll.toAttacker > 0 ? `, ${roll.toAttacker} reflected at ${shooter.name}` : ''),
  })
  return {
    result: { ...result, normalDamage: normal, penetratingDamage: penetrating },
    back: roll.toAttacker,
  }
}

/**
 * Which turn of an FTL exit this ship is on, or null if it is not leaving.
 *
 * The stage is a function of how long ago the drive was ordered up, because
 * `ftlTransit` is cleared every turn and the order is not re-made (11.4).
 */
function ftlStageOf(ship: ShipState, turn: number): FtlExitStage | null {
  if (ship.ftlTransit !== 'exiting' || ship.ftlWarmupTurn === null) return null
  const stage = ftlExitStage(ship.ftlWarmupTurn, turn)
  return stage === 'gone' ? null : stage
}

/**
 * The jump itself (11.4): a half move on the present course, and then the roll
 * for whatever the ship materialised through on the way out.
 *
 * *"Once a ship has left the table under FTL Drive, it may not return"*, so
 * the ship goes off-table rather than being destroyed — unless the roll says
 * otherwise, in which case it is destroyed where it stood and takes its
 * neighbours with it.
 */
function jumpToFtl(state: GameState, ship: ShipState): ActionOutcome {
  const before = movementStateOf(ship)
  const half = applyOrder({ ...before, velocity: Math.floor(before.velocity / 2) }, BLANK_ORDER)
  ship.lastKnown = {
    course: ship.placement.facing,
    velocity: ship.velocity,
    turn: state.turn,
    cloaked: ship.cloaked,
  }
  ship.placement = half.placement

  const report = resolveFtlExit(
    {
      exitPoint: ship.placement.position,
      advancedDrive: ship.design.ftl === 'advanced',
      nearby: state.ships
        .filter((other) => other.id !== ship.id && !other.destroyed && !other.offTable)
        .map((other) => ({ id: other.id, position: other.placement.position })),
      lightCraft: [
        ...state.fighterGroups
          .filter((g) => g.status === 'in-flight')
          .map((g) => ({ id: g.id, position: g.position })),
        ...state.gunboatSquadrons
          .filter((g) => g.status === 'in-flight')
          .map((g) => ({ id: g.id, position: g.position })),
        ...state.ordnance.map((m) => ({ id: m.id, position: m.position })),
      ],
    },
    state.rng,
  )

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    dice: report.roll === null ? undefined : [report.roll],
    text: `${ship.name}: ${report.note}`,
  })

  // 11.5: "Damage from FTL entry or exit cannot be absorbed by screens or
  // armor", which is what penetrating damage means to the pipeline.
  const hurt = (target: ShipState, damage: number, dice: number[], why: string): void => {
    if (damage <= 0) return
    markHullBoxes(target, damage)
    pushLog(state, {
      kind: 'damage',
      shipId: target.id,
      side: target.side,
      dice,
      text: `${target.name}: ${damage} from ${why}, past screens and armour (11.5)`,
    })
    if (target.destroyed) {
      pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
    }
  }

  hurt(ship, report.selfDamage, report.selfDice, 'its own FTL transit')
  for (const hit of report.bystanders) {
    const other = shipById(state, hit.id)
    if (other) hurt(other, hit.damage, hit.dice, `${ship.name}'s FTL transit`)
  }
  for (const id of report.lightCraftDestroyed) {
    const group =
      state.fighterGroups.find((g) => g.id === id) ?? state.gunboatSquadrons.find((g) => g.id === id)
    if (group) {
      group.status = 'destroyed'
      pushLog(state, {
        kind: 'destroyed',
        text: `${group.label} is caught in ${ship.name}'s FTL transit (11.4)`,
      })
    }
    setOrdnance(
      state,
      ordnanceOf(state).filter((marker) => marker.id !== id),
    )
  }
  projectOrdnance(state)

  if (report.selfDestroyed) {
    ship.destroyed = true
  } else if (report.jumped) {
    ship.offTable = true
    ship.ftlTransit = 'none'
    pushLog(state, {
      kind: 'note',
      shipId: ship.id,
      side: ship.side,
      text: `${ship.name} is gone into hyperspace and will not return (11.4)`,
    })
  } else {
    // A 1: "The ship remains in normal space at its present course and
    // velocity" — and has to start the whole thing again if it still wants to
    // leave.
    ship.ftlTransit = 'none'
    ship.ftlWarmupTurn = null
  }
  return OK
}

/**
 * Who fights whom when nobody has said (12.7 step 1).
 *
 * Phase 12 asks both players to allocate before any die is rolled, and there
 * is no interface for either choice yet, so the engine plays both sides the
 * obvious way: the attackers put just enough counters against the defending
 * Marines to match them and send the rest at the hull, and the defenders pile
 * their parties onto the attackers three at a time — the most 10.4 allows on
 * one job — with the Marines taking one each. It is the allocation the book's
 * own worked example makes, and it is replaced the moment there is a panel to
 * make the choice in.
 */
function defaultBoardingPlan(ship: BoardedShip, boarders: readonly BoardingForce[]): BoardingPlan {
  const units = boardingUnits(boarders, { ownerSide: ship.side })
  const marineCount = Math.max(0, Math.floor(ship.marines))
  const engaged = units.slice(0, marineCount)

  const dcps: Array<{ targetId: string; parties: number }> = []
  let left = Math.max(0, Math.floor(ship.damageControlParties))
  for (const unit of units) {
    if (left <= 0) break
    const parties = Math.min(MAX_DCPS_PER_TARGET, left)
    dcps.push({ targetId: unit.id, parties })
    left -= parties
  }

  return {
    engageMarines: engaged.map((unit) => unit.id),
    dcps,
    marines: engaged.map((unit) => ({ targetId: unit.id, marines: 1 })),
  }
}

/**
 * A ram declared in orders, resolved the moment the rammer arrives (16.7).
 *
 * Both ships' damage comes off the hull boxes they had *before* contact, and
 * both are inflicted at once — "simultaneous" is the whole character of the
 * move, and it is why the two numbers are computed before either is applied.
 * A rammer is as likely to die as its victim, which is what makes it a threat
 * rather than a trick.
 */
function resolveDeclaredRam(state: GameState, ship: ShipState): void {
  if (!ship.ramTargetId) return
  const target = shipById(state, ship.ramTargetId)
  ship.ramTargetId = null
  if (!target || target.destroyed || target.offTable || ship.destroyed) return

  const result = resolveRam(
    {
      position: ship.placement.position,
      // 4.11: a shot-out drive makes a worse rammer, so the current rating is
      // the one that counts, not what the SSD was printed with.
      thrust: currentThrust(ship),
      hullBoxes: ship.design.hullBoxes - ship.hullMarked,
    },
    {
      position: target.placement.position,
      thrust: currentThrust(target),
      hullBoxes: target.design.hullBoxes - target.hullMarked,
    },
    state.rng,
  )

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    targetId: target.id,
    side: ship.side,
    dice: [result.nerveRoll, result.attackerEvasionRoll, result.targetEvasionRoll].filter(
      (roll): roll is number => roll !== null,
    ),
    text: `${ship.name} rams ${target.name}: ${result.detail}`,
  })
  if (!result.damage) return

  // Both totals were computed above off pre-contact hulls; applying them in
  // either order now cannot change the other.
  const smash = (victim: ShipState, damage: number, dice: number[]): void => {
    if (damage <= 0) return
    const applied = applyDamage(
      targetStateOf(victim),
      {
        normalDamage: damage,
        penetratingDamage: 0,
        mode: result.damage?.mode ?? 'standard',
        dice,
        detail: 'ramming',
      },
      { rearArcRule: false, rearArc: false, source: 'direct-fire' },
    )
    writeBackDamage(victim, applied.target)
    markHullBoxes(victim, applied.hullDamage)
    pushLog(state, {
      kind: 'damage',
      shipId: victim.id,
      side: victim.side,
      text: `${victim.name} takes ${damage} from the collision (16.7)`,
    })
    if (victim.destroyed) {
      pushLog(state, { kind: 'destroyed', shipId: victim.id, text: `${victim.name} is destroyed` })
    }
  }
  smash(target, result.damage.damageToTarget, [result.damage.attackerRoll])
  smash(ship, result.damage.damageToAttacker, [result.damage.targetRoll])
}

/**
 * Solid bodies that a shot cannot pass through (17.1).
 *
 * *"Any line between two ships that crosses any part of the asteroid is
 * blocked. (Between center points of models, remember.)"* Planets and
 * planetoids are solid; a dust cloud, a nebula or an asteroid field is not
 * something a shot stops at, and each of those has its own rule instead.
 */
/**
 * Whether the approach flown this turn earns a docking (16.6).
 *
 * Called at the end of the ship's movement, because the rule is a test on
 * where the ship *ended up*: *"the ship's movement orders must be plotted so
 * that it ends up within 3 MU of the target ship/starbase at the end of the
 * turn."*
 */
function resolveDockingApproach(state: GameState, ship: ShipState): void {
  if (!ship.dockTargetId || ship.destroyed || ship.offTable) return
  const target = shipById(state, ship.dockTargetId)
  if (!target || target.destroyed || target.offTable) {
    ship.dockTargetId = null
    return
  }
  const vector = (s: ShipState) => ({
    position: s.placement.position,
    facing: s.placement.facing,
    velocity: s.velocity,
  })
  const approach = dockingApproach(vector(ship), vector(target))
  if (!approach.met) {
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text: `${ship.name} misses the docking: ${approach.reason}`,
    })
    return
  }
  ship.dock = holdApproach(ship.dock, target.id, state.turn)
  ship.dockTargetId = null
  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    text: `${ship.name} holds station on ${target.name} — docked next turn (16.6)`,
  })
}

/**
 * Anything docked to this ship goes where it goes (16.6).
 *
 * 16.6 never says so because on a table the models are physically attached.
 * The precedent is the wing still in the bay, dragged for the same reason and
 * with the same three lines.
 */
function dragDockedShips(state: GameState, host: ShipState): void {
  for (const other of state.ships) {
    if (other.id === host.id) continue
    if (other.dock.targetId !== host.id) continue
    if (other.dock.phase === 'free') continue
    other.placement = {
      position: { ...host.placement.position },
      facing: other.placement.facing,
    }
    other.velocity = host.velocity
  }
}

/**
 * A ship that has flown off the playing area (3.9).
 *
 * *"This is usually considered a retreat from the battle unless using the
 * moving table rules (section 16.4) or fighting an orbital scenario (section
 * 17.8)."* Either way the model is not on the table any more; what 16.4
 * changes is whether that means the ship has left the battle, and 4.12 scores
 * a disengaged hull at full value to the enemy.
 *
 * The optional re-entry roll is 3.9's own and is off unless the table asks for
 * it — it draws a die, and a die drawn where an old battle file drew none
 * moves the stream for everything after it.
 */
function resolveLeavingTable(state: GameState, ship: ShipState): void {
  if (ship.destroyed || ship.offTable) return
  const bounds = tableBounds(state)
  if (!isOffTable(ship.placement.position, bounds)) return

  const edge = departureEdge(ship.placement.position, bounds)
  const rules = optional(state)
  const retreat = leavingTableIsRetreat(rules.movingTable === true)
  ship.offTable = true
  ship.exitEdge = edge

  if (!rules.tableReentry) {
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text: retreat
        ? `${ship.name} leaves the table by the ${edge ?? 'edge'} — a retreat from the battle (3.9)`
        : `${ship.name} runs off the ${edge ?? 'edge'} of the drawn area (3.9, 16.4)`,
    })
    return
  }

  const reentry = rollTableReentry(state.rng, state.turn, edge)
  ship.reentryTurn = reentry.reentryTurn
  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    dice: [reentry.roll],
    text: reentry.returns
      ? `${ship.name} leaves by the ${edge ?? 'edge'} and may return on turn ${reentry.reentryTurn} (3.9)`
      : `${ship.name} leaves by the ${edge ?? 'edge'} and does not return (3.9)`,
  })
}

/**
 * Fly one ship for one turn under 12.12.
 *
 * The cinematic path is not reused and cannot be: `applyOrder` writes
 * `facing: path.course` because 3.1 says *"the course and facing are always
 * identical"*, and 12.12 exists precisely to separate them. What is shared is
 * everything around the move — the cloak brackets, the wing that rides in the
 * bay, the terrain the track crossed, the ram — so those are duplicated here
 * deliberately rather than factored out, because a shared helper would have to
 * take both movement systems' results and the two have different shapes.
 */
function moveUnderVector(state: GameState, ship: ShipState, warmingUp: boolean): ActionOutcome {
  const before = vectorStateOf(ship)
  // 11.4 again: a ship spinning up its FTL drive "may not apply any thrust in
  // that move", which under 12.12 is an empty order sheet.
  const orders = warmingUp ? [] : (ship.vectorOrders ?? [])
  const drive = { rating: ship.design.drive.thrust, hits: ship.driveHits }

  if (ship.cloak) {
    ship.cloak = cloakStartOfMovement(ship.cloak, ship.placement.position)
    ship.cloaked = cloakMode(ship.cloak) !== 'none'
  }

  const result = moveVector(before, orders, drive)

  ship.lastKnown = {
    course: ship.placement.facing,
    courseDegrees: before.course,
    velocity: ship.velocity,
    turn: state.turn,
    cloaked: ship.cloaked,
  }
  ship.placement = { position: result.end.position, facing: result.end.facing }
  ship.velocity = result.end.velocity
  ship.courseDegrees = result.end.course
  // 4.2's optional aft-arc exception asks whether the ship touched its drive,
  // and under vector that is the whole sheet: burns and thruster points alike.
  ship.thrustUsed = result.budget.mainDriveUsed + result.budget.thrusterUsed

  for (const group of state.fighterGroups) {
    if (group.carrierId === ship.id && group.status === 'aboard') {
      group.position = ship.placement.position
      group.facing = ship.placement.facing
    }
  }
  if (ship.cloak) {
    const wasCloaked = ship.cloaked
    const after = cloakEndOfMovement(ship.cloak, { velocity: ship.velocity })
    ship.cloak = after
    ship.cloaked = cloakMode(after) !== 'none'
    if (ship.cloaked !== wasCloaked) {
      pushLog(state, {
        kind: 'note',
        shipId: ship.id,
        side: ship.side,
        text: ship.cloaked ? `${ship.name} cloaks (7.20)` : `${ship.name} decloaks`,
      })
    }
  }

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    text:
      `${ship.name} ${result.legal && orders.length > 0 ? formatVectorOrders(orders) : 'coasts'}` +
      ` — ${result.end.velocity} MU on ${result.end.course.toFixed(0)}°` +
      (result.legal ? '' : ', the sheet overran the drive (12.12)'),
  })

  // 12.12: "the tape-measure line, start position to finishing position" is
  // what a collision is tested against, and it is not the flown sequence.
  resolveTerrainHazards(state, ship, [result.chord.from, result.chord.to])
  resolveDeclaredRam(state, ship)
  resolveLeavingTable(state, ship)
  dragDockedShips(state, ship)
  return OK
}

/**
 * Whose turn it is to place (18.1), or null when nobody owes a placement.
 *
 * *"Players alternate in placing one ship at a time … (or two to four ships at
 * a time for large battles)"*, and a side that runs out drops out of the
 * rotation rather than holding it up: alternation is a way of taking turns,
 * not a claim that the fleets are the same size. Recomputed from the order,
 * the batch and what has been placed, so nothing has to be kept in step.
 */
export function deployingSide(state: GameState): SideId | null {
  const deployment = state.deployment
  if (!deployment || deployment.order.length === 0) return null

  const owed = new Map<SideId, number>()
  for (const ship of shipsAwaitingDeployment(state)) {
    owed.set(ship.side, (owed.get(ship.side) ?? 0) + 1)
  }
  if (owed.size === 0) return null

  // How far into the rotation we are: each completed batch is one step, and a
  // side with nothing left is skipped over.
  const live = deployment.order.filter((id) => (owed.get(id) ?? 0) > 0)
  if (live.length === 0) return null
  const step = Math.floor(deployment.placed.length / deployment.batch)
  return live[step % live.length]
}

/** The side that owns a table half in an offensive/defensive battle (18.1). */
export function defendingSide(state: GameState): SideId | null {
  const deployment = state.deployment
  if (!deployment || deployment.battleType !== 'offensive-defensive') return null
  for (const [sideId, zone] of Object.entries(deployment.zones)) {
    if (zone.entry.includes('placed') && !zone.entry.includes('table-edge')) return sideId
  }
  return null
}

/**
 * The edge the whole action has drifted into, if any (16.4).
 *
 * *"Very close"* is the players' call, so the margin is the caller's; a beam
 * range band is the natural unit on a Full Thrust table and is what the UI
 * offers.
 */
export function tableIsCrowded(state: GameState, margin: number): ShiftEdge | null {
  if (!optional(state).movingTable) return null
  const positions = state.ships
    .filter((ship) => !ship.destroyed && !ship.offTable)
    .map((ship) => ship.placement.position)
  return crowdedEdge(positions, state.table, margin)
}

/** Where the computer would put a side's remaining ships (18.1). */
export function proposeDeployment(
  state: GameState,
  sideId: SideId,
): Array<{ shipId: string; position: Point; facing: Course; velocity: number }> {
  const deployment = state.deployment
  if (!deployment) return []
  const zone = deployment.zones[sideId]
  if (!zone) return []
  const ships = shipsAwaitingDeployment(state).filter((ship) => ship.side === sideId)
  const spots = defaultPlacements(zone, ships.length)
  return ships.map((ship, i) => ({
    shipId: ship.id,
    position: spots[i]?.position ?? ship.placement.position,
    facing: spots[i]?.facing ?? ship.placement.facing,
    velocity: spots[i]?.velocity ?? 6,
  }))
}

const SOLID_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['planet', 'planetoid'])

/** Dust and gas: 17.2 charges for speed through it and nothing for being in it. */
const CLOUD_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['dust-cloud', 'nebula'])

/** Rock and wreckage: 17.4's die per full 6 MU, straight through screens and armour. */
const FIELD_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['asteroid-field', 'debris'])

function terrainOfKinds(state: GameState, kinds: ReadonlySet<TerrainKind>): TerrainBody[] {
  return state.terrain
    .filter((feature) => kinds.has(feature.kind))
    .map((feature) => ({ id: feature.id, position: feature.position, radius: feature.radius }))
}

/**
 * What the ship flew through (17.2, 17.4, 17.6).
 *
 * Section 17 opens by calling itself *"mostly pure space opera"*, so it is an
 * optional rule — and it has to be one for a second reason: every hazard draws
 * from `state.rng`, and a die drawn in a path an old battle file did not draw
 * it in shifts the stream for everything after it. Off, no dice, old files
 * replay exactly as they were fought.
 *
 * The order below is fixed and is part of the rules reading, because the order
 * is the RNG stream: solid bodies first (a ship killed by a rock throws nothing
 * else), then clouds, then fields, each in the order the scenario placed them.
 */
function resolveTerrainHazards(state: GameState, ship: ShipState, path: readonly Point[]): void {
  if (!optional(state).terrainHazards) return
  if (ship.destroyed || ship.offTable) return

  // 17.6: "When any ship, regardless of its class, hits an asteroid, the ship
  // is completely destroyed. Ramming a billion tons of rock at any speed is not
  // recommended, even in a superdreadnought!"
  for (const body of terrainOfKinds(state, SOLID_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const miss = resolveCollision(ship.velocity, currentThrust(ship), state.rng, {
      advancedDrive: ship.design.drive.advanced,
    })
    if (miss.avoided) {
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        dice: miss.roll === null ? undefined : [miss.roll],
        text: `${ship.name} threads the rock — ${miss.reason || `needed ${miss.target}`} (17.6)`,
      })
      continue
    }
    ship.destroyed = true
    ship.pendingThresholdRows = 0
    pushLog(state, {
      kind: 'destroyed',
      shipId: ship.id,
      side: ship.side,
      dice: miss.roll === null ? undefined : [miss.roll],
      text: `${ship.name} flies into the rock and is gone — ${miss.reason} (17.6)`,
    })
    return
  }

  // 17.2 rule 1: over 12 MU through a cloud costs a die, read on the beam
  // table, with standard screens offering nothing.
  for (const body of terrainOfKinds(state, CLOUD_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const dust = cloudSpeedDamage(ship.velocity, state.rng, {
      screens: effectiveScreenLevel(ship),
      advancedScreens: ship.design.screens.advanced,
    })
    if (!dust.rolled) continue
    hurtByTerrain(state, ship, {
      normalDamage: dust.damage,
      penetratingDamage: 0,
      mode: dust.mode,
      dice: dust.roll === null ? [] : [dust.roll],
      detail: `dust at velocity ${ship.velocity} (17.2)`,
    })
    if (ship.destroyed) return
  }

  // 17.4: one die per full 6 MU, and the face is the damage, penetrating.
  for (const body of terrainOfKinds(state, FIELD_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const hits = resolveMeteorField(ship.velocity, state.rng)
    if (hits.dice.length === 0) continue
    hurtByTerrain(state, ship, {
      normalDamage: 0,
      penetratingDamage: hits.penetratingDamage,
      mode: hits.mode,
      dice: hits.dice,
      detail: `rock at velocity ${ship.velocity} (17.4)`,
    })
    if (ship.destroyed) return
  }
}

/** Apply what a piece of terrain did, the same way a shot is applied (4.8). */
function hurtByTerrain(
  state: GameState,
  ship: ShipState,
  hit: { normalDamage: number; penetratingDamage: number; mode: DamageMode; dice: number[]; detail: string },
): void {
  const total = hit.normalDamage + hit.penetratingDamage
  if (total <= 0) return
  const applied = applyDamage(targetStateOf(ship), hit, {
    rearArcRule: false,
    rearArc: false,
    source: 'direct-fire',
  })
  writeBackDamage(ship, applied.target)
  markHullBoxes(ship, applied.hullDamage)
  pushLog(state, {
    kind: 'damage',
    shipId: ship.id,
    side: ship.side,
    dice: hit.dice,
    text: `${ship.name} takes ${applied.hullDamage} from ${hit.detail}`,
  })
  if (ship.destroyed) {
    pushLog(state, { kind: 'destroyed', shipId: ship.id, text: `${ship.name} is destroyed` })
  }
}

function blockingTerrain(state: GameState): TerrainBody[] {
  return state.terrain
    .filter((feature) => SOLID_TERRAIN.has(feature.kind))
    .map((feature) => ({ id: feature.id, position: feature.position, radius: feature.radius }))
}

/**
 * How stealthy the target is right now (7.4, 7.5).
 *
 * Stealth is not electronic warfare and does not stack with it: it is a hull
 * shape and a coating, and 7.4 wears it away as the hull is opened up — a
 * Stealth-1 hull is bare once two rows are gone, a Stealth-2 hull drops a
 * level per row after the first. A stealth *field* adds to it, and 7.5 caps
 * the total at 2.
 *
 * 7.20 switches it off entirely under a cloak: *"The ship does not gain any
 * bonuses for stealth while the cloak is active."*
 */
function stealthLevelOf(ship: ShipState): StealthLevel {
  if (ship.cloaked) return 0
  const built = Math.min(2, operationalCount(ship, 'stealth-hull')) as StealthLevel
  const field = Math.min(2, operationalCount(ship, 'stealth-field')) as StealthLevel
  return combinedStealthLevel(stealthHullLevel(built, hullRowsCompleted(ship)), field, true)
}

/**
 * The target's electronic warfare fit, as one shot sees it (7.17 – 7.22).
 *
 * Levels are what is *operational*, not what is fitted: ECM is one SSD box per
 * level and is lost progressively to damage (7.18), so a knocked-out box stops
 * counting the moment it is crossed off. Area ECM is read off the neighbours,
 * since 7.19 covers a *friend* within 6 MU rather than the ship carrying it —
 * and 7.20 switches a cloaked ship's area cover off, which is why the emitter
 * has to be checked as well as the range.
 */
function ewDefencesOf(state: GameState, target: ShipState): EwDefences {
  const areaEcm = state.ships
    .filter(
      (ship) =>
        ship.side === target.side &&
        !ship.destroyed &&
        !ship.offTable &&
        !ship.cloaked &&
        distance(ship.placement.position, target.placement.position) <= AREA_ECM_RADIUS,
    )
    .reduce((best, ship) => Math.max(best, operationalCount(ship, 'area-ecm')), 0)

  return {
    holofield: operationalCount(target, 'holofield') > 0,
    ecmLevel: operationalCount(target, 'ecm'),
    areaEcmLevel: areaEcm,
    cloak: target.cloak ? cloakMode(target.cloak) : 'none',
  }
}

/**
 * A ship as its point defence sees it.
 *
 * The one rule that lives here rather than in `defences.ts` is 8.4's: "A ship
 * that launches or recovers fighters cannot use an ADFC in that turn." It is a
 * flight-operations rule that happens to be paid for in point defence, so the
 * ADFC count is zeroed at the boundary and `defences.ts` never has to know
 * that carriers exist. The ship's own mounts still fire — only the umbrella it
 * holds over its neighbours goes down.
 */
function pdDefenderOf(state: GameState, ship: ShipState, mounts: PdMount[]): PdDefender {
  const busy = adfcLockedOut({
    launchedThisTurn: launchedThisTurn(state, ship),
    recoveredThisTurn: recoveredThisTurn(state, ship),
  })
  return {
    id: ship.id,
    placement: ship.placement,
    mounts,
    adfc: busy ? 0 : adfcCount(ship, 'adfc'),
    advancedAdfc: busy ? 0 : adfcCount(ship, 'advanced-adfc'),
  }
}

function launchedThisTurn(state: GameState, ship: ShipState): boolean {
  return state.fighterGroups.some(
    (group) => group.carrierId === ship.id && group.launchedTurn === state.turn,
  )
}

function recoveredThisTurn(state: GameState, ship: ShipState): boolean {
  return state.fighterGroups.some(
    (group) => group.carrierId === ship.id && group.recoveredTurn === state.turn,
  )
}

// ---------------------------------------------------------------------------
// Damage plumbing
// ---------------------------------------------------------------------------

/**
 * The working screen level (7.2).
 *
 * A screen generator is a symbol on the SSD and takes threshold checks like any
 * other, so losing one drops the level — which is why designs carry a
 * `screen-generator` entry per level plus any backups. The arithmetic and the
 * cap belong to `defences.ts`, which owns 7.2; counting the surviving
 * generators off a ShipState is the part that belongs here.
 */
export function effectiveScreenLevel(ship: ShipState): ScreenLevel {
  const working = ship.design.systems.filter(
    (system) => system.kind === 'screen-generator' && !ship.destroyedSystems.has(system.id),
  ).length
  return screenLevelOf(ship.design.screens, working)
}

/** The damage pipeline's view of a ship. */
function targetStateOf(ship: ShipState): DamageableTarget {
  const fresh = createTargetState(ship.design)
  return {
    ...fresh,
    hullDamage: ship.hullMarked,
    armourRemaining: ship.design.armour.layers.map(
      (boxes, layer) => boxes - (ship.armourMarked[layer] ?? 0),
    ),
  }
}

/** Write armour back; hull goes through markHullBoxes, which owns the rows. */
function writeBackDamage(ship: ShipState, after: DamageableTarget): void {
  ship.armourMarked = ship.design.armour.layers.map(
    (boxes, layer) => boxes - (after.armourRemaining[layer] ?? boxes),
  )
}

// ---------------------------------------------------------------------------
// The ready gate (online play)
// ---------------------------------------------------------------------------

/**
 * Which sides have declared themselves finished with the current phase.
 *
 * Hot-seat does not need this — one player advances the phase by hand. Online,
 * a phase closes only when every side says so, because neither console may
 * speak for the other.
 *
 * Stored off the GameState so it never rides in a save: readiness is about the
 * two people at the table, not about the battle.
 */
/**
 * Optional rules in force for this battle.
 *
 * They live in the setup rather than in GameState, which the engine cannot
 * reach — so the store stamps them here when it builds the game. Held off the
 * state so they never ride in a save twice and can never drift from the setup
 * that is the authority.
 */
export interface OptionalRules {
  driveDamage?: boolean
  rearArcAttacks?: boolean
  coreSystems?: boolean
  reactorBreaches?: boolean
  emergencyThrust?: boolean
  sensorRules?: boolean
  /**
   * 4.2's exception to the aft-arc ban: *"Aft arc fire is permitted on any game
   * turn in which the firing ship did not use any thrust from its main drive."*
   * Off by default, which leaves the ban absolute as the base rule states it.
   */
  aftArcFire?: boolean
  /**
   * Section 17's hazards: collisions with rock, dust at speed, meteor fields.
   * *"The following suggestions are mostly pure space opera"* — the section
   * says so itself — and every one of them draws dice, so it is off unless the
   * table asks for it.
   */
  terrainHazards?: boolean
  /**
   * 18.3: *"Combat Points Value"* reprices every hull by mass. A different
   * currency rather than a discount, so the fleet picker and the scoreboard
   * both have to be told which one the table is playing in.
   */
  cpv?: boolean
  /**
   * 12.12: *"a completely OPTIONAL alternative movement system, which players
   * may use instead of the standard FT movement rules"*. Settled before play,
   * like every other option, and absent means 3.1's cinematic movement.
   */
  movementSystem?: 'cinematic' | 'vector'
  /**
   * 16.4: the playing area slides under the ships instead of the action
   * running out of room, which is also what makes 3.9's departure something
   * other than a retreat and what 16.5's pursuit hangs off.
   */
  movingTable?: boolean
  /** 3.9's optional re-entry roll for a ship that flew off the edge. */
  tableReentry?: boolean
}

const OPTIONS = new WeakMap<GameState, OptionalRules>()

export function setOptionalRules(state: GameState, rules: OptionalRules): void {
  OPTIONS.set(state, rules)
}

export function optional(state: GameState): OptionalRules {
  return OPTIONS.get(state) ?? {}
}

const READY = new WeakMap<GameState, Record<SideId, boolean>>()

function readySides(state: GameState): Record<SideId, boolean> {
  let map = READY.get(state)
  if (!map) {
    map = {}
    READY.set(state, map)
  }
  return map
}

export function sidesAwaited(state: GameState): SideId[] {
  const ready = readySides(state)
  return state.sides.filter((side) => !ready[side.id]).map((side) => side.id)
}

export function everyoneReady(state: GameState): boolean {
  return sidesAwaited(state).length === 0
}

export function clearReady(state: GameState): void {
  READY.set(state, {})
}

/**
 * Which side an action speaks for, or null if it speaks for the table. Online
 * play uses this to refuse a console giving orders to the other fleet.
 */
export function actionSide(state: GameState, action: GameAction): SideId | null {
  if ('side' in action) return action.side
  const shipId =
    'shipId' in action ? action.shipId : 'carrierId' in action ? action.carrierId : undefined
  if (shipId) return shipById(state, shipId)?.side ?? null
  if ('flightId' in action) {
    return state.fighterGroups.find((g) => g.id === action.flightId)?.side ?? null
  }
  if ('squadronId' in action) {
    return state.gunboatSquadrons.find((s) => s.id === action.squadronId)?.side ?? null
  }
  return null
}

/**
 * Whether an action may be taken back in an online match. Actions that close a
 * phase or roll shared dice are not undoable, because the other console has
 * already seen the result.
 */
export function undoableInMatch(action: GameAction): boolean {
  switch (action.type) {
    case 'advance-phase':
    case 'signal-ready':
    case 'roll-initiative':
    case 'set-initiative-order':
    case 'move-ship':
    case 'fire-weapon':
    case 'fire-at-flight':
    case 'threshold-check':
    case 'resolve-damage-control':
    case 'resolve-point-defence':
    case 'resolve-ordnance-attacks':
    case 'resolve-boarding':
    case 'resolve-reactor-explosions':
      return false
    default:
      return true
  }
}
