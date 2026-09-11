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
  pushLog,
  rollInitiative,
  setInitiativeOrder,
  shipById,
  type GameState,
  type ShipState,
  type SideId,
} from './game'
import {
  applyOrder,
  driveFromDef,
  formatOrder,
  rollEmergencyThrust,
  validateOrder,
  type MovementState,
} from './movement'
import type { Arc, MovementOrder, TurnDirection } from './types'

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
  | { type: 'plot-mines'; shipId: string; on: boolean }
  | { type: 'clear-order'; shipId: string }

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
  | { type: 'move-flight'; flightId: string; to: { x: number; y: number } }
  | { type: 'secondary-move-flight'; flightId: string; to: { x: number; y: number } }
  | { type: 'flight-strike'; flightId: string; targetId: string }
  | { type: 'flight-dogfight'; flightId: string; targetFlightId: string }
  | { type: 'flight-intercept'; flightId: string; ordnanceId: string }
  | { type: 'flight-evade'; flightId: string }
  | { type: 'recover-flight'; flightId: string; carrierId: string }

  // Boarding (phase 12)
  | { type: 'resolve-boarding' }

  // Threshold and repair (phases 13, 14)
  | { type: 'threshold-check'; shipId: string }
  | { type: 'assign-damage-control'; shipId: string; systemId: string; parties: number }
  | { type: 'resolve-damage-control'; shipId: string }
  | { type: 'resolve-reactor-explosions' }

  // Electronic warfare and cloaks (7.17 – 7.22)
  | { type: 'set-cloak'; shipId: string; on: boolean }

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

/** Orders are written in phase 1 and nowhere else (2.6). */
function orderable(state: GameState, ship: ShipState | undefined): ActionOutcome | ShipState {
  if (!ship) return refuse('No such ship')
  if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
  if (state.phase !== 'orders') return refuse('Orders are written in phase 1')
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
      advancePhase(state)
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

    case 'plot-mines': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.layingMines = action.on
      return OK
    }

    case 'clear-order': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.order = null
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

      // A ship with no written order holds its course: velocity is conserved
      // and it must move its full velocity anyway (3.1).
      const order = ship.order ?? BLANK_ORDER
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

      const result = applyOrder(movementStateOf(ship), effective)
      ship.lastKnown = {
        course: ship.placement.facing,
        velocity: ship.velocity,
        turn: state.turn,
        cloaked: ship.cloaked,
      }
      ship.placement = result.placement
      ship.velocity = result.velocity
      pushLog(state, {
        kind: 'move',
        text: `${ship.name} ${formatOrder(effective, before.velocity)}`,
        side: ship.side,
      })
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
