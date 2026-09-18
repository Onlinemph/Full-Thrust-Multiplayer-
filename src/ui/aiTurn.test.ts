import { describe, expect, it } from 'vitest'

import { currentGame, dispatch, newGame, setMatchSide } from './store'
import type { GameState } from '../engine/game'

/**
 * Against the computer, phase 11 never waits on it.
 *
 * From reading 16 the phase is fired in turns, so whenever the turn is the
 * computer's the player's console is refused. The computer acts once per
 * step of the sequence; when the volley it planned was refused for a reason
 * its planner could not see, nothing moved the sequence on, it was never
 * asked again, and the player sat looking at "it is their turn to fire" for
 * the rest of the evening. Now a refused volley becomes a held fire, and the
 * turn comes back.
 */

/** Two stealth hulls and a passive FireCon: 24 MU of sensors under a 36 MU gun (7.4). */
function blindTheComputer(game: GameState): void {
  for (const ship of game.ships) {
    if (ship.side !== 'b') continue
    ship.design = {
      ...ship.design,
      systems: [
        ...ship.design.systems,
        { id: 'sh-1', kind: 'stealth-hull', label: 'Stealth hull', mass: 0, points: 0 },
        { id: 'sh-2', kind: 'stealth-hull', label: 'Stealth hull', mass: 0, points: 0 },
      ],
    }
    ship.activeScan = false
  }
}

function toShipFire(): GameState {
  setMatchSide(null)
  newGame({ scenarioId: 'border-skirmish', seed: 11, aiSides: ['b'] })
  const game = currentGame()
  blindTheComputer(game)
  for (const ship of game.ships) {
    if (ship.side === 'a') dispatch({ type: 'plot-accel', shipId: ship.id, accel: 0 })
  }
  let guard = 30
  while (game.phase !== 'ship-fire' && guard-- > 0) {
    if (game.phase === 'initiative') dispatch({ type: 'roll-initiative' })
    if (game.phase === 'move-ships') {
      for (const ship of game.ships) if (ship.side === 'a') dispatch({ type: 'move-ship', shipId: ship.id })
    }
    expect(dispatch({ type: 'advance-phase' }).refused).toBeUndefined()
  }
  expect(game.phase).toBe('ship-fire')
  return game
}

describe('phase 11 against the computer', () => {
  it('never leaves the player waiting on a computer that could not fire', () => {
    const game = toShipFire()
    // The skirmish opens 28 MU apart: inside the computer's Beam-3s, outside
    // its passive 24 MU, so every volley it plans is refused (7.4).
    const mine = game.ships.filter((ship) => ship.side === 'a')
    for (const ship of mine) {
      const outcome = dispatch({ type: 'pass-fire', shipId: ship.id })
      expect(outcome.refused ?? '').not.toMatch(/turn to fire/)
    }
    // Every one of the computer's hulls has had its say — by holding fire.
    for (const ship of game.ships) {
      if (ship.side === 'b' && !ship.destroyed) expect(ship.hasFiredThisTurn).toBe(true)
    }
    expect(game.log.some((entry) => /holds its fire/.test(entry.text))).toBe(true)
  })
})
