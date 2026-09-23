/**
 * The computer at the table: it finishes battles, its journals replay, an
 * attacker goes for the objectives, and ships overhead get called on.
 */

import { describe, expect, it } from 'vitest'
import { aiPlay } from './ai'
import { replay } from './game'
import { skirmishSetup } from './skirmish'
import type { GameSetup } from './types'

describe('the computer at the table', () => {
  it('plays skirmishes to a result, and every journal replays exactly', () => {
    for (const seed of [3, 11, 29]) {
      const setup = skirmishSetup({ seed, turnLimit: 6 })
      const state = aiPlay(setup, { seed })
      expect(state.result).not.toBeNull()
      const again = replay(setup, state.journal)
      expect(again.elements).toEqual(state.elements)
      expect(again.result).toEqual(state.result)
      // Both sides fired at something.
      expect(state.log.some((l) => l.side === 'north' && / → /.test(l.text))).toBe(true)
      expect(state.log.some((l) => l.side === 'south' && / → /.test(l.text))).toBe(true)
    }
  })

  it('attacks the objectives it does not hold, and calls down fire when its ships are overhead', () => {
    let called = 0
    let taken = 0
    for (const seed of [5, 7, 13, 17]) {
      const base = skirmishSetup({ seed, turnLimit: 8 })
      const setup: GameSetup = {
        ...base,
        battle: 'attack-defence',
        attacker: 'north',
        table: { ...base.table, objectives: base.table.objectives.filter((o) => o.drawnBy === 'south').map((o) => ({ ...o, drawnBy: 'south' as const })) },
        orbital: [{ side: 'north', ships: [{ id: 'cl', name: 'Minerva', sheafs: 2, ortillery: 1 }] }],
      }
      const state = aiPlay(setup, { seed })
      expect(state.result).not.toBeNull()
      called += state.log.filter((l) => l.text.includes('calls Minerva')).length
      taken += state.log.filter((l) => l.side === 'north' && l.text.includes('takes objective')).length
      expect(replay(setup, state.journal).orbit).toEqual(state.orbit)
    }
    expect(called).toBeGreaterThan(0)
    expect(taken).toBeGreaterThan(0)
  })
})
