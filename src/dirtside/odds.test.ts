/**
 * The exact odds, checked against arithmetic done by hand and against
 * DS.XLS (Mikko Kurki-Suonio, 1998), the spreadsheet in the user's zip
 * that enumerates every draw of one to five chits for every armour value
 * and validity set. Its percentages are printed to six decimals.
 */

import { describe, expect, it } from 'vitest'
import { HIT_CATEGORIES, type HitCategory, resolveInfantryHit } from './chits'
import oracle from './data/chitOracle.json'
import type { ChitValidity } from './data/weapons'
import { choose, drawsOf, hitChance, hitsDistribution, infantryHitOdds, pointsDistribution, vehicleHitOdds, vehicleShotOdds } from './odds'

const VALIDITY: Record<string, ChitValidity> = { All: 'ALL', 'All*2': 'ALL×2', 'All/2': 'ALL÷2', 'R&Y': 'R/Y', R: 'RED', Y: 'YELLOW', G: 'GREEN', 'G/Y': 'YELLOW' }
const PRINTED = 1e-6

describe('the opposed roll (p. 29)', () => {
  it('D8 against D6 hits 27 times in 48; D6 against D12 15 in 72', () => {
    expect(hitChance(8, 6, null)).toBeCloseTo(27 / 48, 12)
    expect(hitChance(6, 12, null)).toBeCloseTo(15 / 72, 12)
  })

  it('a second target die is the higher of two: D8 against D6 and D6 is 127 in 288', () => {
    expect(hitChance(8, 6, 6)).toBeCloseTo(127 / 288, 12)
    expect(hitChance(4, 12, null)).toBeCloseTo((0 + 1 + 2 + 3) / 12 / 4, 12)
  })

  it('a multiple mount shares the target roll: two hits come together more often than independence allows', () => {
    const one = hitsDistribution(1, 8, 6, null)
    expect(one[1]).toBeCloseTo(hitChance(8, 6, null), 12)
    const two = hitsDistribution(2, 8, 6, null)
    expect(two.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(two[2]!).toBeGreaterThan(hitChance(8, 6, null) ** 2)
    expect(two[1]! + two[2]!).toBeGreaterThan(one[1]!)
  })
})

describe('draws from the pot', () => {
  it('enumerates 16 single chits and just under 15,504 draws of five (the two F chits cap a few), each set summing to one', () => {
    expect(choose(119, 5)).toBe(182637273)
    expect(drawsOf(1)).toHaveLength(16)
    expect(drawsOf(5).length).toBeGreaterThan(15000)
    expect(drawsOf(5).length).toBeLessThanOrEqual(15504)
    for (const count of [1, 2, 3, 4, 5]) expect(drawsOf(count).reduce((s, d) => s + d.probability, 0)).toBeCloseTo(1, 10)
  })

  it('one chit on armour 0, every colour valid: 11 of 119 damage, 94 kill, 2 are F', () => {
    const odds = vehicleHitOdds(1, 'ALL', 0)
    expect(odds.Dam).toBeCloseTo(11 / 119, 12)
    expect(odds.Kill).toBeCloseTo(94 / 119, 12)
    expect(odds['SD:F']).toBeCloseTo(2 / 119, 12)
    expect(odds.MOB).toBeCloseTo(7 / 119, 12)
    expect(odds['SD:T']).toBeCloseTo(5 / 119, 12)
    expect(odds.Miss).toBe(0)
  })
})

describe('DS.XLS, fire on vehicles: every armour, validity and chit count', () => {
  for (const row of oracle.vehicles) {
    it(`armour ${row.armour}, ${row.valid}`, () => {
      const validity = VALIDITY[row.valid]!
      for (const [count, expected] of Object.entries(row.chits)) {
        const odds = vehicleHitOdds(Number(count), validity, row.armour)
        for (const category of HIT_CATEGORIES) {
          const printed = (expected as Record<HitCategory, number>)[category]
          expect(Math.abs(odds[category] - printed), `${count} chits, ${category}: ${odds[category]} vs ${printed}`).toBeLessThan(PRINTED)
        }
      }
    })
  }
})

describe('DS.XLS, fire on infantry: the sheet splits "reaches the total" into Dam and Kill', () => {
  for (const row of oracle.infantry) {
    it(`kill total ${row.kill}, ${row.valid}`, () => {
      const validity = VALIDITY[row.valid]!
      for (const [count, expected] of Object.entries(row.chits)) {
        let exactly = 0
        let beyond = 0
        let below = 0
        for (const { chits, probability } of drawsOf(Number(count))) {
          // A draw of specials only is a miss on the sheet, whatever the kill total.
          const { points } = resolveInfantryHit(chits, validity, row.kill)
          if (!chits.some((c) => c.kind === 'number') || points < row.kill) below += probability
          else if (points === row.kill) exactly += probability
          else beyond += probability
        }
        expect(Math.abs(exactly - expected.Dam), `${count} chits, Dam`).toBeLessThan(PRINTED)
        expect(Math.abs(beyond - expected.Kill), `${count} chits, Kill`).toBeLessThan(PRINTED)
        expect(Math.abs(below - expected.Miss), `${count} chits, Miss`).toBeLessThan(PRINTED)
        // The rules kill on equals-or-exceeds (p. 33).
        const ours = infantryHitOdds(Number(count), validity, row.kill)
        expect(Math.abs(ours.killed - (expected.Dam + expected.Kill))).toBeLessThan(2 * PRINTED)
      }
    })
  }

  it('reads the sheet\'s G/Y line for green as well as yellow', () => {
    expect(infantryHitOdds(3, 'GREEN', 4).killed).toBeCloseTo(infantryHitOdds(3, 'YELLOW', 4).killed, 12)
    // Line infantry in the open, two chits: the points distribution sums to one.
    let total = 0
    for (const p of pointsDistribution(2, 'R/Y').values()) total += p
    expect(total).toBeCloseTo(1, 10)
  })
})

describe('a whole shot', () => {
  it('folds the hit chance into the outcome: one barrel, one hit', () => {
    const hit = vehicleHitOdds(3, 'R/Y', 4)
    const odds = vehicleShotOdds(1, 8, 8, null, hit)
    const p = hitChance(8, 8, null)
    expect(odds.hit).toBeCloseTo(p, 12)
    expect(odds.expectedHits).toBeCloseTo(p, 12)
    expect(odds.knockedOut).toBeCloseTo(p * hit.Kill, 12)
    expect(odds.damaged).toBeCloseTo(p * (hit.Dam + hit['Dam&SD:T'] + hit['Dam&MOB'] + hit['Dam&SD:T&MOB']), 12)
    expect(odds.firerSystemsDown).toBeCloseTo(p * hit['SD:F'], 12)
  })

  it('two barrels: more hits, and a knock-out by either', () => {
    const hit = vehicleHitOdds(3, 'R/Y', 4)
    const one = vehicleShotOdds(1, 8, 8, null, hit)
    const two = vehicleShotOdds(2, 8, 8, null, hit)
    expect(two.hit).toBeGreaterThan(one.hit)
    expect(two.expectedHits).toBeCloseTo(2 * one.expectedHits, 12)
    expect(two.knockedOut).toBeGreaterThan(one.knockedOut)
    expect(two.knockedOut + two.damaged).toBeLessThanOrEqual(two.hit + 1e-12)
  })
})
