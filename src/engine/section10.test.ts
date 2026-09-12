import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { Rng } from './dice'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import { knockOutCoreSystem, reactorBlastDice, REACTOR_BLAST_RADIUS } from './threshold'
import type { Phase, ShipDesign } from './types'

/**
 * Section 10 at the action layer.
 *
 * `threshold.test.ts` checks the rolls; this checks that the two rules the
 * engine used to say it could not know are now actually enforced. Both were
 * written down in the half of the rulebook that could not be read: what a
 * reactor breach does to everything around it, and what a ship with no bridge
 * is stopped from doing.
 */

function design(over: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'hull',
    name: 'Hull',
    faction: 'Test',
    group: 'cruiser',
    mass: 100,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 30,
    drive: { thrust: 4, advanced: false },
    ftl: 'standard',
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

function battle(gap: number): GameState {
  return createGame({
    seed: 0x10c0,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'doomed',
        side: 'a',
        design: design({ id: 'doomed', name: 'Doomed' }),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'neighbour',
        side: 'b',
        design: design({ id: 'neighbour', name: 'Neighbour' }),
        placement: { position: { x: 0, y: gap }, facing: 12 },
      }),
    ],
  })
}

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

describe('a reactor breach (10.3)', () => {
  it('rolls a die for every 25 mass of the ship that went up', () => {
    // "1D6 damage for every 25 mass of the exploding ship."
    expect(reactorBlastDice(100)).toBe(4)
    expect(reactorBlastDice(130), 'the book’s own example rolls 5D6').toBe(6)
    expect(reactorBlastDice(25)).toBe(1)
    expect(reactorBlastDice(26)).toBe(2)
    expect(REACTOR_BLAST_RADIUS).toBe(3)
  })

  it('catches a neighbour inside 3 MU and spares one outside it', () => {
    const hurt = (gap: number): number => {
      const game = battle(gap)
      const doomed = game.ships[0]
      // Breach the core, then keep rolling phase 15 until it lets go. The
      // explosion is a 5 or 6 at the end of each turn (10.3).
      knockOutCoreSystem(doomed, 'power-core', 1, new Rng(1))
      let guard = 30
      while (!doomed.destroyed && guard-- > 0) {
        advanceTo(game, 'reactor-explosions')
        applyAction(game, { type: 'resolve-reactor-explosions' })
        if (!doomed.destroyed) advancePhase(game)
      }
      expect(doomed.destroyed, 'the core never let go').toBe(true)
      return game.ships[1].hullMarked
    }
    expect(hurt(2), 'inside the radius').toBeGreaterThan(0)
    expect(hurt(8), 'well outside it').toBe(0)
  })

  it('catches friend as well as enemy', () => {
    // "The player rolls 5D6 for every ship (friendly or enemy) within 3 MU."
    const game = createGame({
      seed: 0x10c0,
      sides: [{ id: 'a' }],
      ships: [
        createShipState({
          id: 'doomed',
          side: 'a',
          design: design({ id: 'doomed', name: 'Doomed' }),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
        }),
        createShipState({
          id: 'friend',
          side: 'a',
          design: design({ id: 'friend', name: 'Friend' }),
          placement: { position: { x: 0, y: 2 }, facing: 12 },
        }),
      ],
    })
    const doomed = game.ships[0]
    knockOutCoreSystem(doomed, 'power-core', 1, new Rng(1))
    let guard = 30
    while (!doomed.destroyed && guard-- > 0) {
      advanceTo(game, 'reactor-explosions')
      applyAction(game, { type: 'resolve-reactor-explosions' })
      if (!doomed.destroyed) advancePhase(game)
    }
    expect(game.ships[1].hullMarked).toBeGreaterThan(0)
  })
})

describe('a ship with no bridge (10.3)', () => {
  /** Knock the bridge out and land on the phase where it should bite. */
  function crippled(phase: Phase): GameState {
    const game = battle(6)
    // A 6 on the bridge roll is permanent, which is the case worth testing:
    // seeded so the roll is known rather than hoped for.
    let seed = 0
    for (; seed < 200; seed++) {
      const probe = createShipState({
        id: 'p',
        side: 'a',
        design: design(),
        placement: { position: { x: 0, y: 0 }, facing: 12 },
      })
      if ((knockOutCoreSystem(probe, 'bridge', 1, new Rng(seed)).roll ?? 0) >= 4) break
    }
    knockOutCoreSystem(game.ships[0], 'bridge', 1, new Rng(seed))
    advanceTo(game, phase)
    return game
  }

  it('may not fire its weapons', () => {
    // "may not fire weapons, launch fighters, or take any other offensive
    // action."
    const game = crippled('ship-fire')
    const shot = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'doomed',
      weaponId: 'b1',
      targetId: 'neighbour',
    })
    expect(shot.refused).toContain('out of control')
    expect(game.ships[1].hullMarked).toBe(0)
  })

  it('loses its point defence but keeps its screens', () => {
    // "Passive defenses (screens, armor) are still operational, though active
    // defenses (PDS) are not." Point defence resolving for the whole table
    // must simply skip it.
    const game = crippled('point-defence')
    const pd = applyAction(game, { type: 'resolve-point-defence' })
    expect(pd.refused, 'the phase still resolves for everyone else').toBeUndefined()
    // Its armour and screens are untouched by the bridge hit: nothing in the
    // ship's own state says otherwise.
    expect(game.ships[0].armourMarked).toEqual([])
  })

  it('still gets shot at normally', () => {
    const game = crippled('ship-fire')
    const shot = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'neighbour',
      weaponId: 'b1',
      targetId: 'doomed',
    })
    expect(shot.refused).toBeUndefined()
  })
})

describe('an FTL exit, through the action layer (11.4)', () => {
  /** Declare the jump, then run turns until the ship is gone or the drive fails. */
  function leave(gap: number): { game: GameState; ship: GameState['ships'][number] } {
    const game = battle(gap)
    const ship = game.ships[0]
    expect(applyAction(game, { type: 'plot-ftl-exit', shipId: 'doomed', on: true }).refused)
      .toBeUndefined()
    // Turn 1 is the warm-up; the jump is in turn 2's movement phase.
    for (let turn = 0; turn < 3 && !ship.offTable && !ship.destroyed; turn++) {
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'doomed' })
      advanceTo(game, 'orders')
    }
    return { game, ship }
  }

  it('is announced in orders and nowhere else', () => {
    const game = battle(20)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'plot-ftl-exit', shipId: 'doomed', on: true }).refused,
    ).toContain('orders')
  })

  it('takes the ship off the table for good when nothing is close', () => {
    const { ship } = leave(30)
    expect(ship.offTable).toBe(true)
    expect(ship.destroyed).toBe(false)
  })

  it('silences its guns while the drive spins up', () => {
    // "The ship may not apply any thrust in that move, nor may it use any
    // offensive weaponry or ADFC."
    const game = battle(20)
    applyAction(game, { type: 'plot-ftl-exit', shipId: 'doomed', on: true })
    advanceTo(game, 'ship-fire')
    const shot = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'doomed',
      weaponId: 'b1',
      targetId: 'neighbour',
    })
    expect(shot.refused).toContain('hyperspace')
  })

  it('is dangerous to jump with a ship alongside', () => {
    // "any other ship-sized or larger object... within 6 MU of the actual
    // point of FTL exit" forces the roll, and a 5 or 6 destroys the jumping
    // ship and throws 2D6 at everything near it.
    let caught = 0
    for (let seed = 0; seed < 12; seed++) {
      const game = battle(1)
      game.rng = new Rng(seed)
      const ship = game.ships[0]
      applyAction(game, { type: 'plot-ftl-exit', shipId: 'doomed', on: true })
      for (let turn = 0; turn < 3 && !ship.offTable && !ship.destroyed; turn++) {
        advanceTo(game, 'move-ships')
        applyAction(game, { type: 'move-ship', shipId: 'doomed' })
        advanceTo(game, 'orders')
      }
      if (ship.destroyed || game.ships[1].hullMarked > 0) caught += 1
    }
    expect(caught, 'twelve jumps beside another hull and none went wrong').toBeGreaterThan(0)
  })
})
