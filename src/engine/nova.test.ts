import { describe, expect, it } from 'vitest'

import {
  applyAction,
  endPhase,
  novaArmedOn,
  novaBursts,
  setRulesReading,
} from './actions'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { aiActions } from './ai'
import {
  createGame,
  createShipState,
  hullRemaining,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { NOVA_SWEEPS } from './ew'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * 7.23's Spinal Mount Nova Cannon, from the order to the burn-out.
 *
 * `ew.ts` had the whole rule — the three sweeps, the arming, the power-down
 * list, the contact test, the damage dice — as pure functions, and a
 * `WeaponSpec` registered in the weapon table that `fire-weapon` would have
 * resolved as an ordinary single-target shot at whatever range the ship
 * happened to be from its victim. Nothing armed it, nothing put a template on
 * the table, and no ship ever powered anything down.
 *
 * The Mercator-class Dreadnought in the roster carries one.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) endPhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) endPhase(game)
}

const NOVA_SHIP = 'goliath-dreadnought'

function novaShip(id: string, side: string, at: { x: number; y: number }, velocity = 0): ShipState {
  return createShipState({
    id,
    side,
    design: designById(NOVA_SHIP) as ShipDesign,
    placement: { position: at, facing: 3 },
    velocity,
  })
}

function victim(id: string, side: string, at: { x: number; y: number }): ShipState {
  return createShipState({
    id,
    side,
    design: designById('goliath-battleship') as ShipDesign,
    placement: { position: at, facing: 9 },
    velocity: 0,
  })
}

function flight(id: string, side: string, at: { x: number; y: number }): FighterGroupState {
  return {
    ...createFighterGroup({ id, side, typeId: 'standard', position: at, facing: 9, status: 'in-flight' }),
    side,
    label: id,
    recoveredTurn: null,
    targetId: null,
    lastTargetId: null,
  } as FighterGroupState
}

function battle(opts: { ships?: ShipState[]; flights?: FighterGroupState[]; seed?: number } = {}): GameState {
  return createGame({
    seed: opts.seed ?? 0x7023,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 200, height: 120 },
    ships: opts.ships ?? [novaShip('nova', 'a', { x: 20, y: 60 })],
    fighterGroups: opts.flights ?? [],
  })
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!
const flightOf = (game: GameState, id: string): FighterGroupState =>
  game.fighterGroups.find((g) => g.id === id)!

/** The Mercator's cannon. Every test arms this one. */
const CANNON = (game: GameState, id = 'nova'): string =>
  shipOf(game, id).design.weapons.find((w) => w.weaponClass === 'nova-cannon')!.id

function arm(game: GameState, id = 'nova'): void {
  advanceTo(game, 'orders')
  applyAction(game, { type: 'arm-nova-cannon', shipId: id, weaponId: CANNON(game, id), on: true })
}

function fire(game: GameState, id = 'nova'): void {
  advanceTo(game, 'ship-fire')
  applyAction(game, { type: 'fire-nova-cannon', shipId: id, weaponId: CANNON(game, id) })
}

describe('arming the Nova Cannon (7.23)', () => {
  it('is an order, written in phase 1', () => {
    const game = battle()
    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'arm-nova-cannon',
        shipId: 'nova',
        weaponId: CANNON(game),
        on: true,
      }).refused,
    ).toMatch(/orders/)
  })

  it('will not arm a gun that is not a Nova Cannon', () => {
    const game = battle()
    advanceTo(game, 'orders')
    const beam = shipOf(game, 'nova').design.weapons.find((w) => w.weaponClass !== 'nova-cannon')!
    expect(
      applyAction(game, {
        type: 'arm-nova-cannon',
        shipId: 'nova',
        weaponId: beam.id,
        on: true,
      }).refused,
    ).toMatch(/not a Nova Cannon/)
  })

  it('tears up the movement order it was written beside', () => {
    const game = battle()
    advanceTo(game, 'orders')
    // The Mercator has thrust 2, and a turn point costs one of it.
    applyAction(game, { type: 'plot-turn', shipId: 'nova', direction: 'starboard', points: 1 })
    applyAction(game, { type: 'plot-accel', shipId: 'nova', accel: 1 })
    expect(shipOf(game, 'nova').order?.accel).toBe(1)

    applyAction(game, { type: 'arm-nova-cannon', shipId: 'nova', weaponId: CANNON(game), on: true })
    expect(shipOf(game, 'nova').order?.accel).toBe(0)
    expect(shipOf(game, 'nova').order?.turn ?? null).toBeNull()
  })

  it('refuses every order written after it', () => {
    const game = battle()
    arm(game)
    expect(
      applyAction(game, { type: 'plot-accel', shipId: 'nova', accel: 2 }).refused,
    ).toMatch(/may not expend any other power/)
  })

  it('holds the ship on course whatever its velocity', () => {
    const game = battle({ ships: [novaShip('nova', 'a', { x: 20, y: 60 }, 8)] })
    arm(game)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'nova' })
    // Course 3 is toward increasing x, and 8 MU of velocity is still 8 MU: the
    // ship coasts, it just cannot steer or accelerate.
    expect(shipOf(game, 'nova').placement.position.x).toBeCloseTo(28, 5)
    expect(shipOf(game, 'nova').placement.facing).toBe(3)
  })

  it('stops the ship firing anything else', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    arm(game)
    advanceTo(game, 'ship-fire')
    const gun = shipOf(game, 'nova').design.weapons.find(
      (w) => w.weaponClass !== 'nova-cannon',
    )!
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'nova',
        weaponId: gun.id,
        targetId: 'mark',
      }).refused,
    ).toMatch(/may not expend any other power/)
  })

  it('can be stood down again, and the ship gets its power back', () => {
    const game = battle()
    arm(game)
    expect(novaArmedOn(game, shipOf(game, 'nova'))).toBe(true)
    applyAction(game, { type: 'arm-nova-cannon', shipId: 'nova', weaponId: CANNON(game), on: false })
    expect(novaArmedOn(game, shipOf(game, 'nova'))).toBe(false)
    expect(applyAction(game, { type: 'plot-accel', shipId: 'nova', accel: 2 }).refused).toBeUndefined()
  })

  it('is lost at the end of a turn it did not fire in', () => {
    const game = battle()
    arm(game)
    nextTurn(game)
    expect(novaArmedOn(game, shipOf(game, 'nova'))).toBe(false)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-nova-cannon', shipId: 'nova', weaponId: CANNON(game) }).refused,
    ).toMatch(/not armed/)
    expect(game.log.some((entry) => /the arming is lost/.test(entry.text))).toBe(true)
  })
})

describe('the shot (7.23)', () => {
  it('will not fire unarmed', () => {
    const game = battle()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-nova-cannon', shipId: 'nova', weaponId: CANNON(game) }).refused,
    ).toMatch(/not armed in this turn/)
  })

  it('burns a hull standing 12 MU down the bow line', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    const start = hullRemaining(shipOf(game, 'mark'))
    arm(game)
    fire(game)
    // 6D6 of penetrating damage averages 21, and the Hegemon has 64 boxes: it
    // survives, and it knows about it.
    expect(hullRemaining(shipOf(game, 'mark'))).toBeLessThan(start)
    expect(game.log.some((entry) => /caught by the nova/.test(entry.text))).toBe(true)
  })

  it('does not reach a hull inside the minimum arming distance', () => {
    // "hurled out to 6 MU in front of the ship (its minimum arming distance)":
    // the round is not live until it gets there.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('close', 'b', { x: 23, y: 60 })],
    })
    const start = hullRemaining(shipOf(game, 'close'))
    arm(game)
    fire(game)
    expect(hullRemaining(shipOf(game, 'close'))).toBe(start)
  })

  it('misses a hull two MU off the centre line on the first sweep', () => {
    // A 2 MU template has a 1 MU radius. 7.23 fires "not just through the fore
    // arc, but actually on the center line of the ship only".
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('wide', 'b', { x: 32, y: 62 })],
    })
    const start = hullRemaining(shipOf(game, 'wide'))
    arm(game)
    fire(game)
    expect(hullRemaining(shipOf(game, 'wide'))).toBe(start)
  })

  it('takes a fighter group out of the sky', () => {
    const game = battle({ flights: [flight('wing', 'b', { x: 34, y: 60 })] })
    arm(game)
    fire(game)
    expect(flightOf(game, 'wing').status).toBe('destroyed')
  })

  it('ignores screens and armour', () => {
    // The Hegemon carries 14 and 7 boxes of armour and no screens; the roll is
    // reported entirely as penetrating, so every point reaches the hull. The
    // proof is that the armour is untouched and the hull is not.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    arm(game)
    fire(game)
    const hit = shipOf(game, 'mark')
    expect(hit.armourMarked.every((marked) => marked === 0)).toBe(true)
    expect(hit.hullMarked).toBeGreaterThan(0)
  })
})

describe('the template on the table (7.23)', () => {
  it('sweeps outward one generation a turn and then burns out', () => {
    const game = battle()
    arm(game)
    fire(game)
    expect(novaBursts(game)).toHaveLength(1)
    expect(novaBursts(game)[0].stage).toBe(1)

    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(novaBursts(game)[0].stage).toBe(2)

    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(novaBursts(game)[0].stage).toBe(3)

    // "At the end of the third turn of movement the nova reaction exhausts its
    // fuel and burns out — the template is removed from play."
    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(novaBursts(game)).toHaveLength(0)
  })

  it('catches on the second turn what it flew past on the first', () => {
    // 36 MU out is beyond the first sweep's 24 and inside the second's 24-48.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('far', 'b', { x: 56, y: 60 })],
    })
    arm(game)
    fire(game)
    expect(hullRemaining(shipOf(game, 'far'))).toBe(shipOf(game, 'far').design.hullBoxes)

    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(hullRemaining(shipOf(game, 'far'))).toBeLessThan(shipOf(game, 'far').design.hullBoxes)
  })

  it('measures from where the ship stood when it fired, not from the ship', () => {
    // The template is "left in place on the table" while the ship flies on, so
    // a hull 36 MU ahead of the firing point is caught on turn two even though
    // the ship has since moved 16 MU up the same line.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }, 8), victim('far', 'b', { x: 56, y: 60 })],
    })
    arm(game)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'nova' })
    fire(game)
    const laid = novaBursts(game)[0]
    expect(laid.origin.x).toBeCloseTo(28, 5)

    nextTurn(game)
    advanceTo(game, 'ship-fire')
    // The burst has not moved with the ship: its origin is still turn one's.
    expect(novaBursts(game)[0].origin.x).toBeCloseTo(28, 5)
  })

  it('does not ask whose ship it is', () => {
    // 7.23 says "any and all ships or other objects that are contacted by the
    // template during its flight", and means it.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('friend', 'a', { x: 32, y: 60 })],
    })
    const start = hullRemaining(shipOf(game, 'friend'))
    arm(game)
    fire(game)
    expect(hullRemaining(shipOf(game, 'friend'))).toBeLessThan(start)
  })
})

describe('the screens (7.23)', () => {
  it('do not function on the turn the cannon is armed', () => {
    // "Even its screens do not function for that turn!" The rule is only
    // visible from the outside: the same shot, at the same hull, over the same
    // forty seeds, does strictly more damage when the target has armed.
    const screenedNova = (): ShipDesign => {
      const base = designById(NOVA_SHIP) as ShipDesign
      return {
        ...base,
        screens: { level: 2, generators: 2, advanced: false },
        systems: [
          ...base.systems,
          { id: 'screen-1', kind: 'screen-generator', label: 'Screen', mass: 1, points: 3 },
          { id: 'screen-2', kind: 'screen-generator', label: 'Screen', mass: 1, points: 3 },
        ],
      }
    }

    const play = (armed: boolean): number => {
      let total = 0
      for (let seed = 0; seed < 40; seed++) {
        const shield = createShipState({
          id: 'shield',
          side: 'a',
          design: screenedNova(),
          placement: { position: { x: 20, y: 60 }, facing: 3 },
          velocity: 0,
        })
        // A beam shooter, deliberately: 4.7's screens are the beam table's,
        // and the Mercator's own K-Guns would have gone through a Standard
        // Screen either way and proved nothing.
        const gunner = createShipState({
          id: 'gun',
          side: 'b',
          design: designById('esu-heavy-cruiser') as ShipDesign,
          placement: { position: { x: 26, y: 60 }, facing: 9 },
          velocity: 0,
        })
        const game = battle({ ships: [shield, gunner], seed })
        if (armed) arm(game, 'shield')
        advanceTo(game, 'ship-fire')
        for (const gun of shipOf(game, 'gun').design.weapons) {
          if (!gun.arcs.includes('F')) continue
          applyAction(game, {
            type: 'fire-weapon',
            shipId: 'gun',
            weaponId: gun.id,
            targetId: 'shield',
          })
        }
        const hit = shipOf(game, 'shield')
        total += hit.hullMarked + hit.armourMarked.reduce((sum, marked) => sum + marked, 0)
      }
      return total
    }

    const bare = play(true)
    const covered = play(false)
    expect(covered).toBeGreaterThan(0)
    expect(bare).toBeGreaterThan(covered)
  })
})

describe('the computer and the Nova Cannon (7.23)', () => {
  it('arms it when a hull is on the bow line and worth the turn', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 36, y: 60 })],
    })
    advanceTo(game, 'orders')
    const orders = aiActions(game, 'a')
    expect(orders.some((act) => act.type === 'arm-nova-cannon')).toBe(true)
    // Arming instead of steering: 7.23 would tear up any course anyway.
    expect(orders.some((act) => act.type === 'plot-turn' && act.shipId === 'nova')).toBe(false)
  })

  it('leaves it cold when the line is empty', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('side', 'b', { x: 36, y: 100 })],
    })
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'arm-nova-cannon')).toBe(false)
  })

  it('will not fire through its own fleet', () => {
    const game = battle({
      ships: [
        novaShip('nova', 'a', { x: 20, y: 60 }),
        victim('mark', 'b', { x: 36, y: 60 }),
        victim('escort', 'a', { x: 50, y: 60 }),
      ],
    })
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'arm-nova-cannon')).toBe(false)
  })

  it('fires the cannon it armed, and fires nothing else', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    arm(game)
    advanceTo(game, 'ship-fire')
    const shots = aiActions(game, 'a')
    expect(shots.some((act) => act.type === 'fire-nova-cannon')).toBe(true)
    expect(shots.some((act) => act.type === 'fire-weapon' && act.shipId === 'nova')).toBe(false)
  })
})

describe('the old way in (7.23)', () => {
  it('is refused once the battle is fought under the reading that added this one', () => {
    // A Nova Cannon fired through `fire-weapon` was a free 6D6 at a named ship
    // with no arming, no power-down and no template. Refusing it changes the
    // dice an old journal threw, so it is gated: a battle stamped before this
    // reading still resolves the shot the way it was fought.
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    setRulesReading(game, CURRENT_RULES_VERSION)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'nova',
        weaponId: CANNON(game),
        targetId: 'mark',
      }).refused,
    ).toMatch(/armed in orders and fires down the bow line/)
  })

  it('still resolves under the reading it was fought at', () => {
    const game = battle({
      ships: [novaShip('nova', 'a', { x: 20, y: 60 }), victim('mark', 'b', { x: 32, y: 60 })],
    })
    setRulesReading(game, 6)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'nova',
        weaponId: CANNON(game),
        targetId: 'mark',
      }).refused,
    ).toBeUndefined()
  })
})

describe('the sweeps themselves', () => {
  it('are the three the book prints', () => {
    expect(NOVA_SWEEPS[1]).toEqual({ fromMu: 6, toMu: 24, diameter: 2, damageDice: 6 })
    expect(NOVA_SWEEPS[2]).toEqual({ fromMu: 24, toMu: 48, diameter: 4, damageDice: 4 })
    expect(NOVA_SWEEPS[3]).toEqual({ fromMu: 48, toMu: 72, diameter: 6, damageDice: 2 })
  })
})
