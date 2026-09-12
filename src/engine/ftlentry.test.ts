import { describe, expect, it } from 'vitest'

import {
  applyAction,
  setHyperLimit,
  shipsAwaitingFtlEntry,
  type GameAction,
} from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { damageLevelOf } from './victory'
import { startScenario } from '../data/scenarios'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Arriving out of hyperspace (11.2, 11.5).
 *
 * `resolveFtlEntry` and `ftlPermittedAt` were written, tested and documented
 * long before anything could reach them: a ship could jump out of a battle but
 * never into one, and a scenario's hyper limit was a value nothing read. Both
 * are reachable from a game now, and these are the paths a player takes.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function inbound(entryPoint = { x: 40, y: 24 }): GameState {
  const game = createGame({
    seed: 0x11e,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 72, height: 48 },
    ships: [
      createShipState({
        id: 'relief',
        side: 'a',
        design: designById('nac-heavy-cruiser') as ShipDesign,
        placement: { position: entryPoint, facing: 9 },
      }),
      createShipState({
        id: 'enemy',
        side: 'b',
        design: designById('esu-destroyer') as ShipDesign,
        placement: { position: { x: 12, y: 12 }, facing: 3 },
      }),
    ],
  })
  const relief = game.ships[0] as ShipState
  relief.offTable = true
  relief.ftlTransit = 'entering'
  relief.ftlArrival = { entryPoint, course: 9, velocity: 8 }
  return game
}

const enter = (game: GameState): GameAction => {
  const arrival = (game.ships[0] as ShipState).ftlArrival
  if (!arrival) throw new Error('not inbound')
  return { type: 'enter-from-ftl', shipId: 'relief', ...arrival }
}

describe('11.5 FTL entry', () => {
  it('lists the hulls still in hyperspace', () => {
    const game = inbound()
    expect(shipsAwaitingFtlEntry(game).map((ship) => ship.id)).toEqual(['relief'])
    advanceTo(game, 'move-ships')
    applyAction(game, enter(game))
    expect(shipsAwaitingFtlEntry(game)).toEqual([])
  })

  it('is the ship\'s move, so it is refused in any other phase', () => {
    const game = inbound()
    const refusal = applyAction(game, enter(game))
    expect(refusal.refused).toContain('phase 5')
  })

  it('puts the ship on the table on its written course', () => {
    const game = inbound()
    advanceTo(game, 'move-ships')
    expect(applyAction(game, enter(game)).refused).toBeUndefined()
    const relief = game.ships[0] as ShipState
    expect(relief.offTable).toBe(false)
    expect(relief.placement.facing).toBe(9)
    expect(relief.velocity).toBe(8)
    expect(relief.ftlTransit).toBe('none')
  })

  it('scatters: the arrival point is rolled for, not written', () => {
    // Twelve seeds, one arrival each. A scatter that never moves the ship is
    // 11.5's D12/D6 not being rolled at all.
    const landings = new Set<string>()
    for (let seed = 0; seed < 12; seed += 1) {
      const game = inbound()
      game.rng = new (game.rng.constructor as new (seed: number) => typeof game.rng)(seed)
      advanceTo(game, 'move-ships')
      applyAction(game, enter(game))
      const relief = game.ships[0] as ShipState
      if (!relief.offTable) landings.add(`${relief.placement.position.x},${relief.placement.position.y}`)
    }
    expect(landings.size).toBeGreaterThan(1)
  })

  it('refuses a ship that is already on the table', () => {
    const game = inbound()
    advanceTo(game, 'move-ships')
    const action = enter(game)
    applyAction(game, action)
    const second = applyAction(game, action)
    expect(second.refused).toBeTruthy()
  })

  it('does not move again after arriving', () => {
    const game = inbound()
    advanceTo(game, 'move-ships')
    applyAction(game, enter(game))
    const after = applyAction(game, { type: 'move-ship', shipId: 'relief' })
    expect(after.refused).toBeTruthy()
  })

  it('counts an inbound hull as neither lost nor withdrawn', () => {
    const game = inbound()
    // "disengaged" would score the arriving side's own reinforcements against
    // it before they turn up.
    expect(damageLevelOf(game.ships[0] as ShipState)).toBe('unhurt')
  })

  it('hurts whatever it lands on, past screens and armour', () => {
    // Every ship on the table stacked on the entry point: something within
    // 6 MU takes 2D6 whatever the arriving ship rolls for itself.
    let bruised = 0
    for (let seed = 0; seed < 20; seed += 1) {
      const game = inbound()
      game.rng = new (game.rng.constructor as new (seed: number) => typeof game.rng)(seed)
      const enemy = game.ships[1] as ShipState
      enemy.placement = { position: { x: 40, y: 24 }, facing: 3 }
      advanceTo(game, 'move-ships')
      applyAction(game, enter(game))
      if (enemy.hullMarked > 0) bruised += 1
    }
    expect(bruised).toBeGreaterThan(0)
  })
})

describe('11.2 hyper limits', () => {
  it('refuses an entry inside the limit', () => {
    const game = inbound()
    setHyperLimit(game, {
      zones: [{ id: 'star', centre: { x: 40, y: 24 }, radius: 30, label: 'the star' }],
      permittedInsideLimit: false,
    })
    advanceTo(game, 'move-ships')
    const refusal = applyAction(game, enter(game))
    expect(refusal.refused).toContain('hyper limit')
    expect((game.ships[0] as ShipState).offTable).toBe(true)
  })

  it('refuses a jump out from inside the limit, before the drive spins up', () => {
    const game = inbound()
    setHyperLimit(game, {
      zones: [{ id: 'star', centre: { x: 12, y: 12 }, radius: 20, label: 'the star' }],
      permittedInsideLimit: false,
    })
    const leaver = game.ships[1] as ShipState
    const refusal = applyAction(game, { type: 'plot-ftl-exit', shipId: leaver.id, on: true })
    expect(refusal.refused).toContain('hyper limit')
    expect(leaver.ftlWarmupTurn).toBe(null)
  })

  it('lets a ship outside the limit go', () => {
    const game = inbound()
    setHyperLimit(game, {
      zones: [{ id: 'star', centre: { x: 60, y: 40 }, radius: 8, label: 'the star' }],
      permittedInsideLimit: false,
    })
    const leaver = game.ships[1] as ShipState
    expect(
      applyAction(game, { type: 'plot-ftl-exit', shipId: leaver.id, on: true }).refused,
    ).toBeUndefined()
  })
})

describe('the scenario', () => {
  it('starts its relief force in hyperspace and lets it arrive', () => {
    const game = startScenario('hyper-limit', { seed: 0x5150 })
    const waiting = shipsAwaitingFtlEntry(game)
    expect(waiting).toHaveLength(2)
    expect(waiting.every((ship) => ship.offTable)).toBe(true)

    advanceTo(game, 'move-ships')
    for (const ship of waiting) {
      const arrival = ship.ftlArrival
      if (!arrival) throw new Error('not inbound')
      const outcome = applyAction(game, { type: 'enter-from-ftl', shipId: ship.id, ...arrival })
      // The rim is outside the star's limit, so the entry is legal; whether the
      // ship makes the table is the scatter's business.
      expect(outcome.refused).toBeUndefined()
    }
    expect(shipsAwaitingFtlEntry(game)).toEqual([])
  })

  it('will not let a ship in the middle of that table jump out', () => {
    const game = startScenario('hyper-limit', { seed: 0x5150 })
    const middle = game.ships[0] as ShipState
    middle.placement = { position: { x: 42, y: 30 }, facing: 3 }
    const refusal = applyAction(game, { type: 'plot-ftl-exit', shipId: middle.id, on: true })
    expect(refusal.refused).toContain('hyper limit')
  })
})
