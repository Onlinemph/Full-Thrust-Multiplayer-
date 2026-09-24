/**
 * Fire combat against dispersed targets (pp. 33–37) — checked against
 * the book's own worked examples and numbers.
 */

import { describe, expect, it } from 'vitest'
import { newStream, rollDie, type DieType } from './dice'
import {
  allocateHit,
  allocationDie,
  coverShiftedArmourDie,
  type DispersedFireTarget,
  fireAgainstDispersedTarget,
  fireSquadSmallArms,
  fireSupportWeaponAlone,
  firepowerDieFor,
  potentialHits,
  rangeBandsElapsed,
  rangeDie,
  resolvePenetration,
  rollFireEffect,
  totalFirepower,
} from './fire'
import type { SmallArmProfile, SupportWeaponProfile } from './types'

function seedForRoll(die: DieType, want: number): number {
  for (let seed = 0; seed < 200_000; seed++) {
    if (rollDie(die, newStream(seed)) === want) return seed
  }
  throw new Error(`no seed rolls ${want} on a D${die}`)
}

/** Brute-forces a seed whose first N rolls, drawn in order, match `wants` exactly. Keep sequences short and dice small -- the search space is the product of every die size. */
function seedForSequence(dice: readonly DieType[], wants: readonly number[]): number {
  outer: for (let seed = 0; seed < 20_000_000; seed++) {
    const s = newStream(seed)
    for (let i = 0; i < dice.length; i++) if (rollDie(dice[i]!, s) !== wants[i]) continue outer
    return seed
  }
  throw new Error(`no seed rolls ${wants.join(',')} on D${dice.join('/D')}`)
}

const gaussRifle: SmallArmProfile = { kind: 'gauss-rifle', name: 'Gauss Rifle', firepower: 2, impact: 12, closeOnly: false }
const advancedRifle: SmallArmProfile = { kind: 'advanced-rifle', name: 'Advanced Assault Rifle', firepower: 2, impact: 10, closeOnly: false }
const smg: SmallArmProfile = { kind: 'smg', name: 'SMG', firepower: 3, impact: 8, closeOnly: true }
const gaussSaw: SupportWeaponProfile = { kind: 'gauss-saw', name: 'Gauss SAW', firepowerDie: 10, impact: 12, doubleVsPoint: true }

describe('range bands and the range die (p.33-35)', () => {
  it('one band up to the quality band, two up to double, and so on', () => {
    expect(rangeBandsElapsed(8, 8)).toBe(1)
    expect(rangeBandsElapsed(9, 8)).toBe(2)
    expect(rangeBandsElapsed(16, 8)).toBe(2)
    expect(rangeBandsElapsed(17, 8)).toBe(3)
  })

  it("book's worked example (p.34): a Regular unit (8\" band) reaches 40\" in the open, 32\" in soft cover, 24\" in hard cover", () => {
    expect(rangeDie(40, 8, 'open', false)).toEqual({ die: 12, steps: 4 })
    expect(rangeDie(41, 8, 'open', false)).toEqual({ impossible: true, reason: 'over-d12' })
    expect(rangeDie(32, 8, 'soft', false)).toEqual({ die: 12, steps: 4 })
    expect(rangeDie(33, 8, 'soft', false)).toEqual({ impossible: true, reason: 'over-d12' })
    expect(rangeDie(24, 8, 'hard', false)).toEqual({ die: 12, steps: 4 })
    expect(rangeDie(25, 8, 'hard', false)).toEqual({ impossible: true, reason: 'over-d12' })
  })

  it('derived: soft cover and in position together eat the same one-band-shorter budget as soft cover alone', () => {
    expect(rangeDie(24, 8, 'soft', true)).toEqual({ die: 12, steps: 4 })
    expect(rangeDie(25, 8, 'soft', true)).toEqual({ impossible: true, reason: 'over-d12' })
  })

  it('a close-range weapon is impossible beyond one band, however the die math would come out', () => {
    expect(rangeDie(8, 8, 'open', false, true)).toEqual({ die: 4, steps: 0 })
    expect(rangeDie(9, 8, 'open', false, true)).toEqual({ impossible: true, reason: 'close-range' })
  })

  it('cover shifts the armour die the same way it shifts the range die (p.12-13)', () => {
    expect(coverShiftedArmourDie(6, 'open')).toBe(6)
    expect(coverShiftedArmourDie(6, 'soft')).toBe(8)
    expect(coverShiftedArmourDie(6, 'hard')).toBe(10)
  })
})

describe('firepower (p.34)', () => {
  it("book's examples: 7 men at FP1 -> D8, 5 men at FP2 -> D10, <=4 -> D4, >12 -> D12", () => {
    expect(firepowerDieFor(totalFirepower(Array(7).fill({ firepower: 1 })))).toBe(8)
    expect(firepowerDieFor(totalFirepower(Array(5).fill({ firepower: 2 })))).toBe(10)
    expect(firepowerDieFor(4)).toBe(4)
    expect(firepowerDieFor(13)).toBe(12)
    expect(firepowerDieFor(100)).toBe(12)
  })

  it('derived: zero firing figures still yields a fire value of 0, which the table reads as a D4', () => {
    expect(firepowerDieFor(totalFirepower([]))).toBe(4)
  })
})

describe('step 1 — the multiple opposed roll (p.33, p.35)', () => {
  it('none of the firer dice exceeding is no effect', () => {
    const r = rollFireEffect([8, 8], 12, newStream(seedForSequence([12, 8, 8], [12, 1, 2])))
    expect(r.effect).toBe('no-effect')
    expect(r.exceeding).toBe(0)
  })

  it('exactly one exceeding is suppression only', () => {
    const r = rollFireEffect([8, 8], 8, newStream(seedForSequence([8, 8, 8], [4, 8, 2])))
    expect(r.effect).toBe('suppression')
    expect(r.exceeding).toBe(1)
  })

  it("book's example (p.35-36): two or more exceeding is fully effective, and the running total is what step 2 uses", () => {
    // Firer's three dice (Quality/FP/SAW) sum to 18 with two exceeding the target's D8 roll of 2, matching the book's own total and target die exactly.
    const seed = seedForSequence([8, 8, 8, 8], [2, 8, 8, 2])
    const r = rollFireEffect([8, 8, 8], 8, newStream(seed))
    expect(r.effect).toBe('effective')
    expect(r.exceeding).toBe(2)
    expect(r.total).toBe(18)
  })
})

describe('step 2 — potential hits (p.35)', () => {
  it("book's example: total 18 against a D8 range die -> 2 automatic hits, remainder 2, and the target must roll over 2 to deny a third", () => {
    const denied = potentialHits(18, 8, newStream(seedForRoll(8, 3)))
    expect(denied).toEqual({ autoHits: 2, remainder: 2, extraRoll: 3, extraHit: false, total: 2 })
    const granted = potentialHits(18, 8, newStream(seedForRoll(8, 2)))
    expect(granted).toEqual({ autoHits: 2, remainder: 2, extraRoll: 2, extraHit: true, total: 3 })
  })

  it('an exact multiple needs no extra roll at all', () => {
    expect(potentialHits(16, 8, newStream(1))).toEqual({ autoHits: 2, remainder: 0, extraRoll: null, extraHit: false, total: 2 })
  })

  it('derived: less than one die type of total is the same formula, not a special case — the whole total is the remainder', () => {
    const denied = potentialHits(3, 8, newStream(seedForRoll(8, 4)))
    expect(denied).toEqual({ autoHits: 0, remainder: 3, extraRoll: 4, extraHit: false, total: 0 })
    const granted = potentialHits(3, 8, newStream(seedForRoll(8, 3)))
    expect(granted.total).toBe(1)
  })
})

describe('step 3 — penetration and effect (p.36)', () => {
  it("book's worked example: Impact D10 vs Armour D6 (Partial Light) — 3 vs 5 none, 6 vs 5 wound, 9 vs 4 kill", () => {
    expect(resolvePenetration(10, 6, newStream(seedForSequence([10, 6], [3, 5])))).toMatchObject({ impactRoll: 3, armourRoll: 5, outcome: 'none' })
    expect(resolvePenetration(10, 6, newStream(seedForSequence([10, 6], [6, 5])))).toMatchObject({ impactRoll: 6, armourRoll: 5, outcome: 'wound' })
    expect(resolvePenetration(10, 6, newStream(seedForSequence([10, 6], [9, 4])))).toMatchObject({ impactRoll: 9, armourRoll: 4, outcome: 'kill' })
  })

  it('exactly double armour is still only a wound (the kill boundary is strict)', () => {
    const r = resolvePenetration(12, 6, newStream(seedForSequence([12, 6], [12, 6])))
    expect(r.outcome).toBe('wound')
  })
})

describe('step 4 — allocating hits (p.36)', () => {
  it("book's photo-caption example: an 8-figure squad rolls a D8, a 5 hits the fifth figure along", () => {
    expect(allocationDie(8)).toBe(8)
    expect(allocateHit(8, 5)).toBe(4) // 0-based: the fifth figure
  })

  it('a roll past the actual figure count wraps back to the start', () => {
    expect(allocateHit(5, 6)).toBe(0)
  })
})

describe('the full dispersed-fire resolution (p.35-36)', () => {
  const figures = (n: number, armourDie: DieType) => Array.from({ length: n }, () => ({ armourDie }))

  it('an impossible range die draws no dice at all and has no effect', () => {
    const r = fireAgainstDispersedTarget([8, 8], 10, { impossible: true, reason: 'over-d12' }, 'open', figures(6, 6), newStream(1))
    expect(r.fireEffect).toBeUndefined()
    expect(r.suppressed).toBe(false)
    expect(r.hits).toEqual([])
  })

  it('replays identically for the same seed (the DiceStream contract)', () => {
    const target: DispersedFireTarget = { cover: 'soft', inPosition: false, figures: figures(8, 6) }
    const a = fireSquadSmallArms('regular', [gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle], 16, 8, target, [10], newStream(999))
    const b = fireSquadSmallArms('regular', [gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle, gaussRifle], 16, 8, target, [10], newStream(999))
    expect(a).toEqual(b)
  })

  it('end to end: an effective shot that must deny its own left-over-points extra hit still allocates and penetrates the one hit it does score', () => {
    // A single target figure, so allocation (D4, 1 figure) always lands on index 0 whatever it rolls.
    // Draw order: [range-die target roll, firer's 2 dice], then (effective, remainder != 0) [the extra-hit roll], then [allocation, impact, armour].
    const seed = seedForSequence(
      [8, 8, 6, 8, 4, 12, 8],
      [
        1, 8, 6, // target rolls 1 on the D8 range die; firer's D8 and D6 (8, 6) both exceed it -- effective, total 14.
        7, // 14 = 1*8 + 6: the target's extra D8 roll of 7 beats the remainder of 6, denying a second hit -- exactly 1 potential hit.
        1, 9, 4, // the one hit: allocation (only figure) -> index 0; impact 9 vs armour 4 (soft-cover-shifted from D6) -- a kill (9 > 2*4).
      ],
    )
    const r = fireAgainstDispersedTarget([8, 6], 12, { die: 8, steps: 2 }, 'soft', [{ armourDie: 6 }], newStream(seed))
    expect(r.fireEffect).toMatchObject({ exceeding: 2, effect: 'effective', total: 14 })
    expect(r.potentialHits).toEqual({ autoHits: 1, remainder: 6, extraRoll: 7, extraHit: false, total: 1 })
    expect(r.hits).toEqual([{ figureIndex: 0, allocationRoll: 1, penetration: { impactRoll: 9, armourRoll: 4, armourDie: 8, outcome: 'kill' } }])
    expect(r.figureResults).toEqual({ 0: 'dead' })
  })

  it('two wounds on the same figure in one resolution upgrades it to dead (p.36)', () => {
    // A single target figure, so every hit's allocation die necessarily lands on it (the roll doesn't matter). All D4s keep the sequence brute-forceable.
    const seed = seedForSequence(
      [4, 4, 4, 4, 4, 4, 4, 4, 4],
      [
        1, 4, 4, // target rolls 1 on a D4 range die; firer's two D4s (4, 4) both exceed it -- effective, total 8.
        1, 3, 2, // hit 1: allocation (any roll, only 1 figure) -> figure 0; impact 3 vs armour 2 -- a wound (3 > 2, not > 4).
        1, 3, 2, // hit 2: same figure again; impact 3 vs armour 2 -- a second wound.
      ],
    )
    const r = fireAgainstDispersedTarget([4, 4], 4, { die: 4, steps: 0 }, 'open', [{ armourDie: 4 }], newStream(seed))
    expect(r.potentialHits).toEqual({ autoHits: 2, remainder: 0, extraRoll: null, extraHit: false, total: 2 })
    expect(r.hits.map((h) => h.penetration.outcome)).toEqual(['wound', 'wound'])
    expect(r.figureResults).toEqual({ 0: 'dead' })
  })
})

describe('squad small arms and a support weapon firing alone (p.34-35, p.37)', () => {
  const target = (armourDie: DieType): DispersedFireTarget => ({ cover: 'open', inPosition: false, figures: [{ armourDie }] })

  it('folds support firepower dice into the same roll, but always resolves hits with the small-arms impact die', () => {
    const r = fireSquadSmallArms('regular', [advancedRifle, advancedRifle], 8, 8, target(6), [6], newStream(1))
    // Firer dice are [quality D8, firepower D4 (fv 4), support D6] -- three dice regardless of outcome.
    expect(r.fireEffect?.firerDice).toEqual([8, 4, 6])
  })

  it('a close-only small arm (SMG) is impossible beyond one band', () => {
    const r = fireSquadSmallArms('regular', [smg], 9, 8, target(6), [], newStream(1))
    expect(r.rangeDie).toEqual({ impossible: true, reason: 'close-range' })
  })

  it('a support weapon alone uses just quality + its own firepower die, and its own impact', () => {
    const r = fireSupportWeaponAlone('regular', gaussSaw, 8, 8, target(6), newStream(1))
    expect(r.fireEffect?.firerDice).toEqual([8, 10])
  })

  it('derived: zero figures able to fire still resolves (fire value 0 -> D4), rather than throwing', () => {
    const r = fireSquadSmallArms('regular', [], 8, 8, target(6), [], newStream(1))
    expect(r.fireEffect?.firerDice).toEqual([8, 4])
  })
})
