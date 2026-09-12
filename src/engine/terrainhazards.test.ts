import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules } from './actions'
import { scoreOrder } from './ai'
import { advancePhase, createGame, createShipState, markHullBoxes, type GameState } from './game'
import { buildGame } from '../data/savedGame'
import type { MovementOrder, Phase, ShipDesign } from './types'

/**
 * Section 17 at the table.
 *
 * `terrain.test.ts` checks the rules; these check that a ship flying across the
 * board actually meets them. Until this landed, the planetoid in the middle of
 * the Border Skirmish map was pure benefit — it blocked shots and cost nothing
 * to fly through, so the best line was straight over the rock at any speed.
 *
 * All of it is behind `terrainHazards`, because section 17 opens by calling
 * itself *"mostly pure space opera"* and because every hazard draws a die: a
 * die drawn where an old battle file did not draw one shifts the RNG stream and
 * that file stops replaying.
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
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
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
 * One ship at the origin heading straight down the table at `velocity`, with
 * whatever is in the way 20 MU along the track.
 */
function runIn(
  velocity: number,
  terrain: GameState['terrain'],
  opts: { hazards?: boolean; thrust?: number; seed?: number } = {},
): GameState {
  const game = createGame({
    seed: opts.seed ?? 0x1706,
    sides: [{ id: 'a' }],
    terrain,
    ships: [
      createShipState({
        id: 'red',
        side: 'a',
        design: design({ id: 'red', name: 'Red', drive: { thrust: opts.thrust ?? 4, advanced: false } }),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
        velocity,
      }),
    ],
  })
  setOptionalRules(game, { terrainHazards: opts.hazards ?? true })
  return game
}

/**
 * 7 MU down the track and 3 MU across, so that every velocity in these tests
 * actually crosses it — a rock the plot stops short of proves nothing, and a
 * test that never reaches its own terrain passes for the wrong reason.
 */
const ROCK: GameState['terrain'] = [
  { id: 'rock', kind: 'planetoid', position: { x: 0, y: 7 }, radius: 3, label: 'the rock' },
]

describe('flying into a rock (17.6)', () => {
  it('destroys the ship when the avoidance number is above 6', () => {
    // "Subtract the ship's total available thrust rating from its current
    // velocity… If the number is greater than 6, then a crash is inevitable."
    // Velocity 30, thrust 4: 26, and no die is thrown at all.
    const game = runIn(30, ROCK, { thrust: 4 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].destroyed).toBe(true)
    expect(game.log.some((e) => e.kind === 'destroyed' && e.text.includes('17.6'))).toBe(true)
  })

  it('lets a slow ship through without a die', () => {
    // Velocity 5, thrust 4: avoidance number 1, "1 or less" is automatic.
    const game = runIn(5, ROCK, { thrust: 4 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].destroyed).toBe(false)
  })

  it('is a coin toss in between, and the coin is the seeded die', () => {
    // Velocity 8, thrust 4: 4+ to miss. Two seeds, two answers, and the same
    // seed twice gives the same answer — which is the whole architecture.
    const outcomes = new Set<boolean>()
    for (let seed = 1; seed <= 40; seed++) {
      const game = runIn(8, ROCK, { thrust: 4, seed })
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
      outcomes.add(game.ships[0].destroyed)
    }
    expect(outcomes, 'forty seeds should give both answers').toEqual(new Set([true, false]))

    const once = runIn(8, ROCK, { thrust: 4, seed: 3 })
    const twice = runIn(8, ROCK, { thrust: 4, seed: 3 })
    for (const game of [once, twice]) {
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
    }
    expect(once.ships[0].destroyed).toBe(twice.ships[0].destroyed)
  })

  it('does nothing at all with the hazards switched off', () => {
    const game = runIn(30, ROCK, { hazards: false })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].destroyed).toBe(false)
  })

  it('draws no dice with the hazards switched off, so an old battle still replays', () => {
    // The reason the flag exists. Two identical games, one flying past terrain
    // and one over open space: with the hazards off the dice must be in the
    // same place in the stream afterwards.
    const bare = runIn(30, [], { hazards: false })
    const rocky = runIn(30, ROCK, { hazards: false })
    for (const game of [bare, rocky]) {
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
    }
    expect(rocky.rng.next()).toBe(bare.rng.next())
  })

  it('stops the ship before it can go on to ram anything', () => {
    const game = runIn(30, ROCK)
    // A second hull to aim at, well past the rock.
    game.ships.push(
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue' }),
        placement: { position: { x: 0, y: 30 }, facing: 12 },
        velocity: 0,
      }),
    )
    game.sides.push({ id: 'b', name: 'b', team: 'b' })
    applyAction(game, { type: 'plot-ram', shipId: 'red', targetId: 'blue' })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].destroyed).toBe(true)
    expect(game.ships[1].hullMarked, 'a dead ship rams nobody').toBe(0)
  })
})

describe('crossing a cloud (17.2) and a field (17.4)', () => {
  const CLOUD: GameState['terrain'] = [
    { id: 'murk', kind: 'nebula', position: { x: 0, y: 10 }, radius: 6, label: 'the murk' },
  ]
  const FIELD: GameState['terrain'] = [
    { id: 'rubble', kind: 'asteroid-field', position: { x: 0, y: 10 }, radius: 6 },
  ]

  it('costs nothing at or below the 12 MU safe velocity', () => {
    const game = runIn(12, CLOUD)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].hullMarked).toBe(0)
  })

  it('costs a die above it', () => {
    const marked = new Set<number>()
    for (let seed = 1; seed <= 12; seed++) {
      const game = runIn(20, CLOUD, { seed })
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
      marked.add(game.ships[0].hullMarked)
    }
    expect([...marked].some((m) => m > 0), 'twelve seeds and never a scratch?').toBe(true)
  })

  it('charges a field one die per full 6 MU, straight through armour', () => {
    // Velocity 18 is three dice, and 17.4's faces are the damage: at least 3.
    const armoured = createGame({
      seed: 5,
      sides: [{ id: 'a' }],
      terrain: FIELD,
      ships: [
        createShipState({
          id: 'red',
          side: 'a',
          design: design({
            id: 'red',
            name: 'Red',
            armour: { layers: [10], regenerative: false },
          }),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
          velocity: 18,
        }),
      ],
    })
    setOptionalRules(armoured, { terrainHazards: true })
    advanceTo(armoured, 'move-ships')
    applyAction(armoured, { type: 'move-ship', shipId: 'red' })
    expect(armoured.ships[0].hullMarked, '17.4 is penetrating: armour does not stop it').toBeGreaterThanOrEqual(3)
    expect(armoured.ships[0].armourMarked[0], 'and it does not touch the armour either').toBe(0)
  })
})

describe('the computer', () => {
  /** Red closing on an enemy 40 MU dead ahead, with a rock in between. */
  function chase(hazards: boolean): GameState {
    const game = runIn(8, ROCK, { hazards })
    game.sides.push({ id: 'b', name: 'b', team: 'b' })
    game.ships.push(
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue' }),
        placement: { position: { x: 0, y: 40 }, facing: 12 },
        velocity: 0,
      }),
    )
    return game
  }

  const STRAIGHT_ON: MovementOrder = { turn: null, accel: 0 }
  const SWERVE: MovementOrder = { turn: { direction: 'port', points: 2 }, accel: 0 }

  it('charges an order for the rock it flies through, and only that order', () => {
    const off = chase(false)
    const on = chase(true)

    const straightOff = scoreOrder(off, off.ships[0], off.ships[1], STRAIGHT_ON)
    const straightOn = scoreOrder(on, on.ships[0], on.ships[1], STRAIGHT_ON)
    const swerveOff = scoreOrder(off, off.ships[0], off.ships[1], SWERVE)
    const swerveOn = scoreOrder(on, on.ships[0], on.ships[1], SWERVE)

    // Velocity 8 against thrust 4 needs a 4 to miss, so half the time the ship
    // simply stops existing — which is worth a great deal more than range.
    expect(straightOn, 'the line through the rock got dearer').toBeLessThan(straightOff - 400)
    expect(swerveOn, 'the line around it did not').toBe(swerveOff)
  })

  it('will not write an order that certainly kills it', () => {
    // Velocity 30 against thrust 4 is an avoidance number of 26, which 17.6
    // calls inevitable. Nothing else the scorer weighs — range, arcs, the table
    // edge — is on that scale, so no plot through the rock can ever win.
    const on = chase(true)
    on.ships[0].velocity = 30
    const off = chase(false)
    off.ships[0].velocity = 30
    const certain =
      scoreOrder(off, off.ships[0], off.ships[1], STRAIGHT_ON) -
      scoreOrder(on, on.ships[0], on.ships[1], STRAIGHT_ON)
    expect(certain).toBeGreaterThanOrEqual(1000)
  })
})

describe('the border skirmish', () => {
  it('is played with the hazards on when a new battle starts', () => {
    // Not a rule, a default: the scenario is built around one rock and the rock
    // ought to do something.
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 1, terrainHazards: true })
    expect(game.terrain.some((f) => f.kind === 'planetoid')).toBe(true)
  })
})

describe('shooting through dust (17.2 rules 2 and 3)', () => {
  const MURK: GameState['terrain'] = [
    { id: 'murk', kind: 'nebula', position: { x: 36, y: 24 }, radius: 8, label: 'the murk' },
  ]

  function gunnery(terrain: GameState['terrain'], hazards = true): GameState {
    const game = createGame({
      seed: 0x1702,
      sides: [{ id: 'a' }, { id: 'b' }],
      terrain,
      ships: [
        createShipState({
          id: 'red',
          side: 'a',
          design: design({
            id: 'red',
            name: 'Red',
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
              {
                id: 'b2',
                label: 'Beam-2',
                weaponClass: 'beam',
                rating: 2,
                variant: 'standard',
                arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
                mass: 3,
                points: 9,
              },
            ],
            systems: [
              { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
              { id: 'fc2', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
            ],
          }),
          placement: { position: { x: 36, y: 20 }, facing: 6 },
          velocity: 0,
        }),
        createShipState({
          id: 'blue',
          side: 'b',
          design: design({ id: 'blue', name: 'Blue' }),
          placement: { position: { x: 36, y: 28 }, facing: 12 },
          velocity: 0,
        }),
      ],
    })
    setOptionalRules(game, { terrainHazards: hazards })
    return game
  }

  it('blinds a ship sitting in it as much as it hides one', () => {
    // Over enough seeds the die goes both ways; with no cloud it never does.
    const withCloud = new Set<boolean>()
    for (let seed = 1; seed <= 24; seed++) {
      const game = gunnery(MURK)
      advanceTo(game, 'ship-fire')
      game.rng = new (game.rng.constructor as new (s: number) => typeof game.rng)(seed)
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
      withCloud.add(game.log.some((e) => e.text.includes('cannot see')))
    }
    expect(withCloud, 'a 1-3 blocks the lock, a 4-6 does not').toEqual(new Set([true, false]))

    const clear = gunnery([])
    advanceTo(clear, 'ship-fire')
    applyAction(clear, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
    expect(clear.log.some((e) => e.text.includes('cannot see'))).toBe(false)
  })

  it('rolls once per nomination, not once per gun', () => {
    // "Roll a D6 after nominating the target." A ship with two mounts does not
    // get two chances at the same hull through the same cloud.
    for (let seed = 1; seed <= 12; seed++) {
      const game = gunnery(MURK)
      advanceTo(game, 'ship-fire')
      game.rng = new (game.rng.constructor as new (s: number) => typeof game.rng)(seed)
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
      const firstBlocked = game.log.some((e) => e.text.includes('cannot see'))
      applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b2', targetId: 'blue' })
      const blocked = game.log.filter((e) => e.text.includes('cannot see')).length
      expect(blocked, `seed ${seed}`).toBe(firstBlocked ? 2 : 0)
    }
  })

  it('does nothing at all with the hazards switched off', () => {
    const game = gunnery(MURK, false)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-weapon', shipId: 'red', weaponId: 'b1', targetId: 'blue' })
    expect(game.log.some((e) => e.text.includes('cannot see'))).toBe(false)
  })
})

describe('battle debris (17.5)', () => {
  /** A cruiser about to be overkilled by a much bigger one. */
  function overkill(hull: number, hazards = true): GameState {
    const game = createGame({
      seed: 0x1705,
      sides: [{ id: 'a' }, { id: 'b' }],
      ships: [
        createShipState({
          id: 'red',
          side: 'a',
          design: design({ id: 'red', name: 'Red' }),
          placement: { position: { x: 36, y: 20 }, facing: 6 },
          velocity: 4,
        }),
        createShipState({
          id: 'blue',
          side: 'b',
          design: design({ id: 'blue', name: 'Blue', hullBoxes: hull }),
          placement: { position: { x: 36, y: 24 }, facing: 12 },
          velocity: 0,
        }),
      ],
    })
    setOptionalRules(game, { terrainHazards: hazards })
    return game
  }

  it('records the overkill on the blow that did it', () => {
    const game = overkill(4)
    markHullBoxes(game.ships[1], 10)
    expect(game.ships[1].destroyed).toBe(true)
    expect(game.ships[1].excessDamage, '10 into 4 boxes is 6 over').toBe(6)
  })

  it('records nothing for a ship brought to exactly zero', () => {
    // "A die roll of 5 - 2 = 3 or less will cause it to explode" — and a D6
    // cannot roll at or below zero, so exact is safe.
    const game = overkill(4)
    markHullBoxes(game.ships[1], 4)
    expect(game.ships[1].destroyed).toBe(true)
    expect(game.ships[1].excessDamage).toBe(0)
    applyAction(game, { type: 'advance-phase' })
    expect(game.terrain.some((f) => f.kind === 'debris')).toBe(false)
  })

  it('leaves a cloud where a badly overkilled hull was', () => {
    const game = overkill(2)
    markHullBoxes(game.ships[1], 8)
    applyAction(game, { type: 'advance-phase' })
    expect(game.terrain.some((f) => f.id === 'debris-blue')).toBe(true)
    expect(game.log.some((e) => e.text.includes('17.5'))).toBe(true)
  })

  it('makes the cloud a meteor field for anything that flies into it', () => {
    // 17.5: "any ship encountering the cloud treats it exactly as for the
    // meteor and debris rules given in the section above."
    const game = overkill(2)
    markHullBoxes(game.ships[1], 8)
    applyAction(game, { type: 'advance-phase' })
    const cloud = game.terrain.find((f) => f.id === 'debris-blue')
    expect(cloud).toBeDefined()
    game.ships[0].placement = { position: { ...cloud!.position }, facing: 6 }
    game.ships[0].velocity = 18
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].hullMarked, 'three dice of penetrating rock').toBeGreaterThanOrEqual(3)
  })

  it('lasts one turn and then it is gone', () => {
    const game = overkill(2)
    markHullBoxes(game.ships[1], 8)
    applyAction(game, { type: 'advance-phase' })
    expect(game.terrain.some((f) => f.id === 'debris-blue')).toBe(true)

    // "The debris cloud exists for only 1 turn after the explosion." It is
    // swept as the movement phase opens, because that is the phase it is
    // dangerous in — clearing it at the turn boundary would kill it before it
    // ever threatened anybody.
    let guard = 60
    while (!(game.turn === 2 && game.phase === 'move-ships') && guard-- > 0) {
      applyAction(game, { type: 'advance-phase' })
    }
    expect(game.terrain.some((f) => f.id === 'debris-blue'), 'dangerous on turn 2').toBe(true)

    while (!(game.turn === 3 && game.phase === 'move-ships') && guard-- > 0) {
      applyAction(game, { type: 'advance-phase' })
    }
    expect(game.terrain.some((f) => f.id === 'debris-blue'), 'and gone on turn 3').toBe(false)
  })

  it('does nothing at all with the hazards switched off', () => {
    const game = overkill(2, false)
    markHullBoxes(game.ships[1], 8)
    applyAction(game, { type: 'advance-phase' })
    expect(game.terrain.some((f) => f.kind === 'debris')).toBe(false)
  })
})

describe('a gravity well (17.9)', () => {
  const GIANT: GameState['terrain'] = [
    {
      id: 'giant',
      kind: 'planet',
      position: { x: 36, y: 24 },
      radius: 4,
      label: 'the giant',
      gravity: { zoneWidth: 2 },
    },
  ]

  /** One ship crossing the table with the planet off one bow or the other. */
  function pass(from: { x: number; y: number }, facing: 1 | 3 | 6 | 9 | 12, velocity = 10, hazards = true): GameState {
    const game = createGame({
      seed: 0x1709,
      sides: [{ id: 'a' }],
      terrain: GIANT,
      ships: [
        createShipState({
          id: 'red',
          side: 'a',
          design: design({ id: 'red', name: 'Red' }),
          placement: { position: from, facing },
          velocity,
        }),
      ],
    })
    setOptionalRules(game, { terrainHazards: hazards })
    return game
  }

  it('holds a diving ship over to the start of its next move', () => {
    // "If the center is in the fore arc of the ship, add the zone strength to
    // the ship velocity" — and a ship still pointed at the planet is by
    // definition still inside the well, so 17.9's other clause applies too:
    // "if the ship ends the Ship Movement Phase in a gravity zone, apply the
    // changes ... to the start of the next turn movement instead."
    const game = pass({ x: 36, y: 4 }, 6, 12)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.log.some((e) => e.text.includes('fore arc'))).toBe(false)
    const held = game.ships[0].pendingGravity
    expect(held, 'the ship is still in the well').not.toBeNull()
    expect(held!.velocity, 'the planet is pulling it in').toBeGreaterThan(12)

    const turn = game.turn
    while (game.turn === turn) advancePhase(game)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.log.some((e) => e.text.includes('carried round'))).toBe(true)
  })

  it('takes from one running away from it', () => {
    // "If the center is in the aft arc, subtract the zone strength from
    // velocity."
    const game = pass({ x: 36, y: 32 }, 6, 12)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.log.some((e) => e.text.includes('aft arc'))).toBe(true)
    expect(game.ships[0].velocity).toBeLessThan(12)
  })

  it('swings one that passes abeam, and calls that a partial orbit', () => {
    // "If the center is in a port or starboard arc, add half the zone strength
    // to the velocity, and turn the ship towards the center."
    const game = pass({ x: 26, y: 10 }, 6, 28)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.log.some((e) => e.text.includes('port arc'))).toBe(true)
    expect(game.ships[0].placement.facing, 'bent towards the planet').not.toBe(6)
    expect(game.log.some((e) => e.text.includes('partial orbit'))).toBe(true)
  })

  it('lets a player spend leftover thrust arguing with the turn', () => {
    const unassisted = pass({ x: 26, y: 10 }, 6, 28)
    advanceTo(unassisted, 'move-ships')
    applyAction(unassisted, { type: 'move-ship', shipId: 'red' })

    const fought = pass({ x: 26, y: 10 }, 6, 28)
    applyAction(fought, { type: 'plot-gravity-turn', shipId: 'red', points: 0 })
    advanceTo(fought, 'move-ships')
    applyAction(fought, { type: 'move-ship', shipId: 'red' })
    expect(
      fought.ships[0].placement.facing,
      'thrust spent cancelling the swing leaves the bow where it was',
    ).not.toBe(unassisted.ships[0].placement.facing)
  })

  it('does nothing at all with the hazards switched off', () => {
    const game = pass({ x: 36, y: 32 }, 6, 12, false)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].velocity).toBe(12)
    expect(game.ships[0].pendingGravity).toBeNull()
  })

  it('is on a scenario, so a player can actually meet one', () => {
    const game = buildGame({ scenarioId: 'gravity-well', seed: 1 })
    expect(game.terrain.some((f) => f.gravity !== undefined)).toBe(true)
  })
})
