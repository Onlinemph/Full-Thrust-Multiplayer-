import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, canShipFire, type GameState, type ShipState } from './game'
import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase } from './types'

/**
 * 2.6's firing activation.
 *
 * > *"After a ship has fired some or all of its weaponry and play has moved on
 * > to another ship that ship may not fire any other ship to ship weapons in
 * > that game turn."*
 *
 * A ship's fire is one activation, not one shot. `hasFiredThisTurn` and
 * `canShipFire` have carried the rule since the state was written, and
 * `markShipFired` was called on a ship's *first* mount while `canShipFire` was
 * read by nothing — so the flag went true immediately and stopped nobody, and
 * a player could fire one gun, watch the result, and fire the next.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function battle(rulesVersion?: number): {
  game: GameState
  first: ShipState
  second: ShipState
  enemy: ShipState
  other: ShipState
} {
  const game = buildGame({
    scenarioId: 'line-of-battle',
    seed: 0xac7,
    ...(rulesVersion === undefined ? {} : { rulesVersion }),
  })
  // Two shooters that each have more than one beam bearing dead ahead, so
  // "fire everything in one go" has something to fire.
  const mine = game.ships.filter(
    (ship) =>
      ship.side === game.sides[0]?.id &&
      ship.design.weapons.filter((w) => w.weaponClass === 'beam' && w.arcs.includes('F')).length >=
        2,
  )
  const theirs = game.ships.filter((ship) => ship.side !== game.sides[0]?.id)
  const [first, second] = mine as [ShipState, ShipState]
  const [enemy, other] = theirs as [ShipState, ShipState]
  // Each shooter with its own target dead ahead, so nothing is ever refused
  // for arc or range and the only thing under test is the activation.
  first.placement = { position: { x: 20, y: 16 }, facing: 3 }
  enemy.placement = { position: { x: 26, y: 16 }, facing: 9 }
  second.placement = { position: { x: 20, y: 32 }, facing: 3 }
  other.placement = { position: { x: 26, y: 32 }, facing: 9 }
  advanceTo(game, 'ship-fire')
  return { game, first, second, enemy, other }
}

/** The nth beam on this hull that bears dead ahead. */
const shoot = (game: GameState, ship: ShipState, enemy: ShipState, index: number) => {
  const weapon = ship.design.weapons.filter(
    (w) => w.weaponClass === 'beam' && w.arcs.includes('F'),
  )[index]
  if (!weapon) throw new Error('no forward beam')
  return applyAction(game, {
    type: 'fire-weapon',
    shipId: ship.id,
    targetId: enemy.id,
    weaponId: weapon.id,
  })
}

describe('one activation a turn', () => {
  it('lets a ship fire everything it has in one go', () => {
    const { game, first, enemy } = battle(CURRENT_RULES_VERSION)
    expect(shoot(game, first, enemy, 0).refused).toBeUndefined()
    expect(shoot(game, first, enemy, 1).refused).toBeUndefined()
  })

  it('closes a ship out once play moves on to another', () => {
    const { game, first, second, enemy, other } = battle(CURRENT_RULES_VERSION)
    expect(shoot(game, first, enemy, 0).refused).toBeUndefined()
    expect(shoot(game, second, other, 0).refused).toBeUndefined()
    const late = shoot(game, first, enemy, 1)
    expect(late.refused).toContain('play moved on')
  })

  it('says the same thing through canShipFire', () => {
    const { game, first, second, enemy, other } = battle(CURRENT_RULES_VERSION)
    shoot(game, first, enemy, 0)
    expect(canShipFire(first)).toBe(true)
    shoot(game, second, other, 0)
    expect(canShipFire(first)).toBe(false)
    expect(canShipFire(second)).toBe(true)
  })

  it('lets the new ship carry on firing', () => {
    const { game, first, second, enemy, other } = battle(CURRENT_RULES_VERSION)
    shoot(game, first, enemy, 0)
    shoot(game, second, other, 0)
    expect(shoot(game, second, other, 1).refused).toBeUndefined()
  })

  it('spends the activation on holding fire too', () => {
    const { game, first, enemy } = battle(CURRENT_RULES_VERSION)
    expect(applyAction(game, { type: 'pass-fire', shipId: first.id }).refused).toBeUndefined()
    expect(canShipFire(first)).toBe(false)
    expect(shoot(game, first, enemy, 0).refused).toContain('play moved on')
  })

  it('gives everyone their activation back next turn', () => {
    const { game, first, second, enemy, other } = battle(CURRENT_RULES_VERSION)
    shoot(game, first, enemy, 0)
    shoot(game, second, other, 0)
    expect(canShipFire(first)).toBe(false)
    let guard = 60
    const turn = game.turn
    while (game.turn === turn && guard-- > 0) advancePhase(game)
    expect(canShipFire(first)).toBe(true)
    advanceTo(game, 'ship-fire')
    expect(shoot(game, first, enemy, 0).refused).toBeUndefined()
  })

  it('leaves an older battle firing the way it was fought', () => {
    // Readings 1 to 4 never read the flag, so a ship could come back to its
    // guns after play had moved on. A replay has to keep doing that.
    const { game, first, second, enemy, other } = battle()
    shoot(game, first, enemy, 0)
    shoot(game, second, other, 0)
    expect(shoot(game, first, enemy, 1).refused).toBeUndefined()
    expect(CURRENT_RULES_VERSION).toBeGreaterThanOrEqual(5)
  })
})
