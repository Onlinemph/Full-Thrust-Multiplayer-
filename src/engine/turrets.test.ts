import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { maxTurrets, turretMass, turretPoints, TURRET_CAPACITY } from './weapons/kinetics'
import { describeFault, validateDesign } from '../data/designPricing'
import { CATALOGUE_WEAPONS } from '../data/buildCatalog'
import { designById } from '../data/ships'
import type { Arc, Phase, ShipDesign, TurretDef } from './types'

/**
 * Turrets (5.22).
 *
 * The schema, the pricing, the capacity fault, the threshold roll and the
 * arc-exemption in beams.ts all existed. What did not was any way to put a
 * weapon in a turret and any code that read one: `bearingArcs` never looked
 * at `turretId`, there was no facing order, and `Shipyard.tsx` wrote
 * `turrets: []` and offered no way to change it. No design in the roster
 * carried one, and the whole rule was unreachable end to end.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

/** A cruiser with one four-arc turret and its forward beam inside it. */
function turreted(): { game: GameState; ship: ShipState; enemy: ShipState; turret: TurretDef } {
  const base = designById('esu-heavy-cruiser') as ShipDesign
  const beam = base.weapons.find((w) => w.weaponClass === 'beam' && w.arcs.includes('F'))
  if (!beam) throw new Error('no forward beam')
  const turret: TurretDef = {
    id: 't1',
    arcs: ['F', 'FS', 'AS', 'A'],
    capacity: TURRET_CAPACITY[4],
    mass: turretMass(TURRET_CAPACITY[4], 4),
    points: turretPoints(turretMass(TURRET_CAPACITY[4], 4)),
  }
  const design: ShipDesign = {
    ...base,
    turrets: [turret],
    weapons: base.weapons.map((w) => (w.id === beam.id ? { ...w, turretId: 't1' } : w)),
  }
  const ship = createShipState({
    id: 'turreted',
    side: 'a',
    design,
    placement: { position: { x: 20, y: 24 }, facing: 3 },
  })
  // Abaft the starboard beam: an arc a fixed forward mounting can never
  // reach and a four-arc turret can. Not dead astern — 4.2's ban on firing
  // through the drive plume is physical and a turret does not escape it.
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-destroyer') as ShipDesign,
    placement: { position: { x: 14, y: 30 }, facing: 3 },
  })
  const game = createGame({ seed: 0x7c7, sides: [{ id: 'a' }, { id: 'b' }], ships: [ship, enemy] })
  return { game, ship, enemy, turret }
}

const fireTurretBeam = (game: GameState, ship: ShipState, enemy: ShipState) => {
  const weapon = ship.design.weapons.find((w) => w.turretId === 't1')
  if (!weapon) throw new Error('nothing in the turret')
  return applyAction(game, {
    type: 'fire-weapon',
    shipId: ship.id,
    targetId: enemy.id,
    weaponId: weapon.id,
  })
}

describe('what a turret does to a mounting', () => {
  it('lets a forward beam shoot astern', () => {
    const { game, ship, enemy } = turreted()
    advanceTo(game, 'ship-fire')
    expect(fireTurretBeam(game, ship, enemy).refused).toBeUndefined()
  })

  it('and the same beam cannot, bolted to the hull', () => {
    const { game, ship, enemy } = turreted()
    ship.design = {
      ...ship.design,
      turrets: [],
      weapons: ship.design.weapons.map((w) => ({ ...w, turretId: undefined })),
    }
    advanceTo(game, 'ship-fire')
    const weapon = ship.design.weapons.find((w) => w.arcs.includes('F') && w.weaponClass === 'beam')
    if (!weapon) throw new Error('no beam')
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: ship.id,
      targetId: enemy.id,
      weaponId: weapon.id,
    })
    expect(outcome.refused).toContain('not in that arc')
  })
})

describe('5.22 the written facing', () => {
  it('narrows the turret to one arc', () => {
    const { game, ship, enemy } = turreted()
    expect(
      applyAction(game, {
        type: 'plot-turret-facing',
        shipId: ship.id,
        turretId: 't1',
        facing: 'F',
      }).refused,
    ).toBeUndefined()
    advanceTo(game, 'ship-fire')
    // Trained forward, so the target astern is out of the turret's arc.
    expect(fireTurretBeam(game, ship, enemy).refused).toContain('not in that arc')
  })

  it('points it where the target is', () => {
    const { game, ship, enemy } = turreted()
    applyAction(game, { type: 'plot-turret-facing', shipId: ship.id, turretId: 't1', facing: 'AS' })
    advanceTo(game, 'ship-fire')
    expect(fireTurretBeam(game, ship, enemy).refused).toBeUndefined()
  })

  it('refuses an arc the turret does not traverse', () => {
    const { game, ship } = turreted()
    const refusal = applyAction(game, {
      type: 'plot-turret-facing',
      shipId: ship.id,
      turretId: 't1',
      facing: 'AP' as Arc,
    })
    expect(refusal.refused).toContain('does not traverse')
  })

  it('is taken back by writing it again', () => {
    const { game, ship, enemy } = turreted()
    applyAction(game, { type: 'plot-turret-facing', shipId: ship.id, turretId: 't1', facing: 'F' })
    applyAction(game, { type: 'plot-turret-facing', shipId: ship.id, turretId: 't1', facing: null })
    expect(ship.turretFacings.has('t1')).toBe(false)
    advanceTo(game, 'ship-fire')
    expect(fireTurretBeam(game, ship, enemy).refused).toBeUndefined()
  })

  it('is written in orders and nowhere else', () => {
    const { game, ship } = turreted()
    advanceTo(game, 'ship-fire')
    const refusal = applyAction(game, {
      type: 'plot-turret-facing',
      shipId: ship.id,
      turretId: 't1',
      facing: 'F',
    })
    expect(refusal.refused).toBeTruthy()
  })
})

describe('what a turret costs (5.22)', () => {
  it('carries more guns the fewer arcs it covers', () => {
    expect(TURRET_CAPACITY[2]).toBeGreaterThan(TURRET_CAPACITY[6])
    expect(turretMass(12, 2)).toBeLessThan(turretMass(12, 6))
  })

  it('is one turret per 50 mass of ship', () => {
    expect(maxTurrets(49)).toBe(0)
    expect(maxTurrets(50)).toBe(1)
    expect(maxTurrets(150)).toBe(3)
  })

  it('refuses a turret carrying more than it holds', () => {
    const { ship } = turreted()
    const overloaded: ShipDesign = {
      ...ship.design,
      turrets: [{ ...ship.design.turrets[0]!, capacity: 1 }],
    }
    const fault = validateDesign(overloaded).find((f) => f.kind === 'turret-overloaded')
    expect(fault && describeFault(fault)).toContain('5.22')
  })
})

describe('the shipyard can build one now', () => {
  it('sells a one-shot mounting with its shots', () => {
    // The catalogue carried no ammo rating, so a shipyard-built SM Rack fired
    // for ever while the roster's identical rack fired once.
    const rack = CATALOGUE_WEAPONS.find((w) => w.weaponClass === 'salvo-missile-rack')
    expect(rack?.ammo).toBe(1)
    const beam = CATALOGUE_WEAPONS.find((w) => w.weaponClass === 'beam')
    expect(beam?.ammo).toBeUndefined()
  })
})
