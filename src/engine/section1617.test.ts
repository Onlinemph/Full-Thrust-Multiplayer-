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

/**
 * Two ships side by side at the origin, both facing 12, with an enemy off the
 * starboard bow. Everything about them is identical except what the test does
 * to them, which is what makes "the roll changed this and nothing else"
 * something a test can say.
 */
function rollingPair(thrust = 4): GameState {
  const gun = design({
    id: 'portside',
    name: 'Portside',
    drive: { thrust, advanced: false },
    weapons: [
      {
        id: 'p1',
        label: 'Beam-3',
        weaponClass: 'beam',
        rating: 3,
        variant: 'standard',
        arcs: ['FP'],
        mass: 4,
        points: 12,
      },
    ],
  })
  return createGame({
    seed: 0x1602,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'roller',
        side: 'a',
        design: gun,
        placement: { position: { x: 0, y: 0 }, facing: 12 },
        velocity: 0,
      }),
      createShipState({
        id: 'control',
        side: 'a',
        design: gun,
        name: 'Control',
        placement: { position: { x: 0, y: 40 }, facing: 12 },
        velocity: 0,
      }),
      // Bearing 60° from the origin: off the starboard bow, so a port-only
      // battery cannot see it until the ship turns over.
      createShipState({
        id: 'target',
        side: 'b',
        design: design({ id: 'target', name: 'Target' }),
        placement: { position: { x: 17.32, y: -10 }, facing: 6 },
        velocity: 0,
      }),
    ],
  })
}

describe('rolling (16.2)', () => {
  it('spends a thrust point out of the turning allowance', () => {
    // The book's own worked example: "a thrust-4 ship, normally capable of 2
    // points of turn, could only turn 1 point if it also rolled that move; but
    // would still be able to use its other two thrust factors to accelerate".
    const game = rollingPair(4)
    applyAction(game, { type: 'plot-roll', shipId: 'roller', on: true })
    applyAction(game, { type: 'plot-turn', shipId: 'roller', direction: 'port', points: 1 })
    applyAction(game, { type: 'plot-accel', shipId: 'roller', accel: 2 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'roller' })

    const roller = game.ships[0]
    expect(roller.rollStatus.inverted, '1 + 1 + 2 is exactly thrust 4').toBe(true)
    expect(roller.velocity).toBe(2)
  })

  it('takes the second point of turn away from a thrust-4 ship', () => {
    // The other half of the worked example. A thrust-4 ship turns 2 points
    // ordinarily; with a roll written in the same order the second point is
    // refused at the moment the player asks for it, which is where they can
    // still change their mind.
    const plain = rollingPair(4)
    expect(
      applyAction(plain, { type: 'plot-turn', shipId: 'roller', direction: 'port', points: 2 })
        .refused,
    ).toBeUndefined()

    const rolling = rollingPair(4)
    applyAction(rolling, { type: 'plot-roll', shipId: 'roller', on: true })
    expect(
      applyAction(rolling, { type: 'plot-turn', shipId: 'roller', direction: 'port', points: 2 })
        .refused,
      'the roll spent the second point of the turning allowance (16.2)',
    ).toBe('turn-exceeded')
    expect(
      applyAction(rolling, { type: 'plot-turn', shipId: 'roller', direction: 'port', points: 1 })
        .refused,
      'one point still fits',
    ).toBeUndefined()
  })

  it('cannot be done by a ship with no thrust at all', () => {
    // A thrust-0 hull has no factor to spend, so the order is refused where it
    // is written rather than silently dropped at the moment it would happen.
    const game = rollingPair(0)
    expect(applyAction(game, { type: 'plot-roll', shipId: 'roller', on: true }).refused).toBe(
      'drive-disabled',
    )
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'roller' })
    expect(game.ships[0].rollStatus.inverted).toBe(false)
  })

  it('swaps which side the batteries bear to', () => {
    const game = rollingPair()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-weapon', shipId: 'roller', weaponId: 'p1', targetId: 'target' })
        .refused,
      'a port battery should not bear on a target off the starboard bow',
    ).toContain('arc')

    const rolled = rollingPair()
    applyAction(rolled, { type: 'plot-roll', shipId: 'roller', on: true })
    advanceTo(rolled, 'move-ships')
    applyAction(rolled, { type: 'move-ship', shipId: 'roller' })
    advanceTo(rolled, 'ship-fire')
    expect(rolled.ships[0].rollStatus.inverted).toBe(true)
    expect(
      applyAction(rolled, {
        type: 'fire-weapon',
        shipId: 'roller',
        weaponId: 'p1',
        targetId: 'target',
      }).refused,
      'inverted, the port battery bears to starboard (16.2)',
    ).toBeUndefined()
  })

  it('does not mirror the course change written for the model', () => {
    // "An order written for a port turn will still turn the model to the left,
    // even though to the inverted ship this would actually be a starboard
    // turn." The control ship turns the same way without rolling.
    const game = rollingPair()
    applyAction(game, { type: 'plot-roll', shipId: 'roller', on: true })
    applyAction(game, { type: 'plot-turn', shipId: 'roller', direction: 'port', points: 1 })
    applyAction(game, { type: 'plot-turn', shipId: 'control', direction: 'port', points: 1 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'roller' })
    applyAction(game, { type: 'move-ship', shipId: 'control' })

    expect(game.ships[0].rollStatus.inverted).toBe(true)
    expect(game.ships[0].placement.facing).toBe(game.ships[1].placement.facing)
  })

  it('stays inverted until the ship rolls back', () => {
    const game = rollingPair()
    applyAction(game, { type: 'plot-roll', shipId: 'roller', on: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'roller' })
    expect(game.ships[0].rollStatus.inverted).toBe(true)

    // Round the whole sequence and into the next turn: the per-turn reset
    // clears the order but not the attitude.
    const turn = game.turn
    while (game.turn === turn) advancePhase(game)
    expect(game.ships[0].order).toBeNull()
    expect(game.ships[0].rollStatus.inverted, 'an attitude is not a per-turn flag').toBe(true)

    applyAction(game, { type: 'plot-roll', shipId: 'roller', on: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'roller' })
    expect(game.ships[0].rollStatus.inverted, 'rolling back upright is the same manoeuvre').toBe(
      false,
    )
  })

  it('is something the computer reads before it allocates fire', () => {
    const upright = rollingPair()
    advanceTo(upright, 'ship-fire')
    expect(planFire(upright, upright.ships[0])).toEqual([])

    const rolled = rollingPair()
    applyAction(rolled, { type: 'plot-roll', shipId: 'roller', on: true })
    advanceTo(rolled, 'move-ships')
    applyAction(rolled, { type: 'move-ship', shipId: 'roller' })
    advanceTo(rolled, 'ship-fire')
    expect(planFire(rolled, rolled.ships[0]).length).toBeGreaterThan(0)
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
