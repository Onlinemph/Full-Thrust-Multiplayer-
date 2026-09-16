import { describe, expect, it } from 'vitest'

import {
  fighterModProblem,
  gunboatModProblem,
  squadronLabel,
  squadronPointsFor,
  toggleFighterMod,
  toggleGunboatMod,
  wingLabel,
  wingPoints,
} from './smallCraftBuild'
import { FIGHTER_TYPES } from '../engine/fighters'
import { GUNBOAT_TYPES } from '../engine/gunboats'

/**
 * 8.15's modifications stack: a wing can be Heavy and Fast and Long Range and
 * FTL at once, and pays for each. Light is the one that bars others.
 */
describe('building a wing (8.15)', () => {
  it('stacks the modifications that stack, and prices each per fighter', () => {
    let mods: string[] = []
    for (const id of ['heavy', 'fast', 'long-range', 'ftl'] as const) {
      expect(fighterModProblem('attack', mods, id)).toBeNull()
      mods = toggleFighterMod(mods, id)
    }
    expect(mods).toEqual(['heavy', 'fast', 'long-range', 'ftl'])
    expect(wingLabel('attack', mods)).toBe('Heavy Fast Long Range FTL Attack Fighter wing')
    expect(wingPoints('attack', mods)).toBe(FIGHTER_TYPES.attack.pointsPerWing + (3 + 1 + 1 + 1) * 6)
    // Robot takes a point off each fighter.
    expect(wingPoints('standard', ['robot'])).toBe(FIGHTER_TYPES.standard.pointsPerWing - 6)
  })

  it('bars what Light bars, and Light on the roles that cannot be Light', () => {
    expect(fighterModProblem('standard', ['light'], 'heavy')).toMatch(/cannot be combined/)
    expect(fighterModProblem('standard', ['light'], 'long-range')).toMatch(/cannot be combined/)
    expect(fighterModProblem('standard', ['light'], 'fast')).toBeNull()
    expect(fighterModProblem('standard', ['heavy'], 'light')).toMatch(/cannot be combined/)
    expect(fighterModProblem('torpedo', [], 'light')).toMatch(/Light Fighters may not be built/)
    // Eight to a Light wing, priced as the role.
    expect(wingPoints('standard', ['light'])).toBe(FIGHTER_TYPES.standard.pointsPerWing)
  })

  it('takes a modification off again', () => {
    expect(toggleFighterMod(['heavy', 'fast'], 'heavy')).toEqual(['fast'])
  })
})

describe('building a squadron (9.2)', () => {
  it('prices the options per squadron and names them', () => {
    const mods = toggleGunboatMod(toggleGunboatMod([], 'heavy'), 'ftl')
    expect(mods).toEqual(['ftl', 'heavy'])
    expect(squadronLabel('beam', mods)).toBe('FTL Heavy Beam Gunboat squadron')
    expect(squadronPointsFor('beam', mods)).toBe(GUNBOAT_TYPES.beam.pointsEach * 6 + 6 + 12)
  })

  it('refuses FTL boats in a rack, and nothing twice', () => {
    expect(gunboatModProblem('beam', [], 'ftl', true)).toMatch(/cannot be carried in racks/)
    expect(gunboatModProblem('beam', [], 'ftl', false)).toBeNull()
    expect(gunboatModProblem('beam', ['ecm'], 'ecm', false)).toBeNull()
  })
})
