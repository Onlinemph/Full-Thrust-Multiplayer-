import { describe, expect, it } from 'vitest'

import { commandedSides, commands, currentGame, dispatch, newGame, setMatchSide } from './store'

/**
 * Against the computer, the computer's fleet is not the player's to touch.
 *
 * The online guard has always refused orders for the other console's fleet;
 * this is the same refusal for the fleet the computer flies at one screen,
 * and the same lock on whose eyes the table is seen through.
 */
describe('one player against the computer', () => {
  it('commands every side the computer does not, and no other', () => {
    setMatchSide(null)
    newGame({ scenarioId: 'border-skirmish', seed: 7, aiSides: ['b'] })
    expect(commandedSides()).toEqual(['a'])
    expect(commands('a')).toBe(true)
    expect(commands('b')).toBe(false)
  })

  it('refuses an order for a ship the computer flies', () => {
    setMatchSide(null)
    newGame({ scenarioId: 'border-skirmish', seed: 7, aiSides: ['b'] })
    const game = currentGame()
    const theirs = game.ships.find((ship) => ship.side === 'b')!
    const mine = game.ships.find((ship) => ship.side === 'a')!
    expect(dispatch({ type: 'plot-accel', shipId: theirs.id, accel: 1 }).refused).toMatch(/computer/)
    expect(dispatch({ type: 'plot-accel', shipId: mine.id, accel: 1 }).refused).toBeUndefined()
    // The computer wrote its own orders the moment the phase opened.
    expect(theirs.order).not.toBeNull()
  })

  it('leaves two people at one screen with the whole table', () => {
    setMatchSide(null)
    newGame({ scenarioId: 'border-skirmish', seed: 7 })
    expect(commandedSides()).toBeNull()
    expect(commands('b')).toBe(true)
  })

  it('narrows an online console to the side it joined as', () => {
    newGame({ scenarioId: 'border-skirmish', seed: 7 })
    setMatchSide('b')
    expect(commandedSides()).toEqual(['b'])
    expect(commands('a')).toBe(false)
    setMatchSide(null)
  })
})
