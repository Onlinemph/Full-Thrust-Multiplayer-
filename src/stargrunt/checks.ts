/**
 * Stargrunt II — morale and command: confidence and reaction tests, panic,
 * communications, transfers, rally, suppression removal, going in
 * position, and the loss of a unit leader (pp. 8–10, 16–21).
 *
 * Every test here is the same shape (p.6, p.20): roll the unit's Quality
 * die, exceed leadership + threat level to pass. A Confidence Test drops
 * the unit's morale on failure (worse still if the roll is half the
 * target or less); a Reaction Test never changes morale, it only says
 * whether the troops do the thing. Nothing here mutates a `UnitState` —
 * every function returns the dice rolled and the outcome, and the turn
 * engine (round 2) applies it.
 */

import { type DiceStream, type DieType, rollDie, rollVsTarget, shiftClosed } from './dice'
import { CONFIDENCE_LEVELS, COMMAND_LADDER, QUALITY_DIE, type CommandLevel, type Confidence, type Leadership, type Motivation, type Quality } from './types'

// ---------------------------------------------------------------------------
// Confidence and reaction tests (p.20-21)
// ---------------------------------------------------------------------------

export interface ConfidenceTestResult {
  roll: number
  target: number
  /** Confidence Levels lost: 0 (passed), 1 (failed), 2 (failed by half the target or more, p.21). */
  drop: 0 | 1 | 2
}

/**
 * A Confidence Test (p.20-21): roll the Quality die, exceed leadership +
 * threat level to pass. Failing drops one Confidence Level; rolling half
 * the target or less drops two. Always rolled, even when the target
 * mathematically can't be beaten — the roll still decides a one- or
 * two-level drop (p.21's "IMPORTANT NOTE").
 */
export function confidenceTest(quality: Quality, leadership: Leadership, threatLevel: number, rng: DiceStream): ConfidenceTestResult {
  const target = leadership + threatLevel
  const roll = rollDie(QUALITY_DIE[quality], rng)
  const drop = roll > target ? 0 : roll <= target / 2 ? 2 : 1
  return { roll, target, drop }
}

export interface ReactionTestResult {
  roll: number
  target: number
  passed: boolean
}

/**
 * A Reaction Test (p.21): the same roll as a Confidence Test, but a
 * failure never changes Confidence — the troops simply don't do the
 * thing this action.
 */
export function reactionTest(quality: Quality, leadership: Leadership, threatLevel: number, rng: DiceStream): ReactionTestResult {
  const target = leadership + threatLevel
  const { roll, passed } = rollVsTarget(QUALITY_DIE[quality], target, rng)
  return { roll, target, passed }
}

/** Confidence one or more levels worse (toward Routed), clamped at Routed (p.20). */
export function lowerConfidence(level: Confidence, steps: number): Confidence {
  return CONFIDENCE_LEVELS[Math.min(CONFIDENCE_LEVELS.length - 1, CONFIDENCE_LEVELS.indexOf(level) + steps)]!
}

/** Confidence one level better (toward Confident), clamped at Confident (p.17, rallying). */
export function raiseConfidence(level: Confidence, steps = 1): Confidence {
  return CONFIDENCE_LEVELS[Math.max(0, CONFIDENCE_LEVELS.indexOf(level) - steps)]!
}

// ---------------------------------------------------------------------------
// Threat level tables (p.20-21)
// ---------------------------------------------------------------------------

export interface ConfidenceCircumstances {
  firstSuppressed?: boolean
  tookCasualties?: boolean
  moreCasualtiesThanSurvivors?: boolean
  leaderCasualty?: boolean
  underBombardment?: boolean
  untreatedCasualties?: number
  abandonedWounded?: boolean
}

/**
 * Threat Level table for Confidence Tests (p.20), the bare-number rows:
 * use only the single highest one that applies. `null` is "No Test
 * Required" at that Mission Motivation.
 */
export const CONFIDENCE_THREAT_TABLE: Record<Motivation, { firstSuppressed: number | null; tookCasualties: number | null; moreCasualtiesThanSurvivors: number; leaderCasualty: number }> = {
  low: { firstSuppressed: 2, tookCasualties: 2, moreCasualtiesThanSurvivors: 4, leaderCasualty: 4 },
  medium: { firstSuppressed: 1, tookCasualties: 1, moreCasualtiesThanSurvivors: 3, leaderCasualty: 3 },
  high: { firstSuppressed: null, tookCasualties: null, moreCasualtiesThanSurvivors: 1, leaderCasualty: 2 },
}

/** The same table's "+"-prefixed rows (p.20): cumulative, added on top of whichever bare row applies. */
export const CONFIDENCE_CUMULATIVE_TABLE: Record<Motivation, { underBombardment: number; perUntreatedCasualty: number; abandonedWounded: number }> = {
  low: { underBombardment: 2, perUntreatedCasualty: 1, abandonedWounded: 3 },
  medium: { underBombardment: 1, perUntreatedCasualty: 0, abandonedWounded: 2 },
  high: { underBombardment: 0, perUntreatedCasualty: 0, abandonedWounded: 1 },
}

/**
 * Looks up a Confidence Test's threat level (p.20): the highest applicable
 * bare-number row, plus every applicable cumulative modifier on top.
 * `'not-required'` when nothing was triggered at all, or everything
 * triggered reads NTR at this Mission Motivation with no cumulative
 * modifier to force a test anyway.
 *
 * [reading]: the book's own worked example (p.20) computes a first-casualty
 * test under MEDIUM motivation at threat level +2, but the printed table
 * two paragraphs later gives "takes casualties from fire" as 1 under
 * MEDIUM — a discrepancy in the book itself (the digest's checkers
 * pixel-verified both numbers independently against the scan). This
 * function follows the table, since it is the mechanism every other case
 * reuses, while the example's number is incidental to what it's teaching
 * (the half-target-drops-two rule) — see `confidenceTest`'s own test for
 * the example reproduced with the book's stated number instead.
 */
export function confidenceThreatLevel(motivation: Motivation, circumstances: ConfidenceCircumstances): number | 'not-required' {
  const bare = CONFIDENCE_THREAT_TABLE[motivation]
  const triggered: (number | null)[] = []
  if (circumstances.leaderCasualty) triggered.push(bare.leaderCasualty)
  if (circumstances.moreCasualtiesThanSurvivors) triggered.push(bare.moreCasualtiesThanSurvivors)
  if (circumstances.tookCasualties) triggered.push(bare.tookCasualties)
  if (circumstances.firstSuppressed) triggered.push(bare.firstSuppressed)
  const numeric = triggered.filter((v): v is number => v !== null)
  const cumulative = CONFIDENCE_CUMULATIVE_TABLE[motivation]
  const bonus =
    (circumstances.underBombardment ? cumulative.underBombardment : 0) +
    (circumstances.untreatedCasualties ? cumulative.perUntreatedCasualty * circumstances.untreatedCasualties : 0) +
    (circumstances.abandonedWounded ? cumulative.abandonedWounded : 0)
  if (numeric.length === 0 && bonus === 0) return 'not-required'
  return Math.max(0, ...numeric) + bonus
}

export type ReactionCircumstance = 'go-in-position-in-open' | 'go-in-position-in-cover' | 'move-without-removing-in-position' | 'shaken-leaves-cover'

/** Threat Level table for Reaction Tests (p.21); Mission Motivation never affects these (stated explicitly, p.21). */
export const REACTION_THREAT_TABLE: Record<ReactionCircumstance, number> = {
  'go-in-position-in-open': 2,
  'go-in-position-in-cover': 0,
  'move-without-removing-in-position': 2,
  'shaken-leaves-cover': 2,
}

export function reactionThreatLevel(circumstance: ReactionCircumstance): number {
  return REACTION_THREAT_TABLE[circumstance]
}

// ---------------------------------------------------------------------------
// Panic (p.21)
// ---------------------------------------------------------------------------

/**
 * The first-contact Panic check (p.21): a Reaction Test at threat level 0.
 * Only Untrained/Green/Regular ever test, and each unit only once a
 * battle (Veteran and Elite never test at all) — that gating is the
 * caller's, keyed on the unit's quality and its `panicTested` flag.
 */
export function panicTest(quality: Quality, leadership: Leadership, rng: DiceStream): ReactionTestResult {
  return reactionTest(quality, leadership, 0, rng)
}

export interface PanicRecoveryResult extends ReactionTestResult {
  /** A failed recovery that rolled exactly a 1 also costs one Confidence Level (p.21) — a panic-specific penalty an ordinary Reaction Test never has. */
  lostConfidence: boolean
}

/** Removing a Panic marker (p.21): costs the unit's whole next activation and a Reaction Test at threat level 0. */
export function attemptRemovePanic(quality: Quality, leadership: Leadership, rng: DiceStream): PanicRecoveryResult {
  const t = reactionTest(quality, leadership, 0, rng)
  return { ...t, lostConfidence: !t.passed && t.roll === 1 }
}

// ---------------------------------------------------------------------------
// Command ladder, communications, transfers, rally (pp. 8-9, 16-17)
// ---------------------------------------------------------------------------

/** Command levels skipped between two rungs of the ladder (p.8-9): 0 for adjacent (or equal) rungs, more for each rung jumped clean over. */
export function commandLevelsBypassed(a: CommandLevel, b: CommandLevel): number {
  return Math.max(0, Math.abs(COMMAND_LADDER.indexOf(a) - COMMAND_LADDER.indexOf(b)) - 1)
}

export interface CommunicationResult {
  roll: number
  target: number
  passed: boolean
  die: DieType
}

/**
 * A Communications roll (p.16): the sender's Quality die, shifted down
 * one type per command level bypassed (closed shift), must exceed the
 * poorer (numerically higher) of the two Leaderships involved.
 */
export function communicationRoll(senderQuality: Quality, senderLeadership: Leadership, receiverLeadership: Leadership, levelsBypassed: number, rng: DiceStream): CommunicationResult {
  const die = shiftClosed(QUALITY_DIE[senderQuality], -levelsBypassed)
  const target = Math.max(senderLeadership, receiverLeadership)
  const { roll, passed } = rollVsTarget(die, target, rng)
  return { roll, target, passed, die }
}

export interface TransferAttemptResult {
  /** True when the commander is within 6" of the subordinate: automatic, no roll (p.16). */
  auto: boolean
  comm?: CommunicationResult
  ok: boolean
}

/**
 * Transferring an action to a subordinate (p.16): automatic within 6",
 * otherwise a Communications roll. A commander may attempt this twice a
 * turn (the Available Actions table's asterisk) and a subordinate who
 * receives the activation may cascade the same attempt further down the
 * chain — both are the caller's bookkeeping (`UnitState.transfersThisTurn`);
 * this function resolves exactly one attempt.
 */
export function attemptTransfer(commanderQuality: Quality, commanderLeadership: Leadership, subordinateLeadership: Leadership, distanceInches: number, levelsBypassed: number, rng: DiceStream): TransferAttemptResult {
  if (distanceInches <= 6) return { auto: true, ok: true }
  const comm = communicationRoll(commanderQuality, commanderLeadership, subordinateLeadership, levelsBypassed, rng)
  return { auto: false, ok: comm.passed, comm }
}

export interface RallyRollResult {
  roll: number
  target: number
  passed: boolean
}

/** The Rally roll itself (p.17): the rallied unit's own Quality die must exceed the SUM of both units' Leaderships. */
export function rallyRoll(ralliedQuality: Quality, ralliedLeadership: Leadership, commanderLeadership: Leadership, rng: DiceStream): RallyRollResult {
  const target = ralliedLeadership + commanderLeadership
  const { roll, passed } = rollVsTarget(QUALITY_DIE[ralliedQuality], target, rng)
  return { roll, target, passed }
}

export interface RallyAttemptResult {
  auto: boolean
  comm?: CommunicationResult
  rally?: RallyRollResult
  ok: boolean
}

/**
 * The full Rally action (p.17): a Communications roll (waived within 6",
 * same as Transfer) gates a Rally roll. On success the rallied unit's
 * Confidence rises one level (`raiseConfidence`) — capped by its Fatigue
 * ceiling if the caller tracks Fatigue, which is outside this file.
 *
 * [reading]: read as one action total, per the Available Actions table's
 * single "RALLY UNIT" row with one named test, not two separate actions
 * (a `communicate` action followed by a separate `rally` action).
 */
export function attemptRally(commanderQuality: Quality, commanderLeadership: Leadership, ralliedQuality: Quality, ralliedLeadership: Leadership, distanceInches: number, levelsBypassed: number, rng: DiceStream): RallyAttemptResult {
  if (distanceInches > 6) {
    const comm = communicationRoll(commanderQuality, commanderLeadership, ralliedLeadership, levelsBypassed, rng)
    if (!comm.passed) return { auto: false, ok: false, comm }
    const rally = rallyRoll(ralliedQuality, ralliedLeadership, commanderLeadership, rng)
    return { auto: false, ok: rally.passed, comm, rally }
  }
  const rally = rallyRoll(ralliedQuality, ralliedLeadership, commanderLeadership, rng)
  return { auto: true, ok: rally.passed, rally }
}

// ---------------------------------------------------------------------------
// Suppression removal, going in position (pp. 13, 18)
// ---------------------------------------------------------------------------

export interface SuppressionRemovalResult {
  roll: number
  target: number
  passed: boolean
}

/**
 * Removing one Suppression marker (p.18): the unit's Quality die must
 * exceed its own Leadership. May be attempted twice a turn (the
 * Available Actions table's asterisk), each its own action and its own
 * roll — the caller resolves that, and only frees the unit's second
 * action for anything once every counter is gone ([reading], p.18: the
 * book's base-case prose is written for a single counter; with several,
 * the "use your second action for anything" freedom is read as
 * conditioned on `suppressionCount` reaching zero, not on any one
 * successful removal, since a unit with any counter left still reads as
 * "suppressed" for the action-restriction rule).
 */
export function attemptRemoveSuppression(quality: Quality, leadership: Leadership, rng: DiceStream): SuppressionRemovalResult {
  const { roll, passed } = rollVsTarget(QUALITY_DIE[quality], leadership, rng)
  return { roll, target: leadership, passed }
}

/** Going In Position (p.13): a Reaction Test, threat level 0 in cover, 2 in the open. */
export function attemptGoInPosition(quality: Quality, leadership: Leadership, inCover: boolean, rng: DiceStream): ReactionTestResult {
  return reactionTest(quality, leadership, inCover ? REACTION_THREAT_TABLE['go-in-position-in-cover'] : REACTION_THREAT_TABLE['go-in-position-in-open'], rng)
}

// ---------------------------------------------------------------------------
// Loss of unit leader (p.10)
// ---------------------------------------------------------------------------

export interface ReplacementLeaderResult {
  roll: number
  leadership: Leadership
}

/**
 * The new leader's Leadership when the old one becomes a casualty (p.10):
 * D6 — 1-2 one level worse, 3-5 the same, 6 one level better, clamped to
 * 1-3. The caller still owes the unit one automatic Suppression marker
 * and a Confidence Test at the "Unit Leader becomes a casualty" threat
 * level (`confidenceThreatLevel` with `leaderCasualty: true`) — both p.10
 * rules, neither a dice roll this function makes for you.
 */
export function replacementLeaderRoll(oldLeadership: Leadership, rng: DiceStream): ReplacementLeaderResult {
  const roll = rollDie(6, rng)
  const leadership = (roll <= 2 ? Math.min(3, oldLeadership + 1) : roll <= 5 ? oldLeadership : Math.max(1, oldLeadership - 1)) as Leadership
  return { roll, leadership }
}
