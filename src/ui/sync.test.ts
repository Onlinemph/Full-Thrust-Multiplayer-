import { beforeEach, describe, expect, it } from 'vitest'

import type { GameAction } from '../engine/actions'
import { replayGame, type SavedGame } from '../data/savedGame'
import {
  applyRemoteAction,
  applyRemoteSave,
  applyRemoteUndo,
  currentGame,
  currentJournal,
  currentSave,
  dispatch,
  newGame,
  setMatchSide,
  undo,
} from './store'

/**
 * Two browsers staying in step.
 *
 * The interesting case is not the happy path — it is two actions crossing on
 * the wire, which turn-based play makes rare and never impossible. Every action
 * carries the sender's journal length after applying it; a receiver whose own
 * journal disagrees has detected the crossing. The host is the ordering
 * authority and the guest asks for a corrective sync, so both ends converge on
 * the host's record rather than quietly diverging into two different battles.
 *
 * These run against the real store rather than a mock, because what is being
 * tested is precisely the store's bookkeeping.
 */

const SETUP = { scenarioId: 'border-skirmish', seed: 4242 }

/**
 * Enough of the battle to tell two states apart — including the written but
 * unexecuted order, since plotting changes nothing a ship's position shows
 * until phase 5 moves it.
 */
function fingerprint(): string {
  const game = currentGame()
  return JSON.stringify(
    game.ships.map((s) => [
      s.id,
      s.placement.position.x.toFixed(3),
      s.velocity,
      s.hullMarked,
      s.order,
    ]),
  )
}

beforeEach(() => {
  setMatchSide(null)
  newGame({ ...SETUP })
})

describe('an action from the peer', () => {
  it('is applied when the sequence matches', () => {
    const before = currentJournal().length
    const action: GameAction = { type: 'roll-initiative' }
    // The peer applied it as their action number `before + 1`.
    expect(applyRemoteAction(action, before + 1, false)).toBe('applied')
    expect(currentJournal()).toHaveLength(before + 1)
  })

  it('is reported as a mismatch when the two journals have crossed', () => {
    // We took an action the peer had not seen when they sent theirs.
    dispatch({ type: 'plot-accel', shipId: currentGame().ships[0].id, accel: 1 })
    const stale = currentJournal().length // they think they are one behind us
    expect(applyRemoteAction({ type: 'roll-initiative' }, stale, false)).toBe('mismatch')
  })

  it('is applied anyway by the host, which is the ordering authority', () => {
    dispatch({ type: 'plot-accel', shipId: currentGame().ships[0].id, accel: 1 })
    const before = currentJournal().length
    // Same crossing, but this console is the host: append in arrival order.
    expect(applyRemoteAction({ type: 'roll-initiative' }, before, true)).toBe('mismatch')
    expect(currentJournal()).toHaveLength(before + 1)
  })
})

describe('a sync from the host', () => {
  it('replaces the battle wholesale and lands on the same state', () => {
    // Build a battle on "their" side by playing one here and capturing it.
    const ship = currentGame().ships[0].id
    dispatch({ type: 'plot-accel', shipId: ship, accel: 2 })
    dispatch({ type: 'advance-phase' })
    dispatch({ type: 'roll-initiative' })
    const theirs: SavedGame = structuredClone(currentSave())
    const expected = JSON.stringify(
      replayGame(theirs).ships.map((s) => [s.id, s.velocity, s.hullMarked]),
    )

    // Now diverge locally, then take their record.
    newGame({ ...SETUP, seed: 99 })
    dispatch({ type: 'advance-phase' })
    applyRemoteSave(theirs)

    expect(
      JSON.stringify(currentGame().ships.map((s) => [s.id, s.velocity, s.hullMarked])),
    ).toBe(expected)
    expect(currentJournal()).toHaveLength(theirs.actions.length)
  })
})

describe('an undo from the peer', () => {
  it('rewinds by replay, to the same state either end would reach', () => {
    const ship = currentGame().ships[0].id
    dispatch({ type: 'plot-accel', shipId: ship, accel: 2 })
    const mark = fingerprint()
    dispatch({ type: 'plot-accel', shipId: ship, accel: 3 })
    expect(fingerprint()).not.toBe(mark)

    expect(applyRemoteUndo(currentJournal().length - 1, false)).toBe('applied')
    expect(fingerprint()).toBe(mark)
  })

  it('is a mismatch when the journals have crossed', () => {
    dispatch({ type: 'plot-accel', shipId: currentGame().ships[0].id, accel: 1 })
    // They think undoing leaves 5 actions; we have a different number.
    expect(applyRemoteUndo(999, false)).toBe('mismatch')
  })
})

describe('a console that has claimed a side', () => {
  it('may not give orders to the other fleet', () => {
    const game = currentGame()
    const theirs = game.ships.find((s) => s.side === 'b')
    if (!theirs) throw new Error('scenario has no b side')
    setMatchSide('a')
    const outcome = dispatch({ type: 'plot-accel', shipId: theirs.id, accel: 1 })
    expect(outcome.refused).toBeTruthy()
    // And nothing reached the journal, so the two ends cannot disagree over it.
    expect(currentJournal().some((a) => 'shipId' in a && a.shipId === theirs.id)).toBe(false)
  })

  it('may still give orders to its own', () => {
    const mine = currentGame().ships.find((s) => s.side === 'a')
    if (!mine) throw new Error('scenario has no a side')
    setMatchSide('a')
    expect(dispatch({ type: 'plot-accel', shipId: mine.id, accel: 1 }).refused).toBeUndefined()
  })

  it('may still advance the shared sequence, which belongs to neither side', () => {
    // Once the phase's work is done: 2.6 will not leave phase 1 with orders
    // unwritten, and this console can only write its own — so the table
    // writes everyone's first, then the side claims its fleet and steps on.
    setMatchSide(null)
    for (const ship of currentGame().ships) {
      dispatch({ type: 'plot-accel', shipId: ship.id, accel: 0 })
    }
    setMatchSide('a')
    expect(dispatch({ type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('cannot take back an action the other console has already seen resolve', () => {
    setMatchSide('a')
    dispatch({ type: 'advance-phase' })
    dispatch({ type: 'roll-initiative' })
    // A shared die roll is not undoable in a match: they watched it land.
    expect(undo()).toBe(false)
  })
})
