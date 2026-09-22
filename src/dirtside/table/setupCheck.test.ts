import { describe, expect, it } from 'vitest'
import { validateSetup } from './setupCheck'
import { skirmishSetup } from './skirmish'

describe('a setup before the table (p. 17)', () => {
  it('passes the generated skirmishes', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) expect(validateSetup(skirmishSetup({ seed, objectivesPerSide: seed % 3 + 2 }))).toEqual([])
  })

  it('faults objectives placed against the quotas or too close together', () => {
    const setup = skirmishSetup({ seed: 3, objectivesPerSide: 2 })
    setup.table.objectives = [
      { id: 'N1', position: { x: 10, y: 30 }, value: 1, drawnBy: 'north' },
      { id: 'N2', position: { x: 12, y: 30 }, value: 1, drawnBy: 'north' },
    ]
    const faults = validateSetup(setup)
    expect(faults.some((f) => /within 6"/.test(f.detail))).toBe(true)
    expect(faults.some((f) => /own rear area/.test(f.detail))).toBe(true)
    expect(faults.every((f) => f.page === 'p. 17')).toBe(true)
  })

  it('in an attack/defence battle wants a marker in the defender\'s rear and half in the main area', () => {
    const setup = skirmishSetup({ seed: 4, objectivesPerSide: 2 })
    setup.battle = 'attack-defence'
    setup.attacker = 'north'
    setup.table.objectives = [{ id: 'A', position: { x: 10, y: 4 }, value: 1, drawnBy: 'south' }, { id: 'B', position: { x: 30, y: 5 }, value: 1, drawnBy: 'south' }]
    const faults = validateSetup(setup)
    expect(faults.some((f) => /defender's rear/.test(f.detail))).toBe(true)
    expect(faults.some((f) => /main battle area/.test(f.detail))).toBe(true)
  })
})
