import { describe, expect, it } from 'vitest'

import { boughtArcs, defaultArcs, fitArcs, mountingFor } from './arcs'
import { CATALOGUE_WEAPONS } from './buildCatalog'
import type { WeaponDef } from '../engine/types'

/**
 * The count a mounting was bought for is read from its price, so taking arcs
 * off it does not shrink what was paid for — the bug a player hit was a
 * three-arc beam that became a two-arc beam the moment an arc was moved.
 */
const beam3 = CATALOGUE_WEAPONS.find((e) => e.weaponClass === 'beam' && e.rating === 3)!
const threeArc = beam3.mountings.find((m) => m.arcs === 3)!

function beam(arcs: WeaponDef['arcs']): WeaponDef {
  return {
    id: 'w1',
    label: 'Beam-3',
    weaponClass: 'beam',
    rating: 3,
    variant: 'standard',
    arcs,
    mass: threeArc.mass,
    points: threeArc.points,
  }
}

describe('what a mounting was bought to cover (4.2)', () => {
  it('reads the count off the price, however many arcs are chosen right now', () => {
    expect(boughtArcs(beam(['FP', 'F', 'FS']))).toBe(3)
    expect(boughtArcs(beam(['F', 'FS']))).toBe(3)
    expect(boughtArcs(beam([]))).toBe(3)
    expect(mountingFor(beam([]))?.arcs).toBe(3)
  })

  it('falls back to the arcs a weapon off the catalogue has, and never below one', () => {
    const odd: WeaponDef = { ...beam(['F', 'FS']), mass: 99, points: 1 }
    expect(boughtArcs(odd)).toBe(2)
    expect(boughtArcs({ ...odd, arcs: [] })).toBe(1)
  })

  it('spreads a new mounting forward, and fits arcs to a count', () => {
    expect(defaultArcs(1)).toEqual(['F'])
    expect(defaultArcs(3)).toEqual(['F', 'FS', 'FP'])
    expect(defaultArcs(6)).toHaveLength(6)
    expect(fitArcs(['F', 'FS', 'AS'], 1)).toEqual(['F'])
    expect(fitArcs(['A'], 3)).toEqual(['F', 'FS', 'A'])
    expect(fitArcs(['A', 'A'], 2)).toEqual(['F', 'A'])
  })
})
