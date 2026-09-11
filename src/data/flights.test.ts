import { describe, expect, it } from 'vitest'

import { buildGame } from './savedGame'

/**
 * Carriers start with their wings aboard (8.1).
 *
 * Worth a test of its own because a carrier whose hangar bays produce no
 * flights is a 400-point hull with nothing in it, and nothing else in the game
 * would complain: the ship sails, shoots its handful of guns, and quietly never
 * does the job it was bought for.
 */
describe('carriers', () => {
  it('put a flight in each hangar bay, aboard and at full strength', () => {
    const game = buildGame({ scenarioId: 'line-of-battle', seed: 1 })
    const carriers = game.ships.filter((ship) => ship.design.fighterBays.length > 0)
    expect(carriers.length).toBeGreaterThan(0)

    for (const carrier of carriers) {
      const flights = game.fighterGroups.filter((group) => group.carrierId === carrier.id)
      expect(flights, carrier.name).toHaveLength(carrier.design.fighterBays.length)
      for (const flight of flights) {
        expect(flight.status, flight.id).toBe('aboard')
        expect(flight.strength, flight.id).toBe(6)
        expect(flight.side, flight.id).toBe(carrier.side)
      }
    }
  })

  it('gives a ship with no bays no flights', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 1 })
    expect(game.fighterGroups).toHaveLength(0)
  })
})
