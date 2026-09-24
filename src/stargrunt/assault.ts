/**
 * Stargrunt II — infantry close assault (pp. 41–43): the attacker's
 * reaction test to charge, the defender's confidence test to stand on
 * the odds, pairing figures off, the close-combat rounds themselves,
 * casualty severity once the assault ends, the confidence tests between
 * rounds, and Final Defensive Fire's hook into ordinary fire combat.
 *
 * Combined (multi-unit) activations, Overruns and Follow-Through (§2.9-
 * 2.11) are round-later refinements on top of this single-unit-vs-
 * single-unit loop, left out per the brief.
 */

import { type DiceStream, type DieType, rollDie, shiftClosed, shiftOpen } from './dice'
import { confidenceTest, type ConfidenceTestResult, reactionTest, type ReactionTestResult } from './checks'
import { QUALITY_DIE, type Confidence, type Leadership, type Quality } from './types'

export interface Refusal {
  ok: false
  reason: string
  page: string
}

// ---------------------------------------------------------------------------
// Initiating the assault (p.41)
// ---------------------------------------------------------------------------

/** The attacker's Reaction Test threat level to charge, by its current Confidence (p.41): BROKEN and ROUTED may not attempt one at all. */
export const CLOSE_ASSAULT_REACTION_THREAT: Partial<Record<Confidence, number>> = { CO: 0, ST: 1, SH: 3 }

/**
 * The attacker's Reaction Test to initiate a Close Assault (p.41): passed
 * lets the unit make its Combat Move; failed loses the first action but
 * leaves the second free for anything else (not a retry, this
 * activation). Refuses outright for a BROKEN or ROUTED unit — the book
 * treats the attempt itself as illegal, not merely doomed.
 */
export function attemptCloseAssaultReaction(quality: Quality, leadership: Leadership, confidence: Confidence, rng: DiceStream): (ReactionTestResult & { ok: true }) | Refusal {
  const threatLevel = CLOSE_ASSAULT_REACTION_THREAT[confidence]
  if (threatLevel === undefined) return { ok: false, reason: `a ${confidence} unit may not attempt a close assault`, page: 'p.41' }
  const t = reactionTest(quality, leadership, threatLevel, rng)
  return { ok: true, ...t }
}

// ---------------------------------------------------------------------------
// Defender's confidence test on the odds (p.41)
// ---------------------------------------------------------------------------

/** Attacker:defender odds (p.41): each ordinary trooper counts 1, each Power Armoured trooper counts 2; rounded down. */
export function assaultOdds(attackerFigures: number, attackerPowerArmoured: number, defenderFigures: number, defenderPowerArmoured: number): number {
  const attackerPoints = attackerFigures - attackerPowerArmoured + attackerPowerArmoured * 2
  const defenderPoints = defenderFigures - defenderPowerArmoured + defenderPowerArmoured * 2
  return Math.floor(attackerPoints / defenderPoints)
}

/**
 * The defender's stand-test threat level from odds (p.41): 1:1 (anything
 * below 2:1) is +1, 2:1 is +2, and so on — `odds` itself, floored at 0.
 * A Terror Effect doubles the whole total, odds included.
 *
 * [reading]: the book's own bucket list starts at "1:1 → +1" and never
 * says what an attacker weaker than 1:1 gets; read literally (no floor of
 * 1 imposed), a materially outnumbered attacker gives the defender no
 * odds bonus at all. The alternative — clamp to at least +1 whenever an
 * assault is even attempted — is not ruled out by the text.
 */
export function defenderStandThreatLevel(odds: number, terror: boolean): number {
  const tl = Math.max(odds, 0)
  return terror ? tl * 2 : tl
}

export type DefenderStandResult = { autoRout: true } | (ConfidenceTestResult & { autoRout: false })

/**
 * The defender's Confidence Test to stand and receive the charge (p.41).
 * A defender already at BROKEN automatically drops to ROUTED and
 * withdraws without rolling at all (the book's own "SPECIAL NOTE") — the
 * caller still applies `lowerConfidence` for that case, same as a normal
 * failed test.
 */
export function defenderStandTest(quality: Quality, leadership: Leadership, confidence: Confidence, odds: number, terror: boolean, rng: DiceStream): DefenderStandResult {
  if (confidence === 'BR') return { autoRout: true }
  const t = confidenceTest(quality, leadership, defenderStandThreatLevel(odds, terror), rng)
  return { ...t, autoRout: false }
}

// ---------------------------------------------------------------------------
// Pairing off figures (p.41-42)
// ---------------------------------------------------------------------------

export interface CloseCombatPairing {
  /** figure id -> the opposing figure id(s) it must fight this round. */
  fights: Record<string, string[]>
}

/**
 * Pairs attacker figures against defender figures (p.41-42): the side
 * with MORE figures places one of its own on each of the other side's
 * figures first; any leftover figures from the larger side are then
 * assigned by the SMALLER side's own player, one 0-based `few`-side index
 * per leftover figure in `extraAssignments` — a player's choice (who
 * takes the extra opponent), never a die roll, so it's an input here, not
 * computed. Symmetric in `attackerIds`/`defenderIds`: whichever side is
 * smaller receives the assignments regardless of which side that is.
 */
export function pairOff(attackerIds: readonly string[], defenderIds: readonly string[], extraAssignments: readonly number[]): CloseCombatPairing {
  const attackerIsFewer = attackerIds.length <= defenderIds.length
  const few = attackerIsFewer ? attackerIds : defenderIds
  const many = attackerIsFewer ? defenderIds : attackerIds
  const fights: Record<string, string[]> = {}
  for (const id of [...attackerIds, ...defenderIds]) fights[id] = []
  const baseline = Math.min(few.length, many.length)
  for (let i = 0; i < baseline; i++) {
    fights[few[i]!]!.push(many[i]!)
    fights[many[i]!]!.push(few[i]!)
  }
  for (let m = baseline; m < many.length; m++) {
    const targetIndex = extraAssignments[m - baseline]
    if (targetIndex === undefined || targetIndex < 0 || targetIndex >= few.length) {
      throw new Error('extraAssignments must give one valid index into the smaller side per surplus figure (p.41-42)')
    }
    const targetId = few[targetIndex]!
    fights[targetId]!.push(many[m]!)
    fights[many[m]!]!.push(targetId)
  }
  return { fights }
}

// ---------------------------------------------------------------------------
// The close-combat roll (p.42)
// ---------------------------------------------------------------------------

export type CloseCombatWeaponShift = 0 | 1 | 2

export interface CloseCombatFighter {
  id: string
  quality: Quality
  /** No specific weapon: 0; a close-combat firearm or edged weapon: 1; a shotgun or flame weapon: 2 (p.42). */
  weaponShift: CloseCombatWeaponShift
  powerArmoured: boolean
  /** True only for a defending figure benefiting from the first-round-only cover/in-position/field-defence bonus (p.42). */
  firstRoundCoverBonus?: boolean
  /** Opposing figure ids this figure must fight this round (from `pairOff`); usually one, sometimes more. */
  opponents: readonly string[]
}

export interface CloseCombatFighterResult {
  id: string
  die: DieType
  /** Die-type steps this figure's own weapon shift pushed past D12, applied as a negative closed shift to every opponent it faces (p.42, open shift). */
  overflowGivenToOpponents: number
  roll: number
  /** Lost to at least one opponent this round — even a figure that also beat another opponent goes down if it lost to any one of them (p.42's own worked example). */
  down: boolean
}

export interface CloseCombatRoundResult {
  fighters: Record<string, CloseCombatFighterResult>
  downIds: string[]
}

/**
 * One round of close combat (p.42): every still-standing figure rolls
 * its Quality die, shifted open by its weapon and then (round 1, cover-
 * benefiting defenders only) closed by one more for cover — a figure
 * facing several opponents rolls once and that one roll is compared
 * against each opponent's own roll independently, so it can beat one and
 * still lose to another. Power Armour doubles the numeric result, not the
 * die type. Draws exactly one die per fighter, in the order `fighters` is
 * given.
 */
export function resolveCloseCombatRound(fighters: readonly CloseCombatFighter[], rng: DiceStream): CloseCombatRoundResult {
  const base = new Map<string, { die: DieType; overflow: number; powerArmoured: boolean }>()
  for (const f of fighters) {
    const { die: afterWeapon, overflow } = shiftOpen(QUALITY_DIE[f.quality], f.weaponShift)
    const die = f.firstRoundCoverBonus ? shiftClosed(afterWeapon, 1) : afterWeapon
    base.set(f.id, { die, overflow, powerArmoured: f.powerArmoured })
  }
  const finalDie = new Map<string, DieType>()
  for (const f of fighters) {
    let die = base.get(f.id)!.die
    for (const oppId of f.opponents) {
      const opp = base.get(oppId)
      if (opp && opp.overflow > 0) die = shiftClosed(die, -opp.overflow)
    }
    finalDie.set(f.id, die)
  }
  const rolls = new Map<string, number>()
  for (const f of fighters) {
    const raw = rollDie(finalDie.get(f.id)!, rng)
    rolls.set(f.id, base.get(f.id)!.powerArmoured ? raw * 2 : raw)
  }
  const down = new Set<string>()
  for (const f of fighters) {
    const myRoll = rolls.get(f.id)!
    for (const oppId of f.opponents) {
      const oppRoll = rolls.get(oppId)
      if (oppRoll !== undefined && oppRoll > myRoll) down.add(f.id)
    }
  }
  const results: Record<string, CloseCombatFighterResult> = {}
  for (const f of fighters) {
    results[f.id] = { id: f.id, die: finalDie.get(f.id)!, overflowGivenToOpponents: base.get(f.id)!.overflow, roll: rolls.get(f.id)!, down: down.has(f.id) }
  }
  return { fighters: results, downIds: [...down] }
}

// ---------------------------------------------------------------------------
// Casualties, once the whole assault ends (p.42-43)
// ---------------------------------------------------------------------------

export type CloseCombatCasualtyOutcome = 'dead' | 'wounded' | 'stunned-recovers' | 'stunned-prisoner'

export interface CloseCombatCasualtyRoll {
  roll: number
  outcome: CloseCombatCasualtyOutcome
}

/**
 * Severity for one "down" figure (p.42-43), rolled only once the entire
 * assault concludes (every round's "down" figures are pooled and resolved
 * together, not per round): 1-2 dead, 3-4 wounded, 5-6 stunned — a
 * stunned figure returns to OK if its side won the assault, or is taken
 * prisoner if it lost. The losing side cannot bring its wounded or
 * stunned figures away with it (p.43) — that disposal is the caller's.
 */
export function closeCombatCasualtyRoll(onWinningSide: boolean, rng: DiceStream): CloseCombatCasualtyRoll {
  const roll = rollDie(6, rng)
  const outcome: CloseCombatCasualtyOutcome = roll <= 2 ? 'dead' : roll <= 4 ? 'wounded' : onWinningSide ? 'stunned-recovers' : 'stunned-prisoner'
  return { roll, outcome }
}

// ---------------------------------------------------------------------------
// Ending a combat round (p.42-43)
// ---------------------------------------------------------------------------

export interface RoundEndTestResult extends ConfidenceTestResult {
  /** Any drop (one or two levels) means this side falls back and the assault is lost (p.42-43) -- not merely a two-level drop. */
  fellBack: boolean
}

/** The Confidence Test a side takes at the end of a round (p.42-43), threat level +1 per casualty it suffered in the stage being tested. */
export function assaultRoundEndTest(quality: Quality, leadership: Leadership, casualties: number, rng: DiceStream): RoundEndTestResult {
  const t = confidenceTest(quality, leadership, casualties, rng)
  return { ...t, fellBack: t.drop > 0 }
}

/**
 * Which side tests first after a round (p.42-43): the side with the most
 * casualties in the count given, defender first on a tie. Rounds 1-2 use
 * that round's own casualties for this; round 3 onward switches to
 * casualties overall for this ordering question only ([reading]: the
 * text's own "in that stage of the assault" is read as still meaning
 * each side's own threat level stays per-round even once round 3 makes
 * the ordering itself cumulative) — the caller picks which counts to pass
 * in for which round.
 */
export function whoTestsFirst(attackerCasualties: number, defenderCasualties: number): 'attacker' | 'defender' {
  return attackerCasualties > defenderCasualties ? 'attacker' : 'defender'
}

// ---------------------------------------------------------------------------
// Final Defensive Fire's hook (p.43)
// ---------------------------------------------------------------------------

/** The Reaction Test threat level gating Final Defensive Fire for a suppressed defender (p.43): its current suppression-marker count. Not suppressed at all needs no test. */
export function finalDefensiveFireGate(defenderSuppressionCount: 0 | 1 | 2 | 3): { needsReactionTest: boolean; threatLevel: number } {
  return { needsReactionTest: defenderSuppressionCount > 0, threatLevel: defenderSuppressionCount }
}

/**
 * Final Defensive Fire's one departure from ordinary fire combat (p.43):
 * resolve the shot exactly as `fire.ts`'s dispersed-fire procedure, but a
 * plain suppression-only result has NO effect at all here (no marker) --
 * only a result that actually inflicts casualties does anything. Takes
 * the already-rolled fire result (from `fire.ts`) and reports what FDF
 * cares about; it doesn't re-roll the shot itself.
 */
export function interpretFinalDefensiveFire(fireResult: { figureResults: Record<number, 'wounded' | 'dead'> }): { casualties: number } {
  return { casualties: Object.keys(fireResult.figureResults).length }
}

/** The attacker's Reaction Test after taking Final Defensive Fire casualties (p.43): threat level +1 per casualty. Failing abandons the assault (the attacker withdraws and is suppressed); passing lets it re-roll its Combat Move with the second action. */
export function attackerReactionAfterFdf(quality: Quality, leadership: Leadership, casualties: number, rng: DiceStream): ReactionTestResult {
  return reactionTest(quality, leadership, casualties, rng)
}
