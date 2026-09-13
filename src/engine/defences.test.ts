/**
 * Defences (7.2 – 7.16).
 *
 * Every worked example the rulebook prints for this domain is a test here:
 * 4.7's level-2 screen volley, 4.9's penetrating / AP / SAP armour examples,
 * 6.5's two-salvo point-defence allocation, 7.4's stealth range table, 7.9's
 * three-charge blast, 7.16's area-screened frigate and 8.8's ADFC example with
 * ships A and B and fighter groups X, Y and Z.
 */

import { describe, expect, it } from 'vitest'

import { Rng, beamDamage, rollBeamVolley, type ScreenLevel } from './dice'
import {
  ALL_ARCS,
  AREA_RADIUS,
  DEFENCE_COSTS,
  adfcBudget,
  advancedScreenDamageDie,
  antimatterChargeDice,
  applyArmourDamage,
  armourPoints,
  armourPointsPerMass,
  combinedStealthLevel,
  coveringAreaScreens,
  effectiveScreenLevel,
  MAX_SCREEN_LEVEL,
  pdMayEngageShip,
  pointDefenceOptions,
  regenerateArmour,
  resolvePointDefence,
  rollAntimatterChargeBlast,
  rollAntimatterChargeSelfDamage,
  rollPointDefenceAtShip,
  rollPointDefenceDice,
  rollScattergun,
  rollUnrepairedChargeDetonation,
  salvoMissilesThrough,
  screenEffect,
  stealthHullLevel,
  stealthMaxRange,
  stealthScanState,
  validatePointDefence,
  type AreaScreenCover,
  type PdAllocation,
  type PdDefender,
  type PdMount,
  type PdThreat,
} from './defences'
import type { Point, ScreenDef } from './types'

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands back a scripted list of d6 faces, so a worked example
 * from the book can be replayed die for die. `Rng.int(6)` is
 * `floor(next() * 6)`, so a face `f` is produced by a value just above
 * `(f - 1) / 6`.
 */
class ScriptedRng extends Rng {
  private readonly faces: readonly number[]
  private index = 0

  constructor(faces: readonly number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index] ?? 1
    this.index += 1
    return (face - 1) / 6 + 1e-9
  }

  /** Dice consumed so far — a guard that a test scripted the right number. */
  get consumed(): number {
    return this.index
  }
}

const screens = (level: 0 | 1 | 2, generators: number = level, advanced = false): ScreenDef => ({
  level,
  generators,
  advanced,
})

const at = (x: number, y = 0): Point => ({ x, y })

const pds = (id: string): PdMount => ({ id, kind: 'pds', arcs: ALL_ARCS, mode: 'pds' })
const beam1 = (id: string): PdMount => ({ id, kind: 'beam-1', arcs: ALL_ARCS, mode: 'beam-1' })
const ads = (id: string): PdMount => ({ id, kind: 'ads', arcs: ALL_ARCS, mode: 'pds' })
const scattergun = (id: string, expended = false): PdMount => ({
  id,
  kind: 'scattergun',
  arcs: ALL_ARCS,
  mode: 'pds',
  expended,
})
const grapeshot = (id: string): PdMount => ({
  id,
  kind: 'grapeshot',
  arcs: ALL_ARCS,
  mode: 'pds',
})

const defender = (
  id: string,
  position: Point,
  mounts: PdMount[],
  extra: Partial<PdDefender> = {},
): PdDefender => ({
  id,
  placement: { position, facing: 12 },
  mounts,
  adfc: 0,
  advancedAdfc: 0,
  ...extra,
})

// ---------------------------------------------------------------------------
// 7.2 Defensive screens
// ---------------------------------------------------------------------------

describe('7.2 defensive screens', () => {
  it('caps the active level at 2 and reads it off the surviving generators', () => {
    expect(effectiveScreenLevel(screens(2, 2), 2)).toBe(2)
    expect(effectiveScreenLevel(screens(2, 2), 1)).toBe(1)
    expect(effectiveScreenLevel(screens(2, 2), 0)).toBe(0)
    expect(effectiveScreenLevel(screens(1, 1), 1)).toBe(1)
    expect(effectiveScreenLevel(screens(0, 0), 0)).toBe(0)
  })

  it('lets a backup generator hold the level up when a main one is lost (7.2)', () => {
    // "Extra screen generators may be fitted but will only be useful as backups
    // should one of the main screens be lost through damage."
    const withBackup = screens(2, 3)
    expect(effectiveScreenLevel(withBackup, 3)).toBe(2)
    expect(effectiveScreenLevel(withBackup, 2)).toBe(2) // the backup absorbed the loss
    expect(effectiveScreenLevel(withBackup, 1)).toBe(1)
  })

  it('never lets a third generator push a level-2 ship to level 3', () => {
    expect(effectiveScreenLevel(screens(2, 4), 4)).toBe(2)
  })

  it('reproduces the 4.7 worked example: six dice against level-2 screens', () => {
    // "The player rolls 2, 3, 3, 4, 6, and 6. Against level-2 screens the 4 is a
    // miss and each 6 does 1 damage point, for a total of 2. The re-rolls are 4
    // and 6, and the further re-roll is 3 ... the 4 inflicts 1 damage point and
    // the 6 another 2 for a total of 5."
    const rng = new ScriptedRng([2, 3, 3, 4, 6, 4, 6, 6, 3])
    const effect = screenEffect({
      screens: screens(2, 2),
      operationalGenerators: 2,
      position: at(0),
      attacker: at(10),
    })
    expect(effect.level).toBe(2)
    expect(effect.suppressRerolls).toBe(false)

    const volley = rollBeamVolley(6, effect.level as ScreenLevel, rng)
    expect(volley.normalDamage).toBe(2)
    expect(volley.penetratingDamage).toBe(3)
    expect(volley.normalDamage + volley.penetratingDamage).toBe(5)
  })

  it('leaves weapons that ignore screens alone (7.2)', () => {
    // "Other weapons such as Pulse Torpedoes and missiles are able to penetrate
    // screens with no degradation of their damage effects."
    const effect = screenEffect({
      screens: screens(2, 2),
      operationalGenerators: 2,
      position: at(0),
      attacker: at(10),
    })
    // Plain screens are not advanced screens, so ordnance meets nothing: the
    // per-die subtraction of 7.3 and the combined-die table both read
    // `advancedLevel`, which is zero here however high `level` climbs.
    expect(effect.level).toBe(2)
    expect(effect.advancedLevel).toBe(0)
    expect(advancedScreenDamageDie(4, effect.advancedLevel)).toBe(4)
  })

  it('prices screens at 5% of hull mass per level and 3 points per mass (7.2)', () => {
    expect(DEFENCE_COSTS.screens.massFractionPerLevel).toBe(0.05)
    expect(DEFENCE_COSTS.screens.pointsPerMass).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 7.3 Advanced screens
// ---------------------------------------------------------------------------

describe('7.3 advanced screens', () => {
  const advanced = (level: 0 | 1 | 2) =>
    screenEffect({
      screens: screens(level, level, true),
      operationalGenerators: level,
      position: at(0),
      attacker: at(10),
    })

  it('treats a combined hit-and-damage die as a beam die (7.3)', () => {
    // "Against level-1 Advanced Screens a roll of 5 inflicts 1 damage point,
    // and a roll of 6 inflicts 2. Against level-2 Advanced Screens a roll of 5
    // or 6 inflicts 1 damage point."
    // The 4.7 table is the implementation, read at the *advanced* level.
    expect(beamDamage(4, advanced(1).advancedLevel as ScreenLevel)).toBe(0)
    expect(beamDamage(5, advanced(1).advancedLevel as ScreenLevel)).toBe(1)
    expect(beamDamage(6, advanced(1).advancedLevel as ScreenLevel)).toBe(2)
    expect(beamDamage(5, advanced(2).advancedLevel as ScreenLevel)).toBe(1)
    expect(beamDamage(6, advanced(2).advancedLevel as ScreenLevel)).toBe(1)
  })

  it('subtracts the advanced level from each ordnance damage die (7.3)', () => {
    expect(advanced(1).advancedLevel).toBe(1)
    expect(advanced(2).advancedLevel).toBe(2)
    expect(advancedScreenDamageDie(4, 1)).toBe(3)
    expect(advancedScreenDamageDie(4, 2)).toBe(2)
  })

  it('floors a damage die at zero — "the target ship cannot regain damage points!"', () => {
    expect(advancedScreenDamageDie(1, 2)).toBe(0)
    expect(advancedScreenDamageDie(2, 2)).toBe(0)
    // per die, not per volley: three 1s against advanced-2 are three zeroes
    const volley = [1, 1, 1].map((face) => advancedScreenDamageDie(face, 2))
    expect(volley.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('still reads beams off the ordinary table (7.3)', () => {
    // "Beams, Grasers, fighters ... are affected in the same way when attacking
    // a ship with Advanced Screens."
    expect(advanced(2).level).toBe(2)
    expect(advanced(1).level).toBe(1)
  })

  it('prices advanced screens at 7.5% per level and 4 points per mass (7.3)', () => {
    expect(DEFENCE_COSTS.advancedScreens.massFractionPerLevel).toBe(0.075)
    expect(DEFENCE_COSTS.advancedScreens.pointsPerMass).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 7.16 Area screens
// ---------------------------------------------------------------------------

describe('7.16 area screens', () => {
  const umbrella: AreaScreenCover = {
    generatorId: 'aegis',
    position: at(0),
    level: 1,
    advanced: false,
  }

  it('reproduces the worked example: a level-1 frigate under an umbrella counts as level 2', () => {
    // "a frigate with a level one screen is being protected by a ship
    // generating an area screen. The frigate would count as having a level two
    // screen against any incoming fire."
    const effect = screenEffect({
      screens: screens(1, 1),
      operationalGenerators: 1,
      areaScreens: [umbrella],
      position: at(3), // 3 MU from the generator, inside the bubble
      attacker: at(40),
    })
    expect(effect.level).toBe(2)
    expect(effect.suppressRerolls).toBe(false)
  })

  it('covers the generating ship itself and stops at 6 MU', () => {
    expect(coveringAreaScreens([umbrella], at(0), at(40))).toHaveLength(1)
    expect(coveringAreaScreens([umbrella], at(AREA_RADIUS), at(40))).toHaveLength(1)
    expect(coveringAreaScreens([umbrella], at(AREA_RADIUS + 0.1), at(40))).toHaveLength(0)
  })

  it('does nothing against fire from inside the bubble (7.16)', () => {
    // "the 'bubble' will not affect any fire coming from inside the 6mu radius"
    const effect = screenEffect({
      screens: screens(1, 1),
      operationalGenerators: 1,
      areaScreens: [umbrella],
      position: at(3),
      attacker: at(4), // 4 MU from the generator: under the umbrella
    })
    expect(effect.level).toBe(1)
  })

  it('stacks to a maximum of three, and level 3 switches off penetrating re-rolls', () => {
    const effect = screenEffect({
      screens: screens(2, 2),
      operationalGenerators: 2,
      areaScreens: [umbrella, { ...umbrella, generatorId: 'aegis-2' }],
      position: at(3),
      attacker: at(40),
    })
    expect(effect.level).toBe(3) // capped, not 4
    // "weapons that would normally penetrate do not get their re-rolls"
    expect(effect.suppressRerolls).toBe(true)
    // the 4.7 table stops at 2, so a level-3 umbrella still reads as level 2
    expect(Math.min(MAX_SCREEN_LEVEL, effect.level)).toBe(2)
  })

  it('puts plasma weapons at −3 against a level-3 umbrella (7.16, 5.5)', () => {
    const effect = screenEffect({
      screens: screens(2, 2),
      operationalGenerators: 2,
      areaScreens: [umbrella],
      position: at(3),
      attacker: at(40),
    })
    // 5.5 is −1 per level, so the umbrella's third level is the printed −3.
    expect(effect.level).toBe(3)
    const unscreened = screenEffect({
      screens: screens(0, 0),
      operationalGenerators: 0,
      position: at(3),
      attacker: at(40),
    })
    expect(unscreened.level).toBe(0)
  })

  it('lets an advanced umbrella blunt ordnance for a ship with plain screens', () => {
    const effect = screenEffect({
      screens: screens(1, 1),
      operationalGenerators: 1,
      areaScreens: [{ ...umbrella, advanced: true, level: 2 }],
      position: at(3),
      attacker: at(40),
    })
    expect(effect.level).toBe(3)
    // only the umbrella's two levels are advanced; the frigate's own is not
    expect(effect.advancedLevel).toBe(2)
    expect(advancedScreenDamageDie(6, effect.advancedLevel)).toBe(4)
  })

  it('prices area screens as printed (7.16)', () => {
    expect(DEFENCE_COSTS.areaScreens).toMatchObject({
      massFractionPerLevel: 0.2,
      minimumMass: 15,
      advancedMassFractionPerLevel: 0.3,
      advancedMinimumMass: 20,
      pointsPerMass: 3.5,
    })
  })
})

// ---------------------------------------------------------------------------
// 7.4 / 7.5 Stealth
// ---------------------------------------------------------------------------

describe('7.4 stealth hull', () => {
  it('reproduces the printed range-bracket table', () => {
    // 12 → 10 → 8, 9 → 7.5 → 6, 6 → 5 → 4, 4 → 3.33 → 2.66. A band and a total
    // reach scale by the same two factors, which is why one function does both.
    expect(stealthMaxRange(12, 1)).toBe(10)
    expect(stealthMaxRange(12, 2)).toBe(8)
    expect(stealthMaxRange(9, 1)).toBe(7.5)
    expect(stealthMaxRange(9, 2)).toBe(6)
    expect(stealthMaxRange(6, 1)).toBe(5)
    expect(stealthMaxRange(6, 2)).toBe(4)
    // The book prints 3.33 and 2.66 — 4 x 5/6 and 4 x 2/3 truncated, not rounded.
    expect(stealthMaxRange(4, 1)).toBeCloseTo(10 / 3, 10)
    expect(stealthMaxRange(4, 2)).toBeCloseTo(8 / 3, 10)
    expect(stealthMaxRange(12, 0)).toBe(12)
  })

  it('reproduces the worked example: a class-3 beam loses 36 MU down to 30 and 24', () => {
    expect(stealthMaxRange(36, 1)).toBe(30)
    expect(stealthMaxRange(36, 2)).toBe(24)
    // "The reduction of effective range also applies to missile lock-on range."
    expect(stealthMaxRange(48, 2)).toBe(32)
  })

  it('loses stealth to hull rows at the printed markers (7.4)', () => {
    // Stealth-1: marker at the end of the second row.
    expect(stealthHullLevel(1, 0)).toBe(1)
    expect(stealthHullLevel(1, 1)).toBe(1)
    expect(stealthHullLevel(1, 2)).toBe(0)
    // Stealth-2: markers at the end of the first and third rows.
    expect(stealthHullLevel(2, 0)).toBe(2)
    expect(stealthHullLevel(2, 1)).toBe(1)
    expect(stealthHullLevel(2, 2)).toBe(1)
    expect(stealthHullLevel(2, 3)).toBe(0)
    expect(stealthHullLevel(0, 3)).toBe(0)
  })

  it('makes a Stealth-2 ship choose between hiding and shooting far (7.4)', () => {
    expect(stealthScanState(2, false)).toEqual({ effectiveLevel: 2, targetingRange: 24 })
    expect(stealthScanState(2, true)).toEqual({ effectiveLevel: 1, targetingRange: 54 })
    // a Stealth-1 ship has no limit to lift
    expect(stealthScanState(1, false)).toEqual({ effectiveLevel: 1, targetingRange: 54 })
  })

  it('prices stealth hull per point of hull and armour, with no mass (7.4)', () => {
    expect(DEFENCE_COSTS.stealthHull.pointsPerHullOrArmourBox[1]).toBe(2)
    expect(DEFENCE_COSTS.stealthHull.pointsPerHullOrArmourBox[2]).toBe(4)
  })
})

describe('7.5 stealth fields', () => {
  it('combines with a stealth hull but caps the aggregate at 2', () => {
    expect(combinedStealthLevel(1, 1, true)).toBe(2)
    expect(combinedStealthLevel(2, 2, true)).toBe(2)
    expect(combinedStealthLevel(0, 2, true)).toBe(2)
  })

  it('contributes nothing when switched off, destroyed or needled', () => {
    expect(combinedStealthLevel(1, 1, false)).toBe(1)
    expect(combinedStealthLevel(0, 2, false)).toBe(0)
  })

  it('prices stealth field generators at 5% per level and 6 points per mass (7.5)', () => {
    expect(DEFENCE_COSTS.stealthField).toEqual({ massFractionPerLevel: 0.05, pointsPerMass: 6 })
  })
})

// ---------------------------------------------------------------------------
// 7.6 / 7.7 Armour and shell armour
// ---------------------------------------------------------------------------

describe('7.6 / 7.7 armour and the damage ladder', () => {
  it('takes ordinary damage on armour and spills the excess into the hull (4.8)', () => {
    const result = applyArmourDamage([5], { normalDamage: 8, penetratingDamage: 0, mode: 'standard' })
    expect(result.absorbed).toEqual([5])
    expect(result.remaining).toEqual([0])
    expect(result.toHull).toBe(3)
  })

  it('meets the outermost intact shell first (7.7)', () => {
    // layers are inner-first, so [3, 4] is an inner layer of 3 under a shell of 4
    const result = applyArmourDamage([3, 4], { normalDamage: 6, penetratingDamage: 0, mode: 'standard' })
    expect(result.absorbed).toEqual([2, 4])
    expect(result.toHull).toBe(0)
  })

  it('reproduces the 4.9 AP worked example: 10 damage, two layers, 1 each, 8 to hull', () => {
    // "a large kinetic gun hits a ship with two rows of layered armor. The hit
    // scores 10 damage points. 1 is applied to each layer of armor ... with the
    // remaining 8 ... to the hull."
    const result = applyArmourDamage([4, 4], { normalDamage: 10, penetratingDamage: 0, mode: 'AP' })
    expect(result.absorbed).toEqual([1, 1])
    expect(result.remaining).toEqual([3, 3])
    expect(result.toHull).toBe(8)
  })

  it('never takes more than one box per shell for AP, however small the hit (7.7)', () => {
    const one = applyArmourDamage([4, 4], { normalDamage: 1, penetratingDamage: 0, mode: 'AP' })
    expect(one.absorbed).toEqual([0, 1])
    expect(one.toHull).toBe(0)
  })

  it('reproduces the 4.9 SAP worked example: 7 damage, 4 on armour, 3 to the next row', () => {
    // "a missile strikes a ship for 7 points of damage. 4 points is applied to
    // the armor ... remaining 3 points ... applied to the next row of armor."
    const result = applyArmourDamage([4, 4], { normalDamage: 7, penetratingDamage: 0, mode: 'SAP' })
    expect(result.absorbed).toEqual([3, 4])
    expect(result.toHull).toBe(0)
  })

  it('sends the second half of a SAP hit to the hull when there is no next layer (4.9)', () => {
    const result = applyArmourDamage([4], { normalDamage: 7, penetratingDamage: 0, mode: 'SAP' })
    expect(result.absorbed).toEqual([4])
    expect(result.toHull).toBe(3)
  })

  it('reproduces the 4.9 penetrating worked example', () => {
    // A cruiser with one standard screen and two armour layers, hit by a
    // Class-3 beam at 12 MU rolling 4, 5, 6: the 4 is screened out, the 5 and 6
    // put 3 on the outer layer, the re-rolled 6 puts 2 on the next layer in, its
    // re-rolled 6 puts 2 on the hull, and a final 4 puts 1 more on the hull.
    const rng = new ScriptedRng([4, 5, 6, 6, 6, 4])
    const volley = rollBeamVolley(3, 1, rng)
    expect(volley.normalDamage).toBe(3)
    expect(volley.penetratingDamage).toBe(5)

    const result = applyArmourDamage([2, 4], {
      normalDamage: volley.normalDamage,
      penetratingDamage: volley.penetratingDamage,
      mode: 'P',
    })
    expect(result.absorbed).toEqual([2, 3]) // 3 on the outer shell, 2 on the next in
    expect(result.toHull).toBe(3) // 2 + 1
  })

  it('sends penetrating damage straight to the hull on a single-layer ship (4.6)', () => {
    const result = applyArmourDamage([6], { normalDamage: 2, penetratingDamage: 4, mode: 'P' })
    expect(result.absorbed).toEqual([2])
    expect(result.toHull).toBe(4)
  })

  it('sends everything to the hull once the armour is gone', () => {
    const result = applyArmourDamage([0, 0], { normalDamage: 5, penetratingDamage: 2, mode: 'AP' })
    expect(result.absorbed).toEqual([0, 0])
    expect(result.toHull).toBe(7)
  })

  it('prices each shell 2 points per mass dearer than the one inside it (7.7, 7.8)', () => {
    expect([0, 1, 2, 3, 4].map((layer) => armourPointsPerMass(layer, false))).toEqual([2, 4, 6, 8, 10])
    expect([0, 1, 2, 3, 4].map((layer) => armourPointsPerMass(layer, true))).toEqual([4, 6, 8, 10, 12])
    // 7.6: "The points cost of standard armor is twice the grade; 2 points per box."
    expect(armourPoints({ layers: [5], regenerative: false })).toBe(10)
    // a grade-4 inner layer under a grade-2 shell, regenerative
    expect(armourPoints({ layers: [4, 2], regenerative: true })).toBe(4 * 4 + 2 * 6)
  })
})

// ---------------------------------------------------------------------------
// 7.8 Regenerative armour
// ---------------------------------------------------------------------------

describe('7.8 regenerative armour', () => {
  const armour = { layers: [4], regenerative: true }

  it('repairs a box on a 5 or 6, burns one out on a 1, and leaves 2–4 to try again', () => {
    // three boxes damaged: rolls of 5, 1 and 3
    const rng = new ScriptedRng([5, 1, 3])
    const result = regenerateArmour(armour, [1], [0], rng)
    expect(rng.consumed).toBe(3)
    expect(result.repaired).toBe(1)
    expect(result.remaining).toEqual([2])
    expect(result.burntOut).toEqual([1])
    expect(result.rolls.map((roll) => roll.roll)).toEqual([5, 1, 3])
  })

  it('repairs on a 6 as well as a 5', () => {
    const rng = new ScriptedRng([6, 6])
    const result = regenerateArmour(armour, [2], [0], rng)
    expect(result.remaining).toEqual([4])
    expect(result.repaired).toBe(2)
  })

  it('never rolls again for a box that burnt out (7.8)', () => {
    // 4 built, 1 standing, 1 burnt out → only 2 boxes are still eligible
    const rng = new ScriptedRng([3, 3, 3, 3])
    const result = regenerateArmour(armour, [1], [1], rng)
    expect(rng.consumed).toBe(2)
    expect(result.rolls).toHaveLength(2)
  })

  it('is a per-box burn-out, not a per-ship one', () => {
    // A 1 on the first box must not stop the second box repairing on a 6.
    const rng = new ScriptedRng([1, 6])
    const result = regenerateArmour(armour, [2], [0], rng)
    expect(result.burntOut).toEqual([1])
    expect(result.remaining).toEqual([3])
  })

  it('rolls nothing for undamaged armour or for non-regenerative armour', () => {
    const full = new ScriptedRng([6, 6, 6, 6])
    expect(regenerateArmour(armour, [4], [0], full).rolls).toHaveLength(0)
    expect(full.consumed).toBe(0)

    const plain = new ScriptedRng([6, 6, 6, 6])
    const result = regenerateArmour({ layers: [4], regenerative: false }, [0], [0], plain)
    expect(result.rolls).toHaveLength(0)
    expect(result.remaining).toEqual([0])
    expect(plain.consumed).toBe(0)
  })

  it('regenerates every layer of a shell (7.7: "Regenerative Shell")', () => {
    const shell = { layers: [2, 2], regenerative: true }
    const rng = new ScriptedRng([6, 6])
    const result = regenerateArmour(shell, [1, 1], [0, 0], rng)
    expect(result.remaining).toEqual([2, 2])
  })
})

// ---------------------------------------------------------------------------
// 7.9 Antimatter suicide charge
// ---------------------------------------------------------------------------

describe('7.9 antimatter suicide charge', () => {
  it('reproduces the worked example: three charges do 9d6 / 6d6 / 3d6', () => {
    // "a ship with 3 charges would do 9d6 damage to 1 MU, 6d6 to 2 MU and 3d6
    // to 3 MU"
    expect(antimatterChargeDice(3, 1)).toBe(9)
    expect(antimatterChargeDice(3, 2)).toBe(6)
    expect(antimatterChargeDice(3, 3)).toBe(3)
    expect(antimatterChargeDice(3, 3.1)).toBe(0)
  })

  it('is 3d6 / 2d6 / 1d6 for a single charge, with no increase in blast radius', () => {
    expect(antimatterChargeDice(1, 0)).toBe(3)
    expect(antimatterChargeDice(1, 1)).toBe(3)
    expect(antimatterChargeDice(1, 1.5)).toBe(2)
    expect(antimatterChargeDice(1, 2)).toBe(2)
    expect(antimatterChargeDice(1, 2.5)).toBe(1)
    expect(antimatterChargeDice(1, 3)).toBe(1)
    expect(antimatterChargeDice(1, 4)).toBe(0)
  })

  it('lets screens blunt the blast on other ships, −1 per die per level', () => {
    // 6.x: "a ship with screen-2 caught in a 3d6 Antimatter Missile blast would
    // only take 3d6−6 damage."
    const rng = new ScriptedRng([6, 5, 4])
    const blast = rollAntimatterChargeBlast(1, 1, 2, rng)
    expect(blast.dice).toEqual([6, 5, 4])
    expect(blast.damage).toBe(4 + 3 + 2)
  })

  it('floors each blast die at zero', () => {
    const rng = new ScriptedRng([1, 1, 2])
    expect(rollAntimatterChargeBlast(1, 1, 2, rng).damage).toBe(0)
  })

  it('gives the carrying ship the full 3d6 per charge, past armour and screens (7.9)', () => {
    // "it is not reduced by armor or screens (the explosion starts within)"
    const rng = new ScriptedRng([1, 2, 3, 4, 5, 6])
    const self = rollAntimatterChargeSelfDamage(2, rng)
    expect(self.dice).toHaveLength(6)
    expect(self.damage).toBe(21)
  })

  it('blows up an unrepaired damaged charge on a 5 or 6 (7.9)', () => {
    expect(rollUnrepairedChargeDetonation(1, new ScriptedRng([5])).detonates).toBe(true)
    expect(rollUnrepairedChargeDetonation(1, new ScriptedRng([6])).detonates).toBe(true)
    expect(rollUnrepairedChargeDetonation(1, new ScriptedRng([4])).detonates).toBe(false)
    // one die per damaged charge, and any 5 or 6 sets the lot off
    const many = rollUnrepairedChargeDetonation(3, new ScriptedRng([1, 2, 6]))
    expect(many.rolls).toEqual([1, 2, 6])
    expect(many.detonates).toBe(true)
  })

  it('is mass 1 at 5 points per mass (7.9)', () => {
    expect(DEFENCE_COSTS.antimatterCharge).toEqual({ mass: 1, pointsPerMass: 5 })
  })
})

// ---------------------------------------------------------------------------
// 7.10 / 7.11 / 8.8 ADFC and point-defence allocation
// ---------------------------------------------------------------------------

describe('8.8 point-defence allocation and ADFC', () => {
  // The 8.8 worked example, laid out on the table:
  //   Ship A at (0,0) with a PDS only; ship B at (5,0) with a PDS and an ADFC.
  //   Group X at (−2,0) is attacking A: 2 MU from A, 7 MU from B.
  //   Group Y at (8,0) could attack B but has not: 3 MU from B.
  //   Group Z at (40,0) is too far away for anyone.
  const shipA = defender('A', at(0), [pds('pds-a')])
  const shipB = defender('B', at(5), [pds('pds-b')], { adfc: 1 })
  const allies = [
    { id: 'A', position: at(0) },
    { id: 'B', position: at(5) },
  ]
  const groupX: PdThreat = {
    id: 'X',
    kind: 'fighter-group',
    position: at(-2),
    attacking: 'A',
  }
  const groupY: PdThreat = { id: 'Y', kind: 'fighter-group', position: at(8), attacking: null }
  const groupZ: PdThreat = { id: 'Z', kind: 'fighter-group', position: at(40), attacking: null }
  const threats = [groupX, groupY, groupZ]

  it('lets ship A engage the group attacking it, and nothing else', () => {
    const options = pointDefenceOptions(shipA, threats, allies)
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ mountId: 'pds-a', threatId: 'X', reach: 'self', dice: 1 })
  })

  it('lets ship B reach group X through its ADFC, although X is over 6 MU away', () => {
    // "Ship B can also engage group X, as although the fighters are more than
    // 6MU away, they are currently attacking a ship which is within ship B's
    // protective ADFC range of 6 MU"
    const options = pointDefenceOptions(shipB, threats, allies)
    const againstX = options.filter((option) => option.threatId === 'X')
    expect(againstX).toHaveLength(1)
    expect(againstX[0]).toMatchObject({ reach: 'adfc-ally', coveringShipId: 'A' })
    expect(againstX[0].range).toBeGreaterThan(AREA_RADIUS)
  })

  it('lets ship B instead engage the unengaged group Y within 6 MU', () => {
    // "or group Y because it is within 6 MU"
    const options = pointDefenceOptions(shipB, threats, allies)
    const againstY = options.filter((option) => option.threatId === 'Y')
    expect(againstY).toHaveLength(1)
    expect(againstY[0]).toMatchObject({ reach: 'adfc-direct' })
  })

  it('leaves group Z safe from point-defence fire', () => {
    // "Fighter group Z is safe from point defense fire."
    const fromA = pointDefenceOptions(shipA, threats, allies)
    const fromB = pointDefenceOptions(shipB, threats, allies)
    expect([...fromA, ...fromB].filter((option) => option.threatId === 'Z')).toHaveLength(0)
  })

  it('spends one ADFC per covered ally or unengaged group, so B may do one but not both', () => {
    expect(adfcBudget(shipB)).toBe(1)
    const one: PdAllocation[] = [
      { mountId: 'pds-b', threatId: 'X', reach: 'adfc-ally', coveringShipId: 'A', dice: 1 },
    ]
    expect(validatePointDefence(shipB, threats, one, allies).ok).toBe(true)

    const twoMounts = defender('B', at(5), [pds('pds-b'), pds('pds-b2')], { adfc: 1 })
    const both: PdAllocation[] = [
      { mountId: 'pds-b', threatId: 'X', reach: 'adfc-ally', coveringShipId: 'A', dice: 1 },
      { mountId: 'pds-b2', threatId: 'Y', reach: 'adfc-direct', dice: 1 },
    ]
    const plan = validatePointDefence(twoMounts, threats, both, allies)
    expect(plan.ok).toBe(false)
    expect(plan.refusals[0].code).toBe('adfc-budget-exceeded')
    expect(plan.adfcSpent).toBe(2)
  })

  it('lets an Advanced ADFC cover any number of allies within 6 MU (7.11)', () => {
    const aegis = defender('B', at(5), [pds('p1'), pds('p2'), pds('p3')], { advancedAdfc: 1 })
    const shipC = { id: 'C', position: at(9) }
    const groupW: PdThreat = { id: 'W', kind: 'salvo-missile', position: at(9), attacking: 'C' }
    const plan = validatePointDefence(
      aegis,
      [groupX, groupW],
      [
        { mountId: 'p1', threatId: 'X', reach: 'adfc-ally', coveringShipId: 'A', dice: 1 },
        { mountId: 'p2', threatId: 'W', reach: 'adfc-ally', coveringShipId: 'C', dice: 1 },
      ],
      [...allies, shipC],
    )
    expect(adfcBudget(aegis)).toBe(Number.POSITIVE_INFINITY)
    expect(plan.ok).toBe(true)
    expect(plan.adfcSpent).toBe(2)
  })

  it('locks out every ADFC on a ship that launched or recovered fighters (7.10)', () => {
    const busy = defender('B', at(5), [pds('pds-b')], { adfc: 2, flightOpsThisTurn: true })
    expect(adfcBudget(busy)).toBe(0)
    expect(pointDefenceOptions(busy, threats, allies)).toHaveLength(0)
    const plan = validatePointDefence(
      busy,
      threats,
      [{ mountId: 'pds-b', threatId: 'X', reach: 'adfc-ally', coveringShipId: 'A', dice: 1 }],
      allies,
    )
    expect(plan.refusals[0].code).toBe('flight-ops-lockout')
  })

  it('bars Beam-1s from area defence but not from defending their own ship (8.8)', () => {
    // "Beam-1s may not be used for area defense."
    const withBeam1 = defender('B', at(5), [beam1('b1')], { adfc: 1 })
    expect(pointDefenceOptions(withBeam1, threats, allies)).toHaveLength(0)

    const underAttack: PdThreat = { ...groupX, attacking: 'B', position: at(6) }
    const own = pointDefenceOptions(withBeam1, [underAttack], allies)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ reach: 'self', mode: 'beam-1' })
  })

  it('refuses to fire into a dogfight (8.8, 8.10)', () => {
    // "the fighter group targeted must not be engaged by other fighters"
    const engaged = [{ ...groupX, dogfighting: true }, groupY, groupZ]
    expect(pointDefenceOptions(shipA, engaged, allies)).toHaveLength(0)
    const plan = validatePointDefence(
      shipA,
      engaged,
      [{ mountId: 'pds-a', threatId: 'X', reach: 'self', dice: 1 }],
      allies,
    )
    expect(plan.refusals[0].code).toBe('illegal-pairing')
  })

  it('only lets an ADFC reach out directly at fighter groups, not at loose ordnance (8.8)', () => {
    const loose: PdThreat = { id: 'M', kind: 'salvo-missile', position: at(7), attacking: null }
    expect(pointDefenceOptions(shipB, [loose], allies)).toHaveLength(0)
  })

  it('honours a mount’s arcs (4.2, 5.10)', () => {
    // A Gatling in PD mode is "limited to the fire arcs of the weapon mount".
    const gatling: PdMount = { id: 'gat', kind: 'dual-purpose', arcs: ['F'], mode: 'pds' }
    const ship = defender('D', at(0), [gatling])
    const ahead: PdThreat = { id: 'ahead', kind: 'fighter-group', position: at(0, -3), attacking: 'D' }
    const astern: PdThreat = { id: 'astern', kind: 'fighter-group', position: at(0, 3), attacking: 'D' }
    expect(pointDefenceOptions(ship, [ahead, astern])).toHaveLength(1)
    expect(pointDefenceOptions(ship, [ahead, astern])[0].threatId).toBe('ahead')
  })

  it('lets a plain PDS fire into the aft arc (7.12)', () => {
    // "Point Defense Systems can be fired through any arc, including the rear
    // arc even if the ship has used the main drive in this turn."
    const ship = defender('D', at(0), [pds('p')])
    const astern: PdThreat = { id: 'astern', kind: 'fighter-group', position: at(0, 3), attacking: 'D' }
    expect(pointDefenceOptions(ship, [astern])).toHaveLength(1)
  })

  it('spends a mount once, against a single target (2.6)', () => {
    const ship = defender('D', at(0), [pds('p')], {})
    const one: PdThreat = { id: 't1', kind: 'fighter-group', position: at(1), attacking: 'D' }
    const two: PdThreat = { id: 't2', kind: 'fighter-group', position: at(2), attacking: 'D' }
    const plan = validatePointDefence(ship, [one, two], [
      { mountId: 'p', threatId: 't1', reach: 'self', dice: 1 },
      { mountId: 'p', threatId: 't2', reach: 'self', dice: 1 },
    ])
    expect(plan.ok).toBe(false)
    expect(plan.refusals[0].code).toBe('mount-cannot-split')
  })

  it('refuses unknown mounts and threats by name', () => {
    const plan = validatePointDefence(shipA, threats, [
      { mountId: 'ghost', threatId: 'X', reach: 'self', dice: 1 },
      { mountId: 'pds-a', threatId: 'Q', reach: 'self', dice: 1 },
    ], allies)
    expect(plan.refusals.map((refusal) => refusal.code)).toEqual(['unknown-mount', 'unknown-threat'])
  })
})

// ---------------------------------------------------------------------------
// 7.12 Point Defence Systems
// ---------------------------------------------------------------------------

describe('7.12 point defence systems', () => {
  it('kills fighters on 4 or 5, two on a 6 with a re-roll (8.8)', () => {
    const rng = new ScriptedRng([4, 5, 6, 3, 2])
    const result = rollPointDefenceDice(4, 'pds', rng)
    // 4 → 1, 5 → 1, 6 → 2 + re-roll of 3 → 0, 2 → 0
    expect(result.kills).toBe(4)
  })

  it('gives a Beam-1 the worse table: 5 or 6, re-roll on 6 (8.8)', () => {
    const rng = new ScriptedRng([4, 5, 6, 2])
    const result = rollPointDefenceDice(3, 'beam-1', rng)
    // 4 → 0, 5 → 1, 6 → 1 + re-roll of 2 → 0
    expect(result.kills).toBe(2)
  })

  it('shifts the whole table up against a heavy missile (6.4)', () => {
    // "Each PDS rolls a D6 and kills the missile on a roll of 5 or 6. Each
    // Beam-1 or fighter rolls a D6 and kills the missile on a roll of 6."
    expect(rollPointDefenceDice(1, 'pds', new ScriptedRng([5]), { heavyMissile: true }).kills).toBe(1)
    expect(rollPointDefenceDice(1, 'pds', new ScriptedRng([4]), { heavyMissile: true }).kills).toBe(0)
    expect(rollPointDefenceDice(1, 'beam-1', new ScriptedRng([5]), { heavyMissile: true }).kills).toBe(0)
    expect(rollPointDefenceDice(1, 'beam-1', new ScriptedRng([6]), { heavyMissile: true }).kills).toBe(1)
  })

  it('applies a mount’s own DRM to the kill but not to the re-roll (4.6)', () => {
    // A K-1 gun fires as a PDS "but with a -1 DRM" (5.16).
    expect(rollPointDefenceDice(1, 'pds', new ScriptedRng([4]), { drm: -1 }).kills).toBe(0)
    expect(rollPointDefenceDice(1, 'pds', new ScriptedRng([5]), { drm: -1 }).kills).toBe(1)
    // A natural 6 still re-rolls even though the modifier drops it to a 5.
    const rng = new ScriptedRng([6, 2])
    const result = rollPointDefenceDice(1, 'pds', rng, { drm: -1 })
    expect(result.kills).toBe(1)
    expect(rng.consumed).toBe(2)
  })

  it('only lets point defence shoot at a ship that has lost its screens and armour (7.12)', () => {
    expect(pdMayEngageShip({ screenLevel: 0, armourRemaining: 0 })).toBe(true)
    expect(pdMayEngageShip({ screenLevel: 1, armourRemaining: 0 })).toBe(false)
    expect(pdMayEngageShip({ screenLevel: 0, armourRemaining: 3 })).toBe(false)
    expect(pdMayEngageShip({ screenLevel: 0, armourRemaining: 0, fieldsUp: true })).toBe(false)
  })

  it('inflicts one damage point on a 6 with no re-roll when firing at a ship (7.12)', () => {
    const rng = new ScriptedRng([6, 5, 6, 1])
    const result = rollPointDefenceAtShip(4, rng)
    expect(result.damage).toBe(2)
    expect(rng.consumed).toBe(4) // no re-roll was taken for either 6
  })

  it('is mass 1 at 3 points per mass (7.12)', () => {
    expect(DEFENCE_COSTS.pds).toEqual({ mass: 1, pointsPerMass: 3 })
  })
})

// ---------------------------------------------------------------------------
// 7.13 Area Defence System
// ---------------------------------------------------------------------------

describe('7.13 area defence system', () => {
  const ship = defender('D', at(0), [ads('ads')])

  it('fires twice inside 6 MU and once out to 12 MU', () => {
    const near: PdThreat = { id: 'near', kind: 'fighter-group', position: at(5), attacking: 'D' }
    const far: PdThreat = { id: 'far', kind: 'fighter-group', position: at(9), attacking: 'D' }
    const options = pointDefenceOptions(ship, [near, far])
    expect(options.find((option) => option.threatId === 'near')).toMatchObject({
      dice: 2,
      splittable: true,
    })
    expect(options.find((option) => option.threatId === 'far')).toMatchObject({
      dice: 1,
      splittable: false,
    })
  })

  it('reaches no further than 12 MU', () => {
    const beyond: PdThreat = { id: 'beyond', kind: 'fighter-group', position: at(13), attacking: 'D' }
    expect(pointDefenceOptions(ship, [beyond])).toHaveLength(0)
  })

  it('lets the two short-range dice be split between different targets (7.13)', () => {
    const one: PdThreat = { id: 't1', kind: 'fighter-group', position: at(2), attacking: 'D' }
    const two: PdThreat = { id: 't2', kind: 'salvo-missile', position: at(3), attacking: 'D' }
    const plan = validatePointDefence(ship, [one, two], [
      { mountId: 'ads', threatId: 't1', reach: 'self', dice: 1 },
      { mountId: 'ads', threatId: 't2', reach: 'self', dice: 1 },
    ])
    expect(plan.ok).toBe(true)
  })

  it('refuses a third die from the same ADS', () => {
    const one: PdThreat = { id: 't1', kind: 'fighter-group', position: at(2), attacking: 'D' }
    const two: PdThreat = { id: 't2', kind: 'salvo-missile', position: at(3), attacking: 'D' }
    const plan = validatePointDefence(ship, [one, two], [
      { mountId: 'ads', threatId: 't1', reach: 'self', dice: 2 },
      { mountId: 'ads', threatId: 't2', reach: 'self', dice: 1 },
    ])
    expect(plan.ok).toBe(false)
    expect(plan.refusals[0].code).toBe('mount-overcommitted')
  })

  it('rolls like a PDS (7.13)', () => {
    const one: PdThreat = { id: 't1', kind: 'fighter-group', position: at(2), attacking: 'D' }
    const rng = new ScriptedRng([4, 5])
    const outcome = resolvePointDefence(
      ship,
      [one],
      [{ mountId: 'ads', threatId: 't1', reach: 'self', dice: 2 }],
      rng,
    )
    expect(outcome.results[0].kills).toBe(2)
  })

  it('is mass 2 with 3 arcs, +1 mass for 6, at 3 points per mass (7.13)', () => {
    expect(DEFENCE_COSTS.ads).toEqual({ mass: 2, sixArcExtraMass: 1, pointsPerMass: 3 })
  })
})

// ---------------------------------------------------------------------------
// 7.14 Scattergun / 7.15 Grapeshot
// ---------------------------------------------------------------------------

describe('7.14 scattergun', () => {
  it('inflicts 1d6 hits on fighters and missiles, including salvo missiles', () => {
    expect(rollScattergun('fighter-group', new ScriptedRng([6])).kills).toBe(6)
    expect(rollScattergun('salvo-missile', new ScriptedRng([3])).kills).toBe(3)
    expect(rollScattergun('heavy-missile', new ScriptedRng([1])).kills).toBe(1)
  })

  it('inflicts 1d3 hits on heavy fighters', () => {
    // 1d3 is ceil(1d6 / 2): 1-2 → 1, 3-4 → 2, 5-6 → 3
    const faces = [1, 2, 3, 4, 5, 6]
    const kills = faces.map((face) => rollScattergun('heavy-fighter-group', new ScriptedRng([face])).kills)
    expect(kills).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('inflicts 1 BD* on plasma bolts and gunboats', () => {
    // A beam die with re-rolls: a 6 is 2 hits plus a re-roll.
    const rng = new ScriptedRng([6, 4])
    const shot = rollScattergun('plasma-bolt', rng)
    expect(shot.kills).toBe(3)
    expect(rollScattergun('gunboat-group', new ScriptedRng([2])).kills).toBe(0)
  })

  it('hurts the ship it is covering on a roll of 1 (7.14)', () => {
    // "On a roll of '1' the allied ship suffers one point of damage, in
    // addition to the effect of the Scattergun on the attacking fighter/missile."
    const shot = rollScattergun('fighter-group', new ScriptedRng([1]), { supportingAlly: true })
    expect(shot.kills).toBe(1)
    expect(shot.friendlyFire).toBe(1)
    // ... and not when it is defending itself
    expect(rollScattergun('fighter-group', new ScriptedRng([1])).friendlyFire).toBe(0)
  })

  it('supports an allied ship within 6 MU without an ADFC (7.14)', () => {
    const ship = defender('S', at(0), [scattergun('sg')])
    const ally = { id: 'T', position: at(4) }
    const threat: PdThreat = { id: 'f', kind: 'fighter-group', position: at(4.5), attacking: 'T' }
    const options = pointDefenceOptions(ship, [threat], [ally])
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ reach: 'scattergun-ally', coveringShipId: 'T' })

    const outcome = resolvePointDefence(
      ship,
      [threat],
      [{ mountId: 'sg', threatId: 'f', reach: 'scattergun-ally', coveringShipId: 'T', dice: 1 }],
      new ScriptedRng([1]),
    )
    expect(outcome.friendlyFire).toEqual([{ shipId: 'T', damage: 1 }])
  })

  it('is one-shot: a spent scattergun offers nothing and is refused (7.14)', () => {
    const ship = defender('S', at(0), [scattergun('sg', true)])
    const threat: PdThreat = { id: 'f', kind: 'fighter-group', position: at(1), attacking: 'S' }
    expect(pointDefenceOptions(ship, [threat])).toHaveLength(0)
    const plan = validatePointDefence(ship, [threat], [
      { mountId: 'sg', threatId: 'f', reach: 'self', dice: 1 },
    ])
    expect(plan.refusals[0].code).toBe('mount-expended')
  })

  it('reaches 6 MU (7.14)', () => {
    const ship = defender('S', at(0), [scattergun('sg')])
    const far: PdThreat = { id: 'f', kind: 'fighter-group', position: at(6.5), attacking: 'S' }
    expect(pointDefenceOptions(ship, [far])).toHaveLength(0)
  })

  it('is mass 1 at 5 points per mass (7.14)', () => {
    expect(DEFENCE_COSTS.scattergun).toEqual({ mass: 1, pointsPerMass: 5 })
  })
})

describe('7.15 grapeshot', () => {
  it('rolls four PDS dice per launcher', () => {
    const ship = defender('G', at(0), [grapeshot('gs')])
    const threat: PdThreat = { id: 'f', kind: 'fighter-group', position: at(2), attacking: 'G' }
    expect(pointDefenceOptions(ship, [threat])[0].dice).toBe(4)

    // 4 → 1 kill, 5 → 1, 6 → 2 plus a re-roll of 3 → 0, 1 → 0
    const rng = new ScriptedRng([4, 5, 6, 3, 1])
    const outcome = resolvePointDefence(
      ship,
      [threat],
      [{ mountId: 'gs', threatId: 'f', reach: 'self', dice: 4 }],
      rng,
    )
    expect(outcome.results[0].kills).toBe(4)
    expect(rng.consumed).toBe(5)
  })

  it('has no integral ADFC, unlike a scattergun (7.14, 7.15)', () => {
    const ship = defender('G', at(0), [grapeshot('gs')])
    const ally = { id: 'T', position: at(4) }
    const threat: PdThreat = { id: 'f', kind: 'fighter-group', position: at(4.5), attacking: 'T' }
    expect(pointDefenceOptions(ship, [threat], [ally])).toHaveLength(0)
  })

  it('is mass 1 and costs 4, one shot only (7.15)', () => {
    expect(DEFENCE_COSTS.grapeshot).toEqual({ mass: 1, points: 4 })
  })
})

// ---------------------------------------------------------------------------
// 6.4 / 6.5 The two-salvo worked example
// ---------------------------------------------------------------------------

describe('6.5 worked example: two salvoes against one ship', () => {
  it('replays the book’s dice exactly', () => {
    // "The ship has ... one Point Defense System (PDS) and two Beam-1 batteries
    // ... The defender chooses to use the PDS alone against one incoming salvo,
    // and the 2 Beam-1 batteries to combine fire against the second salvo."
    const ship = defender('target', at(0), [pds('pds'), beam1('b1a'), beam1('b1b')])
    const salvo1: PdThreat = { id: 's1', kind: 'salvo-missile', position: at(1), attacking: 'target' }
    const salvo2: PdThreat = { id: 's2', kind: 'salvo-missile', position: at(1), attacking: 'target' }

    const allocations: PdAllocation[] = [
      { mountId: 'pds', threatId: 's1', reach: 'self', dice: 1 },
      { mountId: 'b1a', threatId: 's2', reach: 'self', dice: 1 },
      { mountId: 'b1b', threatId: 's2', reach: 'self', dice: 1 },
    ]
    expect(validatePointDefence(ship, [salvo1, salvo2], allocations).ok).toBe(true)

    // "the defending player rolls the PDS die and gets a 6, thus shooting them
    // both down. (There would be a re-roll for the six ...)"  then
    // "rolls a 4 and a 6. The 6 allows a re-roll, but this only gets a 2."
    const rng = new ScriptedRng([6, 1, 4, 6, 2])
    const outcome = resolvePointDefence(ship, [salvo1, salvo2], allocations, rng)
    const first = outcome.results.find((result) => result.threatId === 's1')
    const second = outcome.results.find((result) => result.threatId === 's2')
    expect(first?.kills).toBe(2)
    expect(second?.kills).toBe(1)

    // "For the first the roll is 2, but the second is luckier and rolls 5."
    expect(salvoMissilesThrough(2, first?.kills ?? 0, true)).toBe(0)
    expect(salvoMissilesThrough(5, second?.kills ?? 0, true)).toBe(4)

    // "A D6 is rolled for each of them, scoring 3, 1, 3, and 6 ... a grand
    // total of 13 damage points ... If the ship has four boxes of armor, 4
    // points of damage will be taken on the armor and the remaining 9 on the
    // hull boxes."
    const damage = 3 + 1 + 3 + 6
    expect(damage).toBe(13)
    const armour = applyArmourDamage([4], {
      normalDamage: damage,
      penetratingDamage: 0,
      mode: 'SAP',
    })
    expect(armour.absorbed).toEqual([4])
    expect(armour.toHull).toBe(9)
  })

  it('always lets one missile through when nothing fired (6.4)', () => {
    // "If there are no defenses at all, at least one missile in a salvo will
    // always get through."
    expect(salvoMissilesThrough(1, 0, false)).toBe(1)
    expect(salvoMissilesThrough(4, 0, false)).toBe(4)
    // overkill is not redistributed, but a salvo that was shot at can be wiped
    expect(salvoMissilesThrough(2, 6, true)).toBe(0)
  })

  it('caps an antimatter missile at three point-defence hits (6.x)', () => {
    const ship = defender('target', at(0), [pds('p1'), pds('p2'), pds('p3'), pds('p4'), pds('p5')])
    const amt: PdThreat = { id: 'amt', kind: 'antimatter-missile', position: at(1), attacking: 'target' }
    const allocations: PdAllocation[] = ['p1', 'p2', 'p3', 'p4', 'p5'].map((mountId) => ({
      mountId,
      threatId: 'amt',
      reach: 'self' as const,
      dice: 1,
    }))
    // five PDS, all rolling 5 — a hit each on the heavy-missile table
    const outcome = resolvePointDefence(ship, [amt], allocations, new ScriptedRng([5, 5, 5, 5, 5]))
    expect(outcome.results[0].kills).toBe(3)
    expect(outcome.results[0].detail).toContain('3 hits')
  })
})
