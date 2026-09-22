/**
 * Random legal play over the skirmish: the engine never throws, the game
 * gets somewhere, and the journal replays to the same state.
 */

import { describe, expect, it } from 'vitest'
import { autoplay } from './autoplay'
import { replay } from './game'
import { skirmishSetup } from './skirmish'

describe('autoplay', () => {
  it('plays several seeded skirmishes to a result or the turn cap, and every journal replays exactly', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const setup = skirmishSetup({ seed, terrain: seed % 2 ? 'light' : 'dense', turnLimit: 4 })
      const report = autoplay(setup, { seed: seed * 7, maxTurns: 4, maxActions: 3000 })
      expect(report.actions).toBeGreaterThan(30)
      expect(report.state.turn).toBeGreaterThanOrEqual(2)
      expect(report.state.log.some((l) => /HKP|MDC|RFAC|Drew/.test(l.text))).toBe(true)
      const again = replay(setup, report.state.journal)
      expect(again).toEqual(report.state)
    }
  })

  it('is deterministic: the same seeds give the same journal', () => {
    const setup = skirmishSetup({ seed: 9, turnLimit: 3 })
    const a = autoplay(setup, { seed: 99, maxTurns: 3 })
    const b = autoplay(setup, { seed: 99, maxTurns: 3 })
    expect(a.state.journal).toEqual(b.state.journal)
    expect(a.state.log).toEqual(b.state.log)
  })
})
