/**
 * Dirtside II — confidence and reaction (pp. 21–24): the die a unit's quality
 * rolls, the tests and their thresholds, the levels and what each forbids.
 */

import type { DieType } from '../data/weapons'
import { type DiceStream, roll } from '../dice'
import { CONFIDENCE_LEVELS, type Confidence, type Leadership, type Quality } from './types'

/** The basic die type of a unit's quality (p. 22, p. 33). */
export const QUALITY_DIE: Record<Quality, DieType> = { green: 6, regular: 8, veteran: 10 }

export const QUALITY_LABELS: Record<Quality, string> = { green: 'Green', regular: 'Regular', veteran: 'Veteran' }
export const CONFIDENCE_LABELS: Record<Confidence, string> = { CO: 'Confident', ST: 'Steady', SH: 'Shaken', BR: 'Broken', RO: 'Routed' }

export function lowerConfidence(level: Confidence, steps: number): Confidence {
  const at = Math.min(CONFIDENCE_LEVELS.length - 1, CONFIDENCE_LEVELS.indexOf(level) + steps)
  return CONFIDENCE_LEVELS[at]!
}

export function raiseConfidence(level: Confidence, steps = 1): Confidence {
  const at = Math.max(0, CONFIDENCE_LEVELS.indexOf(level) - steps)
  return CONFIDENCE_LEVELS[at]!
}

export interface TestResult {
  die: DieType
  roll: number
  /** Leadership plus threat: the score to exceed. */
  needed: number
  passed: boolean
  /** Levels lost on a confidence test: 0, 1 or 2 (p. 22). */
  drop: number
}

/**
 * A confidence test (p. 22): leadership plus the threat level is the score
 * to exceed on the quality die. Equal or less loses one level; half the
 * score or less loses two.
 */
export function confidenceTest(quality: Quality, leadership: Leadership, threat: number, stream: DiceStream): TestResult {
  const die = QUALITY_DIE[quality]
  const needed = leadership + threat
  const rolled = roll(die, stream)
  const passed = rolled > needed
  const drop = passed ? 0 : rolled * 2 <= needed ? 2 : 1
  return { die, roll: rolled, needed, passed, drop }
}

/** A reaction test (p. 22): the same roll; failing changes nothing but the order is not carried out. */
export function reactionTest(quality: Quality, leadership: Leadership, threat: number, stream: DiceStream): TestResult {
  const result = confidenceTest(quality, leadership, threat, stream)
  return { ...result, drop: 0 }
}

/** The rally test (p. 24): exceed both leaderships added, on the rallied unit's die. */
export function rallyTest(quality: Quality, leadership: Leadership, commandLeadership: Leadership, stream: DiceStream): TestResult {
  const die = QUALITY_DIE[quality]
  const needed = leadership + commandLeadership
  const rolled = roll(die, stream)
  return { die, roll: rolled, needed, passed: rolled > needed, drop: 0 }
}

/** Threat levels of the confidence-test circumstances (p. 23); the highest that applies is used. */
export const THREAT = {
  firstLoss: 1,
  quarterInOneAttack: 1,
  halfInBattle: 2,
  leaderDestroyed: 3,
  bombardmentOnInfantry: 0,
  panic: 2,
  shakenInfantryAdvancing: 1,
  infantryUnderFireMoving: 1,
  /** The table on p. 23 prints +1 for vehicles; the marker's own section on p. 24 says +0. The marker's section is followed. */
  vehiclesUnderFireMoving: 0,
} as const

/**
 * The threat level of an attack's casualties on a unit (p. 23), or null when
 * nothing calls for a test. `hit` is elements damaged or destroyed by this
 * attack, `total` the unit's casualties so far including them.
 */
export function casualtyThreat(input: { hit: number; total: number; strength: number; firstLossTaken: boolean; leaderDestroyed: boolean }): number | null {
  const threats: number[] = []
  if (input.leaderDestroyed) threats.push(THREAT.leaderDestroyed)
  if (input.hit > 0 && !input.firstLossTaken) threats.push(THREAT.firstLoss)
  if (input.hit > 0 && input.hit * 4 >= input.strength) threats.push(THREAT.quarterInOneAttack)
  if (input.hit > 0 && input.total * 2 >= input.strength) threats.push(THREAT.halfInBattle)
  return threats.length ? Math.max(...threats) : null
}

/**
 * What a confidence level forbids (p. 22, read from the page image). Mounted
 * infantry counts as armour; dismounted infantry, and troops in soft
 * transport, as infantry.
 *
 *   SH  infantry: a reaction test to leave cover or advance.  armour: normal.
 *   BR  infantry: in the open, withdraw to the nearest cover; no close
 *       assault, and routed if assaulted.  armour: may not advance; in the
 *       open, withdraw to the nearest cover.
 *   RO  infantry: withdraws towards the baseline, may not fire.  armour:
 *       withdraws towards the baseline, may return fire if attacked.
 *
 * "Withdraw to the nearest cover" is enforced as "may not end a move nearer
 * the enemy"; where the cover is, the players decide (p. 22).
 */
export interface Restrictions {
  /** May not end a move nearer the enemy. */
  noAdvance: boolean
  /** Must withdraw towards its own baseline. */
  mustWithdraw: boolean
  /** May not fire in its own activation. */
  noFire: boolean
  /** May still fire when fired on (opportunity fire). */
  returnFire: boolean
  /** Shaken infantry: a reaction test to leave cover or advance. */
  advanceTest: boolean
  noCloseAssault: boolean
}

export function restrictionsOf(level: Confidence, kind: 'infantry' | 'armour'): Restrictions {
  const none: Restrictions = { noAdvance: false, mustWithdraw: false, noFire: false, returnFire: true, advanceTest: false, noCloseAssault: false }
  switch (level) {
    case 'CO':
    case 'ST':
      return none
    case 'SH':
      return kind === 'infantry' ? { ...none, advanceTest: true } : none
    case 'BR':
      return kind === 'infantry' ? { ...none, noAdvance: true, noCloseAssault: true } : { ...none, noAdvance: true }
    case 'RO':
      return kind === 'infantry' ? { ...none, noAdvance: true, mustWithdraw: true, noFire: true, returnFire: false, noCloseAssault: true } : { ...none, noAdvance: true, mustWithdraw: true, noFire: true, returnFire: true, noCloseAssault: true }
  }
}
