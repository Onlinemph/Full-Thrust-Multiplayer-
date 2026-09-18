import { describe, expect, it } from 'vitest'

import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import { aiActions } from './ai'
import { applyAction, endPhase, fireOpeningRefusal, setRulesReading } from './actions'
import { createGame, createShipState, type GameState, type ShipState } from './game'
import type { Phase, ShipDesign } from './types'

/**
 * The computer's turn to fire never holds the table (2.6, reading 18).
 *
 * Phase 11 is fired in turns, so a side whose turn it is and who does nothing
 * blocks everyone. Two things let that happen: the computer planned a volley
 * for a hull that could not open fire at all, and a ship that could not
 * shoot — 7.23's power-down, 7.24's spent turn — could not hold fire either.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) {
    if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
  }
}

function hull(id: string, side: string, designId: string, x: number, facing: 3 | 9): ShipState {
  return createShipState({
    id,
    side,
    design: designById(designId) as ShipDesign,
    placement: { position: { x, y: 24 }, facing },
  })
}

/** A computer cruiser 6 MU from a player's, guns bearing, with its bridge gone. */
function gunline(reading = CURRENT_RULES_VERSION): GameState {
  const game = createGame({
    seed: 0x18,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [hull('mine', 'a', 'esu-heavy-cruiser', 20, 3), hull('theirs', 'b', 'nac-heavy-cruiser', 26, 9)],
  })
  setRulesReading(game, reading)
  const theirs = game.ships.find((ship) => ship.id === 'theirs')!
  // 10.3: "may not fire weapons, launch fighters, or take any other offensive action."
  theirs.ongoing.push({
    id: 'bridge-1',
    source: 'bridge',
    appliedTurn: 1,
    expiresAfterTurn: null,
    note: 'bridge hit',
  })
  return game
}

describe('the computer holds fire with a hull that cannot open it (2.6, 10.3)', () => {
  it('names the reason', () => {
    const game = gunline()
    expect(fireOpeningRefusal(game, game.ships[1])).toMatch(/out of control/)
    expect(fireOpeningRefusal(game, game.ships[0])).toBeNull()
  })

  it('passes rather than planning a volley that would be refused', () => {
    const game = gunline()
    advanceTo(game, 'ship-fire')
    game.fire = { side: 'b', sequence: 0 }
    const actions = aiActions(game, 'b')
    expect(actions).toEqual([{ type: 'pass-fire', shipId: 'theirs' }])
    expect(applyAction(game, actions[0]!).refused).toBeUndefined()
    // The turn has come back to the player.
    expect(game.fire.side).toBe('a')
    expect(applyAction(game, { type: 'pass-fire', shipId: 'mine' }).refused).toBeUndefined()
  })
})

describe('holding fire needs no power (7.23, reading 18)', () => {
  function armed(reading: number): GameState {
    const game = createGame({
      seed: 0x7023,
      sides: [{ id: 'a' }, { id: 'b' }],
      table: { width: 200, height: 120 },
      ships: [hull('nova', 'a', 'goliath-dreadnought', 20, 3), hull('mark', 'b', 'goliath-battleship', 60, 9)],
    })
    setRulesReading(game, reading)
    const cannon = game.ships[0].design.weapons.find((w) => w.weaponClass === 'nova-cannon')!
    expect(
      applyAction(game, { type: 'arm-nova-cannon', shipId: 'nova', weaponId: cannon.id, on: true }).refused,
    ).toBeUndefined()
    advanceTo(game, 'ship-fire')
    game.fire = { side: 'a', sequence: 0 }
    return game
  }

  it('lets a ship that armed its cannon hold fire instead', () => {
    const game = armed(CURRENT_RULES_VERSION)
    expect(applyAction(game, { type: 'pass-fire', shipId: 'nova' }).refused).toBeUndefined()
    expect(game.ships[0].hasFiredThisTurn).toBe(true)
  })

  it('refused it under reading 17, which is how the phase came to wait', () => {
    const game = armed(17)
    expect(applyAction(game, { type: 'pass-fire', shipId: 'nova' }).refused).toMatch(/7\.23/)
  })

  it('still refuses a pass out of turn', () => {
    const game = armed(CURRENT_RULES_VERSION)
    game.fire = { side: 'b', sequence: 0 }
    expect(applyAction(game, { type: 'pass-fire', shipId: 'nova' }).refused).toMatch(/turn to fire/)
  })
})

describe('reading', () => {
  it('is 18', () => {
    expect(CURRENT_RULES_VERSION).toBe(18)
  })
})
