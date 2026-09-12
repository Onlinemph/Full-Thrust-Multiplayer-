/**
 * Tests for the kinetic and exotic weapons of sections 5.14 – 5.23.
 *
 * Every worked example in the rulebook text for this section is here as a test
 * case — the K-6's twelve points, the class-4 K-Gun against level-2 Advanced
 * Screens, the overloaded torpedo's 3-to-8 damage range, the battleship with
 * three Medium Spinal Mounts — and so is every table.
 *
 * Dice are scripted rather than seeded: `ScriptedRng` hands back the faces a
 * test names, so a test can say "hit on a 4, double on a 2" and read exactly
 * what the rulebook says should come out.
 */

import { describe, expect, it } from 'vitest'
import { Rng } from '../dice'
import type { Arc, TurretDef, WeaponDef } from '../types'
import {
  BOARDING_TORPEDO_MARINES,
  FLAK_BLAST_RADIUS_MU,
  FLAK_MARKER_RANGE,
  FLAK_UPGRADE_POINTS,
  FUSION_ARRAY_TABLE,
  KINETIC_COST_PER_MASS,
  KINETIC_WEAPON_SPECS,
  K_GUN_PD_DRM,
  MKP_DAMAGE_PER_HIT,
  MKP_RANGE_MU,
  PROJECTILE_BAND_MU,
  PROJECTILE_HIT_TABLE,
  PSP_DICE,
  PULSER_PROFILE,
  SPINAL_ARC_DEGREES,
  SPINAL_BEAM_DICE,
  SPINAL_MOUNT_PROFILE,
  SPINAL_PLASMA_DICE,
  SUBMUNITION_DICE,
  TURRET_CAPACITY,
  canFireOverloaded,
  canMountFlak,
  fireBoardingTorpedo,
  fireFusionArray,
  fireGraviticGun,
  fireKGun,
  fireKGunPointDefence,
  fireMkp,
  firePlasmaSpinal,
  firePsp,
  firePulseTorpedo,
  firePulser,
  fireSpinalBeam,
  fireSubmunitionPack,
  fireVariablePulseTorpedo,
  flakCatchesPath,
  flakCatchesPoint,
  isInSpinalArc,
  kGunCanPointDefend,
  kGunDoubles,
  kGunMass,
  kineticSpecFor,
  maxSpinalMountMass,
  maxTurrets,
  overloadedLine,
  projectileMaxRange,
  projectileToHit,
  pspDamageDicePerHit,
  pulseTorpedoMass,
  pulserCanPointDefend,
  pulserMass,
  flakBarrageDice,
  rollFusionArrayVsFighters,
  rollPlasmaDice,
  rollPointDefenceDice,
  rollProjectileHit,
  spinalBeamCatches,
  spinalCanFire,
  spinalLocksShip,
  turretFiringArcs,
  turretMass,
  turretMountedArcs,
  turretPoints,
  type KineticContext,
  type KineticWeaponResult,
} from './kinetics'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands back the die faces a test names, in order. `d6` reads a
 * face off `next()`, so returning `(face − 1) / 6` plus a hair lands exactly on
 * that face.
 */
class ScriptedRng extends Rng {
  private queue: number[]

  constructor(faces: number[]) {
    super(1)
    this.queue = [...faces]
  }

  override next(): number {
    const face = this.queue.shift()
    if (face === undefined) throw new Error('ScriptedRng ran out of faces')
    return (face - 1) / 6 + 1e-9
  }
}

function weapon(overrides: Partial<WeaponDef> = {}): WeaponDef {
  return {
    id: 'w1',
    label: 'test mount',
    weaponClass: 'k-gun',
    rating: 1,
    variant: 'standard',
    arcs: ['F'],
    mass: 1,
    points: 1,
    ...overrides,
  }
}

function context(rng: Rng, overrides: Partial<KineticContext> = {}): KineticContext {
  return {
    range: 5,
    arc: 'F',
    targetScreens: 0,
    rearArc: false,
    drm: 0,
    rng,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// The projectile table (5.14, 5.16, 5.18)
// ---------------------------------------------------------------------------

describe('Projectile Weapon Hit Probability Table (5.14, 5.16, 5.18)', () => {
  it('bands 6 MU and worsens one point per band', () => {
    expect(PROJECTILE_BAND_MU).toBe(6)
    expect(PROJECTILE_HIT_TABLE.standard).toEqual([2, 3, 4])
    expect(projectileToHit('standard', 1)).toBe(2)
    expect(projectileToHit('standard', 6)).toBe(2)
    expect(projectileToHit('standard', 6.5)).toBe(3)
    expect(projectileToHit('standard', 12)).toBe(3)
    expect(projectileToHit('standard', 18)).toBe(4)
  })

  it('reaches 12 / 18 / 24 MU, which is where 5.16 places its Blast Markers', () => {
    expect(projectileMaxRange('short')).toBe(FLAK_MARKER_RANGE.short)
    expect(projectileMaxRange('standard')).toBe(FLAK_MARKER_RANGE.standard)
    expect(projectileMaxRange('long')).toBe(FLAK_MARKER_RANGE.long)
    expect(projectileToHit('short', 12.5)).toBeNull()
    expect(projectileToHit('standard', 18.5)).toBeNull()
    expect(projectileToHit('long', 24)).toBe(5)
    expect(projectileToHit('long', 24.5)).toBeNull()
  })

  it('applies DRMs to the to-hit roll (1.7)', () => {
    const hit = rollProjectileHit('standard', 15, new ScriptedRng([3]), 1)
    expect(hit).toEqual({ face: 3, modified: 4, target: 4, hit: true })
    const miss = rollProjectileHit('standard', 15, new ScriptedRng([3]), -1)
    expect(miss?.hit).toBe(false)
    expect(rollProjectileHit('standard', 30, new ScriptedRng([6]))).toBeNull()
  })

  it('steps one line down when overloaded (5.14)', () => {
    expect(overloadedLine('long')).toBe('standard')
    expect(overloadedLine('standard')).toBe('short')
    expect(overloadedLine('short')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5.14 Pulse Torpedoes
// ---------------------------------------------------------------------------

describe('Pulse Torpedoes (5.14)', () => {
  const tube = weapon({ weaponClass: 'pulse-torpedo', label: 'Pulse Torpedo', mass: 4 })

  it('hits on the standard line and does 1D6 SAP', () => {
    const result = firePulseTorpedo(tube, context(new ScriptedRng([4, 5]), { range: 10 }))
    expect(result).not.toBeNull()
    expect(result?.mode).toBe('SAP')
    expect(result?.normalDamage).toBe(5)
    expect(result?.dice).toEqual([4, 5])
  })

  it('misses without rolling damage', () => {
    const result = firePulseTorpedo(tube, context(new ScriptedRng([2]), { range: 15 }))
    expect(result?.normalDamage).toBe(0)
    expect(result?.dice).toEqual([2])
  })

  it('ignores Standard Screens but loses a point per Advanced Screen level (7.2, 7.3)', () => {
    const screened = firePulseTorpedo(
      tube,
      context(new ScriptedRng([6, 3]), { targetScreens: 2 }),
    )
    expect(screened?.normalDamage).toBe(3)

    const advanced = firePulseTorpedo(
      tube,
      context(new ScriptedRng([6, 3]), { targetScreens: 2, advancedScreens: true }),
    )
    expect(advanced?.normalDamage).toBe(1)
  })

  it('never gives damage back: negative damage is zero (7.3)', () => {
    const result = firePulseTorpedo(
      tube,
      context(new ScriptedRng([6, 1]), { targetScreens: 2, advancedScreens: true }),
    )
    expect(result?.normalDamage).toBe(0)
  })

  it('is out of range past its line', () => {
    expect(firePulseTorpedo(tube, context(new ScriptedRng([6]), { range: 19 }))).toBeNull()
    const lr = weapon({ weaponClass: 'pulse-torpedo', variant: 'long', mass: 8 })
    expect(firePulseTorpedo(lr, context(new ScriptedRng([6, 4]), { range: 19 }))).not.toBeNull()
  })

  it('prices mounts off the 5.14 table', () => {
    expect(pulseTorpedoMass('standard', 1)).toBe(4)
    expect(pulseTorpedoMass('standard', 3)).toBe(6)
    expect(pulseTorpedoMass('long', 1)).toBe(8)
    expect(pulseTorpedoMass('long', 3)).toBe(12)
    expect(pulseTorpedoMass('short', 1)).toBe(2)
    expect(pulseTorpedoMass('short', 3)).toBe(3)
    expect(pulseTorpedoMass('variable', 3)).toBe(12)
    expect(KINETIC_COST_PER_MASS['pulse-torpedo']).toBe(3)
    expect(KINETIC_COST_PER_MASS['variable-pulse-torpedo']).toBe(5)
    expect(KINETIC_COST_PER_MASS['pulse-torpedo-overload']).toBe(1)
  })
})

describe('Overloaded Pulse Torpedoes (5.14)', () => {
  const tube = weapon({ weaponClass: 'pulse-torpedo', mass: 4 })

  it('gives "a damage range between 3 and 8 points"', () => {
    const low = firePulseTorpedo(tube, context(new ScriptedRng([6, 1, 4]), { overloaded: true }))
    // A natural 1 on the damage die also calls for the misfire die.
    expect(low?.normalDamage).toBe(3)
    expect(low?.mode).toBe('AP')

    const high = firePulseTorpedo(tube, context(new ScriptedRng([6, 6]), { overloaded: true }))
    expect(high?.normalDamage).toBe(8)
  })

  it('wrecks its own tube on a second 1, and only then', () => {
    const wrecked = firePulseTorpedo(
      tube,
      context(new ScriptedRng([5, 1, 1]), { overloaded: true }),
    ) as KineticWeaponResult | null
    expect(wrecked?.launcherDestroyed).toBe(true)
    expect(wrecked?.normalDamage).toBe(3)

    const survived = firePulseTorpedo(
      tube,
      context(new ScriptedRng([5, 1, 3]), { overloaded: true }),
    ) as KineticWeaponResult | null
    expect(survived?.launcherDestroyed).toBeUndefined()
  })

  it('does not risk the tube on a miss', () => {
    const missed = firePulseTorpedo(
      tube,
      context(new ScriptedRng([1]), { overloaded: true, range: 10 }),
    ) as KineticWeaponResult | null
    // 10 MU is the SR line's second band, needing 3+; a 1 misses and the
    // damage die is never thrown.
    expect(missed?.normalDamage).toBe(0)
    expect(missed?.dice).toEqual([1])
    expect(missed?.launcherDestroyed).toBeUndefined()
  })

  it('reads the next line down, costing it a band of reach', () => {
    const lr = weapon({ weaponClass: 'pulse-torpedo', variant: 'long' })
    expect(firePulseTorpedo(lr, context(new ScriptedRng([6, 4]), { range: 20 }))).not.toBeNull()
    expect(
      firePulseTorpedo(lr, context(new ScriptedRng([6, 4]), { range: 20, overloaded: true })),
    ).toBeNull()
  })

  it('bars short-range tubes from overloading at all', () => {
    const sr = weapon({ weaponClass: 'pulse-torpedo', variant: 'short' })
    expect(firePulseTorpedo(sr, context(new ScriptedRng([6, 4]), { overloaded: true }))).toBeNull()
    expect(canFireOverloaded(sr, false)).toBe(false)
  })

  it('needs a tube that did not fire last turn', () => {
    expect(canFireOverloaded(weapon({ weaponClass: 'pulse-torpedo' }), false)).toBe(true)
    expect(canFireOverloaded(weapon({ weaponClass: 'pulse-torpedo' }), true)).toBe(false)
    expect(canFireOverloaded(weapon({ weaponClass: 'k-gun' }), false)).toBe(false)
  })
})

describe('Variable Strength Pulse Torpedoes (5.14)', () => {
  const vpt = weapon({ weaponClass: 'pulse-torpedo', variant: 'variable', mass: 8 })

  it('defaults to the standard setting and 1D6 SAP', () => {
    const result = fireVariablePulseTorpedo(vpt, context(new ScriptedRng([4, 5]), { range: 15 }))
    expect(result?.normalDamage).toBe(5)
    expect(result?.mode).toBe('SAP')
  })

  it('does 1D3 SAP on the long setting', () => {
    // A d6 of 5 halved and rounded up is 3.
    const result = fireVariablePulseTorpedo(
      vpt,
      context(new ScriptedRng([6, 5]), { range: 22, vptMode: 'long' }),
    )
    expect(result?.normalDamage).toBe(3)
    expect(result?.mode).toBe('SAP')
    // A d6 of 1 or 2 is a D3 of 1.
    const low = fireVariablePulseTorpedo(
      vpt,
      context(new ScriptedRng([6, 2]), { range: 22, vptMode: 'long' }),
    )
    expect(low?.normalDamage).toBe(1)
  })

  it('does 1D6+2 AP on the short setting, through Advanced Screens', () => {
    const result = fireVariablePulseTorpedo(
      vpt,
      context(new ScriptedRng([6, 4]), {
        range: 5,
        vptMode: 'short',
        targetScreens: 2,
        advancedScreens: true,
      }),
    )
    expect(result?.normalDamage).toBe(6)
    expect(result?.mode).toBe('AP')
  })

  it('keeps the long setting inside the long line and the short setting inside the short one', () => {
    expect(
      fireVariablePulseTorpedo(vpt, context(new ScriptedRng([6, 4]), { range: 22, vptMode: 'short' })),
    ).toBeNull()
    expect(
      fireVariablePulseTorpedo(vpt, context(new ScriptedRng([6, 4]), { range: 22, vptMode: 'long' })),
    ).not.toBeNull()
  })

  it('is reached through the pulse-torpedo resolver', () => {
    const result = firePulseTorpedo(vpt, context(new ScriptedRng([5, 4]), { range: 15 }))
    expect(result?.normalDamage).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 5.15 Turreted Submunition Pack
// ---------------------------------------------------------------------------

describe('Turreted Submunition Pack (5.15)', () => {
  const pack = weapon({ weaponClass: 'submunition-pack', mass: 1, arcs: ['F', 'FS', 'FP'] })

  it('throws 3 / 2 / 1 BD at 6 / 12 / 18 MU', () => {
    expect(SUBMUNITION_DICE).toEqual([3, 2, 1])
    const close = fireSubmunitionPack(pack, context(new ScriptedRng([4, 4, 4]), { range: 6 }))
    expect(close?.dice).toHaveLength(3)
    expect(close?.normalDamage).toBe(3)

    const mid = fireSubmunitionPack(pack, context(new ScriptedRng([4, 5]), { range: 12 }))
    expect(mid?.dice).toHaveLength(2)

    const far = fireSubmunitionPack(pack, context(new ScriptedRng([5]), { range: 18 }))
    expect(far?.dice).toHaveLength(1)

    expect(fireSubmunitionPack(pack, context(new ScriptedRng([5]), { range: 19 }))).toBeNull()
  })

  it('re-rolls sixes and lands that damage inside the screens (4.6)', () => {
    const result = fireSubmunitionPack(pack, context(new ScriptedRng([6, 5, 2, 2]), { range: 6 }))
    expect(result?.normalDamage).toBe(2)
    expect(result?.penetratingDamage).toBe(1)
    expect(result?.mode).toBe('P')
  })

  it('ignores Standard Screens and reads Advanced Screens as a beam would (7.3)', () => {
    const standard = fireSubmunitionPack(
      pack,
      context(new ScriptedRng([4, 4, 4]), { range: 6, targetScreens: 2 }),
    )
    expect(standard?.normalDamage).toBe(3)

    const advanced = fireSubmunitionPack(
      pack,
      context(new ScriptedRng([4, 4, 4]), { range: 6, targetScreens: 2, advancedScreens: true }),
    )
    expect(advanced?.normalDamage).toBe(0)
  })

  it('is one shot', () => {
    const spent = weapon({ weaponClass: 'submunition-pack', ammo: 0 })
    expect(fireSubmunitionPack(spent, context(new ScriptedRng([6])))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5.16 K-Guns
// ---------------------------------------------------------------------------

describe('K-Guns (5.16)', () => {
  it('does damage equal to its class, doubled on the doubling roll', () => {
    const k3 = weapon({ rating: 3, mass: 5 })
    const plain = fireKGun(k3, context(new ScriptedRng([4, 5]), { range: 10 }))
    expect(plain?.normalDamage).toBe(3)
    expect(plain?.mode).toBe('AP')

    const doubled = fireKGun(k3, context(new ScriptedRng([4, 2]), { range: 10 }))
    expect(doubled?.normalDamage).toBe(6)
  })

  it('gives a K-6 twelve points on a 1-5, and never doubles on a 6', () => {
    for (const roll of [1, 2, 3, 4, 5]) {
      expect(kGunDoubles(6, 0, roll)).toBe(true)
    }
    expect(kGunDoubles(6, 0, 6)).toBe(false)
    const k6 = weapon({ rating: 6, mass: 14 })
    const result = fireKGun(k6, context(new ScriptedRng([3, 5]), { range: 10 }))
    expect(result?.normalDamage).toBe(12)
  })

  it('follows the Advanced Screen worked example: a K-4 against level 2 doubles on 1-2', () => {
    expect(kGunDoubles(4, 2, 2)).toBe(true)
    expect(kGunDoubles(4, 2, 3)).toBe(false)
    // "a class 1 or 2 K-Gun would not be able to get doubling damage at all"
    expect(kGunDoubles(1, 2, 1)).toBe(false)
    expect(kGunDoubles(2, 2, 1)).toBe(false)

    const k4 = weapon({ rating: 4, mass: 8 })
    const screened = fireKGun(
      k4,
      context(new ScriptedRng([4, 3]), { range: 10, targetScreens: 2, advancedScreens: true }),
    )
    expect(screened?.normalDamage).toBe(4)
    const unscreened = fireKGun(k4, context(new ScriptedRng([4, 3]), { range: 10 }))
    expect(unscreened?.normalDamage).toBe(8)
  })

  it('is unaffected by Standard Screens, doubling included', () => {
    const k4 = weapon({ rating: 4 })
    const result = fireKGun(k4, context(new ScriptedRng([4, 4]), { range: 10, targetScreens: 2 }))
    expect(result?.normalDamage).toBe(8)
  })

  it('has short, standard and long reach', () => {
    expect(fireKGun(weapon({ rating: 3, variant: 'short' }), context(new ScriptedRng([6, 1]), { range: 13 }))).toBeNull()
    expect(fireKGun(weapon({ rating: 3 }), context(new ScriptedRng([6, 1]), { range: 13 }))).not.toBeNull()
    expect(fireKGun(weapon({ rating: 3, variant: 'long' }), context(new ScriptedRng([6, 1]), { range: 22 }))).not.toBeNull()
  })

  it('prices off the printed table, not the rule of thumb', () => {
    expect(kGunMass(1, 'standard', 6)).toBe(2)
    expect(kGunMass(1, 'short', 6)).toBe(1.5)
    expect(kGunMass(1, 'long', 6)).toBe(4)
    expect(kGunMass(2, 'standard', 1)).toBe(3)
    expect(kGunMass(2, 'standard', 2)).toBe(4)
    expect(kGunMass(2, 'short', 2)).toBe(2)
    expect(kGunMass(2, 'long', 2)).toBe(8)
    expect(kGunMass(3, 'standard', 1)).toBe(5)
    expect(kGunMass(4, 'short', 1)).toBe(4)
    expect(kGunMass(5, 'short', 1)).toBe(6)
    expect(kGunMass(6, 'long', 1)).toBe(28)
    expect(KINETIC_COST_PER_MASS['k-gun']).toBe(4)
  })

  it('lets a K-1 stand point defence at -1, but never into the aft arc', () => {
    expect(K_GUN_PD_DRM).toBe(-1)
    const k1 = weapon({ rating: 1, arcs: ['F', 'FS', 'AS', 'A', 'AP', 'FP'] })
    expect(kGunCanPointDefend(k1, 'FS')).toBe(true)
    expect(kGunCanPointDefend(k1, 'A')).toBe(false)
    expect(kGunCanPointDefend(weapon({ rating: 2, arcs: ['F'] }), 'F')).toBe(false)

    // A 5 becomes a 4 and still kills one; a 4 becomes a 3 and kills nothing.
    expect(fireKGunPointDefence(new ScriptedRng([5])).kills).toBe(1)
    expect(fireKGunPointDefence(new ScriptedRng([4])).kills).toBe(0)
  })

  it('scores point-defence dice off the natural six for re-rolls (4.6)', () => {
    const volley = rollPointDefenceDice(1, new ScriptedRng([6, 5]), -1)
    // Natural 6 at −1 kills one rather than two, and still earns the re-roll.
    expect(volley.kills).toBe(2)
    expect(volley.rolls).toEqual([6, 5])
    expect(rollPointDefenceDice(1, new ScriptedRng([6, 1])).kills).toBe(2)
  })
})

describe('Flak ammunition / barrage fire (5.16)', () => {
  it('places its Blast Marker 12 / 18 / 24 MU out', () => {
    expect(FLAK_MARKER_RANGE).toEqual({ short: 12, standard: 18, long: 24 })
    expect(FLAK_BLAST_RADIUS_MU).toBe(2)
    expect(FLAK_UPGRADE_POINTS).toBe(2)
  })

  it('is only for K-Guns of class 2 or larger', () => {
    expect(canMountFlak(weapon({ rating: 2 }))).toBe(true)
    expect(canMountFlak(weapon({ rating: 1 }))).toBe(false)
    expect(canMountFlak(weapon({ weaponClass: 'pulser', rating: 3 }))).toBe(false)
  })

  it('throws PDS dice equal to the gun class', () => {
    // 5.16: "a number of PDS dice equal to the class of the gun that fired
    // the barrage (at a -1 DRM)". The dice are rolled by defences.ts, which
    // owns both point-defence tables; this says only how many there are.
    expect(flakBarrageDice(3)).toBe(3)
    expect(flakBarrageDice(1)).toBe(1)
  })

  it('catches anything within 2 MU of the marker, in flight or at rest', () => {
    const marker = { x: 0, y: 0 }
    expect(flakCatchesPoint(marker, { x: 2, y: 0 })).toBe(true)
    expect(flakCatchesPoint(marker, { x: 2.5, y: 0 })).toBe(false)
    // A fighter that passes straight through is caught even though it starts
    // and ends well clear.
    expect(flakCatchesPath(marker, { x: -10, y: 1 }, { x: 10, y: 1 })).toBe(true)
    expect(flakCatchesPath(marker, { x: -10, y: 5 }, { x: 10, y: 5 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5.17 Multiple Kinetic Penetrators
// ---------------------------------------------------------------------------

describe('Multiple Kinetic Penetrators (5.17)', () => {
  const mkp = weapon({ weaponClass: 'mkp', mass: 1 })

  it('hits on 4+, twice on a 6, for 4 points of AP damage each', () => {
    expect(MKP_DAMAGE_PER_HIT).toBe(4)
    expect(fireMkp(mkp, context(new ScriptedRng([3])))?.normalDamage).toBe(0)
    expect(fireMkp(mkp, context(new ScriptedRng([4])))?.normalDamage).toBe(4)
    expect(fireMkp(mkp, context(new ScriptedRng([5])))?.normalDamage).toBe(4)
    const double = fireMkp(mkp, context(new ScriptedRng([6])))
    expect(double?.normalDamage).toBe(8)
    expect(double?.mode).toBe('AP')
  })

  it('reaches 12 MU flat and ignores screens of any kind', () => {
    expect(MKP_RANGE_MU).toBe(12)
    expect(fireMkp(mkp, context(new ScriptedRng([6]), { range: 12 }))?.normalDamage).toBe(8)
    expect(fireMkp(mkp, context(new ScriptedRng([6]), { range: 12.5 }))).toBeNull()
    const screened = fireMkp(
      mkp,
      context(new ScriptedRng([4]), { targetScreens: 2, advancedScreens: true }),
    )
    expect(screened?.normalDamage).toBe(4)
  })

  it('is one shot', () => {
    expect(fireMkp(weapon({ weaponClass: 'mkp', ammo: 0 }), context(new ScriptedRng([6])))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5.18 Boarding Torpedoes
// ---------------------------------------------------------------------------

describe('Boarding Torpedoes (5.18)', () => {
  const launcher = weapon({
    weaponClass: 'boarding-torpedo',
    mass: 2,
    arcs: ['F', 'FS', 'FP'],
    ammo: 2,
  })

  it('puts one point through the armour and two Marine markers aboard', () => {
    const result = fireBoardingTorpedo(launcher, context(new ScriptedRng([4]), { range: 10 }))
    expect(result?.normalDamage).toBe(0)
    expect(result?.penetratingDamage).toBe(1)
    expect(result?.mode).toBe('AP')
    expect(result?.boarders).toBe(BOARDING_TORPEDO_MARINES)
  })

  it('spends a torpedo on a miss too, so a miss is still a result', () => {
    const miss = fireBoardingTorpedo(launcher, context(new ScriptedRng([2]), { range: 15 }))
    expect(miss).not.toBeNull()
    expect(miss?.penetratingDamage).toBe(0)
    expect(miss?.boarders).toBeUndefined()
  })

  it('stops when the magazine is empty, and has no long or short version', () => {
    const empty = weapon({ weaponClass: 'boarding-torpedo', ammo: 0 })
    expect(fireBoardingTorpedo(empty, context(new ScriptedRng([6])))).toBeNull()
    expect(fireBoardingTorpedo(launcher, context(new ScriptedRng([6]), { range: 19 }))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5.19 Fusion Array
// ---------------------------------------------------------------------------

describe('Fusion Array (5.19)', () => {
  const flare = weapon({ weaponClass: 'fusion-array', mass: 3, variant: 'short' })
  const torpedo = weapon({ weaponClass: 'fusion-array', mass: 3, variant: 'long' })

  it('has the two printed tables', () => {
    expect(FUSION_ARRAY_TABLE.flare.map((row) => row.hitsOn)).toEqual([1, 2, 3, 4, 5, 6])
    expect(FUSION_ARRAY_TABLE.flare.map((row) => row.dice)).toEqual([1, 2, 3, 4, 5, 6])
    expect(FUSION_ARRAY_TABLE.torpedo.map((row) => row.hitsOn)).toEqual([6, 5, 4, 3, 2, 1])
    expect(FUSION_ARRAY_TABLE.torpedo.map((row) => row.dice)).toEqual([6, 5, 4, 3, 2, 1])
  })

  it('fires the Flare: easy to hit close in, heavier far out', () => {
    const close = fireFusionArray(flare, context(new ScriptedRng([1, 4]), { range: 6 }))
    expect(close?.dice).toEqual([1, 4])
    expect(close?.normalDamage).toBe(1)

    const far = fireFusionArray(
      flare,
      context(new ScriptedRng([6, 4, 4, 4, 4, 4, 4]), { range: 36 }),
    )
    // 6 BD* at 30-36 MU, and the to-hit die is reported alongside them.
    expect(far?.dice).toHaveLength(7)
    expect(far?.normalDamage).toBe(6)

    expect(fireFusionArray(flare, context(new ScriptedRng([6]), { range: 36.5 }))).toBeNull()
  })

  it('fires the Torpedo the other way about', () => {
    const close = fireFusionArray(torpedo, context(new ScriptedRng([5]), { range: 3 }))
    expect(close?.normalDamage).toBe(0)
    expect(close?.dice).toEqual([5])

    const hit = fireFusionArray(
      torpedo,
      context(new ScriptedRng([6, 4, 4, 4, 4, 4, 4]), { range: 3 }),
    )
    expect(hit?.normalDamage).toBe(6)
  })

  it('can hit and yet do no damage', () => {
    const result = fireFusionArray(flare, context(new ScriptedRng([3, 1, 2, 3]), { range: 15 }))
    expect(result?.dice).toEqual([3, 1, 2, 3])
    expect(result?.normalDamage).toBe(0)
  })

  it('ignores Standard Screens and takes Advanced Screens as a beam does', () => {
    const standard = fireFusionArray(
      flare,
      context(new ScriptedRng([2, 4, 4]), { range: 12, targetScreens: 1 }),
    )
    expect(standard?.normalDamage).toBe(2)

    const advanced = fireFusionArray(
      flare,
      context(new ScriptedRng([2, 4, 4]), { range: 12, targetScreens: 1, advancedScreens: true }),
    )
    expect(advanced?.normalDamage).toBe(0)
  })

  it('kills one fighter on a 6+', () => {
    expect(rollFusionArrayVsFighters(new ScriptedRng([6])).kills).toBe(1)
    expect(rollFusionArrayVsFighters(new ScriptedRng([5])).kills).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5.20 Gravitic Guns
// ---------------------------------------------------------------------------

describe('Gravitic Guns (5.20)', () => {
  it('throws beam dice by class and 12 MU band, and is cut by screens', () => {
    const grav2 = weapon({ weaponClass: 'gravitic-gun', rating: 2, mass: 2 })
    const close = fireGraviticGun(grav2, context(new ScriptedRng([4, 5]), { range: 10 }))
    expect(close?.dice).toHaveLength(2)
    expect(close?.normalDamage).toBe(2)

    const mid = fireGraviticGun(grav2, context(new ScriptedRng([5]), { range: 20 }))
    expect(mid?.dice).toHaveLength(1)
    expect(fireGraviticGun(grav2, context(new ScriptedRng([5]), { range: 25 }))).toBeNull()

    const screened = fireGraviticGun(
      grav2,
      context(new ScriptedRng([4, 4]), { range: 10, targetScreens: 1 }),
    )
    expect(screened?.normalDamage).toBe(0)
  })

  it('does not re-roll sixes: the section is not marked (P) (4.6)', () => {
    const grav1 = weapon({ weaponClass: 'gravitic-gun', rating: 1, mass: 1 })
    const result = fireGraviticGun(grav1, context(new ScriptedRng([6]), { range: 5 }))
    expect(result?.dice).toEqual([6])
    expect(result?.penetratingDamage).toBe(0)
    expect(result?.normalDamage).toBe(2)
  })

  it('scales its hits when the missing speed table is supplied', () => {
    const grav1 = weapon({ weaponClass: 'gravitic-gun', rating: 1 })
    const result = fireGraviticGun(
      grav1,
      context(new ScriptedRng([6]), {
        range: 5,
        targetVelocity: 12,
        graviticDamagePerHit: (velocity) => (velocity >= 12 ? 2 : 1),
      }),
    )
    expect(result?.normalDamage).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 5.21 Pulsers
// ---------------------------------------------------------------------------

describe('Pulsers (5.21)', () => {
  it('is 6 BD* to 12, 2 BD* to 24, 1 BD* to 48 MU', () => {
    expect(PULSER_PROFILE).toEqual({
      short: { dice: 6, range: 12 },
      medium: { dice: 2, range: 24 },
      long: { dice: 1, range: 48 },
    })

    const short = weapon({ weaponClass: 'pulser', variant: 'short', mass: 2 })
    const volley = firePulser(short, context(new ScriptedRng([4, 4, 4, 4, 4, 4]), { range: 12 }))
    expect(volley?.dice).toHaveLength(6)
    expect(volley?.normalDamage).toBe(6)
    expect(firePulser(short, context(new ScriptedRng([4]), { range: 13 }))).toBeNull()

    const medium = weapon({ weaponClass: 'pulser', variant: 'standard', mass: 3 })
    expect(firePulser(medium, context(new ScriptedRng([4, 4]), { range: 24 }))?.dice).toHaveLength(2)

    const long = weapon({ weaponClass: 'pulser', variant: 'long', mass: 2 })
    expect(firePulser(long, context(new ScriptedRng([4]), { range: 48 }))?.dice).toHaveLength(1)
    expect(firePulser(long, context(new ScriptedRng([4]), { range: 49 }))).toBeNull()
  })

  it('re-rolls sixes, and its dice keep their strength at any range in band', () => {
    const long = weapon({ weaponClass: 'pulser', variant: 'long' })
    const result = firePulser(long, context(new ScriptedRng([6, 6, 3]), { range: 47 }))
    expect(result?.normalDamage).toBe(2)
    expect(result?.penetratingDamage).toBe(2)
    expect(result?.mode).toBe('P')
  })

  it('may point defend through its own arcs, aft included', () => {
    const aft = weapon({ weaponClass: 'pulser', arcs: ['A', 'AS'] })
    expect(pulserCanPointDefend(aft, 'A')).toBe(true)
    expect(pulserCanPointDefend(aft, 'F')).toBe(false)
  })

  it('prices off the 5.21 table', () => {
    expect(pulserMass(1)).toBe(2)
    expect(pulserMass(3)).toBe(3)
    expect(pulserMass(6)).toBe(4)
    expect(KINETIC_COST_PER_MASS.pulser).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 5.22 Turrets
// ---------------------------------------------------------------------------

describe('Turrets (5.22)', () => {
  it('trades capacity for arcs', () => {
    expect(TURRET_CAPACITY).toEqual({ 2: 6, 3: 5, 4: 4, 5: 3, 6: 2 })
  })

  it('rounds all fractions up when sizing', () => {
    expect(turretMass(6, 2)).toBe(1)
    expect(turretMass(7, 2)).toBe(2)
    expect(turretMass(9, 4)).toBe(3)
    expect(turretMass(2, 6)).toBe(1)
    expect(turretMass(3, 6)).toBe(2)
    expect(turretPoints(3)).toBe(9)
    expect(KINETIC_COST_PER_MASS.turret).toBe(3)
  })

  it('allows one turret per 50 mass of ship', () => {
    expect(maxTurrets(49)).toBe(0)
    expect(maxTurrets(50)).toBe(1)
    expect(maxTurrets(149)).toBe(2)
    expect(maxTurrets(150)).toBe(3)
  })

  it('replaces a weapon’s arcs with the turret’s: widening one, narrowing another', () => {
    const turret: TurretDef = {
      id: 't1',
      arcs: ['F', 'FS', 'AS', 'A'],
      capacity: 4,
      mass: 1,
      points: 3,
    }
    const single = weapon({ arcs: ['F'], turretId: 't1' })
    expect(turretMountedArcs(single, turret)).toEqual(['F', 'FS', 'AS', 'A'])

    const wide = weapon({ arcs: ['F', 'FS', 'FP', 'AP', 'AS', 'A'], turretId: 't1' })
    expect(turretMountedArcs(wide, turret)).toEqual(['F', 'FS', 'AS', 'A'])

    const elsewhere = weapon({ arcs: ['FP', 'AP'], turretId: 't2' })
    expect(turretMountedArcs(elsewhere, turret)).toEqual(['FP', 'AP'])
  })

  it('fires into the single arc its recorded facing names', () => {
    const turret: TurretDef = { id: 't1', arcs: ['F', 'FS', 'AS'], capacity: 5, mass: 1, points: 3 }
    expect(turretFiringArcs(turret, 'FS')).toEqual(['FS'])
    expect(turretFiringArcs(turret)).toEqual(['F', 'FS', 'AS'])
    expect(turretFiringArcs(turret, 'A' as Arc)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 5.23 Spinal Mounts
// ---------------------------------------------------------------------------

describe('Spinal Mounts (5.23)', () => {
  it('has the printed size table', () => {
    expect(SPINAL_MOUNT_PROFILE).toEqual({
      small: { mass: 8, range: 24, beamWidth: 1 },
      medium: { mass: 16, range: 36, beamWidth: 1.5 },
      large: { mass: 32, range: 48, beamWidth: 2 },
    })
    expect(SPINAL_ARC_DEGREES).toBe(30)
  })

  it('lets a battleship carry three Medium mounts', () => {
    expect(maxSpinalMountMass(150)).toBe(48)
    expect(maxSpinalMountMass(150) / SPINAL_MOUNT_PROFILE.medium.mass).toBe(3)
    expect(maxSpinalMountMass(49)).toBe(0)
    expect(maxSpinalMountMass(100)).toBe(32)
  })

  it('fires every other turn and pins the ship the turn after', () => {
    expect(spinalCanFire(null, 1)).toBe(true)
    expect(spinalCanFire(3, 4)).toBe(false)
    expect(spinalCanFire(3, 5)).toBe(true)
    expect(spinalLocksShip(3, 4)).toBe(true)
    expect(spinalLocksShip(3, 5)).toBe(false)
    expect(spinalLocksShip(null, 1)).toBe(false)
  })

  it('lays its beam in a 30 degree arc off the bow', () => {
    const origin = { x: 0, y: 0 }
    // Facing 12 is straight up the table, which is −y in screen coordinates.
    expect(isInSpinalArc(origin, 12, { x: 0, y: -10 })).toBe(true)
    // 14 degrees off the bow at 10 MU is inside the half-arc; 20 is not.
    expect(isInSpinalArc(origin, 12, { x: 10 * Math.sin(0.24), y: -10 * Math.cos(0.24) })).toBe(true)
    expect(isInSpinalArc(origin, 12, { x: 10 * Math.sin(0.36), y: -10 * Math.cos(0.36) })).toBe(false)
    expect(isInSpinalArc(origin, 12, { x: 0, y: 10 })).toBe(false)
  })

  it('catches everything inside the beam swathe, out to its range', () => {
    const origin = { x: 0, y: 0 }
    const aim = { x: 0, y: -20 }
    // A Small mount is 1 MU wide, so half a MU either side of the line.
    expect(spinalBeamCatches(origin, aim, { x: 0.4, y: -10 }, 'small')).toBe(true)
    expect(spinalBeamCatches(origin, aim, { x: 0.6, y: -10 }, 'small')).toBe(false)
    // A Large mount is 2 MU wide and reaches 48.
    expect(spinalBeamCatches(origin, aim, { x: 0.9, y: -10 }, 'large')).toBe(true)
    expect(spinalBeamCatches(origin, aim, { x: 0, y: -47 }, 'large')).toBe(true)
    expect(spinalBeamCatches(origin, aim, { x: 0, y: -25 }, 'small')).toBe(false)
    // Behind the firing ship is not in the beam.
    expect(spinalBeamCatches(origin, aim, { x: 0, y: 5 }, 'large')).toBe(false)
  })

  it('fires the Beam Spinal Mount as 12 BD* at any range in the beam', () => {
    expect(SPINAL_BEAM_DICE).toBe(12)
    const mount = weapon({ weaponClass: 'spinal-beam', rating: 2, mass: 16 })
    const faces = Array.from({ length: 12 }, () => 4)
    const near = fireSpinalBeam(mount, context(new ScriptedRng(faces), { range: 1 }))
    const far = fireSpinalBeam(mount, context(new ScriptedRng(faces), { range: 36 }))
    expect(near?.normalDamage).toBe(12)
    expect(far?.normalDamage).toBe(12)
    expect(fireSpinalBeam(mount, context(new ScriptedRng(faces), { range: 37 }))).toBeNull()
  })

  it('lets screens work normally against the Beam Spinal Mount', () => {
    const mount = weapon({ weaponClass: 'spinal-beam', rating: 1, mass: 8 })
    const faces = Array.from({ length: 12 }, () => 4)
    const screened = fireSpinalBeam(mount, context(new ScriptedRng(faces), { targetScreens: 1 }))
    expect(screened?.normalDamage).toBe(0)
  })

  it('fires the Plasma Spinal Mount as 6 Plasma Cannon dice', () => {
    expect(SPINAL_PLASMA_DICE).toBe(6)
    // 5.5: a 3 is one hit, a 4 two, a 5 three, a 6 four plus a re-roll.
    const plain = rollPlasmaDice(4, 0, new ScriptedRng([3, 4, 5, 2]))
    expect(plain.normalDamage).toBe(1 + 2 + 3 + 0)
    expect(plain.penetratingDamage).toBe(0)

    const rerolled = rollPlasmaDice(1, 2, new ScriptedRng([6, 5]))
    // The 6 is 6−2−2 = 2 hits through level-2 screens; the re-roll ignores
    // them, so the 5 is 3 hits of penetrating damage.
    expect(rerolled.normalDamage).toBe(2)
    expect(rerolled.penetratingDamage).toBe(3)

    const mount = weapon({ weaponClass: 'spinal-plasma', rating: 3, mass: 32 })
    const result = firePlasmaSpinal(
      mount,
      context(new ScriptedRng([3, 3, 3, 3, 3, 3]), { range: 48 }),
    )
    expect(result?.normalDamage).toBe(6)
    expect(result?.mode).toBe('P')
  })

  it('fires the PSP as 2 hit dice with no re-rolls, unaffected by screens', () => {
    expect(PSP_DICE).toBe(2)
    const mount = weapon({ weaponClass: 'spinal-psp', rating: 1, mass: 8 })
    // Two hit dice: a 6 is two hits, a 4 is one. Against a mass-100 ship that
    // is 2D6 a hit, so six damage dice follow.
    const result = firePsp(
      mount,
      context(new ScriptedRng([6, 4, 3, 3, 3, 3, 3, 3]), {
        range: 20,
        targetMass: 100,
        targetScreens: 2,
      }),
    )
    expect(result?.dice).toEqual([6, 4, 3, 3, 3, 3, 3, 3])
    expect(result?.normalDamage).toBe(18)
    expect(result?.mode).toBe('AP')
  })

  it('scales PSP damage with the target’s mass, never below one die', () => {
    expect(pspDamageDicePerHit(20)).toBe(1)
    expect(pspDamageDicePerHit(50)).toBe(1)
    expect(pspDamageDicePerHit(100)).toBe(2)
    expect(pspDamageDicePerHit(150)).toBe(3)
  })

  it('does one point per hit to small craft', () => {
    const mount = weapon({ weaponClass: 'spinal-psp', rating: 2, mass: 16 })
    const result = firePsp(
      mount,
      context(new ScriptedRng([6, 5]), { range: 30, targetIsSmallCraft: true }),
    )
    expect(result?.normalDamage).toBe(3)
    expect(result?.dice).toEqual([6, 5])
  })
})

// ---------------------------------------------------------------------------
// The spec table
// ---------------------------------------------------------------------------

describe('KINETIC_WEAPON_SPECS', () => {
  it('covers every weapon class of 5.14 – 5.23', () => {
    expect(Object.keys(KINETIC_WEAPON_SPECS).sort()).toEqual(
      [
        'boarding-torpedo',
        'fusion-array',
        'gravitic-gun',
        'k-gun',
        'mkp',
        'pulse-torpedo',
        'pulser',
        'spinal-beam',
        'spinal-plasma',
        'spinal-psp',
        'submunition-pack',
      ].sort(),
    )
  })

  it('reports each weapon’s reach', () => {
    expect(KINETIC_WEAPON_SPECS['pulse-torpedo']?.maxRange(1, 'short')).toBe(12)
    expect(KINETIC_WEAPON_SPECS['pulse-torpedo']?.maxRange(1, 'standard')).toBe(18)
    expect(KINETIC_WEAPON_SPECS['pulse-torpedo']?.maxRange(1, 'long')).toBe(24)
    expect(KINETIC_WEAPON_SPECS['pulse-torpedo']?.maxRange(1, 'variable')).toBe(24)
    expect(KINETIC_WEAPON_SPECS['k-gun']?.maxRange(3, 'long')).toBe(24)
    expect(KINETIC_WEAPON_SPECS['submunition-pack']?.maxRange(1, 'standard')).toBe(18)
    expect(KINETIC_WEAPON_SPECS.mkp?.maxRange(1, 'standard')).toBe(12)
    expect(KINETIC_WEAPON_SPECS['fusion-array']?.maxRange(1, 'standard')).toBe(36)
    expect(KINETIC_WEAPON_SPECS['gravitic-gun']?.maxRange(4, 'standard')).toBe(48)
    expect(KINETIC_WEAPON_SPECS.pulser?.maxRange(1, 'short')).toBe(12)
    expect(KINETIC_WEAPON_SPECS['spinal-psp']?.maxRange(3, 'standard')).toBe(48)
  })

  it('needs a FireCon for every offensive shot (5.2, 5.23)', () => {
    for (const spec of Object.values(KINETIC_WEAPON_SPECS)) {
      expect(spec.requiresFireCon).toBe(true)
      expect(spec.ordnance).toBeUndefined()
    }
  })

  it('marks the two mounts that double as point defence (5.16, 5.21)', () => {
    expect(KINETIC_WEAPON_SPECS['k-gun']?.pointDefence).toBe('pds')
    expect(KINETIC_WEAPON_SPECS.pulser?.pointDefence).toBe('pds')
    expect(KINETIC_WEAPON_SPECS['pulse-torpedo']?.pointDefence).toBeUndefined()
  })

  it('resolves fire through the contract', () => {
    const k3 = weapon({ rating: 3, mass: 5 })
    const spec = kineticSpecFor(k3)
    const result = spec?.fire(k3, context(new ScriptedRng([4, 2]), { range: 10 }))
    expect(result?.normalDamage).toBe(6)
    expect(result?.mode).toBe('AP')
  })
})
