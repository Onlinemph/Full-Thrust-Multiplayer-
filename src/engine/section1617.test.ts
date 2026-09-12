import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { planFire } from './ai'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import { buildGame } from '../data/savedGame'
import type { Phase, ShipDesign } from './types'

/**
 * Sections 16 and 17 at the action layer.
 *
 * `specialmoves.test.ts` and `terrain.test.ts` check the rules; these check
 * that a player can reach them. Two things changed the game rather than the
 * library: a rock now stops a shot, and a ship can be aimed at another one.
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

/** Two ships facing each other, with whatever terrain the caller wants between. */
function facingPair(terrain: GameState['terrain'] = []): GameState {
  return createGame({
    seed: 0x1617,
    sides: [{ id: 'a' }, { id: 'b' }],
    terrain,
    ships: [
      createShipState({
        id: 'red',
        side: 'a',
        design: design({ id: 'red', name: 'Red' }),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
        velocity: 6,
      }),
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue' }),
        placement: { position: { x: 0, y: 20 }, facing: 12 },
        velocity: 0,
      }),
    ],
  })
}

describe('a rock in the way (17.1)', () => {
  it('stops a shot that would otherwise land', () => {
    // "Any line between two ships that crosses any part of the asteroid is
    // blocked. (Between center points of models, remember.)"
    const open = facingPair()
    advanceTo(open, 'ship-fire')
    expect(
      applyAction(open, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toBeUndefined()

    const blocked = facingPair([
      { id: 'rock', kind: 'planetoid', position: { x: 0, y: 10 }, radius: 4 },
    ])
    advanceTo(blocked, 'ship-fire')
    const shot = applyAction(blocked, {
      type: 'fire-weapon',
      shipId: 'red',
      weaponId: 'b1',
      targetId: 'blue',
    })
    expect(shot.refused).toContain('cover')
    expect(blocked.ships[1].hullMarked).toBe(0)
  })

  it('is only stopped by something solid', () => {
    // A dust cloud or an asteroid field is not something a shot stops at —
    // each has its own rule, and neither is line of fire.
    const cloud = facingPair([
      { id: 'murk', kind: 'nebula', position: { x: 0, y: 10 }, radius: 6 },
    ])
    advanceTo(cloud, 'ship-fire')
    expect(
      applyAction(cloud, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toBeUndefined()
  })

  it('does not block a line that misses it', () => {
    const offset = facingPair([
      { id: 'rock', kind: 'planetoid', position: { x: 30, y: 10 }, radius: 4 },
    ])
    advanceTo(offset, 'ship-fire')
    expect(
      applyAction(offset, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toBeUndefined()
  })

  it('refuses without spending the FireCon that shot would have needed', () => {
    // 4.4 spends a FireCon to engage a target, and a shot that cannot be taken
    // at all never engaged anything. Red has one FireCon, one gun and two
    // enemies: a mistaken click at the one behind the rock must leave the gun
    // free to shoot the one it can see.
    const game = createGame({
      seed: 0x1617,
      sides: [{ id: 'a' }, { id: 'b' }],
      terrain: [{ id: 'rock', kind: 'planetoid', position: { x: 0, y: 10 }, radius: 4 }],
      ships: [
        createShipState({
          id: 'red',
          side: 'a',
          design: design({ id: 'red', name: 'Red' }),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
          velocity: 0,
        }),
        createShipState({
          id: 'blue',
          side: 'b',
          design: design({ id: 'blue', name: 'Blue' }),
          placement: { position: { x: 0, y: 20 }, facing: 12 },
          velocity: 0,
        }),
        createShipState({
          id: 'green',
          side: 'b',
          design: design({ id: 'green', name: 'Green' }),
          placement: { position: { x: 20, y: 20 }, facing: 12 },
          velocity: 0,
        }),
      ],
    })
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
        .refused,
    ).toContain('cover')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'green' })
        .refused,
    ).toBeUndefined()
  })

  it('is something the computer knows about too', () => {
    // The computer allocating fire at a hull it cannot see wastes the FireCon
    // and the turn. planFire has to do the same geometry the action does.
    const rock: GameState['terrain'] = [
      { id: 'rock', kind: 'planetoid', position: { x: 0, y: 10 }, radius: 4 },
    ]
    const open = facingPair()
    expect(planFire(open, open.ships[0]).length).toBeGreaterThan(0)

    const blocked = facingPair(rock)
    expect(planFire(blocked, blocked.ships[0])).toEqual([])
  })

  it('is on the border skirmish table, so a player can actually use it', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 1 })
    expect(game.terrain.some((f) => f.kind === 'planetoid')).toBe(true)
  })
})

describe('ramming (16.7)', () => {
  it('is declared in orders and nowhere else', () => {
    const game = facingPair()
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, { type: 'plot-ram', shipId: 'red', targetId: 'blue' }).refused,
    ).toContain('orders')
  })

  it('will not be aimed at a friend', () => {
    const game = facingPair()
    expect(
      applyAction(game, { type: 'plot-ram', shipId: 'red', targetId: 'red' }).refused,
    ).toBeTruthy()
  })

  it('hurts both ships when it connects', () => {
    // Both totals come off the hull boxes each ship had before contact, and
    // both land at once — a rammer is as likely to die as its victim, which is
    // the whole character of the move.
    // A ram needs a 6 for nerve and then wins an evasion contest, so it
    // connects about one attempt in fourteen — enough seeds to be sure of
    // seeing some, and the assertion is about what happens when it does.
    let bothHurt = 0
    let anyContact = 0
    let attempted = 0
    for (let seed = 0; seed < 150; seed++) {
      const game = createGame({
        seed,
        sides: [{ id: 'a' }, { id: 'b' }],
        ships: [
          createShipState({
            id: 'red',
            side: 'a',
            design: design({ id: 'red', name: 'Red' }),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
            velocity: 0,
          }),
          createShipState({
            id: 'blue',
            side: 'b',
            design: design({ id: 'blue', name: 'Blue' }),
            // Close enough that the rammer arrives in contact.
            placement: { position: { x: 0, y: 0.5 }, facing: 12 },
            velocity: 0,
          }),
        ],
      })
      applyAction(game, { type: 'plot-ram', shipId: 'red', targetId: 'blue' })
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
      const [red, blue] = game.ships
      if (game.log.some((entry) => entry.text.includes('rams'))) attempted += 1
      if (red.hullMarked > 0 || blue.hullMarked > 0) {
        anyContact += 1
        if (red.hullMarked > 0 && blue.hullMarked > 0) bothHurt += 1
      }
    }
    expect(attempted, 'the ram was never even resolved').toBe(150)
    expect(anyContact, 'a hundred and fifty rams at point blank and none connected')
      .toBeGreaterThan(0)
    expect(bothHurt, 'a ram that only hurt one side').toBe(anyContact)
  })

  it('is forgotten at the top of the next turn', () => {
    // Declared fresh each turn, like every other written order.
    const game = facingPair()
    applyAction(game, { type: 'plot-ram', shipId: 'red', targetId: 'blue' })
    expect(game.ships[0].ramTargetId).toBe('blue')
    for (let i = 0; i < game.phases.length; i++) advancePhase(game)
    expect(game.ships[0].ramTargetId).toBeNull()
  })
})
