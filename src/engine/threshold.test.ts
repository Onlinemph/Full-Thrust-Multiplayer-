/**
 * Threshold points (4.11), Core Systems (10.3) and damage control (10.4).
 *
 * The rulebook's own worked example — the 12-hull-box ship in four rows of
 * three — is the first test below, and every number in the rest is quoted in
 * `docs/rules/threshold.md` against the rule it comes from.
 */

import { describe, expect, it } from 'vitest'
import { Rng, thresholdTarget } from './dice'
import {
  createGame,
  createShipState,
  currentThrust,
  isSystemDestroyed,
  markHullBoxes,
  pendingThresholdCheck,
  type GameState,
  type ShipState,
} from './game'
import type { ShipDesign } from './types'
import {
  CORE_SYSTEM_DRM,
  CORE_SYSTEM_IDS,
  DRIVE_SYSTEM_ID,
  FTL_SYSTEM_ID,
  advanceCoreSystems,
  checkableSystems,
  damageControlPhase,
  isDerelict,
  isOutOfControl,
  isPermanentlyOutOfControl,
  lifeSupportFailsOnTurn,
  outOfControlTurnsRemaining,
  reactorExplosionPhase,
  repairSystem,
  rollThresholdChecks,
  systemBoxesLost,
  thresholdCheckForShip,
  thresholdPhase,
} from './threshold'

// ---------------------------------------------------------------------------
// Dice a test can read
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands out the faces it was given, in order. `d6` reads the
 * generator through `int(6)`, so a face `f` is the fraction `(f - 1) / 6`
 * nudged clear of the boundary.
 */
class ScriptedRng extends Rng {
  private readonly faces: number[]
  private index = 0

  constructor(faces: number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index]
    if (face === undefined) throw new Error(`scripted RNG ran out of dice after ${this.index}`)
    this.index += 1
    return (face - 1) / 6 + 1e-9
  }

  get used(): number {
    return this.index
  }
}

/** An `Rng` that rolls the same face for ever — for boundary tests. */
class FixedRng extends Rng {
  constructor(private readonly face: number) {
    super(1)
  }

  override next(): number {
    return (this.face - 1) / 6 + 1e-9
  }
}

// ---------------------------------------------------------------------------
// Ships
// ---------------------------------------------------------------------------

function design(overrides: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'test-class',
    name: 'Test Class',
    faction: 'test',
    group: 'cruiser',
    mass: 40,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 12,
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 2,
    marineParties: 0,
    points: 100,
    ...overrides,
  }
}

function ship(overrides: Partial<ShipDesign> = {}, id = 'ship-1'): ShipState {
  return createShipState({
    id,
    side: 'red',
    design: design(overrides),
    placement: { position: { x: 0, y: 0 }, facing: 12 },
  })
}

function beam(id: string, rating = 2): ShipDesign['weapons'][number] {
  return {
    id,
    label: `Class-${rating} Beam`,
    weaponClass: 'beam',
    rating,
    variant: 'standard',
    arcs: ['F'],
    mass: rating,
    points: rating * 3,
  }
}

function game(ships: ShipState[], rng: Rng): GameState {
  const state = createGame({
    seed: 1,
    sides: [{ id: 'red' }, { id: 'blue' }],
    ships,
  })
  state.rng = rng
  state.phase = 'threshold'
  return state
}

// ---------------------------------------------------------------------------

describe('threshold targets (4.11)', () => {
  it('knocks systems out on 6, then 5+, then 4+', () => {
    expect(thresholdTarget(1)).toBe(6)
    expect(thresholdTarget(2)).toBe(5)
    expect(thresholdTarget(3)).toBe(4)
  })

  it('makes no check at the end of the last hull row — the ship is destroyed', () => {
    const target = ship()
    markHullBoxes(target, 12)
    expect(target.destroyed).toBe(true)
    expect(pendingThresholdCheck(target)).toBeNull()
    expect(rollThresholdChecks(target, new FixedRng(6), { turn: 1 })).toBeNull()
  })

  it('rolls nothing for a ship that has crossed no row', () => {
    const target = ship()
    markHullBoxes(target, 2)
    expect(rollThresholdChecks(target, new FixedRng(6), { turn: 1 })).toBeNull()
  })

  it('floors the target at 2 on the deeper tracks of 13.7', () => {
    // A six-row hull reaches a fifth threshold point, which the book never
    // writes a target for; 7 − 5 = 2, and the floor keeps it a check rather
    // than an automatic loss.
    const target = ship({ hullRows: 6, weapons: [beam('beam-1')] })
    // One row at a time, so the fifth point carries no extra-row bonus.
    for (let point = 1; point <= 4; point++) {
      markHullBoxes(target, 2)
      rollThresholdChecks(target, new FixedRng(1), { turn: point })
    }
    markHullBoxes(target, 2)
    const survived = rollThresholdChecks(target, new FixedRng(1), { turn: 5 })
    expect(survived?.rowsLost).toBe(5)
    expect(survived?.target).toBe(2)
    expect(survived?.checks.some((check) => check.destroyed)).toBe(false)

    // And the sixth row is the last, so it is death rather than a check.
    markHullBoxes(target, 2)
    expect(target.destroyed).toBe(true)
    expect(rollThresholdChecks(target, new FixedRng(6), { turn: 2 })).toBeNull()
  })
})

describe("the rulebook's 12-hull-box example (4.11)", () => {
  // "A ship with 12 hull boxes in four rows of three takes 7 damage points
  // from another ship in one attack, crossing off two complete rows. At the
  // end of the second row systems are normally lost on a roll of 5 or 6, but
  // this time they will be lost on 4-6. If the ship is fired on again and
  // takes 3 more points of damage, the third row will be crossed off, but
  // since only one row was lost the threshold check rolls will be as normal,
  // 4+."
  function damagedShip(): ShipState {
    const target = ship({ weapons: [beam('beam-1')] })
    markHullBoxes(target, 7)
    return target
  }

  it('crosses off two rows and checks once, at 5+ with a +1', () => {
    const target = damagedShip()
    expect(target.hullMarked).toBe(7)
    expect(pendingThresholdCheck(target)).toEqual({ rowsLost: 2, extraRows: 1 })

    const result = rollThresholdChecks(target, new FixedRng(4), { turn: 1 })
    expect(result).not.toBeNull()
    expect(result?.target).toBe(5)
    expect(result?.extraRows).toBe(1)
    // Every die was a natural 4: +1 for the extra row makes 5, which is the
    // second row's target, so everything is knocked out — "lost on 4-6".
    expect(result?.checks.every((check) => check.destroyed)).toBe(true)
  })

  it('leaves everything standing on a natural 3 at the same point', () => {
    const result = rollThresholdChecks(damagedShip(), new FixedRng(3), { turn: 1 })
    expect(result?.checks.some((check) => check.destroyed)).toBe(false)
  })

  it('then checks the third row as normal, 4+, with no bonus', () => {
    const target = damagedShip()
    rollThresholdChecks(target, new FixedRng(1), { turn: 1 })

    markHullBoxes(target, 3)
    expect(target.hullMarked).toBe(10)
    expect(pendingThresholdCheck(target)).toEqual({ rowsLost: 3, extraRows: 0 })

    const result = rollThresholdChecks(target, new FixedRng(4), { turn: 2 })
    expect(result?.target).toBe(4)
    expect(result?.extraRows).toBe(0)
    expect(result?.checks.every((check) => check.destroyed)).toBe(true)
  })

  it('survives a natural 3 on the third row too', () => {
    const target = damagedShip()
    rollThresholdChecks(target, new FixedRng(1), { turn: 1 })
    markHullBoxes(target, 3)
    const result = rollThresholdChecks(target, new FixedRng(3), { turn: 2 })
    expect(result?.checks.some((check) => check.destroyed)).toBe(false)
  })

  it('marks the rows as checked so the next check is the next row', () => {
    const target = damagedShip()
    rollThresholdChecks(target, new FixedRng(1), { turn: 1 })
    expect(target.hullRowsChecked).toBe(2)
    expect(target.pendingThresholdRows).toBe(0)
    // The fourth row is the last: the ship dies rather than checking.
    markHullBoxes(target, 5)
    expect(target.destroyed).toBe(true)
    expect(rollThresholdChecks(target, new FixedRng(6), { turn: 3 })).toBeNull()
  })
})

describe('which symbols are rolled for (4.11, 2.4, 6.6)', () => {
  it('rolls one die for each system, weapon, turret, the drive and FTL', () => {
    const target = ship({
      ftl: 'standard',
      weapons: [beam('beam-1'), beam('beam-2')],
      turrets: [{ id: 'turret-1', arcs: ['F', 'FS'], capacity: 6, mass: 2, points: 6 }],
      systems: [
        { id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
        { id: 'pds-1', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
      ],
    })
    expect(checkableSystems(target).map((entry) => entry.id)).toEqual([
      DRIVE_SYSTEM_ID,
      'beam-1',
      'beam-2',
      'turret-1',
      'fc-1',
      'pds-1',
      FTL_SYSTEM_ID,
    ])
  })

  it('does not roll for armour boxes (4.8) or the hull itself', () => {
    const target = ship({ armour: { layers: [4, 2], regenerative: false } })
    expect(checkableSystems(target)).toHaveLength(1)
    expect(checkableSystems(target)[0].id).toBe(DRIVE_SYSTEM_ID)
  })

  it('does not roll for a system already crossed off', () => {
    const target = ship({ systems: [{ id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }] })
    target.destroyedSystems.add('fc-1')
    expect(checkableSystems(target).map((entry) => entry.id)).toEqual([DRIVE_SYSTEM_ID])
  })

  it('does not roll for a one-shot mount that has been fired (6.6)', () => {
    const spent = { ...beam('hm-1'), weaponClass: 'heavy-missile' as const, ammo: 0 }
    const loaded = { ...beam('hm-2'), weaponClass: 'heavy-missile' as const, ammo: 1 }
    const target = ship({ weapons: [spent, loaded] })
    expect(checkableSystems(target).map((entry) => entry.id)).toEqual([DRIVE_SYSTEM_ID, 'hm-2'])
  })

  it('stops rolling for a drive that has already taken its two hits', () => {
    const target = ship()
    target.driveHits = 2
    expect(checkableSystems(target)).toHaveLength(0)
  })

  it('rolls a die for every screen generator fitted', () => {
    const target = ship({
      screens: { level: 2, generators: 3, advanced: false },
      systems: [1, 2, 3].map((n) => ({
        id: `screen-${n}`,
        kind: 'screen-generator' as const,
        label: 'Screen generator',
        mass: 3,
        points: 9,
      })),
    })
    expect(checkableSystems(target).filter((entry) => entry.kind === 'system')).toHaveLength(3)
  })
})

describe('the main drive is the exception (4.11)', () => {
  it('halves the printed thrust on the first failure and disables it on the second', () => {
    const target = ship({ drive: { thrust: 4, advanced: false } })
    markHullBoxes(target, 3)

    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    expect(target.driveHits).toBe(1)
    expect(currentThrust(target)).toBe(2)
    // "with the exception of the ship's main drive system" — it is not crossed
    // off the diagram, it is stepped down.
    expect(isSystemDestroyed(target, DRIVE_SYSTEM_ID)).toBe(false)

    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 2 })
    expect(target.driveHits).toBe(2)
    expect(currentThrust(target)).toBe(0)
  })

  it('halves the *original* rating, not the current one', () => {
    const target = ship({ drive: { thrust: 6, advanced: false } })
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    expect(currentThrust(target)).toBe(3)
  })

  it('rounds the half down', () => {
    const target = ship({ drive: { thrust: 5, advanced: false } })
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    expect(currentThrust(target)).toBe(2)
  })

  it('disables a thrust-1 drive on the first failure', () => {
    const target = ship({ drive: { thrust: 1, advanced: false } })
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    expect(target.driveHits).toBe(2)
    expect(currentThrust(target)).toBe(0)
  })
})

describe('Drive Damage, the optional rule after 4.11', () => {
  function twoRowShip(): ShipState {
    const target = ship({ drive: { thrust: 4, advanced: false } })
    markHullBoxes(target, 7) // two rows in one attack
    return target
  }

  it('is off unless asked for: one die for the drive', () => {
    const target = twoRowShip()
    const rng = new ScriptedRng([4])
    const result = rollThresholdChecks(target, rng, { turn: 1 })
    expect(result?.checks).toHaveLength(1)
    expect(rng.used).toBe(1)
    expect(target.driveHits).toBe(1)
  })

  it('rolls twice for the drive when two or more rows went in one attack', () => {
    const target = twoRowShip()
    // Both dice are natural 4s: +1 for the extra row makes 5, the second row's
    // target. "The first hit reduces the available thrust by half; the second
    // reduces it to 0."
    const rng = new ScriptedRng([4, 4])
    const result = rollThresholdChecks(target, rng, { turn: 1, driveDamage: true })
    expect(result?.checks.filter((check) => check.kind === 'drive')).toHaveLength(2)
    expect(target.driveHits).toBe(2)
    expect(currentThrust(target)).toBe(0)
  })

  it('takes only the failures: one hit out of two rolls still halves thrust', () => {
    const target = twoRowShip()
    const result = rollThresholdChecks(target, new ScriptedRng([4, 3]), {
      turn: 1,
      driveDamage: true,
    })
    expect(result?.driveHits).toEqual({ before: 0, after: 1 })
    expect(currentThrust(target)).toBe(2)
  })

  it('rolls once when only a single row was crossed', () => {
    const target = ship()
    markHullBoxes(target, 3)
    const rng = new ScriptedRng([6])
    rollThresholdChecks(target, rng, { turn: 1, driveDamage: true })
    expect(rng.used).toBe(1)
  })
})

describe('modifiers on the check (4.11, 7.9, 13.13)', () => {
  it('adds 1 to every die for each extra row crossed in the attack', () => {
    const target = ship({ weapons: [beam('beam-1')] })
    markHullBoxes(target, 7)
    const result = rollThresholdChecks(target, new FixedRng(4), { turn: 1 })
    const check = result?.checks.find((entry) => entry.id === 'beam-1')
    expect(check?.roll).toBe(4)
    expect(check?.modified).toBe(5)
    expect(check?.destroyed).toBe(true)
  })

  it('protects a Core System with its −1 (7.9)', () => {
    expect(CORE_SYSTEM_DRM).toBe(-1)
    const target = ship({ coreSystems: { bridge: true, lifeSupport: false, powerCore: false } })
    markHullBoxes(target, 3) // first threshold point: systems lost on a 6
    // Drive die first, then the bridge: a natural 6 becomes a 5 and holds.
    const result = rollThresholdChecks(target, new ScriptedRng([1, 6]), { turn: 1 })
    const bridge = result?.checks.find((check) => check.id === CORE_SYSTEM_IDS.bridge)
    expect(bridge?.roll).toBe(6)
    expect(bridge?.modified).toBe(5)
    expect(bridge?.destroyed).toBe(false)
    expect(target.core.bridgeDestroyed).toBe(false)
  })

  it('gives an Antimatter Suicide Charge the same −1 (7.9)', () => {
    const target = ship({
      systems: [
        { id: 'amsc-1', kind: 'antimatter-charge', label: 'Antimatter Charge', mass: 3, points: 15 },
      ],
    })
    markHullBoxes(target, 3)
    const result = rollThresholdChecks(target, new ScriptedRng([1, 6]), { turn: 1 })
    expect(result?.checks.find((check) => check.id === 'amsc-1')?.destroyed).toBe(false)
  })

  it('makes a Flawed Design lose systems one pip sooner (13.13)', () => {
    const flawed = ship({ flawed: true, weapons: [beam('beam-1')] })
    markHullBoxes(flawed, 3)
    const result = rollThresholdChecks(flawed, new ScriptedRng([1, 5]), { turn: 1 })
    const check = result?.checks.find((entry) => entry.id === 'beam-1')
    expect(check?.modified).toBe(6)
    expect(check?.destroyed).toBe(true)

    const sound = ship({ weapons: [beam('beam-1')] })
    markHullBoxes(sound, 3)
    const clean = rollThresholdChecks(sound, new ScriptedRng([1, 5]), { turn: 1 })
    expect(clean?.checks.find((entry) => entry.id === 'beam-1')?.destroyed).toBe(false)
  })
})

describe('systems with two damage boxes (7.21)', () => {
  function cloakShip(): ShipState {
    return ship({
      systems: [
        { id: 'cloak-1', kind: 'cloaking-field', label: 'Cloaking Field', mass: 1, points: 40 },
      ],
    })
  }

  it('rolls for BOTH boxes and degrades before it dies', () => {
    const target = cloakShip()
    markHullBoxes(target, 3)
    // drive, cloak box 1, cloak box 2.
    const result = rollThresholdChecks(target, new ScriptedRng([1, 6, 3]), { turn: 1 })
    expect(result?.checks.filter((check) => check.id === 'cloak-1')).toHaveLength(2)
    expect(systemBoxesLost(target, 'cloak-1', 2)).toBe(1)
    expect(isSystemDestroyed(target, 'cloak-1')).toBe(false)
  })

  it('loses the system when the last box goes', () => {
    const target = cloakShip()
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 3]), { turn: 1 })
    markHullBoxes(target, 3)
    // Only the surviving box is rolled for this time.
    const rng = new ScriptedRng([1, 6])
    rollThresholdChecks(target, rng, { turn: 2 })
    expect(rng.used).toBe(2)
    expect(systemBoxesLost(target, 'cloak-1', 2)).toBe(2)
    expect(isSystemDestroyed(target, 'cloak-1')).toBe(true)
  })

  it('gives one box back per successful repair (10.4)', () => {
    const target = cloakShip()
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 6]), { turn: 1 })
    expect(isSystemDestroyed(target, 'cloak-1')).toBe(true)

    const attempt = repairSystem(target, 'cloak-1', 3, new ScriptedRng([2]), { turn: 2 })
    expect(attempt.repaired).toBe(true)
    expect(isSystemDestroyed(target, 'cloak-1')).toBe(false)
    expect(systemBoxesLost(target, 'cloak-1', 2)).toBe(1)
  })
})

describe('Core Systems: the bridge (10.3)', () => {
  function bridgeShip(): ShipState {
    return ship({
      drive: { thrust: 4, advanced: false },
      coreSystems: { bridge: true, lifeSupport: false, powerCore: false },
    })
  }

  it('leaves the ship out of control for as many turns as the d6 shows', () => {
    const target = bridgeShip()
    markHullBoxes(target, 9) // third threshold point: 4+
    // drive survives, bridge fails (6 − 1 = 5), then the effect roll: a 3.
    const result = rollThresholdChecks(target, new ScriptedRng([1, 6, 3]), { turn: 4 })
    expect(target.core.bridgeDestroyed).toBe(true)
    expect(result?.coreEvents[0]).toMatchObject({ system: 'bridge', roll: 3, turns: 3 })

    // Orders for turn 4 were written in phase 1, so the count starts next turn.
    expect(isOutOfControl(target, 5)).toBe(true)
    expect(outOfControlTurnsRemaining(target, 5)).toBe(3)
    expect(outOfControlTurnsRemaining(target, 7)).toBe(1)
    expect(isOutOfControl(target, 8)).toBe(false)
    expect(isPermanentlyOutOfControl(target)).toBe(false)
    // Nobody at the helm: the ship holds course and spends no thrust.
    expect(currentThrust(target)).toBe(0)
  })

  it('gives back control when the count runs out', () => {
    const target = bridgeShip()
    markHullBoxes(target, 9)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 1]), { turn: 4 })
    expect(isOutOfControl(target, 5)).toBe(true)

    const events = advanceCoreSystems(target, 6)
    expect(events[0]).toMatchObject({ system: 'bridge', text: 'control regained' })
    expect(isOutOfControl(target, 6)).toBe(false)
    expect(currentThrust(target)).toBe(4)
  })

  it('is permanent on a 6, and damage control cannot fix that', () => {
    const target = bridgeShip()
    markHullBoxes(target, 9)
    const result = rollThresholdChecks(target, new ScriptedRng([1, 6, 6]), { turn: 4 })
    expect(result?.coreEvents[0]).toMatchObject({ permanent: true, roll: 6 })
    expect(isPermanentlyOutOfControl(target)).toBe(true)
    expect(isOutOfControl(target, 99)).toBe(true)

    const attempt = repairSystem(target, CORE_SYSTEM_IDS.bridge, 3, new ScriptedRng([1]), {
      turn: 5,
    })
    expect(attempt.repaired).toBe(false)
    expect(attempt.refused).toBe('permanently-out-of-control')
    expect(attempt.roll).toBeUndefined()
  })

  it('lets damage control fix a temporary loss of control', () => {
    const target = bridgeShip()
    markHullBoxes(target, 9)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 4]), { turn: 4 })
    const attempt = repairSystem(target, CORE_SYSTEM_IDS.bridge, 2, new ScriptedRng([2]), {
      turn: 4,
    })
    expect(attempt.repaired).toBe(true)
    expect(target.core.bridgeDestroyed).toBe(false)
    expect(isOutOfControl(target, 5)).toBe(false)
    expect(currentThrust(target)).toBe(4)
  })
})

describe('Core Systems: life support (10.3)', () => {
  function lifeShip(): ShipState {
    return ship({
      weapons: [beam('beam-1')],
      coreSystems: { bridge: false, lifeSupport: true, powerCore: false },
    })
  }

  it('fails the stated number of turns after the hit', () => {
    const target = lifeShip()
    markHullBoxes(target, 9)
    // drive, beam, life support (6 − 1 = 5, fails at 4+), then the d6: a 2.
    const result = rollThresholdChecks(target, new ScriptedRng([1, 1, 6, 2]), { turn: 4 })
    expect(result?.coreEvents[0]).toMatchObject({ system: 'life-support', roll: 2, turns: 2 })
    expect(lifeSupportFailsOnTurn(target)).toBe(6)

    expect(advanceCoreSystems(target, 5)).toHaveLength(0)
    expect(isDerelict(target)).toBe(false)

    const events = advanceCoreSystems(target, 6)
    expect(events[0]?.system).toBe('life-support')
    expect(isDerelict(target)).toBe(true)
    // A derelict: no thrust and no gunnery, but still on the table.
    expect(currentThrust(target)).toBe(0)
    expect(target.destroyed).toBe(false)
    expect(target.ongoing.some((effect) => effect.weaponsOffline?.includes('beam-1'))).toBe(true)
  })

  it('is cancelled outright by a successful repair', () => {
    const target = lifeShip()
    markHullBoxes(target, 9)
    rollThresholdChecks(target, new ScriptedRng([1, 1, 6, 1]), { turn: 4 })
    const attempt = repairSystem(target, CORE_SYSTEM_IDS.lifeSupport, 3, new ScriptedRng([3]), {
      turn: 4,
    })
    expect(attempt.repaired).toBe(true)
    expect(lifeSupportFailsOnTurn(target)).toBeNull()
    expect(advanceCoreSystems(target, 9)).toHaveLength(0)
    expect(isDerelict(target)).toBe(false)
  })

  it('leaves nobody to make repairs once it has failed', () => {
    const target = lifeShip()
    markHullBoxes(target, 9)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 6, 1]), { turn: 4 })
    advanceCoreSystems(target, 6)
    expect(isDerelict(target)).toBe(true)

    const attempt = repairSystem(target, 'beam-1', 3, new ScriptedRng([1]), { turn: 6 })
    expect(attempt.repaired).toBe(false)
    expect(attempt.refused).toBe('no-crew')
  })
})

describe('Core Systems: the power core (10.3, phase 15)', () => {
  function coreShip(): ShipState {
    return ship({ coreSystems: { bridge: false, lifeSupport: false, powerCore: true } })
  }

  function breach(target: ShipState): void {
    markHullBoxes(target, 9)
    // The power core's knockout rolls no consequence die — the roll comes at
    // the end of every turn instead.
    rollThresholdChecks(target, new ScriptedRng([1, 6]), { turn: 1 })
  }

  it('destroys the ship on a 5 or 6 at the end of the turn', () => {
    const target = coreShip()
    breach(target)
    expect(target.core.powerCoreDestroyed).toBe(true)
    expect(target.core.reactorExplosionPending).toBe(true)

    const state = game([target], new ScriptedRng([5]))
    const [result] = reactorExplosionPhase(state)
    expect(result).toMatchObject({ roll: 5, exploded: true })
    expect(target.destroyed).toBe(true)
    expect(target.hullMarked).toBe(target.design.hullBoxes)
  })

  it('holds on a 4 and is rolled again next turn', () => {
    const target = coreShip()
    breach(target)

    const state = game([target], new ScriptedRng([4, 6]))
    expect(reactorExplosionPhase(state)[0]).toMatchObject({ exploded: false })
    expect(target.destroyed).toBe(false)
    expect(target.core.reactorExplosionPending).toBe(true)

    state.turn += 1
    expect(reactorExplosionPhase(state)[0]).toMatchObject({ exploded: true })
    expect(target.destroyed).toBe(true)
  })

  it('is never rolled for once damage control has mended it', () => {
    const target = coreShip()
    breach(target)
    const attempt = repairSystem(target, CORE_SYSTEM_IDS.powerCore, 1, new ScriptedRng([1]), {
      turn: 1,
    })
    expect(attempt.repaired).toBe(true)
    expect(target.core.reactorExplosionPending).toBe(false)

    const state = game([target], new ScriptedRng([6]))
    expect(reactorExplosionPhase(state)).toHaveLength(0)
    expect(target.destroyed).toBe(false)
  })
})

describe('damage control (10.4, phase 14)', () => {
  function damagedShip(): ShipState {
    const target = ship({
      systems: [{ id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
    })
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    return target
  }

  it('repairs on a d6 at or below the number of parties', () => {
    for (const parties of [1, 2, 3]) {
      for (const roll of [1, 2, 3, 4, 5, 6]) {
        const target = damagedShip()
        const attempt = repairSystem(target, 'fc-1', parties, new ScriptedRng([roll]), { turn: 2 })
        expect(attempt.repaired).toBe(roll <= parties)
        expect(isSystemDestroyed(target, 'fc-1')).toBe(roll > parties)
      }
    }
  })

  it('takes back one drive hit at a time (3.6)', () => {
    const target = ship({ drive: { thrust: 4, advanced: false } })
    markHullBoxes(target, 7)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1, driveDamage: true })
    expect(target.driveHits).toBe(2)

    expect(repairSystem(target, DRIVE_SYSTEM_ID, 3, new ScriptedRng([1]), { turn: 2 }).repaired).toBe(
      true,
    )
    expect(target.driveHits).toBe(1)
    expect(currentThrust(target)).toBe(2)

    expect(repairSystem(target, DRIVE_SYSTEM_ID, 3, new ScriptedRng([1]), { turn: 3 }).repaired).toBe(
      true,
    )
    expect(currentThrust(target)).toBe(4)
  })

  it('refuses a system that is not damaged, without spending a die', () => {
    const target = ship({
      systems: [{ id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
    })
    const attempt = repairSystem(target, 'fc-1', 3, new ScriptedRng([]), { turn: 1 })
    expect(attempt).toMatchObject({ repaired: false, refused: 'not-damaged' })
  })

  it('refuses damage the weapon rules put beyond repair (5.13)', () => {
    const target = damagedShip()
    const attempt = repairSystem(target, 'fc-1', 3, new ScriptedRng([]), {
      turn: 2,
      unrepairable: new Set(['fc-1']),
    })
    expect(attempt).toMatchObject({ repaired: false, refused: 'unrepairable' })
    expect(isSystemDestroyed(target, 'fc-1')).toBe(true)
  })

  it('resolves every assignment in phase 14 and then frees the parties', () => {
    const target = ship({
      additionalDamageControlParties: 3,
      systems: [
        { id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
        { id: 'pds-1', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
      ],
    })
    markHullBoxes(target, 3)
    rollThresholdChecks(target, new FixedRng(6), { turn: 1 })
    target.damageControl = [
      { systemId: 'fc-1', parties: 2 },
      { systemId: 'pds-1', parties: 1 },
    ]

    const state = game([target], new ScriptedRng([2, 4]))
    const attempts = damageControlPhase(state)
    expect(attempts.map((attempt) => attempt.repaired)).toEqual([true, false])
    expect(isSystemDestroyed(target, 'fc-1')).toBe(false)
    expect(isSystemDestroyed(target, 'pds-1')).toBe(true)
    expect(target.damageControl).toHaveLength(0)
    expect(state.log.some((entry) => entry.kind === 'damage-control')).toBe(true)
  })
})

describe('phase 13 across the fleet (2.6)', () => {
  it('rolls for every ship that owes a check and logs the result', () => {
    const hit = ship({ weapons: [beam('beam-1')] }, 'hit')
    const untouched = ship({ weapons: [beam('beam-2')] }, 'clear')
    markHullBoxes(hit, 3)

    const state = game([hit, untouched], new FixedRng(6))
    const results = thresholdPhase(state)
    expect(results).toHaveLength(1)
    expect(results[0].shipId).toBe('hit')
    expect(isSystemDestroyed(hit, 'beam-1')).toBe(true)
    expect(isSystemDestroyed(untouched, 'beam-2')).toBe(false)
    expect(state.log.some((entry) => entry.kind === 'threshold')).toBe(true)
  })

  it('runs the Core Systems clocks even for a ship that took no damage', () => {
    const target = ship({ coreSystems: { bridge: false, lifeSupport: true, powerCore: false } })
    markHullBoxes(target, 9)
    rollThresholdChecks(target, new ScriptedRng([1, 6, 1]), { turn: 4 })
    expect(isDerelict(target)).toBe(false)

    const state = game([target], new ScriptedRng([]))
    state.turn = 5
    expect(thresholdPhase(state)).toHaveLength(0)
    expect(isDerelict(target)).toBe(true)
  })

  it('checks one ship on the spot for phases 10 and 15', () => {
    const target = ship({ weapons: [beam('beam-1')] }, 'hit')
    markHullBoxes(target, 3)

    const state = game([target], new FixedRng(6))
    state.phase = 'ordnance-vs-ships'
    const result = thresholdCheckForShip(state, target)
    expect(result?.rowsLost).toBe(1)
    expect(isSystemDestroyed(target, 'beam-1')).toBe(true)
    // The rows are settled, so phase 13 does not check them a second time.
    expect(thresholdPhase(state)).toHaveLength(0)
  })

  it('skips ships that are destroyed or off the table', () => {
    const dead = ship({}, 'dead')
    markHullBoxes(dead, 12)
    const gone = ship({}, 'gone')
    markHullBoxes(gone, 3)
    gone.offTable = true

    const state = game([dead, gone], new ScriptedRng([]))
    expect(thresholdPhase(state)).toHaveLength(0)
  })
})

describe('Core Systems on every hull (10.3)', () => {
  const bare = () =>
    ship({ systems: [{ id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }] })

  it('rolls for the bridge, life support and power core of a design that names none', () => {
    // "assumed to be part of the essential structure of all ships" — a design
    // that says nothing about its core has all three of it.
    const ids = checkableSystems(bare(), { coreSystems: true }).map((entry) => entry.id)
    expect(ids).toEqual([
      DRIVE_SYSTEM_ID,
      'fc-1',
      CORE_SYSTEM_IDS.bridge,
      CORE_SYSTEM_IDS.lifeSupport,
      CORE_SYSTEM_IDS.powerCore,
    ])
    for (const entry of checkableSystems(bare(), { coreSystems: true })) {
      if (entry.kind === 'core') expect(entry.drm).toBe(CORE_SYSTEM_DRM)
    }
  })

  it('rolls for nothing extra when the table does not play with them', () => {
    // "If you do not wish to use the Core System rules, simply ignore the
    // systems within the Core box" — and a journal written before the block
    // was on every hull must keep drawing exactly the dice it drew.
    expect(checkableSystems(bare()).map((entry) => entry.id)).toEqual([DRIVE_SYSTEM_ID, 'fc-1'])
    expect(checkableSystems(bare(), { coreSystems: false }).map((entry) => entry.id)).toEqual([
      DRIVE_SYSTEM_ID,
      'fc-1',
    ])
  })

  it('lets a design that names its own block keep it, whatever the table says', () => {
    const named = ship({ coreSystems: { bridge: true, lifeSupport: false, powerCore: false } })
    const ids = checkableSystems(named, { coreSystems: true }).map((entry) => entry.id)
    expect(ids).toContain(CORE_SYSTEM_IDS.bridge)
    expect(ids).not.toContain(CORE_SYSTEM_IDS.lifeSupport)
    expect(ids).not.toContain(CORE_SYSTEM_IDS.powerCore)
  })

  it('draws three more dice at a threshold point, and only then', () => {
    const withCore = bare()
    const without = bare()
    markHullBoxes(withCore, hullRowsOf(withCore)[0])
    markHullBoxes(without, hullRowsOf(without)[0])
    const a = rollThresholdChecks(withCore, new Rng(7), { turn: 1, coreSystems: true })
    const b = rollThresholdChecks(without, new Rng(7), { turn: 1 })
    expect(a?.checks.length).toBe((b?.checks.length ?? 0) + 3)
    // Same seed, same first dice: the core's three come after everything the
    // sheet already rolled, so the rest of the sweep is unchanged.
    expect(a?.checks.slice(0, b?.checks.length).map((c) => c.roll)).toEqual(
      b?.checks.map((c) => c.roll),
    )
  })
})

function hullRowsOf(target: ShipState): number[] {
  const bounds: number[] = []
  const rows = target.design.hullRows
  const boxes = target.design.hullBoxes
  const base = Math.floor(boxes / rows)
  const extra = boxes % rows
  let sum = 0
  for (let row = 0; row < rows; row += 1) {
    sum += base + (row < extra ? 1 : 0)
    bounds.push(sum)
  }
  return bounds
}
