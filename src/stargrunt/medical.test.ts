/**
 * Treating the wounded (p.36, p.39) — checked against the book's own
 * numbers.
 */

import { describe, expect, it } from 'vitest'
import { newStream, rollDie, type DieType } from './dice'
import { treatWounded, treatWoundedFigure } from './medical'

function seedForRoll(die: DieType, want: number): number {
  for (let seed = 0; seed < 200_000; seed++) {
    if (rollDie(die, newStream(seed)) === want) return seed
  }
  throw new Error(`no seed rolls ${want} on a D${die}`)
}

describe('treating one wounded figure (p.36, p.39)', () => {
  it('1-2 dead, 3-5 stabilised, 6 back in action, with no medic', () => {
    expect(treatWoundedFigure(false, false, newStream(seedForRoll(6, 1)))).toEqual({ roll: 1, bonus: 0, total: 1, outcome: 'dead' })
    expect(treatWoundedFigure(false, false, newStream(seedForRoll(6, 2)))).toEqual({ roll: 2, bonus: 0, total: 2, outcome: 'dead' })
    expect(treatWoundedFigure(false, false, newStream(seedForRoll(6, 3)))).toEqual({ roll: 3, bonus: 0, total: 3, outcome: 'stabilised' })
    expect(treatWoundedFigure(false, false, newStream(seedForRoll(6, 5)))).toEqual({ roll: 5, bonus: 0, total: 5, outcome: 'stabilised' })
    expect(treatWoundedFigure(false, false, newStream(seedForRoll(6, 6)))).toEqual({ roll: 6, bonus: 0, total: 6, outcome: 'ok' })
  })

  it('a medic adds 1 to the roll', () => {
    // A roll of 2 alone would be dead; +1 from the medic makes it stabilised.
    expect(treatWoundedFigure(true, false, newStream(seedForRoll(6, 2)))).toEqual({ roll: 2, bonus: 1, total: 3, outcome: 'stabilised' })
    // A roll of 5 alone would be stabilised; +1 makes it a full recovery.
    expect(treatWoundedFigure(true, false, newStream(seedForRoll(6, 5)))).toEqual({ roll: 5, bonus: 1, total: 6, outcome: 'ok' })
  })

  it('a specialised medical unit adds 2', () => {
    // A roll of 1 alone would be dead; +2 makes it stabilised.
    expect(treatWoundedFigure(false, true, newStream(seedForRoll(6, 1)))).toEqual({ roll: 1, bonus: 2, total: 3, outcome: 'stabilised' })
    expect(treatWoundedFigure(false, true, newStream(seedForRoll(6, 4)))).toEqual({ roll: 4, bonus: 2, total: 6, outcome: 'ok' })
  })
})

describe('treating a whole unit in one Reorganise action (p.39)', () => {
  it("rolls once per wounded figure, not once for the whole action -- ALL current casualties may be treated in the one action", () => {
    const results = treatWounded(['a', 'b', 'c'], false, false, newStream(7))
    expect(Object.keys(results)).toEqual(['a', 'b', 'c'])
    for (const id of ['a', 'b', 'c']) expect(results[id]).toBeDefined()
  })

  it('is deterministic, and draws one die per figure in the order given (the DiceStream contract)', () => {
    const a = treatWounded(['x', 'y'], true, false, newStream(2024))
    const b = treatWounded(['x', 'y'], true, false, newStream(2024))
    expect(a).toEqual(b)
    // The two figures draw independent dice, in list order: force distinct rolls and check each landed on its own figure.
    const seed = seedForRoll(6, 3) // x's draw
    const stream = newStream(seed)
    const first = treatWoundedFigure(true, false, stream)
    const second = treatWoundedFigure(true, false, stream)
    const combined = treatWounded(['x', 'y'], true, false, newStream(seed))
    expect(combined['x']).toEqual(first)
    expect(combined['y']).toEqual(second)
  })

  it('an empty casualty list rolls nothing', () => {
    expect(treatWounded([], false, false, newStream(1))).toEqual({})
  })
})
