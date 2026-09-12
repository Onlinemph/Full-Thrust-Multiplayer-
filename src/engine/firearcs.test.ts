import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules } from './actions'
import { planFire } from './ai'
import {
  advancePhase,
  createGame,
  createShipState,
  shipMovementOrder,
  type GameState,
} from './game'
import type { Phase, ShipDesign } from './types'

/**
 * 4.2's aft-arc ban, at the action layer.
 *
 * *"No ship may fire offensive weaponry through its aft arc due to the
 * interference of the ship's main drive."* It is a base rule and the engine did
 * not have it: `combat.planFireControl` refuses an offensive order into arc A,
 * and nothing outside `combat.test.ts` has ever called `planFireControl`. So
 * every ship in every battle has been shooting through its own drive.
 *
 * The optional rule is the exception, not the ban: *"Aft arc fire is permitted
 * on any game turn in which the firing ship did not use any thrust from its
 * main drive to accelerate, decelerate, or change course."*
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
    hullBoxes: 30,
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [
      {
        id: 'b1',
        label: 'Beam-3',
        weaponClass: 'beam',
        rating: 3,
        variant: 'standard',
        arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
        mass: 6,
        points: 18,
      },
    ],
    turrets: [],
    systems: [{ id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
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

/**
 * Red mid-table facing 12 (up the table); blue dead astern of it, in arc A.
 *
 * Well inside the 72 × 48 board on purpose: 3.9 now takes a ship off the table
 * when it flies past an edge, and a fixture that starts outside one is testing
 * something other than what it says it is.
 */
function sternChase(): GameState {
  return createGame({
    seed: 0x0402,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'red',
        side: 'a',
        design: design({ id: 'red', name: 'Red' }),
        placement: { position: { x: 36, y: 24 }, facing: 12 },
        velocity: 0,
      }),
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue' }),
        placement: { position: { x: 36, y: 40 }, facing: 12 },
        velocity: 0,
      }),
      // Off the bow, as a control: whatever the aft arc does, this shot stands.
      createShipState({
        id: 'green',
        side: 'b',
        design: design({ id: 'green', name: 'Green' }),
        placement: { position: { x: 36, y: 8 }, facing: 6 },
        velocity: 0,
      }),
    ],
  })
}

describe('the aft arc (4.2)', () => {
  it('is shut to offensive fire', () => {
    const game = sternChase()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toContain('4.2')
  })

  it('does not shut the other five', () => {
    const game = sternChase()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'green' })
        .refused,
    ).toBeUndefined()
  })

  it('opens for a ship that spent no thrust, when the table plays 4.2s exception', () => {
    const game = sternChase()
    setOptionalRules(game, { aftArcFire: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].thrustUsed, 'no order was written, so no thrust was spent').toBe(0)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toBeUndefined()
  })

  it('shuts again the moment the ship touches the throttle', () => {
    const game = sternChase()
    setOptionalRules(game, { aftArcFire: true })
    applyAction(game, { type: 'plot-accel', shipId: 'red', accel: 1 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].thrustUsed).toBe(1)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toContain('4.2')
  })

  it('is not a per-turn accident: a turn costs thrust too', () => {
    const game = sternChase()
    setOptionalRules(game, { aftArcFire: true })
    applyAction(game, { type: 'plot-turn', shipId: 'red', direction: 'port', points: 1 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].thrustUsed, '3.2 spends thrust on a course change').toBe(1)
  })

  it('is something the computer knows before it allocates fire', () => {
    const game = sternChase()
    advanceTo(game, 'ship-fire')
    const targets = planFire(game, game.ships[0]).map((a) =>
      a.type === 'fire-weapon' ? a.targetId : null,
    )
    expect(targets, 'the computer should not queue a shot the engine will refuse').not.toContain(
      'blue',
    )
    expect(targets).toContain('green')
  })
})

describe('a drive shot out (16.1, 4.11)', () => {
  it('moves the wreck with the rocks, before everyone else', () => {
    // 16.1: "Ships with thrust 0 drives … moves along this predetermined course
    // before all other ships." A ship at thrust 0 because its drive is gone is
    // a thrust-0 ship, and it was sorted in with the healthy hulls, because
    // `shipMovementRank` keyed off a `fixedPath` flag that nothing in the
    // repository ever sets.
    const game = sternChase()
    expect(shipMovementOrder(game).map((s) => s.id), 'undamaged: table order').toEqual([
      'red',
      'blue',
      'green',
    ])

    // The last ship in the list, so nothing about the array order can make this
    // pass by accident.
    game.ships[2].driveHits = 2
    expect(shipMovementOrder(game)[0]?.id).toBe('green')
  })

  it('is thrust that decides it, not a scenario flag', () => {
    const game = sternChase()
    // One drive hit halves a thrust-4 drive to 2, which is not thrust 0.
    game.ships[2].driveHits = 1
    expect(shipMovementOrder(game)[0]?.id).toBe('red')
  })
})
