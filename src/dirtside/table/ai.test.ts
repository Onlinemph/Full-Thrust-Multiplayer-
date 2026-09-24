/**
 * The computer at the table: it finishes battles, its journals replay, an
 * attacker goes for the objectives, and ships overhead get called on.
 */

import { describe, expect, it } from 'vitest'
import { newVehicleDesign } from '../design'
import { newStream } from '../dice'
import { aiAction, aiPlay } from './ai'
import { applyAction, createGame, replay } from './game'
import { skirmishSetup } from './skirmish'
import { touchesCover } from './tableFire'
import type { GameSetup, TerrainFeature } from './types'

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

  it('prefers a fallback move that ends touching cover once the straight line to its goal is blocked', () => {
    // Open water is impassable to a tracked vehicle (p. 26): the straight line south to the objective is blocked
    // at every reach `moveFor` tries, so it must fall back to an angled move — several of which land inside a
    // lone building well off to the side, wide enough that at least one is picked up regardless of exact rounding.
    const water: TerrainFeature = { id: 'w', terrain: 'open-water', shape: { kind: 'rect', x: 22, y: 13, width: 4, height: 4 } }
    const building: TerrainFeature = { id: 'b', terrain: 'building', shape: { kind: 'rect', x: 12, y: 13, width: 10, height: 5 } }
    const setup: GameSetup = {
      name: 'cover-seeking',
      seed: 1,
      battle: 'encounter',
      table: {
        width: 48,
        depth: 36,
        terrain: [water, building],
        objectives: [{ id: 'O1', position: { x: 24, y: 34 }, value: 1, drawnBy: 'south' }],
      },
      sides: [
        {
          id: 'north',
          name: 'North',
          units: [{ id: 'u1', name: 'Scouts', quality: 'regular', leadership: 2, commandUnit: true, elements: [{ id: 'e1', name: 'e1', vehicle: newVehicleDesign('tank'), position: { x: 24, y: 10 }, facing: 180, leader: true }] }],
        },
        { id: 'south', name: 'South', units: [{ id: 'u2', name: 'Garrison', quality: 'regular', leadership: 2, commandUnit: true, elements: [{ id: 'e2', name: 'e2', infantry: { troops: 'line', team: 'rifle' }, position: { x: 24, y: 34 }, facing: 0, leader: true }] }] },
      ],
      turnLimit: 8,
    }
    let state = createGame(setup)
    const stream = newStream(1)
    for (let i = 0; i < 60; i++) {
      const side = state.phase === 'deployment' ? (!state.sides.north.ready ? 'north' : 'south') : state.toAct
      if (!side) break
      const action = aiAction(state, side, stream)
      if (!action) break
      if (action.kind === 'move' && action.elementId === 'e1') {
        expect(touchesCover(state, action.path[action.path.length - 1]!)).toBe(true)
        return
      }
      const next = applyAction(state, action)
      if (!('ok' in next)) state = next
    }
    throw new Error('the scout never tried to move')
  })
})
