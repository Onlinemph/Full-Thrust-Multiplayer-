/**
 * Morale and command (pp. 8–10, 16–21): confidence and reaction tests,
 * panic, communications, transfers, rally, suppression removal, going in
 * position, and the loss of a unit leader — checked against the book's
 * own worked examples.
 */

import { describe, expect, it } from 'vitest'
import {
  attemptGoInPosition,
  attemptRally,
  attemptRemovePanic,
  attemptRemoveSuppression,
  attemptTransfer,
  commandLevelsBypassed,
  communicationRoll,
  confidenceTest,
  confidenceThreatLevel,
  lowerConfidence,
  panicTest,
  raiseConfidence,
  rallyRoll,
  reactionTest,
  replacementLeaderRoll,
} from './checks'
import { newStream, rollDie, type DieType } from './dice'

/** Brute-forces a seed whose very first die roll of `die` comes out to `want` — used throughout to reproduce the book's own numbers exactly. */
function seedForRoll(die: DieType, want: number): number {
  for (let seed = 0; seed < 200_000; seed++) {
    if (rollDie(die, newStream(seed)) === want) return seed
  }
  throw new Error(`no seed rolls ${want} on a D${die}`)
}

describe('confidence test (p.20-21)', () => {
  it("book's worked example: Steady, Regular (D8), LV2, threat level +2 -> target 4", () => {
    // 5+ holds Steady, 3-4 drops to Shaken, 1-2 (half of 4 or less) drops to Broken.
    const hold = confidenceTest('regular', 2, 2, newStream(seedForRoll(8, 5)))
    expect(hold).toEqual({ roll: 5, target: 4, drop: 0 })
    const oneLevel = confidenceTest('regular', 2, 2, newStream(seedForRoll(8, 3)))
    expect(oneLevel).toEqual({ roll: 3, target: 4, drop: 1 })
    const twoLevels = confidenceTest('regular', 2, 2, newStream(seedForRoll(8, 2)))
    expect(twoLevels).toEqual({ roll: 2, target: 4, drop: 2 })
    const alsoTwoLevels = confidenceTest('regular', 2, 2, newStream(seedForRoll(8, 1)))
    expect(alsoTwoLevels.drop).toBe(2)
  })

  it('always rolls even when the target can never be beaten (p.21 IMPORTANT NOTE), and still tells a 1- from a 2-level drop', () => {
    // Green (D6), LV1, cumulative threat level 6 -> target 7, unbeatable on a D6.
    const dropOne = confidenceTest('green', 1, 6, newStream(seedForRoll(6, 4)))
    expect(dropOne.drop).toBe(1) // 4 > 3.5 (half of 7)
    const dropTwo = confidenceTest('green', 1, 6, newStream(seedForRoll(6, 3)))
    expect(dropTwo.drop).toBe(2) // 3 <= 3.5
  })

  it('lowerConfidence clamps at Routed, raiseConfidence clamps at Confident', () => {
    expect(lowerConfidence('BR', 1)).toBe('RO')
    expect(lowerConfidence('BR', 5)).toBe('RO')
    expect(lowerConfidence('ST', 2)).toBe('BR')
    expect(raiseConfidence('SH')).toBe('ST')
    expect(raiseConfidence('CO')).toBe('CO')
  })
})

describe('confidence threat level table (p.20)', () => {
  it('uses the highest bare row and stacks cumulative modifiers on top', () => {
    // Leader casualty (bare) beats took-casualties (bare) under LOW; plus untreated casualties and abandoning wounded on top.
    expect(confidenceThreatLevel('low', { tookCasualties: true, leaderCasualty: true })).toBe(4)
    expect(confidenceThreatLevel('low', { leaderCasualty: true, untreatedCasualties: 2, abandonedWounded: true })).toBe(4 + 1 * 2 + 3)
  })

  it("[reading] resolves the book's own table/example mismatch toward the table: took-casualties under MEDIUM is 1, not the worked example's +2", () => {
    expect(confidenceThreatLevel('medium', { tookCasualties: true })).toBe(1)
  })

  it('reads No Test Required when every triggered row is NTR and nothing cumulative applies', () => {
    expect(confidenceThreatLevel('high', { firstSuppressed: true })).toBe('not-required')
    expect(confidenceThreatLevel('high', { tookCasualties: true })).toBe('not-required')
    // Same NTR row, but a cumulative modifier still forces a test.
    expect(confidenceThreatLevel('high', { firstSuppressed: true, abandonedWounded: true })).toBe(1)
  })

  it('nothing triggered at all is also not-required', () => {
    expect(confidenceThreatLevel('medium', {})).toBe('not-required')
  })
})

describe('reaction test (p.21)', () => {
  it("book's worked example: a Shaken unit fails to leave cover on its first action (p.21)", () => {
    // Threat level 2 (SHAKEN leaves cover), Regular (D8), LV2 -> target 4.
    const failed = reactionTest('regular', 2, 2, newStream(seedForRoll(8, 3)))
    expect(failed).toEqual({ roll: 3, target: 4, passed: false })
    const passed = reactionTest('regular', 2, 2, newStream(seedForRoll(8, 5)))
    expect(passed.passed).toBe(true)
  })
})

describe('panic (p.21)', () => {
  it('a Green unit tests at threat level 0: fails on 1-2, passes on 3+ with LV2', () => {
    const failed = panicTest('green', 2, newStream(seedForRoll(6, 2)))
    expect(failed.passed).toBe(false)
    const passed = panicTest('green', 2, newStream(seedForRoll(6, 3)))
    expect(passed.passed).toBe(true)
  })

  it('a failed recovery that rolls exactly a 1 also costs a Confidence Level', () => {
    const rolledOne = attemptRemovePanic('green', 2, newStream(seedForRoll(6, 1)))
    expect(rolledOne).toEqual({ roll: 1, target: 2, passed: false, lostConfidence: true })
    const rolledTwo = attemptRemovePanic('green', 2, newStream(seedForRoll(6, 2)))
    expect(rolledTwo.lostConfidence).toBe(false) // failed, but not on exactly a 1
    const rolledFive = attemptRemovePanic('green', 2, newStream(seedForRoll(6, 5)))
    expect(rolledFive).toMatchObject({ passed: true, lostConfidence: false })
  })
})

describe('communications (p.16)', () => {
  it("book's example A: Regular/LV1 sender to Green/LV2 receiver, adjacent ranks -> exceed 2 on D8", () => {
    expect(commandLevelsBypassed('platoon', 'squad')).toBe(0)
    const target3 = communicationRoll('regular', 1, 2, 0, newStream(seedForRoll(8, 3)))
    expect(target3).toEqual({ roll: 3, target: 2, passed: true, die: 8 })
    const fail = communicationRoll('regular', 1, 2, 0, newStream(seedForRoll(8, 2)))
    expect(fail.passed).toBe(false)
  })

  it("book's example B: Green/LV3 sender to Veteran/LV2 receiver, adjacent ranks -> exceed 3 on D6", () => {
    const ok = communicationRoll('green', 3, 2, 0, newStream(seedForRoll(6, 4)))
    expect(ok).toEqual({ roll: 4, target: 3, passed: true, die: 6 })
  })

  it('shifts the sender die down one type per command level bypassed', () => {
    expect(commandLevelsBypassed('company', 'squad')).toBe(1)
    const r = communicationRoll('regular', 2, 3, 1, newStream(seedForRoll(6, 4)))
    expect(r.die).toBe(6) // D8 shifted down one, closed
  })
})

describe('transferring actions (p.16)', () => {
  it('is automatic within 6", no roll needed', () => {
    expect(attemptTransfer('regular', 1, 2, 6, 0, newStream(1))).toEqual({ auto: true, ok: true })
  })

  it('rolls a communication beyond 6"', () => {
    const stream = newStream(seedForRoll(8, 3))
    const r = attemptTransfer('regular', 1, 2, 7, 0, stream)
    expect(r).toMatchObject({ auto: false, ok: true })
    expect(r.comm).toEqual({ roll: 3, target: 2, passed: true, die: 8 })
  })
})

describe('rally (p.17)', () => {
  it("book's example: Regular/2 unit at Broken, Veteran/1 commander -> exceed 3 on D8", () => {
    const target3 = rallyRoll('regular', 2, 1, newStream(seedForRoll(8, 4)))
    expect(target3).toEqual({ roll: 4, target: 3, passed: true })
    expect(raiseConfidence('BR')).toBe('SH')
  })

  it('waives the communication roll within 6" and still rolls the rally itself', () => {
    const r = attemptRally('veteran', 1, 'regular', 2, 6, 0, newStream(seedForRoll(8, 4)))
    expect(r).toEqual({ auto: true, ok: true, rally: { roll: 4, target: 3, passed: true } })
  })

  it('requires a passed communication first beyond 6", and never rolls rally if it fails', () => {
    const failedComm = attemptRally('veteran', 1, 'regular', 2, 7, 0, newStream(seedForRoll(10, 1)))
    expect(failedComm.ok).toBe(false)
    expect(failedComm.rally).toBeUndefined()
  })
})

describe('suppression removal (p.18)', () => {
  it("an Elite/LV1 unit needs only to exceed 1 (2+), an Untrained/LV3 unit needs to exceed 3 (only a 4 on a D4)", () => {
    const elite = attemptRemoveSuppression('elite', 1, newStream(seedForRoll(12, 2)))
    expect(elite).toEqual({ roll: 2, target: 1, passed: true })
    const untrainedFail = attemptRemoveSuppression('untrained', 3, newStream(seedForRoll(4, 3)))
    expect(untrainedFail.passed).toBe(false)
    const untrainedPass = attemptRemoveSuppression('untrained', 3, newStream(seedForRoll(4, 4)))
    expect(untrainedPass.passed).toBe(true)
  })
})

describe('going in position (p.13)', () => {
  it("book's example: Regular/2, D8 -- in cover exceed 2 (3+), in the open exceed 4 (5+)", () => {
    const inCoverPass = attemptGoInPosition('regular', 2, true, newStream(seedForRoll(8, 3)))
    expect(inCoverPass).toEqual({ roll: 3, target: 2, passed: true })
    const inOpenFail = attemptGoInPosition('regular', 2, false, newStream(seedForRoll(8, 4)))
    expect(inOpenFail).toEqual({ roll: 4, target: 4, passed: false })
    const inOpenPass = attemptGoInPosition('regular', 2, false, newStream(seedForRoll(8, 5)))
    expect(inOpenPass.passed).toBe(true)
  })
})

describe('loss of unit leader (p.10)', () => {
  it("book's example: a level-3 leader's replacement stays level 3 on 1-5, drops to level 2 only on a 6", () => {
    for (const roll of [1, 2, 3, 4, 5]) {
      expect(replacementLeaderRoll(3, newStream(seedForRoll(6, roll)))).toEqual({ roll, leadership: 3 })
    }
    expect(replacementLeaderRoll(3, newStream(seedForRoll(6, 6)))).toEqual({ roll: 6, leadership: 2 })
  })

  it('shifts a level-1 leader worse on a 1-2, and never improves past level 1', () => {
    expect(replacementLeaderRoll(1, newStream(seedForRoll(6, 1))).leadership).toBe(2)
    expect(replacementLeaderRoll(1, newStream(seedForRoll(6, 6))).leadership).toBe(1)
  })

  it("owes the unit a leader-casualty confidence test, at the table's own threat level", () => {
    expect(confidenceThreatLevel('low', { leaderCasualty: true })).toBe(4)
    expect(confidenceThreatLevel('medium', { leaderCasualty: true })).toBe(3)
    expect(confidenceThreatLevel('high', { leaderCasualty: true })).toBe(2)
  })
})

describe('replay (the DiceStream contract)', () => {
  it('the same seed reproduces the same confidence test result', () => {
    const a = confidenceTest('veteran', 2, 1, newStream(4242))
    const b = confidenceTest('veteran', 2, 1, newStream(4242))
    expect(a).toEqual(b)
  })
})
