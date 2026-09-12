import { describe, expect, it } from 'vitest'

import { applyAction, deployingSide, proposeDeployment } from './actions'
import { aiActions } from './ai'
import { shipsAwaitingDeployment, type GameState } from './game'
import { validatePlacement } from './battles'
import { buildGame } from '../data/savedGame'

/**
 * Section 18.1 at the table.
 *
 * `battles.test.ts` checks the geometry; this checks that a player can perform
 * the deployment. Before it, a scenario's ships stood where `scenarios.ts`
 * wrote them and section 18 contributed nothing to play — all 58 exports of
 * `battles.ts` were reachable only from its own test file.
 */

function meeting(seed = 7): GameState {
  return buildGame({
    scenarioId: 'border-skirmish',
    seed,
    battleType: 'meeting-engagement',
  })
}

describe('a battle with no deployment', () => {
  it('is every scenario as it was written', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 1 })
    expect(game.deployment).toBeNull()
    expect(shipsAwaitingDeployment(game)).toEqual([])
    // And the guard added to advance-phase cannot bite.
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('can be turned off even for a scenario that asks for one', () => {
    const off = buildGame({ scenarioId: 'border-skirmish', seed: 1, battleType: 'none' })
    expect(off.deployment).toBeNull()
  })
})

describe('a meeting engagement (18.1)', () => {
  it('holds the turn open until every ship is placed', () => {
    const game = meeting()
    expect(game.deployment).not.toBeNull()
    expect(shipsAwaitingDeployment(game).length).toBe(game.ships.length)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toContain('deployed')
  })

  it('will not place anything until the die has been rolled (4.12)', () => {
    const game = meeting()
    const ship = game.ships[0]
    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: ship.id,
        position: { x: 10, y: 3 },
        facing: 6,
        velocity: 6,
      }).refused,
    ).toContain('4.12')
  })

  it('rolls a total order and alternates from the lower roll', () => {
    const game = meeting()
    expect(applyAction(game, { type: 'roll-deployment-order' }).refused).toBeUndefined()
    expect(game.deployment?.order.length).toBe(2)
    expect(new Set(game.deployment?.order).size).toBe(2)
    expect(applyAction(game, { type: 'roll-deployment-order' }).refused).toContain('already')

    const first = game.deployment!.order[0]
    expect(deployingSide(game)).toBe(first)

    // The other side may not jump in.
    const theirs = game.ships.find((s) => s.side !== first)!
    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: theirs.id,
        position: { x: 10, y: 3 },
        facing: 6,
        velocity: 6,
      }).refused,
    ).toContain('turn to place')
  })

  it('refuses a placement outside the zone, and takes one inside it', () => {
    const game = meeting()
    applyAction(game, { type: 'roll-deployment-order' })
    const side = deployingSide(game)!
    const ship = game.ships.find((s) => s.side === side)!
    const zone = game.deployment!.zones[side]

    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: ship.id,
        position: { x: 36, y: 24 },
        facing: 6,
        velocity: 6,
      }).refused,
      'the middle of the table is not within 6 MU of anybody edge',
    ).toContain('deployment zone')

    const inside = {
      x: (zone.area.minX + zone.area.maxX) / 2,
      y: (zone.area.minY + zone.area.maxY) / 2,
    }
    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: ship.id,
        position: inside,
        facing: 6,
        velocity: 8,
      }).refused,
    ).toBeUndefined()
    expect(ship.placement.position).toEqual(inside)
    expect(ship.velocity).toBe(8)
    expect(game.deployment?.placed).toEqual([ship.id])
    // And the turn passes to the other fleet.
    expect(deployingSide(game)).not.toBe(side)
  })

  it('will not place the same ship twice', () => {
    const game = meeting()
    applyAction(game, { type: 'roll-deployment-order' })
    const side = deployingSide(game)!
    const ship = game.ships.find((s) => s.side === side)!
    const zone = game.deployment!.zones[side]
    const spot = { x: (zone.area.minX + zone.area.maxX) / 2, y: (zone.area.minY + zone.area.maxY) / 2 }
    applyAction(game, { type: 'deploy-ship', shipId: ship.id, position: spot, facing: 6, velocity: 6 })
    // Back round the rotation.
    const other = game.ships.find((s) => s.side !== side)!
    const theirZone = game.deployment!.zones[other.side]
    applyAction(game, {
      type: 'deploy-ship',
      shipId: other.id,
      position: {
        x: (theirZone.area.minX + theirZone.area.maxX) / 2,
        y: (theirZone.area.minY + theirZone.area.maxY) / 2,
      },
      facing: 12,
      velocity: 6,
    })
    expect(
      applyAction(game, { type: 'deploy-ship', shipId: ship.id, position: spot, facing: 6, velocity: 6 })
        .refused,
    ).toContain('already deployed')
  })

  it('proposes placements the zone accepts', () => {
    const game = meeting()
    applyAction(game, { type: 'roll-deployment-order' })
    for (const side of game.sides) {
      const zone = game.deployment!.zones[side.id]
      const spots = proposeDeployment(game, side.id)
      expect(spots.length).toBe(game.ships.filter((s) => s.side === side.id).length)
      for (const spot of spots) {
        expect(validatePlacement(zone, spot).legal, JSON.stringify(spot)).toBe(true)
      }
    }
  })
})

describe('a converging approach (18.1)', () => {
  it('limits the initial course to 11, 12 or 1 measured across the table', () => {
    const game = buildGame({
      scenarioId: 'border-skirmish',
      seed: 3,
      battleType: 'converging-approach',
    })
    applyAction(game, { type: 'roll-deployment-order' })
    const side = deployingSide(game)!
    const zone = game.deployment!.zones[side]
    expect(zone.courses).not.toBeNull()
    const ship = game.ships.find((s) => s.side === side)!
    const spot = { x: (zone.area.minX + zone.area.maxX) / 2, y: (zone.area.minY + zone.area.maxY) / 2 }

    const wrongWay = zone.courses!.includes(3) ? 9 : 3
    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: ship.id,
        position: spot,
        facing: wrongWay,
        velocity: 6,
      }).refused,
    ).toContain('course')
    expect(
      applyAction(game, {
        type: 'deploy-ship',
        shipId: ship.id,
        position: spot,
        facing: zone.courses![0],
        velocity: 6,
      }).refused,
    ).toBeUndefined()
  })
})

describe('an offensive/defensive battle (18.1)', () => {
  it('lets the defender, and only the defender, place one feature', () => {
    const game = buildGame({
      scenarioId: 'border-skirmish',
      seed: 4,
      battleType: 'offensive-defensive',
    })
    const zones = game.deployment!.zones
    const defender = Object.keys(zones).find((id) => !zones[id].entry.includes('table-edge'))!
    const attacker = Object.keys(zones).find((id) => id !== defender)!

    expect(
      applyAction(game, {
        type: 'place-terrain',
        sideId: attacker,
        kind: 'planet',
        position: { x: 36, y: 24 },
        radius: 6,
      }).refused,
    ).toContain('defending')

    expect(
      applyAction(game, {
        type: 'place-terrain',
        sideId: defender,
        kind: 'planet',
        position: { x: 36, y: 24 },
        radius: 6,
      }).refused,
    ).toBeUndefined()
    expect(game.terrain.some((f) => f.id === 'deployed-terrain')).toBe(true)

    expect(
      applyAction(game, {
        type: 'place-terrain',
        sideId: defender,
        kind: 'planetoid',
        position: { x: 10, y: 10 },
        radius: 3,
      }).refused,
      'one feature, not a nebula field',
    ).toContain('already')
  })

  it('places no feature at all in a meeting engagement', () => {
    const game = meeting()
    expect(
      applyAction(game, {
        type: 'place-terrain',
        sideId: 'a',
        kind: 'planet',
        position: { x: 36, y: 24 },
        radius: 6,
      }).refused,
    ).toContain('offensive/defensive')
  })
})

describe('a ship still in the wings', () => {
  it('has no station to plot a course from', () => {
    const game = meeting()
    applyAction(game, { type: 'roll-deployment-order' })
    const side = deployingSide(game)!
    const ship = game.ships.find((s) => s.side === side)!
    expect(
      applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 2 }).refused,
    ).toContain('18.1')

    const zone = game.deployment!.zones[side]
    applyAction(game, {
      type: 'deploy-ship',
      shipId: ship.id,
      position: { x: (zone.area.minX + zone.area.maxX) / 2, y: (zone.area.minY + zone.area.maxY) / 2 },
      facing: 6,
      velocity: 6,
    })
    expect(
      applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 2 }).refused,
      'placed, and now it may be given orders',
    ).toBeUndefined()
  })
})

describe('the computer', () => {
  it('deploys its own fleet and then gets on with the battle', () => {
    const game = meeting(11)
    let guard = 200
    while (shipsAwaitingDeployment(game).length > 0 && guard-- > 0) {
      let acted = false
      for (const side of game.sides) {
        for (const action of aiActions(game, side.id)) {
          applyAction(game, action)
          acted = true
        }
      }
      if (!acted) break
    }
    expect(shipsAwaitingDeployment(game), 'the computer left ships in the wings').toEqual([])

    // Every ship it placed is inside its own zone.
    for (const ship of game.ships) {
      const zone = game.deployment!.zones[ship.side]
      expect(
        validatePlacement(zone, {
          position: ship.placement.position,
          facing: ship.placement.facing,
          velocity: ship.velocity,
        }).legal,
        ship.name,
      ).toBe(true)
    }
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })
})
