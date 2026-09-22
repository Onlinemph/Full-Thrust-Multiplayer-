/**
 * Dirtside II — the exact odds of a shot.
 *
 * The opposed roll (p. 29) is small enough to sum outright, and a draw of
 * up to five chits from a pot of sixteen kinds is small enough to
 * enumerate: every multiset of chits, weighted by the ways it can be drawn,
 * put through the same `resolveVehicleHit` the game uses. That is what
 * makes DS.XLS a test of the resolver and not of a second arithmetic: the
 * spreadsheet's percentages (src/dirtside/data/chitOracle.json) are
 * reproduced to its six printed decimals by the code that decides real
 * hits.
 */

import { type Chit, HIT_CATEGORIES, type HitCategory, POT_LINES, POT_SIZE, resolveInfantryHit, resolveVehicleHit } from './chits'
import type { ChitValidity, DieType } from './data/weapons'

// ---------------------------------------------------------------------------
// The opposed roll (p. 29)
// ---------------------------------------------------------------------------

/** P(the target's best die is at most `x`): one die, or the higher of two. */
function targetAtMost(x: number, primary: DieType, secondary: DieType | null): number {
  const p = Math.min(1, Math.max(0, x) / primary)
  const s = secondary ? Math.min(1, Math.max(0, x) / secondary) : 1
  return p * s
}

/** P(one firer die beats the target's roll): the firer needs strictly more (p. 29). */
export function hitChance(firer: DieType, primary: DieType, secondary: DieType | null): number {
  let total = 0
  for (let f = 1; f <= firer; f++) total += targetAtMost(f - 1, primary, secondary)
  return total / firer
}

/**
 * P(exactly k of `dice` firer dice beat the target) for a multiple mount
 * (p. 32). The barrels share one target roll, so the hits are not
 * independent: a low target roll lets every barrel through together.
 */
export function hitsDistribution(dice: number, firer: DieType, primary: DieType, secondary: DieType | null): number[] {
  const out = new Array<number>(dice + 1).fill(0)
  const top = Math.max(primary, secondary ?? 0)
  for (let t = 1; t <= top; t++) {
    const pTarget = targetAtMost(t, primary, secondary) - targetAtMost(t - 1, primary, secondary)
    if (pTarget === 0) continue
    const pBeat = Math.max(0, firer - t) / firer
    for (let k = 0; k <= dice; k++) out[k]! += pTarget * choose(dice, k) * pBeat ** k * (1 - pBeat) ** (dice - k)
  }
  return out
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return result
}

// ---------------------------------------------------------------------------
// Draws from the pot
// ---------------------------------------------------------------------------

export interface WeightedDraw {
  chits: Chit[]
  probability: number
}

const DRAWS = new Map<number, WeightedDraw[]>()

/**
 * Every distinct draw of `count` chits from the full pot, with its exact
 * probability: the product of "ways to pick k of this kind" over the kinds,
 * divided by C(119, count). Five chits is 15,504 multisets.
 */
export function drawsOf(count: number): readonly WeightedDraw[] {
  const cached = DRAWS.get(count)
  if (cached) return cached
  const denominator = choose(POT_SIZE, count)
  const picked: Chit[] = []
  const out: WeightedDraw[] = []
  const walk = (line: number, left: number, ways: number): void => {
    if (left === 0) {
      out.push({ chits: picked.slice(), probability: ways / denominator })
      return
    }
    if (line === POT_LINES.length) return
    const { chit, count: available } = POT_LINES[line]!
    const most = Math.min(available, left)
    for (let k = 0; k <= most; k++) {
      for (let i = 0; i < k; i++) picked.push(chit)
      walk(line + 1, left - k, ways * choose(available, k))
      for (let i = 0; i < k; i++) picked.pop()
    }
  }
  walk(0, count, 1)
  DRAWS.set(count, out)
  return out
}

export type VehicleHitOdds = Record<HitCategory, number>

/** The outcome distribution of one hit of `count` chits on a vehicle. */
export function vehicleHitOdds(count: number, validity: ChitValidity, armour: number): VehicleHitOdds {
  const odds = Object.fromEntries(HIT_CATEGORIES.map((c) => [c, 0])) as VehicleHitOdds
  for (const { chits, probability } of drawsOf(count)) odds[resolveVehicleHit(chits, validity, armour).category] += probability
  return odds
}

/** P(valid points = k) for a draw of `count` chits, keyed by the total (halves possible under ALL÷2). */
export function pointsDistribution(count: number, validity: ChitValidity): Map<number, number> {
  const out = new Map<number, number>()
  for (const { chits, probability } of drawsOf(count)) {
    const points = resolveInfantryHit(chits, validity, 0).points
    out.set(points, (out.get(points) ?? 0) + probability)
  }
  return out
}

export interface InfantryHitOdds {
  killed: number
  miss: number
}

/** The chance one draw of `count` chits removes an element needing `killTotal` points (p. 33). */
export function infantryHitOdds(count: number, validity: ChitValidity, killTotal: number): InfantryHitOdds {
  let killed = 0
  for (const { chits, probability } of drawsOf(count)) if (resolveInfantryHit(chits, validity, killTotal).killed) killed += probability
  return { killed, miss: 1 - killed }
}

// ---------------------------------------------------------------------------
// A whole shot
// ---------------------------------------------------------------------------

export interface ShotOdds {
  /** At least one barrel hits. */
  hit: number
  expectedHits: number
  knockedOut: number
  /** Damaged and still standing. */
  damaged: number
  immobilised: number
  systemsDown: number
  firerSystemsDown: number
}

const sumWhere = (odds: VehicleHitOdds, test: (c: HitCategory) => boolean) =>
  HIT_CATEGORIES.filter(test).reduce((sum, c) => sum + odds[c], 0)

/**
 * The odds of a shot from a mount of `dice` barrels: the hits distribution
 * of the opposed roll, then each hit's own draw (chits go back in the pot
 * between hits, p. 30). "Damaged" here is damaged and not knocked out by
 * any hit; an F chit voids the hit it is drawn on.
 */
export function vehicleShotOdds(dice: number, firer: DieType, primary: DieType, secondary: DieType | null, hit: VehicleHitOdds): ShotOdds {
  const hits = hitsDistribution(dice, firer, primary, secondary)
  const pKill = hit.Kill
  const pDamaged = sumWhere(hit, (c) => c.includes('Dam'))
  const pMobility = sumWhere(hit, (c) => c.includes('MOB'))
  const pSystems = sumWhere(hit, (c) => c.includes('SD:T'))
  const pFirer = hit['SD:F']
  const odds: ShotOdds = { hit: 1 - (hits[0] ?? 1), expectedHits: 0, knockedOut: 0, damaged: 0, immobilised: 0, systemsDown: 0, firerSystemsDown: 0 }
  hits.forEach((p, k) => {
    odds.expectedHits += p * k
    odds.knockedOut += p * (1 - (1 - pKill) ** k)
    odds.damaged += p * ((1 - pKill) ** k - (1 - pKill - pDamaged) ** k)
    odds.immobilised += p * ((1 - pKill) ** k - (1 - pKill - pMobility) ** k)
    odds.systemsDown += p * ((1 - pKill) ** k - (1 - pKill - pSystems) ** k)
    odds.firerSystemsDown += p * (1 - (1 - pFirer) ** k)
  })
  return odds
}
