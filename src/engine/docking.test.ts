import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import type { Phase, ShipDesign } from './types'

/**
 * 16.6 at the table.
 *
 * Docking is the one special move a player can attempt against the engine as
 * it stands — no new phase, no new infrastructure, nothing to add to a design.
 * It had a complete state machine in `specialmoves.ts` and no caller.
 */

function design(over: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'h',
    name: 'Hull',
    faction: 'Test',
    group: 'cruiser',
    mass: 100,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 40,
    drive: { thrust: 6, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 0,
    marineParties: 0,
    points: 200,
    ...over,
  }
}

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 40
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

/** A shuttle 2 MU off a station's beam, and the station itself. */
function alongside(stationVelocity = 0, shuttleVelocity = 0): GameState {
  return createGame({
    seed: 0x1606,
    sides: [{ id: 'a' }],
    ships: [
      createShipState({
        id: 'shuttle',
        side: 'a',
        design: design({ id: 'shuttle', name: 'Shuttle' }),
        placement: { position: { x: 36, y: 22 }, facing: 6 },
        velocity: shuttleVelocity,
      }),
      createShipState({
        id: 'station',
        side: 'a',
        design: design({ id: 'station', name: 'Station' }),
        placement: { position: { x: 36, y: 24 }, facing: 6 },
        velocity: stationVelocity,
      }),
    ],
  })
}

describe('docking with something stationary (16.6)', () => {
  it('wants a dead stop, not a course match', () => {
    const moving = alongside(0, 4)
    applyAction(moving, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(moving, 'move-ships')
    applyAction(moving, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(moving, { type: 'advance-phase' })
    expect(moving.ships[0].dock.phase, 'still under way').toBe('free')
    expect(moving.log.some((e) => e.text.includes('dead stop'))).toBe(true)

    const halted = alongside(0, 0)
    applyAction(halted, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(halted, 'move-ships')
    applyAction(halted, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(halted, { type: 'advance-phase' })
    expect(halted.ships[0].dock.phase).toBe('approach-held')
    expect(halted.ships[0].dock.targetId).toBe('station')
  })

  it('docks on the following turn without flying the approach again', () => {
    const game = alongside()
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'advance-phase' })
    expect(game.ships[0].dock.phase).toBe('approach-held')

    nextTurn(game)
    expect(game.ships[0].dock.phase, '"on the following turn, the ship may be considered docked"').toBe(
      'docked',
    )
  })

  it('will not take orders while it is attached', () => {
    const game = alongside()
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'advance-phase' })
    nextTurn(game)
    expect(applyAction(game, { type: 'plot-accel', shipId: 'shuttle', accel: 2 }).refused).toContain(
      '16.6',
    )
  })

  it('takes one full turn to let go, and manoeuvres after it', () => {
    const game = alongside()
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'advance-phase' })
    nextTurn(game)

    expect(applyAction(game, { type: 'plot-cast-off', shipId: 'shuttle' }).refused).toBeUndefined()
    expect(game.ships[0].dock.phase).toBe('casting-off')
    expect(
      applyAction(game, { type: 'plot-accel', shipId: 'shuttle', accel: 2 }).refused,
      'the cast-off turn is spent casting off',
    ).toContain('16.6')

    nextTurn(game)
    expect(game.ships[0].dock.phase).toBe('free')
    expect(applyAction(game, { type: 'plot-accel', shipId: 'shuttle', accel: 2 }).refused).toBeUndefined()
  })
})

describe('docking with something under way (16.6)', () => {
  it('wants an exact match of course and velocity', () => {
    const wrongSpeed = alongside(6, 4)
    applyAction(wrongSpeed, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(wrongSpeed, 'move-ships')
    applyAction(wrongSpeed, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(wrongSpeed, { type: 'move-ship', shipId: 'station' })
    applyAction(wrongSpeed, { type: 'advance-phase' })
    expect(wrongSpeed.ships[0].dock.phase).toBe('free')

    // Both on course 12 at 6: the shuttle keeps station as they both move.
    const matched = alongside(6, 6)
    applyAction(matched, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(matched, 'move-ships')
    applyAction(matched, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(matched, { type: 'move-ship', shipId: 'station' })
    applyAction(matched, { type: 'advance-phase' })
    expect(matched.ships[0].dock.phase).toBe('approach-held')
  })

  it('carries the docked ship along when the host moves', () => {
    const game = alongside(6, 6)
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'move-ship', shipId: 'station' })
    applyAction(game, { type: 'advance-phase' })
    nextTurn(game)
    expect(game.ships[0].dock.phase).toBe('docked')

    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'station' })
    expect(
      game.ships[0].placement.position,
      'a docked ship goes where its host goes, or it is left behind in space',
    ).toEqual(game.ships[1].placement.position)
  })
})

describe('the approach', () => {
  it('is refused for a ship that is already docking', () => {
    const game = alongside()
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'advance-phase' })
    nextTurn(game)
    expect(
      applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' }).refused,
    ).toContain('already docking')
  })

  it('is not a standing intention: a miss is written afresh', () => {
    const game = alongside(0, 4)
    applyAction(game, { type: 'plot-dock', shipId: 'shuttle', targetId: 'station' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'shuttle' })
    applyAction(game, { type: 'advance-phase' })
    nextTurn(game)
    expect(game.ships[0].dockTargetId).toBeNull()
  })
})
