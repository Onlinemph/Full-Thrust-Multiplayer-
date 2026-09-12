import { describe, expect, it } from 'vitest'

import { applyAction, setRulesReading, waveGunCharge } from './actions'
import { aiActions } from './ai'
import {
  createGame,
  createShipState,
  destroySystem,
  hullRemaining,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { WAVE_GUN_BANDS, WAVE_GUN_CHARGE_TARGET } from './ew'
import { designById } from '../data/ships'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase, ShipDesign } from './types'

/**
 * 7.24's Wave Gun, from the first charging die to the backlash.
 *
 * Every number was in `ew.ts` — the three bands, the charge target, the
 * discharge, the knock-out damage, the contact test — with one caller between
 * them all, and that caller was the `WeaponSpec` in the registry, which would
 * have fired the gun as an ordinary shot at a named ship with no charge in it
 * at all. The Maxwell-class Wave Cruiser is the hull built around it.
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

function waveShip(id: string, side: string, at: { x: number; y: number }): ShipState {
  return createShipState({
    id,
    side,
    design: designById('izotrope-wavegun') as ShipDesign,
    placement: { position: at, facing: 3 },
    velocity: 0,
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
    seed: opts.seed ?? 0x7024,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 160, height: 100 },
    ships: opts.ships ?? [waveShip('wave', 'a', { x: 20, y: 50 })],
    fighterGroups: opts.flights ?? [],
  })
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!
const flightOf = (game: GameState, id: string): FighterGroupState =>
  game.fighterGroups.find((g) => g.id === id)!
const GUN = (game: GameState, id = 'wave'): string =>
  shipOf(game, id).design.weapons.find((w) => w.weaponClass === 'wave-gun')!.id

/** Charge until it is full, one order a turn — which is what 7.24 makes you do. */
function chargeUp(game: GameState, id = 'wave'): number {
  let turns = 0
  while (waveGunCharge(game, shipOf(game, id), GUN(game, id)) < WAVE_GUN_CHARGE_TARGET) {
    advanceTo(game, 'orders')
    applyAction(game, { type: 'charge-wave-gun', shipId: id, weaponId: GUN(game, id) })
    if (waveGunCharge(game, shipOf(game, id), GUN(game, id)) >= WAVE_GUN_CHARGE_TARGET) break
    nextTurn(game)
    if (++turns > 12) break
  }
  return turns
}

describe('charging the capacitors (7.24)', () => {
  it('is an order, and takes one die a turn', () => {
    const game = battle()
    advanceTo(game, 'orders')
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBe(0)

    applyAction(game, { type: 'charge-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    const first = waveGunCharge(game, shipOf(game, 'wave'), GUN(game))
    expect(first).toBeGreaterThanOrEqual(1)
    expect(first).toBeLessThanOrEqual(6)

    // "Each turn that the player orders the weapon to charge, roll one D6" —
    // once a turn, not once a click.
    expect(
      applyAction(game, { type: 'charge-wave-gun', shipId: 'wave', weaponId: GUN(game) }).refused,
    ).toMatch(/already taken this turn/)
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBe(first)
  })

  it('only charges in phase 1', () => {
    const game = battle()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'charge-wave-gun', shipId: 'wave', weaponId: GUN(game) }).refused,
    ).toMatch(/orders/)
  })

  it('reaches six or more and then is ready on any turn', () => {
    const game = battle()
    chargeUp(game)
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBeGreaterThanOrEqual(
      WAVE_GUN_CHARGE_TARGET,
    )
    // "May then be fired on any turn" — the charge keeps.
    nextTurn(game)
    nextTurn(game)
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBeGreaterThanOrEqual(
      WAVE_GUN_CHARGE_TARGET,
    )
  })
})

describe('the discharge (7.24)', () => {
  it('will not fire on a part-charged capacitor', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'charge-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    const charge = waveGunCharge(game, shipOf(game, 'wave'), GUN(game))
    advanceTo(game, 'ship-fire')
    const outcome = applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    if (charge >= WAVE_GUN_CHARGE_TARGET) {
      expect(outcome.refused).toBeUndefined()
    } else {
      expect(outcome.refused).toMatch(/in its capacitors/)
    }
  })

  it('empties the capacitors when it fires', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBe(0)
  })

  it('hits harder close in than far out', () => {
    // 4D6 at 0-12 MU, 3D6 at 12-24, 2D6 at 24-36. Forty battles apiece, since
    // one roll of 4D6 can come in under one roll of 2D6.
    const total = (offset: number): number => {
      let sum = 0
      for (let seed = 0; seed < 40; seed++) {
        const game = battle({
          ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 20 + offset, y: 50 })],
          seed,
        })
        chargeUp(game)
        advanceTo(game, 'ship-fire')
        applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
        sum += shipOf(game, 'mark').hullMarked
      }
      return sum
    }
    const near = total(8)
    const middle = total(18)
    const far = total(30)
    expect(near).toBeGreaterThan(middle)
    expect(middle).toBeGreaterThan(far)
  })

  it('reaches 36 MU and no further', () => {
    const inside = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 55, y: 50 })],
    })
    chargeUp(inside)
    advanceTo(inside, 'ship-fire')
    applyAction(inside, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(inside) })
    expect(shipOf(inside, 'mark').hullMarked).toBeGreaterThan(0)

    const beyond = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 58, y: 50 })],
    })
    chargeUp(beyond)
    advanceTo(beyond, 'ship-fire')
    applyAction(beyond, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(beyond) })
    expect(shipOf(beyond, 'mark').hullMarked).toBe(0)
  })

  it('widens as it goes: 2 MU close, 4 MU far', () => {
    // A hull 1.6 MU off the line is inside the 4 MU template at 30 MU and
    // outside the 2 MU one at 8.
    const off = (along: number): number => {
      const game = battle({
        ships: [
          waveShip('wave', 'a', { x: 20, y: 50 }),
          victim('mark', 'b', { x: 20 + along, y: 51.6 }),
        ],
      })
      chargeUp(game)
      advanceTo(game, 'ship-fire')
      applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
      return shipOf(game, 'mark').hullMarked
    }
    expect(off(8)).toBe(0)
    expect(off(30)).toBeGreaterThan(0)
  })

  it('takes fighters and ordnance out of the front', () => {
    const game = battle({ flights: [flight('wing', 'b', { x: 30, y: 50 })] })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    expect(flightOf(game, 'wing').status).toBe('destroyed')
  })

  it('ignores armour', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    // The Hegemon's 14 and 7 boxes of armour are untouched and its hull is not.
    expect(shipOf(game, 'mark').armourMarked.every((marked) => marked === 0)).toBe(true)
    expect(shipOf(game, 'mark').hullMarked).toBeGreaterThan(0)
  })

  it('lives one turn only', () => {
    // "The wave has a life of only one turn." Nothing is left on the table, so
    // a hull that flies into the lane next turn is untouched.
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 100, y: 50 })],
    })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    nextTurn(game)
    shipOf(game, 'mark').placement.position = { x: 30, y: 50 }
    advanceTo(game, 'ship-fire')
    expect(shipOf(game, 'mark').hullMarked).toBe(0)
  })
})

describe('what the wave costs the ship that fires it (7.24)', () => {
  it('takes every other gun on the hull for the turn', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    const plasma = shipOf(game, 'wave').design.weapons.find(
      (w) => w.weaponClass === 'plasma-cannon',
    )!
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'wave',
        weaponId: plasma.id,
        targetId: 'mark',
      }).refused,
    ).toMatch(/fires nothing else this turn/)
  })

  it('will not go off after something else already has', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 24, y: 46 })],
    })
    chargeUp(game)
    advanceTo(game, 'ship-fire')
    const plasma = shipOf(game, 'wave').design.weapons.find(
      (w) => w.weaponClass === 'plasma-cannon' && w.arcs.includes('FP'),
    )!
    const fired = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'wave',
      weaponId: plasma.id,
      targetId: 'mark',
    })
    expect(fired.refused).toBeUndefined()
    expect(
      applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) }).refused,
    ).toMatch(/already fired this turn/)
  })

  it('may still thrust and turn, unlike a Nova Cannon ship', () => {
    // "Note that a ship fitted with a Wave Gun may apply thrust or change
    // course in the same turn that it fires the weapon."
    const game = battle()
    chargeUp(game)
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'plot-turn', shipId: 'wave', direction: 'starboard', points: 1 })
        .refused,
    ).toBeUndefined()
    expect(applyAction(game, { type: 'plot-accel', shipId: 'wave', accel: 2 }).refused).toBeUndefined()
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'wave' })
    expect(shipOf(game, 'wave').placement.facing).not.toBe(3)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) }).refused,
    ).toBeUndefined()
  })

  it('opens its own forward screens for the turn', () => {
    // "Counts as being unscreened through its entire frontal arc while the
    // weapon is being fired." The Maxwell carries two levels of screen, so
    // the same beam over forty seeds does more once the wave has gone.
    const play = (letItGo: boolean): number => {
      let total = 0
      for (let seed = 0; seed < 40; seed++) {
        const gunner = createShipState({
          id: 'gun',
          side: 'b',
          design: designById('esu-heavy-cruiser') as ShipDesign,
          placement: { position: { x: 26, y: 50 }, facing: 9 },
          velocity: 0,
        })
        const game = battle({ ships: [waveShip('wave', 'a', { x: 20, y: 50 }), gunner], seed })
        chargeUp(game)
        advanceTo(game, 'ship-fire')
        if (letItGo) applyAction(game, { type: 'fire-wave-gun', shipId: 'wave', weaponId: GUN(game) })
        for (const beam of shipOf(game, 'gun').design.weapons) {
          if (beam.weaponClass !== 'beam' || !beam.arcs.includes('F')) continue
          applyAction(game, {
            type: 'fire-weapon',
            shipId: 'gun',
            weaponId: beam.id,
            targetId: 'wave',
          })
        }
        total += shipOf(game, 'wave').hullMarked
      }
      return total
    }
    const open = play(true)
    const screened = play(false)
    expect(screened).toBeGreaterThan(0)
    expect(open).toBeGreaterThan(screened)
  })
})

describe('the backlash (7.24)', () => {
  it('puts the charge through the hull when the gun is shot out', () => {
    const game = battle()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'charge-wave-gun', shipId: 'wave', weaponId: GUN(game) })
    const charge = waveGunCharge(game, shipOf(game, 'wave'), GUN(game))
    expect(charge).toBeGreaterThan(0)

    // A needle beam is one of the two things 7.24 names, and the backlash is
    // swept at the next phase boundary whichever of the two did it.
    destroySystem(shipOf(game, 'wave'), GUN(game))
    applyAction(game, { type: 'advance-phase' })
    expect(shipOf(game, 'wave').hullMarked).toBeGreaterThanOrEqual(charge)
    expect(game.log.some((entry) => /capacitors let go/.test(entry.text))).toBe(true)
    // And it only goes off once.
    expect(waveGunCharge(game, shipOf(game, 'wave'), GUN(game))).toBe(0)
  })

  it('does nothing at all on an empty capacitor', () => {
    const game = battle()
    advanceTo(game, 'orders')
    destroySystem(shipOf(game, 'wave'), GUN(game))
    applyAction(game, { type: 'advance-phase' })
    expect(shipOf(game, 'wave').hullMarked).toBe(0)
  })
})

describe('the old way in (7.24)', () => {
  it('is refused at the reading that gave the gun its own actions', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    setRulesReading(game, CURRENT_RULES_VERSION)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'wave',
        weaponId: GUN(game),
        targetId: 'mark',
      }).refused,
    ).toMatch(/charged over turns and fires down the bow line/)
  })
})

describe('the computer and the Wave Gun (7.24)', () => {
  it('charges every turn until the capacitors are full', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'charge-wave-gun')).toBe(true)
  })

  it('stops charging once it is ready', () => {
    const game = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    chargeUp(game)
    nextTurn(game)
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'charge-wave-gun')).toBe(false)
  })

  it('lets it go at a hull on the line, and holds it when the lane is empty', () => {
    const onTheLine = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 50 })],
    })
    chargeUp(onTheLine)
    advanceTo(onTheLine, 'ship-fire')
    expect(aiActions(onTheLine, 'a').some((act) => act.type === 'fire-wave-gun')).toBe(true)

    const empty = battle({
      ships: [waveShip('wave', 'a', { x: 20, y: 50 }), victim('mark', 'b', { x: 28, y: 90 })],
    })
    chargeUp(empty)
    advanceTo(empty, 'ship-fire')
    expect(aiActions(empty, 'a').some((act) => act.type === 'fire-wave-gun')).toBe(false)
  })
})

describe('the bands themselves', () => {
  it('are the three the book prints', () => {
    expect(WAVE_GUN_BANDS).toEqual([
      { fromMu: 0, toMu: 12, diameter: 2, damageDice: 4 },
      { fromMu: 12, toMu: 24, diameter: 3, damageDice: 3 },
      { fromMu: 24, toMu: 36, diameter: 4, damageDice: 2 },
    ])
  })

  it('leaves the Maxwell a legal design', () => {
    const design = designById('izotrope-wavegun') as ShipDesign
    expect(design.weapons.some((w) => w.weaponClass === 'wave-gun')).toBe(true)
    expect(hullRemaining(createShipState({
      id: 'x',
      side: 'a',
      design,
      placement: { position: { x: 0, y: 0 }, facing: 3 },
      velocity: 0,
    }))).toBe(design.hullBoxes)
  })
})
