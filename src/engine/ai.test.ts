import { describe, expect, it } from 'vitest'

import { aiActions } from './ai'
import { applyAction, type GameAction } from './actions'
import type { GameState } from './game'
import { PHASE_ORDER } from './types'
import { buildGame } from '../data/savedGame'

/**
 * The computer's small craft.
 *
 * A carrier the computer never launches is 411 points of hangar space doing
 * nothing, and nothing else in the repository notices: the engine is happy,
 * the tests pass, and the player just quietly never sees an enemy fighter.
 * So this plays a scenario with both fleets under computer control and
 * insists that the wings and the squadrons actually fight.
 */

function playAllAi(turns: number): { game: GameState; actions: GameAction[] } {
  const game = buildGame({
    scenarioId: 'line-of-battle',
    seed: 0x5eed,
    aiSides: ['a', 'b'],
  })
  const actions: GameAction[] = []
  let guard = turns * PHASE_ORDER.length * 4
  while (game.turn <= turns && guard-- > 0) {
    for (const side of game.sides) {
      for (const action of aiActions(game, side.id)) {
        applyAction(game, action)
        actions.push(action)
      }
    }
    applyAction(game, { type: 'advance-phase' })
    actions.push({ type: 'advance-phase' })
  }
  expect(guard, 'the sequence of play stopped advancing').toBeGreaterThan(0)
  return { game, actions }
}

describe('the computer', () => {
  const played = playAllAi(12)
  const took = (type: string) => played.actions.filter((a) => a.type === type).length

  it('launches its wings and its gunboat squadrons', () => {
    expect(took('launch-flight'), 'fighter launches').toBeGreaterThan(0)
    expect(took('launch-gunboats'), 'gunboat launches').toBeGreaterThan(0)
    expect(
      played.game.fighterGroups.some((group) => group.launchedTurn !== null),
      'at least one wing left its carrier',
    ).toBe(true)
  })

  it('flies them at the enemy rather than parking them', () => {
    expect(took('move-flight'), 'fighter moves').toBeGreaterThan(0)
    expect(took('move-gunboats'), 'gunboat moves').toBeGreaterThan(0)
    // Something must have closed with something: a wing that spent twelve
    // turns drifting is a wing the computer forgot about.
    const engaged = played.actions.some(
      (a) => a.type === 'flight-strike' || a.type === 'gunboat-attack' || a.type === 'flight-dogfight',
    )
    expect(engaged, 'no small craft ever attacked anything in twelve turns').toBe(true)
  })

  it('stops short of its target rather than flying onto it', () => {
    // 8.7 gives a fighter 6 MU of reach and 9.1 gives a gunboat 12: a group
    // that closes to zero has thrown away the standoff its guns bought it.
    const flying = played.game.fighterGroups.filter((g) => g.status === 'in-flight')
    for (const group of flying) {
      const nearest = played.game.ships
        .filter((s) => s.side !== group.side && !s.destroyed && !s.offTable)
        .map((s) => Math.hypot(
          s.placement.position.x - group.position.x,
          s.placement.position.y - group.position.y,
        ))
        .sort((a, b) => a - b)[0]
      if (nearest === undefined) continue
      // Not on top of a hull. Ships move after fighters do, so this is a
      // tendency rather than a guarantee — but 0 MU means the standoff logic
      // is not running at all.
      expect(nearest, group.id).toBeGreaterThan(0)
    }
  })

  it('still plays a whole battle without throwing', () => {
    expect(played.game.turn).toBeGreaterThan(12)
    expect(played.game.log.length).toBeGreaterThan(0)
  })
})
