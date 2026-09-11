/**
 * Combat tests (4.1 – 4.11).
 *
 * Every worked example the rulebook prints in section 4 is a named case here —
 * they are the only authoritative check on the damage pipeline, and they are
 * exactly the cases that are easy to get subtly wrong. The prose each one is
 * taken from is quoted above it so a reader can check the arithmetic without
 * opening the PDF. Rules text: `docs/rules/combat.md`.
 */

import { describe, expect, it } from 'vitest'

import {
  applyDamage,
  applyVolley,
  combinedBeamDice,
  createTargetState,
  fireConsRequired,
  hullRowBounds,
  planFireControl,
  rollBeamAttack,
  rowBoundsFor,
  rowsCrossedBetween,
  scoreBeamDice,
  thresholdTrigger,
  type DamageableTarget,
  type FireControlWeapon,
  type TargetBearing,
} from './combat'
import { Rng, beamDamage, thresholdTarget } from './dice'
import type { ArmourDef, HullRows, ShipDesign } from './types'
import type { WeaponResult } from './weapons/contract'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A bare damage track: `armour` is inner layer first, as `ArmourDef` is. */
function targetWith(
  hullBoxes: number,
  hullRows: HullRows,
  armour: number[] = [],
): DamageableTarget {
  return { hullBoxes, hullRows, hullDamage: 0, armourRemaining: [...armour] }
}

/** A hit of plain damage, as a weapon resolver would hand it over. */
function hit(
  normalDamage: number,
  penetratingDamage = 0,
  mode: WeaponResult['mode'] = 'standard',
): WeaponResult {
  return { normalDamage, penetratingDamage, mode, dice: [], detail: 'test hit' }
}

const ALL_ARCS = ['F', 'FS', 'AS', 'A', 'AP', 'FP'] as const

// ---------------------------------------------------------------------------
// 4.5 Beam fire — dice at range
// ---------------------------------------------------------------------------

describe('4.5 beam dice at range', () => {
  // "A class 3 beam rolls 3 D6 at less than 12 MU, 2 at 12-24 MU, and 1 only at
  // 24-36 MU. At ranges greater than 36 MU the weapon is out of range. A class 1
  // beam rolls 1 D6 at ranges 0-12 MU, and is out of range beyond 12 MU."
  it('gives a class-3 beam 3 / 2 / 1 / 0 dice across its bands', () => {
    expect(combinedBeamDice([3], 6)).toBe(3)
    expect(combinedBeamDice([3], 18)).toBe(2)
    expect(combinedBeamDice([3], 30)).toBe(1)
    expect(combinedBeamDice([3], 42)).toBe(0)
  })

  it('gives a class-1 beam one die inside 12 MU and nothing beyond', () => {
    expect(combinedBeamDice([1], 1)).toBe(1)
    expect(combinedBeamDice([1], 12)).toBe(1)
    expect(combinedBeamDice([1], 12.5)).toBe(0)
  })

  // 4.3 says a Beam-1 "has a maximum range of 12 MU" and the 4.9 example has a
  // class-3 beam "at 12mu" rolling three dice, so a band is closed at the top.
  it('treats exactly 12 MU as the first band', () => {
    expect(combinedBeamDice([3], 12)).toBe(3)
    expect(combinedBeamDice([3], 24)).toBe(2)
    expect(combinedBeamDice([3], 36)).toBe(1)
  })

  // The 4.12 sidebar: two Beam-1s, four Beam-2s and one Beam-3 at 9 MU —
  // "just roll 2 + 8 + 3 = 11 dice at once". The three addends are right (2
  // Beam-1 dice, 4x2 Beam-2 dice, 3 Beam-3 dice) and the printed total is an
  // arithmetic slip in the book: 2 + 8 + 3 is 13. The engine follows the
  // weapons, not the typo.
  it('sums a mixed battery into one volley', () => {
    expect(combinedBeamDice([1, 1], 9)).toBe(2)
    expect(combinedBeamDice([2, 2, 2, 2], 9)).toBe(8)
    expect(combinedBeamDice([3], 9)).toBe(3)
    expect(combinedBeamDice([1, 1, 2, 2, 2, 2, 3], 9)).toBe(13)
  })
})

// ---------------------------------------------------------------------------
// 4.7 Screens
// ---------------------------------------------------------------------------

describe('4.7 screens', () => {
  it('reads the damage table off each screen level', () => {
    // Unscreened: 1-3 nothing, 4-5 one point, 6 two points.
    expect([1, 2, 3, 4, 5, 6].map((f) => beamDamage(f, 0))).toEqual([0, 0, 0, 1, 1, 2])
    // Level 1: "ignore any rolls of 4 that would have damaged an unscreened ship".
    expect([1, 2, 3, 4, 5, 6].map((f) => beamDamage(f, 1))).toEqual([0, 0, 0, 0, 1, 2])
    // Level 2: "rolls of 5 and 6 each inflict only one point of damage".
    expect([1, 2, 3, 4, 5, 6].map((f) => beamDamage(f, 2))).toEqual([0, 0, 0, 0, 1, 1])
  })
})

// ---------------------------------------------------------------------------
// 4.6 Re-rolls
// ---------------------------------------------------------------------------

describe('4.6 re-rolls', () => {
  // "The Beam-3 has firepower of 2 dice at a range of 12-24 and the Beam-2 has 1
  // die at the same range; thus the firepower total against the target is 3
  // dice. Rolling the 3D6, the firing player scores 1, 5, and 6. This inflicts a
  // total of three points of damage on the target - the 1 is a miss, the 5 does
  // 1 point of damage and the 6 does 2 points and a re-roll. The re-roll is 4,
  // inflicting 1 more point."
  it('worked example: a Beam-3 and a Beam-2 at 18 MU, unscreened', () => {
    expect(combinedBeamDice([3, 2], 18)).toBe(3)

    const result = scoreBeamDice({ initial: [1, 5, 6], rerolls: [4] }, 0)
    expect(result.normalDamage).toBe(3)
    expect(result.penetratingDamage).toBe(1)

    // "a total of three points of damage" from the initial dice, four all told.
    const applied = applyDamage(targetWith(20, 4), result)
    expect(applied.hullDamage).toBe(4)
  })

  // "Re-rolls are made for a natural (unmodified) 6 only. For example if the die
  // roll is modified by +1 then a roll of 5 inflicts 2 damage points as if it
  // were a 6, but does not reroll."
  it('a +1 DRM makes a 5 score like a 6 without earning the re-roll', () => {
    const result = scoreBeamDice({ initial: [5] }, 0, { drm: 1 })
    expect(result.normalDamage).toBe(2)
    expect(result.penetratingDamage).toBe(0)
  })

  it('keeps re-rolling while the sixes keep coming', () => {
    const result = scoreBeamDice({ initial: [6], rerolls: [6, 6, 2] }, 0)
    // 2 on the initial die; the re-rolls add 2 + 2 + 0.
    expect(result.normalDamage).toBe(2)
    expect(result.penetratingDamage).toBe(4)
  })

  it('refuses a journal whose re-rolls do not match its sixes', () => {
    expect(() => scoreBeamDice({ initial: [6] }, 0)).toThrow(RangeError)
    expect(() => scoreBeamDice({ initial: [5], rerolls: [3] }, 0)).toThrow(RangeError)
  })

  it('scores a plain BD weapon with no re-roll at all', () => {
    const result = scoreBeamDice({ initial: [6, 6] }, 0, { penetrating: false })
    expect(result.normalDamage).toBe(4)
    expect(result.penetratingDamage).toBe(0)
    expect(result.mode).toBe('standard')
  })

  it('rolls a volley off a seeded Rng and splits the two piles', () => {
    const result = rollBeamAttack(3, 1, new Rng(20170401))
    expect(result.dice.length).toBeGreaterThanOrEqual(3)
    expect(result.normalDamage + result.penetratingDamage).toBeGreaterThanOrEqual(0)
    // Same seed, same battle — the journal has to replay exactly.
    expect(rollBeamAttack(3, 1, new Rng(20170401))).toEqual(result)
  })
})

// ---------------------------------------------------------------------------
// 4.7 worked example
// ---------------------------------------------------------------------------

describe('4.7 six dice against level-2 screens', () => {
  // "A ship fires six dice of beams at an enemy vessel with level-2 screens. The
  // player rolls 2, 3, 3, 4, 6, and 6. Against level-2 screens the 4 is a miss
  // and each 6 does 1 damage point, for a total of 2. The re-rolls are 4 and 6,
  // and the further re-roll is 3: because this is penetrating damage which
  // ignores screens, the 4 inflicts 1 damage point and the 6 another 2 for a
  // total of 5."
  it('worked example: total 5 damage, 2 of it stoppable', () => {
    const result = scoreBeamDice({ initial: [2, 3, 3, 4, 6, 6], rerolls: [4, 6, 3] }, 2)
    expect(result.normalDamage).toBe(2)
    expect(result.penetratingDamage).toBe(3)
    expect(result.normalDamage + result.penetratingDamage).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 4.8 Armour
// ---------------------------------------------------------------------------

describe('4.8 armour', () => {
  // "All of this damage is taken on armor. Any excess damage is applied directly
  // to the hull."
  it('fills the armour before a hull box is touched', () => {
    const applied = applyDamage(targetWith(20, 4, [5]), hit(3))
    expect(applied.armourAbsorbed).toEqual([3])
    expect(applied.hullDamage).toBe(0)
    expect(applied.target.armourRemaining).toEqual([2])
  })

  it('spills the excess onto the hull', () => {
    const applied = applyDamage(targetWith(20, 4, [5]), hit(8))
    expect(applied.armourAbsorbed).toEqual([5])
    expect(applied.hullDamage).toBe(3)
  })

  // "There is no threshold check roll made at the end of the row of armor."
  it('never calls a threshold check for a stripped armour row', () => {
    const applied = applyDamage(targetWith(20, 4, [5]), hit(5))
    expect(applied.hullDamage).toBe(0)
    expect(applied.threshold).toBeNull()
  })

  it('leaves the target state it was handed untouched', () => {
    const target = targetWith(20, 4, [5])
    applyDamage(target, hit(8))
    expect(target.hullDamage).toBe(0)
    expect(target.armourRemaining).toEqual([5])
  })

  it('builds a damage track from an SSD', () => {
    const armour: ArmourDef = { layers: [2, 4], regenerative: false }
    const design = { hullBoxes: 26, hullRows: 4, armour } as ShipDesign
    expect(createTargetState(design)).toEqual({
      hullBoxes: 26,
      hullRows: 4,
      hullDamage: 0,
      armourRemaining: [2, 4],
    })
  })
})

// ---------------------------------------------------------------------------
// 4.9 Ship damage: penetrating, AP and SAP
// ---------------------------------------------------------------------------

describe('4.9 penetrating damage (P)', () => {
  // "A typical cruiser with one Standard Screen is hit by a Class 3 Beam at
  // 12mu. The attacking player rolls a 4, a 5 and a 6. The 4 [...] is
  // discounted. The 5 cause's one point of damage and the 6 causes two points
  // all scored against the first layer of armor. The 6 grants a re-roll and the
  // result is another 6 [...] another 2 points of damage that penetrate to the
  // next row of armor. The 6 grants another re-roll resulting in another 6 [...]
  // another two points of damage which penetrates directly to the hull. The
  // attacking player then re-rolls the 6 and the result is a 4. The 4 does one
  // point of damage."
  //
  // The SSD illustration is not in the text layer of the PDF, so the layers are
  // sized to reproduce the narrated result: an inner layer of exactly 2 boxes is
  // what makes the third pile of damage reach the hull.
  it('worked example: a Class-3 beam at 12 MU against a screened, shell-armoured cruiser', () => {
    expect(combinedBeamDice([3], 12)).toBe(3)

    const result = scoreBeamDice({ initial: [4, 5, 6], rerolls: [6, 6, 4] }, 1)
    expect(result.normalDamage).toBe(3) // 0 + 1 + 2, the 4 stopped by the screen
    expect(result.penetratingDamage).toBe(5) // 2 + 2 + 1, all inside the screen

    // armourRemaining is inner-first: layer 2 (outer) is the "first layer of
    // armor" the initial dice hit.
    const applied = applyDamage(targetWith(26, 4, [2, 4]), result)
    expect(applied.armourAbsorbed).toEqual([2, 3])
    expect(applied.hullDamage).toBe(3)
    expect(applied.target.armourRemaining).toEqual([0, 1])
  })

  // "any damage caused by the re-roll die(s) is applied directly to the ship's
  // ordinary hull [...] irrespective of whether it still has armor remaining."
  it('sends re-roll damage past a single layer of armour and onto the hull', () => {
    const applied = applyDamage(targetWith(20, 4, [10]), hit(2, 4, 'P'))
    expect(applied.armourAbsorbed).toEqual([2])
    expect(applied.hullDamage).toBe(4)
  })

  it('skips the layer the initial dice were hitting even when they strip it', () => {
    // The outer layer has 2 boxes and the initial pile takes both. The re-roll
    // pile still starts on the layer behind it, not on the layer it just
    // emptied — "irrespective of whether it still has armor remaining".
    const applied = applyDamage(targetWith(20, 4, [3, 2]), hit(2, 2, 'P'))
    expect(applied.armourAbsorbed).toEqual([2, 2])
    expect(applied.hullDamage).toBe(0)
  })

  it('puts everything on the hull when the ship has no armour', () => {
    const applied = applyDamage(targetWith(20, 4), hit(3, 2, 'P'))
    expect(applied.armourAbsorbed).toEqual([])
    expect(applied.hullDamage).toBe(5)
  })
})

describe('4.9 armour piercing (AP)', () => {
  // "a large kinetic gun hits a ship with two rows of layered armor. The hit
  // scores 10 damage points. 1 is applied to each layer of armor with the
  // remaining 8 to the hull."
  it('worked example: 10 points against two layers is 1, 1 and 8', () => {
    const applied = applyDamage(targetWith(20, 4, [4, 4]), hit(10, 0, 'AP'))
    expect(applied.armourAbsorbed).toEqual([1, 1])
    expect(applied.hullDamage).toBe(8)
  })

  it('stops on the outermost layer when the hit is a single point', () => {
    const applied = applyDamage(targetWith(20, 4, [4, 4]), hit(1, 0, 'AP'))
    expect(applied.armourAbsorbed).toEqual([0, 1])
    expect(applied.hullDamage).toBe(0)
  })

  it('ignores a layer that has already been crossed off', () => {
    const target: DamageableTarget = {
      hullBoxes: 20,
      hullRows: 4,
      hullDamage: 0,
      armourRemaining: [4, 0],
    }
    const applied = applyDamage(target, hit(5, 0, 'AP'))
    expect(applied.armourAbsorbed).toEqual([1, 0])
    expect(applied.hullDamage).toBe(4)
  })
})

describe('4.9 semi-armour piercing (SAP)', () => {
  // "a missile strikes a ship for 7 points of damage. 4 points is applied to the
  // armor, remaining 3 points are applied to the next row of armor."
  it('worked example: 7 points against two layers is 4 then 3', () => {
    const applied = applyDamage(targetWith(20, 4, [4, 4]), hit(7, 0, 'SAP'))
    expect(applied.armourAbsorbed).toEqual([3, 4])
    expect(applied.hullDamage).toBe(0)
  })

  it('puts the remainder on the hull when there is no next layer', () => {
    const applied = applyDamage(targetWith(20, 4, [10]), hit(7, 0, 'SAP'))
    expect(applied.armourAbsorbed).toEqual([4])
    expect(applied.hullDamage).toBe(3)
  })

  it('rounds the armour half up', () => {
    const applied = applyDamage(targetWith(20, 4, [10]), hit(5, 0, 'SAP'))
    expect(applied.armourAbsorbed).toEqual([3])
    expect(applied.hullDamage).toBe(2)
  })

  it('lets the half spill inward when the outer layer is nearly gone', () => {
    // Half of 8 is 4, but the outer layer has only 1 box left: it takes that
    // one and the other 7 carry on inward exactly as the remainder would.
    const applied = applyDamage(targetWith(20, 4, [4, 1]), hit(8, 0, 'SAP'))
    expect(applied.armourAbsorbed).toEqual([4, 1])
    expect(applied.hullDamage).toBe(3)
  })
})

describe('7.7 shell armour, optional half-per-layer reading', () => {
  // Off by default: 4.9's worked example has all three points of a Class-3
  // beam "scored against the first layer of armor" of a two-layer cruiser.
  it('fills the outer layer first by default', () => {
    const applied = applyDamage(targetWith(20, 4, [4, 4]), hit(4))
    expect(applied.armourAbsorbed).toEqual([0, 4])
  })

  it('splits half to each layer when the toggle is on', () => {
    const applied = applyDamage(targetWith(20, 4, [4, 4]), hit(4), {
      layeredHalfAbsorption: true,
    })
    expect(applied.armourAbsorbed).toEqual([1, 2])
    expect(applied.hullDamage).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 4.10 Rear-arc attacks (optional)
// ---------------------------------------------------------------------------

describe('4.10 optional rear-arc rule', () => {
  const armoured = () => targetWith(20, 4, [4, 4])

  it('is off unless the game turns it on', () => {
    const applied = applyDamage(armoured(), hit(10), { rearArc: true })
    expect(applied.rearArcBypass).toBe(false)
    expect(applied.armourAbsorbed).toEqual([4, 4])
    expect(applied.hullDamage).toBe(2)
  })

  // "Any ship firing from within the rear arc of the target ship automatically
  // ignores the targets armor."
  it('ignores armour entirely when it is on and the shot is from astern', () => {
    const applied = applyDamage(armoured(), hit(6, 2, 'P'), {
      rearArcRule: true,
      rearArc: true,
    })
    expect(applied.rearArcBypass).toBe(true)
    expect(applied.armourAbsorbed).toEqual([0, 0])
    expect(applied.hullDamage).toBe(8)
  })

  // "(Missiles or fighters do not benefit from rear arc attacks.)"
  it('does not help missiles or fighters', () => {
    for (const source of ['ordnance', 'fighter'] as const) {
      const applied = applyDamage(armoured(), hit(10), {
        rearArcRule: true,
        rearArc: true,
        source,
      })
      expect(applied.rearArcBypass).toBe(false)
      expect(applied.armourAbsorbed).toEqual([4, 4])
      expect(applied.hullDamage).toBe(2)
    }
  })

  // "This rule does not apply when firing at starbases [...] or other Really Big
  // Things."
  it('does not apply to starbases and Really Big Things', () => {
    const applied = applyDamage(armoured(), hit(10), {
      rearArcRule: true,
      rearArc: true,
      targetIsBigThing: true,
    })
    expect(applied.rearArcBypass).toBe(false)
    expect(applied.armourAbsorbed).toEqual([4, 4])
    expect(applied.hullDamage).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 4.9 / 4.11 Hull rows and threshold triggers
// ---------------------------------------------------------------------------

describe('4.11 hull rows', () => {
  it('splits 12 boxes into four rows of three', () => {
    expect(hullRowBounds(12, 4)).toEqual([3, 6, 9, 12])
  })

  it('gives the earlier rows the odd box', () => {
    expect(hullRowBounds(14, 4)).toEqual([4, 8, 11, 14])
    expect(hullRowBounds(26, 4)).toEqual([7, 14, 20, 26])
  })

  it('honours a row layout printed on the SSD', () => {
    // game.ts carries `hullRowSizes` for SSDs that do not divide evenly; a row
    // boundary is a threshold point, so the printed one has to win.
    const target: DamageableTarget = {
      hullBoxes: 10,
      hullRows: 3,
      hullDamage: 0,
      armourRemaining: [],
      hullRowSizes: [5, 3, 2],
    }
    expect(rowBoundsFor(target)).toEqual([5, 8, 10])
    const applied = applyDamage(target, hit(8))
    expect(applied.rowsCrossed).toEqual([1, 2])
    expect(applied.target.hullRowSizes).toEqual([5, 3, 2])
  })

  it('counts only the rows whose last box went', () => {
    expect(rowsCrossedBetween(0, 7, [3, 6, 9, 12])).toEqual([1, 2])
    expect(rowsCrossedBetween(7, 10, [3, 6, 9, 12])).toEqual([3])
    expect(rowsCrossedBetween(0, 2, [3, 6, 9, 12])).toEqual([])
  })

  // "A ship with 12 hull boxes in four rows of three takes 7 damage points from
  // another ship in one attack, crossing off two complete rows. At the end of
  // the second row systems are normally lost on a roll of 5 or 6, but this time
  // they will be lost on 4-6. If the ship is fired on again and takes 3 more
  // points of damage, the third row will be crossed off, but since only one row
  // was lost the threshold check rolls will be as normal, 4+."
  it('worked example: 7 damage then 3 damage on a 12/4 hull', () => {
    const first = applyDamage(targetWith(12, 4), hit(7))
    expect(first.rowsCrossed).toEqual([1, 2])
    expect(first.threshold).toEqual({ row: 2, extraRows: 1 })
    // Normally 5+ at the second row; +1 per extra row makes it 4+.
    expect(thresholdTarget(2)).toBe(5)
    expect(thresholdTarget(first.threshold?.row ?? 0) - (first.threshold?.extraRows ?? 0)).toBe(4)

    const second = applyDamage(first.target, hit(3))
    expect(second.target.hullDamage).toBe(10)
    expect(second.rowsCrossed).toEqual([3])
    expect(second.threshold).toEqual({ row: 3, extraRows: 0 })
    expect(thresholdTarget(3)).toBe(4)
  })

  // "No threshold checks need to be made at the end of the last hull row, since
  // the ship is considered to be destroyed."
  it('destroys the ship on its last hull box and asks for no check', () => {
    const applied = applyDamage(targetWith(12, 4), hit(12))
    expect(applied.destroyed).toBe(true)
    expect(applied.threshold).toBeNull()
    expect(applied.overkill).toBe(0)
  })

  it('reports damage past the last box as overkill', () => {
    const applied = applyDamage(targetWith(12, 4), hit(20))
    expect(applied.hullDamage).toBe(12)
    expect(applied.overkill).toBe(8)
    expect(applied.destroyed).toBe(true)
  })

  it('asks for nothing when no row was completed', () => {
    expect(thresholdTrigger([], false)).toBeNull()
    expect(thresholdTrigger([1, 2], true)).toBeNull()
    expect(thresholdTrigger([2, 3], false)).toEqual({ row: 3, extraRows: 1 })
  })
})

// ---------------------------------------------------------------------------
// 4.8 / 4.11 A whole phase of fire as one attack
// ---------------------------------------------------------------------------

describe('4.8 a phase of fire is one attack', () => {
  it('adds the damage up and makes a single threshold trigger', () => {
    // Two mounts, 4 and 5 points, into a 12/4 hull behind 3 boxes of armour:
    // 3 stopped, 6 on the hull, two rows gone in the one phase.
    const volley = applyVolley(targetWith(12, 4, [3]), [hit(4), hit(5)])
    expect(volley.armourAbsorbed).toEqual([3])
    expect(volley.hullDamage).toBe(6)
    expect(volley.rowsCrossed).toEqual([1, 2])
    expect(volley.threshold).toEqual({ row: 2, extraRows: 1 })
    expect(volley.hits).toHaveLength(2)
  })

  it('keeps each hit’s own armour behaviour rather than summing first', () => {
    // Two SAP hits of 4 each halve separately — 2 + 2 on the armour — where one
    // hit of 8 would have put 4 on it.
    const volley = applyVolley(targetWith(20, 4, [10]), [
      hit(4, 0, 'SAP'),
      hit(4, 0, 'SAP'),
    ])
    expect(volley.armourAbsorbed).toEqual([4])
    expect(volley.hullDamage).toBe(4)
  })

  it('reports destruction mid-volley and bills the rest as overkill', () => {
    const volley = applyVolley(targetWith(6, 3), [hit(4), hit(6)])
    expect(volley.destroyed).toBe(true)
    expect(volley.hullDamage).toBe(6)
    expect(volley.overkill).toBe(4)
    expect(volley.threshold).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4.4 Fire control
// ---------------------------------------------------------------------------

describe('4.4 fire control', () => {
  const weapons: FireControlWeapon[] = [
    { id: 'b3-fwd', arcs: ['F', 'FP', 'FS'] },
    { id: 'b2-stbd', arcs: ['FS', 'AS'] },
    { id: 'b1-port', arcs: ['FP', 'AP'] },
    { id: 'pds-1', arcs: [...ALL_ARCS] },
  ]
  const targets: TargetBearing[] = [
    { id: 'alpha', kind: 'ship', arc: 'F' },
    { id: 'beta', kind: 'ship', arc: 'FS' },
    { id: 'gamma', kind: 'ship', arc: 'FP' },
    { id: 'wolves', kind: 'fighter-group', arc: 'FS' },
    { id: 'chaser', kind: 'ship', arc: 'A' },
  ]

  // "Each FireCon system permits the ship to engage one target during the firing
  // portion of a turn."
  it('engages one target per FireCon and refuses the rest', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons,
      targets,
      orders: [
        { weaponId: 'b3-fwd', targetId: 'alpha' },
        { weaponId: 'b2-stbd', targetId: 'beta' },
        { weaponId: 'b1-port', targetId: 'gamma' },
      ],
    })
    expect(plan.engagedTargets).toEqual(['alpha', 'beta'])
    expect(plan.fireConsUsed).toBe(2)
    expect(plan.accepted).toHaveLength(2)
    expect(plan.refused).toEqual([
      { order: { weaponId: 'b1-port', targetId: 'gamma' }, reason: 'no-firecon' },
    ])
  })

  // "fire from the ship's various weapons may be divided in any way between the
  // targets (depending on the arcs through which each weapon may bear)"
  it('lets any number of mounts share an engaged target', () => {
    const plan = planFireControl({
      fireCons: 1,
      weapons,
      targets,
      orders: [
        { weaponId: 'b3-fwd', targetId: 'beta' },
        { weaponId: 'b2-stbd', targetId: 'beta' },
      ],
    })
    expect(plan.accepted).toHaveLength(2)
    expect(plan.fireConsUsed).toBe(1)
  })

  it('refuses a mount that cannot bear on the target', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons,
      targets,
      orders: [{ weaponId: 'b1-port', targetId: 'beta' }],
    })
    expect(plan.refused[0].reason).toBe('out-of-arc')
    expect(plan.fireConsUsed).toBe(0)
  })

  // 4.5: "No single weapon may split its die rolls between targets in any
  // circumstances [...] Two separate Beam-3 weapons may each engage a separate
  // target, provided that two FireCon systems are available."
  it('will not split one mount between two targets', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons,
      targets,
      orders: [
        { weaponId: 'b3-fwd', targetId: 'alpha' },
        { weaponId: 'b3-fwd', targetId: 'gamma' },
      ],
    })
    expect(plan.accepted).toHaveLength(1)
    expect(plan.refused[0].reason).toBe('weapon-already-firing')
  })

  // "Each fighter group targeted requires a FireCon as if it were a ship."
  it('charges a FireCon for a fighter group', () => {
    const plan = planFireControl({
      fireCons: 1,
      weapons,
      targets,
      orders: [
        { weaponId: 'b2-stbd', targetId: 'wolves' },
        { weaponId: 'b3-fwd', targetId: 'alpha' },
      ],
    })
    expect(plan.engagedTargets).toEqual(['wolves'])
    expect(plan.refused[0].reason).toBe('no-firecon')
  })

  // "Point defense fire against fighters or missiles does not require the use of
  // the ship's main FireCon systems."
  it('lets point defence fire for free', () => {
    const plan = planFireControl({
      fireCons: 1,
      weapons,
      targets,
      orders: [
        { weaponId: 'pds-1', targetId: 'wolves', pointDefence: true },
        { weaponId: 'b3-fwd', targetId: 'alpha' },
      ],
    })
    expect(plan.accepted).toHaveLength(2)
    expect(plan.engagedTargets).toEqual(['alpha'])
    expect(plan.fireConsUsed).toBe(1)
  })

  // A weapon fires once a turn (2.6), so a beam spent on point defence is a beam
  // not available against ships.
  it('spends a mount for the turn even when it fires as point defence', () => {
    const plan = planFireControl({
      fireCons: 1,
      weapons,
      targets,
      orders: [
        { weaponId: 'b3-fwd', targetId: 'wolves', pointDefence: true },
        { weaponId: 'b3-fwd', targetId: 'alpha' },
      ],
    })
    expect(plan.refused[0].reason).toBe('weapon-already-firing')
  })

  // 4.2: "No ship may fire offensive weaponry through its aft arc."
  it('refuses offensive fire through the aft arc', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons: [{ id: 'b2-aft', arcs: ['AS', 'A', 'AP'] }],
      targets,
      orders: [{ weaponId: 'b2-aft', targetId: 'chaser' }],
    })
    expect(plan.refused[0].reason).toBe('aft-arc')
  })

  // "Optional rule: Aft arc fire is permitted on any game turn in which the
  // firing ship did not use any thrust from its main drive."
  it('allows aft fire on a turn the ship spent no thrust', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons: [{ id: 'b2-aft', arcs: ['AS', 'A', 'AP'] }],
      targets,
      orders: [{ weaponId: 'b2-aft', targetId: 'chaser' }],
      aftArcFire: true,
    })
    expect(plan.accepted).toHaveLength(1)
    expect(plan.engagedTargets).toEqual(['chaser'])
  })

  it('still lets point defence engage something dead astern', () => {
    const plan = planFireControl({
      fireCons: 0,
      weapons,
      targets,
      orders: [{ weaponId: 'pds-1', targetId: 'chaser', pointDefence: true }],
    })
    expect(plan.accepted).toHaveLength(1)
    expect(plan.fireConsUsed).toBe(0)
  })

  it('names orders it cannot make sense of', () => {
    const plan = planFireControl({
      fireCons: 2,
      weapons,
      targets,
      orders: [
        { weaponId: 'ghost', targetId: 'alpha' },
        { weaponId: 'b3-fwd', targetId: 'nobody' },
      ],
    })
    expect(plan.refused.map((r) => r.reason)).toEqual(['unknown-weapon', 'unknown-target'])
  })

  it('counts the FireCons a set of orders would need', () => {
    expect(
      fireConsRequired([
        { weaponId: 'a', targetId: 'alpha' },
        { weaponId: 'b', targetId: 'alpha' },
        { weaponId: 'c', targetId: 'beta' },
        { weaponId: 'd', targetId: 'wolves', pointDefence: true },
      ]),
    ).toBe(2)
  })
})
