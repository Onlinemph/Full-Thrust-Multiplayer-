import { describe, expect, it } from 'vitest'
import { HEAVY_CRUISER } from '../data/ships'
import { applyAction, phaseDebt, setRulesReading, shipsAwaitingOrders } from './actions'
import { advanceToPhase, createGame, createShipState, markHullBoxes, type GameState } from './game'
import { CURRENT_RULES_VERSION } from '../data/savedGame'

/**
 * 2.6 is a sequence, not a suggestion. Before this, "End phase" advanced
 * whatever the phase's work stood at — a console could skip movement, skip
 * threshold checks, skip the point-defence sweep with missiles in flight —
 * and in an online match one player could walk the shared sequence past the
 * other's unmoved ships. The gate lives in `advance-phase` so both consoles
 * refuse identically; these tests are what say so.
 */

function battle(reading = CURRENT_RULES_VERSION): GameState {
  const ships = [
    createShipState({
      id: 'red-1',
      side: 'red',
      design: HEAVY_CRUISER,
      placement: { position: { x: 20, y: 10 }, facing: 6 },
      velocity: 4,
    }),
    createShipState({
      id: 'blue-1',
      side: 'blue',
      design: HEAVY_CRUISER,
      placement: { position: { x: 20, y: 40 }, facing: 12 },
      velocity: 4,
    }),
  ]
  const game = createGame({ seed: 11, sides: [{ id: 'red' }, { id: 'blue' }], ships })
  setRulesReading(game, reading)
  return game
}

describe('the sequence refuses to move on past work not done (2.6)', () => {
  it('will not leave phase 1 while a ship has no orders written (3.5)', () => {
    const game = battle()
    expect(shipsAwaitingOrders(game).map((s) => s.id)).toEqual(['red-1', 'blue-1'])
    const refused = applyAction(game, { type: 'advance-phase' })
    expect(refused.refused).toMatch(/still to write orders \(3\.5\)/)
    expect(game.phase).toBe('orders')

    // Holding course is an order too: a plotted acceleration of nothing.
    applyAction(game, { type: 'plot-accel', shipId: 'red-1', accel: 0 })
    expect(applyAction(game, { type: 'advance-phase' }).refused).toMatch(/1 ship still/)
    applyAction(game, { type: 'plot-accel', shipId: 'blue-1', accel: 0 })
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
    expect(game.phase).toBe('initiative')
  })

  it('will not leave phase 5 until every ship has flown its move (3.1)', () => {
    const game = battle()
    advanceToPhase(game, 'move-ships')
    expect(phaseDebt(game).required[0]).toMatch(/2 ships not yet moved \(3\.1\)/)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeDefined()
    applyAction(game, { type: 'move-ship', shipId: 'red-1' })
    applyAction(game, { type: 'move-ship', shipId: 'blue-1' })
    expect(phaseDebt(game).required).toEqual([])
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('will not leave phase 13 with a threshold check owing (4.11)', () => {
    const game = battle()
    advanceToPhase(game, 'threshold')
    const target = game.ships[0]
    markHullBoxes(target, 8)
    expect(phaseDebt(game).required[0]).toMatch(/owe a threshold check \(4\.11\)/)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeDefined()
    applyAction(game, { type: 'threshold-sweep' })
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('will not leave phase 15 with a breached core unrolled (10.3)', () => {
    const game = battle()
    advanceToPhase(game, 'reactor-explosions')
    game.ships[1].core.reactorExplosionPending = true
    expect(phaseDebt(game).required[0]).toMatch(/breached core/)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeDefined()
    applyAction(game, { type: 'resolve-reactor-explosions' })
    expect(game.resolved['reactor-explosions']).toBe(game.turn)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('lets phase 11 end with guns unfired, but says so', () => {
    const game = battle()
    advanceToPhase(game, 'ship-fire')
    const debt = phaseDebt(game)
    expect(debt.required).toEqual([])
    expect(debt.optional[0]).toMatch(/2 ships have not fired \(4\.1\)/)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('leaves an older journal free to skip, exactly as it was played', () => {
    const game = battle(14)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
    expect(game.phase).toBe('initiative')
  })
})
