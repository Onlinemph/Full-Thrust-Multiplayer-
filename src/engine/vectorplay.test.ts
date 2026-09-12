import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules } from './actions'
import { advancePhase, createGame, createShipState, vectorStateOf, type GameState } from './game'
import { arcTo } from './geometry'
import type { Phase, ShipDesign } from './types'

/**
 * 12.12 at the table.
 *
 * `vectormovement.test.ts` checks the system; this checks that a ship in a
 * battle actually flies under it. The engine had no concept of a course that
 * differs from a facing at all — `game.ts` said so in a comment — so the one
 * thing 12.12 exists for, a ship shooting over its shoulder at the thing it is
 * running from, was unreachable.
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
    weapons: [
      {
        id: 'f1',
        label: 'Beam-3',
        weaponClass: 'beam',
        rating: 3,
        variant: 'standard',
        arcs: ['F'],
        mass: 4,
        points: 12,
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

function vectorGame(velocity = 6): GameState {
  const game = createGame({
    seed: 0x1212,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'red',
        side: 'a',
        design: design({ id: 'red', name: 'Red' }),
        placement: { position: { x: 36, y: 10 }, facing: 6 },
        velocity,
      }),
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue' }),
        placement: { position: { x: 36, y: 2 }, facing: 6 },
        velocity: 0,
      }),
    ],
  })
  setOptionalRules(game, { movementSystem: 'vector' })
  return game
}

describe('a battle under 12.12', () => {
  it('reads a ship with no course marker as travelling along its bow', () => {
    const game = vectorGame()
    const state = vectorStateOf(game.ships[0])
    expect(state.course, 'facing 6 is 180° clockwise from up the table').toBe(180)
    expect(state.velocity).toBe(6)
  })

  it('refuses a cinematic order sheet', () => {
    const game = vectorGame()
    expect(applyAction(game, { type: 'plot-accel', shipId: 'red', accel: 2 }).refused).toContain(
      '12.12',
    )
    expect(
      applyAction(game, { type: 'plot-turn', shipId: 'red', direction: 'port', points: 1 }).refused,
    ).toContain('12.12')
  })

  it('takes an order sheet as a sequence', () => {
    const game = vectorGame()
    expect(
      applyAction(game, {
        type: 'plot-vector-orders',
        shipId: 'red',
        orders: [
          { kind: 'TP', points: 3 },
          { kind: 'MD', points: 6 },
        ],
      }).refused,
    ).toBeUndefined()
    expect(game.ships[0].vectorOrders).toEqual([
      { kind: 'TP', points: 3 },
      { kind: 'MD', points: 6 },
    ])
  })

  it('refuses a sheet the drive cannot pay for', () => {
    const game = vectorGame()
    expect(
      applyAction(game, {
        type: 'plot-vector-orders',
        shipId: 'red',
        orders: [{ kind: 'MD', points: 9 }],
      }).refused,
      'a thrust-6 drive cannot burn 9',
    ).toBeDefined()
  })

  it('flies the sequence and leaves the bow where the rotation put it', () => {
    const game = vectorGame(6)
    applyAction(game, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [
        { kind: 'TP', points: 3 },
        { kind: 'MD', points: 6 },
      ],
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })

    const red = game.ships[0]
    // Facing 6 turned 3 points to port is facing 3.
    expect(red.placement.facing).toBe(3)
    // And the course is neither the old one nor the new bow line: the ship
    // still carries the 6 MU it started with, plus 6 MU along the new bow.
    expect(red.courseDegrees).not.toBe(180)
    expect(red.courseDegrees).not.toBe(90)
    expect(red.velocity).toBeGreaterThan(6)
  })

  it('gives the same order sheet a different answer in a different order', () => {
    // "If the player writes TP2, MD6 … If, on the other hand, the order is
    // written MD6, TP2 … the result will be VERY different."
    const first = vectorGame(6)
    applyAction(first, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [
        { kind: 'TP', points: 2 },
        { kind: 'MD', points: 6 },
      ],
    })
    const second = vectorGame(6)
    applyAction(second, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [
        { kind: 'MD', points: 6 },
        { kind: 'TP', points: 2 },
      ],
    })
    for (const game of [first, second]) {
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
    }
    expect(first.ships[0].placement.facing).toBe(second.ships[0].placement.facing)
    expect(first.ships[0].placement.position).not.toEqual(second.ships[0].placement.position)
  })

  it('lets a ship shoot over its shoulder at what it is running from', () => {
    // The whole point of the system. Red starts heading away from Blue at
    // velocity 6, then rotates 6 points so the bow is on Blue while the course
    // marker keeps carrying it away.
    const game = vectorGame(6)
    applyAction(game, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [{ kind: 'TP', points: 6 }],
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })

    const red = game.ships[0]
    expect(red.placement.position.y, 'still running away').toBeGreaterThan(10)
    expect(
      arcTo(red.placement.position, red.placement.facing, game.ships[1].placement.position),
      'and the forward battery bears on the pursuer',
    ).toBe('F')

    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'f1', targetId: 'blue' })
        .refused,
    ).toBeUndefined()
  })

  it('keeps the course marker across the turn boundary but not the sheet', () => {
    const game = vectorGame(6)
    applyAction(game, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [{ kind: 'MD', points: 3 }],
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    const course = game.ships[0].courseDegrees
    expect(course).not.toBeNull()

    const turn = game.turn
    while (game.turn === turn) advancePhase(game)
    expect(game.ships[0].vectorOrders, 'a fresh sheet every turn').toBeNull()
    expect(game.ships[0].courseDegrees, 'the marker stays on the table').toBe(course)
  })

  it('coasts on the starting vector when nothing is written', () => {
    const game = vectorGame(6)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].placement.position.y).toBeCloseTo(16, 6)
    expect(game.ships[0].velocity).toBe(6)
    expect(game.ships[0].placement.facing).toBe(6)
  })

  it('reports the course, not the bow line, when an opponent asks (2.6)', () => {
    const game = vectorGame(6)
    applyAction(game, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [{ kind: 'TP', points: 3 }],
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    advancePhase(game)
    expect(game.ships[0].lastKnown?.courseDegrees).toBe(180)
  })

  it('spends the whole sheet against 4.2s aft-arc exception', () => {
    const game = vectorGame(6)
    applyAction(game, {
      type: 'plot-vector-orders',
      shipId: 'red',
      orders: [
        { kind: 'MD', points: 2 },
        { kind: 'PP', points: 1 },
      ],
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].thrustUsed, '2 on the burn and 1 on the push').toBe(3)
  })
})

describe('a battle under cinematic movement', () => {
  it('will not take a vector sheet', () => {
    const game = vectorGame()
    setOptionalRules(game, {})
    expect(
      applyAction(game, {
        type: 'plot-vector-orders',
        shipId: 'red',
        orders: [{ kind: 'MD', points: 1 }],
      }).refused,
    ).toContain('cinematic')
  })
})
