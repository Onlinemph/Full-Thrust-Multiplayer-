/**
 * Tests for the energy weapons of 5.2 – 5.13.
 *
 * Every worked example the rulebook prints in or under this section is a test
 * here: the 4.6 and 4.7 beam volleys the section is defined against, the plasma
 * cannon's own hit table (5.5), the Graser-3 and Phaser-3 range tables (5.6,
 * 5.8), the Heavy Graser-2 pair at 24 MU (5.7), the phaser's price (5.8), the
 * battlecruiser taking seven EMP hits (5.4), and the Marine commando raid
 * chart (5.9).
 *
 * Dice are scripted rather than seeded so that the faces in a test are the
 * faces the rulebook prints.
 */

import { describe, expect, it } from 'vitest'
import { Rng } from '../dice'
import type { Arc, WeaponClass } from '../types'
import {
  ADVANCED_FIRECON,
  BEAM_FAMILY_MOUNTS,
  BEAM_WEAPON_SPECS,
  COMMANDO_RAID_TABLE,
  EMP_VULNERABLE_SYSTEMS,
  GATLING_DICE,
  HEAVY_GRASER_RANGE_BAND,
  MESON_PROJECTOR_RANGE,
  NEEDLE_BEAM_FORBIDDEN_TARGETS,
  STANDARD_FIRECON,
  TWIN_PARTICLE_ARRAY_RANGE,
  type BeamFiringContext,
  type BeamWeaponDef,
  canPointDefend,
  canUseTransporters,
  commandoRaid,
  d3,
  empPointDefence,
  empThresholdTarget,
  fireConCapacity,
  fireSapHits,
  fireTransporterBeam,
  isEmpVulnerable,
  mountPoints,
  needleSensorsSuffice,
  plasmaHits,
  pointDefenceModeFor,
  resolveEmpTests,
} from './beams'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands out the faces it was given, in order. `d6` reads
 * `floor(next() * 6) + 1`, so a face `f` is served as `(f - 1) / 6` nudged off
 * the boundary.
 */
class ScriptedRng extends Rng {
  private queue: number[]

  constructor(faces: number[]) {
    super(1)
    this.queue = [...faces]
  }

  override next(): number {
    const face = this.queue.shift()
    if (face === undefined) throw new Error('ScriptedRng: the script ran out of dice')
    return (face - 1) / 6 + 1e-9
  }

  get remaining(): number {
    return this.queue.length
  }
}

function mount(
  weaponClass: WeaponClass,
  rating: number,
  over: Partial<BeamWeaponDef> = {},
): BeamWeaponDef {
  return {
    id: `${weaponClass}-${rating}`,
    label: `${weaponClass}-${rating}`,
    weaponClass,
    rating,
    variant: 'standard',
    arcs: ['F', 'FS', 'FP', 'AS', 'AP', 'A'] as Arc[],
    mass: 1,
    points: 3,
    ...over,
  }
}

function context(rng: Rng, over: Partial<BeamFiringContext> = {}): BeamFiringContext {
  return { range: 6, arc: 'F', targetScreens: 0, rearArc: false, drm: 0, rng, ...over }
}

function fire(
  weaponClass: WeaponClass,
  rating: number,
  faces: number[],
  ctx: Partial<BeamFiringContext> = {},
  weapon: Partial<BeamWeaponDef> = {},
) {
  const rng = new ScriptedRng(faces)
  const spec = BEAM_WEAPON_SPECS[weaponClass]
  if (!spec) throw new Error(`no spec for ${weaponClass}`)
  const result = spec.fire(mount(weaponClass, rating, weapon), context(rng, ctx))
  return { result, rng }
}

// ---------------------------------------------------------------------------
// 5.2 Targeting systems
// ---------------------------------------------------------------------------

describe('5.2 targeting systems', () => {
  it('prices and rates a standard FireCon', () => {
    expect(STANDARD_FIRECON.mass).toBe(1)
    expect(STANDARD_FIRECON.pointsPerMass).toBe(4)
    expect(STANDARD_FIRECON.points).toBe(4)
    expect(STANDARD_FIRECON.targetsPerSystem).toBe(1)
    // 5.2 gives the fit no to-hit bonus at all.
    expect(STANDARD_FIRECON.drm).toBe(0)
    expect(STANDARD_FIRECON.scanRange).toBeUndefined()
  })

  it('makes an Advanced FireCon worth two FireCons and scan to 72 MU', () => {
    expect(ADVANCED_FIRECON.mass).toBe(1)
    expect(ADVANCED_FIRECON.pointsPerMass).toBe(5)
    expect(ADVANCED_FIRECON.targetsPerSystem).toBe(2)
    expect(ADVANCED_FIRECON.scanRange).toBe(72)
    expect(ADVANCED_FIRECON.drm).toBe(0)
  })

  it('counts targets a ship may engage in one phase', () => {
    expect(fireConCapacity(2, 0)).toBe(2)
    expect(fireConCapacity(1, 2)).toBe(5)
    expect(fireConCapacity(0, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5.3 Beams
// ---------------------------------------------------------------------------

describe('5.3 beam weapons (P)', () => {
  const spec = BEAM_WEAPON_SPECS.beam!

  it('has a maximum range of 12 MU per class (4.3)', () => {
    expect(spec.maxRange(1, 'standard')).toBe(12)
    expect(spec.maxRange(3, 'standard')).toBe(36)
    expect(spec.maxRange(5, 'standard')).toBe(60)
  })

  it('rolls class dice, losing one per range band (4.5)', () => {
    // "A class 3 beam rolls 3 D6 at less than 12 MU, 2 at 12-24 MU, and 1 only
    // at 24-36 MU. At ranges greater than 36 MU the weapon is out of range."
    expect(fire('beam', 3, [1, 1, 1], { range: 6 }).result!.dice).toHaveLength(3)
    expect(fire('beam', 3, [1, 1], { range: 18 }).result!.dice).toHaveLength(2)
    expect(fire('beam', 3, [1], { range: 30 }).result!.dice).toHaveLength(1)
    expect(fire('beam', 3, [], { range: 37 }).result).toBeNull()
    expect(fire('beam', 1, [1], { range: 12 }).result!.dice).toHaveLength(1)
    expect(fire('beam', 1, [], { range: 12.5 }).result).toBeNull()
  })

  it('scores the 4.6 worked example: a Beam-3 and a Beam-2 at 18 MU', () => {
    // "Rolling the 3D6, the firing player scores 1, 5, and 6. This inflicts a
    // total of three points of damage ... The re-roll is 4, inflicting 1 more."
    const rng = new ScriptedRng([1, 5, 6, 4])
    const beam3 = BEAM_WEAPON_SPECS.beam!.fire(mount('beam', 3), context(rng, { range: 18 }))!
    const beam2 = BEAM_WEAPON_SPECS.beam!.fire(mount('beam', 2), context(rng, { range: 18 }))!
    expect(beam3.dice).toHaveLength(2)
    expect(beam2.dice).toEqual([6, 4])
    const normal = beam3.normalDamage + beam2.normalDamage
    const penetrating = beam3.penetratingDamage + beam2.penetratingDamage
    expect(normal).toBe(3)
    expect(penetrating).toBe(1)
    expect(rng.remaining).toBe(0)
  })

  it('scores the 4.7 worked example: six dice against level-2 screens', () => {
    // "The player rolls 2, 3, 3, 4, 6, and 6 ... each 6 does 1 damage point,
    // for a total of 2. The re-rolls are 4 and 6, and the further re-roll is 3
    // ... the 4 inflicts 1 damage point and the 6 another 2 for a total of 5."
    // Six dice: a Beam-5 throws five, a Beam-1 alongside it throws the sixth.
    // In roll order each natural 6 is re-rolled as it is thrown, so the script
    // is 2,3,3,4,6 → re-roll 4, then 6 → re-roll 6 → re-roll 3.
    const rng = new ScriptedRng([2, 3, 3, 4, 6, 4, 6, 6, 3])
    const five = BEAM_WEAPON_SPECS.beam!.fire(mount('beam', 5), context(rng, { targetScreens: 2 }))!
    const one = BEAM_WEAPON_SPECS.beam!.fire(mount('beam', 1), context(rng, { targetScreens: 2 }))!
    expect(five.normalDamage + one.normalDamage).toBe(2)
    expect(five.penetratingDamage + one.penetratingDamage).toBe(3)
    expect(rng.remaining).toBe(0)
  })

  it('is a penetrating weapon whose re-rolls bypass armour (4.6)', () => {
    expect(BEAM_WEAPON_SPECS.beam!.damageMode).toBe('P')
    const { result } = fire('beam', 1, [6, 5])
    expect(result!.normalDamage).toBe(2)
    expect(result!.penetratingDamage).toBe(1)
  })

  it('only lets a Beam-1 point-defend (7.12)', () => {
    expect(canPointDefend(mount('beam', 1))).toBe(true)
    expect(canPointDefend(mount('beam', 3))).toBe(false)
    expect(pointDefenceModeFor(mount('beam', 1))).toBe('beam-1')
    expect(pointDefenceModeFor(mount('beam', 3))).toBeNull()
  })

  it('refuses a shot that does not bear (4.2)', () => {
    const narrow = { arcs: ['F'] as Arc[] }
    expect(fire('beam', 3, [], { arc: 'AS' }, narrow).result).toBeNull()
    expect(fire('beam', 3, [4, 4, 4], { arc: 'F' }, narrow).result).not.toBeNull()
    // 5.22: a turreted mount's arc is the turret's recorded facing, which only
    // fire control knows, so the resolver does not second-guess it.
    expect(
      fire('beam', 3, [4, 4, 4], { arc: 'AS' }, { ...narrow, turretId: 't1' }).result,
    ).not.toBeNull()
  })

  it('prices beam mounts as 5.3 prints them', () => {
    const beams = BEAM_FAMILY_MOUNTS.beam
    expect(beams.pointsPerMass).toBe(3)
    expect(beams.options.find((o) => o.rating === 1)).toMatchObject({ mass: 1, arcs: 6 })
    expect(beams.options.find((o) => o.rating === 3)).toMatchObject({ mass: 4, arcs: 1, extraArcMass: 1 })
    expect(beams.options.find((o) => o.rating === 5)).toMatchObject({ mass: 16, extraArcMass: 4 })
    // "Class 2 'Broadside Beams' (2 arcs) are 1 mass and cost 3 points per mass"
    const broadside = beams.options.find((o) => o.rating === 2 && o.arcs === 2)!
    expect(broadside.mass).toBe(1)
    expect(mountPoints('beam', broadside.mass)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 5.4 EMP projectors
// ---------------------------------------------------------------------------

describe('5.4 EMP projectors / ion cannons', () => {
  const spec = BEAM_WEAPON_SPECS.emp!

  it('uses beam dice and beam ranges', () => {
    expect(spec.maxRange(2, 'standard')).toBe(24)
    expect(fire('emp', 2, [1, 1], { range: 6 }).result!.dice).toHaveLength(2)
    expect(fire('emp', 2, [1], { range: 18 }).result!.dice).toHaveLength(1)
    expect(fire('emp', 2, [], { range: 25 }).result).toBeNull()
  })

  it('does no hull damage and counts hits as disruption instead', () => {
    const { result } = fire('emp', 1, [4])
    expect(result!.normalDamage).toBe(0)
    expect(result!.penetratingDamage).toBe(0)
    expect(result!.disruption).toEqual({ systemsOffline: 1 })
  })

  it('ignores standard screens but not Advanced Screens (5.4, 7.3)', () => {
    // A 4 is a hit only if the screen is not in the way.
    expect(fire('emp', 1, [4], { targetScreens: 2 }).result!.disruption!.systemsOffline).toBe(1)
    expect(
      fire('emp', 1, [4], { targetScreens: 2, advancedScreens: true }).result!.disruption!
        .systemsOffline,
    ).toBe(0)
  })

  it('re-rolls a natural 6 like any BD* weapon', () => {
    const { result, rng } = fire('emp', 1, [6, 5])
    expect(result!.disruption!.systemsOffline).toBe(3) // 2 from the six, 1 from the re-rolled 5
    expect(rng.remaining).toBe(0)
  })

  it('sets the threshold test by total hits taken that turn', () => {
    expect(empThresholdTarget(1)).toBe(6)
    expect(empThresholdTarget(2)).toBe(5)
    expect(empThresholdTarget(3)).toBe(4)
    expect(empThresholdTarget(7)).toBe(4)
  })

  it('runs the 5.4 battlecruiser example: 7 hits, three FireCons and a screen', () => {
    // "a battlecruiser sustains 7 EMP hits ... will need to make 7 threshold
    // tests on a 4+ ... two EMP hits on each FireCon ... and the last EMP hit
    // on one of the screen generators".
    const rng = new ScriptedRng([4, 2, 1, 1, 6, 3, 5])
    const tests = resolveEmpTests(
      7,
      [
        { systemId: 'fc-1', kind: 'firecon', hits: 2 },
        { systemId: 'fc-2', kind: 'firecon', hits: 2 },
        { systemId: 'fc-3', kind: 'firecon', hits: 2 },
        { systemId: 'screen-1', kind: 'screen-generator', hits: 1 },
      ],
      0,
      rng,
    )
    expect(tests).toHaveLength(4)
    expect(tests.every((t) => t.target === 4)).toBe(true)
    expect(tests.map((t) => t.rolls)).toEqual([[4, 2], [1, 1], [6, 3], [5]])
    expect(tests.map((t) => t.knockedOut)).toEqual([true, false, true, true])
    expect(tests[0].failures).toBe(1)
    expect(rng.remaining).toBe(0)
  })

  it('adds +1 per hull row crossed in phases 11 and 12', () => {
    const tests = resolveEmpTests(
      1,
      [{ systemId: 'drive', kind: 'drive', hits: 1 }],
      1,
      new ScriptedRng([5]),
    )
    expect(tests[0].target).toBe(6)
    expect(tests[0].modified).toEqual([6])
    expect(tests[0].knockedOut).toBe(true)
  })

  it('reports failures separately so a drive can be halved then disabled (4.11)', () => {
    const tests = resolveEmpTests(
      7,
      [{ systemId: 'drive', kind: 'drive', hits: 7 }],
      0,
      new ScriptedRng([6, 6, 1, 1, 1, 1, 1]),
    )
    expect(tests[0].failures).toBe(2)
  })

  it('refuses an allocation that overspends or targets an immune system', () => {
    expect(() =>
      resolveEmpTests(1, [{ systemId: 'a', kind: 'firecon', hits: 2 }], 0, new ScriptedRng([1, 1])),
    ).toThrow(RangeError)
    expect(() =>
      resolveEmpTests(1, [{ systemId: 'p', kind: 'pds', hits: 1 }], 0, new ScriptedRng([1])),
    ).toThrow(RangeError)
  })

  it('exposes exactly the systems 5.4 lists', () => {
    expect(EMP_VULNERABLE_SYSTEMS).toContain('drive')
    expect(EMP_VULNERABLE_SYSTEMS).toContain('turret')
    expect(EMP_VULNERABLE_SYSTEMS).toContain('ftl-drive')
    expect(EMP_VULNERABLE_SYSTEMS).toContain('holofield')
    expect(isEmpVulnerable('pds')).toBe(false)
    expect(isEmpVulnerable('cargo')).toBe(false)
  })

  it('lets only an EMP-1 point-defend, at −1 DRM (5.4)', () => {
    expect(canPointDefend(mount('emp', 1))).toBe(true)
    expect(canPointDefend(mount('emp', 2))).toBe(false)
    // A beam-1 PD die kills on 5 or 6; at −1 only a natural 6 still kills, and
    // it still re-rolls.
    expect(empPointDefence(1, new ScriptedRng([5])).kills).toBe(0)
    const six = empPointDefence(1, new ScriptedRng([6, 6, 4]))
    expect(six.kills).toBe(2)
    expect(six.rolls).toEqual([6, 6, 4])
    // 6.4 already needs a 6 against a heavy missile, so −1 leaves nothing.
    expect(empPointDefence(1, new ScriptedRng([6, 3]), { heavyMissile: true }).kills).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5.5 Plasma cannon
// ---------------------------------------------------------------------------

describe('5.5 plasma cannon', () => {
  it('reads 1D6−2 hits off each die', () => {
    // "on a roll of 3 it inflicts 1 hit, on a 4 it inflicts 2 hits, on a 5 it
    // inflicts 3 hits, and on a 6 it inflicts 4 hits"
    expect([1, 2, 3, 4, 5, 6].map((face) => plasmaHits(face, 0))).toEqual([0, 0, 1, 2, 3, 4])
  })

  it('takes a further −1 per level of screen', () => {
    expect([1, 2, 3, 4, 5, 6].map((face) => plasmaHits(face, 1))).toEqual([0, 0, 0, 1, 2, 3])
    expect([1, 2, 3, 4, 5, 6].map((face) => plasmaHits(face, 2))).toEqual([0, 0, 0, 0, 1, 2])
    // 7.16: an area screen over a level-2 screen is the "-3 on their die rolls".
    expect([1, 2, 3, 4, 5, 6].map((face) => plasmaHits(face, 3))).toEqual([0, 0, 0, 0, 0, 1])
  })

  it('rolls class dice on 12 MU bands like a beam', () => {
    const spec = BEAM_WEAPON_SPECS['plasma-cannon']!
    expect(spec.maxRange(3, 'standard')).toBe(36)
    expect(fire('plasma-cannon', 3, [1, 1, 1], { range: 11 }).result!.dice).toHaveLength(3)
    expect(fire('plasma-cannon', 3, [1, 1], { range: 13 }).result!.dice).toHaveLength(2)
    expect(fire('plasma-cannon', 3, [], { range: 40 }).result).toBeNull()
  })

  it('penetrates and re-rolls on a natural 6, with the re-roll unscreened', () => {
    const { result, rng } = fire('plasma-cannon', 1, [6, 4], { targetScreens: 2 })
    // 6 against level-2 screens: 6 − 2 − 2 = 2 hits, then a re-roll scored with
    // no screen penalty: 4 − 2 = 2 more, penetrating.
    expect(result!.normalDamage).toBe(2)
    expect(result!.penetratingDamage).toBe(2)
    expect(result!.mode).toBe('P')
    expect(rng.remaining).toBe(0)
  })

  it('cannot be used in defensive fire', () => {
    expect(BEAM_WEAPON_SPECS['plasma-cannon']!.pointDefence).toBeUndefined()
    expect(canPointDefend(mount('plasma-cannon', 1))).toBe(false)
  })

  it('is double the mass of a beam of the same class', () => {
    const plasma = BEAM_FAMILY_MOUNTS['plasma-cannon']
    expect(plasma.options.find((o) => o.rating === 3)).toMatchObject({ mass: 8, arcs: 1 })
    expect(plasma.options.find((o) => o.rating === 4)).toMatchObject({ mass: 16, extraArcMass: 4 })
    expect(mountPoints('plasma-cannon', 8)).toBe(24)
  })
})

// ---------------------------------------------------------------------------
// 5.6 Standard grasers and 5.8 phasers
// ---------------------------------------------------------------------------

describe('5.6 standard grasers (SAP)', () => {
  it('rolls the Graser-3 range table from 5.6', () => {
    // "a Graser-3 would inflict 3 BD* to 12 MU, 2 BD* to 24 MU, and 1 BD* to 36 MU"
    expect(fire('graser', 3, [1, 1, 1], { range: 12 }).result!.dice).toHaveLength(3)
    expect(fire('graser', 3, [1, 1], { range: 24 }).result!.dice).toHaveLength(2)
    expect(fire('graser', 3, [1], { range: 36 }).result!.dice).toHaveLength(1)
    expect(fire('graser', 3, [], { range: 36.5 }).result).toBeNull()
  })

  it('does 1D3 per hit, not per die', () => {
    // One die showing 6 is two hits against an unscreened target, so two D3s.
    const { result, rng } = fire('graser', 1, [6, 3, 5, 6])
    // faces: to-hit 6 (2 hits) → re-roll 3 (0 hits); damage dice 5 and 6 → 3+3.
    expect(result!.normalDamage).toBe(6)
    expect(result!.penetratingDamage).toBe(0)
    expect(result!.mode).toBe('SAP')
    expect(result!.dice).toEqual([6, 3, 5, 6])
    expect(rng.remaining).toBe(0)
  })

  it('rolls a D3 as a D6 halved, rounding up', () => {
    expect([1, 2, 3, 4, 5, 6].map((face) => d3(new ScriptedRng([face])))).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('sends re-roll damage straight to the hull (4.6)', () => {
    const { result } = fire('graser', 1, [6, 4, 1, 1, 5])
    // to-hit 6 → 2 hits + re-roll; re-roll 4 → 1 penetrating hit.
    // normal damage dice 1,1 → 1+1; penetrating damage die 5 → 3.
    expect(result!.normalDamage).toBe(2)
    expect(result!.penetratingDamage).toBe(3)
  })

  it('splits hits one at a time for rule-exact SAP armour soaking (4.9)', () => {
    const hits = fireSapHits(mount('graser', 1), context(new ScriptedRng([6, 1, 5, 6])))!
    expect(hits).toHaveLength(2)
    expect(hits.map((h) => h.normalDamage)).toEqual([3, 3])
    expect(hits.every((h) => h.mode === 'SAP')).toBe(true)
  })

  it('cannot point-defend', () => {
    expect(canPointDefend(mount('graser', 1))).toBe(false)
  })
})

describe('5.8 phasers (SAP)', () => {
  it('rolls the Phaser-3 range table from 5.8', () => {
    expect(fire('phaser', 3, [1, 1, 1], { range: 12 }).result!.dice).toHaveLength(3)
    expect(fire('phaser', 3, [1, 1], { range: 24 }).result!.dice).toHaveLength(2)
    expect(fire('phaser', 3, [1], { range: 36 }).result!.dice).toHaveLength(1)
    expect(fire('phaser', 3, [], { range: 37 }).result).toBeNull()
  })

  it('does 1D3 semi-AP damage per hit', () => {
    const { result } = fire('phaser', 1, [4, 3])
    expect(result!.normalDamage).toBe(2) // one hit, D3 of 3–4 → 2
    expect(result!.mode).toBe('SAP')
  })

  it('fires as a needle beam of the same class only with an Advanced FireCon', () => {
    expect(
      fire('phaser', 2, [6, 6], { needleTarget: 'firecon-1', phaserMode: 'needle' }).result,
    ).toBeNull()
    const { result } = fire('phaser', 2, [6, 4], {
      needleTarget: 'firecon-1',
      phaserMode: 'needle',
      advancedFireCon: true,
    })
    expect(result!.normalDamage).toBe(2)
    expect(result!.targetedSystems).toEqual(['firecon-1'])
  })

  it('may be used as a single PDS instead of firing (5.8)', () => {
    expect(BEAM_WEAPON_SPECS.phaser!.pointDefence).toBe('pds')
    expect(canPointDefend(mount('phaser', 1))).toBe(true)
  })

  it('prices the 5.8 worked example: a mass-4 Phaser-2 at 14, or 24 with an AFC', () => {
    const phaser2 = BEAM_FAMILY_MOUNTS.phaser.options.find((o) => o.rating === 2)!
    expect(phaser2).toMatchObject({ mass: 4, arcs: 3 })
    expect(mountPoints('phaser', 4)).toBe(14)
    expect(mountPoints('phaser', 4, { shipHasAdvancedFireCon: true })).toBe(24)
  })
})

// ---------------------------------------------------------------------------
// 5.7 Heavy grasers
// ---------------------------------------------------------------------------

describe('5.7 heavy grasers (SAP)', () => {
  const spec = BEAM_WEAPON_SPECS['heavy-graser']!

  it('uses 18 MU range bands, not 12', () => {
    expect(HEAVY_GRASER_RANGE_BAND).toBe(18)
    expect(spec.maxRange(2, 'standard')).toBe(36)
    // "a class 2 Heavy Graser rolls 2D6 at 0-18 MU, 1D6 at up to 36 MU"
    expect(fire('heavy-graser', 2, [1, 1], { range: 18 }).result!.dice).toHaveLength(2)
    expect(fire('heavy-graser', 2, [1], { range: 36 }).result!.dice).toHaveLength(1)
    expect(fire('heavy-graser', 2, [], { range: 37 }).result).toBeNull()
  })

  it('runs the 5.7 worked example: two Heavy Graser-2s at 24 MU vs level-1 screens', () => {
    // "The player rolls 4 and 6. The 4 is a miss because the target has a
    // level-1 screen and the 6 scores two hits but no re-roll. The player now
    // rolls 2D6 for damage, getting 4 and 3 for a total of 7."
    const rng = new ScriptedRng([4, 6, 4, 3])
    const ctx = () => context(rng, { range: 24, targetScreens: 1 })
    const first = spec.fire(mount('heavy-graser', 2), ctx())!
    const second = spec.fire(mount('heavy-graser', 2), ctx())!
    expect(first.normalDamage).toBe(0)
    expect(second.normalDamage).toBe(7)
    expect(second.penetratingDamage).toBe(0)
    expect(second.dice).toEqual([6, 4, 3])
    expect(rng.remaining).toBe(0)
  })

  it('does not re-roll a 6 unless it is a High Intensity Graser', () => {
    const plain = fire('heavy-graser', 1, [6, 2, 2]).result!
    expect(plain.penetratingDamage).toBe(0)

    const hig = fire('heavy-graser', 1, [6, 3, 2, 2, 5], {}, { highIntensity: true }).result!
    // to-hit 6 → 2 hits + re-roll; re-roll 3 → no hit. Damage dice 2 and 2.
    expect(hig.normalDamage).toBe(4)
    expect(hig.penetratingDamage).toBe(0)

    const lucky = fire('heavy-graser', 1, [6, 4, 6, 5, 3], {}, { highIntensity: true }).result!
    // 6 → 2 hits + re-roll of 4 → 1 penetrating hit.
    // Normal damage dice 6 and 5 → 11; penetrating damage die 3 → 3.
    expect(lucky.normalDamage).toBe(11)
    expect(lucky.penetratingDamage).toBe(3)
  })

  it('is semi-armour-piercing and never point defence', () => {
    expect(spec.damageMode).toBe('SAP')
    expect(spec.pointDefence).toBeUndefined()
    expect(canPointDefend(mount('heavy-graser', 1))).toBe(false)
  })

  it('splits hits for per-hit SAP soaking', () => {
    const hits = fireSapHits(mount('heavy-graser', 1), context(new ScriptedRng([6, 5, 2])))!
    expect(hits.map((h) => h.normalDamage)).toEqual([5, 2])
  })

  it('prices HiGs at 4 points per mass', () => {
    expect(mountPoints('heavy-graser', 9)).toBe(27)
    expect(mountPoints('heavy-graser', 9, { highIntensity: true })).toBe(36)
    expect(BEAM_FAMILY_MOUNTS['heavy-graser'].options.find((o) => o.rating === 3)).toMatchObject({
      mass: 24,
      extraArcMass: 6,
    })
  })
})

// ---------------------------------------------------------------------------
// 5.9 Transporter beams
// ---------------------------------------------------------------------------

describe('5.9 transporter beams', () => {
  it('rolls beam dice at beam ranges but never re-rolls', () => {
    const { result, rng } = fire('transporter', 2, [6, 6], { range: 6 })
    expect(result!.dice).toEqual([6, 6])
    expect(result!.boarders).toBe(4)
    expect(rng.remaining).toBe(0)
  })

  it('sends one boarding party per hit and no damage', () => {
    const { result } = fire('transporter', 1, [4])
    expect(result!.boarders).toBe(1)
    expect(result!.normalDamage).toBe(0)
    expect(result!.penetratingDamage).toBe(0)
  })

  it('is stopped by screens like a normal beam', () => {
    expect(fire('transporter', 1, [4], { targetScreens: 1 }).result!.boarders).toBe(0)
    expect(fire('transporter', 1, [5], { targetScreens: 1 }).result!.boarders).toBe(1)
  })

  it('sends exactly one commando raid per mount, however many hits', () => {
    const raid = fireTransporterBeam(
      mount('transporter', 3),
      context(new ScriptedRng([6, 6, 6, 6]), {
        transporterMode: 'commando-raid',
        needleTarget: 'beam-3',
      }),
    )!
    expect(raid.hits).toBe(6)
    expect(raid.raid).toBeDefined()
    expect(raid.raid!.roll).toBe(6)
    expect(raid.result.boarders).toBe(1)
    expect(raid.result.targetedSystems).toEqual(['beam-3'])
  })

  it('mounts no raid when the mount misses', () => {
    const raid = fireTransporterBeam(
      mount('transporter', 1),
      context(new ScriptedRng([2]), { transporterMode: 'commando-raid', needleTarget: 'pds-1' }),
    )!
    expect(raid.hits).toBe(0)
    expect(raid.raid).toBeUndefined()
    expect(raid.result.boarders).toBeUndefined()
  })

  it('reads the commando raid chart exactly as printed', () => {
    const one = commandoRaid(new ScriptedRng([1]))
    expect(one.outcome).toBe('no-lock')
    expect(one.systemDestroyed).toBe(false)
    // "Nothing happens" — the party never left, so it is not spent.
    expect(one.marinesSent).toBe(false)
    expect(one.marinesLost).toBe(false)

    for (const face of [2, 3]) {
      const lost = commandoRaid(new ScriptedRng([face]))
      expect(lost.outcome).toBe('lost')
      expect(lost.systemDestroyed).toBe(false)
      expect(lost.marinesLost).toBe(true)
    }

    const returned = commandoRaid(new ScriptedRng([4, 4]))
    expect(returned.outcome).toBe('withdrawn')
    expect(returned.returnRoll).toBe(4)
    expect(returned.systemDestroyed).toBe(false)
    expect(returned.marinesLost).toBe(false)

    const killed = commandoRaid(new ScriptedRng([4, 3]))
    expect(killed.outcome).toBe('withdrawn-killed')
    expect(killed.marinesLost).toBe(true)

    const pyrrhic = commandoRaid(new ScriptedRng([5]))
    expect(pyrrhic.outcome).toBe('destroyed-marines-lost')
    expect(pyrrhic.systemDestroyed).toBe(true)
    expect(pyrrhic.marinesLost).toBe(true)

    const clean = commandoRaid(new ScriptedRng([6]))
    expect(clean.outcome).toBe('destroyed-marines-returned')
    expect(clean.systemDestroyed).toBe(true)
    expect(clean.marinesLost).toBe(false)

    expect(Object.keys(COMMANDO_RAID_TABLE)).toHaveLength(6)
  })

  it('refuses a raid on a core or otherwise protected system', () => {
    for (const forbidden of ['core-systems', 'antimatter-charge']) {
      expect(
        fireTransporterBeam(
          mount('transporter', 1),
          context(new ScriptedRng([6]), {
            transporterMode: 'commando-raid',
            needleTarget: forbidden,
          }),
        ),
      ).toBeNull()
    }
    // ...and a raid with no system nominated is not an order at all.
    expect(
      fireTransporterBeam(
        mount('transporter', 1),
        context(new ScriptedRng([6]), { transporterMode: 'commando-raid' }),
      ),
    ).toBeNull()
  })

  it('needs somebody left to send', () => {
    expect(canUseTransporters(0, 0)).toBe(false)
    expect(canUseTransporters(0, 1)).toBe(true)
    // "ONLY Marines may be used for such actions"
    expect(canUseTransporters(0, 3, 'commando-raid')).toBe(false)
    expect(canUseTransporters(1, 0, 'commando-raid')).toBe(true)
  })

  it('cannot be used in defensive fire', () => {
    expect(BEAM_WEAPON_SPECS.transporter!.pointDefence).toBeUndefined()
    expect(canPointDefend(mount('transporter', 2))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5.10 – 5.12 Fixed-dice mounts
// ---------------------------------------------------------------------------

describe('5.10 gatling battery (P)', () => {
  it('throws 6 beam dice out to 12 MU and nothing beyond', () => {
    expect(GATLING_DICE).toBe(6)
    expect(BEAM_WEAPON_SPECS.gatling!.maxRange(1, 'standard')).toBe(12)
    const { result } = fire('gatling', 1, [1, 1, 1, 1, 1, 1], { range: 12 })
    expect(result!.dice).toHaveLength(6)
    expect(fire('gatling', 1, [], { range: 12.1 }).result).toBeNull()
  })

  it('is penetrating and re-rolls sixes', () => {
    const { result } = fire('gatling', 1, [6, 5, 1, 1, 1, 1, 1])
    expect(result!.normalDamage).toBe(2)
    expect(result!.penetratingDamage).toBe(1)
    expect(result!.mode).toBe('P')
  })

  it('may be used as a full PDS', () => {
    expect(BEAM_WEAPON_SPECS.gatling!.pointDefence).toBe('pds')
    expect(pointDefenceModeFor(mount('gatling', 1))).toBe('pds')
  })
})

describe('5.11 twin particle array (P)', () => {
  it('throws 2 beam dice anywhere inside 24 MU', () => {
    expect(TWIN_PARTICLE_ARRAY_RANGE).toBe(24)
    // One 24 MU band: it does not shed a die at 12 MU the way a Beam-2 would.
    expect(fire('twin-particle-array', 1, [1, 1], { range: 3 }).result!.dice).toHaveLength(2)
    expect(fire('twin-particle-array', 1, [1, 1], { range: 24 }).result!.dice).toHaveLength(2)
    expect(fire('twin-particle-array', 1, [], { range: 25 }).result).toBeNull()
  })

  it('is a PDS in defensive fire', () => {
    expect(BEAM_WEAPON_SPECS['twin-particle-array']!.pointDefence).toBe('pds')
  })
})

describe('5.12 meson projector (P)', () => {
  it('throws 1 beam die out to 48 MU', () => {
    expect(MESON_PROJECTOR_RANGE).toBe(48)
    expect(fire('meson-projector', 1, [4], { range: 48 }).result!.dice).toHaveLength(1)
    expect(fire('meson-projector', 1, [], { range: 49 }).result).toBeNull()
  })

  it('is penetrating and can point-defend', () => {
    expect(BEAM_WEAPON_SPECS['meson-projector']!.damageMode).toBe('P')
    expect(BEAM_WEAPON_SPECS['meson-projector']!.pointDefence).toBe('pds')
  })
})

// ---------------------------------------------------------------------------
// 5.13 Needle beams
// ---------------------------------------------------------------------------

describe('5.13 needle beams', () => {
  const target = { needleTarget: 'firecon-1' }

  it('rolls class dice on 12 MU bands', () => {
    expect(BEAM_WEAPON_SPECS['needle-beam']!.maxRange(2, 'standard')).toBe(24)
    expect(fire('needle-beam', 2, [1, 1], { ...target, range: 12 }).result!.dice).toHaveLength(2)
    expect(
      fire('needle-beam', 2, [1], { ...target, range: 24, sensors: { enhanced: 1 } }).result!.dice,
    ).toHaveLength(1)
    expect(fire('needle-beam', 2, [], { ...target, range: 25 }).result).toBeNull()
  })

  it('does a point of damage on a 4+ and kills the system on a natural 6', () => {
    expect(fire('needle-beam', 1, [3], target).result!.normalDamage).toBe(0)
    const four = fire('needle-beam', 1, [4], target).result!
    expect(four.normalDamage).toBe(1)
    expect(four.targetedSystems).toBeUndefined()
    const six = fire('needle-beam', 1, [6], target).result!
    expect(six.normalDamage).toBe(1)
    expect(six.targetedSystems).toEqual(['firecon-1'])
  })

  it('kills only one system per mount however many sixes', () => {
    const result = fire('needle-beam', 3, [6, 6, 6], target).result!
    expect(result.normalDamage).toBe(3)
    expect(result.targetedSystems).toEqual(['firecon-1'])
  })

  it('scores the damage point on the modified face but the kill on a natural 6 (4.6)', () => {
    // +1 DRM: a natural 5 reads as a 6 for damage but earns no system kill.
    const boosted = fire('needle-beam', 1, [5], { ...target, drm: 1 }).result!
    expect(boosted.normalDamage).toBe(1)
    expect(boosted.targetedSystems).toBeUndefined()
    // −1 DRM: a natural 4 reads as a 3 and does nothing at all.
    expect(fire('needle-beam', 1, [4], { ...target, drm: -1 }).result!.normalDamage).toBe(0)
  })

  it('ignores screens of any kind', () => {
    expect(fire('needle-beam', 1, [4], { ...target, targetScreens: 2 }).result!.normalDamage).toBe(1)
    expect(
      fire('needle-beam', 1, [4], { ...target, targetScreens: 2, advancedScreens: true }).result!
        .normalDamage,
    ).toBe(1)
  })

  it('needs Enhanced Sensors past 12 MU and Superior past 24 to kill a system', () => {
    expect(needleSensorsSuffice(12)).toBe(true)
    expect(needleSensorsSuffice(13)).toBe(false)
    expect(needleSensorsSuffice(13, { enhanced: 1 })).toBe(true)
    expect(needleSensorsSuffice(25, { enhanced: 1 })).toBe(false)
    expect(needleSensorsSuffice(25, { enhanced: 2 })).toBe(true)
    expect(needleSensorsSuffice(25, { superior: true })).toBe(true)

    // Out of sensor range the shot still lands its point of damage.
    const far = fire('needle-beam', 2, [6], { ...target, range: 18 }).result!
    expect(far.normalDamage).toBe(1)
    expect(far.targetedSystems).toBeUndefined()
    const seen = fire('needle-beam', 2, [6], {
      ...target,
      range: 18,
      sensors: { enhanced: 1 },
    }).result!
    expect(seen.targetedSystems).toEqual(['firecon-1'])
  })

  it('cannot pick out a system without basic targeting information', () => {
    const blind = fire('needle-beam', 1, [6], { ...target, needleTargetingInfo: false }).result!
    expect(blind.normalDamage).toBe(1)
    expect(blind.targetedSystems).toBeUndefined()
  })

  it('is blocked by holofields beyond 6 MU (7.17) and by cloaks (7.20)', () => {
    expect(
      fire('needle-beam', 1, [6], { ...target, holofield: true, range: 10 }).result!
        .targetedSystems,
    ).toBeUndefined()
    // "Any ships firing at 6 MU or less will ignore Holofields"
    expect(
      fire('needle-beam', 1, [6], { ...target, holofield: true, range: 6 }).result!.targetedSystems,
    ).toEqual(['firecon-1'])
    expect(
      fire('needle-beam', 1, [6], { ...target, targetCloaked: true }).result!.targetedSystems,
    ).toBeUndefined()
  })

  it('may not be aimed at core systems, stealth hulls or biotech generators', () => {
    for (const forbidden of NEEDLE_BEAM_FORBIDDEN_TARGETS) {
      const result = fire('needle-beam', 1, [6], { needleTarget: forbidden }).result!
      expect(result.normalDamage).toBe(1)
      expect(result.targetedSystems).toBeUndefined()
    }
  })

  it('prices needle beam mounts at 3 arcs maximum', () => {
    const nb = BEAM_FAMILY_MOUNTS['needle-beam']
    expect(nb.options.find((o) => o.rating === 1)).toMatchObject({ mass: 2, arcs: 2, maxArcs: 3 })
    expect(nb.options.find((o) => o.rating === 4)).toMatchObject({ mass: 16, extraArcMass: 8 })
    expect(nb.options.every((o) => o.maxArcs === 3)).toBe(true)
    expect(mountPoints('needle-beam', 2)).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// The table as a whole
// ---------------------------------------------------------------------------

describe('BEAM_WEAPON_SPECS', () => {
  const classes: WeaponClass[] = [
    'beam',
    'emp',
    'plasma-cannon',
    'graser',
    'heavy-graser',
    'phaser',
    'transporter',
    'gatling',
    'twin-particle-array',
    'meson-projector',
    'needle-beam',
  ]

  it('covers every energy weapon of 5.3 – 5.13', () => {
    for (const weaponClass of classes) {
      const spec = BEAM_WEAPON_SPECS[weaponClass]
      expect(spec, weaponClass).toBeDefined()
      expect(spec!.weaponClass).toBe(weaponClass)
      expect(spec!.requiresFireCon).toBe(true)
      expect(spec!.ordnance).toBeUndefined()
      expect(spec!.maxRange(1, 'standard')).toBeGreaterThan(0)
    }
  })

  it('prices every mounting its section prints', () => {
    for (const weaponClass of classes) {
      const table = BEAM_FAMILY_MOUNTS[weaponClass]
      expect(table, weaponClass).toBeDefined()
      expect(table.options.length).toBeGreaterThan(0)
      for (const option of table.options) {
        expect(option.mass).toBeGreaterThan(0)
        expect(option.arcs).toBeGreaterThan(0)
        expect(mountPoints(weaponClass, option.mass)).toBeGreaterThan(0)
      }
    }
  })

  it('refuses to price a weapon from another section', () => {
    expect(() => mountPoints('k-gun', 4)).toThrow(RangeError)
  })
})
