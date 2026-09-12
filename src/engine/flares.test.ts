import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules } from './actions'
import { type GameState } from './game'
import { buildGame, type GameSetup } from '../data/savedGame'

/**
 * 17.3, from the star to the crossed-off box.
 *
 * `resolveSolarFlare` has been right since it was written and had no caller:
 * the rule says only *"perhaps diced for each turn"*, so nothing in the engine
 * ever decided a flare had happened. A `solar-flare` feature now carries the
 * die score it goes off on, and the roll is taken as each turn opens.
 */

function battle(over: Partial<GameSetup> = {}): GameState {
  return buildGame({ scenarioId: 'flare-star', seed: 7, solarFlares: true, ...over })
}

/** Wind on whole turns, which is what a flare is diced for. */
function playTurns(game: GameState, turns: number): void {
  const stop = game.turn + turns
  let guard = 0
  while (game.turn < stop && guard++ < 400) applyAction(game, { type: 'advance-phase' })
}

function fireCons(game: GameState): number {
  let live = 0
  for (const ship of game.ships) {
    for (const system of ship.design.systems) {
      if (system.kind !== 'firecon' && system.kind !== 'advanced-firecon') continue
      if (!ship.destroyedSystems.has(system.id)) live += 1
    }
  }
  return live
}

describe('solar flares (17.3)', () => {
  it('burns FireCons off the ships in reach', () => {
    const game = battle()
    const before = fireCons(game)
    expect(before).toBeGreaterThan(0)
    playTurns(game, 10)
    expect(game.log.some((entry) => /flares \(17\.3\)/.test(entry.text ?? ''))).toBe(true)
    expect(fireCons(game)).toBeLessThan(before)
  })

  it('does nothing at all unless the table asked for it', () => {
    const game = buildGame({ scenarioId: 'flare-star', seed: 7 })
    const before = fireCons(game)
    playTurns(game, 10)
    expect(game.log.some((entry) => /flares \(17\.3\)/.test(entry.text ?? ''))).toBe(false)
    expect(fireCons(game)).toBe(before)
  })

  it('leaves a scenario with no star alone', () => {
    const game = buildGame({ scenarioId: 'line-of-battle', seed: 7, solarFlares: true })
    const before = fireCons(game)
    playTurns(game, 6)
    expect(fireCons(game)).toBe(before)
  })

  it('rolls once a turn per star, not once a phase', () => {
    const game = battle()
    playTurns(game, 6)
    const flares = game.log.filter((entry) => /flares \(17\.3\)/.test(entry.text ?? '')).length
    // Six turns at a 5-or-6 star: two thirds of the time it does not go off,
    // so a per-phase roll would show up here as a dozen or more.
    expect(flares).toBeLessThanOrEqual(6)
  })

  it('does not fire the star on a battle that has not started its second turn', () => {
    const game = battle()
    expect(game.log.some((entry) => /flares \(17\.3\)/.test(entry.text ?? ''))).toBe(false)
  })

  it('keeps the roll in the journal, so a replay burns out the same boxes', () => {
    const setup: GameSetup = { scenarioId: 'flare-star', seed: 7, solarFlares: true }
    const first = buildGame(setup)
    playTurns(first, 8)
    const second = buildGame(setup)
    playTurns(second, 8)
    const boxes = (game: GameState) =>
      game.ships.map((ship) => [...ship.destroyedSystems].sort().join(',')).join('|')
    expect(boxes(second)).toBe(boxes(first))
  })
})

describe('a star with no rule behind it', () => {
  it('is inert when the flag is turned off mid-battle', () => {
    const game = battle()
    setOptionalRules(game, { solarFlares: false })
    const before = fireCons(game)
    playTurns(game, 10)
    expect(fireCons(game)).toBe(before)
  })
})
