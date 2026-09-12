import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { aiActions } from './ai'
import {
  createGame,
  createShipState,
  destroySystem,
  markHullBoxes,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { ANTIMATTER_CHARGE_BLAST_RADIUS } from './defences'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * 7.8's Regenerative Armor and 7.9's Antimatter Suicide Charge.
 *
 * Both were complete in `defences.ts` and called by nothing: `regenerateArmour`
 * rolled its dice for a caller that did not exist, and the three antimatter
 * functions — the blast, the self-damage, the unrepaired-charge roll — had no
 * caller between them. Nine designs in the roster carry regenerative armour
 * and two carry a charge, so both rules were bought and paid for on ships that
 * could never use them.
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

/** The Xxcha heavy cruiser: 8 and 4 boxes of regenerative armour. */
function regenShip(id: string, side: string, at: { x: number; y: number }): ShipState {
  return createShipState({
    id,
    side,
    design: designById('xxcha-heavy-cruiser') as ShipDesign,
    placement: { position: at, facing: 3 },
    velocity: 0,
  })
}

/** The Durani flagship, which carries an antimatter charge. */
function bomber(id: string, side: string, at: { x: number; y: number }): ShipState {
  return createShipState({
    id,
    side,
    design: designById('durani-flagship') as ShipDesign,
    placement: { position: at, facing: 3 },
    velocity: 0,
  })
}

function bystander(id: string, side: string, at: { x: number; y: number }): ShipState {
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
    seed: opts.seed ?? 0x789,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 80 },
    ships: opts.ships ?? [],
    fighterGroups: opts.flights ?? [],
  })
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!
const flightOf = (game: GameState, id: string): FighterGroupState =>
  game.fighterGroups.find((g) => g.id === id)!
/** Everything crossed off a hull: 4.9 puts the damage in two places. */
const marked = (ship: ShipState): number =>
  ship.hullMarked + ship.armourMarked.reduce((sum, n) => sum + n, 0)

const CHARGE = (ship: ShipState): string =>
  ship.design.systems.find((system) => system.kind === 'antimatter-charge')!.id

describe('regenerative armour (7.8)', () => {
  it('knits boxes back at the end of the turn', () => {
    const game = battle({ ships: [regenShip('xx', 'a', { x: 20, y: 40 })] })
    const hit = shipOf(game, 'xx')
    hit.armourMarked = [3, 2]
    nextTurn(game)
    const after = shipOf(game, 'xx')
    const standing = after.armourMarked.reduce((sum, marked) => sum + marked, 0)
    // Five damaged boxes rolled once each: some come back, none is added.
    expect(standing).toBeLessThanOrEqual(5)
    expect(game.log.some((entry) => /knits back/.test(entry.text))).toBe(true)
  })

  it('burns a box out on a 1 and never rolls it again', () => {
    // A hundred turns of a single damaged box: every box either comes back or
    // burns out, and once burnt out it stops being rolled — so the number of
    // dice thrown falls to zero rather than going on for ever.
    let sawBurnout = false
    for (let seed = 0; seed < 40 && !sawBurnout; seed++) {
      const game = battle({ ships: [regenShip('xx', 'a', { x: 20, y: 40 })], seed })
      shipOf(game, 'xx').armourMarked = [8, 4]
      nextTurn(game)
      const burnt = shipOf(game, 'xx').armourBurntOut.reduce((sum, n) => sum + n, 0)
      if (burnt === 0) continue
      sawBurnout = true
      const marked = shipOf(game, 'xx').armourMarked.reduce((sum, n) => sum + n, 0)
      // A burnt-out box is still damaged: it is a hole that will not close.
      expect(marked).toBeGreaterThanOrEqual(burnt)
      // Roll on, and the burnt-out count never falls.
      nextTurn(game)
      expect(shipOf(game, 'xx').armourBurntOut.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(
        burnt,
      )
    }
    expect(sawBurnout).toBe(true)
  })

  it('grinds down to burnt-out boxes and stops rolling', () => {
    // Left long enough, every damaged box is either back or burnt out, and the
    // ship stops logging a regeneration line at all.
    const game = battle({ ships: [regenShip('xx', 'a', { x: 20, y: 40 })] })
    shipOf(game, 'xx').armourMarked = [8, 4]
    for (let turn = 0; turn < 30; turn++) nextTurn(game)
    const ship = shipOf(game, 'xx')
    const marked = ship.armourMarked.reduce((sum, n) => sum + n, 0)
    const burnt = ship.armourBurntOut.reduce((sum, n) => sum + n, 0)
    expect(marked).toBe(burnt)
  })

  it('leaves plain armour alone', () => {
    const game = battle({ ships: [bystander('plain', 'b', { x: 20, y: 40 })] })
    shipOf(game, 'plain').armourMarked = [4, 2]
    nextTurn(game)
    expect(shipOf(game, 'plain').armourMarked).toEqual([4, 2])
  })
})

describe('the ordered detonation (7.9)', () => {
  it('is written in phase 1 and goes off at the top of phase 13', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true }).refused,
    ).toBeUndefined()

    advanceTo(game, 'boarding')
    expect(shipOf(game, 'bomb').destroyed).toBe(false)
    advanceTo(game, 'threshold')
    expect(shipOf(game, 'bomb').destroyed).toBe(true)
    expect(marked(shipOf(game, 'mark'))).toBeGreaterThan(0)
  })

  it('will not be written by a ship with no charge left', () => {
    const game = battle({ ships: [bystander('plain', 'a', { x: 20, y: 40 })] })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'plot-detonate', shipId: 'plain', on: true }).refused,
    ).toMatch(/no antimatter charge/)
  })

  it('is only written in phase 1', () => {
    const game = battle({ ships: [bomber('bomb', 'a', { x: 20, y: 40 })] })
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true }).refused,
    ).toMatch(/phase 1/)
  })

  it('lapses if the turn goes by', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true })
    applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: false })
    nextTurn(game)
    nextTurn(game)
    expect(shipOf(game, 'bomb').destroyed).toBe(false)
  })

  it('falls off with range, and stops at 3 MU', () => {
    const game = battle({
      ships: [
        bomber('bomb', 'a', { x: 20, y: 40 }),
        bystander('near', 'b', { x: 20.8, y: 40 }),
        bystander('mid', 'b', { x: 21.8, y: 40 }),
        bystander('far', 'b', { x: 22.8, y: 40 }),
        bystander('clear', 'b', { x: 24, y: 40 }),
      ],
    })
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true })
    advanceTo(game, 'threshold')
    const near = marked(shipOf(game, 'near'))
    const far = marked(shipOf(game, 'far'))
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(0)
    expect(near).toBeGreaterThan(far)
    // "Damaging any unit within 3 MU" — 4 MU out is a spectator.
    expect(marked(shipOf(game, 'clear'))).toBe(0)
  })

  it('does not ask whose ships are alongside', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('friend', 'a', { x: 21, y: 40 })],
    })
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true })
    advanceTo(game, 'threshold')
    expect(marked(shipOf(game, 'friend'))).toBeGreaterThan(0)
  })

  it('takes fighters in the blast with it', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 })],
      flights: [flight('wing', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-detonate', shipId: 'bomb', on: true })
    const before = flightOf(game, 'wing').strength
    advanceTo(game, 'threshold')
    expect(flightOf(game, 'wing').strength).toBeLessThan(before)
  })
})

describe('the accidental detonation (7.9)', () => {
  it('rolls every turn a damaged charge goes unrepaired', () => {
    const game = battle({ ships: [bomber('bomb', 'a', { x: 20, y: 40 })] })
    destroySystem(shipOf(game, 'bomb'), CHARGE(shipOf(game, 'bomb')))
    nextTurn(game)
    expect(
      game.log.some((entry) => /damaged antimatter charge (holds|lets go)/.test(entry.text)),
    ).toBe(true)
  })

  it('goes off on a 5 or 6, and rolls again until it does', () => {
    // Forty battles: with a 1-in-3 chance a turn, at least one of them blows
    // inside a handful of turns and none of them blows twice.
    let blew = 0
    for (let seed = 0; seed < 40; seed++) {
      const game = battle({ ships: [bomber('bomb', 'a', { x: 20, y: 40 })], seed })
      destroySystem(shipOf(game, 'bomb'), CHARGE(shipOf(game, 'bomb')))
      for (let turn = 0; turn < 6; turn++) nextTurn(game)
      const detonations = game.log.filter((entry) => /straight to the hull/.test(entry.text)).length
      expect(detonations).toBeLessThanOrEqual(1)
      if (detonations === 1) blew += 1
    }
    expect(blew).toBeGreaterThan(0)
  })

  it('puts the self-damage straight through the hull', () => {
    // "It is not reduced by armor or screens (the explosion starts within)."
    let checked = false
    for (let seed = 0; seed < 40 && !checked; seed++) {
      const game = battle({ ships: [bomber('bomb', 'a', { x: 20, y: 40 })], seed })
      destroySystem(shipOf(game, 'bomb'), CHARGE(shipOf(game, 'bomb')))
      for (let turn = 0; turn < 6; turn++) nextTurn(game)
      if (!game.log.some((entry) => /straight to the hull/.test(entry.text))) continue
      checked = true
      const ship = shipOf(game, 'bomb')
      expect(ship.armourMarked.every((marked) => marked === 0)).toBe(true)
      expect(ship.hullMarked).toBeGreaterThan(0)
    }
    expect(checked).toBe(true)
  })

  it('never fires twice from the same charge', () => {
    const game = battle({ ships: [bomber('bomb', 'a', { x: 20, y: 40 })] })
    destroySystem(shipOf(game, 'bomb'), CHARGE(shipOf(game, 'bomb')))
    for (let turn = 0; turn < 20; turn++) nextTurn(game)
    expect(game.log.filter((entry) => /straight to the hull/.test(entry.text)).length).toBeLessThanOrEqual(1)
  })
})

describe('a wreck with charges aboard (7.9)', () => {
  it('goes up at the end of the phase that killed it', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'ship-fire')
    markHullBoxes(shipOf(game, 'bomb'), shipOf(game, 'bomb').design.hullBoxes)
    expect(shipOf(game, 'bomb').destroyed).toBe(true)
    expect(marked(shipOf(game, 'mark'))).toBe(0)

    applyAction(game, { type: 'advance-phase' })
    expect(marked(shipOf(game, 'mark'))).toBeGreaterThan(0)
    expect(game.log.some((entry) => /the wreck goes up/.test(entry.text))).toBe(true)
  })

  it('goes up once, however many phases pass afterwards', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'ship-fire')
    markHullBoxes(shipOf(game, 'bomb'), shipOf(game, 'bomb').design.hullBoxes)
    for (let i = 0; i < 8; i++) applyAction(game, { type: 'advance-phase' })
    expect(game.log.filter((entry) => /the wreck goes up/.test(entry.text))).toHaveLength(1)
  })
})

describe('the computer and the charge (7.9)', () => {
  it('writes detonate on a hull that is not getting home, with an enemy alongside', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    const bomb = shipOf(game, 'bomb')
    markHullBoxes(bomb, Math.floor(bomb.design.hullBoxes * 0.8))
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'plot-detonate')).toBe(true)
  })

  it('leaves a healthy ship alone', () => {
    const game = battle({
      ships: [bomber('bomb', 'a', { x: 20, y: 40 }), bystander('mark', 'b', { x: 21, y: 40 })],
    })
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'plot-detonate')).toBe(false)
  })

  it('leaves a crippled ship alone when nothing is close enough to hurt', () => {
    const game = battle({
      ships: [
        bomber('bomb', 'a', { x: 20, y: 40 }),
        bystander('mark', 'b', { x: 20 + ANTIMATTER_CHARGE_BLAST_RADIUS + 4, y: 40 }),
      ],
    })
    const bomb = shipOf(game, 'bomb')
    markHullBoxes(bomb, Math.floor(bomb.design.hullBoxes * 0.8))
    advanceTo(game, 'orders')
    expect(aiActions(game, 'a').some((act) => act.type === 'plot-detonate')).toBe(false)
  })
})
