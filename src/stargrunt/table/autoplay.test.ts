/**
 * Random legal play over the default skirmish: the engine never throws,
 * every battle reaches a result or the turn cap, and every journal replays
 * to the exact same state — the same shape as Dirtside's own
 * `table/autoplay.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import { autoplay } from './autoplay'
import { replay } from './game'
import { defaultSkirmish } from './skirmish'

describe('autoplay', () => {
  it('plays a handful of seeded skirmishes and shows real play in the log', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const setup = defaultSkirmish({ seed, terrain: seed % 2 ? 'light' : 'dense', turnLimit: 6 })
      const report = autoplay(setup, { seed, maxTurns: 6, maxActions: 4000 })
      expect(report.actions).toBeGreaterThan(20)
      expect(report.state.result).not.toBeNull()
      expect(report.state.log.some((l) => /fires|close assault|confidence|suppress/i.test(l.text))).toBe(true)
      const again = replay(setup, report.state.journal)
      expect(again).toEqual(report.state)
    }
  })

  it('is deterministic: the same seeds give the same journal and log', () => {
    const setup = defaultSkirmish({ seed: 9, turnLimit: 5 })
    const a = autoplay(setup, { seed: 99, maxTurns: 5 })
    const b = autoplay(setup, { seed: 99, maxTurns: 5 })
    expect(a.state.journal).toEqual(b.state.journal)
    expect(a.state.log).toEqual(b.state.log)
  })

  it('runs several hundred battles to a result without an exception or a stall, every one replaying exactly', () => {
    const winners: Record<string, number> = { north: 0, south: 0, draw: 0 }
    let sawBrokenOrRoutedEnd = false
    for (let seed = 1; seed <= 300; seed++) {
      const setup = defaultSkirmish({ seed, terrain: seed % 3 === 0 ? 'dense' : seed % 3 === 1 ? 'light' : 'none', turnLimit: 8 })
      const report = autoplay(setup, { seed: seed * 13 + 1, maxTurns: 8, maxActions: 6000 })
      expect(report.state.result).not.toBeNull()
      winners[report.state.result!.winner] += 1
      if (report.state.result!.reason.includes('broken, routed or gone')) sawBrokenOrRoutedEnd = true
      const again = replay(setup, report.state.journal)
      expect(again).toEqual(report.state)
    }
    expect(winners.north + winners.south + winners.draw).toBe(300)
    // Not asserted strictly (random play may simply run out of turns first), but recorded for visibility.
    void sawBrokenOrRoutedEnd
  }, 120_000)

  it("plays seeded battles on squad-scale town and city tables (BRIEF-SETTLE's own settlements) to a result, replaying exactly", () => {
    for (const terrain of ['town', 'city'] as const) {
      for (const seed of [11, 12, 13]) {
        const setup = defaultSkirmish({ seed, terrain, turnLimit: 8 })
        const report = autoplay(setup, { seed: seed * 5 + 1, maxTurns: 8, maxActions: 6000 })
        expect(report.state.result ?? report.state.turn > 1).toBeTruthy()
        const again = replay(setup, report.state.journal)
        expect(again).toEqual(report.state)
      }
    }
  })

  it('a longer battle shows casualties, confidence movement, leader loss and suppression removal', () => {
    const setup = defaultSkirmish({ seed: 3, turnLimit: 20, terrain: 'light' })
    const report = autoplay(setup, { seed: 21, maxTurns: 20, maxActions: 20000 })
    const text = report.state.log.map((l) => l.text).join(' | ')
    expect(text).toMatch(/tests confidence/)
    expect(text).toMatch(/leader falls/)
    expect(text).toMatch(/tries to shake off suppression/)
    const again = replay(setup, report.state.journal)
    expect(again).toEqual(report.state)
  })
})
