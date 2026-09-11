import { describe, expect, it } from 'vitest'

import { applyAction, type GameAction } from './actions'
import { PHASE_ORDER, type Phase } from './types'
import { canWeaponFire, enemiesOf, shipMovementOrder, type GameState } from './game'
import { distance, arcTo } from './geometry'
import { maxRangeOf } from './weapons'
import { aiActions } from './ai'
import {
  isExhausted,
  mainMoveAllowance,
  secondaryMoveAllowance,
  FIGHTER_ATTACK_RANGE,
} from './fighters'
import { GUNBOAT_FIRE_CONTROL, GUNBOAT_MOVE, GUNBOAT_SECONDARY_MOVE } from './gunboats'
import type { Point } from './types'
import { buildGame, replayGame, type GameSetup } from '../data/savedGame'
import { SCENARIOS } from '../data/scenarios'

/**
 * Whole-battle smoke tests.
 *
 * Unit tests check a rule; these check that the rules still work when they are
 * put next to each other and run for a while. A fifteen-phase sequence over a
 * dozen turns with ships dying in the middle of it is where modules that each
 * pass their own tests find out they disagree — and it is the cheapest place to
 * catch that, because it costs nothing to run a thousand turns.
 */

/** Every action the current phase offers, taken in a fixed order. */
function playPhase(game: GameState): GameAction[] {
  const taken: GameAction[] = []
  const take = (action: GameAction) => {
    applyAction(game, action)
    taken.push(action)
  }

  switch (game.phase) {
    case 'orders':
      for (const ship of game.ships) {
        if (ship.destroyed || ship.offTable) continue
        // A carrier with fighters still in the bay writes "Launch" and nothing
        // else: "A ship that is launching fighters cannot use the main drive
        // to perform any velocity, course, or facing changes" (8.1), and 8.2
        // refuses the launch outright if it did. So the carriers hold station
        // while their wings go up, which is what a carrier captain does.
        if (
          ship.design.fighterBays.length > 0 &&
          game.fighterGroups.some((group) => group.carrierId === ship.id && group.status === 'aboard')
        ) {
          continue
        }
        // A deterministic weave, so a ship that can turn does and the fleets
        // actually close: a battle where nobody manoeuvres tests very little.
        const swing = ship.id.charCodeAt(ship.id.length - 1) % 3
        if (swing > 0) {
          take({
            type: 'plot-turn',
            shipId: ship.id,
            direction: swing === 1 ? 'port' : 'starboard',
            points: 1,
          })
        }
        take({ type: 'plot-accel', shipId: ship.id, accel: swing === 2 ? -1 : 1 })
      }
      break
    case 'initiative':
      take({ type: 'roll-initiative' })
      break
    case 'move-ships':
      for (const ship of shipMovementOrder(game)) {
        if (ship.destroyed || ship.offTable) continue
        take({ type: 'move-ship', shipId: ship.id })
      }
      take({ type: 'move-ordnance' })
      break
    case 'move-fighters':
      // Every wing goes up and flies at the nearest enemy. A carrier under
      // thrust refuses the launch (8.2) and the action is journalled as a
      // refusal, which is exactly what should happen on a replay too.
      for (const group of game.fighterGroups) {
        if (group.status === 'aboard' && group.carrierId) {
          take({ type: 'launch-flight', carrierId: group.carrierId, flightId: group.id })
        }
      }
      for (const group of game.fighterGroups) {
        if (group.status !== 'in-flight') continue
        const prey = nearestEnemyShip(game, group)
        if (!prey) continue
        take({
          type: 'move-flight',
          flightId: group.id,
          to: closeTo(group.position, prey, mainMoveAllowance(group, game.turn)),
        })
      }
      // Gunboats launch and move with the fighters (9.1).
      for (const squadron of game.gunboatSquadrons) {
        if (squadron.status === 'aboard' && squadron.carrierId) {
          take({
            type: 'launch-gunboats',
            carrierId: squadron.carrierId,
            squadronId: squadron.id,
          })
        }
      }
      for (const squadron of game.gunboatSquadrons) {
        if (squadron.status !== 'in-flight') continue
        const prey = nearestEnemyShip(game, squadron)
        if (!prey) continue
        take({
          type: 'move-gunboats',
          squadronId: squadron.id,
          to: closeTo(squadron.position, prey, GUNBOAT_MOVE),
        })
      }
      break
    case 'secondary-fighter-moves':
      for (const group of game.fighterGroups) {
        if (group.status !== 'in-flight' || isExhausted(group)) continue
        const prey = nearestEnemyShip(game, group)
        if (!prey) continue
        take({
          type: 'secondary-move-flight',
          flightId: group.id,
          to: closeTo(group.position, prey, secondaryMoveAllowance(group)),
        })
      }
      for (const squadron of game.gunboatSquadrons) {
        if (squadron.status !== 'in-flight' || squadron.cef <= 0) continue
        const prey = nearestEnemyShip(game, squadron)
        if (!prey) continue
        take({
          type: 'move-gunboats',
          squadronId: squadron.id,
          to: closeTo(squadron.position, prey, GUNBOAT_SECONDARY_MOVE),
        })
      }
      break
    case 'fighter-vs-fighter':
      for (const group of game.fighterGroups) {
        if (group.status !== 'in-flight' || isExhausted(group)) continue
        const enemy = game.fighterGroups.find(
          (other) =>
            other.side !== group.side &&
            other.status === 'in-flight' &&
            distance(group.position, other.position) <= FIGHTER_ATTACK_RANGE,
        )
        if (enemy) take({ type: 'flight-dogfight', flightId: group.id, targetFlightId: enemy.id })
      }
      break
    case 'launch-missiles':
    case 'point-defence':
    case 'ordnance-vs-ships':
      // Ordnance is the computer's to fly here: aiming a missile is a judgement
      // about where a ship will be, and the AI already makes it (6.3).
      for (const side of game.sides) for (const a of aiActions(game, side.id)) take(a)
      // Attack runs are resolved after point defence has had its say (8.7).
      if (game.phase === 'ordnance-vs-ships') {
        for (const group of game.fighterGroups) {
          if (group.status !== 'in-flight' || isExhausted(group)) continue
          const prey = nearestEnemyShip(game, group)
          if (!prey) continue
          if (distance(group.position, prey.placement.position) > FIGHTER_ATTACK_RANGE) continue
          take({ type: 'flight-strike', flightId: group.id, targetId: prey.id })
        }
        // 9.1: "Gunboats then make their attacks in the Fighter Attack Phase".
        for (const squadron of game.gunboatSquadrons) {
          if (squadron.status !== 'in-flight' || squadron.cef <= 0) continue
          const prey = nearestEnemyShip(game, squadron)
          if (!prey) continue
          if (distance(squadron.position, prey.placement.position) > GUNBOAT_FIRE_CONTROL) continue
          take({ type: 'gunboat-attack', squadronId: squadron.id, targetId: prey.id })
        }
      }
      break
    case 'ship-fire':
      // Every ship fires everything that can bear on the nearest enemy, which
      // is both the commonest thing a player does and the heaviest path
      // through the engine.
      for (const ship of game.ships) {
        if (ship.destroyed || ship.offTable) continue
        const enemies = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
        if (enemies.length === 0) continue
        const target = enemies.reduce((best, e) =>
          distance(ship.placement.position, e.placement.position) <
          distance(ship.placement.position, best.placement.position)
            ? e
            : best,
        )
        const range = distance(ship.placement.position, target.placement.position)
        const arc = arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
        for (const weapon of ship.design.weapons) {
          if (ship.destroyedSystems.has(weapon.id)) continue
          if (!canWeaponFire(ship, weapon.id)) continue
          if (!weapon.arcs.includes(arc)) continue
          if (range > maxRangeOf(weapon)) continue
          take({ type: 'fire-weapon', shipId: ship.id, weaponId: weapon.id, targetId: target.id })
        }
      }
      break
    case 'threshold':
      take({ type: 'threshold-sweep' })
      break
    case 'damage-control':
      take({ type: 'resolve-damage-control' })
      break
    default:
      break
  }

  take({ type: 'advance-phase' })
  return taken
}

/** The nearest live enemy hull to a fighter group or gunboat squadron. */
function nearestEnemyShip(game: GameState, group: { side: string; position: Point }) {
  const enemies = game.ships.filter(
    (ship) => ship.side !== group.side && !ship.destroyed && !ship.offTable,
  )
  if (enemies.length === 0) return undefined
  return enemies.reduce((best, ship) =>
    distance(group.position, ship.placement.position) <
    distance(group.position, best.placement.position)
      ? ship
      : best,
  )
}

/** Fly `allowance` MU toward a ship, or all the way to it if that is nearer. */
function closeTo(
  from: Point,
  target: { placement: { position: Point } },
  allowance: number,
): Point {
  const to = target.placement.position
  const span = distance(from, to)
  if (span <= allowance || span === 0) return to
  const t = allowance / span
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function playTurns(setup: GameSetup, turns: number): { game: GameState; actions: GameAction[] } {
  const game = buildGame(setup)
  const actions: GameAction[] = []
  // A guard rather than a loop bound: if advance-phase ever stopped advancing,
  // this test should fail rather than hang a CI runner.
  let guard = turns * PHASE_ORDER.length * 4
  while (game.turn <= turns && guard-- > 0) {
    actions.push(...playPhase(game))
  }
  expect(guard, 'the sequence of play stopped advancing').toBeGreaterThan(0)
  return { game, actions }
}

describe.each(SCENARIOS.map((s) => [s.id, s.name] as const))('%s (%s)', (scenarioId) => {
  const setup: GameSetup = { scenarioId, seed: 0x5eed }

  it('plays ten turns without throwing', () => {
    const { game } = playTurns(setup, 10)
    expect(game.turn).toBeGreaterThan(10)
  })

  it('replays those ten turns to exactly the same state', () => {
    const { game, actions } = playTurns(setup, 10)
    const replayed = replayGame({ version: 1, setup, actions })
    expect(fingerprint(replayed)).toBe(fingerprint(game))
  })

  it('leaves every ship somewhere legal', () => {
    const { game } = playTurns(setup, 10)
    for (const ship of game.ships) {
      expect(Number.isFinite(ship.placement.position.x), ship.id).toBe(true)
      expect(Number.isFinite(ship.placement.position.y), ship.id).toBe(true)
      // 3.1: "Ships may not have negative velocities."
      expect(ship.velocity, ship.id).toBeGreaterThanOrEqual(0)
      expect(ship.placement.facing, ship.id).toBeGreaterThanOrEqual(1)
      expect(ship.placement.facing, ship.id).toBeLessThanOrEqual(12)
      // 4.9: damage never runs past the end of the track.
      expect(ship.hullMarked, ship.id).toBeLessThanOrEqual(ship.design.hullBoxes)
    }
  })

  it('visits every phase the scenario plays, in the rulebook order', () => {
    const game = buildGame(setup)
    const seen: Phase[] = [game.phase]
    for (let i = 0; i < game.phases.length; i++) {
      applyAction(game, { type: 'advance-phase' })
      seen.push(game.phase)
    }
    // Round-trips to the first phase of the next turn.
    expect(seen[seen.length - 1]).toBe(game.phases[0])
    expect(seen.slice(0, -1)).toEqual([...game.phases])
    expect(game.turn).toBe(2)
  })
})

describe('a long battle', () => {
  it('survives fifty turns of the biggest scenario', () => {
    // Long enough for ships to leave the table, run out of things to do, and
    // for any counter that was going to overflow to have overflowed.
    const { game } = playTurns({ scenarioId: 'line-of-battle', seed: 99 }, 50)
    expect(game.turn).toBeGreaterThan(50)
    expect(game.log.length).toBeGreaterThan(0)
  })

  it('actually flies the fighters it launches', () => {
    // Guards the flight actions against passing by refusal. Every one of them
    // returns an ActionOutcome the loop above ignores, so a phase gate that
    // was quietly wrong would leave the wings sitting in their bays for fifty
    // turns and every other assertion here would still be green.
    const { game, actions } = playTurns({ scenarioId: 'line-of-battle', seed: 0x5eed }, 12)
    expect(game.fighterGroups.length, 'the scenario has carriers').toBeGreaterThan(0)

    const attempted = (type: string) => actions.filter((a) => a.type === type).length
    expect(attempted('launch-flight'), 'launches attempted').toBeGreaterThan(0)
    expect(attempted('move-flight'), 'fighter moves attempted').toBeGreaterThan(0)

    // Something has to have come of it: a group that has spent endurance has
    // attacked, moved twice or evaded, and a group off its carrier has flown.
    expect(attempted('launch-gunboats'), 'gunboat launches attempted').toBeGreaterThan(0)
    expect(
      game.gunboatSquadrons.some((squadron) => squadron.launchedTurn !== null),
      'at least one squadron left its rack',
    ).toBe(true)

    const flew = game.fighterGroups.some((group) => group.launchedTurn !== null)
    const spent = game.fighterGroups.some((group) => group.cef < 6 || group.strength < 6)
    expect(flew, 'at least one group left its carrier').toBe(true)
    expect(spent, 'at least one group spent endurance or took losses').toBe(true)
  })

  it('gives a different battle for every seed, and the same one for the same seed', () => {
    const a = playTurns({ scenarioId: 'border-skirmish', seed: 1 }, 6)
    const b = playTurns({ scenarioId: 'border-skirmish', seed: 1 }, 6)
    const c = playTurns({ scenarioId: 'border-skirmish', seed: 2 }, 6)
    expect(fingerprint(a.game)).toBe(fingerprint(b.game))
    expect(fingerprint(a.game)).not.toBe(fingerprint(c.game))
  })
})

function fingerprint(game: GameState): string {
  return JSON.stringify({
    turn: game.turn,
    phase: game.phase,
    // Initiative is seeded and is part of the battle, so it belongs in the
    // fingerprint — and while nothing is shooting yet it is the ONLY thing the
    // seed reaches, which is what makes the different-seeds test mean anything.
    initiative: game.initiative,
    ships: game.ships.map((ship) => [
      ship.id,
      ship.placement.position.x.toFixed(4),
      ship.placement.position.y.toFixed(4),
      ship.placement.facing,
      ship.velocity,
      ship.hullMarked,
      ship.driveHits,
      [...ship.destroyedSystems].sort().join('|'),
    ]),
    log: game.log.map((entry) => `${entry.text}|${(entry.dice ?? []).join(',')}`),
  })
}
