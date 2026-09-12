import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * 6.9 and 6.10, from the rack to the bang.
 *
 * `ordnance.ts` has laid mines, worked out which ones a move set off and
 * resolved their four dice since it was written, and nothing called any of it:
 * `plot-mines` set a flag that changed only *when* the ship moved (16.1), and
 * no marker was ever put on the table. The Durani minelayer in the roster
 * carries three racks.
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

/** A minelayer running west to east, and a victim following the same lane. */
function battle(): GameState {
  return createGame({
    seed: 0x1de,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 72 },
    ships: [
      createShipState({
        id: 'layer',
        side: 'a',
        design: designById('durani-minelayer') as ShipDesign,
        placement: { position: { x: 20, y: 36 }, facing: 3 },
        velocity: 6,
      }),
      createShipState({
        id: 'chaser',
        side: 'b',
        design: designById('nac-heavy-cruiser') as ShipDesign,
        placement: { position: { x: 4, y: 36 }, facing: 3 },
        velocity: 8,
      }),
    ],
  })
}

const shipOf = (game: GameState, id: string): ShipState =>
  game.ships.find((ship) => ship.id === id)!

/** Move everyone this turn, in the sequence's own order. */
function moveTurn(game: GameState): void {
  advanceTo(game, 'move-ships')
  applyAction(game, { type: 'move-ship', shipId: 'layer' })
  applyAction(game, { type: 'move-ship', shipId: 'chaser' })
  applyAction(game, { type: 'advance-phase' })
}

describe('laying mines (6.10)', () => {
  it('drops one marker per rack, but only when the order says so', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    moveTurn(game)
    // Three racks on the Tumen, so three markers down the flown path.
    expect(game.ordnance.filter((marker) => marker.kind === 'mine').length).toBe(3)
    expect(game.log.some((e) => /lays 3 mine\(s\) astern/.test(e.text ?? ''))).toBe(true)
  })

  it('drops nothing without the order', () => {
    const game = battle()
    moveTurn(game)
    expect(game.ordnance.filter((marker) => marker.kind === 'mine').length).toBe(0)
  })
})

describe('setting them off (6.9)', () => {
  it('leaves a mine inert on the turn it was laid', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    moveTurn(game)
    // The chaser is right behind and crosses the fresh markers, and 6.10 says
    // "a mine marker does not become active until the game turn after".
    expect(shipOf(game, 'chaser').hullMarked).toBe(0)
    expect(game.ordnance.filter((marker) => marker.kind === 'mine').length).toBe(3)
  })

  it('fires on an enemy that crosses the field next turn', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    moveTurn(game)
    nextTurn(game)
    moveTurn(game)
    const chaser = shipOf(game, 'chaser')
    const soaked = chaser.hullMarked + chaser.armourMarked.reduce((sum, n) => sum + n, 0)
    expect(soaked, 'the chaser flew straight through and nothing went off').toBeGreaterThan(0)
    expect(game.log.some((e) => /A mine goes off/.test(e.text ?? ''))).toBe(true)
  })

  it('takes a detonated mine off the table and leaves the rest', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    moveTurn(game)
    const laid = game.ordnance.filter((marker) => marker.kind === 'mine').length
    nextTurn(game)
    moveTurn(game)
    const left = game.ordnance.filter((marker) => marker.kind === 'mine').length
    expect(left).toBeLessThan(laid)
  })

  it('does not fire on the side that laid it', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    moveTurn(game)
    nextTurn(game)
    // The layer turns round and flies back over its own field.
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-turn', shipId: 'layer', direction: 'port', points: 3 })
    moveTurn(game)
    expect(shipOf(game, 'layer').hullMarked).toBe(0)
  })
})
