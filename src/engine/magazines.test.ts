import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { MAGAZINE_LOAD_MASS, MAGAZINE_POINTS_PER_MASS } from './ordnance'
import { describeFault, validateDesign } from '../data/designPricing'
import { allDesigns, designById } from '../data/ships'
import type { MagazineDef, Phase, ShipDesign } from './types'
import { checkableSystems, repairTargets } from './threshold'

/**
 * Magazines (6.6).
 *
 * *"A Salvo Missile Launcher (SML) may fire one salvo per turn provided
 * ammunition is left in the magazine."* A launcher is not a missile — a rack
 * is, which is why a rack is crossed off when it fires and a launcher is not
 * — so an SML with nothing behind it fires nothing. The whole supply half of
 * section 6 was written, tested and unreachable: `magazineCapacity`,
 * `checkMagazine` and `drawMagazineLoad` had no caller, no design carried a
 * magazine, and every SML in the game fired one salvo a turn for ever.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

/** A missile boat with `loads` salvoes behind its launcher. */
function boat(loads: number): { game: GameState; ship: ShipState; launcherId: string } {
  const base = designById('durani-corsair') as ShipDesign
  const launcher = base.weapons.find((w) => w.weaponClass === 'salvo-missile-launcher')
  if (!launcher) throw new Error('no launcher')
  const mass = loads * MAGAZINE_LOAD_MASS.standard
  const magazine: MagazineDef = {
    id: 'm1',
    mass,
    points: mass * MAGAZINE_POINTS_PER_MASS,
    loads: Array.from({ length: loads }, () => ({ grade: 'standard' as const })),
    launcherIds: [launcher.id],
  }
  const ship = createShipState({
    id: 'boat',
    side: 'a',
    design: { ...base, magazines: [magazine] },
    placement: { position: { x: 20, y: 24 }, facing: 3 },
  })
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-destroyer') as ShipDesign,
    placement: { position: { x: 26, y: 24 }, facing: 9 },
  })
  const game = createGame({ seed: 0xa6a, sides: [{ id: 'a' }, { id: 'b' }], ships: [ship, enemy] })
  return { game, ship, launcherId: launcher.id }
}

const launch = (game: GameState, ship: ShipState, weaponId: string) =>
  applyAction(game, {
    type: 'launch-ordnance',
    shipId: ship.id,
    weaponId,
    aimPoint: { x: 26, y: 24 },
  })

describe('firing from a magazine', () => {
  it('spends one salvo a launch', () => {
    const { game, ship, launcherId } = boat(2)
    advanceTo(game, 'launch-missiles')
    expect(launch(game, ship, launcherId).refused).toBeUndefined()
    expect(ship.magazines.get('m1')).toHaveLength(1)
  })

  it('runs dry, and says so', () => {
    const { game, ship, launcherId } = boat(1)
    advanceTo(game, 'launch-missiles')
    launch(game, ship, launcherId)
    nextTurn(game)
    advanceTo(game, 'launch-missiles')
    const dry = launch(game, ship, launcherId)
    expect(dry.refused).toContain('No missiles left in the magazine')
  })

  it('refuses a launcher with no magazine at all', () => {
    const { game, ship, launcherId } = boat(2)
    ship.design = { ...ship.design, magazines: [] }
    advanceTo(game, 'launch-missiles')
    expect(launch(game, ship, launcherId).refused).toContain('not fed by any magazine')
  })

  it('does not touch the design, so the next ship of the class is full', () => {
    const first = boat(2)
    advanceTo(first.game, 'launch-missiles')
    launch(first.game, first.ship, first.launcherId)
    const second = boat(2)
    expect(second.ship.magazines.get('m1')).toHaveLength(2)
  })

  it('leaves a crossed-off rack alone: a rack is the missile, not a tube', () => {
    // 6.6 treats the two differently and the engine has to as well.
    const rackShip = designById('esu-heavy-cruiser') as ShipDesign
    expect(rackShip.magazines).toBeUndefined()
    expect(
      rackShip.weapons.find((w) => w.weaponClass === 'salvo-missile-rack')?.ammo,
    ).toBe(1)
  })

  it('flies the grade the magazine held, not the launcher’s own', () => {
    const { game, ship, launcherId } = boat(1)
    ship.magazines.set('m1', [{ grade: 'extended' }])
    advanceTo(game, 'launch-missiles')
    launch(game, ship, launcherId)
    expect(game.ordnance.some((marker) => marker.grade === 'extended')).toBe(true)
  })
})

describe('what a magazine costs (6.6)', () => {
  it('is two mass a standard salvo and three for ER', () => {
    expect(MAGAZINE_LOAD_MASS.standard).toBe(2)
    expect(MAGAZINE_LOAD_MASS.extended).toBe(3)
  })

  it('is charged to the hull it is on', () => {
    const corsair = designById('durani-corsair') as ShipDesign
    expect((corsair.magazines ?? []).length).toBeGreaterThan(0)
    expect(validateDesign(corsair).map(describeFault)).toEqual([])
  })
})

describe('design-time checks', () => {
  it('refuses a launcher with nothing behind it', () => {
    const base = designById('durani-corsair') as ShipDesign
    const fault = validateDesign({ ...base, magazines: [] }).find(
      (f) => f.kind === 'launcher-unfed',
    )
    expect(fault && describeFault(fault)).toContain('no magazine')
  })

  it('refuses more loads than the magazine holds', () => {
    const base = designById('durani-corsair') as ShipDesign
    const overpacked = {
      ...base,
      magazines: (base.magazines ?? []).map((m) => ({ ...m, mass: 2 })),
    }
    const fault = validateDesign(overpacked).find((f) => f.kind === 'bad-magazine')
    expect(fault && describeFault(fault)).toContain('mass of magazine')
  })

  it('refuses a launcher drawing from two magazines', () => {
    const base = designById('durani-corsair') as ShipDesign
    const first = (base.magazines ?? [])[0]
    if (!first) throw new Error('no magazine')
    const fault = validateDesign({
      ...base,
      magazines: [first, { ...first, id: 'm2' }],
    }).find((f) => f.kind === 'bad-magazine')
    expect(fault && describeFault(fault)).toContain('draws from 2 magazines')
  })

  it('holds for the whole roster', () => {
    for (const design of allDesigns()) {
      expect(
        validateDesign(design).filter(
          (f) => f.kind === 'launcher-unfed' || f.kind === 'bad-magazine',
        ),
        design.name,
      ).toEqual([])
    }
  })
})

describe('a magazine at a threshold check (6.6, 4.11)', () => {
  it('is rolled for as one system while it has loads, and not once it is dry', () => {
    const { game, ship, launcherId } = boat(1)
    expect(checkableSystems(ship).filter((s) => s.id === 'm1')).toHaveLength(1)
    advanceTo(game, 'launch-missiles')
    launch(game, ship, launcherId)
    expect(checkableSystems(ship).some((s) => s.id === 'm1')).toBe(false)
  })

  it('knocked out, feeds nothing until a party repairs it', () => {
    const { game, ship, launcherId } = boat(3)
    ship.destroyedSystems.add('m1')
    advanceTo(game, 'launch-missiles')
    expect(launch(game, ship, launcherId).refused).toContain('knocked out')
    expect(ship.magazines.get('m1')).toHaveLength(3)
    expect(repairTargets(ship).some((t) => t.id === 'm1')).toBe(true)
    ship.destroyedSystems.delete('m1')
    expect(launch(game, ship, launcherId).refused).toBeUndefined()
    expect(ship.magazines.get('m1')).toHaveLength(2)
  })
})
