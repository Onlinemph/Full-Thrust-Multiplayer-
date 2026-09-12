/**
 * What a fighter group can be told to do this phase, besides "fly there"
 * (8.3 – 8.18).
 *
 * Fifteen of section 8's actions were reachable from the engine's API and from
 * nothing a player could click. Deciding *which* of them a given group may be
 * given right now is rules work — it turns on the phase, the group's type, its
 * loadout, its endurance, its mission, and who is within reach — so it lives
 * here where it can be tested, and the panel renders whatever this returns.
 *
 * This module answers "what is offered", never "what happens". Every option
 * carries the action to dispatch; `applyAction` remains the only thing that
 * decides whether it is legal, and a control offered in error is refused
 * rather than obeyed.
 */

import { distance } from './geometry'
import {
  effectiveType,
  hasAce,
  inFrontArc,
  isExhausted,
  mainMoveAllowance,
  FIGHTER_ATTACK_RANGE,
  FTL_FIGHTER_DEPLOY_RANGE,
  MISSILE_FIGHTER_RANGE,
  MULTI_ROLE_LOADOUTS,
} from './fighters'
import type { FighterGroupState, GameState } from './game'
import type { Course, Point } from './types'
import type { GameAction } from './actions'

/** One thing on the panel: a label, the targets it may be pointed at, and the action. */
export interface FlightOrderOption {
  /** Target or choice id — a ship, a group, a marker, a loadout. */
  id: string
  name: string
  action: GameAction
}

export interface FlightOrder {
  /** Stable id, so the panel and the tests name the same control. */
  kind: FlightOrderKind
  label: string
  /** One line of why, for the panel's right-hand column. */
  hint: string
  /** Empty means the order applies to the group itself, with no target. */
  options: FlightOrderOption[]
  /** Offered but not takeable — no endurance left, say. */
  disabled: boolean
  /** A group-level order with no target picker. */
  action?: GameAction
}

export type FlightOrderKind =
  | 'rearm'
  | 'ftl-deploy'
  | 'salvo'
  | 'screen'
  | 'pursue'
  | 'clear-mission'
  | 'scramble'
  | 'refuse-dogfight'
  | 'furball'
  | 'intercept'
  | 'press-attack'
  | 'payload'
  | 'boarding-run'
  | 'ace-needle'

// ---------------------------------------------------------------------------
// Who is within reach
// ---------------------------------------------------------------------------

const inFlight = (group: FighterGroupState): boolean => group.status === 'in-flight'

function enemyGroups(
  game: GameState,
  flight: FighterGroupState,
  within: number,
): FighterGroupState[] {
  return game.fighterGroups.filter(
    (other) =>
      other.side !== flight.side &&
      inFlight(other) &&
      distance(other.position, flight.position) <= within,
  )
}

function friendlyGroups(
  game: GameState,
  flight: FighterGroupState,
  within: number,
): FighterGroupState[] {
  return game.fighterGroups.filter(
    (other) =>
      other.id !== flight.id &&
      other.side === flight.side &&
      inFlight(other) &&
      distance(other.position, flight.position) <= within,
  )
}

/**
 * Enemy hulls this group could actually declare against (8.7).
 *
 * Range is the obvious half; the arc is the half a panel gets wrong. 8.7 gives
 * a group a *front 180 degree* arc, so a ship the group has already flown past
 * is not a target however close it is — and offering it is worse than offering
 * nothing, because the click is refused and the player is left guessing which
 * of the two rules stopped it.
 */
function enemyShips(game: GameState, flight: FighterGroupState, within: number) {
  return game.ships.filter(
    (ship) =>
      ship.side !== flight.side &&
      !ship.destroyed &&
      !ship.offTable &&
      // 11.7: an attached battlerider is not a hull anything may be aimed at.
      ship.carriedBy === null &&
      distance(ship.placement.position, flight.position) <= within &&
      inFrontArc(flight, ship.placement.position),
  )
}

/**
 * The clock point that runs straight away from a threat (3.1, 8.10).
 *
 * Course 6 points toward increasing y and course 3 toward increasing x, so the
 * angle is measured from the negative y axis, clockwise.
 */
export function bearingAwayFrom(from: Point, threat: Point, fallback: Course): Course {
  const dx = from.x - threat.x
  const dy = from.y - threat.y
  if (dx === 0 && dy === 0) return fallback
  const point = Math.round((Math.atan2(dx, -dy) * 6) / Math.PI)
  return (((point + 11) % 12) + 1) as Course
}

// ---------------------------------------------------------------------------
// The orders
// ---------------------------------------------------------------------------

export function flightOrders(game: GameState, flight: FighterGroupState): FlightOrder[] {
  if (flight.status === 'destroyed') return []
  const orders: FlightOrder[] = []
  const add = (order: FlightOrder): void => {
    // A picker with nothing to point at is not an order, it is a dead control.
    if (order.options.length === 0 && !order.action) return
    orders.push(order)
  }

  switch (game.phase) {
    case 'orders': {
      // 8.15: "Multi-Role Fighters … may be re-configured for a different
      // mission each time they re-arm on the carrier" — in the bay, not in the
      // air, which is what makes the type a gamble rather than a free choice.
      if (flight.typeId === 'multi-role' && flight.status === 'aboard') {
        add({
          kind: 'rearm',
          label: 'Re-arm as',
          hint: 'a Multi-Role group picks its loadout in the bay (8.15)',
          disabled: false,
          options: MULTI_ROLE_LOADOUTS.flatMap((loadout) =>
            (['beam', 'cannon'] as const).map((armament) => ({
              id: `${loadout}:${armament}`,
              name: `${loadout} with ${armament}`,
              action: {
                type: 'reconfigure-flight' as const,
                flightId: flight.id,
                loadout: loadout as 'standard' | 'interceptor' | 'attack',
                armament,
              },
            })),
          ),
        })
      }
      // 8.15: FTL fighters "can be deployed at the start of the battle already
      // in space near their carrier" — turn one, and nowhere else.
      if (
        game.turn === 1 &&
        flight.status === 'aboard' &&
        flight.modifiers.includes('ftl') &&
        flight.carrierId !== null
      ) {
        const carrier = game.ships.find((ship) => ship.id === flight.carrierId)
        if (carrier) {
          add({
            kind: 'ftl-deploy',
            label: 'Already in space',
            hint: `within ${FTL_FIGHTER_DEPLOY_RANGE} MU of the carrier, turn one only (8.15)`,
            disabled: false,
            options: [],
            action: {
              type: 'deploy-ftl-flight',
              flightId: flight.id,
              position: {
                x: carrier.placement.position.x,
                y: carrier.placement.position.y - (FTL_FIGHTER_DEPLOY_RANGE - 1),
              },
              facing: carrier.placement.facing,
            },
          })
        }
      }
      break
    }

    case 'launch-missiles': {
      // 8.15: a Missile Fighter group's one salvo, out to 12 MU.
      if (inFlight(flight) && effectiveType(flight) === 'missile' && !flight.payloadSpent) {
        add({
          kind: 'salvo',
          label: 'Salvo at',
          hint: `${MISSILE_FIGHTER_RANGE} MU, one shot, then they fight as standard fighters (8.15)`,
          disabled: false,
          options: enemyShips(game, flight, MISSILE_FIGHTER_RANGE).map((ship) => ({
            id: ship.id,
            name: ship.name,
            action: { type: 'launch-flight-missiles', flightId: flight.id, targetId: ship.id },
          })),
        })
      }
      break
    }

    case 'move-fighters': {
      if (inFlight(flight)) {
        const reach = mainMoveAllowance(flight, game.turn)
        // 8.6: a group on screen takes station on a ship or another group.
        add({
          kind: 'screen',
          label: 'Screen',
          hint: 'takes station on it and moves with it instead of flying (8.6)',
          disabled: false,
          options: [
            ...game.ships
              .filter(
                (ship) =>
                  ship.side === flight.side &&
                  !ship.destroyed &&
                  !ship.offTable &&
                  distance(ship.placement.position, flight.position) <= reach,
              )
              .map((ship) => ({
                id: ship.id,
                name: ship.name,
                action: { type: 'assign-screen' as const, flightId: flight.id, escortId: ship.id },
              })),
            ...friendlyGroups(game, flight, reach).map((group) => ({
              id: group.id,
              name: group.label,
              action: { type: 'assign-screen' as const, flightId: flight.id, escortId: group.id },
            })),
          ],
        })
        // 8.6: pursuit is only of what the group attacked last turn.
        add({
          kind: 'pursue',
          label: 'Pursue',
          hint: 'only what it attacked last turn (8.6)',
          disabled: false,
          options: game.fighterGroups
            .filter(
              (other) =>
                other.side !== flight.side && inFlight(other) && flight.lastTargetId === other.id,
            )
            .map((other) => ({
              id: other.id,
              name: other.label,
              action: { type: 'declare-pursuit' as const, flightId: flight.id, targetId: other.id },
            })),
        })
        if (flight.mission !== 'free') {
          add({
            kind: 'clear-mission',
            label: `On ${flight.mission}`,
            hint: 'gives up the station and flies free again (8.6)',
            disabled: false,
            options: [],
            action: { type: 'clear-mission', flightId: flight.id },
          })
        }
      }
      // 8.3: the one unplanned launch, when enemy fighters come for the ship.
      if (flight.status === 'aboard' && flight.carrierId !== null) {
        const carrier = game.ships.find((ship) => ship.id === flight.carrierId)
        // 8.3 is not "enemy fighters are about"; it is "the opponent has just
        // moved one or more fighter groups into position to attack the carrier
        // itself". A group that has not moved this turn has not just done
        // anything, and the engine refuses the scramble against it.
        const threats = carrier
          ? game.fighterGroups.filter(
              (other) =>
                other.side !== flight.side &&
                inFlight(other) &&
                other.movedThisTurn &&
                distance(other.position, carrier.placement.position) <= FIGHTER_ATTACK_RANGE * 2,
            )
          : []
        add({
          kind: 'scramble',
          label: 'Scramble against',
          hint: '8.3’s unplanned launch — the carrier still may not use its drive',
          disabled: false,
          options: threats.map((other) => ({
            id: other.id,
            name: other.label,
            action: {
              type: 'scramble-fighters' as const,
              carrierId: flight.carrierId ?? '',
              attackerFlightId: other.id,
              flightIds: [flight.id],
            },
          })),
        })
      }
      break
    }

    case 'fighter-vs-fighter': {
      if (!inFlight(flight)) break
      // 8.10: a faster group may decline the dogfight and run for it.
      add({
        kind: 'refuse-dogfight',
        label: 'Run from',
        hint: 'only the faster group may decline (8.10)',
        disabled: isExhausted(flight),
        options: game.fighterGroups
          .filter((other) => other.side !== flight.side && flight.engagedWith.includes(other.id))
          .map((other) => {
            const away = bearingAwayFrom(flight.position, other.position, flight.facing)
            const run = mainMoveAllowance(flight, game.turn)
            return {
              id: other.id,
              name: other.label,
              action: {
                type: 'refuse-dogfight' as const,
                flightId: flight.id,
                attackerFlightId: other.id,
                to: stepAway(flight.position, away, run),
                facing: away,
              },
            }
          }),
      })
      // 8.11: a furball is one resolution for the whole scrum, so it is built
      // from who is actually in it rather than asked for group by group.
      const opposition = enemyGroups(game, flight, FIGHTER_ATTACK_RANGE)
      const ours = [flight, ...friendlyGroups(game, flight, FIGHTER_ATTACK_RANGE)].filter(
        (group) => enemyGroups(game, group, FIGHTER_ATTACK_RANGE).length > 0,
      )
      if (ours.length > 1 && opposition.length > 1) {
        add({
          kind: 'furball',
          label: `Furball: ${ours.length} against ${opposition.length}`,
          hint: 'every group fires once and splits its kills (8.11)',
          disabled: false,
          options: [],
          action: {
            type: 'flight-furball',
            entries: ours.map((group) => ({
              flightId: group.id,
              targetFlightIds: enemyGroups(game, group, FIGHTER_ATTACK_RANGE).map((e) => e.id),
            })),
          },
        })
      }
      break
    }

    case 'point-defence': {
      // 8.9: a group in the missiles' way kills them before they arrive.
      if (!inFlight(flight) || isExhausted(flight)) break
      add({
        kind: 'intercept',
        label: 'Intercept',
        hint: 'fighters in the way stop the salvo before it arrives (8.9)',
        disabled: false,
        options: game.ordnance
          .filter(
            (marker) =>
              marker.side !== flight.side &&
              distance(marker.position, flight.position) <= FIGHTER_ATTACK_RANGE,
          )
          .map((marker) => ({
            id: marker.id,
            name: `${marker.kind} × ${marker.missiles}`,
            action: {
              type: 'flight-intercept' as const,
              flightId: flight.id,
              ordnanceId: marker.id,
            },
          })),
      })
      break
    }

    case 'ordnance-vs-ships':
    case 'ship-fire': {
      if (!inFlight(flight)) break
      const targets = enemyShips(game, flight, FIGHTER_ATTACK_RANGE)
      const type = effectiveType(flight)

      // 8.9: an intercepted run may go in anyway, through the group in the way.
      if (flight.targetId !== null) {
        add({
          kind: 'press-attack',
          label: 'Press through',
          hint: 'the run goes in anyway, and the interceptors shoot on the way (8.9)',
          disabled: false,
          options: game.fighterGroups
            .filter((other) => other.side !== flight.side && flight.engagedWith.includes(other.id))
            .map((other) => ({
              id: other.id,
              name: other.label,
              action: {
                type: 'flight-press-attack' as const,
                flightId: flight.id,
                interceptorFlightId: other.id,
                targetId: flight.targetId ?? '',
              },
            })),
        })
      }

      // 8.15's one-shot loads.
      if ((type === 'torpedo' || type === 'mkp') && !flight.payloadSpent) {
        add({
          kind: 'payload',
          label: type === 'mkp' ? 'Loose MKPs at' : 'Torpedoes at',
          hint: 'one shot; afterwards the group fights as standard fighters (8.15)',
          disabled: false,
          options: targets.map((ship) => ({
            id: ship.id,
            name: ship.name,
            action: {
              type: 'flight-launch-payload' as const,
              flightId: flight.id,
              targetId: ship.id,
            },
          })),
        })
      }
      if (type === 'assault-shuttle') {
        add({
          kind: 'boarding-run',
          label: 'Boarding run on',
          hint: 'point defence shoots first, and what survives lands marines (8.15, 12.7)',
          disabled: false,
          options: targets.map((ship) => ({
            id: ship.id,
            name: ship.name,
            action: {
              type: 'flight-boarding-run' as const,
              flightId: flight.id,
              targetId: ship.id,
            },
          })),
        })
      }

      // 8.18: the Ace's needle shot, which costs the group a die.
      if (hasAce(flight) && flight.targetId !== null) {
        const target = game.ships.find((ship) => ship.id === flight.targetId)
        if (target) {
          add({
            kind: 'ace-needle',
            label: `Ace picks out ${target.name}’s`,
            hint: 'the rest of the group attacks with one die fewer (8.18)',
            disabled: false,
            options: [
              ...target.design.systems.filter((s) => !target.destroyedSystems.has(s.id)),
              ...target.design.weapons.filter((w) => !target.destroyedSystems.has(w.id)),
            ].map((system) => ({
              id: system.id,
              name: system.label,
              action: {
                type: 'flight-ace-needle' as const,
                flightId: flight.id,
                targetId: target.id,
                systemId: system.id,
              },
            })),
          })
        }
      }
      break
    }

    default:
      break
  }
  return orders
}

/** One clock-face step of `distance` MU from a point (3.1). */
function stepAway(from: Point, course: Course, run: number): Point {
  const angle = ((course % 12) * Math.PI) / 6
  return {
    x: from.x + Math.sin(angle) * run,
    y: from.y - Math.cos(angle) * run,
  }
}

/**
 * 8.4: *"the carrier may perform a combat landing"* — everyone down at once,
 * and the deck is fouled for the rest of the game. A carrier's order rather
 * than a group's, so it is answered separately.
 */
export function combatLandingAvailable(game: GameState, shipId: string): boolean {
  if (game.phase !== 'move-fighters' && game.phase !== 'secondary-fighter-moves') return false
  return game.fighterGroups.some(
    (group) => group.carrierId === shipId && group.status === 'in-flight',
  )
}
