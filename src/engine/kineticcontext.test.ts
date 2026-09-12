import { describe, expect, it } from 'vitest'

import { applyAction, rulesReading, setRulesReading } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import type { Phase, ShipDesign, WeaponDef } from './types'

/**
 * What a kinetic weapon is told about its target (5.14 – 5.23, 7.3).
 *
 * `KineticContext` has carried `advancedScreens`, `targetMass` and
 * `targetVelocity` since the module was written, and `fire-weapon` never set
 * any of them. So 7.3's Advanced Screens — half again the mass and points of
 * a Standard Screen — protected nothing at all against a pulse torpedo, a
 * submunition pack or an MKP, and a Gravitic Gun read every target's velocity
 * as zero.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function duel(
  targetDesign: ShipDesign,
  shooterDesign: ShipDesign,
  seed: number,
): { game: GameState; shooter: ShipState; target: ShipState } {
  const shooter = createShipState({
    id: 'shooter',
    side: 'a',
    design: shooterDesign,
    placement: { position: { x: 20, y: 24 }, facing: 3 },
  })
  const target = createShipState({
    id: 'target',
    side: 'b',
    design: targetDesign,
    placement: { position: { x: 26, y: 24 }, facing: 9 },
  })
  const game = createGame({ seed, sides: [{ id: 'a' }, { id: 'b' }], ships: [shooter, target] })
  return { game, shooter, target }
}

/** A design with the same screens, at the level given, advanced or not. */
function screened(base: ShipDesign, advanced: boolean): ShipDesign {
  return { ...base, screens: { level: 2, generators: 2, advanced } }
}

const torpedoShip = designById('durani-raider') as ShipDesign
const hull = designById('nac-heavy-cruiser') as ShipDesign

describe('7.3 Advanced Screens against a projectile', () => {
  it('take damage off, where a Standard Screen does not', () => {
    // The same seed, the same shot, the two screen kinds. Advanced Screens are
    // worth -1 damage a level against a pulse torpedo (7.3); Standard Screens
    // are worth nothing at all against anything solid.
    let standardTotal = 0
    let advancedTotal = 0
    for (let seed = 0; seed < 40; seed += 1) {
      for (const advanced of [false, true]) {
        const { game, shooter, target } = duel(screened(hull, advanced), torpedoShip, seed)
        advanceTo(game, 'ship-fire')
        const mount = shooter.design.weapons.find(
          (w: WeaponDef) => w.weaponClass === 'pulse-torpedo',
        )
        if (!mount) throw new Error('no torpedo')
        applyAction(game, {
          type: 'fire-weapon',
          shipId: shooter.id,
          targetId: target.id,
          weaponId: mount.id,
        })
        const done = target.hullMarked + target.armourMarked.reduce((a, b) => a + b, 0)
        if (advanced) advancedTotal += done
        else standardTotal += done
      }
    }
    expect(standardTotal).toBeGreaterThan(0)
    expect(advancedTotal).toBeLessThan(standardTotal)
  })
})

describe('the rules stamp', () => {
  it('was written onto every battle and read by nothing', () => {
    // It is read now, which is what lets a fix that changes the dice land
    // without rewriting a fight that was already had.
    expect(CURRENT_RULES_VERSION).toBeGreaterThanOrEqual(2)
    const game = buildGame({ scenarioId: 'line-of-battle', seed: 1 })
    expect(rulesReading(game)).toBe(1)
    const stamped = buildGame({
      scenarioId: 'line-of-battle',
      seed: 1,
      rulesVersion: CURRENT_RULES_VERSION,
    })
    expect(rulesReading(stamped)).toBe(CURRENT_RULES_VERSION)
  })

  it('reads an unstamped file as reading 1, exactly as it was fought', () => {
    const { game } = duel(hull, torpedoShip, 5)
    expect(rulesReading(game)).toBe(1)
    setRulesReading(game, undefined)
    expect(rulesReading(game)).toBe(1)
    setRulesReading(game, 7)
    expect(rulesReading(game)).toBe(7)
  })
})
