import { describe, expect, it } from 'vitest'

import { applyAction, flakMarkers, type GameAction } from './actions'
import { aiActions } from './ai'
import {
  createGame,
  createShipState,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { flakCatchesPoint, FLAK_BLAST_RADIUS_MU } from './weapons/kinetics'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * 5.16's Flak barrage, from the gun to the shrapnel.
 *
 * `kinetics.ts` had the blast radius, the −1 DRM, the three marker ranges, the
 * class-2 gate, the ship-splinter roll and both catch tests, and no action
 * placed a Blast Marker: the whole rule was a set of pure functions with one
 * caller between them, which was another pure function.
 *
 * The thing worth testing is the one thing the rule is actually about. A
 * barrage is not a shot at a fighter, it is a tripwire laid across a move:
 * *"any fighter or missile travelling **through** or within 2 MU of the Blast
 * Marker"*. A wing that flies through and out the other side is caught, and
 * asking where it stopped would miss it.
 */

/**
 * Step the sequence through `applyAction`, not through `advancePhase`.
 *
 * The barrage is resolved at a phase boundary, and a phase boundary is an
 * action — a test that called `advancePhase` directly would walk straight past
 * the mines as well.
 */
function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

/**
 * A gun cruiser with Flak in its magazines.
 *
 * The roster ships carry no Flak: 5.16 sells it as a 2-point upgrade per gun
 * and the Shipyard is where a player buys it, so a design straight out of the
 * catalogue has `flak` unset on every mount. The test buys it here, on every
 * gun 5.16 will sell it for — which is what `partial-flak` makes a player do
 * as well.
 */
function flakCruiser(): ShipDesign {
  const design = structuredClone(designById('goliath-longgun')) as ShipDesign
  for (const weapon of design.weapons) {
    if (weapon.weaponClass === 'k-gun' && weapon.rating >= 2) weapon.flak = true
  }
  return design
}

function gunship(id: string, side: string, at: { x: number; y: number }, facing = 3): ShipState {
  return createShipState({
    id,
    side,
    design: flakCruiser(),
    placement: { position: at, facing: facing as ShipState['placement']['facing'] },
    velocity: 0,
  })
}

function flight(id: string, side: string, at: { x: number; y: number }): FighterGroupState {
  return {
    ...createFighterGroup({
      id,
      side,
      typeId: 'standard',
      position: at,
      facing: side === 'a' ? 3 : 9,
      status: 'in-flight',
    }),
    side,
    label: id,
    recoveredTurn: null,
    targetId: null,
    lastTargetId: null,
  } as FighterGroupState
}

function battle(
  opts: { ships?: ShipState[]; flights?: FighterGroupState[]; seed?: number } = {},
): GameState {
  return createGame({
    seed: opts.seed ?? 0x51a,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 72 },
    ships: opts.ships ?? [gunship('gun', 'a', { x: 20, y: 36 })],
    fighterGroups: opts.flights ?? [],
  })
}

const flightOf = (game: GameState, id: string): FighterGroupState =>
  game.fighterGroups.find((group) => group.id === id)!
const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

/** What the barrage did, as opposed to the line saying it went up. */
const flakLog = (game: GameState): string[] =>
  game.log
    .filter((entry) => entry.text.includes('Flak') && !entry.text.includes('throws a Flak'))
    .map((entry) => entry.text)

describe('placing a Blast Marker (5.16)', () => {
  it('goes up in phase 3 and nowhere else', () => {
    const game = battle()
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 36, y: 36 },
      }).refused,
    ).toMatch(/beginning of phase 3/)

    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 36, y: 36 },
      }).refused,
    ).toBeUndefined()
    expect(flakMarkers(game)).toHaveLength(1)
    expect(flakMarkers(game)[0].position).toEqual({ x: 36, y: 36 })
  })

  it('will not load a K-1, whatever the player fitted', () => {
    const game = battle()
    advanceTo(game, 'launch-missiles')
    // w2 is the LRK-1: 5.16 sells Flak to "K-Guns of class 2 or larger".
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w2',
        aimPoint: { x: 36, y: 36 },
      }).refused,
    ).toMatch(/class 2 or larger/)
  })

  it('will not fire a gun that has no Flak in it', () => {
    // The Hegemony's monitor and gun cruiser both carry Flak now, so the
    // negative case has to be a hull that did not buy it: 5.16 sells the
    // ammunition per ship, and most navies do not.
    const design = designById('esu-battleship') as ShipDesign
    const gun = design.weapons.find((w) => w.weaponClass === 'k-gun' && w.rating >= 2)!
    expect(gun.flak).toBeUndefined()
    const plain = createShipState({
      id: 'plain',
      side: 'a',
      design,
      placement: { position: { x: 20, y: 36 }, facing: 3 },
      velocity: 0,
    })
    const game = battle({ ships: [plain] })
    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'plain',
        weaponId: gun.id,
        aimPoint: { x: 32, y: 36 },
      }).refused,
    ).toMatch(/does not carry Flak/)
  })

  it('is on a ship a player can just pick out of the roster', () => {
    // 5.16 was invisible in every out-of-the-box game: the rule was wired end
    // to end and not one design in the roster carried the ammunition, so the
    // Barrage row never appeared and the computer never laid one.
    const monitor = designById('goliath-monitor') as ShipDesign
    const loaded = monitor.weapons.filter((w) => w.flak === true)
    expect(loaded.length).toBeGreaterThan(0)
    // "All the K-Guns on a ship (except K-1s) must be so equipped."
    for (const weapon of monitor.weapons) {
      if (weapon.weaponClass !== 'k-gun' || weapon.rating < 2) continue
      expect(weapon.flak).toBe(true)
    }
  })

  it('throws the marker as far as the line reaches and no further', () => {
    // "up to 24 MU away for long range guns" — the LRK-2 is a long gun.
    const reaches = battle()
    advanceTo(reaches, 'launch-missiles')
    expect(
      applyAction(reaches, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 44, y: 36 },
      }).refused,
    ).toBeUndefined()

    const beyond = battle()
    advanceTo(beyond, 'launch-missiles')
    expect(
      applyAction(beyond, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 45, y: 36 },
      }).refused,
    ).toMatch(/throws its barrage 24 MU/)
  })

  it('needs the point in the gun’s arc', () => {
    const game = battle()
    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 20, y: 20 },
      }).refused,
    ).toMatch(/does not bear/)
  })

  it('spends a FireCon per barrage', () => {
    // Two FireCons on the hull, and the two Flak guns point opposite ways, so
    // the second barrage is refused on arc rather than on FireCons. Knock one
    // FireCon out and the first barrage is the last one.
    const game = battle()
    shipOf(game, 'gun').destroyedSystems.add('firecon-1')
    shipOf(game, 'gun').destroyedSystems.add('firecon-2')
    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 36, y: 36 },
      }).refused,
    ).toMatch(/No FireCon free/)
  })

  it('will not fire the same gun twice in a turn', () => {
    const game = battle()
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 36, y: 36 },
    })
    expect(
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 30, y: 36 },
      }).refused,
    ).toMatch(/already fired/)
  })
})

describe('what the barrage catches (5.16)', () => {
  it('kills a wing that flies through it and out the far side', () => {
    const game = battle({ flights: [flight('wing', 'b', { x: 60, y: 36 })] })
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 44, y: 36 },
    })

    advanceTo(game, 'move-fighters')
    // 24 MU of move, straight down the lane. The wing passes clean through the
    // marker and finishes 16 MU past it — where nothing is standing.
    applyAction(game, { type: 'move-flight', flightId: 'wing', to: { x: 36, y: 36 } })
    const ended = flightOf(game, 'wing').position
    expect(flakCatchesPoint({ x: 44, y: 36 }, ended)).toBe(false)

    const before = flightOf(game, 'wing').strength
    advanceTo(game, 'allocate-attacks')
    expect(flightOf(game, 'wing').strength).toBeLessThan(before)
    expect(flakLog(game).some((text) => /Flak catches wing/.test(text))).toBe(true)
  })

  it('leaves a wing that never came near it alone', () => {
    const game = battle({ flights: [flight('wing', 'b', { x: 60, y: 10 })] })
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 44, y: 36 },
    })
    advanceTo(game, 'move-fighters')
    applyAction(game, { type: 'move-flight', flightId: 'wing', to: { x: 40, y: 10 } })
    const before = flightOf(game, 'wing').strength
    advanceTo(game, 'allocate-attacks')
    expect(flightOf(game, 'wing').strength).toBe(before)
    expect(flakLog(game)).toHaveLength(0)
  })

  it('does not ask whose fighters they are', () => {
    // "It is possible to affect multiple targets including your own ordnance
    // or fighters."
    const game = battle({ flights: [flight('escort', 'a', { x: 40, y: 36 })] })
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 40, y: 36 },
    })
    const before = flightOf(game, 'escort').strength
    advanceTo(game, 'allocate-attacks')
    expect(flightOf(game, 'escort').strength).toBeLessThan(before)
  })

  it('is gone by the next turn', () => {
    const game = battle({ flights: [flight('wing', 'b', { x: 60, y: 36 })] })
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 44, y: 36 },
    })
    nextTurn(game)
    expect(flakMarkers(game)).toHaveLength(0)

    // "All 'Blast Markers' are removed at the end of the turn" — so the same
    // flight path next turn is flown through empty space.
    const before = flightOf(game, 'wing').strength
    advanceTo(game, 'move-fighters')
    applyAction(game, { type: 'move-flight', flightId: 'wing', to: { x: 44, y: 36 } })
    advanceTo(game, 'allocate-attacks')
    expect(flightOf(game, 'wing').strength).toBe(before)
  })
})

describe('the barrage against hulls and salvoes (5.16)', () => {
  it('splinters a ship standing in the blast on a 1, and only on a 1', () => {
    // "If a ship, friendly or enemy, is within the blast range it will take a
    // single point of damage on a roll of 1." One die per ship, so the answer
    // is always nothing or exactly one box — never two, however big the gun.
    // Sixty battles is enough to see both faces of that and to catch a barrage
    // that had been rolling the gun's class in damage.
    const losses = new Set<number>()
    for (let seed = 0; seed < 60; seed++) {
      const game = battle({
        seed,
        ships: [gunship('gun', 'a', { x: 20, y: 36 }), gunship('victim', 'b', { x: 40, y: 36 })],
      })
      const start = shipOf(game, 'victim').hullMarked
      advanceTo(game, 'launch-missiles')
      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 40, y: 36 },
      })
      advanceTo(game, 'allocate-attacks')
      losses.add(shipOf(game, 'victim').hullMarked - start)
    }
    expect([...losses].sort()).toEqual([0, 1])
  })

  it('measures a ship where it stopped, not along its whole track', () => {
    // A hull is not a fighter: the rule reads "if a ship … is within the blast
    // range", which is a place, not a path.
    const runner = gunship('runner', 'b', { x: 60, y: 36 }, 9)
    runner.velocity = 24
    const game = battle({ ships: [gunship('gun', 'a', { x: 20, y: 36 }), runner] })
    const start = shipOf(game, 'runner').hullMarked
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'fire-flak-barrage',
      shipId: 'gun',
      weaponId: 'w1',
      aimPoint: { x: 44, y: 36 },
    })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'runner' })
    // Straight down the lane at 24: through x=44 and out to x=36.
    expect(shipOf(game, 'runner').placement.position.x).toBeCloseTo(36, 5)
    advanceTo(game, 'allocate-attacks')
    expect(shipOf(game, 'runner').hullMarked).toBe(start)
  })

  it('banks its kills on a salvo marker instead of shooting it down', () => {
    // 5.16 sends the count forward rather than resolving it: "do not roll for
    // the number of missiles that lock on until the Missile Attack Phase.
    // Simply roll to see how many hits the Flak barrage scores on the missile
    // marker and keep track of it." So the marker stays on the table with
    // fewer missiles on it, and 6.4 does the rest in phase 10.
    const seen: number[] = []
    for (let seed = 0; seed < 40; seed++) {
      const shooter = createShipState({
        id: 'shooter',
        side: 'b',
        design: designById('durani-corsair') as ShipDesign,
        placement: { position: { x: 62, y: 36 }, facing: 9 },
        velocity: 0,
      })
      const game = battle({
        seed,
        ships: [gunship('gun', 'a', { x: 20, y: 36 }), shooter],
      })
      const launcher = shooter.design.weapons.find((w) => w.weaponClass.includes('salvo'))!

      advanceTo(game, 'launch-missiles')
      applyAction(game, {
        type: 'launch-ordnance',
        shipId: 'shooter',
        weaponId: launcher.id,
        aimPoint: { x: 44, y: 36 },
      })
      expect(game.ordnance[0]?.missiles).toBe(6)

      applyAction(game, {
        type: 'fire-flak-barrage',
        shipId: 'gun',
        weaponId: 'w1',
        aimPoint: { x: 44, y: 36 },
      })
      advanceTo(game, 'allocate-attacks')
      const left = game.ordnance[0]?.missiles ?? 0
      seen.push(left)
      // A two-dice barrage cannot take more than the salvo has, and it never
      // fires the salvo off early: whatever survives is still a marker waiting
      // for phase 10.
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left).toBeLessThanOrEqual(6)
      if (left < 6) {
        expect(flakLog(game).some((text) => /subtracted when it locks on/.test(text))).toBe(true)
      }
    }
    // The whole point of the weapon: some of those forty salvoes came off
    // worse for flying into it.
    expect(seen.some((left) => left < 6)).toBe(true)
  })
})

describe('the computer laying a barrage (5.16)', () => {
  it('puts the shrapnel where an inbound wing is going to be', () => {
    const game = battle({
      ships: [gunship('gun', 'a', { x: 20, y: 36 })],
      flights: [flight('raid', 'b', { x: 44, y: 36 })],
    })
    advanceTo(game, 'launch-missiles')
    const barrages = aiActions(game, 'a').filter((act) => act.type === 'fire-flak-barrage')
    expect(barrages).toHaveLength(1)
    const shot = barrages[0] as Extract<GameAction, { type: 'fire-flak-barrage' }>
    // The wing is running at the gun cruiser and stops 6 MU short of it (8.7),
    // so the shrapnel goes on the lane between the two, not on the wing.
    expect(shot.aimPoint.x).toBeLessThan(44)
    expect(shot.aimPoint.x).toBeGreaterThan(20)
    expect(applyAction(game, shot).refused).toBeUndefined()
  })

  it('will not drop it on its own escort', () => {
    const game = battle({
      ships: [gunship('gun', 'a', { x: 20, y: 36 })],
      flights: [flight('raid', 'b', { x: 44, y: 36 }), flight('escort', 'a', { x: 26, y: 36 })],
    })
    advanceTo(game, 'launch-missiles')
    // The raid will stop 6 MU short of the cruiser, which is where the escort
    // is standing. 5.16 does not care whose fighters are in the blast, so the
    // computer holds its fire.
    expect(aiActions(game, 'a').filter((act) => act.type === 'fire-flak-barrage')).toHaveLength(0)
  })

  it('leaves the guns loaded when there is nothing flying', () => {
    const game = battle({ ships: [gunship('gun', 'a', { x: 20, y: 36 })] })
    advanceTo(game, 'launch-missiles')
    expect(aiActions(game, 'a').filter((act) => act.type === 'fire-flak-barrage')).toHaveLength(0)
  })
})

describe('the blast radius', () => {
  it('is 2 MU, inclusive', () => {
    expect(flakCatchesPoint({ x: 0, y: 0 }, { x: FLAK_BLAST_RADIUS_MU, y: 0 })).toBe(true)
    expect(flakCatchesPoint({ x: 0, y: 0 }, { x: FLAK_BLAST_RADIUS_MU + 0.01, y: 0 })).toBe(false)
  })
})
