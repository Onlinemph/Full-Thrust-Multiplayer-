import { describe, expect, it } from 'vitest'

import { buildGame } from '../data/savedGame'
import { SHIP_DESIGNS } from '../data/ships'
import { applyAction } from '../engine/actions'
import { createShipState, type GameState } from '../engine/game'
import type { ShipDesign } from '../engine/types'
import { outsideReach, reachOfAim, reachOfGroup, reachOfReturn } from './reach'

/**
 * The reach drawn on the table is the rule the engine will apply, so the two
 * are checked against each other: a click the picture allows is one the
 * handler accepts, and a click it refuses is refused with the same number.
 */
function battle(): GameState {
  return buildGame({ scenarioId: 'border-skirmish', seed: 11 })
}

const salvoShip = SHIP_DESIGNS.find((d) =>
  d.weapons.some((w) => w.weaponClass === 'salvo-missile-rack'),
) as ShipDesign
const spinalShip = SHIP_DESIGNS.find((d) => d.weapons.some((w) => w.weaponClass === 'spinal-beam'))

describe('the reach of what is in hand', () => {
  it('draws a missile rack as a fan of its arcs at its launch range, and refuses beyond it', () => {
    const game = battle()
    const ship = createShipState({
      id: 'sml',
      side: 'a',
      design: salvoShip,
      placement: { position: { x: 30, y: 30 }, facing: 12 },
      velocity: 4,
    })
    game.ships.push(ship)
    const rack = salvoShip.weapons.find((w) => w.weaponClass === 'salvo-missile-rack')!
    const reach = reachOfAim(game, { shipId: ship.id, weaponId: rack.id, kind: 'missile' })
    expect(reach?.kind).toBe('fan')
    if (reach?.kind !== 'fan') return
    expect(reach.radius).toBe(24)
    // Dead ahead, in range: fine. Dead ahead, too far: refused with the range.
    expect(outsideReach(game, reach, { x: 30, y: 10 })).toBeNull()
    expect(outsideReach(game, reach, { x: 30, y: 2 })).toMatch(/24 MU/)
    // Dead astern, in range: refused with the arc, if the rack does not bear there.
    if (!reach.arcs.includes('A')) {
      expect(outsideReach(game, reach, { x: 30, y: 40 })).toMatch(/does not bear/)
    }
  })

  it('draws a spinal mount as a cone dead ahead (5.23)', () => {
    if (spinalShip === undefined) return
    const game = battle()
    const ship = createShipState({
      id: 'sp',
      side: 'a',
      design: spinalShip,
      placement: { position: { x: 40, y: 40 }, facing: 12 },
      velocity: 4,
    })
    game.ships.push(ship)
    const gun = spinalShip.weapons.find((w) => w.weaponClass === 'spinal-beam')!
    const reach = reachOfAim(game, { shipId: ship.id, weaponId: gun.id, kind: 'spinal' })
    expect(reach?.kind).toBe('cone')
    if (reach?.kind !== 'cone') return
    expect(outsideReach(game, reach, { x: 40, y: 30 })).toBeNull()
    expect(outsideReach(game, reach, { x: 50, y: 40 })).toMatch(/degree/)
  })

  it('draws a returning ship its edge and refuses the middle of the table (3.9)', () => {
    const game = battle()
    const ship = game.ships[0]
    ship.offTable = true
    ship.exitEdge = 'left'
    ship.reentryTurn = game.turn
    const reach = reachOfReturn(game, ship)
    expect(reach?.kind).toBe('edge')
    if (reach?.kind !== 'edge') return
    expect(reach.edge).toBe('left')
    expect(outsideReach(game, reach, { x: 0.2, y: 10 })).toBeNull()
    expect(outsideReach(game, reach, { x: 20, y: 10 })).toMatch(/left edge/)
    // And the engine agrees on both.
    expect(applyAction(game, { type: 'return-to-table', shipId: ship.id, position: { x: 20, y: 10 } }).refused).toBeTruthy()
    expect(applyAction(game, { type: 'return-to-table', shipId: ship.id, position: { x: 0.2, y: 10 } }).refused).toBeUndefined()
  })

  it('draws a fighter group its move in phase 4 and nothing in phase 1 (8.5)', () => {
    const carrier = SHIP_DESIGNS.find((d) => d.fighterBays.length > 0) as ShipDesign
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 11, forces: { a: [carrier.id] } })
    const group = game.fighterGroups.find((g) => g.side === 'a')
    expect(group).toBeDefined()
    if (!group) return
    group.status = 'in-flight'
    group.position = { x: 20, y: 20 }
    expect(reachOfGroup(game, group, false)).toBeNull()
    game.phase = 'move-fighters'
    const reach = reachOfGroup(game, group, false)
    expect(reach?.kind).toBe('disc')
    if (reach?.kind !== 'disc') return
    expect(outsideReach(game, reach, { x: 20 + reach.radius, y: 20 })).toBeNull()
    expect(outsideReach(game, reach, { x: 20 + reach.radius + 1, y: 20 })).toMatch(/can move/)
  })
})
