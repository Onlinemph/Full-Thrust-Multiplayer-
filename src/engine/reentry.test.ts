import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules, type OptionalRules } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { orbitReentryDelay } from './terrain'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Coming back onto the table (3.9, 17.7).
 *
 * 3.9's re-entry turn has been recorded on every departing ship since the rule
 * was written and read by nothing: there was no way to put a ship back. 17.7's
 * orbital table was unimplementable for a different reason — it measures from
 * the table's corners and `GameState` had no table — and now it is not.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

/** A ship pointed at the right-hand edge, close enough to leave next move. */
function leaving(rules: OptionalRules, velocity = 12): GameState {
  const game = createGame({
    seed: 0x9e7,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 72, height: 48 },
    ships: [
      createShipState({
        id: 'ship',
        side: 'a',
        design: designById('esu-destroyer') as ShipDesign,
        placement: { position: { x: 66, y: 12 }, facing: 3 },
        velocity,
      }),
    ],
  })
  setOptionalRules(game, rules)
  advanceTo(game, 'move-ships')
  applyAction(game, { type: 'move-ship', shipId: 'ship' })
  return game
}

const shipOf = (game: GameState): ShipState => game.ships[0]

describe('the orbital table (17.7)', () => {
  it('records the lap and says when the ship is due back', () => {
    const game = leaving({ orbitalTable: true })
    const ship = shipOf(game)
    expect(ship.offTable).toBe(true)
    expect(ship.departure).not.toBeNull()
    expect(ship.departure?.course).toBe(3)
    expect(ship.departure?.velocity).toBe(12)
    // 17.7's table: 0-1 waits five turns, 2-4 waits four, 5+ waits three.
    expect(ship.reentryTurn).toBe(ship.departure!.turn + orbitReentryDelay(ship.design.drive.thrust))
    expect(game.log.some((e) => /goes round the planet/.test(e.text ?? ''))).toBe(true)
  })

  it('will not have it back early', () => {
    const game = leaving({ orbitalTable: true })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 0, y: 12 } })
        .refused,
    ).toMatch(/may not return until turn/)
  })

  it('puts it back on the opposite edge at the same course and speed', () => {
    const game = leaving({ orbitalTable: true })
    const due = shipOf(game).reentryTurn!
    while (game.turn < due) nextTurn(game)
    advanceTo(game, 'orders')
    // It left by the right edge near the top-right corner, so it comes back on
    // the left edge, the same distance from the bottom-left one.
    const outcome = applyAction(game, {
      type: 'return-to-table',
      shipId: 'ship',
      position: { x: 0, y: 36 },
    })
    expect(outcome.refused).toBeUndefined()
    const ship = shipOf(game)
    expect(ship.offTable).toBe(false)
    expect(ship.placement.facing).toBe(3)
    expect(ship.velocity).toBe(12)
    expect(ship.departure).toBeNull()
  })

  it('refuses the edge it left by', () => {
    const game = leaving({ orbitalTable: true })
    const due = shipOf(game).reentryTurn!
    while (game.turn < due) nextTurn(game)
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 72, y: 36 } })
        .refused,
    ).toMatch(/comes back on the left edge/)
  })

  it('holds it to 6 MU of the corner distance it left at', () => {
    const game = leaving({ orbitalTable: true })
    const due = shipOf(game).reentryTurn!
    while (game.turn < due) nextTurn(game)
    advanceTo(game, 'orders')
    // Right up in the far corner, nowhere near the recorded distance.
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 0, y: 0 } })
        .refused,
    ).toMatch(/17\.7 allows 6/)
  })
})

describe('3.9, where the table is open space', () => {
  it('brings a ship back by the edge it left, once its die says so', () => {
    const game = leaving({ tableReentry: true })
    const ship = shipOf(game)
    expect(ship.offTable).toBe(true)
    expect(ship.departure).toBeNull()
    if (ship.reentryTurn === null) {
      // A 1-3 means gone for good, which is also the rule.
      expect(game.log.some((e) => /does not return/.test(e.text ?? ''))).toBe(true)
      return
    }
    while (game.turn < ship.reentryTurn) nextTurn(game)
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 72, y: 20 } })
        .refused,
    ).toBeUndefined()
    expect(shipOf(game).offTable).toBe(false)
  })

  it('refuses the far edge, because 3.9 says the same side', () => {
    const game = leaving({ tableReentry: true })
    const ship = shipOf(game)
    if (ship.reentryTurn === null) return
    while (game.turn < ship.reentryTurn) nextTurn(game)
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 0, y: 20 } })
        .refused,
    ).toMatch(/re-enters by the right edge/)
  })

  it('leaves a ship that left under neither rule off the table for good', () => {
    const game = leaving({})
    expect(shipOf(game).reentryTurn).toBeNull()
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'return-to-table', shipId: 'ship', position: { x: 72, y: 20 } })
        .refused,
    ).toMatch(/not coming back/)
  })
})
