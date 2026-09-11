import { describe, expect, it } from 'vitest'

import { applyAction, type GameAction } from './actions'
import { PHASE_ORDER, type Phase } from './types'
import { shipMovementOrder, type GameState } from './game'
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
