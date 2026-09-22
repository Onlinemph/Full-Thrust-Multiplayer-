/**
 * Dirtside II — the dice (p. 4) and the seeded stream every roll and every
 * chit draw comes out of.
 *
 * The game has no modifiers to a roll: the die *type* is the modifier. A
 * shot is a D8 against a D10, a better fire control is a bigger die, cover
 * is a second die. So the stream hands out one fraction at a time and the
 * caller says which die it is, and the same `{ seed, cursor }` shape the
 * campaign uses (src/campaign/types.ts) means a battle is replayable from
 * its seed and its record of what was asked for.
 */

import { sampleAt } from '../engine/dice'
import type { DieType } from './data/weapons'

export interface DiceStream {
  seed: number
  /** Draws so far; advancing this is the only way to draw. */
  cursor: number
}

export function newStream(seed: number): DiceStream {
  return { seed: seed >>> 0, cursor: 0 }
}

/** One fraction in [0, 1), and the stream moves on. */
export function draw(stream: DiceStream): number {
  const value = sampleAt(stream.seed, stream.cursor)
  stream.cursor += 1
  return value
}

/** Roll one die of the type the rules name, 1-based. */
export function roll(die: DieType, stream: DiceStream): number {
  return Math.floor(draw(stream) * die) + 1
}

/** The plain D6 the rules fall back on for repairs, spreads and morale. */
export function rollD6(stream: DiceStream): number {
  return roll(6, stream)
}

export function dieLabel(die: DieType | null): string {
  return die === null ? '—' : `D${die}`
}
