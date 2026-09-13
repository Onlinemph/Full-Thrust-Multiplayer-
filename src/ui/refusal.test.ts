import { describe, expect, it } from 'vitest'

import { clearRefusal, dispatch, readRefusal } from './store'

/**
 * The refusal the engine already writes, reaching a player (2.6 and the rest).
 *
 * `applyAction` answers a bad order with a sentence naming the rule that
 * refused it, and every caller in the UI threw that sentence away — so a button
 * that could not do what it said simply did nothing.
 */
describe('a refused order says why', () => {
  it('records the engine’s own sentence, and clears on the next order that lands', () => {
    clearRefusal()
    expect(readRefusal()).toBeNull()

    // Threshold checks are phase 13, and a new battle opens in phase 1.
    const refused = dispatch({ type: 'threshold-sweep' })
    expect(refused.refused).toBeTruthy()
    expect(readRefusal()?.text).toBe(refused.refused)

    // An order that lands takes the notice down.
    dispatch({ type: 'advance-phase' })
    expect(readRefusal()).toBeNull()
  })

  it('counts two identical refusals as two', () => {
    clearRefusal()
    dispatch({ type: 'threshold-sweep' })
    const first = readRefusal()
    dispatch({ type: 'threshold-sweep' })
    const second = readRefusal()
    expect(first?.text).toBe(second?.text)
    expect(second?.seq).toBeGreaterThan(first?.seq ?? 0)
  })
})
