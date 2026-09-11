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
  availableFireCons,
  canWeaponFire,
  engagedTargets,
  markHullBoxes,
  markShipFired,
  markWeaponFired,
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
import { applyDamage, createTargetState, type DamageableTarget } from './combat'
import { arcTo, distance, isRearArcAttack } from './geometry'
import {
  effectiveScreenLevel as screenLevelOf,
  pointDefenceOptions,
  resolvePointDefence,
  type PdAllocation,
  type PdMount,
  type PdMountKind,
  type PdThreat,
} from './defences'
import type { ScreenLevel } from './dice'
import { fireWeapon, needsFireCon } from './weapons'
import {
  acquireMissileTargets,
  launchMissile,
  moveOrdnanceMarkers,
  resolveOrdnanceAttack,
  type MissileMarker,
} from './ordnance'
import {
  damageControlPhase,
  rollThresholdChecks,
  thresholdPhase,
} from './threshold'
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
  /** One ship's threshold point. Every ship that owes one, in one action. */
  | { type: 'threshold-check'; shipId: string }
  | { type: 'threshold-sweep' }
  | { type: 'assign-damage-control'; shipId: string; systemId: string; parties: number }
  /** Phase 14 sweep: every party that was assigned makes its roll. */
  | { type: 'resolve-damage-control' }
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

    // ── Fire (4.4 – 4.9, phase 11) ────────────────────────────────────────
    case 'fire-weapon': {
      const ship = shipById(state, action.shipId)
      const target = shipById(state, action.targetId)
      if (!ship || !target) return refuse('No such ship')
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (ship.side === target.side) return refuse('That is a friendly ship')

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That weapon is knocked out')
      // 2.6: a weapon fires once a turn, and point defence in phase 9 spends it.
      if (!canWeaponFire(ship, weapon.id)) return refuse('That weapon has already fired')

      // 4.4: each FireCon engages one target. A weapon may join a target the
      // ship is already engaging for free; a new target costs a FireCon.
      if (needsFireCon(weapon) && !engagedTargets(ship, state.phase).includes(target.id)) {
        if (!assignFireCon(ship, target.id, state.phase)) return refuse('No FireCon available')
      }

      // Everything the resolver needs is re-derived here rather than carried in
      // the payload, so a stale or edited action cannot make a replay disagree.
      const rules = optional(state)
      const range = distance(ship.placement.position, target.placement.position)
      const arc = arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
      if (!weapon.arcs.includes(arc)) return refuse('Target is not in that arc')

      const result = fireWeapon(weapon, {
        range,
        arc,
        targetScreens: effectiveScreenLevel(target),
        rearArc: isRearArcAttack(
          target.placement.position,
          target.placement.facing,
          ship.placement.position,
        ),
        drm: 0,
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

      const applied = applyDamage(targetStateOf(target), result, {
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

      pushLog(state, {
        kind: applied.hullDamage > 0 ? 'damage' : 'fire',
        shipId: ship.id,
        targetId: target.id,
        side: ship.side,
        dice: result.dice,
        text: `${ship.name} fires ${weapon.label} at ${target.name}: ${result.detail}`,
      })
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
        arcs: weapon.arcs,
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

        const options = pointDefenceOptions(
          { id: ship.id, placement: ship.placement, mounts, adfc: adfcCount(ship, 'adfc'),
            advancedAdfc: adfcCount(ship, 'advanced-adfc') },
          threats,
        )
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

        const outcome = resolvePointDefence(
          { id: ship.id, placement: ship.placement, mounts, adfc: adfcCount(ship, 'adfc'),
            advancedAdfc: adfcCount(ship, 'advanced-adfc') },
          threats,
          allocations,
          state.rng,
        )

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
      arcs: system.arcs ?? ALL_ARCS,
      // The roll table this mount uses (8.8): a scattergun rolls four dice but
      // reads each on the PDS table, and a beam-1 reads a worse one.
      mode: 'pds',
    })
  }
  for (const weapon of ship.design.weapons) {
    if (weapon.weaponClass !== 'beam' || weapon.rating !== 1) continue
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!canWeaponFire(ship, weapon.id)) continue
    mounts.push({ id: weapon.id, kind: 'beam-1', arcs: weapon.arcs, mode: 'beam-1' })
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
