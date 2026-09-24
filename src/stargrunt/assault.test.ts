/**
 * Infantry close assault (pp. 41–43) — checked against the book's own
 * worked examples and numbers.
 */

import { describe, expect, it } from 'vitest'
import {
  assaultOdds,
  assaultRoundEndTest,
  attackerReactionAfterFdf,
  attemptCloseAssaultReaction,
  closeCombatCasualtyRoll,
  CLOSE_ASSAULT_REACTION_THREAT,
  defenderStandTest,
  defenderStandThreatLevel,
  finalDefensiveFireGate,
  interpretFinalDefensiveFire,
  pairOff,
  resolveCloseCombatRound,
  whoTestsFirst,
  type CloseCombatFighter,
} from './assault'
import { newStream, rollDie, type DieType } from './dice'

function seedForRoll(die: DieType, want: number): number {
  for (let seed = 0; seed < 200_000; seed++) {
    if (rollDie(die, newStream(seed)) === want) return seed
  }
  throw new Error(`no seed rolls ${want} on a D${die}`)
}

/** Brute-forces a seed whose first N rolls, drawn in order, match `wants` exactly. Keep sequences short and dice small. */
function seedForSequence(dice: readonly DieType[], wants: readonly number[]): number {
  outer: for (let seed = 0; seed < 20_000_000; seed++) {
    const s = newStream(seed)
    for (let i = 0; i < dice.length; i++) if (rollDie(dice[i]!, s) !== wants[i]) continue outer
    return seed
  }
  throw new Error(`no seed rolls ${wants.join(',')} on D${dice.join('/D')}`)
}

describe('initiating the assault (p.41)', () => {
  it('threat level 0/1/3 by Confident/Steady/Shaken; Broken and Routed cannot attempt one at all', () => {
    expect(CLOSE_ASSAULT_REACTION_THREAT).toEqual({ CO: 0, ST: 1, SH: 3 })
    const broken = attemptCloseAssaultReaction('regular', 2, 'BR', newStream(1))
    expect(broken).toMatchObject({ ok: false, page: 'p.41' })
    const routed = attemptCloseAssaultReaction('regular', 2, 'RO', newStream(1))
    expect(routed.ok).toBe(false)
  })

  it('derived: a Steady (+1) Regular/2 unit needs to exceed 3, so a roll of 4 passes and 3 fails', () => {
    const pass = attemptCloseAssaultReaction('regular', 2, 'ST', newStream(seedForRoll(8, 4)))
    expect(pass).toMatchObject({ ok: true, roll: 4, target: 3, passed: true })
    const fail = attemptCloseAssaultReaction('regular', 2, 'ST', newStream(seedForRoll(8, 3)))
    expect(fail).toMatchObject({ ok: true, passed: false })
  })
})

describe("the defender's confidence test on the odds (p.41)", () => {
  it("book's own examples: 6 vs 4 is 1:1 (+1), 8 vs 4 is 2:1 (+2), 6 Power Armoured vs 4 is 3:1 (+3)", () => {
    expect(assaultOdds(6, 0, 4, 0)).toBe(1)
    expect(assaultOdds(8, 0, 4, 0)).toBe(2)
    expect(assaultOdds(6, 6, 4, 0)).toBe(3)
  })

  it('a terror effect doubles the whole threat level, odds included', () => {
    expect(defenderStandThreatLevel(2, false)).toBe(2)
    expect(defenderStandThreatLevel(2, true)).toBe(4)
  })

  it('a defender already Broken automatically routs without a roll at all', () => {
    expect(defenderStandTest('regular', 2, 'BR', 1, false, newStream(1))).toEqual({ autoRout: true })
  })

  it('otherwise rolls an ordinary confidence test at the odds-derived threat level', () => {
    // Regular/2, odds 2:1 (+2) -> target 4.
    const held = defenderStandTest('regular', 2, 'CO', 2, false, newStream(seedForRoll(8, 5)))
    expect(held).toEqual({ roll: 5, target: 4, drop: 0, autoRout: false })
  })
})

describe('pairing off (p.41-42)', () => {
  it("book's own worked example: attacker A-E (5) vs defender W-Z (4) -- the defender allocates the leftover attacker onto Y", () => {
    const p = pairOff(['A', 'B', 'C', 'D', 'E'], ['W', 'X', 'Y', 'Z'], [2]) // index 2 into the defenders (the fewer side) is Y
    expect(p.fights['W']).toEqual(['A'])
    expect(p.fights['X']).toEqual(['B'])
    expect(p.fights['Z']).toEqual(['D'])
    expect(p.fights['Y']).toEqual(['C', 'E'])
    expect(p.fights['A']).toEqual(['W'])
    expect(p.fights['E']).toEqual(['Y'])
  })

  it('reverses when the defender outnumbers the attacker: the attacker allocates the leftover defenders', () => {
    const p = pairOff(['A', 'B'], ['W', 'X', 'Y'], [1]) // index 1 into the attackers (the fewer side) is B
    expect(p.fights['A']).toEqual(['W'])
    expect(p.fights['B']).toEqual(['X', 'Y'])
  })

  it('rejects an out-of-range extra assignment', () => {
    expect(() => pairOff(['A'], ['W', 'X'], [5])).toThrow()
  })
})

describe('the close-combat roll (p.42)', () => {
  it("book's own worked example: 2 Power Armoured Veterans vs 3 Regular infantry, no cover bonus either side", () => {
    const shotgunInfantry: CloseCombatFighter = { id: 'shotgun', quality: 'regular', weaponShift: 2, powerArmoured: false, opponents: ['apw'] }
    const apwPa: CloseCombatFighter = { id: 'apw', quality: 'veteran', weaponShift: 0, powerArmoured: true, opponents: ['shotgun'] }
    const infantry1: CloseCombatFighter = { id: 'inf1', quality: 'regular', weaponShift: 0, powerArmoured: false, opponents: ['flamer'] }
    const infantry2: CloseCombatFighter = { id: 'inf2', quality: 'regular', weaponShift: 0, powerArmoured: false, opponents: ['flamer'] }
    const flamerPa: CloseCombatFighter = { id: 'flamer', quality: 'veteran', weaponShift: 2, powerArmoured: true, opponents: ['inf1', 'inf2'] }
    const fighters = [shotgunInfantry, apwPa, infantry1, infantry2, flamerPa]
    // Final dice: shotgun D8->+2 open->D12 (no overflow); apw D10->+0->D10; inf1/inf2 D8, reduced to D6 by the flamer's 1-step overflow; flamer D10->+2 open, capped at D12 with 1 overflow.
    // Draw order follows `fighters`: shotgun(D12)=10, apw(D10)=3, inf1(D6)=3, inf2(D6)=5, flamer(D12)=4.
    const seed = seedForSequence([12, 10, 6, 6, 12], [10, 3, 3, 5, 4])
    const r = resolveCloseCombatRound(fighters, newStream(seed))
    expect(r.fighters['shotgun']).toMatchObject({ die: 12, roll: 10, down: false })
    expect(r.fighters['apw']).toMatchObject({ die: 10, roll: 6, down: true }) // 3 doubled for power armour
    expect(r.fighters['inf1']).toMatchObject({ die: 6, roll: 3, down: true })
    expect(r.fighters['inf2']).toMatchObject({ die: 6, roll: 5, down: true })
    expect(r.fighters['flamer']).toMatchObject({ die: 12, roll: 8, down: false, overflowGivenToOpponents: 1 }) // 4 doubled for power armour, beats both 3 and 5
    expect(r.downIds.sort()).toEqual(['apw', 'inf1', 'inf2'])
  })

  it('a tie leaves both fighters standing', () => {
    const a: CloseCombatFighter = { id: 'a', quality: 'regular', weaponShift: 0, powerArmoured: false, opponents: ['b'] }
    const b: CloseCombatFighter = { id: 'b', quality: 'regular', weaponShift: 0, powerArmoured: false, opponents: ['a'] }
    const seed = seedForSequence([8, 8], [5, 5])
    const r = resolveCloseCombatRound([a, b], newStream(seed))
    expect(r.downIds).toEqual([])
  })

  it('the first-round cover bonus shifts the defender up one type, closed, on top of any weapon shift', () => {
    const attacker: CloseCombatFighter = { id: 'atk', quality: 'regular', weaponShift: 0, powerArmoured: false, opponents: ['def'] }
    const defender: CloseCombatFighter = { id: 'def', quality: 'regular', weaponShift: 0, powerArmoured: false, firstRoundCoverBonus: true, opponents: ['atk'] }
    const seed = seedForSequence([8, 10], [8, 9])
    const r = resolveCloseCombatRound([attacker, defender], newStream(seed))
    expect(r.fighters['def'].die).toBe(10) // D8 shifted up one closed step for cover
  })
})

describe('casualties, once the assault ends (p.42-43)', () => {
  it('1-2 dead, 3-4 wounded, 5-6 stunned (recovers if winning, prisoner if losing)', () => {
    expect(closeCombatCasualtyRoll(true, newStream(seedForRoll(6, 1)))).toEqual({ roll: 1, outcome: 'dead' })
    expect(closeCombatCasualtyRoll(true, newStream(seedForRoll(6, 4)))).toEqual({ roll: 4, outcome: 'wounded' })
    expect(closeCombatCasualtyRoll(true, newStream(seedForRoll(6, 6)))).toEqual({ roll: 6, outcome: 'stunned-recovers' })
    expect(closeCombatCasualtyRoll(false, newStream(seedForRoll(6, 6)))).toEqual({ roll: 6, outcome: 'stunned-prisoner' })
  })
})

describe('ending a combat round (p.42-43)', () => {
  it('the side with more casualties this round tests first; the defender wins a tie', () => {
    expect(whoTestsFirst(2, 1)).toBe('attacker')
    expect(whoTestsFirst(1, 2)).toBe('defender')
    expect(whoTestsFirst(1, 1)).toBe('defender')
  })

  it('any drop (one or two levels) falls the side back, at +1 threat level per casualty suffered', () => {
    // Regular/2, 2 casualties -> threat level 2, target 4.
    const fellBack = assaultRoundEndTest('regular', 2, 2, newStream(seedForRoll(8, 3)))
    expect(fellBack.fellBack).toBe(true)
    const held = assaultRoundEndTest('regular', 2, 2, newStream(seedForRoll(8, 5)))
    expect(held.fellBack).toBe(false)
  })
})

describe('final defensive fire (p.43)', () => {
  it('gates on the current suppression count', () => {
    expect(finalDefensiveFireGate(0)).toEqual({ needsReactionTest: false, threatLevel: 0 })
    expect(finalDefensiveFireGate(2)).toEqual({ needsReactionTest: true, threatLevel: 2 })
  })

  it('counts only real casualties, never a plain suppression-only result', () => {
    expect(interpretFinalDefensiveFire({ figureResults: {} })).toEqual({ casualties: 0 })
    expect(interpretFinalDefensiveFire({ figureResults: { 0: 'wounded', 2: 'dead' } })).toEqual({ casualties: 2 })
  })

  it("the attacker's reaction test after casualties is +1 threat level per casualty", () => {
    const r = attackerReactionAfterFdf('regular', 2, 2, newStream(seedForRoll(8, 5)))
    expect(r).toEqual({ roll: 5, target: 4, passed: true })
  })
})
