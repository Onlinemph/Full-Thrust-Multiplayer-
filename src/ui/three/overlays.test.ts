import { describe, expect, it } from 'vitest'
import { buildGame } from '../../data/savedGame'
import { SHIP_DESIGNS } from '../../data/ships'
import { createShipState, type GameState } from '../../engine/game'
import type { ShipDesign } from '../../engine/types'
import { edgeBand, roseFor } from './overlays'

function battle(): GameState {
  return buildGame({ scenarioId: 'border-skirmish', seed: 5 })
}

const design = SHIP_DESIGNS[0] as ShipDesign

describe('edgeBand', () => {
  const table = { width: 60, height: 48 }

  it('centres a 1 MU strip on the top edge, spanning the table', () => {
    expect(edgeBand(table, 'top')).toEqual({ x: 0, y: -0.5, width: 60, height: 1 })
  })

  it('centres a 1 MU strip on the bottom edge', () => {
    expect(edgeBand(table, 'bottom')).toEqual({ x: 0, y: 47.5, width: 60, height: 1 })
  })

  it('centres a 1 MU strip on the left edge, running the table height', () => {
    expect(edgeBand(table, 'left')).toEqual({ x: -0.5, y: 0, width: 1, height: 48 })
  })

  it('centres a 1 MU strip on the right edge', () => {
    expect(edgeBand(table, 'right')).toEqual({ x: 59.5, y: 0, width: 1, height: 48 })
  })

  it('honours a wider band', () => {
    expect(edgeBand(table, 'top', 4)).toEqual({ x: 0, y: -2, width: 60, height: 4 })
  })
})

describe('roseFor', () => {
  it('is false outside phase 11 (ship-fire)', () => {
    const game = battle()
    const ship = createShipState({ id: 's1', side: 'a', design, placement: { position: { x: 0, y: 0 }, facing: 12 } })
    game.ships.push(ship)
    game.phase = 'orders'
    expect(roseFor(game, ship, null)).toBe(false)
  })

  it('is true for one of ours, on the table, in phase 11', () => {
    const game = battle()
    const ship = createShipState({ id: 's1', side: 'a', design, placement: { position: { x: 0, y: 0 }, facing: 12 } })
    game.ships.push(ship)
    game.phase = 'ship-fire'
    expect(roseFor(game, ship, null)).toBe(true)
    expect(roseFor(game, ship, 'a')).toBe(true)
  })

  it('is false for the other side, once a viewing side is set (fog)', () => {
    const game = battle()
    const ship = createShipState({ id: 's1', side: 'a', design, placement: { position: { x: 0, y: 0 }, facing: 12 } })
    game.ships.push(ship)
    game.phase = 'ship-fire'
    expect(roseFor(game, ship, 'b')).toBe(false)
  })

  it('is false once the ship is destroyed, off the table, or captured', () => {
    const game = battle()
    const ship = createShipState({ id: 's1', side: 'a', design, placement: { position: { x: 0, y: 0 }, facing: 12 } })
    game.ships.push(ship)
    game.phase = 'ship-fire'
    ship.destroyed = true
    expect(roseFor(game, ship, null)).toBe(false)
    ship.destroyed = false
    ship.offTable = true
    expect(roseFor(game, ship, null)).toBe(false)
    ship.offTable = false
    ship.captured = true
    expect(roseFor(game, ship, null)).toBe(false)
  })

  it('is false with no ship selected', () => {
    const game = battle()
    game.phase = 'ship-fire'
    expect(roseFor(game, undefined, null)).toBe(false)
  })
})
