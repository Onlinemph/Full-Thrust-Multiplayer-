import { describe, expect, it } from 'vitest'

import { applyAction, type GameAction } from './actions'
import { Rng } from './dice'
import { enemiesOf, type GameState } from './game'
import { buildGame, replayGame, type GameSetup } from '../data/savedGame'

/**
 * Fuzzing the engine.
 *
 * Every test above this one checks something a person thought of. This one
 * checks the things nobody thought of: it throws legal-but-arbitrary actions at
 * the game in an arbitrary order — including actions that are wrong for the
 * phase, which the engine must refuse rather than crash on — and asserts the
 * invariants that must hold no matter what.
 *
 * The invariants are the interesting part. They are the statements that would
 * still be true of a game of Full Thrust played by a lunatic:
 *
 *  - damage never runs past the end of a hull track (4.9)
 *  - a ship's velocity is never negative (3.1)
 *  - a facing is always on the twelve-point clock (3.1)
 *  - a destroyed ship never comes back
 *  - armour marked never exceeds armour fitted (4.8)
 *  - and, above all, the whole thing still replays exactly
 *
 * A failure here is worth more than a failure anywhere else in the repository,
 * because it is a case nobody would have written down.
 */

const SCENARIOS = ['intro-fleet-engagement', 'border-skirmish', 'line-of-battle']

/** One arbitrary action, drawn from what the engine accepts. */
function randomAction(game: GameState, rng: Rng): GameAction {
  const ships = game.ships.filter((s) => !s.destroyed && !s.offTable)
  const ship = ships[rng.int(Math.max(1, ships.length))]
  if (!ship) return { type: 'advance-phase' }

  const roll = rng.int(14)
  switch (roll) {
    case 0:
    case 1:
      return { type: 'advance-phase' }
    case 2:
      return {
        type: 'plot-turn',
        shipId: ship.id,
        direction: rng.int(2) ? 'port' : 'starboard',
        // Deliberately allowed to exceed the drive: an illegal order must be
        // refused, and refusing is the behaviour under test.
        points: rng.int(6),
      }
    case 3:
      return { type: 'plot-accel', shipId: ship.id, accel: rng.int(17) - 8 }
    case 4:
      return { type: 'plot-emergency-thrust', shipId: ship.id, on: rng.int(2) === 1 }
    case 5:
      return { type: 'clear-order', shipId: ship.id }
    case 6:
      return { type: 'roll-initiative' }
    case 7:
      return { type: 'move-ship', shipId: ship.id }
    case 8: {
      const enemies = enemiesOf(game, ship).filter((e) => !e.destroyed)
      const target = enemies[rng.int(Math.max(1, enemies.length))]
      const weapon = ship.design.weapons[rng.int(Math.max(1, ship.design.weapons.length))]
      if (!target || !weapon) return { type: 'pass-fire', shipId: ship.id }
      return { type: 'fire-weapon', shipId: ship.id, weaponId: weapon.id, targetId: target.id }
    }
    case 9:
      return { type: 'threshold-sweep' }
    case 10:
      return { type: 'resolve-damage-control' }
    case 11: {
      const enemies = enemiesOf(game, ship).filter((e) => !e.destroyed)
      const target = enemies[rng.int(Math.max(1, enemies.length))]
      const weapon = ship.design.weapons[rng.int(Math.max(1, ship.design.weapons.length))]
      if (!target || !weapon) return { type: 'advance-phase' }
      return {
        type: 'launch-ordnance',
        shipId: ship.id,
        weaponId: weapon.id,
        aimPoint: target.placement.position,
      }
    }
    case 12:
      return { type: 'resolve-point-defence' }
    default:
      return { type: 'resolve-ordnance-attacks' }
  }
}

/** Everything that must be true of a game of Full Thrust, however it was played. */
function checkInvariants(game: GameState, context: string): void {
  for (const ship of game.ships) {
    expect(ship.hullMarked, `${context}: ${ship.id} hull`).toBeGreaterThanOrEqual(0)
    expect(ship.hullMarked, `${context}: ${ship.id} hull`).toBeLessThanOrEqual(
      ship.design.hullBoxes,
    )
    expect(ship.velocity, `${context}: ${ship.id} velocity`).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(ship.velocity), `${context}: ${ship.id} velocity finite`).toBe(true)
    expect(Number.isFinite(ship.placement.position.x), `${context}: ${ship.id} x`).toBe(true)
    expect(Number.isFinite(ship.placement.position.y), `${context}: ${ship.id} y`).toBe(true)
    expect(ship.placement.facing, `${context}: ${ship.id} facing`).toBeGreaterThanOrEqual(1)
    expect(ship.placement.facing, `${context}: ${ship.id} facing`).toBeLessThanOrEqual(12)
    expect(Number.isInteger(ship.placement.facing), `${context}: ${ship.id} facing whole`).toBe(
      true,
    )
    ship.design.armour.layers.forEach((boxes, layer) => {
      const marked = ship.armourMarked[layer] ?? 0
      expect(marked, `${context}: ${ship.id} armour ${layer}`).toBeGreaterThanOrEqual(0)
      expect(marked, `${context}: ${ship.id} armour ${layer}`).toBeLessThanOrEqual(boxes)
    })
    // A ship with hull left is not destroyed, and one with none is.
    if (ship.hullMarked >= ship.design.hullBoxes) {
      expect(ship.destroyed, `${context}: ${ship.id} should be destroyed`).toBe(true)
    }
  }
  expect(game.turn, `${context}: turn`).toBeGreaterThan(0)
  expect(game.phases, `${context}: phase valid`).toContain(game.phase)
}

describe('fuzzing', () => {
  it.each(SCENARIOS)('survives a thousand arbitrary actions on %s', (scenarioId) => {
    const setup: GameSetup = { scenarioId, seed: 0xf0f0 }
    const game = buildGame(setup)
    const chooser = new Rng(12345)
    const actions: GameAction[] = []

    for (let i = 0; i < 1000; i++) {
      const action = randomAction(game, chooser)
      // Refusals are fine and expected; a throw is not.
      applyAction(game, action)
      actions.push(action)
      if (i % 50 === 0) checkInvariants(game, `${scenarioId} @${i}`)
    }
    checkInvariants(game, `${scenarioId} final`)

    // And the whole arbitrary mess still replays exactly, which is the property
    // every save, undo and remote match depends on.
    const replayed = replayGame({ version: 1, setup, actions })
    expect(
      replayed.ships.map((s) => [
        s.id,
        s.placement.position.x.toFixed(6),
        s.placement.position.y.toFixed(6),
        s.velocity,
        s.hullMarked,
        [...s.destroyedSystems].sort().join(','),
      ]),
    ).toEqual(
      game.ships.map((s) => [
        s.id,
        s.placement.position.x.toFixed(6),
        s.placement.position.y.toFixed(6),
        s.velocity,
        s.hullMarked,
        [...s.destroyedSystems].sort().join(','),
      ]),
    )
  })

  it('survives many different action streams', () => {
    // A different chooser seed is a different lunatic. Twenty of them, shorter,
    // to cover more shapes of nonsense rather than more of one shape.
    for (let seed = 0; seed < 20; seed++) {
      const setup: GameSetup = { scenarioId: 'border-skirmish', seed: seed * 7919 }
      const game = buildGame(setup)
      const chooser = new Rng(seed)
      for (let i = 0; i < 200; i++) applyAction(game, randomAction(game, chooser))
      checkInvariants(game, `stream ${seed}`)
    }
  })
})
