import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import {
  advancePhase,
  canWeaponFire,
  createGame,
  createShipState,
  shotsLeft,
  spendShot,
  type GameState,
  type ShipState,
} from './game'
import { designById } from '../data/ships'
import type { Phase, ShipDesign, WeaponDef } from './types'

/**
 * One-shot mounts (6.6).
 *
 * *"Heavy Missiles and Salvo Missile Racks (SMR) have individual symbols on
 * the ship SSD. Once fired, it is crossed off and cannot be used again."*
 *
 * `WeaponDef.ammo` has said so since the schema was written, and was read in
 * three places and written in none — because it sits on the *design*, which
 * every hull of a class shares, so decrementing it would have disarmed the
 * whole class. The count belongs to the ship. Until it had one, every SMR and
 * every heavy missile in the game fired every turn for ever.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function withRack(): { game: GameState; ship: ShipState; rack: WeaponDef } {
  const design = designById('esu-heavy-cruiser') as ShipDesign
  const rack = design.weapons.find((w) => w.weaponClass === 'salvo-missile-rack')
  if (!rack) throw new Error('no rack in the roster cruiser')
  const ship = createShipState({
    id: 'shooter',
    side: 'a',
    design,
    placement: { position: { x: 20, y: 24 }, facing: 3 },
  })
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-destroyer') as ShipDesign,
    placement: { position: { x: 40, y: 24 }, facing: 9 },
  })
  const game = createGame({ seed: 0xa77, sides: [{ id: 'a' }, { id: 'b' }], ships: [ship, enemy] })
  return { game, ship, rack }
}

describe('what the roster now says', () => {
  it('gives a Salvo Missile Rack one shot', () => {
    const { rack } = withRack()
    expect(rack.ammo).toBe(1)
  })

  it('gives a Salvo Missile Launcher none, because it feeds from a magazine', () => {
    // 6.6: "A Salvo Missile Launcher (SML) may fire one salvo per turn
    // provided ammunition is left in the magazine" — a different rule, and a
    // different thing to build.
    const design = designById('durani-corsair') as ShipDesign
    const launcher = design.weapons.find((w) => w.weaponClass === 'salvo-missile-launcher')
    expect(launcher?.ammo).toBeUndefined()
  })

  it('leaves a beam alone', () => {
    const design = designById('esu-heavy-cruiser') as ShipDesign
    expect(design.weapons.find((w) => w.weaponClass === 'beam')?.ammo).toBeUndefined()
  })
})

describe('the count belongs to the ship', () => {
  it('starts at what the mount was built with', () => {
    const { ship, rack } = withRack()
    expect(shotsLeft(ship, rack.id)).toBe(1)
  })

  it('is spent when the mount fires, and the design is untouched', () => {
    const { ship, rack } = withRack()
    const design = ship.design
    spendShot(ship, rack.id)
    expect(shotsLeft(ship, rack.id)).toBe(0)
    // The whole reason the counter could not live on the design.
    expect(design.weapons.find((w) => w.id === rack.id)?.ammo).toBe(1)
  })

  it('does not disarm the next ship of the class', () => {
    const first = withRack()
    const second = withRack()
    spendShot(first.ship, first.rack.id)
    expect(shotsLeft(first.ship, first.rack.id)).toBe(0)
    expect(shotsLeft(second.ship, second.rack.id)).toBe(1)
  })

  it('is unlimited on a mount with no ammunition rating', () => {
    const { ship } = withRack()
    const beam = ship.design.weapons.find((w) => w.weaponClass === 'beam')
    if (!beam) throw new Error('no beam')
    spendShot(ship, beam.id)
    expect(shotsLeft(ship, beam.id)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('firing it', () => {
  it('crosses the rack off after one launch', () => {
    const { game, ship, rack } = withRack()
    advanceTo(game, 'launch-missiles')
    expect(canWeaponFire(ship, rack.id)).toBe(true)
    const first = applyAction(game, {
      type: 'launch-ordnance',
      shipId: ship.id,
      weaponId: rack.id,
      aimPoint: { x: 40, y: 24 },
    })
    expect(first.refused).toBeUndefined()
    expect(shotsLeft(ship, rack.id)).toBe(0)
    expect(canWeaponFire(ship, rack.id)).toBe(false)
  })

  it('stays crossed off next turn, where a beam comes back', () => {
    const { game, ship, rack } = withRack()
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: ship.id,
      weaponId: rack.id,
      aimPoint: { x: 40, y: 24 },
    })
    const beam = ship.design.weapons.find((w) => w.weaponClass === 'beam')
    if (!beam) throw new Error('no beam')
    advanceTo(game, 'ship-fire')
    applyAction(game, {
      type: 'fire-weapon',
      shipId: ship.id,
      targetId: 'enemy',
      weaponId: beam.id,
    })
    let guard = 60
    const turn = game.turn
    while (game.turn === turn && guard-- > 0) advancePhase(game)
    expect(canWeaponFire(ship, beam.id)).toBe(true)
    expect(canWeaponFire(ship, rack.id)).toBe(false)
  })

  it('refuses the second launch rather than flying a missile that does not exist', () => {
    const { game, ship, rack } = withRack()
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: ship.id,
      weaponId: rack.id,
      aimPoint: { x: 40, y: 24 },
    })
    const before = game.ordnance.length
    let guard = 60
    const turn = game.turn
    while (game.turn === turn && guard-- > 0) advancePhase(game)
    advanceTo(game, 'launch-missiles')
    const second = applyAction(game, {
      type: 'launch-ordnance',
      shipId: ship.id,
      weaponId: rack.id,
      aimPoint: { x: 40, y: 24 },
    })
    expect(second.refused).toBeTruthy()
    expect(game.ordnance.length).toBeLessThanOrEqual(before)
  })
})
