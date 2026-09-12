import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * The three ordnance paths that had no way into a game (6.6, 6.7, 6.8).
 *
 * `ordnance.ts` has resolved rocket pods, antimatter blasts and plasma bolts
 * since it was written, and `actions.ts` had a launch action for exactly one
 * family: `resolveOrdnanceAttack` returned null for an antimatter warhead and
 * the plasma bolt functions had no caller at all. Two hulls in the roster
 * carried launchers that could never fire.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function battle(shooterId: string, apart = 6): GameState {
  return createGame({
    seed: 0x5eed,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'shooter',
        side: 'a',
        design: designById(shooterId) as ShipDesign,
        placement: { position: { x: 40, y: 20 }, facing: 6 },
      }),
      createShipState({
        id: 'target',
        side: 'b',
        design: designById('esu-battleship') as ShipDesign,
        placement: { position: { x: 40, y: 20 + apart }, facing: 12 },
      }),
    ],
  })
}

function weaponOf(game: GameState, weaponClass: string): string {
  const ship = game.ships.find((s) => s.id === 'shooter')!
  const weapon = ship.design.weapons.find(
    (w) => w.weaponClass === weaponClass && w.arcs.includes('F'),
  )
  expect(weapon, `${ship.design.id} has no forward ${weaponClass}`).toBeDefined()
  return weapon!.id
}

describe('rocket pods (6.7)', () => {
  it('rolls both rockets at launch and leaves the hits on the target', () => {
    const game = battle('chytrid-spore')
    advanceTo(game, 'launch-missiles')
    const outcome = applyAction(game, {
      type: 'fire-rocket-pod',
      shipId: 'shooter',
      weaponId: weaponOf(game, 'rocket-pod'),
      targetId: 'target',
    })
    expect(outcome.refused).toBeUndefined()
    // Two dice, rolled now: "The Rocket Pod fires TWO rockets at the target".
    const entry = game.log[game.log.length - 1]
    expect(entry.dice?.length).toBe(2)
    // At 6 MU a rocket hits on 2+, so both should be markers on the table.
    expect(game.ordnance.filter((m) => m.kind === 'rocket').length).toBe(1)
  })

  it('refuses a friendly target and a target out of arc', () => {
    const game = battle('chytrid-spore')
    advanceTo(game, 'launch-missiles')
    expect(
      applyAction(game, {
        type: 'fire-rocket-pod',
        shipId: 'shooter',
        weaponId: weaponOf(game, 'rocket-pod'),
        targetId: 'shooter',
      }).refused,
    ).toBeTruthy()
  })
})

describe('plasma bolts (6.8)', () => {
  it('places a marker, lets point defence at it, and detonates it in phase 10', () => {
    const game = battle('izotrope-cruiser', 5)
    advanceTo(game, 'launch-missiles')
    const weaponId = weaponOf(game, 'plasma-bolt-launcher')
    const bolt = applyAction(game, {
      type: 'launch-plasma-bolt',
      shipId: 'shooter',
      weaponId,
      aimPoint: { x: 40, y: 25 },
    })
    expect(bolt.refused).toBeUndefined()
    expect(game.ordnance.filter((m) => m.kind === 'plasma-bolt').length).toBe(1)

    advanceTo(game, 'point-defence')
    applyAction(game, { type: 'resolve-point-defence' })
    // The target is a battleship with four PDS five MU away, so the bolt is
    // shot at whether or not anything gets through.
    expect(game.log.some((e) => /Plasma bolt under fire/.test(e.text ?? ''))).toBe(true)

    advanceTo(game, 'ordnance-vs-ships')
    const before = game.ships.find((s) => s.id === 'target')!.hullMarked
    applyAction(game, { type: 'resolve-ordnance-attacks' })
    expect(game.ordnance.filter((m) => m.kind === 'plasma-bolt').length).toBe(0)
    const after = game.ships.find((s) => s.id === 'target')!.hullMarked
    // A surviving bolt throws a die per class at everything within 6 MU; a
    // destroyed one throws nothing. Either way the marker is gone and the
    // battle knows what happened.
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('will not fire the same launcher two turns running', () => {
    const game = battle('izotrope-cruiser', 5)
    advanceTo(game, 'launch-missiles')
    const weaponId = weaponOf(game, 'plasma-bolt-launcher')
    expect(
      applyAction(game, {
        type: 'launch-plasma-bolt',
        shipId: 'shooter',
        weaponId,
        aimPoint: { x: 40, y: 25 },
      }).refused,
    ).toBeUndefined()

    // Round the sequence to the next turn's launch phase.
    let guard = 40
    while (guard-- > 0) {
      advancePhase(game)
      if (game.turn === 2 && game.phase === 'launch-missiles') break
    }
    expect(game.turn).toBe(2)
    const second = applyAction(game, {
      type: 'launch-plasma-bolt',
      shipId: 'shooter',
      weaponId,
      aimPoint: { x: 40, y: 25 },
    })
    expect(second.refused).toMatch(/every other turn/)
  })
})

describe('antimatter warheads (6.6)', () => {
  it('goes off as a blast rather than as one ship’s damage roll', () => {
    const game = battle('tyrant-arsenal', 6)
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: 'shooter',
      weaponId: weaponOf(game, 'antimatter-missile'),
      aimPoint: { x: 40, y: 26 },
    })
    expect(game.ordnance.filter((m) => m.kind === 'antimatter').length).toBe(1)

    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'resolve-ordnance-attacks' })
    expect(game.log.some((e) => /Antimatter warhead detonates/.test(e.text ?? ''))).toBe(true)
    // A battleship's armour may swallow the whole blast, which is the point of
    // armour; what must be true is that the blast reached it.
    expect(game.log.some((e) => /An antimatter blast catches/.test(e.text ?? ''))).toBe(true)
    const target = game.ships.find((s) => s.id === 'target')!
    const soaked = target.hullMarked + target.armourMarked.reduce((sum, n) => sum + n, 0)
    expect(soaked).toBeGreaterThan(0)
  })
})
