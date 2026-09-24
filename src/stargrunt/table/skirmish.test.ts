/**
 * A default skirmish: two chapter 25 platoons on a 48"x36" table, and that
 * a seed makes the same battle.
 */

import { describe, expect, it } from 'vitest'
import { defaultSkirmish } from './skirmish'

describe('the default skirmish', () => {
  it('is a 48"x36" table with two forces of one platoon each (HQ plus three squads)', () => {
    const setup = defaultSkirmish({ seed: 1 })
    expect(setup.table.width).toBe(48)
    expect(setup.table.depth).toBe(36)
    expect(setup.battle).toBe('encounter')
    for (const side of setup.sides) {
      expect(side.units).toHaveLength(4)
      expect(side.units.filter((u) => u.commandLevel === 'platoon')).toHaveLength(1)
      expect(side.units.filter((u) => u.commandLevel === 'squad')).toHaveLength(3)
    }
  })

  it('lays out terrain and objectives from the seeded stream', () => {
    const setup = defaultSkirmish({ seed: 7 })
    expect(setup.table.terrain.length).toBeGreaterThan(0)
    expect(setup.table.objectives.length).toBe(6) // 3 a side, the default
  })

  it('gives an empty table when terrain is turned off', () => {
    const setup = defaultSkirmish({ seed: 7, terrain: 'none' })
    expect(setup.table.terrain).toHaveLength(0)
  })

  it('makes the same battle from the same seed', () => {
    const a = defaultSkirmish({ seed: 42 })
    const b = defaultSkirmish({ seed: 42 })
    expect(a).toEqual(b)
  })

  it('makes a different terrain and objective layout from a different seed', () => {
    const a = defaultSkirmish({ seed: 1 })
    const b = defaultSkirmish({ seed: 2 })
    expect(a.table.terrain).not.toEqual(b.table.terrain)
  })

  it('gives every figure across both sides a unique id', () => {
    const setup = defaultSkirmish({ seed: 3 })
    const ids = setup.sides.flatMap((s) => s.units.flatMap((u) => u.figures.map((f) => f.id)))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
