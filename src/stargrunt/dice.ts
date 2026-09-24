/**
 * Stargrunt II — the dice (pp. 5–6).
 *
 * Dirtside's dice with a different engine: the same D4–D12 scale, the same
 * die-type shifts, the same seeded `{ seed, cursor }` stream so a battle
 * replays exactly, but no chits. Everything is one of three rolls the book
 * names on p. 6: a roll against a target number, an opposed roll, and a
 * multiple opposed roll. Exceed to succeed; a tie fails, always.
 *
 * Shifts are CLOSED unless a rule says OPEN (p. 6): a closed shift stops at
 * D4 and D12; an open shift carries what would go past the end onto the
 * opponent's die, the other way (impact against armour, p. 38; in position
 * against indirect fire, p. 13).
 */

import { DIE_STEPS, type DieType } from '../dirtside/data/weapons'
import { roll, type DiceStream } from '../dirtside/dice'

export { DIE_STEPS, type DieType }
export { newStream, draw, type DiceStream } from '../dirtside/dice'

/** One die of the type a rule names, 1-based, out of the battle's stream. */
export function rollDie(die: DieType, rng: DiceStream): number {
  return roll(die, rng)
}

function shiftIndex(die: DieType, steps: number): number {
  return DIE_STEPS.indexOf(die) + steps
}

/** A closed shift (p. 6): up or down the ladder, stopping at D4 and D12. */
export function shiftClosed(die: DieType, steps: number): DieType {
  const at = shiftIndex(die, steps)
  return DIE_STEPS[Math.max(0, Math.min(DIE_STEPS.length - 1, at))]!
}

/** An open shift (p. 6): the die it lands on, and how many steps went past the end (positive past D12, negative below D4). */
export function shiftOpen(die: DieType, steps: number): { die: DieType; overflow: number } {
  const at = shiftIndex(die, steps)
  const clamped = Math.max(0, Math.min(DIE_STEPS.length - 1, at))
  return { die: DIE_STEPS[clamped]!, overflow: at - clamped }
}

/**
 * An opposed pair under open shifts (p. 6, p. 38): each side's shift is
 * applied; whatever one side's shift carries past the end is applied the
 * other way to the other side's die, as a closed shift. [reading] The carry
 * goes one hop and no further: the book's worked examples never reach a
 * carry that would itself overflow, and a ping-pong has no page behind it.
 */
export function openPair(actor: DieType, actorSteps: number, opponent: DieType, opponentSteps: number): { actor: DieType; opponent: DieType } {
  const a = shiftOpen(actor, actorSteps)
  const o = shiftOpen(opponent, opponentSteps)
  return { actor: shiftClosed(a.die, -o.overflow), opponent: shiftClosed(o.die, -a.overflow) }
}

/** Roll against a target number (p. 6): pass on a score above it. */
export function rollVsTarget(die: DieType, target: number, rng: DiceStream): { roll: number; passed: boolean } {
  const score = rollDie(die, rng)
  return { roll: score, passed: score > target }
}

/** An opposed roll (p. 6): the actor wins only on a higher score. The opponent's die is rolled first. */
export function opposedRoll(actorDie: DieType, opponentDie: DieType, rng: DiceStream): { actor: number; opponent: number; won: boolean } {
  const opponent = rollDie(opponentDie, rng)
  const actor = rollDie(actorDie, rng)
  return { actor, opponent, won: actor > opponent }
}

export type OpposedResult = 'fail' | 'minor' | 'major'

/**
 * A multiple opposed roll (p. 6, p. 33): the actor's two or more dice
 * against the opponent's one. None exceeding fails, one is a minor success,
 * two or more a major success. Draw order, fixed for replay: the
 * opponent's die first, then the actor's dice in the order given.
 */
export function multipleOpposedRoll(actorDice: readonly DieType[], opponentDie: DieType, rng: DiceStream): { actorRolls: number[]; opponentRoll: number; exceeding: number; result: OpposedResult } {
  const opponentRoll = rollDie(opponentDie, rng)
  const actorRolls = actorDice.map((d) => rollDie(d, rng))
  const exceeding = actorRolls.filter((r) => r > opponentRoll).length
  return { actorRolls, opponentRoll, exceeding, result: exceeding === 0 ? 'fail' : exceeding === 1 ? 'minor' : 'major' }
}

export function dieLabel(die: DieType | null): string {
  return die === null ? '—' : `D${die}`
}
