import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import { cloakMode } from './ew'
import type { Phase, ShipDesign, SystemKind } from './types'

/**
 * Electronic warfare, through the action layer.
 *
 * `ew.test.ts` checks the rules; this checks that they are reachable. A
 * holofield that is fitted, priced, drawn on the SSD and never consulted when
 * a shot is resolved is the failure mode that survives every unit test in the
 * repository, because each module is right on its own.
 *
 * The shots are compared on the *same seed*: two identical battles that differ
 * only in the defender's fit must roll the same faces and score differently,
 * or the fit is decoration.
 */

function design(name: string, systems: SystemKind[]): ShipDesign {
  return {
    id: name,
    name,
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
    systems: [
      { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      ...systems.map((kind, i) => ({
        id: `${kind}-${i + 1}`,
        kind,
        label: kind,
        mass: 1,
        points: 3,
      })),
    ],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 1,
    marineParties: 0,
    points: 100,
  }
}

/**
 * Wind the sequence of play on to a phase.
 *
 * A helper rather than an inline loop because `advancePhase` mutates the game
 * and TypeScript cannot see that: after one `while (game.phase !== 'x')` it
 * believes the phase is `'x'` forever, and calls the next comparison
 * impossible.
 */
function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

/** Two ships 18 MU apart — outside the holofield's 6 MU blind spot (7.17). */
function battle(defenderSystems: SystemKind[]): GameState {
  return createGame({
    seed: 0x4a17,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'shooter',
        side: 'a',
        design: design('Shooter', []),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'target',
        side: 'b',
        design: design('Target', defenderSystems),
        placement: { position: { x: 0, y: 18 }, facing: 12 },
      }),
    ],
  })
}

function fireOnce(defenderSystems: SystemKind[]): { damage: number; log: string } {
  const game = battle(defenderSystems)
  advanceTo(game, 'ship-fire')
  applyAction(game, { type: 'fire-weapon', shipId: 'shooter', weaponId: 'b1', targetId: 'target' })
  const target = game.ships.find((s) => s.id === 'target')
  const last = game.log[game.log.length - 1]
  return { damage: target?.hullMarked ?? 0, log: last?.text ?? '' }
}

describe('a holofield, once the shot goes through the engine (7.17)', () => {
  it('takes damage off a beam that would otherwise land it', () => {
    // Same seed, same dice, one difference: the -1 DRM on every beam die.
    const bare = fireOnce([])
    const hidden = fireOnce(['holofield'])
    expect(bare.damage).toBeGreaterThan(0)
    expect(hidden.damage).toBeLessThan(bare.damage)
  })

  it('is ignored inside 6 MU, where the projections cannot separate', () => {
    const close = (systems: SystemKind[]) => {
      const game = createGame({
        seed: 0x4a17,
        sides: [{ id: 'a' }, { id: 'b' }],
        ships: [
          createShipState({
            id: 'shooter',
            side: 'a',
            design: design('Shooter', []),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'target',
            side: 'b',
            design: design('Target', systems),
            placement: { position: { x: 0, y: 4 }, facing: 12 },
          }),
        ],
      })
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
      return game.ships.find((s) => s.id === 'target')?.hullMarked ?? 0
    }
    expect(close(['holofield'])).toBe(close([]))
  })
})

describe('a Reflex Field, through the action layer (7.25)', () => {
  /** Fire the same volley many times and total what the field let through. */
  function volleys(count: number, raise: boolean): { landed: number; back: number } {
    let landed = 0
    let back = 0
    for (let seed = 0; seed < count; seed++) {
      const game = createGame({
        seed,
        sides: [{ id: 'a' }, { id: 'b' }],
        ships: [
          createShipState({
            id: 'shooter',
            side: 'a',
            design: design('Shooter', []),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'target',
            side: 'b',
            design: design('Target', ['reflex-field']),
            placement: { position: { x: 0, y: 10 }, facing: 12 },
          }),
        ],
      })
      if (raise) applyAction(game, { type: 'set-reflex-field', shipId: 'target', on: true })
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
      landed += game.ships[1].hullMarked
      back += game.ships[0].hullMarked
    }
    return { landed, back }
  }

  it('absorbs most of a beam volley and throws some of it back', () => {
    const off = volleys(40, false)
    const on = volleys(40, true)
    // The table is 1 full, 2 half, 3-4 nothing, 5 half back, 6 all back — so
    // over enough volleys far less lands, and the shooter starts taking hits
    // it never took before.
    expect(on.landed).toBeLessThan(off.landed)
    expect(off.back, 'nobody shoots themselves with the field down').toBe(0)
    expect(on.back).toBeGreaterThan(0)
  })

  it('costs the ship its own weapons for the turn', () => {
    // The field is on the `target` hull in this fixture, so it is the target
    // that tries to shoot back and finds it cannot (7.25).
    const game = battle(['reflex-field'])
    expect(
      applyAction(game, { type: 'set-reflex-field', shipId: 'target', on: true }).refused,
    ).toBeUndefined()
    advanceTo(game, 'ship-fire')
    const shot = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'target',
      weaponId: 'b1',
      targetId: 'shooter',
    })
    expect(shot.refused).toContain('Reflex Field')
  })

  it('is written in orders, and only by a ship that has one', () => {
    const bare = battle([])
    expect(
      applyAction(bare, { type: 'set-reflex-field', shipId: 'target', on: true }).refused,
    ).toContain('no working Reflex Field')

    const game = battle(['reflex-field'])
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'set-reflex-field', shipId: 'target', on: true }).refused,
    ).toContain('orders')
  })
})

describe('a cloak, through the action layer (7.20, 7.21)', () => {
  it('is written in orders and goes up when the ship moves', () => {
    const game = battle(['cloaking-device'])
    const target = game.ships.find((s) => s.id === 'target')!

    // Phase 1 only: the count is declared in advance (7.20).
    expect(applyAction(game, { type: 'set-cloak', shipId: 'target', on: true, turns: 3 }).refused)
      .toBeUndefined()
    expect(target.cloaked, 'not yet — a Device goes up at the end of the move').toBe(false)

    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'target' })
    expect(target.cloaked, 'up at the end of the movement phase (7.20)').toBe(true)
    expect(cloakMode(target.cloak!)).toBe('partial')
  })

  it('refuses the order outside phase 1, and on a ship with no cloak', () => {
    const game = battle(['cloaking-device'])
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, { type: 'set-cloak', shipId: 'target', on: true }).refused,
    ).toContain('orders')

    const bare = battle([])
    expect(
      applyAction(bare, { type: 'set-cloak', shipId: 'target', on: true }).refused,
    ).toContain('no cloak')
  })

  it('doubles the range and takes 2 off every die once it is up', () => {
    const cloaked = () => {
      const game = battle(['cloaking-device'])
      applyAction(game, { type: 'set-cloak', shipId: 'target', on: true, turns: 3 })
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'target' })
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
      return game.ships.find((s) => s.id === 'target')?.hullMarked ?? 0
    }
    // 18 MU doubled is 36 MU, which is still inside a Beam-3's reach — so the
    // shot happens, at fewer dice and −2 on each (7.20).
    expect(cloaked()).toBeLessThan(fireOnce([]).damage)
  })

  it('takes a totally cloaked ship off the table entirely (7.21)', () => {
    const game = battle(['cloaking-field'])
    applyAction(game, { type: 'set-cloak', shipId: 'target', on: true, turns: 2 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'target' })
    expect(cloakMode(game.ships[1].cloak!), 'a Field goes up before the ship moves').toBe('total')

    advanceTo(game, 'ship-fire')
    const shot = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'shooter',
      weaponId: 'b1',
      targetId: 'target',
    })
    expect(shot.refused).toContain('not on the table')
    expect(game.ships[1].hullMarked).toBe(0)
  })
})
