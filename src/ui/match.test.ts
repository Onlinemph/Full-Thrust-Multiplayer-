import { beforeEach, describe, expect, it } from 'vitest'

import { optional } from '../engine/actions'
import {
  currentGame,
  currentJournal,
  currentMatchSide,
  currentSetup,
  dispatch,
  enterMatch,
  isInMatch,
  leaveMatch,
  newGame,
  setMatchSide,
} from './store'

/**
 * A match is its own table.
 *
 * The battle that was on the home table goes to its own slot and comes back
 * when the match ends; the match itself starts at turn 1 from the setup as the
 * table has it, with the ready gate on and each console commanding a side.
 */
describe('sitting down at a match', () => {
  beforeEach(() => {
    leaveMatch()
    setMatchSide(null)
    newGame({ scenarioId: 'border-skirmish', seed: 21 })
  })

  it('starts the host at turn 1, phase 1, under the ready gate, and puts the home battle away', () => {
    // A battle well under way on the home table.
    for (const ship of currentGame().ships) dispatch({ type: 'plot-accel', shipId: ship.id, accel: 0 })
    dispatch({ type: 'advance-phase' })
    const homeLength = currentJournal().length
    expect(homeLength).toBeGreaterThan(0)

    enterMatch('host', true)
    expect(isInMatch()).toBe(true)
    expect(currentGame().turn).toBe(1)
    expect(currentGame().phase).toBe('orders')
    expect(currentJournal()).toHaveLength(0)
    expect(optional(currentGame()).readyGate).toBe(true)
    expect(currentSetup().scenarioId).toBe('border-skirmish')
    expect(currentMatchSide()).toBe('a')

    leaveMatch()
    expect(isInMatch()).toBe(false)
    expect(currentMatchSide()).toBeNull()
    expect(currentJournal()).toHaveLength(homeLength)
  })

  it('gives the guest the second side and keeps their table until the host\'s arrives', () => {
    const seed = currentGame().seed
    enterMatch('guest', false)
    expect(currentMatchSide()).toBe('b')
    expect(currentGame().seed).toBe(seed)
    leaveMatch()
  })
})
