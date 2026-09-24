/**
 * Stargrunt II — fire combat against dispersed (infantry) targets (pp.
 * 33–36, 37): the range die, squad small-arms fire with support weapons
 * joining in, a support weapon firing alone, and the four resolution
 * steps (the multiple opposed roll, potential hits, impact against
 * armour, and random allocation among the target's figures).
 *
 * Heavy weapons, guided missiles and fire against vehicles/point targets
 * (pp. 37–40) are round 3 — the shapes below (a firer's dice list, an
 * impact die, an opposed roll against an armour die) extend to them
 * without changing this file, so nothing here forecloses it.
 *
 * Every function draws from a `DiceStream` in the fixed order documented
 * on it, so a saved battle's journal replays exactly.
 */

import { DIE_STEPS, type DiceStream, type DieType, rollDie, shiftClosed } from './dice'
import { QUALITY_DIE, type Quality, type SmallArmProfile, type SupportWeaponProfile } from './types'

// ---------------------------------------------------------------------------
// Cover and the range die (p.33-35, cover shifts from p.12-13)
// ---------------------------------------------------------------------------

export type CoverGrade = 'open' | 'soft' | 'hard'

/** Die-type steps a cover grade adds to both the Range Die and the Armour Die (p.12-13): soft +1, hard +2. */
const COVER_STEPS: Record<CoverGrade, number> = { open: 0, soft: 1, hard: 2 }

export interface RangeDieOk {
  die: DieType
  /** Total die-type steps up from D4: range-band multiples elapsed, plus cover, plus in-position. */
  steps: number
}
export interface RangeDieImpossible {
  impossible: true
  /** Beyond D12 (p.35), or beyond a close-range weapon's one band (p.34). */
  reason: 'over-d12' | 'close-range'
}
export type RangeDieResult = RangeDieOk | RangeDieImpossible

/** Range bands elapsed, 1-based: up to one band is 1, over one but up to two is 2, and so on (p.33). */
export function rangeBandsElapsed(rangeInches: number, rangeBandInches: number): number {
  return Math.max(1, Math.ceil(rangeInches / rangeBandInches))
}

/**
 * The target's Range Die for small-arms/infantry-support fire (p.33-35):
 * one die-type step up from D4 per range-band multiple elapsed, plus the
 * target's cover, plus one more if it's in position against this
 * (direct) fire (p.13). Past D12 the shot is automatically ineffective
 * (p.35) — [reading]: read as a legal action that deterministically
 * fails, not a refused declaration; no die is drawn from the stream for
 * an impossible shot (there is no book-specified die "greater than
 * D12"). A close-range weapon (`closeOnly`) is limited to one band
 * regardless of the die-type math (p.34).
 */
export function rangeDie(rangeInches: number, rangeBandInches: number, cover: CoverGrade, inPosition: boolean, closeOnly = false): RangeDieResult {
  const bandsElapsed = rangeBandsElapsed(rangeInches, rangeBandInches)
  if (closeOnly && bandsElapsed > 1) return { impossible: true, reason: 'close-range' }
  const steps = bandsElapsed - 1 + COVER_STEPS[cover] + (inPosition ? 1 : 0)
  if (steps > DIE_STEPS.length - 1) return { impossible: true, reason: 'over-d12' }
  return { die: DIE_STEPS[steps]!, steps }
}

/** The Armour Die actually rolled against a potential hit (p.36), after the target's cover shift (p.12-13, applied at the unit level, same grade for every figure). */
export function coverShiftedArmourDie(baseArmourDie: DieType, cover: CoverGrade): DieType {
  return shiftClosed(baseArmourDie, COVER_STEPS[cover])
}

// ---------------------------------------------------------------------------
// Firepower (p.34)
// ---------------------------------------------------------------------------

/** Total small-arms firepower of the figures actually firing this action (p.34): sum their per-trooper Firepower values. */
export function totalFirepower(firingFigures: readonly Pick<SmallArmProfile, 'firepower'>[]): number {
  return firingFigures.reduce((sum, f) => sum + f.firepower, 0)
}

/**
 * The die type nearest (rounded up) to a fire-value total (p.34): D4 for
 * 4 or less, up through D12 for anything over 12 (no bonus above 12).
 * [reading]: the formula has no exception for zero, so zero firing
 * figures still yields a D4 — a squad with nobody firing small arms
 * should not call `fireSquadSmallArms` at all rather than rely on this
 * to mean "no die."
 */
export function firepowerDieFor(totalFireValue: number): DieType {
  for (const d of DIE_STEPS) if (totalFireValue <= d) return d
  return 12
}

// ---------------------------------------------------------------------------
// Step 1 — the multiple opposed roll (p.33, p.35)
// ---------------------------------------------------------------------------

export type FireEffect = 'no-effect' | 'suppression' | 'effective'

export interface FireEffectRoll {
  targetRoll: number
  targetDie: DieType
  firerRolls: number[]
  firerDice: DieType[]
  /** How many of the firer's dice exceeded the target's roll. */
  exceeding: number
  /** Sum of every firer die rolled — only meaningful when `effect === 'effective'` (p.35, step 2). */
  total: number
  effect: FireEffect
}

/**
 * The multiple opposed roll (p.33): the target rolls its Range Die once,
 * the firer rolls two or more dice. None exceeding is no effect, exactly
 * one is suppression only, two or more is fully effective (which
 * suppresses too — a major result is a superset of a minor one, not an
 * alternative to it, p.35's boxed step 1). Draws the target's die first,
 * then the firer's dice in the order given.
 */
export function rollFireEffect(firerDice: readonly DieType[], targetDie: DieType, rng: DiceStream): FireEffectRoll {
  const targetRoll = rollDie(targetDie, rng)
  const firerRolls = firerDice.map((d) => rollDie(d, rng))
  const exceeding = firerRolls.filter((r) => r > targetRoll).length
  const effect: FireEffect = exceeding === 0 ? 'no-effect' : exceeding === 1 ? 'suppression' : 'effective'
  return { targetRoll, targetDie, firerRolls, firerDice: [...firerDice], exceeding, total: firerRolls.reduce((a, b) => a + b, 0), effect }
}

// ---------------------------------------------------------------------------
// Step 2 — potential hits (p.35)
// ---------------------------------------------------------------------------

export interface PotentialHitsResult {
  autoHits: number
  remainder: number
  /** The target's own extra roll for the left-over points, or null if the firer's total divided evenly. */
  extraRoll: number | null
  extraHit: boolean
  total: number
}

/**
 * Potential hits (p.35): the firer's total divided by the target's Range
 * Die type, rounded down. A non-zero remainder is one more chance at a
 * hit — the target rolls the same die type once more, and denies the
 * extra hit only by rolling over the remainder. This also covers "less
 * than one automatic hit" for free: when the total is less than the die
 * type, the remainder equals the total.
 */
export function potentialHits(firerTotal: number, targetDie: DieType, rng: DiceStream): PotentialHitsResult {
  const autoHits = Math.floor(firerTotal / targetDie)
  const remainder = firerTotal % targetDie
  if (remainder === 0) return { autoHits, remainder, extraRoll: null, extraHit: false, total: autoHits }
  const extraRoll = rollDie(targetDie, rng)
  const extraHit = extraRoll <= remainder
  return { autoHits, remainder, extraRoll, extraHit, total: autoHits + (extraHit ? 1 : 0) }
}

// ---------------------------------------------------------------------------
// Step 3 — penetration and effect (p.36)
// ---------------------------------------------------------------------------

export type PenetrationOutcome = 'none' | 'wound' | 'kill'

export interface PenetrationRoll {
  impactRoll: number
  armourRoll: number
  armourDie: DieType
  outcome: PenetrationOutcome
}

/**
 * Penetration for one potential hit (p.36): the firer rolls the weapon's
 * Impact die, the target rolls its (cover-shifted) Armour die. At or
 * under armour is no effect; over armour is a wound; over twice armour
 * is a kill — the boundary is strict, so exactly double is still only a
 * wound. No modifiers beyond the armour die itself (p.36: "No modifiers
 * used").
 */
export function resolvePenetration(impactDie: DieType, armourDie: DieType, rng: DiceStream): PenetrationRoll {
  const impactRoll = rollDie(impactDie, rng)
  const armourRoll = rollDie(armourDie, rng)
  const outcome: PenetrationOutcome = impactRoll <= armourRoll ? 'none' : impactRoll > armourRoll * 2 ? 'kill' : 'wound'
  return { impactRoll, armourRoll, armourDie, outcome }
}

// ---------------------------------------------------------------------------
// Step 4 — allocating hits, "who buys the farm" (p.36)
// ---------------------------------------------------------------------------

/** The die type nearest a figure count (p.36): D4 up to 4 figures, D6 up to 6, and so on; 12+ still wraps on a D12. */
export function allocationDie(figureCount: number): DieType {
  for (const d of DIE_STEPS) if (figureCount <= d) return d
  return 12
}

/** The 0-based figure index a die roll lands on, wrapping (p.36: a roll past the actual count wraps back to the start). */
export function allocateHit(figureCount: number, dieRoll: number): number {
  return (dieRoll - 1) % figureCount
}

// ---------------------------------------------------------------------------
// Steps 3+4 combined, and the whole dispersed-fire resolution (p.35-36)
// ---------------------------------------------------------------------------

export interface DispersedFireHit {
  figureIndex: number
  allocationRoll: number
  penetration: PenetrationRoll
}

export interface DispersedFireResult {
  rangeDie: RangeDieResult
  /** Absent only when the range die came back impossible — no dice were drawn at all for that shot. */
  fireEffect?: FireEffectRoll
  potentialHits?: PotentialHitsResult
  hits: DispersedFireHit[]
  suppressed: boolean
  /** Net outcome per target figure index (p.36): two wounds on the same figure in one resolution upgrades it to dead. */
  figureResults: Record<number, 'wounded' | 'dead'>
}

/**
 * Steps 3 and 4 for every potential hit (p.36). The book allows either
 * order; this always allocates the figure first and then rolls that
 * figure's own armour, which is the only order that works once a squad's
 * armour is mixed ([reading], p.36's own note on the two orders) and
 * gives the same result as rolling armour first when it isn't. Draws, per
 * hit: the allocation die, then the impact die, then the armour die.
 */
function resolveHitsAgainstFigures(
  firerTotal: number,
  targetDie: DieType,
  impactDie: DieType,
  cover: CoverGrade,
  figures: readonly { armourDie: DieType }[],
  rng: DiceStream,
): { potentialHits: PotentialHitsResult; hits: DispersedFireHit[]; figureResults: Record<number, 'wounded' | 'dead'> } {
  const ph = potentialHits(firerTotal, targetDie, rng)
  const hits: DispersedFireHit[] = []
  const woundCounts: Record<number, number> = {}
  const figureResults: Record<number, 'wounded' | 'dead'> = {}
  const allocDie = allocationDie(figures.length)
  for (let i = 0; i < ph.total; i++) {
    const allocationRoll = rollDie(allocDie, rng)
    const figureIndex = allocateHit(figures.length, allocationRoll)
    const armourDie = coverShiftedArmourDie(figures[figureIndex]!.armourDie, cover)
    const penetration = resolvePenetration(impactDie, armourDie, rng)
    hits.push({ figureIndex, allocationRoll, penetration })
    if (penetration.outcome === 'kill') {
      figureResults[figureIndex] = 'dead'
    } else if (penetration.outcome === 'wound' && figureResults[figureIndex] !== 'dead') {
      woundCounts[figureIndex] = (woundCounts[figureIndex] ?? 0) + 1
      figureResults[figureIndex] = woundCounts[figureIndex]! >= 2 ? 'dead' : 'wounded'
    }
  }
  return { potentialHits: ph, hits, figureResults }
}

/**
 * The whole fire-against-dispersed-targets resolution (p.35-36), given
 * the firer's already-assembled dice and impact die and the target's
 * already-computed Range Die (`rangeDie`). Draws, in order: the range
 * die's target roll and the firer's dice (step 1), the extra range-die
 * roll if step 1 was effective and the total didn't divide evenly (step
 * 2), then per potential hit the allocation die, impact die and armour
 * die (steps 3-4, combined per `resolveHitsAgainstFigures`).
 */
export function fireAgainstDispersedTarget(
  firerDice: readonly DieType[],
  impactDie: DieType,
  rangeDieResult: RangeDieResult,
  targetCover: CoverGrade,
  targetFigures: readonly { armourDie: DieType }[],
  rng: DiceStream,
): DispersedFireResult {
  if ('impossible' in rangeDieResult) return { rangeDie: rangeDieResult, hits: [], suppressed: false, figureResults: {} }
  const fireEffect = rollFireEffect(firerDice, rangeDieResult.die, rng)
  if (fireEffect.effect === 'no-effect') return { rangeDie: rangeDieResult, fireEffect, hits: [], suppressed: false, figureResults: {} }
  if (fireEffect.effect === 'suppression') return { rangeDie: rangeDieResult, fireEffect, hits: [], suppressed: true, figureResults: {} }
  const { potentialHits: ph, hits, figureResults } = resolveHitsAgainstFigures(fireEffect.total, rangeDieResult.die, impactDie, targetCover, targetFigures, rng)
  return { rangeDie: rangeDieResult, fireEffect, potentialHits: ph, hits, suppressed: true, figureResults }
}

// ---------------------------------------------------------------------------
// Squad small arms, and a support weapon firing alone (p.34-35, p.37)
// ---------------------------------------------------------------------------

export interface DispersedFireTarget {
  cover: CoverGrade
  /** In position against this (direct) fire adds one more Range Die step (p.13); it does not shift the Armour die under direct fire. */
  inPosition: boolean
  figures: readonly { armourDie: DieType }[]
}

/**
 * Squad small-arms fire (p.34-35): Quality die + Small Arms Firepower die
 * (from the summed firepower of `firingFigures`) + any support weapons'
 * Firepower dice joining in — every potential hit still uses the small
 * arms' own Impact die, never the support weapons' (p.35's "IMPORTANT
 * NOTE"). [reading]: the book's own math assumes one small-arms type per
 * squad; when `firingFigures` mixes types, the first figure's Impact and
 * `closeOnly` are used for the whole squad's shot (and every firing
 * figure must be close-only for the whole shot to be range-limited) —
 * mixed-weapon squads are better fired as separate actions per weapon
 * type if that distinction matters.
 */
export function fireSquadSmallArms(
  quality: Quality,
  firingFigures: readonly SmallArmProfile[],
  range: number,
  rangeBandInches: number,
  target: DispersedFireTarget,
  supportFirepowerDice: readonly DieType[],
  rng: DiceStream,
): DispersedFireResult {
  const impact = firingFigures[0]?.impact ?? 4
  const closeOnly = firingFigures.length > 0 && firingFigures.every((f) => f.closeOnly)
  const firepower = firepowerDieFor(totalFirepower(firingFigures))
  const rd = rangeDie(range, rangeBandInches, target.cover, target.inPosition, closeOnly)
  const firerDice = [QUALITY_DIE[quality], firepower, ...supportFirepowerDice]
  return fireAgainstDispersedTarget(firerDice, impact, rd, target.cover, target.figures, rng)
}

/**
 * A support weapon firing alone (p.37): just two firer dice, Quality and
 * the weapon's own Support Firepower die (no Small Arms Firepower die,
 * since none is contributing) — its own Impact die, at the ordinary
 * infantry small-arms range band for the firer's Quality. A groundmount
 * or vehicle mounting (the Heavy-Weapon-style, target-size-multiplied
 * band) is round 3.
 */
export function fireSupportWeaponAlone(quality: Quality, weapon: SupportWeaponProfile, range: number, rangeBandInches: number, target: DispersedFireTarget, rng: DiceStream): DispersedFireResult {
  const rd = rangeDie(range, rangeBandInches, target.cover, target.inPosition, false)
  const firerDice = [QUALITY_DIE[quality], weapon.firepowerDie]
  return fireAgainstDispersedTarget(firerDice, weapon.impact, rd, target.cover, target.figures, rng)
}
